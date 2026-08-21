import { defineAgent } from "eve";
import { bedrock, textModelId } from "../../lib/model";

export default defineAgent({
  description: "Writes WorkIt posts: corporate career-theater humblebrags, executive personas, professional comments, and visual briefs.",
  model: bedrock(textModelId),
  modelContextWindowTokens: 300_000,
});
