import { ScratchpadRegistry } from "./registry.js";
import { ScratchpadReferenceError } from "./errors.js";
import type {
  ToolDefinition,
  SetParams,
  GetParams,
  DeleteParams,
  AppendParams,
  PatchParams,
  SliceParams,
  RegexReplaceParams,
} from "./types.js";

// ── Tool Definitions ────────────────────────────────────────────────

/**
 * JSON-schema tool definitions for all 7 scratchpad operations.
 * Pass this array directly into your LLM's `tools` parameter.
 *
 * Compatible with both the Anthropic Messages API and the OpenAI
 * Chat Completions API (wrap each entry in `{ type: "function", function: ... }`
 * for OpenAI).
 */
export const SCRATCHPAD_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "scratchpad_set",
    description:
      "Store a named variable in the scratchpad. Creates a new variable or overwrites an existing one. Use {{key}} syntax in any later output to reference the stored value.",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description:
            "Variable name. Must start with a letter or underscore, followed by alphanumerics or underscores.",
        },
        value: {
          type: "string",
          description: "The string value to store.",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "scratchpad_get",
    description:
      "Read a variable from the scratchpad. Returns the current value. Fails if the key does not exist.",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Variable name to read.",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "scratchpad_delete",
    description:
      "Remove a variable from the scratchpad. Any subsequent {{key}} references will fail.",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Variable name to delete.",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "scratchpad_append",
    description:
      "Append a string to an existing scratchpad variable. Fails if the key does not exist.",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Variable name to append to.",
        },
        value: {
          type: "string",
          description: "String to append.",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "scratchpad_patch",
    description:
      "Find and replace a substring within a scratchpad variable. Replaces the first occurrence. Fails if the key does not exist.",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Variable name to patch.",
        },
        find: {
          type: "string",
          description: "Substring to find.",
        },
        replace: {
          type: "string",
          description: "Replacement string.",
        },
      },
      required: ["key", "find", "replace"],
    },
  },
  {
    name: "scratchpad_slice",
    description:
      "Extract a substring from a scratchpad variable by index. Returns the sliced string without modifying the stored value. Fails if the key does not exist.",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Variable name to slice from.",
        },
        start: {
          type: "number",
          description: "Start index (inclusive, 0-based).",
        },
        end: {
          type: "number",
          description:
            "End index (exclusive). If omitted, slices to the end of the string.",
        },
      },
      required: ["key", "start"],
    },
  },
  {
    name: "scratchpad_regex_replace",
    description:
      "Apply a regex find-and-replace on a scratchpad variable. Modifies the stored value in place. Fails if the key does not exist or if the regex is invalid.",
    input_schema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Variable name to modify.",
        },
        pattern: {
          type: "string",
          description: "Regular expression pattern string.",
        },
        replace: {
          type: "string",
          description:
            "Replacement string (supports $1, $2, etc. for capture groups).",
        },
        flags: {
          type: "string",
          description: 'Regex flags (e.g. "g", "gi"). Defaults to "" (no flags).',
        },
      },
      required: ["key", "pattern", "replace"],
    },
  },
];

// ── Tool Handlers ───────────────────────────────────────────────────

function requireKey(registry: ScratchpadRegistry, key: string): string {
  const value = registry.get(key);
  if (value === undefined) {
    throw new ScratchpadReferenceError(key);
  }
  return value;
}

/**
 * Create or overwrite a variable.
 * @returns Confirmation string with key name and value length.
 */
export function scratchpadSet(
  registry: ScratchpadRegistry,
  params: SetParams
): string {
  registry.set(params.key, params.value);
  return `Stored "${params.key}" (${params.value.length} chars)`;
}

/**
 * Read a variable's current value.
 * @throws {ScratchpadReferenceError} If the key does not exist.
 */
export function scratchpadGet(
  registry: ScratchpadRegistry,
  params: GetParams
): string {
  return requireKey(registry, params.key);
}

/**
 * Remove a variable from the registry.
 * @throws {ScratchpadReferenceError} If the key does not exist.
 */
export function scratchpadDelete(
  registry: ScratchpadRegistry,
  params: DeleteParams
): string {
  requireKey(registry, params.key);
  registry.delete(params.key);
  return `Deleted "${params.key}"`;
}

/**
 * Append a string to an existing variable.
 * @throws {ScratchpadReferenceError} If the key does not exist.
 */
export function scratchpadAppend(
  registry: ScratchpadRegistry,
  params: AppendParams
): string {
  const current = requireKey(registry, params.key);
  registry.set(params.key, current + params.value);
  return `Appended to "${params.key}" (now ${current.length + params.value.length} chars)`;
}

/**
 * Find and replace the first occurrence of a substring in a variable.
 * @throws {ScratchpadReferenceError} If the key does not exist.
 */
export function scratchpadPatch(
  registry: ScratchpadRegistry,
  params: PatchParams
): string {
  const current = requireKey(registry, params.key);
  const updated = current.replace(params.find, params.replace);
  registry.set(params.key, updated);
  return `Patched "${params.key}" (${updated.length} chars)`;
}

/**
 * Extract a substring by index. Non-mutating — the stored value is unchanged.
 * @returns The sliced substring.
 * @throws {ScratchpadReferenceError} If the key does not exist.
 */
export function scratchpadSlice(
  registry: ScratchpadRegistry,
  params: SliceParams
): string {
  const current = requireKey(registry, params.key);
  return current.slice(params.start, params.end);
}

/**
 * Apply a regex find-and-replace on a variable, modifying it in place.
 * @throws {ScratchpadReferenceError} If the key does not exist.
 * @throws {SyntaxError} If the regex pattern is invalid.
 */
export function scratchpadRegexReplace(
  registry: ScratchpadRegistry,
  params: RegexReplaceParams
): string {
  const current = requireKey(registry, params.key);
  const regex = new RegExp(params.pattern, params.flags ?? "");
  const updated = current.replace(regex, params.replace);
  registry.set(params.key, updated);
  return `Regex replaced in "${params.key}" (${updated.length} chars)`;
}

// ── Dispatch ────────────────────────────────────────────────────────

/**
 * Route a tool call to the correct handler by name. Use this in your agent
 * loop to dispatch all `scratchpad_*` tool calls.
 *
 * @param registry - The registry instance.
 * @param name - Tool name (e.g. `"scratchpad_set"`).
 * @param input - The tool's input object from the LLM.
 * @returns The handler's result string (confirmation or value).
 * @throws {Error} If the tool name is not recognized.
 *
 * @example
 * ```ts
 * if (toolUse.name.startsWith("scratchpad_")) {
 *   const result = handleToolCall(registry, toolUse.name, toolUse.input);
 * }
 * ```
 */
export function handleToolCall(
  registry: ScratchpadRegistry,
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "scratchpad_set":
      return scratchpadSet(registry, input as unknown as SetParams);
    case "scratchpad_get":
      return scratchpadGet(registry, input as unknown as GetParams);
    case "scratchpad_delete":
      return scratchpadDelete(registry, input as unknown as DeleteParams);
    case "scratchpad_append":
      return scratchpadAppend(registry, input as unknown as AppendParams);
    case "scratchpad_patch":
      return scratchpadPatch(registry, input as unknown as PatchParams);
    case "scratchpad_slice":
      return scratchpadSlice(registry, input as unknown as SliceParams);
    case "scratchpad_regex_replace":
      return scratchpadRegexReplace(
        registry,
        input as unknown as RegexReplaceParams
      );
    default:
      throw new Error(`Unknown scratchpad tool: ${name}`);
  }
}
