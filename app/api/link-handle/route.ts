/**
 * resumarsh tells us a handle.
 *
 * humblebrag cannot look one up: resumarsh's GetCaller needs the caller's own
 * JWT and its public directory omits private profiles. So the flow is inverted
 * — when someone claims a handle at resumarsh.com/start, resumarsh POSTs it
 * here and we stamp it on that user's brags, turning every shared permalink
 * into a link back to a real résumé.
 *
 * Shared-secret auth, compared in constant time. There is no user session on
 * this hop: the caller is a server, and the payload names a user id it must
 * already know.
 */
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { posts } from "../../../lib/db/schema";
import { ensureDatabase } from "../../../lib/db/ensure";

export const runtime = "nodejs";

function secretMatches(provided: string | null): boolean {
  const expected = process.env.RESUMARSH_LINK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-humblebrag-secret"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { userId?: unknown; handle?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const handle = typeof body.handle === "string" ? body.handle.trim().toLowerCase() : "";
  // The grammar resumarsh itself enforces on a handle; anything else is a bug
  // upstream and must not reach a byline.
  if (!userId || !/^[a-z0-9][a-z0-9-]{0,38}$/.test(handle)) {
    return Response.json({ error: "userId and a valid handle are required" }, { status: 400 });
  }

  await ensureDatabase();
  const updated = await getDb()
    .update(posts)
    .set({ ownerHandle: handle })
    .where(eq(posts.ownerUserId, userId))
    .returning({ id: posts.id });

  return Response.json({ handle, posts: updated.length });
}
