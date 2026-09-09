/**
 * Who may claim a brag.
 *
 * ⛔ THE SECURITY-RELEVANT PIECE OF THE FUNNEL. Permalinks are public by
 * design — anyone can read `/p/<id>` and so anyone knows a valid post id. If
 * claiming needed only a session, the first person to sign in could put their
 * byline on someone else's brag. So a claim needs proof of authorship: either
 * the httpOnly `hb_creator` cookie this browser was given when it created the
 * post, or the post being fresh and still unowned (the narrow window that
 * covers a visitor who cleared cookies mid-flow, or generated in one tab and
 * signed in from another).
 *
 * Pure and storage-free so the rules can be tested as rules — see
 * tests/claim.test.ts — rather than only through a database.
 */
export const CREATOR_COOKIE = "hb_creator";
export const CREATOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Cookies are a scarce, size-capped resource; a prolific visitor keeps the most recent. */
export const CREATOR_COOKIE_MAX_IDS = 20;

/** How long an unclaimed brag stays claimable without the cookie. Short on
 *  purpose: it is a grace period for the creator, not a window for a stranger. */
export const UNCLAIMED_GRACE_MS = 15 * 60 * 1_000;

export type ClaimablePost = {
  id: string;
  ownerUserId: string | null;
  createdAt: Date;
};

export type ClaimVerdict =
  | { ok: true; alreadyMine: boolean }
  | { ok: false; status: number; error: string };

export function parseCreatorIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((id) => id.trim()).filter(Boolean).slice(0, CREATOR_COOKIE_MAX_IDS);
}

/** Most-recent-first, de-duplicated, capped. */
export function withCreatorId(raw: string | undefined, id: string): string {
  const next = [id, ...parseCreatorIds(raw).filter((existing) => existing !== id)];
  return next.slice(0, CREATOR_COOKIE_MAX_IDS).join(",");
}

export function canClaim({ post, userId, creatorIds, now }: {
  post: ClaimablePost;
  userId: string | null | undefined;
  creatorIds: string[];
  now: Date;
}): ClaimVerdict {
  if (!userId) return { ok: false, status: 401, error: "Sign in to claim this brag." };

  // Idempotent: re-running the claim (a refresh, a double-submit) is a success,
  // not a conflict.
  if (post.ownerUserId === userId) return { ok: true, alreadyMine: true };
  if (post.ownerUserId) return { ok: false, status: 403, error: "Someone else already claimed this brag." };

  if (creatorIds.includes(post.id)) return { ok: true, alreadyMine: false };
  if (now.getTime() - post.createdAt.getTime() <= UNCLAIMED_GRACE_MS) return { ok: true, alreadyMine: false };

  return { ok: false, status: 403, error: "Only the person who generated this brag can claim it." };
}
