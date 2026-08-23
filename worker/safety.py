"""Image safety classification for generated images.

Bedrock applied managed content filtering; RunPod applies none, and the premise
text that reaches the prompt is user-supplied. Generated images are also
uploaded to a public CloudFront URL and given a shareable permalink, so a
flagged image is published, not merely shown to whoever asked for it. Classify
before upload so flagged bytes never become publicly addressable.

Two tiers:

  score < REVIEW           pass
  REVIEW <= score < BLOCK  pass only with explicit per-post consent, and the app
                           keeps those posts off the homepage and noindexes them
  score >= BLOCK           never passes, consent or not

The model is Falconsai/nsfw_image_detection, a ViT binary classifier
(0=normal, 1=nsfw). It scores sexual content. It does NOT estimate age, so it
cannot be the control for minor-adjacent imagery — that is handled separately by
prompt-level rejection in the app and by the negative prompts.
"""

import os
from io import BytesIO

MODEL_DIR = os.environ.get("NSFW_MODEL_DIR", "/models/nsfw")

# Deliberately conservative: this content gets published to a public URL.
REVIEW_THRESHOLD = float(os.environ.get("NSFW_REVIEW_THRESHOLD", "0.55"))
BLOCK_THRESHOLD = float(os.environ.get("NSFW_BLOCK_THRESHOLD", "0.90"))

_model = None
_processor = None


def _load():
    global _model, _processor
    if _model is None:
        import torch  # noqa: F401  (imported for side effects / availability)
        from transformers import AutoModelForImageClassification, ViTImageProcessor

        _processor = ViTImageProcessor.from_pretrained(MODEL_DIR)
        _model = AutoModelForImageClassification.from_pretrained(MODEL_DIR)
        _model.eval()
        if torch.cuda.is_available():
            _model.to("cuda")
    return _model, _processor


def score(image_bytes):
    """Probability that the image is NSFW, in [0, 1]."""
    import torch
    from PIL import Image

    model, processor = _load()
    with Image.open(BytesIO(image_bytes)) as img:
        inputs = processor(images=img.convert("RGB"), return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {k: v.to("cuda") for k, v in inputs.items()}
    with torch.no_grad():
        logits = model(**inputs).logits
    probabilities = torch.softmax(logits, dim=-1)[0]
    nsfw_index = next(
        (i for i, label in model.config.id2label.items() if str(label).lower() == "nsfw"),
        1,
    )
    return float(probabilities[int(nsfw_index)].item())


def verdict(image_bytes, allow_sensitive=False):
    """Return (allowed, score, reason)."""
    value = score(image_bytes)
    if value >= BLOCK_THRESHOLD:
        return False, value, f"blocked: nsfw score {value:.3f} >= {BLOCK_THRESHOLD}"
    if value >= REVIEW_THRESHOLD:
        if allow_sensitive:
            return True, value, f"sensitive: nsfw score {value:.3f} (accepted by consent)"
        return False, value, f"blocked: nsfw score {value:.3f} >= {REVIEW_THRESHOLD} without consent"
    return True, value, ""
