import { describe, it, expect, beforeEach } from "vitest";
import { ScratchpadRegistry } from "../src/registry.js";
import { ScratchpadReferenceError } from "../src/errors.js";
import {
  scratchpadSet,
  scratchpadGet,
  scratchpadDelete,
  scratchpadAppend,
  scratchpadPatch,
  scratchpadSlice,
  scratchpadRegexReplace,
  handleToolCall,
  SCRATCHPAD_TOOL_DEFINITIONS,
} from "../src/tools.js";

describe("Tool handlers", () => {
  let registry: ScratchpadRegistry;

  beforeEach(() => {
    registry = new ScratchpadRegistry();
  });

  describe("scratchpadSet", () => {
    it("stores a value and returns confirmation", () => {
      const result = scratchpadSet(registry, { key: "x", value: "hello" });
      expect(result).toContain("Stored");
      expect(registry.get("x")).toBe("hello");
    });
  });

  describe("scratchpadGet", () => {
    it("returns stored value", () => {
      registry.set("x", "hello");
      expect(scratchpadGet(registry, { key: "x" })).toBe("hello");
    });

    it("throws on missing key", () => {
      expect(() => scratchpadGet(registry, { key: "nope" })).toThrow(
        ScratchpadReferenceError
      );
    });
  });

  describe("scratchpadDelete", () => {
    it("removes key and returns confirmation", () => {
      registry.set("x", "val");
      const result = scratchpadDelete(registry, { key: "x" });
      expect(result).toContain("Deleted");
      expect(registry.has("x")).toBe(false);
    });

    it("throws on missing key", () => {
      expect(() => scratchpadDelete(registry, { key: "nope" })).toThrow(
        ScratchpadReferenceError
      );
    });
  });

  describe("scratchpadAppend", () => {
    it("appends to existing value", () => {
      registry.set("x", "Hello");
      scratchpadAppend(registry, { key: "x", value: ", World!" });
      expect(registry.get("x")).toBe("Hello, World!");
    });

    it("throws on missing key", () => {
      expect(() =>
        scratchpadAppend(registry, { key: "nope", value: "v" })
      ).toThrow(ScratchpadReferenceError);
    });
  });

  describe("scratchpadPatch", () => {
    it("replaces first occurrence", () => {
      registry.set("x", "foo bar foo");
      scratchpadPatch(registry, { key: "x", find: "foo", replace: "baz" });
      expect(registry.get("x")).toBe("baz bar foo");
    });

    it("no-op if find string absent", () => {
      registry.set("x", "hello");
      scratchpadPatch(registry, { key: "x", find: "xyz", replace: "abc" });
      expect(registry.get("x")).toBe("hello");
    });

    it("throws on missing key", () => {
      expect(() =>
        scratchpadPatch(registry, { key: "nope", find: "a", replace: "b" })
      ).toThrow(ScratchpadReferenceError);
    });
  });

  describe("scratchpadSlice", () => {
    it("returns substring without mutating", () => {
      registry.set("x", "Hello, World!");
      const result = scratchpadSlice(registry, { key: "x", start: 0, end: 5 });
      expect(result).toBe("Hello");
      expect(registry.get("x")).toBe("Hello, World!");
    });

    it("slices to end when no end param", () => {
      registry.set("x", "abcdef");
      expect(scratchpadSlice(registry, { key: "x", start: 3 })).toBe("def");
    });

    it("handles negative indices", () => {
      registry.set("x", "abcdef");
      expect(scratchpadSlice(registry, { key: "x", start: -3 })).toBe("def");
    });

    it("throws on missing key", () => {
      expect(() =>
        scratchpadSlice(registry, { key: "nope", start: 0 })
      ).toThrow(ScratchpadReferenceError);
    });
  });

  describe("scratchpadRegexReplace", () => {
    it("replaces regex match in value", () => {
      registry.set("x", "abc 123 def 456");
      scratchpadRegexReplace(registry, {
        key: "x",
        pattern: "\\d+",
        replace: "#",
        flags: "g",
      });
      expect(registry.get("x")).toBe("abc # def #");
    });

    it("replaces only first match without g flag", () => {
      registry.set("x", "aaa");
      scratchpadRegexReplace(registry, {
        key: "x",
        pattern: "a",
        replace: "b",
      });
      expect(registry.get("x")).toBe("baa");
    });

    it("supports capture groups", () => {
      registry.set("x", "John Smith");
      scratchpadRegexReplace(registry, {
        key: "x",
        pattern: "(\\w+) (\\w+)",
        replace: "$2, $1",
      });
      expect(registry.get("x")).toBe("Smith, John");
    });

    it("throws on invalid regex", () => {
      registry.set("x", "val");
      expect(() =>
        scratchpadRegexReplace(registry, {
          key: "x",
          pattern: "[invalid",
          replace: "",
        })
      ).toThrow();
    });

    it("throws on missing key", () => {
      expect(() =>
        scratchpadRegexReplace(registry, {
          key: "nope",
          pattern: ".",
          replace: "",
        })
      ).toThrow(ScratchpadReferenceError);
    });
  });
});

describe("handleToolCall", () => {
  let registry: ScratchpadRegistry;

  beforeEach(() => {
    registry = new ScratchpadRegistry();
  });

  it("dispatches scratchpad_set", () => {
    handleToolCall(registry, "scratchpad_set", { key: "a", value: "1" });
    expect(registry.get("a")).toBe("1");
  });

  it("dispatches scratchpad_get", () => {
    registry.set("a", "1");
    expect(handleToolCall(registry, "scratchpad_get", { key: "a" })).toBe("1");
  });

  it("dispatches scratchpad_delete", () => {
    registry.set("a", "1");
    handleToolCall(registry, "scratchpad_delete", { key: "a" });
    expect(registry.has("a")).toBe(false);
  });

  it("dispatches scratchpad_append", () => {
    registry.set("a", "hello");
    handleToolCall(registry, "scratchpad_append", { key: "a", value: " world" });
    expect(registry.get("a")).toBe("hello world");
  });

  it("dispatches scratchpad_patch", () => {
    registry.set("a", "hello world");
    handleToolCall(registry, "scratchpad_patch", {
      key: "a",
      find: "world",
      replace: "there",
    });
    expect(registry.get("a")).toBe("hello there");
  });

  it("dispatches scratchpad_slice", () => {
    registry.set("a", "abcdef");
    expect(
      handleToolCall(registry, "scratchpad_slice", { key: "a", start: 1, end: 4 })
    ).toBe("bcd");
  });

  it("dispatches scratchpad_regex_replace", () => {
    registry.set("a", "abc123");
    handleToolCall(registry, "scratchpad_regex_replace", {
      key: "a",
      pattern: "\\d+",
      replace: "NUM",
    });
    expect(registry.get("a")).toBe("abcNUM");
  });

  it("throws on unknown tool name", () => {
    expect(() =>
      handleToolCall(registry, "scratchpad_unknown", {})
    ).toThrow("Unknown scratchpad tool");
  });
});

describe("SCRATCHPAD_TOOL_DEFINITIONS", () => {
  it("has 7 tool definitions", () => {
    expect(SCRATCHPAD_TOOL_DEFINITIONS).toHaveLength(7);
  });

  it("all tools have name, description, and input_schema", () => {
    for (const tool of SCRATCHPAD_TOOL_DEFINITIONS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeTruthy();
      expect(tool.name).toMatch(/^scratchpad_/);
    }
  });
});
