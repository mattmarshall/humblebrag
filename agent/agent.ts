import { defineAgent } from "eve";
import { bedrock, fallbackTextModelId } from "./lib/model";

// The root agent is intentionally a cheap router. The two network-specific
// subagents own the actual creative voice and schemas.
export default defineAgent({
  model: bedrock(fallbackTextModelId),
  modelContextWindowTokens: 300_000,
});
