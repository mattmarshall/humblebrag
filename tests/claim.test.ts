import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATOR_COOKIE_MAX_IDS,
  UNCLAIMED_GRACE_MS,
  canClaim,
  parseCreatorIds,
  withCreatorId,
} from "../lib/claim";
import { assignBucket, gateMode, normalizeBucket, shouldGate } from "../lib/experiment";

const NOW = new Date("2026-01-01T12:00:00Z");
const post = (over: Partial<{ id: string; ownerUserId: string | null; createdAt: Date }> = {}) => ({
  id: "brag-1",
  ownerUserId: null,
  createdAt: NOW,
  ...over,
});

test("the creator cookie proves authorship", () => {
  assert.deepEqual(canClaim({ post: post(), userId: "user_a", creatorIds: ["brag-1"], now: NOW }), { ok: true, alreadyMine: false });
});

test("a stale unclaimed brag cannot be claimed by a passer-by", () => {
  const old = post({ createdAt: new Date(NOW.getTime() - UNCLAIMED_GRACE_MS - 1) });
  const verdict = canClaim({ post: old, userId: "user_stranger", creatorIds: [], now: NOW });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.ok === false && verdict.status, 403);
});

test("a fresh unclaimed brag is claimable without the cookie", () => {
  const fresh = post({ createdAt: new Date(NOW.getTime() - UNCLAIMED_GRACE_MS + 1_000) });
  assert.equal(canClaim({ post: fresh, userId: "user_a", creatorIds: [], now: NOW }).ok, true);
});

test("someone else's claim is final, even with a matching cookie", () => {
  const owned = post({ ownerUserId: "user_owner" });
  const verdict = canClaim({ post: owned, userId: "user_b", creatorIds: ["brag-1"], now: NOW });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.ok === false && verdict.status, 403);
});

test("re-claiming your own brag succeeds instead of conflicting", () => {
  const mine = post({ ownerUserId: "user_a" });
  assert.deepEqual(canClaim({ post: mine, userId: "user_a", creatorIds: [], now: NOW }), { ok: true, alreadyMine: true });
});

test("signed out is 401, never 403 — the gate must be able to offer sign-in", () => {
  const verdict = canClaim({ post: post(), userId: null, creatorIds: ["brag-1"], now: NOW });
  assert.equal(verdict.ok === false && verdict.status, 401);
});

test("the creator cookie stays newest-first, de-duplicated and capped", () => {
  let raw = "";
  for (let i = 0; i < CREATOR_COOKIE_MAX_IDS + 5; i += 1) raw = withCreatorId(raw, `brag-${i}`);
  const ids = parseCreatorIds(raw);
  assert.equal(ids.length, CREATOR_COOKIE_MAX_IDS);
  assert.equal(ids[0], `brag-${CREATOR_COOKIE_MAX_IDS + 4}`);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(parseCreatorIds(withCreatorId("brag-9,brag-1", "brag-1")), ["brag-1", "brag-9"]);
});

test("the gate is off unless deliberately switched on", () => {
  assert.equal(gateMode(undefined), "off");
  assert.equal(gateMode("nonsense"), "off");
  assert.equal(gateMode("EXPERIMENT"), "experiment");
  assert.equal(assignBucket("off", 0.01), "free");
  assert.equal(assignBucket("on", 0.99), "gated");
  assert.equal(assignBucket("experiment", 0.49), "gated");
  assert.equal(assignBucket("experiment", 0.51), "free");
  assert.equal(normalizeBucket("banana"), undefined);
});

test("the embed is never gated, whatever the bucket says", () => {
  assert.equal(shouldGate({ bucket: "gated", mode: "on", isEmbed: true }), false);
  assert.equal(shouldGate({ bucket: "gated", mode: "experiment", isEmbed: false }), true);
  assert.equal(shouldGate({ bucket: "free", mode: "experiment", isEmbed: false }), false);
  assert.equal(shouldGate({ bucket: "gated", mode: "off", isEmbed: false }), false);
});
