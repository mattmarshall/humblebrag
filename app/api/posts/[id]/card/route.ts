/**
 * The downloadable card. Same renderer as the permalink's opengraph-image, but
 * this one is a creator artifact: it is offered only behind the gate (see
 * components/ShareGate.tsx) and comes back as an attachment.
 *
 * ⚠ The route is `/card`, not `/card.png`, even though it serves a PNG. A dot in
 * a route segment makes the path look like a static asset to the platform's
 * function provisioning; the browser takes its filename from content-disposition
 * below regardless, so the extension in the URL bought nothing.
 */
import { findPost } from "../../../../../lib/posts";
import { renderCard } from "../../../../../lib/og-card";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await findPost(id);
  if (!record || record.status !== "complete") {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }
  const image = renderCard(record);
  const headers = new Headers(image.headers);
  headers.set("content-disposition", `attachment; filename="humblebrag-${id}.png"`);
  return new Response(image.body, { status: image.status, headers });
}
