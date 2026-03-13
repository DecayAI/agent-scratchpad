/** Parameters for {@link scratchpadSet}. */
export interface SetParams {
  /** Variable name (must match `[a-zA-Z_][a-zA-Z0-9_]*`). */
  key: string;
  /** The string value to store. */
  value: string;
}

/** Parameters for {@link scratchpadGet}. */
export interface GetParams {
  /** Variable name to read. */
  key: string;
}

/** Parameters for {@link scratchpadDelete}. */
export interface DeleteParams {
  /** Variable name to remove. */
  key: string;
}

/** Parameters for {@link scratchpadAppend}. */
export interface AppendParams {
  /** Variable name to append to. */
  key: string;
  /** String to append. */
  value: string;
}

/** Parameters for {@link scratchpadPatch}. */
export interface PatchParams {
  /** Variable name to patch. */
  key: string;
  /** Substring to find (first occurrence). */
  find: string;
  /** Replacement string. */
  replace: string;
}

/** Parameters for {@link scratchpadSlice}. */
export interface SliceParams {
  /** Variable name to slice from. */
  key: string;
  /** Start index (inclusive, 0-based). */
  start: number;
  /** End index (exclusive). Omit to slice to end. */
  end?: number;
}

/** Parameters for {@link scratchpadRegexReplace}. */
export interface RegexReplaceParams {
  /** Variable name to modify. */
  key: string;
  /** Regular expression pattern string. */
  pattern: string;
  /** Replacement string (supports `$1`, `$2`, etc.). */
  replace: string;
  /** Regex flags (e.g. `"g"`, `"gi"`). Defaults to `""`. */
  flags?: string;
}

/** JSON-schema-style tool definition, compatible with Anthropic and OpenAI tool formats. */
export interface ToolDefinition {
  /** Tool name (e.g. `"scratchpad_set"`). */
  name: string;
  /** Human-readable description for the LLM. */
  description: string;
  /** JSON Schema for the tool's input parameters. */
  input_schema: Record<string, unknown>;
}

/** Configuration options for {@link ScratchpadRegistry}. All fields are optional. */
export interface RegistryOptions {
  /** Maximum number of variables allowed. Defaults to `Infinity`. */
  maxKeys?: number;
  /** Maximum byte length for any single value. Defaults to `Infinity`. */
  maxValueBytes?: number;
  /** Maximum character length for key names. Defaults to `64`. */
  maxKeyLength?: number;
  /**
   * Called for every registry operation when provided.
   * Receives the operation name, key, and an optional value snippet.
   */
  onDebug?: (op: string, key: string, detail?: string) => void;
}
