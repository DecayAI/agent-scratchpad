import { describe, it, expect, beforeEach } from "vitest";
import { ScratchpadRegistry } from "../src/registry.js";
import { resolve } from "../src/resolver.js";
import { ScratchpadReferenceError } from "../src/errors.js";

describe("resolve", () => {
  let registry: ScratchpadRegistry;

  beforeEach(() => {
    registry = new ScratchpadRegistry();
  });

  it("resolves a single reference", () => {
    registry.set("name", "Alice");
    expect(resolve("Hello, {{name}}!", registry)).toBe("Hello, Alice!");
  });

  it("resolves multiple distinct references", () => {
    registry.set("first", "Hello");
    registry.set("second", "World");
    expect(resolve("{{first}}, {{second}}!", registry)).toBe("Hello, World!");
  });

  it("resolves the same reference multiple times", () => {
    registry.set("x", "ha");
    expect(resolve("{{x}}{{x}}{{x}}", registry)).toBe("hahaha");
  });

  it("returns text unchanged if no references", () => {
    expect(resolve("plain text", registry)).toBe("plain text");
  });

  it("returns empty string unchanged", () => {
    expect(resolve("", registry)).toBe("");
  });

  it("throws ScratchpadReferenceError for missing key", () => {
    expect(() => resolve("{{missing}}", registry)).toThrow(
      ScratchpadReferenceError
    );
  });

  it("error contains the missing key", () => {
    try {
      resolve("{{oops}}", registry);
    } catch (e) {
      expect(e).toBeInstanceOf(ScratchpadReferenceError);
      expect((e as ScratchpadReferenceError).key).toBe("oops");
    }
  });

  it("does not resolve nested references (single pass)", () => {
    registry.set("a", "{{b}}");
    registry.set("b", "resolved");
    expect(resolve("{{a}}", registry)).toBe("{{b}}");
  });

  it("handles references adjacent to text", () => {
    registry.set("pre", "START");
    registry.set("suf", "END");
    expect(resolve("{{pre}}_middle_{{suf}}", registry)).toBe(
      "START_middle_END"
    );
  });

  it("ignores malformed braces", () => {
    registry.set("x", "val");
    expect(resolve("{x}", registry)).toBe("{x}");
    expect(resolve("{{ x }}", registry)).toBe("{{ x }}");
    expect(resolve("{{}}", registry)).toBe("{{}}");
  });

  it("resolves reference with value containing special chars", () => {
    registry.set("code", 'const x = "hello";');
    expect(resolve("Code: {{code}}", registry)).toBe('Code: const x = "hello";');
  });
});
