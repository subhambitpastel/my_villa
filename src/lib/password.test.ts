import { describe, it, expect } from "vitest";
import { hashPasswordSync, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces a salt:hash string that verifies", () => {
    const stored = hashPasswordSync("correct horse battery staple");
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });
  it("rejects a wrong password", () => {
    const stored = hashPasswordSync("myvilla123");
    expect(verifyPassword("wrong", stored)).toBe(false);
  });
  it("uses a random salt (two hashes of the same password differ)", () => {
    expect(hashPasswordSync("same")).not.toBe(hashPasswordSync("same"));
  });
  it("rejects malformed stored values without throwing", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "nosalt")).toBe(false);
  });
});
