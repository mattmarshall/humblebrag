import { defineTool } from "eve/tools";
import { influenzrPostSchema } from "../lib/humblebrag";

export default defineTool({
  description: "Validate and submit the final Influenzr post. Call exactly once after the Influenzr specialist returns; pass its complete result unchanged.",
  inputSchema: influenzrPostSchema,
  outputSchema: influenzrPostSchema,
  execute(post) {
    return post;
  },
});
