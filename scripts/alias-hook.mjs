// Module-resolution hook that lets standalone scripts load the app's TypeScript
// modules under bare `node`, matching two things Next's compiler does for the
// app but bare node does not:
//
//   1. the "@/..." path alias (tsconfig maps @/* → ./src/*), and
//   2. extensionless imports ("./config", "@/lib/db") resolving to ".ts".
//
// Node strips TS types natively (22.6+) but still won't guess the ".ts"
// extension the way bundlers do, so both the alias and every relative import in
// those modules need the retry below. Registered via scripts/register-alias.mjs.
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const srcRoot = join(import.meta.dirname, "..", "src");

// Extensions to try, in order, when a bare specifier doesn't resolve as-is.
const CANDIDATES = [".ts", ".tsx", ".mts", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  // Map the "@/" alias to an absolute file URL under src/.
  const mapped = specifier.startsWith("@/")
    ? pathToFileURL(join(srcRoot, specifier.slice(2))).href
    : specifier;

  try {
    return await nextResolve(mapped, context);
  } catch (err) {
    // Only retry the "couldn't find it" case, and only for paths that could be
    // a TS source missing its extension (skip bare package names like "pg").
    const canRetry =
      err?.code === "ERR_MODULE_NOT_FOUND" &&
      (mapped.startsWith("file:") || mapped.startsWith(".") || mapped.startsWith("/"));
    if (!canRetry) throw err;
    for (const ext of CANDIDATES) {
      try {
        return await nextResolve(mapped + ext, context);
      } catch {
        /* try the next candidate */
      }
    }
    throw err;
  }
}
