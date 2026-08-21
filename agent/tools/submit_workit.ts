import { defineTool } from "eve/tools";
import { workitPostSchema } from "../lib/humblebrag";

export default defineTool({
  description: "Validate and submit the final WorkIt post. Call exactly once after the WorkIt specialist returns; pass its complete result unchanged.",
  inputSchema: workitPostSchema,
  outputSchema: workitPostSchema,
  execute(post) {
    return post;
  },
});
