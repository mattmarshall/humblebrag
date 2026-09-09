/**
 * The share-gate experiment.
 *
 * Gating a joke has a real cost in reach, so the gate ships as a 50/50 split
 * rather than a decision: the `free` half keeps humblebrag exactly as it was and
 * is the control the `gated` half is judged against. Bucketing is sticky per
 * browser (a visitor who was asked to sign in should not be un-asked on their
 * next brag) and assigned once, in middleware.
 *
 * Pure and dependency-free on purpose: middleware runs on the Edge, server
 * components read the same cookie through next/headers, and tests import these
 * directly.
 */
export const BUCKET_COOKIE = "hb_bucket";
export const BUCKET_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type Bucket = "gated" | "free";

/**
 * `HUMBLEBRAG_GATE` is the kill switch. Rolling the gate back is an env change,
 * not a revert: `off` returns every visitor to the pre-gate product while the
 * claim/byline machinery keeps working.
 *
 *   off        — nobody is gated (the default, and the Phase 2 state)
 *   experiment — 50/50, the state the numbers come from
 *   on         — everybody is gated
 */
export type GateMode = "off" | "experiment" | "on";

export function gateMode(raw: string | undefined = process.env.HUMBLEBRAG_GATE): GateMode {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "experiment" || v === "on" ? v : "off";
}

export function normalizeBucket(value: string | undefined): Bucket | undefined {
  return value === "gated" || value === "free" ? value : undefined;
}

/** `random` is injectable so the split is testable rather than merely plausible. */
export function assignBucket(mode: GateMode, random: number = Math.random()): Bucket {
  if (mode === "off") return "free";
  if (mode === "on") return "gated";
  return random < 0.5 ? "gated" : "free";
}

/**
 * What a given surface should do. `embed` is never gated whatever the bucket
 * says: it renders in an iframe on someone else's site, where a hosted login
 * cannot complete — a gate there would break the embed and gain nothing.
 */
export function shouldGate({ bucket, mode, isEmbed }: { bucket: Bucket | undefined; mode: GateMode; isEmbed: boolean }): boolean {
  if (isEmbed || mode === "off") return false;
  if (mode === "on") return true;
  return bucket === "gated";
}
