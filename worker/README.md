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
| `workflows/scene.json` | SDXL + InstantID, taking the rendered author avatar as the identity reference. |
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

Bedrock applied managed content filtering; RunPod does not. The negative prompts
carried over from the retired path are what enforce the parody boundaries in the
root `README.md` — no real people, no logos, no readable brand marks. Since the
premise text is user-supplied and reaches the prompt, **an NSFW/face-similarity
check before upload is still outstanding** and should land before this endpoint
takes public traffic.
