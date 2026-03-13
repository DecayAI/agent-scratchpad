import { ScratchpadRegistry } from "./registry.js";
import { ScratchpadReferenceError } from "./errors.js";

const REF_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/**
 * Replace all `{{var_name}}` references in `text` with values from the
 * registry. Performs a single pass — nested references are not expanded.
 *
 * @param text - The string containing `{{var}}` references.
 * @param registry - The registry to look up values in.
 * @returns The string with all references substituted.
 * @throws {ScratchpadReferenceError} If any referenced key does not exist.
 *
 * @example
 * ```ts
 * registry.set("name", "Alice");
 * resolve("Hello, {{name}}!", registry); // "Hello, Alice!"
 * ```
 */
export function resolve(text: string, registry: ScratchpadRegistry): string {
  return text.replace(REF_PATTERN, (match, key: string) => {
    const value = registry.get(key);
    if (value === undefined) {
      throw new ScratchpadReferenceError(key);
    }
    return value;
  });
}
