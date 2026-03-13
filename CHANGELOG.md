# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-03-13

### Added

- `ScratchpadRegistry` — in-memory `Map<string, string>` wrapper with key validation
- Seven tool operations: `set`, `get`, `delete`, `append`, `patch`, `slice`, `regex_replace`
- `SCRATCHPAD_TOOL_DEFINITIONS` — JSON-schema tool definitions ready for Anthropic and OpenAI APIs
- `handleToolCall()` — single dispatch entry point for all `scratchpad_*` tool calls
- `resolve()` — single-pass `{{var_name}}` reference substitution with hard failure on missing keys
- `ScratchpadReferenceError` — thrown on undefined `{{key}}` reference
- `ScratchpadKeyError` — thrown on invalid key format
- `ScratchpadLimitError` — thrown when `maxKeys`, `maxValueBytes`, or `maxKeyLength` is exceeded
- `RegistryOptions` — configurable limits (`maxKeys`, `maxValueBytes`, `maxKeyLength`) and `onDebug` callback
- Full TypeScript types and JSDoc on all public exports
- 72 unit tests (registry, resolver, tools)
- LangChain integration example (`examples/langchain-anthropic.ts`)
