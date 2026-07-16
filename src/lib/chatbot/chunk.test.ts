import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { chunkMarkdown } from "./chunk";
import { MAX_CHUNK_CHARS } from "./config";
import { DOC_FOR } from "./config";

describe("chunkMarkdown", () => {
  it("emits one chunk per section, not the bare title", () => {
    const chunks = chunkMarkdown(
      "# Guide\n\n## Booking\n\nHow to book.\n\n## Refunds\n\n50% back.",
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe("How to book.");
    expect(chunks[1].content).toBe("50% back.");
  });

  it("carries the ancestor heading trail so context rides along", () => {
    const chunks = chunkMarkdown(
      "# Guide\n\n## Cancelling\n\nIntro.\n\n### The policy\n\n50% refund.",
    );
    const policy = chunks.find((c) => c.content === "50% refund.");
    expect(policy?.heading).toBe("Cancelling › The policy");
  });

  it("pops the trail back up when a section ends", () => {
    const chunks = chunkMarkdown(
      "# G\n\n## A\n\n### A1\n\ndeep.\n\n## B\n\nshallow.",
    );
    const b = chunks.find((c) => c.content === "shallow.");
    // B is a sibling of A, so its trail must not still include A or A1.
    expect(b?.heading).toBe("B");
  });

  it("does not treat a # inside a code fence as a heading", () => {
    const chunks = chunkMarkdown(
      "# G\n\n## Shell\n\n```\n# this is a comment\ndocker ps\n```",
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("# this is a comment");
    expect(chunks[0].heading).toBe("Shell");
  });

  it("splits an over-long section on paragraph breaks", () => {
    const para = "x".repeat(400);
    const body = [para, para, para].join("\n\n"); // ~1200 chars > limit
    const chunks = chunkMarkdown(`# G\n\n## Big\n\n${body}`);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    // Every piece keeps the same heading trail.
    expect(new Set(chunks.map((c) => c.heading))).toEqual(new Set(["Big"]));
  });

  it("assigns strictly increasing ordinals", () => {
    const chunks = chunkMarkdown("# G\n\n## A\n\na\n\n## B\n\nb\n\n## C\n\nc");
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1, 2]);
  });

  it("ignores a heading with no body", () => {
    const chunks = chunkMarkdown("# G\n\n## Empty\n\n## Real\n\nbody");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe("Real");
  });

  // Guards the real inputs: if a future doc edit produces a chunk over the
  // embedder's ceiling, this fails loudly instead of silently truncating an
  // embed. Reads the shipped docs from the repo root (test cwd).
  it.each(Object.values(DOC_FOR))("chunks the real doc %s within limits", (path) => {
    const chunks = chunkMarkdown(readFileSync(path, "utf8"));
    expect(chunks.length).toBeGreaterThan(20);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
      expect(c.heading.length).toBeGreaterThan(0);
    }
  });
});
