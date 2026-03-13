import { ScratchpadKeyError, ScratchpadLimitError } from "./errors.js";
import type { RegistryOptions } from "./types.js";

const KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const DEFAULT_MAX_KEY_LENGTH = 64;

/**
 * In-memory variable registry that persists for the lifetime of a single
 * agent run. Wraps a `Map<string, string>` with key validation and
 * configurable limits.
 *
 * @example
 * ```ts
 * const registry = new ScratchpadRegistry();
 * registry.set("greeting", "Hello, world!");
 * registry.get("greeting"); // "Hello, world!"
 * ```
 *
 * @example
 * ```ts
 * // With limits and debug logging
 * const registry = new ScratchpadRegistry({
 *   maxKeys: 50,
 *   maxValueBytes: 100_000,
 *   onDebug: (op, key, detail) => console.log(`[scratchpad] ${op} ${key}`, detail),
 * });
 * ```
 */
export class ScratchpadRegistry {
  private store = new Map<string, string>();
  private opts: Required<Omit<RegistryOptions, "onDebug">> & {
    onDebug?: RegistryOptions["onDebug"];
  };

  constructor(options?: RegistryOptions) {
    this.opts = {
      maxKeys: options?.maxKeys ?? Infinity,
      maxValueBytes: options?.maxValueBytes ?? Infinity,
      maxKeyLength: options?.maxKeyLength ?? DEFAULT_MAX_KEY_LENGTH,
      onDebug: options?.onDebug,
    };
  }

  private validateKey(key: string): void {
    if (!KEY_PATTERN.test(key)) {
      throw new ScratchpadKeyError(
        key,
        "must match [a-zA-Z_][a-zA-Z0-9_]* (start with letter or underscore, then alphanumerics or underscores)"
      );
    }
    if (key.length > this.opts.maxKeyLength) {
      throw new ScratchpadLimitError(
        `Key "${key}" exceeds max key length of ${this.opts.maxKeyLength} characters`
      );
    }
  }

  private debug(op: string, key: string, detail?: string): void {
    this.opts.onDebug?.(op, key, detail);
  }

  /**
   * Store a variable. Creates or overwrites.
   * @throws {ScratchpadKeyError} If the key is invalid.
   * @throws {ScratchpadLimitError} If the registry is full or the value exceeds max bytes.
   */
  set(key: string, value: string): void {
    this.validateKey(key);
    const byteLength = new TextEncoder().encode(value).byteLength;
    if (byteLength > this.opts.maxValueBytes) {
      throw new ScratchpadLimitError(
        `Value for "${key}" is ${byteLength} bytes, exceeding limit of ${this.opts.maxValueBytes} bytes`
      );
    }
    if (!this.store.has(key) && this.store.size >= this.opts.maxKeys) {
      throw new ScratchpadLimitError(
        `Registry is full (${this.opts.maxKeys} keys). Delete a variable before adding a new one.`
      );
    }
    this.store.set(key, value);
    this.debug("set", key, `${value.length} chars, ${byteLength} bytes`);
  }

  /**
   * Read a variable. Returns `undefined` if the key does not exist.
   * @throws {ScratchpadKeyError} If the key is invalid.
   */
  get(key: string): string | undefined {
    this.validateKey(key);
    const value = this.store.get(key);
    this.debug("get", key, value !== undefined ? `${value.length} chars` : "miss");
    return value;
  }

  /** Check whether a key exists in the registry. */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Remove a variable.
   * @returns `true` if the key existed, `false` otherwise.
   * @throws {ScratchpadKeyError} If the key is invalid.
   */
  delete(key: string): boolean {
    this.validateKey(key);
    const existed = this.store.delete(key);
    this.debug("delete", key, existed ? "removed" : "not found");
    return existed;
  }

  /** Return all stored variable names. */
  keys(): string[] {
    return [...this.store.keys()];
  }

  /** Remove all variables from the registry. */
  clear(): void {
    const count = this.store.size;
    this.store.clear();
    this.opts.onDebug?.("clear", "*", `${count} keys removed`);
  }

  /** Number of variables currently stored. */
  get size(): number {
    return this.store.size;
  }
}
