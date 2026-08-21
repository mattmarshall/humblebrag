"""RunPod Serverless handler for humblebrag image generation.

One job renders one whole post: the author avatar, the scene (identity-locked to
that avatar via InstantID), and three commenter avatars. Keeping all five in a
single job means the model loads once and the avatar->scene dependency is
resolved in-process, so no queue orchestration is needed for it.

Each image is PUT straight to a presigned S3 URL supplied in the payload. The
worker never holds AWS credentials — RunPod publishes no OIDC issuer, so the app
signs the URLs on our behalf and we just upload against them.

Job input:
  {
    "postId":  "abc123",
    "network": "workit" | "influenzr",
    "images": [
      {"slot": "avatar", "kind": "avatar", "prompt": "...",
       "negativePrompt": "...", "aspectRatio": "1:1", "seed": 1,
       "uploadUrl": "https://..."},
      {"slot": "scene", "kind": "scene", ..., "identityFrom": "avatar"},
      {"slot": "person:<id>", "kind": "avatar", ...}
    ]
  }

Returns {"postId", "uploaded": [slot, ...], "failed": [{"slot", "error"}]}.
The app derives every public URL from the post id itself and trusts only the
slot names here, so this worker cannot repoint a post at an arbitrary image.
"""

import copy
import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

import runpod

COMFY_URL = os.environ.get("COMFY_URL", "http://127.0.0.1:8188")
WORKFLOW_DIR = pathlib.Path(__file__).parent / "workflows"
COMFY_BOOT_TIMEOUT = int(os.environ.get("COMFY_BOOT_TIMEOUT", "300"))
RENDER_TIMEOUT = int(os.environ.get("RENDER_TIMEOUT", "300"))

# SDXL is trained at ~1 megapixel and wants dimensions divisible by 64.
DIMENSIONS = {"1:1": (1024, 1024), "3:2": (1216, 832)}


def _request(path, data=None, method=None, headers=None):
    url = f"{COMFY_URL}{path}"
    body = None
    request_headers = dict(headers or {})
    if data is not None:
        body = json.dumps(data).encode()
        request_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    with urllib.request.urlopen(request, timeout=RENDER_TIMEOUT) as response:
        payload = response.read()
    return json.loads(payload) if payload else {}


def wait_for_comfy():
    deadline = time.time() + COMFY_BOOT_TIMEOUT
    last = None
    while time.time() < deadline:
        try:
            _request("/system_stats")
            return
        except Exception as cause:  # noqa: BLE001 - boot probe, any failure means "not up yet"
            last = cause
            time.sleep(1)
    raise RuntimeError(f"ComfyUI did not become ready within {COMFY_BOOT_TIMEOUT}s: {last}")


def upload_reference(image_bytes, name):
    """Push an in-memory image into ComfyUI's input dir so LoadImage can read it."""
    boundary = uuid.uuid4().hex
    parts = [
        f"--{boundary}".encode(),
        f'Content-Disposition: form-data; name="image"; filename="{name}"'.encode(),
        b"Content-Type: image/png",
        b"",
        image_bytes,
        f"--{boundary}".encode(),
        b'Content-Disposition: form-data; name="overwrite"',
        b"",
        b"true",
        f"--{boundary}--".encode(),
        b"",
    ]
    body = b"\r\n".join(parts)
    request = urllib.request.Request(
        f"{COMFY_URL}/upload/image",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=RENDER_TIMEOUT) as response:
        return json.loads(response.read())["name"]


def load_workflow(name):
    with open(WORKFLOW_DIR / f"{name}.json", encoding="utf-8") as handle:
        return json.load(handle)


def apply_inputs(graph, values):
    """Set node inputs by the `$key` placeholders baked into the workflow JSON."""
    graph = copy.deepcopy(graph)
    for node in graph.values():
        for field, value in list(node.get("inputs", {}).items()):
            if isinstance(value, str) and value.startswith("$"):
                key = value[1:]
                if key not in values:
                    raise KeyError(f"workflow placeholder ${key} has no value")
                node["inputs"][field] = values[key]
    return graph


