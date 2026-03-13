# agent-scratchpad

A lightweight, in-memory variable registry for LLM agents. Store a named snippet once, reference it cheaply via `{{var_name}}` syntax, and edit it in place — without external databases or persistence layers.

## Why

LLM agents in multi-step workflows repeatedly regenerate identical content across tool calls. `agent-scratchpad` gives the agent a **write-once, read-many** primitive:

- **Write** via tool calls (`scratchpad_set`, `scratchpad_append`, `scratchpad_patch`, etc.)
- **Read** via `{{var_name}}` references, resolved in any string output
- **Fail loudly** on undefined references — catches hallucinated variable names

Zero dependencies. Framework-agnostic. Works with any LLM API.

## Token Savings

Every time an agent regenerates the same block of text, those are billable output tokens. `agent-scratchpad` collapses repeated generation into a single `scratchpad_set` call followed by cheap `{{var_name}}` references.

Savings per run, using Claude Opus 4.6 output pricing ($25 / MTok):

| Block (tokens) | Reuse | Tokens saved | Cost saved |
|----------------|-------|-------------|------------|
| 100            | 3×    | 200         | $0.005     |
| 100            | 5×    | 400         | $0.010     |
| 100            | 10×   | 900         | $0.023     |
| 300            | 3×    | 600         | $0.015     |
| 300            | 5×    | 1,200       | $0.030     |
| 300            | 10×   | 2,700       | $0.068     |
| 500            | 3×    | 1,000       | $0.025     |
| 500            | 5×    | 2,000       | $0.050     |
| 500            | 10×   | 4,500       | $0.113     |
| 1,000          | 3×    | 2,000       | $0.050     |
| 1,000          | 5×    | 4,000       | $0.100     |
| 1,000          | 10×   | 9,000       | $0.225     |

_Tokens saved = block_size × (reuse_count − 1). Cost saved calculated at output token rate._

The mechanism: the agent calls `scratchpad_set` once to store the block, then emits `{{var_name}}` in subsequent outputs instead of regenerating the content. The host calls `resolve()` on the final output before returning it to the user — the substitution is invisible to the end user.

Output tokens cost 3–5× more than input tokens across major providers, making repeated output generation the highest-leverage place to optimize token spend.

The tool definitions themselves cost approximately ~741 tokens — meaning a single 300-token block reused 3× breaks even immediately.

## Install

```bash
npm install agent-scratchpad
```

## Quick Start

```ts
import {
  ScratchpadRegistry,
  SCRATCHPAD_TOOL_DEFINITIONS,
  handleToolCall,
  resolve,
} from "agent-scratchpad";

// 1. Create a registry (lives for one agent run)
const registry = new ScratchpadRegistry();

// 2. Pass tool definitions to your LLM
const tools = [...SCRATCHPAD_TOOL_DEFINITIONS, ...yourOwnTools];

// 3. In your agent loop, dispatch scratchpad tool calls
for (const toolUse of toolCalls) {
  if (toolUse.name.startsWith("scratchpad_")) {
    const result = handleToolCall(registry, toolUse.name, toolUse.input);
    // Return result as tool_result to the LLM
  }
}

// 4. Resolve {{references}} before returning output to the user
const finalText = resolve(rawAgentOutput, registry);
```

## Tools

The agent interacts with the registry through 7 tool calls:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `scratchpad_set` | `key`, `value` | Create or overwrite a variable |
| `scratchpad_get` | `key` | Read a variable explicitly |
| `scratchpad_delete` | `key` | Remove a variable |
| `scratchpad_append` | `key`, `value` | Append string to existing value |
| `scratchpad_patch` | `key`, `find`, `replace` | String find-and-replace (first occurrence) |
| `scratchpad_slice` | `key`, `start`, `end?` | Extract a substring (non-mutating) |
| `scratchpad_regex_replace` | `key`, `pattern`, `replace`, `flags?` | Regex replace within a value |

### Key naming rules

Keys must match `[a-zA-Z_][a-zA-Z0-9_]*` — start with a letter or underscore, followed by alphanumerics or underscores. Max length defaults to 64 characters (configurable).

## Configuration

Pass an options object to the constructor to set limits and enable debug logging:

```ts
const registry = new ScratchpadRegistry({
  maxKeys: 50,           // Max number of variables (default: Infinity)
  maxValueBytes: 100_000, // Max byte length per value (default: Infinity)
  maxKeyLength: 32,       // Max characters for key names (default: 64)
  onDebug: (op, key, detail) => {
    console.log(`[scratchpad] ${op} ${key}`, detail ?? "");
  },
});
```

