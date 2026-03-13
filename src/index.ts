export { ScratchpadRegistry } from "./registry.js";
export { resolve } from "./resolver.js";
export {
  SCRATCHPAD_TOOL_DEFINITIONS,
  handleToolCall,
  scratchpadSet,
  scratchpadGet,
  scratchpadDelete,
  scratchpadAppend,
  scratchpadPatch,
  scratchpadSlice,
  scratchpadRegexReplace,
} from "./tools.js";
export {
  ScratchpadReferenceError,
  ScratchpadKeyError,
  ScratchpadLimitError,
} from "./errors.js";
export type {
  SetParams,
  GetParams,
  DeleteParams,
  AppendParams,
  PatchParams,
  SliceParams,
  RegexReplaceParams,
  ToolDefinition,
  RegistryOptions,
} from "./types.js";
