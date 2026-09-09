import { NextResponse, type NextRequest } from "next/server";
import { authkit, applyResponseHeaders, partitionAuthkitHeaders } from "@workos-inc/authkit-nextjs";
import { BUCKET_COOKIE, BUCKET_MAX_AGE_SECONDS, assignBucket, gateMode, normalizeBucket } from "./lib/experiment";

/**
 * Two jobs, and deliberately no third: refresh the AuthKit session cookie, and
 * assign the share-gate bucket.
 *
 * ⛔ THIS MIDDLEWARE GATES NOTHING. Every route stays anonymous — the homepage,
 * `/p/<id>`, its opengraph-image, `/embed` and `/api/posts`. The gate is a
 * component-level decision on the creator's own share actions (ShareGate), so
 * that the person sharing signs in and the audience receiving the link never
 * does. A path check here would silently break OG previews for every crawler.
 *
 * ⛔ THE AUTHKIT HEADERS MUST BE SPLIT, NOT FORWARDED WHOLESALE (learned in
 * resumarsh, where getting it wrong signed everyone out): `x-workos-middleware`
 * and `x-workos-session` are REQUEST headers that withAuth() reads off the
 * incoming request, while Set-Cookie belongs to the response. Forwarding them
 * all as response headers means withAuth() sees no middleware marker, throws,
 * and every page renders signed-out — and hands the sealed session to the
 * browser on the way.
 */
export default async function middleware(req: NextRequest) {
  // ⭐ FIRST AND UNCONDITIONALLY: every path below withAuth() needs these headers.
  // Without WorkOS credentials the SDK throws — degrade to "signed out" rather
  // than 500ing a site that is perfectly usable anonymously.
  let authkitHeaders: Headers | undefined;
  try {
    authkitHeaders = (await authkit(req)).headers;
  } catch (err) {
    console.error("[humblebrag:authkit] middleware", err);
  }

  const { requestHeaders, responseHeaders } = authkitHeaders
    ? partitionAuthkitHeaders(req, authkitHeaders)
    : { requestHeaders: new Headers(req.headers), responseHeaders: new Headers() };

  const mode = gateMode();
  const existing = normalizeBucket(req.cookies.get(BUCKET_COOKIE)?.value);
  const bucket = existing ?? assignBucket(mode);

  // A newly assigned bucket has to be visible to THIS render, not just the next
  // one, or the first permalink a visitor sees disagrees with every later one.
  // The response cookie makes it sticky; this makes it immediate.
  if (!existing) {
    const cookie = requestHeaders.get("cookie");
    requestHeaders.set("cookie", cookie ? `${cookie}; ${BUCKET_COOKIE}=${bucket}` : `${BUCKET_COOKIE}=${bucket}`);
  }

  const res = applyResponseHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    responseHeaders,
  );
  if (!existing) {
    res.cookies.set(BUCKET_COOKIE, bucket, {
      // Not httpOnly: a bucket label is not a credential, and client-side
      // analytics wants to segment on it. The gate decision itself is made
      // server-side and passed to ShareGate as a prop, so forging this
      // cookie only changes which arm of the experiment you land in.
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: BUCKET_MAX_AGE_SECONDS,
      secure: req.nextUrl.protocol === "https:",
    });
  }
  return res;
}

/**
 * ⛔ MUST COVER EVERY PATH THAT CALLS withAuth(), not just gated ones — that is a
 * hard requirement of the SDK: withAuth() THROWS where this middleware has not
 * run, which here would mean the permalink, /me and every claim route.
 *
 * ⚠ /callback is deliberately EXCLUDED. handleAuth() does its own exchange and
 * writes the session cookie itself; running authkit() there only puts a second
 * Set-Cookie writer in front of the one hop that mints the session.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|callback(?:/|$)|embed\\.js|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|webmanifest)$).*)",
  ],
};
