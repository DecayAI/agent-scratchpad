import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScratchpadRegistry } from "../src/registry.js";
import { ScratchpadKeyError, ScratchpadLimitError } from "../src/errors.js";

describe("ScratchpadRegistry", () => {
  let registry: ScratchpadRegistry;

  beforeEach(() => {
    registry = new ScratchpadRegistry();
  });

  describe("set / get", () => {
    it("stores and retrieves a value", () => {
      registry.set("greeting", "hello");
      expect(registry.get("greeting")).toBe("hello");
    });

    it("overwrites existing value", () => {
      registry.set("x", "one");
      registry.set("x", "two");
      expect(registry.get("x")).toBe("two");
    });

    it("returns undefined for missing key", () => {
      expect(registry.get("nope")).toBeUndefined();
    });

    it("stores empty string", () => {
      registry.set("empty", "");
      expect(registry.get("empty")).toBe("");
    });
  });

  describe("has", () => {
    it("returns true for existing key", () => {
      registry.set("a", "1");
      expect(registry.has("a")).toBe(true);
    });

    it("returns false for missing key", () => {
      expect(registry.has("nope")).toBe(false);
    });
  });

  describe("delete", () => {
    it("removes an existing key", () => {
      registry.set("x", "val");
      expect(registry.delete("x")).toBe(true);
      expect(registry.get("x")).toBeUndefined();
    });

    it("returns false for missing key", () => {
      expect(registry.delete("nope")).toBe(false);
    });
  });

  describe("keys / size / clear", () => {
    it("lists all keys", () => {
      registry.set("a", "1");
      registry.set("b", "2");
      expect(registry.keys().sort()).toEqual(["a", "b"]);
    });

    it("tracks size", () => {
      expect(registry.size).toBe(0);
      registry.set("a", "1");
      expect(registry.size).toBe(1);
    });

    it("clears all entries", () => {
      registry.set("a", "1");
      registry.set("b", "2");
      registry.clear();
      expect(registry.size).toBe(0);
    });
  });

  describe("key validation", () => {
    it("accepts valid keys", () => {
      expect(() => registry.set("foo", "v")).not.toThrow();
      expect(() => registry.set("_bar", "v")).not.toThrow();
      expect(() => registry.set("Baz123", "v")).not.toThrow();
      expect(() => registry.set("a_b_c", "v")).not.toThrow();
    });

    it("rejects empty string", () => {
      expect(() => registry.set("", "v")).toThrow(ScratchpadKeyError);
    });

    it("rejects key starting with digit", () => {
      expect(() => registry.set("1abc", "v")).toThrow(ScratchpadKeyError);
    });

    it("rejects key with spaces", () => {
      expect(() => registry.set("a b", "v")).toThrow(ScratchpadKeyError);
    });

    it("rejects key with special chars", () => {
      expect(() => registry.set("a-b", "v")).toThrow(ScratchpadKeyError);
      expect(() => registry.set("a.b", "v")).toThrow(ScratchpadKeyError);
    });
  });

  describe("maxKeys limit", () => {
    it("allows up to maxKeys entries", () => {
      const r = new ScratchpadRegistry({ maxKeys: 2 });
      r.set("a", "1");
      r.set("b", "2");
      expect(r.size).toBe(2);
    });

    it("throws when adding beyond maxKeys", () => {
      const r = new ScratchpadRegistry({ maxKeys: 2 });
      r.set("a", "1");
      r.set("b", "2");
      expect(() => r.set("c", "3")).toThrow(ScratchpadLimitError);
    });

    it("allows overwriting existing key when at maxKeys", () => {
      const r = new ScratchpadRegistry({ maxKeys: 2 });
      r.set("a", "1");
      r.set("b", "2");
      expect(() => r.set("a", "updated")).not.toThrow();
      expect(r.get("a")).toBe("updated");
    });

    it("allows new key after deleting when at maxKeys", () => {
      const r = new ScratchpadRegistry({ maxKeys: 1 });
      r.set("a", "1");
      r.delete("a");
      expect(() => r.set("b", "2")).not.toThrow();
    });
  });

  describe("maxValueBytes limit", () => {
    it("allows values within the byte limit", () => {
      const r = new ScratchpadRegistry({ maxValueBytes: 10 });
      expect(() => r.set("x", "hello")).not.toThrow(); // 5 bytes
    });

    it("throws when value exceeds byte limit", () => {
      const r = new ScratchpadRegistry({ maxValueBytes: 5 });
      expect(() => r.set("x", "toolong")).toThrow(ScratchpadLimitError);
    });

    it("counts multi-byte characters correctly", () => {
      const r = new ScratchpadRegistry({ maxValueBytes: 3 });
      // "é" is 2 bytes in UTF-8, so "éé" = 4 bytes
      expect(() => r.set("x", "éé")).toThrow(ScratchpadLimitError);
      expect(() => r.set("x", "é")).not.toThrow(); // 2 bytes, under limit
    });
  });

  describe("maxKeyLength limit", () => {
    it("allows keys within the length limit", () => {
      const r = new ScratchpadRegistry({ maxKeyLength: 5 });
      expect(() => r.set("abcde", "v")).not.toThrow();
    });

    it("throws when key exceeds length limit", () => {
      const r = new ScratchpadRegistry({ maxKeyLength: 5 });
      expect(() => r.set("abcdef", "v")).toThrow(ScratchpadLimitError);
    });

    it("defaults to 64 characters", () => {
      const longKey = "a".repeat(64);
      expect(() => registry.set(longKey, "v")).not.toThrow();
      const tooLongKey = "a".repeat(65);
      expect(() => registry.set(tooLongKey, "v")).toThrow(ScratchpadLimitError);
    });
  });

  describe("debug mode", () => {
    it("calls onDebug for set operations", () => {
      const debugFn = vi.fn();
      const r = new ScratchpadRegistry({ onDebug: debugFn });
      r.set("x", "hello");
      expect(debugFn).toHaveBeenCalledWith("set", "x", expect.stringContaining("5 chars"));
    });

    it("calls onDebug for get operations", () => {
      const debugFn = vi.fn();
      const r = new ScratchpadRegistry({ onDebug: debugFn });
      r.set("x", "hello");
      debugFn.mockClear();
      r.get("x");
      expect(debugFn).toHaveBeenCalledWith("get", "x", expect.stringContaining("5 chars"));
    });

    it("calls onDebug with miss for get on missing key", () => {
      const debugFn = vi.fn();
      const r = new ScratchpadRegistry({ onDebug: debugFn });
      r.get("nope");
      expect(debugFn).toHaveBeenCalledWith("get", "nope", "miss");
    });

    it("calls onDebug for delete operations", () => {
      const debugFn = vi.fn();
      const r = new ScratchpadRegistry({ onDebug: debugFn });
      r.set("x", "val");
      debugFn.mockClear();
      r.delete("x");
      expect(debugFn).toHaveBeenCalledWith("delete", "x", "removed");
    });

    it("calls onDebug for clear", () => {
      const debugFn = vi.fn();
      const r = new ScratchpadRegistry({ onDebug: debugFn });
      r.set("a", "1");
      r.set("b", "2");
      debugFn.mockClear();
      r.clear();
      expect(debugFn).toHaveBeenCalledWith("clear", "*", "2 keys removed");
    });

    it("works fine without onDebug (no callback)", () => {
      const r = new ScratchpadRegistry();
      expect(() => {
        r.set("x", "val");
        r.get("x");
        r.delete("x");
        r.clear();
      }).not.toThrow();
    });
  });
});
