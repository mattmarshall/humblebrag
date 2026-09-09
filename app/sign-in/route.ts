/**
 * Sign-in entry point. AuthKit hosts the login UI, so this route only forwards
 * to it and remembers where the visitor was — normally a permalink they are
 * about to claim (`/p/<id>?claim=1`).
 */
import { redirect } from "next/navigation";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";

export async function GET(req: Request) {
  const returnTo = new URL(req.url).searchParams.get("returnTo");
  const safe = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  let url: string;
  try {
    url = await getSignInUrl({ returnTo: safe });
  } catch (err) {
    // Only reachable when WorkOS credentials are missing — a deploy-time
    // misconfiguration, not something a visitor can fix.
    console.error("[humblebrag:authkit] getSignInUrl", err);
    return new Response("Sign-in is not configured on this deployment.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  redirect(url);
}
