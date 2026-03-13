// Load .env manually (handles missing trailing newline)
import { readFileSync } from "fs";
import { resolve as resolvePath } from "path";
try {
  const envFile = readFileSync(resolvePath(process.cwd(), ".env"), "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
} catch { /* .env not present */ }

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  ScratchpadRegistry,
  handleToolCall,
  resolve,
} from "../src/index.js";

// ── Build LangChain tools from scratchpad definitions ───────────────

function buildScratchpadTools(registry: ScratchpadRegistry) {
  return [
    tool(
      (input) => handleToolCall(registry, "scratchpad_set", input),
      {
        name: "scratchpad_set",
        description:
          "Store a named variable in the scratchpad. Creates or overwrites. Use {{key}} in later output to reference the value.",
        schema: z.object({
          key: z.string().describe("Variable name"),
          value: z.string().describe("Value to store"),
        }),
      }
    ),
    tool(
      (input) => handleToolCall(registry, "scratchpad_get", input),
      {
        name: "scratchpad_get",
        description:
          "Read a variable from the scratchpad. Returns the current value. Fails if not found.",
        schema: z.object({
          key: z.string().describe("Variable name to read"),
        }),
      }
    ),
    tool(
      (input) => handleToolCall(registry, "scratchpad_delete", input),
      {
        name: "scratchpad_delete",
        description: "Remove a variable from the scratchpad.",
        schema: z.object({
          key: z.string().describe("Variable name to delete"),
        }),
      }
    ),
    tool(
      (input) => handleToolCall(registry, "scratchpad_append", input),
      {
        name: "scratchpad_append",
        description: "Append a string to an existing scratchpad variable.",
        schema: z.object({
          key: z.string().describe("Variable name to append to"),
          value: z.string().describe("String to append"),
        }),
      }
    ),
    tool(
      (input) => handleToolCall(registry, "scratchpad_patch", input),
      {
        name: "scratchpad_patch",
        description:
          "Find and replace a substring within a scratchpad variable (first occurrence).",
        schema: z.object({
          key: z.string().describe("Variable name to patch"),
          find: z.string().describe("Substring to find"),
          replace: z.string().describe("Replacement string"),
        }),
      }
    ),
    tool(
      (input) => handleToolCall(registry, "scratchpad_slice", input),
      {
        name: "scratchpad_slice",
        description:
          "Extract a substring from a scratchpad variable by index. Non-mutating.",
        schema: z.object({
          key: z.string().describe("Variable name"),
          start: z.number().describe("Start index (inclusive)"),
          end: z.number().optional().describe("End index (exclusive)"),
        }),
      }
    ),
    tool(
      (input) => handleToolCall(registry, "scratchpad_regex_replace", input),
      {
        name: "scratchpad_regex_replace",
        description:
          "Regex find-and-replace on a scratchpad variable. Modifies in place.",
        schema: z.object({
          key: z.string().describe("Variable name"),
          pattern: z.string().describe("Regex pattern"),
          replace: z.string().describe("Replacement string"),
          flags: z.string().optional().describe("Regex flags"),
        }),
      }
    ),
  ];
}

// ── Agent loop ──────────────────────────────────────────────────────

async function runAgent() {
  const registry = new ScratchpadRegistry({
    onDebug: (op, key, detail) =>
      console.log(`  [debug] ${op} "${key}"${detail ? ` — ${detail}` : ""}`),
  });

  const tools = buildScratchpadTools(registry);
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature: 0,
  }).bindTools(tools);

  const prompt = `You have access to a scratchpad — a variable registry.
Use the scratchpad tools to:
1. Store a greeting: "Hello from LangChain!"
2. Append " 🚀" to it
3. Read it back with scratchpad_get
4. Then output your final answer containing the variable reference {{greeting}} so I can resolve it.`;

  console.log("=== Agent Scratchpad × LangChain Test ===\n");
  console.log(`User: ${prompt}\n`);

  const messages: (HumanMessage | AIMessage | ToolMessage)[] = [
    new HumanMessage(prompt),
  ];

  const MAX_ITERATIONS = 10;
  let finalText = "";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`--- Iteration ${i + 1} ---`);
    const response = await model.invoke(messages);
    messages.push(response);

    // Check for tool calls
    const toolCalls = response.tool_calls ?? [];
    if (toolCalls.length === 0) {
      // No more tool calls — this is the final response
      finalText =
        typeof response.content === "string"
          ? response.content
          : response.content
              .filter((b): b is { type: "text"; text: string } => typeof b === "object" && "type" in b && b.type === "text")
              .map((b) => b.text)
              .join("");
      break;
    }

    // Process tool calls
    for (const tc of toolCalls) {
      console.log(`  Tool call: ${tc.name}(${JSON.stringify(tc.args)})`);
      try {
        const result = handleToolCall(
          registry,
          tc.name,
          tc.args as Record<string, unknown>
        );
        console.log(`  Result: ${result}`);
        messages.push(new ToolMessage({ content: result, tool_call_id: tc.id! }));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`  Error: ${errMsg}`);
        messages.push(
          new ToolMessage({ content: `Error: ${errMsg}`, tool_call_id: tc.id! })
        );
      }
    }
  }

  console.log("\n--- Final Output (raw) ---");
  console.log(finalText);

  // Resolve {{references}} in the final output
  try {
    const resolved = resolve(finalText, registry);
    console.log("\n--- Final Output (resolved) ---");
    console.log(resolved);
  } catch (err) {
    console.log("\n--- Resolution skipped (no {{refs}} found or error) ---");
    console.log(
      err instanceof Error ? err.message : String(err)
    );
  }

  // Summary
  console.log("\n--- Registry State ---");
  for (const key of registry.keys()) {
    console.log(`  ${key} = "${registry.get(key)}"`);
  }
  console.log(`  Total keys: ${registry.size}`);
}

runAgent().catch(console.error);
