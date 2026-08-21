import { defineTool } from "eve/tools";
import { humblebragPostSchema } from "../lib/humblebrag";

export default defineTool({
  description: "Validate and submit the final Humblebrag post. Call this exactly once after the matching network specialist returns; its arguments must contain the complete post.",
  inputSchema: humblebragPostSchema,
  outputSchema: humblebragPostSchema,
  execute(post) {
    return post;
  },
});
