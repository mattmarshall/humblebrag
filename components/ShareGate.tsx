"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Everything a creator does to push their brag outward — and, in the gated
 * bucket, the one wall in the product.
 *
 * ⛔ THE PERMALINK ITSELF IS NEVER GATED. This component gates the creator's
 * own actions; the page it sits on, its opengraph-image, and every visitor who
 * arrives from a shared link stay entirely public. The sharer signs in, the
 * audience never does — that is what makes the gate affordable.
 *
 * Intent links only: we hand the visitor a pre-filled compose window. Nothing
 * here posts to anyone's real account.
 */
type Props = {
  postId: string;
  /** Show the gate instead of the actions (resolved server-side; embeds never gate). */
  gated: boolean;
  signedIn: boolean;
  /** Arrived back from sign-in with `?claim=1` — bind the post, then tidy the URL. */
  claimIntent: boolean;
  shareText: string;
};

async function logEvent(postId: string, kind: string) {
  try {
    await fetch(`/api/posts/${postId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind }),
      keepalive: true,
    });
  } catch {
    // Telemetry is never worth a broken button.
  }
}

export function ShareGate({ postId, gated, signedIn, claimIntent, shareText }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  // Resolved after mount: reading window during render would make the first
  // client render disagree with the server's HTML.
  const [origin, setOrigin] = useState("");
  const claimed = useRef(false);
  const gateLogged = useRef(false);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (gated && !signedIn && !gateLogged.current) {
      gateLogged.current = true;
      void logEvent(postId, "gate_view");
    }
  }, [gated, signedIn, postId]);

  useEffect(() => {
    if (!claimIntent || !signedIn || claimed.current) return;
    claimed.current = true;
    setClaiming(true);
    void (async () => {
      try {
        await logEvent(postId, "gate_signin");
        await fetch(`/api/posts/${postId}/claim`, { method: "POST" });
      } finally {
        setClaiming(false);
        // Drop ?claim=1 so a refresh or a copied URL isn't a claim attempt.
        router.replace(`/p/${postId}`);
        router.refresh();
      }
    })();
  }, [claimIntent, signedIn, postId, router]);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    void logEvent(postId, "link");
  }, [postId]);

  if (gated && !signedIn) {
    return <div className="shareGate">
      <p className="shareGateHead">Claim this brag.</p>
      <p className="shareGateBody">
        Sign in to keep the link, download the card, and put your name on it.
        resumarsh runs the login — same account, different vice.
      </p>
      <a className="copyLinkButton" href={`/sign-in?returnTo=${encodeURIComponent(`/p/${postId}?claim=1`)}`}>
        Continue with resumarsh
      </a>
      <p className="shareGateFinePrint">
        Your brag is already public at this URL. Signing in is how you keep it.
      </p>
    </div>;
  }

  const url = origin ? `${origin}/p/${postId}` : "";
  return <div className="shareActions">
    <button className="copyLinkButton" type="button" onClick={copyLink} disabled={claiming}>
      {claiming ? "Claiming…" : copied ? "Link copied ✓" : "Share this masterpiece"}
    </button>
    <div className="shareActionsRow">
      <a
        href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener"
        onClick={() => void logEvent(postId, "x")}
      >Post to X</a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener"
        onClick={() => void logEvent(postId, "linkedin")}
      >Post to LinkedIn</a>
      <a
        href={`/api/posts/${postId}/card.png`}
        onClick={() => void logEvent(postId, "png")}
      >Download the card</a>
    </div>
  </div>;
}
