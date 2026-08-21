import { disableTool } from "eve/tools";

// The generic self-delegation tool carries an open-ended `outputSchema`
// property that Amazon Bedrock's Converse API rejects. Humblebrag delegates
// only to its two declared network specialists, so the generic tool is both
// unnecessary and less constrained than the authored workflow.
export default disableTool();
