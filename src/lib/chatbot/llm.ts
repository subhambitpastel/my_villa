// Text generation via the Claude CLI (`claude.exe`) — the "no API key" path.
// The CLI authenticates through the user's existing Claude login, so this needs
// no ANTHROPIC_API_KEY. Server-only; spawns a child process.
//
// Everything about the invocation is aimed at two things:
//   • ISOLATION — the CLI must answer as the MyVilla assistant, not as Claude
//     Code with this repo's tools/skills/CLAUDE.md loaded. Hence a replacement
//     --system-prompt, empty --setting-sources, --strict-mcp-config, no tools,
//     and dropped per-machine prompt sections.
//   • CACHING — the flags and the system prompt are constant across every call,
//     so the CLI's own ~21k-token prefix is written to the prompt cache once and
//     read (not rebuilt) on every subsequent message: ~$0.003 a reply. The part
//     that varies (retrieved context + question) rides in the user message via
//     stdin, downstream of the cached prefix.
//
// The generation step is deliberately behind this one module: swapping the CLI
// for the real Messages API later (when a key exists) is a change here and
// nowhere else.

import { spawn } from "node:child_process";

if (typeof window !== "undefined") {
  throw new Error("chatbot/llm.ts must never be imported from client code.");
}

/** The model the CLI runs. Haiku is fast and cheap and plenty for grounded Q&A;
 *  override with CHATBOT_MODEL if a deployment wants a different tier. */
const MODEL = process.env.CHATBOT_MODEL || "claude-haiku-4-5-20251001";

/** How the binary is found. An explicit path wins (useful in production where
 *  PATH may be minimal); otherwise the platform's default name, which spawn
 *  resolves against PATH. It's a native .exe on Windows — no shell needed. */
const CLI = process.env.CLAUDE_CLI_PATH || (process.platform === "win32" ? "claude.exe" : "claude");

/** Hard ceiling on one generation, so a hung child can't wedge a request. */
const TIMEOUT_MS = 60_000;

export type GenerateOptions = {
  /** Constant across calls — the assistant persona. Keep it stable to cache. */
  system: string;
  /** The variable part: retrieved context + history + question. */
  user: string;
  /** Called with each text fragment as it streams in. Thinking is not surfaced. */
  onToken?: (text: string) => void;
  /** Lets the caller (e.g. a disconnected HTTP client) abort generation. */
  signal?: AbortSignal;
};

/** One streamed line of the CLI's stream-json output. Only the shapes we read
 *  are typed; the rest (system/thinking/rate_limit events) is ignored. */
type StreamLine =
  | {
      type: "stream_event";
      event?: {
        type?: string;
        delta?: { type?: string; text?: string };
      };
    }
  | { type: "result"; subtype?: string; result?: string; is_error?: boolean }
  | { type: string };

/**
 * Run one generation. Streams text fragments to `onToken` as they arrive and
 * resolves with the complete answer. Rejects on spawn failure, a non-zero exit,
 * a timeout, or abort — the caller decides how to surface that to the user.
 */
export function generate(opts: GenerateOptions): Promise<string> {
  const args = [
    "-p",
    "--system-prompt",
    opts.system,
    "--model",
    MODEL,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    // Isolation: none of the ambient Claude Code context belongs in a product
    // chatbot's answers.
    "--strict-mcp-config", // ignore every MCP server the user has configured
    "--setting-sources",
    "", // load no user/project/local settings
    "--allowed-tools",
    "", // the model has no tools; it only writes an answer
    "--exclude-dynamic-system-prompt-sections", // drop cwd/env/git/memory blocks
  ];

  return new Promise<string>((resolve, reject) => {
    let child;
    try {
      child = spawn(CLI, args, {
        // No shell: args are passed as an array, so nothing in `user` or
        // `system` is ever interpreted by a command line. stdio: pipe all three.
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        // A neutral cwd so the CLI can't pick up a stray ./CLAUDE.md or settings
        // even if a setting-source slipped through.
        cwd: undefined,
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    let full = "";
    let stderr = "";
    let settled = false;
    let buffer = "";

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("Chatbot generation timed out.")));
    }, TIMEOUT_MS);

    const onAbort = () => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("aborted")));
    };
    if (opts.signal) {
      if (opts.signal.aborted) {
        onAbort();
        return;
      }
      opts.signal.addEventListener("abort", onAbort);
    }

    // Parse the stream line by line — stream-json emits one JSON object per line.
    child.stdout.on("data", (data: Buffer) => {
      buffer += data.toString("utf8");
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let obj: StreamLine;
        try {
          obj = JSON.parse(line) as StreamLine;
        } catch {
          continue; // a partial/non-JSON line — skip it
        }
        // The only thing we surface is assistant TEXT deltas. Thinking deltas
        // (type "thinking_delta") are intentionally dropped — internal reasoning
        // is not the answer.
        if (
          obj.type === "stream_event" &&
          "event" in obj &&
          obj.event?.type === "content_block_delta" &&
          obj.event.delta?.type === "text_delta" &&
          typeof obj.event.delta.text === "string"
        ) {
          full += obj.event.delta.text;
          opts.onToken?.(obj.event.delta.text);
        }
      }
    });

    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });

    child.on("error", (err) => {
      finish(() => reject(err));
    });

    child.on("close", (code) => {
      finish(() => {
        if (code === 0) {
          resolve(full.trim());
        } else {
          reject(
            new Error(
              `Claude CLI exited with code ${code}. ${stderr.slice(0, 500)}`.trim(),
            ),
          );
        }
      });
    });

    // Feed the user turn on stdin (not argv) — it can be several KB of retrieved
    // context, past the Windows command-line length limit, and stdin has no such
    // cap. Closing the stream signals end of input.
    child.stdin.write(opts.user, "utf8");
    child.stdin.end();
  });
}
