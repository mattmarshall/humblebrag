"""Stable Image Ultra, called directly rather than through Bedrock.

Bedrock caps this model at 1 request/minute and the quota is not adjustable,
which is what pushed the whole pipeline onto RunPod. Stability's own API serves
the same model at 150 requests per 10 seconds, so the model was never the
constraint — the quota was.

Used for the author avatar only. Ultra's faces are visibly better than SDXL's,
and that avatar is both the profile picture in the card and the identity
reference the scene is built from, so it is the one image where the quality
difference is worth $0.08. The scene stays on SDXL + InstantID: Ultra's
image-to-image preserves identity only by staying close to its source, so it
cannot open a headshot into a wide scene — pushing `strength` loses the face
before it gains composition.
"""

import os

ENDPOINT = "https://api.stability.ai/v2beta/stable-image/generate/ultra"
TIMEOUT_SECONDS = int(os.environ.get("STABILITY_TIMEOUT", "120"))


class StabilityUnavailable(RuntimeError):
    """Raised so the caller can fall back to a local render rather than fail."""


def is_configured():
    return bool(os.environ.get("STABILITY_API_KEY", "").strip())


def generate(prompt, negative_prompt="", aspect_ratio="1:1", seed=0):
    """Return JPEG bytes, or raise StabilityUnavailable."""
    import requests

    key = os.environ.get("STABILITY_API_KEY", "").strip()
    if not key:
        raise StabilityUnavailable("STABILITY_API_KEY is not set")

    fields = {
        "prompt": (None, prompt),
        "aspect_ratio": (None, aspect_ratio),
        "output_format": (None, "jpeg"),
        "seed": (None, str(int(seed))),
    }
    if negative_prompt:
        fields["negative_prompt"] = (None, negative_prompt)

    try:
        response = requests.post(
            ENDPOINT,
            headers={"authorization": f"Bearer {key}", "accept": "image/*"},
            files=fields,
            timeout=TIMEOUT_SECONDS,
        )
    except Exception as cause:  # noqa: BLE001 - network faults are all the same here
        raise StabilityUnavailable(f"request failed: {cause}") from cause

    if response.status_code != 200:
        # 402 means the account is out of credits, 429 means rate limited. Both
        # are recoverable by rendering locally instead, so they are not fatal.
        detail = response.text[:200]
        raise StabilityUnavailable(f"HTTP {response.status_code}: {detail}")

    if not response.content:
        raise StabilityUnavailable("empty response body")
    return response.content
