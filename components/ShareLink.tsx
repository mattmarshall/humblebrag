"use client";

import { useState } from "react";

export function ShareLink() {
  const [copied, setCopied] = useState(false);
  return <button className="copyLinkButton" type="button" onClick={async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }}>{copied ? "Link copied ✓" : "Share this masterpiece"}</button>;
}
