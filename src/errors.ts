/**
 * Thrown when a `{{key}}` reference is resolved but the key does not exist
 * in the registry. Catch this to detect agent hallucinations or premature
 * references.
 */
export class ScratchpadReferenceError extends Error {
  /** The variable name that was not found. */
  readonly key: string;

  constructor(key: string) {
    super(`Undefined scratchpad variable: {{${key}}}`);
    this.name = "ScratchpadReferenceError";
    this.key = key;
  }
}

/**
 * Thrown when a key fails validation (e.g. empty string, starts with a digit,
 * contains special characters).
 */
export class ScratchpadKeyError extends Error {
  /** The invalid key that was provided. */
  readonly key: string;

  constructor(key: string, reason: string) {
    super(`Invalid scratchpad key "${key}": ${reason}`);
    this.name = "ScratchpadKeyError";
    this.key = key;
  }
}

/**
 * Thrown when a registry operation would exceed a configured limit
 * (max keys, max value bytes, or max key length).
 */
export class ScratchpadLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScratchpadLimitError";
  }
}