def render(graph):
    """Queue a graph and return the bytes of the single image it produces."""
    client_id = uuid.uuid4().hex
    queued = _request("/prompt", {"prompt": graph, "client_id": client_id})
    prompt_id = queued["prompt_id"]

    deadline = time.time() + RENDER_TIMEOUT
    while time.time() < deadline:
        history = _request(f"/history/{prompt_id}")
        entry = history.get(prompt_id)
        if entry:
            status = entry.get("status", {})
            if status.get("status_str") == "error":
                raise RuntimeError(f"ComfyUI reported an error: {json.dumps(status)[:500]}")
            for output in entry.get("outputs", {}).values():
                for image in output.get("images", []):
                    query = urllib.parse.urlencode({
                        "filename": image["filename"],
                        "subfolder": image.get("subfolder", ""),
                        "type": image.get("type", "output"),
                    })
                    with urllib.request.urlopen(f"{COMFY_URL}/view?{query}", timeout=RENDER_TIMEOUT) as response:
                        return response.read()
        time.sleep(0.5)
    raise RuntimeError(f"Render timed out after {RENDER_TIMEOUT}s")


def upload(url, image_bytes):
    """PUT to the presigned URL. Content-Type must match what the app signed."""
    request = urllib.request.Request(
        url, data=image_bytes, headers={"Content-Type": "image/jpeg"}, method="PUT"
    )
    try:
        with urllib.request.urlopen(request, timeout=RENDER_TIMEOUT) as response:
            if response.status not in (200, 204):
                raise RuntimeError(f"S3 returned {response.status}")
    except urllib.error.HTTPError as cause:
        detail = cause.read()[:300].decode("utf-8", "replace")
        # 403 here almost always means the presigned URL outlived its STS
        # credentials; /api/cron/reconcile re-submits with fresh ones.
        raise RuntimeError(f"upload failed ({cause.code}): {detail}") from cause


def handler(job):
    payload = job.get("input") or {}
    post_id = payload.get("postId")
    images = payload.get("images") or []
    if not post_id or not images:
        return {"error": "postId and images are required"}

    wait_for_comfy()
    avatar_graph = load_workflow("avatar")
    scene_graph = load_workflow("scene")

    uploaded = []
    failed = []
    rendered = {}

    # Render avatars first so an identity reference exists before the scene runs.
    ordered = sorted(images, key=lambda image: image.get("identityFrom") is not None)

    for image in ordered:
        slot = image.get("slot")
        try:
            width, height = DIMENSIONS.get(image.get("aspectRatio", "1:1"), DIMENSIONS["1:1"])
            values = {
                "prompt": image["prompt"],
                "negative_prompt": image["negativePrompt"],
                "seed": int(image["seed"]),
                "width": width,
                "height": height,
            }

            reference_slot = image.get("identityFrom")
            if reference_slot:
                reference = rendered.get(reference_slot)
                if not reference:
                    raise RuntimeError(f"identity reference {reference_slot} was never rendered")
                values["reference_image"] = upload_reference(reference, f"{post_id}-{reference_slot}.png")
                graph = scene_graph
            else:
                graph = avatar_graph

            image_bytes = render(apply_inputs(graph, values))
            rendered[slot] = image_bytes
            upload(image["uploadUrl"], image_bytes)
            uploaded.append(slot)
            print(f"[humblebrag:worker] rendered {post_id} {slot}", flush=True)
        except Exception as cause:  # noqa: BLE001 - one bad slot must not lose the rest
            print(f"[humblebrag:worker] FAILED {post_id} {slot}: {cause}", flush=True)
            failed.append({"slot": slot, "error": str(cause)})

    return {"postId": post_id, "uploaded": uploaded, "failed": failed}


runpod.serverless.start({"handler": handler})
