/**
 * Funnel telemetry from the browser: which share action was taken, and whether
 * the gate was seen. Fire-and-forget by design — see lib/share-events.ts.
 */
import { getSession } from "../../../../../lib/session";
import { isShareEventKind, recordShareEvent } from "../../../../../lib/share-events";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let kind: unknown;
  try {
    ({ kind } = await request.json() as { kind?: unknown });
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }
  if (!isShareEventKind(kind)) return Response.json({ error: "Unknown event kind" }, { status: 400 });

  const session = await getSession();
  await recordShareEvent({ postId: id, kind, userId: session?.userId, referrer: request.headers.get("referer") });
  return new Response(null, { status: 204 });
}
