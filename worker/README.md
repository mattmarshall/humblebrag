# humblebrag image worker

Renders one post's five images on a RunPod Serverless endpoint and uploads each
to a presigned S3 URL.

## Why this exists

Bedrock's `stability.stable-image-ultra-v1:1` is capped at **1 request per
minute** and the quota is **not adjustable** (`L-F192B1D7`), and the model is
only offered in `us-west-2`. Five Ultra calls per post meant one post consumed
five minutes of the account's entire image capacity, so any concurrency
throttled. RunPod has no such ceiling.

## Contract

Input (`job["input"]`):

```jsonc
{
  "postId": "abc123",
  "network": "workit",
  "images": [
    {"slot": "avatar",       "kind": "avatar", "prompt": "...", "negativePrompt": "...",
     "aspectRatio": "1:1", "seed": 1, "uploadUrl": "https://..."},
    {"slot": "scene",        "kind": "scene",  "aspectRatio": "3:2",
     "identityFrom": "avatar", ...},
    {"slot": "person:<id>",  "kind": "avatar", "aspectRatio": "1:1", ...}
  ]
}
```

Output:

```json
{"postId": "abc123", "uploaded": ["avatar", "scene", "..."], "failed": []}
```

The app derives every public URL from the post id and trusts only the slot names
here, so this worker cannot repoint a post at an arbitrary image. It never
receives AWS credentials — RunPod publishes no OIDC issuer, so the Vercel app
signs the PUT URLs and passes them in.

## Layout

| File | Purpose |
| --- | --- |
| `handler.py` | Orders the renders, drives the local ComfyUI HTTP API, uploads. |
| `workflows/avatar.json` | SDXL text-to-image. Used for the author and all three commenters. |
| `workflows/scene.json` | SDXL + InstantID: identity from the author avatar, composition from a separate keypoint image. |
| `Dockerfile` | `runpod/worker-comfyui:5.8.6-sdxl` + InstantID nodes and weights. |

The image deliberately sets **no `CMD`**. The base image's `CMD ["/start.sh"]`
launches ComfyUI in the background and then runs `/handler.py`; copying our
handler over that path swaps in our logic while keeping ComfyUI's startup.
Setting our own `CMD` skips `start.sh`, ComfyUI never launches, and every job
hangs until the handler's boot probe times out.

Workflows are ComfyUI **API format**. Any string input written as `"$name"` is a
placeholder the handler fills: `prompt`, `negative_prompt`, `seed`, `width`,
`height`, and `reference_image` (scene only).

## Build and deploy

```bash
docker build --platform linux/amd64 -t <registry>/humblebrag-worker:0.1.0 worker/
docker push <registry>/humblebrag-worker:0.1.0
```

Then create a Serverless endpoint on that image:

- GPU: **RTX 4090 (24 GB)** — SDXL + InstantID fits comfortably, ~4 s/image.
- Workers: min 0, max 3. Enable **FlashBoot**.
- Container disk: 30 GB (the weights are baked in).
- Execution timeout: 600 s. A five-image post is ~40–60 s warm.
- No environment variables are required; everything arrives in the job payload.

Put the endpoint id and an API key into the Vercel project as
`RUNPOD_ENDPOINT_ID` and `RUNPOD_API_KEY`.

## Why the scene renders twice

InstantID decides *where* the face sits from its `image_kps` input. Supply none
and it falls back to the reference headshot's own keypoints — centred and
face-filling — so the scene comes back cropped like a portrait no matter what
the prompt asks for. Lowering `cn_strength` softens the effect but never moves
the frame.

    pass 1   plain SDXL at scene dimensions
             -> establishes framing; its invented face is discarded
    pass 2   InstantID: identity from the avatar, layout from pass 1

That costs roughly one extra render per post (~10s). If pass one's face is too
small or turned away for keypoints to be extracted, InstantID errors and the
handler falls back to the single-pass graph rather than losing the post over
framing.

## Tuning the scene

Identity and composition pull against each other, and they are controlled
separately. `ApplyInstantIDAdvanced` is used precisely because the basic
`ApplyInstantID` collapses both into one `weight`.

| Knob | Default | Effect |
| --- | --- | --- |
| `instantIdIpWeight` | 0.8 | Identity strength. Drop it and the scene becomes a different person. |
| `instantIdCnStrength` | 0.25 | Layout control. InstantID derives ControlNet keypoints from the reference headshot, so a high value pins the scene to a centred, face-filling portrait no matter what the prompt asks for. |
| `instantIdEndAt` | 0.8 | When control is released during the denoise. |

Both are read per-image from the job payload, so they can be tuned without
rebuilding the image — which otherwise costs ~20 minutes plus a cold start.

What the live runs actually showed, at a fixed seed:

- `weight 0.8` (combined): identity held, scene was a second headshot.
- `weight 0.55` (combined): identity **lost**, scene still a headshot, and it
  drifted to monochrome. Turning both down together is the trap.
- `ip_weight 0.8` + `cn_strength 0.25`: identity held **and** the scene rendered
  a microphone, a venue and different wardrobe.

Prompts matter as much as the knobs. SDXL is CLIP-conditioned, truncates around
77 tokens and does not follow instructions — instruction-style prose from the
Bedrock era got rendered as literal garbled text in the image. Keep prompts to
short descriptive phrases, put negations in the negative prompt, and say
"colour" explicitly: "candid photograph, natural light" alone drifted to black
and white.

## Validating the workflows

⚠️ `workflows/scene.json` is written against the node names exported by
[`cubiq/ComfyUI_InstantID`](https://github.com/cubiq/ComfyUI_InstantID)
(`InstantIDModelLoader`, `InstantIDFaceAnalysis`, `ApplyInstantID`). **These
graphs have not yet been executed against a live ComfyUI.** Before wiring the
endpoint into production, run one job and confirm the graph validates — node
names and input keys in custom node packs drift between versions, and a mismatch
surfaces as a ComfyUI validation error rather than a bad image. Pin
`INSTANTID_REF` to a known-good commit once verified.

Smoke test against a built image locally:

```bash
docker run --gpus all -p 8188:8188 -it <registry>/humblebrag-worker:0.1.0 \
  python -c "import json,urllib.request; print('comfy up')"
```

## Content safety

Bedrock applied managed content filtering; RunPod does not, and the premise text
is user-supplied. Generated images are uploaded to a public CloudFront URL and
given a shareable permalink, and the app auto-features the newest completed post
per network — so a flagged image is published, not merely shown to whoever asked
for it.

`safety.py` classifies every image **before upload**, so flagged bytes never
become publicly addressable:

| Score | Behaviour |
| --- | --- |
| `< 0.55` | passes |
| `0.55 – 0.90` | passes only with per-post consent (`allowSensitive`); the app then keeps the post off the homepage and noindexes it |
| `>= 0.90` | never passes, consent or not |

Thresholds are overridable via `NSFW_REVIEW_THRESHOLD` / `NSFW_BLOCK_THRESHOLD`.
Job output carries `nsfwScores` per slot and a `sensitive` list.

⚠️ The model (`Falconsai/nsfw_image_detection`) scores **sexual content**. It does
**not** estimate age, so it is not the control for minor-adjacent imagery. That
is a separate prompt-level rejection in `lib/runpod.ts`, applied before anything
is generated and not bypassable by consent.

The negative prompts still carry the parody boundaries from the root `README.md`
— no real people, no logos, no readable brand marks.
