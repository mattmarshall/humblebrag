"""Threshold policy tests. These monkeypatch the classifier so the tiers are
verified deterministically, without a GPU and without needing to produce the
kind of image the top tier exists to reject."""

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import safety  # noqa: E402


class VerdictTest(unittest.TestCase):
    def setUp(self):
        self._real = safety.score

    def tearDown(self):
        safety.score = self._real

    def at(self, value):
        safety.score = lambda _b: value
        return safety.verdict(b"", allow_sensitive=False), safety.verdict(b"", allow_sensitive=True)

    def test_clean_images_pass_either_way(self):
        (no_consent, consent) = self.at(0.02)
        self.assertTrue(no_consent[0])
        self.assertTrue(consent[0])

    def test_borderline_needs_consent(self):
        (no_consent, consent) = self.at(0.70)
        self.assertFalse(no_consent[0], "borderline must not pass without consent")
        self.assertTrue(consent[0], "borderline should pass with consent")
        self.assertIn("sensitive", consent[2])

    def test_hard_floor_is_not_bypassable_by_consent(self):
        # The whole point of the floor: this content would be published to a
        # public URL, so a checkbox cannot authorise it.
        for value in (0.90, 0.95, 0.999, 1.0):
            (no_consent, consent) = self.at(value)
            self.assertFalse(no_consent[0], f"{value} must be blocked")
            self.assertFalse(consent[0], f"{value} must be blocked even with consent")

    def test_boundaries_are_inclusive_at_the_block_edge(self):
        self.assertFalse(self.at(safety.BLOCK_THRESHOLD)[1][0])
        self.assertTrue(self.at(safety.BLOCK_THRESHOLD - 0.001)[1][0])

    def test_review_floor_sits_below_the_block_floor(self):
        self.assertLess(safety.REVIEW_THRESHOLD, safety.BLOCK_THRESHOLD)

    def test_reason_is_populated_whenever_something_is_not_routine(self):
        self.assertEqual(self.at(0.02)[0][2], "")
        self.assertTrue(self.at(0.70)[0][2])
        self.assertTrue(self.at(0.95)[0][2])


if __name__ == "__main__":
    unittest.main()
