import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

// Serves a runtime-uploaded image stored as bytes in the database (see
// saveUpload in actions.ts). The URL is /api/images/<id>, where <id> is the
// random hex + extension recorded in villas.image/images and users.avatar.
// Responses are immutable — each id maps to one fixed set of bytes — so they're
// cached hard by the browser and the Next image optimizer.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const row = await getDb()
    .prepare("SELECT mime, bytes FROM images WHERE id = ?")
    .get<{ mime: string; bytes: Buffer }>(id);

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  // A Node Buffer is a Uint8Array, so it's a valid Response body. Length is set
  // explicitly since the body is a fixed-size buffer.
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
