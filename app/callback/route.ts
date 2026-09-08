/**
 * Where AuthKit returns after sign-in. Must match NEXT_PUBLIC_WORKOS_REDIRECT_URI
 * and be registered as a redirect URI on the shared WorkOS environment.
 *
 * The recovery below is lifted from resumarsh's callback, where it was debugged
 * against real traffic: two failures are worth one silent retry because in both
 * the user IS authenticated with AuthKit and only our half of the handshake is
 * missing — `missing_auth_params` (a WorkOS-initiated flow that never carried
 * our sealed state) and `missing_pkce_cookie` (the verifier cookie didn't come
 * back). Everything else — a failed exchange, a state mismatch, the user
 * pressing cancel — a retry cannot fix and must not paper over.
 */
import type { NextRequest } from "next/server";
import { handleAuth } from "@workos-inc/authkit-nextjs";

/** One-shot marker that we have ALREADY retried this browser. Without it the
 *  recovery is an infinite loop; with it the worst case is one extra hop. */
const RETRY_COOKIE = "hb_auth_retry";
const RETRY_TTL_SECONDS = 120;
const RECOVERABLE_ERRORS = new Set(["missing_auth_params", "missing_pkce_cookie"]);

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

/** `SameSite=None` needs `Secure`, which needs https — plain http (dev) gets Lax. */
function retryCookie(secure: boolean, clear: boolean): string {
  const parts = [
    `${RETRY_COOKIE}=${clear ? "" : "1"}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${clear ? 0 : RETRY_TTL_SECONDS}`,
  ];
  parts.push(secure ? "SameSite=None; Secure" : "SameSite=Lax");
  return parts.join("; ");
}

/** Enough to diagnose and nothing that leaks: parameter NAMES but never their
 *  values (`code` is a live credential), and cookie counts rather than contents. */
function requestContext(request: NextRequest) {
  const url = new URL(request.url);
  return {
    path: url.pathname,
    params: [...url.searchParams.keys()].sort(),
    referer: request.headers.get("referer") ?? undefined,
    pkceCookies: request.cookies.getAll().filter(({ name }) => name.startsWith("wos-auth-verifier")).length,
  };
}

export const GET = handleAuth({
  returnPathname: "/",

  // ⛔ WITHOUT THIS, A FAILURE RENDERS RAW JSON AT THE USER — at the point they
  // have ALREADY authenticated with their provider. Never the right thing to show.
  onError: ({ error, request }) => {
    const context = requestContext(request);
    console.error("[humblebrag:authkit] callback failed", { error, ...context });

    const url = new URL(request.url);
    const secure = url.protocol === "https:";
    const recoverable =
      RECOVERABLE_ERRORS.has(errorCode(error) ?? "") &&
      url.searchParams.has("code") &&
      !url.searchParams.has("error");

    if (recoverable && request.cookies.get(RETRY_COOKIE)?.value !== "1") {
      console.warn("[humblebrag:authkit] retrying sign-in once", { code: errorCode(error), ...context });
      return new Response(null, {
        status: 302,
        headers: { location: "/sign-in?returnTo=%2F", "set-cookie": retryCookie(secure, false) },
      });
    }

    return new Response(
      `<!doctype html><meta charset="utf-8">
       <title>Sign-in didn&rsquo;t complete — humblebrag</title>
       <meta name="viewport" content="width=device-width,initial-scale=1">
       <div style="font:16px/1.6 system-ui,sans-serif;max-width:34rem;margin:12vh auto;padding:0 1.5rem">
         <h1 style="font-size:1.35rem;margin:0 0 .5rem">Sign-in didn&rsquo;t complete</h1>
         <p style="color:#555;margin:0 0 1.25rem">
           You were signed in with your provider, but we couldn&rsquo;t finish setting up your
           session. Trying again usually works &mdash; your brag is still at its permalink either way.
         </p>
         <p style="margin:0 0 2rem">
           <a href="/sign-in" style="color:#5b5fef">Try signing in again</a>
           &nbsp;&middot;&nbsp;
           <a href="/" style="color:#5b5fef">Back to humblebrag</a>
         </p>
       </div>`,
      {
        status: 400,
        headers: {
          "content-type": "text/html; charset=utf-8",
          // Spend the marker: whatever they do next starts with a clean budget.
          "set-cookie": retryCookie(secure, true),
        },
      },
    );
  },
});
