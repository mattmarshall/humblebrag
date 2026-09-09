/**
 * The app's view of "who is signed in".
 *
 * Identity is WorkOS AuthKit, pointed at the SAME WorkOS environment as
 * resumarsh — that is the entire point of the funnel: signing in here does not
 * create a humblebrag account, it creates (or reuses) a resumarsh one, so
 * resumarsh.com/start already knows the visitor when they arrive.
 *
 * Shape deliberately mirrors resumarsh's `frontend/lib/session.ts` so the two
 * apps agree on what a session is. Identity only — nothing here authorizes
 * anything; see lib/claim.ts for who may claim a post.
 */
import { cache } from "react";
import { withAuth } from "@workos-inc/authkit-nextjs";

export interface AppSession {
  /** WorkOS user id (`user_…`) — stable, opaque, and shared with resumarsh. */
  userId: string;
  email: string;
  name?: string;
  image?: string;
}

/** The signed-in user, or null. Memoized per request. */
export const getSession = cache(async (): Promise<AppSession | null> => {
  try {
    const { user } = await withAuth();
    if (!user?.id) return null;
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return {
      userId: user.id,
      email: (user.email ?? "").toLowerCase(),
      name: name || undefined,
      image: user.profilePictureUrl ?? undefined,
    };
  } catch {
    // No session cookie, an expired one that can't refresh, or WorkOS isn't
    // configured on this deploy. All three mean "signed out" — humblebrag is
    // usable signed out, so none of them should throw at a visitor.
    return null;
  }
});
