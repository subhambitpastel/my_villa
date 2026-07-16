// Build (or refresh) the chatbot knowledge base from the two guide docs.
//
//   node --import ./scripts/alias-hook.mjs scripts/ingest-chatbot.mjs
//
// (or just `npm run chatbot:ingest`, which wires the hook in for you.)
//
// Idempotent — safe to re-run after editing a doc; only changed sections are
// re-embedded. Reads DATABASE_URL from the environment (or .env.local), the same
// connection the app uses. Requires the pgvector extension in that database.
//
// Written as .mjs (not TS) so it runs under plain `node` without a build step,
// mirroring server.mjs. It reaches the TypeScript store/embed modules through
// Node's built-in type stripping (Node 22.6+); the --import alias-hook teaches
// node the project's "@/..." path alias so those modules load unchanged.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local (DATABASE_URL etc.) without adding a dotenv dependency — the
// app relies on the process env being set; for a standalone script we parse the
// file ourselves if the var isn't already present.
async function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const raw = await readFile(join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}

async function main() {
  await loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set (and no .env.local found). Point it at your Postgres and retry.",
    );
    process.exit(1);
  }

  // Import the TS modules. Node strips types natively on recent versions; if the
  // runtime is too old it throws a clear, actionable error rather than a cryptic
  // syntax error.
  // These load only when run via `npm run chatbot:ingest`, which supplies the
  // --import hook for both native type stripping (Node 22.6+) and the "@/" alias.
  const { ingestAudience } = await import("../src/lib/chatbot/store.ts");
  const { DOC_FOR } = await import("../src/lib/chatbot/config.ts");

  const started = Date.now();
  for (const [audience, docPath] of Object.entries(DOC_FOR)) {
    const markdown = await readFile(join(root, docPath), "utf8");
    process.stdout.write(`\nIngesting ${audience} (${docPath})…\n`);
    const report = await ingestAudience(audience, markdown, (done, total) => {
      if (total > 0) {
        process.stdout.write(`\r  embedding ${done}/${total}   `);
      }
    });
    process.stdout.write(
      `\r  ${report.total} chunks · ${report.inserted} embedded · ${report.unchanged} unchanged · ${report.deleted} removed\n`,
    );
  }
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  // The pg pool keeps the event loop alive; nothing else to wait on.
  process.exit(0);
}

main().catch((err) => {
  console.error("\nIngestion failed:\n", err);
  process.exit(1);
});
