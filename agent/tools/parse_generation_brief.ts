import { defineTool } from "eve/tools";
import { generationBriefSchema } from "../lib/humblebrag";

export default defineTool({
  description: "Parse and validate the NETWORK, PERSONA, INTENSITY, and PREMISE before routing. Call exactly once at the start of every request.",
  inputSchema: generationBriefSchema,
  outputSchema: generationBriefSchema,
  execute(brief) {
    return brief;
  },
});
