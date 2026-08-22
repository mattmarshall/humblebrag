"""Tests for the pure logic in handler.py — no GPU, no ComfyUI, no network.

The parts worth testing off-box are the ones that would waste GPU minutes if
wrong: placeholder substitution against the real workflow files, and the render
ordering that guarantees an identity reference exists before the scene runs.
"""

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import handler  # noqa: E402


class ApplyInputsTest(unittest.TestCase):
    def test_fills_every_placeholder_in_the_avatar_workflow(self):
        graph = handler.load_workflow("avatar")
        filled = handler.apply_inputs(graph, {
            "prompt": "a fictional adult",
            "negative_prompt": "no logos",
            "seed": 42,
            "width": 1024,
            "height": 1024,
        })
        leftover = [v for node in filled.values() for v in node["inputs"].values()
                    if isinstance(v, str) and v.startswith("$")]
        self.assertEqual(leftover, [])
        self.assertEqual(filled["3"]["inputs"]["seed"], 42)
        self.assertEqual(filled["6"]["inputs"]["text"], "a fictional adult")

    def test_scene_workflow_consumes_the_identity_reference(self):
        graph = handler.load_workflow("scene")
        filled = handler.apply_inputs(graph, {
            "prompt": "at a conference",
            "negative_prompt": "no logos",
            "seed": 7,
            "width": 1216,
            "height": 832,
            "reference_image": "post-avatar.png",
            "instantid_ip_weight": 0.8,
            "instantid_cn_strength": 0.25,
            "instantid_end_at": 0.8,
        })
        self.assertEqual(filled["10"]["inputs"]["image"], "post-avatar.png")
        # The sampler must consume InstantID's conditioning, not the raw CLIP
        # encodes — otherwise the scene silently loses identity locking.
        self.assertEqual(filled["3"]["inputs"]["model"], ["14", 0])
        self.assertEqual(filled["3"]["inputs"]["positive"], ["14", 1])
        self.assertEqual(filled["3"]["inputs"]["negative"], ["14", 2])

    def test_identity_is_held_while_layout_control_is_released(self):
        # The scene must keep the face but not inherit the reference headshot's
        # framing. Identity rides on ip_weight; cn_strength is what pins layout,
        # so they must not be turned down together.
        self.assertGreaterEqual(handler.DEFAULT_INSTANTID_IP_WEIGHT, 0.7)
        self.assertLessEqual(handler.DEFAULT_INSTANTID_CN_STRENGTH, 0.35)
        self.assertEqual(handler.load_workflow("scene")["14"]["class_type"],
                         "ApplyInstantIDAdvanced")

    def test_instantid_node_supplies_every_required_input(self):
        # ComfyUI rejects the whole graph with a bare 400 when a required input
        # is missing, which is expensive to diagnose from a live run. These are
        # ApplyInstantIDAdvanced's required inputs.
        required = {
            "instantid", "insightface", "control_net", "image", "model",
            "positive", "negative", "ip_weight", "cn_strength", "start_at",
            "end_at", "noise", "combine_embeds",
        }
        supplied = set(handler.load_workflow("scene")["14"]["inputs"])
        self.assertEqual(required - supplied, set(), "missing required inputs")

    def test_missing_placeholder_is_loud(self):
        with self.assertRaises(KeyError):
            handler.apply_inputs(handler.load_workflow("avatar"), {"prompt": "x"})

    def test_does_not_mutate_the_cached_graph(self):
        graph = handler.load_workflow("avatar")
        handler.apply_inputs(graph, {
            "prompt": "a", "negative_prompt": "b", "seed": 1, "width": 8, "height": 8,
        })
        self.assertEqual(graph["6"]["inputs"]["text"], "$prompt")


class RenderOrderTest(unittest.TestCase):
    def test_scene_renders_after_the_avatar_it_references(self):
        images = [
            {"slot": "scene", "identityFrom": "avatar"},
            {"slot": "person:b"},
            {"slot": "avatar"},
        ]
        ordered = sorted(images, key=lambda image: image.get("identityFrom") is not None)
        self.assertEqual(ordered[-1]["slot"], "scene")
        self.assertLess(
            [i["slot"] for i in ordered].index("avatar"),
            [i["slot"] for i in ordered].index("scene"),
        )


class WorkflowFileTest(unittest.TestCase):
    def test_both_workflows_are_valid_comfy_api_graphs(self):
        for name in ("avatar", "scene"):
            graph = handler.load_workflow(name)
            for node_id, node in graph.items():
                self.assertIn("class_type", node, f"{name}.{node_id}")
                self.assertIn("inputs", node, f"{name}.{node_id}")
            # Every node reference must point at a node that exists.
            for node_id, node in graph.items():
                for value in node["inputs"].values():
                    if isinstance(value, list) and value and isinstance(value[0], str):
                        self.assertIn(value[0], graph, f"{name}.{node_id} -> {value[0]}")

    def test_dimensions_are_sdxl_friendly(self):
        for ratio, (w, h) in handler.DIMENSIONS.items():
            self.assertEqual(w % 64, 0, ratio)
            self.assertEqual(h % 64, 0, ratio)


if __name__ == "__main__":
    unittest.main()
