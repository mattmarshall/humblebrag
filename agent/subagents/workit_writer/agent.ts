import { defineAgent } from "eve";
import { bedrock, textModelId } from "../../lib/model";
import { workitPostSchema } from "../../lib/humblebrag";

export default defineAgent({
  description: "Writes WorkIt posts: corporate career-theater humblebrags, executive personas, professional comments, and visual briefs.",
  model: bedrock(textModelId),
  modelContextWindowTokens: 300_000,
  outputSchema: workitPostSchema,
});
