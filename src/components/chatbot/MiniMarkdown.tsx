// A tiny, safe markdown renderer for assistant replies. The model answers in
// light markdown — **bold**, `code`, "- " bullets, "1." lists, short headings —
// and this turns that into React elements. Deliberately NOT a full markdown
// library: it renders only what the bot actually emits, and it builds React
// nodes (never HTML strings), so there is no dangerouslySetInnerHTML and nothing
// in a reply can inject markup.

import React from "react";

/** Inline spans: **bold**, `code`. Split on the markers and wrap the insides.
 *  Everything else is plain text, so unknown markup renders as-is, harmlessly. */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Alternate bold / code / plain by scanning for the nearest marker.
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={`${keyBase}-c${i}`}
          className="rounded bg-black/5 px-1 py-0.5 text-[13px] font-mono"
        >
          {m[3]}
        </code>,
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Block-level: paragraphs, "- "/"* " bullet lists, "1." ordered lists, and
 *  short "#"/**bold**-only heading lines. Consecutive list items group into one
 *  list; blank lines separate paragraphs. */
export default function MiniMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push(
      <p key={`p${key++}`} className="whitespace-pre-wrap leading-relaxed">
        {renderInline(para.join(" "), `p${key}`)}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, idx) => (
      <li key={idx} className="leading-relaxed">
        {renderInline(it, `li${key}-${idx}`)}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`l${key++}`} className="ml-4 list-decimal space-y-1">
          {items}
        </ol>
      ) : (
        <ul key={`l${key++}`} className="ml-4 list-disc space-y-1">
          {items}
        </ul>
      ),
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);

    if (bullet) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (ordered) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(
        <p key={`h${key++}`} className="font-semibold">
          {renderInline(heading[1], `h${key}`)}
        </p>,
      );
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className="space-y-2 text-[14px]">{blocks}</div>;
}
