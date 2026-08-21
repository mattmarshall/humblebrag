import { defineAgent } from "eve";
import { bedrock, textModelId } from "../../lib/model";

export default defineAgent({
  description: "Writes Influenzr posts: image-first lifestyle humblebrags, creator personas, captions, comments, and aesthetic visual briefs.",
  model: bedrock(textModelId),
  modelContextWindowTokens: 300_000,
});
