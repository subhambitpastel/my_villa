// Local text embedding via @huggingface/transformers — the piece that lets this
// project do real vector search with no API key. Server-only: the model and its
// weights (~25MB, fetched once then cached under node_modules) must never touch
// the browser bundle.
//
// The pipeline is loaded lazily and once (cold start ~5-7s while the model
// initialises, then ~10ms per embed), memoised across hot reloads the same way
// db.ts memoises its pool, so dev doesn't reload the weights on every edit.

import { EMBED_MODEL, EMBED_DIMS } from "./config";

if (typeof window !== "undefined") {
  throw new Error("chatbot/embed.ts must never be imported from client code.");
}

// The library is heavy and ESM-only; import it dynamically so nothing loads it
// (or its native onnxruntime dep) until the first embed actually runs. Typed
// loosely because its types aren't worth pulling into the app's build.
type Extractor = (
  text: string | string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

const globalForEmbed = globalThis as unknown as {
  __myvillaEmbedder?: Promise<Extractor>;
};

async function getExtractor(): Promise<Extractor> {
  if (!globalForEmbed.__myvillaEmbedder) {
    globalForEmbed.__myvillaEmbedder = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return (await pipeline(
        "feature-extraction",
        EMBED_MODEL,
      )) as unknown as Extractor;
    })();
  }
  return globalForEmbed.__myvillaEmbedder;
}

/**
 * Embed one string into a unit-length 384-float vector. `normalize: true` makes
 * the vectors unit-length, so a cosine-distance index and a dot product agree —
 * which is what lets pgvector's `<=>` operator rank by semantic closeness.
 */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const out = await extractor(text, { pooling: "mean", normalize: true });
  const vec = Array.from(out.data);
  if (vec.length !== EMBED_DIMS) {
    throw new Error(
      `Embedding model returned ${vec.length} dims, expected ${EMBED_DIMS}.`,
    );
  }
  return vec;
}

/**
 * Embed many strings, one at a time. Batching through the model at once is
 * faster but spikes memory; ingestion runs offline and rarely, so the calm
 * sequential path is the right trade. Progress is reported so a long ingest
 * isn't a silent stall.
 */
export async function embedAll(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    out.push(await embed(texts[i]));
    onProgress?.(i + 1, texts.length);
  }
  return out;
}

/** pgvector's text input format: "[0.1,0.2,...]". Used when binding a vector
 *  parameter, since node-postgres has no native vector type. */
export const toVectorLiteral = (vec: number[]): string => `[${vec.join(",")}]`;