All limits throw `ScratchpadLimitError` when exceeded. Debug callback is called for every `set`, `get`, `delete`, and `clear` operation.

## Reference Syntax

The agent emits `{{var_name}}` in any string. Call `resolve(text, registry)` to substitute all references:

```ts
registry.set("name", "Alice");
resolve("Hello, {{name}}!", registry);
// → "Hello, Alice!"
```

If `{{var_name}}` is encountered and the key does not exist, `resolve` throws a `ScratchpadReferenceError`. No silent failures.

References are resolved in a **single pass** — nested references (e.g. a value containing `{{other}}`) are not expanded recursively.

## Integration Examples

### Anthropic API

```ts
import Anthropic from "@anthropic-ai/sdk";
import {
  ScratchpadRegistry,
  SCRATCHPAD_TOOL_DEFINITIONS,
  handleToolCall,
  resolve,
} from "agent-scratchpad";

const client = new Anthropic();
const registry = new ScratchpadRegistry();

const messages = [{ role: "user", content: "..." }];

// Pass scratchpad tools to the API
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  tools: [...SCRATCHPAD_TOOL_DEFINITIONS],
  messages,
});

// Handle tool calls in your loop
for (const block of response.content) {
  if (block.type === "tool_use" && block.name.startsWith("scratchpad_")) {
    const result = handleToolCall(registry, block.name, block.input);
    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: block.id, content: result }] }
    );
  }
}

// Resolve references in final output
const finalText = resolve(assistantMessage, registry);
```

### OpenAI API

```ts
import OpenAI from "openai";
import {
  ScratchpadRegistry,
  SCRATCHPAD_TOOL_DEFINITIONS,
  handleToolCall,
  resolve,
} from "agent-scratchpad";

const client = new OpenAI();
const registry = new ScratchpadRegistry();

// Wrap definitions for OpenAI's format
const tools = SCRATCHPAD_TOOL_DEFINITIONS.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

const response = await client.chat.completions.create({
  model: "gpt-4o",
  tools,
  messages: [{ role: "user", content: "..." }],
});

// Dispatch tool calls
for (const call of response.choices[0].message.tool_calls ?? []) {
  if (call.function.name.startsWith("scratchpad_")) {
    const input = JSON.parse(call.function.arguments);
    const result = handleToolCall(registry, call.function.name, input);
    // Push tool result back into messages
  }
}
```

## Error Handling

```ts
import {
  ScratchpadReferenceError,
  ScratchpadKeyError,
  ScratchpadLimitError,
} from "agent-scratchpad";

// Missing variable reference
try {
  resolve("{{nonexistent}}", registry);
} catch (e) {
  if (e instanceof ScratchpadReferenceError) {
    console.log(e.key); // "nonexistent"
  }
}

// Invalid key format
try {
  registry.set("123bad", "value");
} catch (e) {
  if (e instanceof ScratchpadKeyError) {
    console.log(e.key); // "123bad"
  }
}

// Registry limit exceeded
const limited = new ScratchpadRegistry({ maxKeys: 2 });
limited.set("a", "1");
limited.set("b", "2");
try {
  limited.set("c", "3"); // throws — registry full
} catch (e) {
  if (e instanceof ScratchpadLimitError) {
    console.log(e.message);
  }
}
```

## API Reference

### `new ScratchpadRegistry(options?)`

Options: `maxKeys`, `maxValueBytes`, `maxKeyLength`, `onDebug`. See [Configuration](#configuration).

- `set(key, value)` — Store a variable
- `get(key)` — Read a variable (returns `undefined` if missing)
- `has(key)` — Check if a key exists
- `delete(key)` — Remove a variable
- `keys()` — List all variable names
- `clear()` — Remove all variables
- `size` — Number of stored variables

### `resolve(text, registry)`

Replace all `{{key}}` references in a string. Throws `ScratchpadReferenceError` on missing keys.

### `handleToolCall(registry, name, input)`

Dispatch a tool call by name. Returns the handler's result string.

### `SCRATCHPAD_TOOL_DEFINITIONS`

Array of 7 JSON-schema tool definitions, ready to pass to any LLM API.

### Individual handlers

`scratchpadSet`, `scratchpadGet`, `scratchpadDelete`, `scratchpadAppend`, `scratchpadPatch`, `scratchpadSlice`, `scratchpadRegexReplace` — if you need fine-grained control instead of using `handleToolCall`.

## License

MIT
