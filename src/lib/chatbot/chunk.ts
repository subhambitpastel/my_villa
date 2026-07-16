// Split a guide markdown doc into retrievable chunks, one per section, keyed on
// its heading trail. Pure + dependency-free so it unit-tests without a DB or a
// model. The two ABOUT_PROJECT_*.md files are the only input shape it targets.

import { MAX_CHUNK_CHARS } from "./config";

export type DocChunk = {
  /** "Cancelling and refunds" › "The policy as shown to you" — the heading
   *  trail, so a chunk carries its own context into the embedding and the
   *  prompt even when its body is a bare table row. */
  heading: string;
  /** The section text (its own body, minus sub-section bodies), trimmed. */
  content: string;
  /** Stable order key — the chunk's position in the document. */
  ordinal: number;
};

/** ATX heading line ("## Title") → its level and text, or null. */
function parseHeading(line: string): { level: number; text: string } | null {
  const m = /^(#{1,6})\s+(.*\S)\s*$/.exec(line);
  if (!m) return null;
  // Strip trailing anchors/markup noise but keep the words a reader sees.
  const text = m[2].replace(/\s*#+\s*$/, "").trim();
  return { level: m[1].length, text };
}

/**
 * Walk the document line by line, opening a new chunk at every heading and
 * closing the previous one. Each chunk's `heading` is the trail of ancestor
 * headings (H1 › H2 › H3…), so "The policy as shown to you" carries "Cancelling
 * and refunds" with it. Fenced code blocks are passed through verbatim — a `#`
 * inside a ``` fence is code, not a heading.
 *
 * The document's title (its single H1) is dropped, not carried: every chunk in
 * a doc would otherwise share the same title prefix, which discriminates nothing
 * and just dilutes the embedding. Trails therefore start at H2, and the title's
 * own body (an intro blurb, a table of contents) is skipped — a reader asks
 * about sections, not the cover page. Audience already decides which doc.
 */
export function chunkMarkdown(markdown: string): DocChunk[] {
  const lines = markdown.split(/\r?\n/);
  const chunks: DocChunk[] = [];
  const trail: { level: number; text: string }[] = [];
  let body: string[] = [];
  let inFence = false;
  let ordinal = 0;

  const flush = () => {
    const text = body.join("\n").trim();
    body = [];
    if (!text || trail.length === 0) return;
    for (const piece of splitLong(text)) {
      chunks.push({
        heading: trail.map((h) => h.text).join(" › "),
        content: piece,
        ordinal: ordinal++,
      });
    }
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = inFence ? null : parseHeading(line);
    if (!heading) {
      body.push(line);
      continue;
    }
    // A heading closes whatever section was open, then repositions the trail:
    // pop everything at or below this level, push this heading. A level-1 title
    // resets the trail to empty and is not itself pushed — trails start at H2.
    flush();
    while (trail.length && trail[trail.length - 1].level >= heading.level) {
      trail.pop();
    }
    if (heading.level > 1) trail.push(heading);
  }
  flush();
  return chunks;
}

/**
 * Keep every chunk under the embedder's token ceiling. A section longer than
 * MAX_CHUNK_CHARS is split on paragraph breaks (blank lines), packing whole
 * paragraphs together up to the limit. A single paragraph that is itself over
 * the limit — in these docs, a wide markdown table with no blank lines — is
 * then packed line by line (row by row), because the embedder truncates at
 * ~256 word-pieces and would otherwise drop the table's tail, leaving those
 * rows indexed in name only. Splitting a table between rows loses its header on
 * the later piece, but the heading trail still carries the context, and a
 * findable half beats an unfindable whole. Most sections fit in one piece and
 * pass straight through untouched.
 */
function splitLong(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const out: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = "";
  };
  const add = (block: string, sep: string) => {
    if (cur && cur.length + block.length + sep.length > MAX_CHUNK_CHARS) push();
    cur = cur ? `${cur}${sep}${block}` : block;
  };

  for (const para of text.split(/\n\s*\n/)) {
    if (para.length <= MAX_CHUNK_CHARS) {
      add(para, "\n\n");
      continue;
    }
    // Oversized paragraph: flush what's buffered, then pack its lines.
    push();
    for (const line of para.split("\n")) add(line, "\n");
    push();
  }
  push();
  return out;
}
