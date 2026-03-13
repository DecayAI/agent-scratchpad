---
name: agent-scratchpad
description: Reduces output token cost by storing reusable content in a named registry and referencing it with {{key}} syntax instead of regenerating. Use whenever an agent run will repeat any content block, reuse a reasoning conclusion, or build output incrementally — even if the user hasn't mentioned tokens or cost.
---

# agent-scratchpad

## When to use the registry

- **Repeated content**: If the same block will appear more than once in output, store it with `scratchpad_set` and emit `{{key}}` references instead of regenerating it each time.
- **Expensive reasoning**: After completing a multi-step chain or computation, store the conclusion before referencing it — don't re-derive it inline.
- **Incremental output**: When building a large response in stages, store each completed section before continuing.

## Editing stored values

Prefer `patch` or `regex_replace` for targeted modifications. Only use `scratchpad_set` to overwrite when a full replacement is warranted.

## Hard contract

Only emit a `{{key}}` reference after a confirmed successful `scratchpad_set`. References to undefined keys throw `ScratchpadReferenceError` — there is no fallback or default value.

The host calls `resolve()` before returning output to the user. Do not manually expand references in your output.

Registry is in-memory and scoped to this run.