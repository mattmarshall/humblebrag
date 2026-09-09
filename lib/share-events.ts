import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { ensureDatabase } from "./db/ensure";
import { shareEvents } from "./db/schema";
import { BUCKET_COOKIE, normalizeBucket } from "./experiment";

/** The funnel's vocabulary. Anything outside it is dropped rather than stored. */
export const SHARE_EVENT_KINDS = [
  "link", "png", "x", "linkedin", "embed", "gate_view", "gate_signin", "claim",
] as const;

export type ShareEventKind = (typeof SHARE_EVENT_KINDS)[number];

export function isShareEventKind(value: unknown): value is ShareEventKind {
  return typeof value === "string" && (SHARE_EVENT_KINDS as readonly string[]).includes(value);
}

/**
 * Record one funnel event.
 *
 * ⚠ Never throws. Measurement failing is a lost row; measurement failing loudly
 * would be a broken share button, which is the thing we are trying to measure.
 */
export async function recordShareEvent({ postId, kind, userId, referrer }: {
  postId: string;
  kind: ShareEventKind;
  userId?: string | null;
  referrer?: string | null;
}): Promise<void> {
  try {
    const bucket = normalizeBucket((await cookies()).get(BUCKET_COOKIE)?.value) ?? null;
    await ensureDatabase();
    await getDb().insert(shareEvents).values({
      id: nanoid(16),
      postId,
      kind,
      userId: userId ?? null,
      bucket,
      referrer: referrer?.slice(0, 500) ?? null,
    });
  } catch (cause) {
    console.error("[humblebrag:share-event]", { postId, kind, cause });
  }
}
