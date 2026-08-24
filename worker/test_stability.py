"""Contract tests for the Ultra client. No network: what matters here is that a
failure degrades to a local render instead of losing the post."""

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import stability  # noqa: E402


class ConfigTest(unittest.TestCase):
    def test_reports_unconfigured_without_a_key(self):
        import os
        saved = os.environ.pop("STABILITY_API_KEY", None)
        try:
            self.assertFalse(stability.is_configured())
            with self.assertRaises(stability.StabilityUnavailable):
                stability.generate("a prompt")
        finally:
            if saved is not None:
                os.environ["STABILITY_API_KEY"] = saved

    def test_failures_are_a_recoverable_type(self):
        # The handler catches this specific class to fall back to ComfyUI. If it
        # became a bare RuntimeError the fallback would stop matching and an
        # outage at Stability would start failing whole posts.
        self.assertTrue(issubclass(stability.StabilityUnavailable, RuntimeError))


class HandlerWiringTest(unittest.TestCase):
    def test_handler_falls_back_rather_than_raising(self):
        source = (pathlib.Path(__file__).parent / "handler.py").read_text()
        self.assertIn("except stability.StabilityUnavailable", source)
        self.assertIn("comfy-fallback", source)

    def test_jpeg_passthrough_avoids_a_second_encode(self):
        import handler
        jpeg = b"\xff\xd8\xff" + b"rest of a jpeg"
        self.assertIs(handler.to_jpeg(jpeg), jpeg)


if __name__ == "__main__":
    unittest.main()
