import { sql } from "drizzle-orm";
import { getDb } from "./db";

/**
 * Fixed-window rate limiting, backed by Postgres.
 *
 * This endpoint is public, unauthenticated and embeddable, and every accepted
 * request spends real GPU money — six renders per post. Bedrock's 1 req/min
 * quota used to cap abuse as a side effect; moving to RunPod removed the
 * bottleneck and the accidental protection with it.
 *
 * Postgres rather than memory because serverless instances do not share state,
 * so an in-process counter would reset on every cold start and scale with
 * concurrency. The whole check is one atomic statement: the window either rolls
 * over or the counter increments, decided inside the UPDATE, so concurrent
 * requests cannot both see a stale window and reset it.
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const result = await getDb().execute(sql`
    INSERT INTO "rate_limits" ("key", "window_start", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "window_start" = CASE
        WHEN "rate_limits"."window_start" < now() - make_interval(secs => ${windowSeconds})
        THEN now() ELSE "rate_limits"."window_start" END,
      "count" = CASE
        WHEN "rate_limits"."window_start" < now() - make_interval(secs => ${windowSeconds})
        THEN 1 ELSE "rate_limits"."count" + 1 END
    RETURNING "count", extract(epoch from (now() - "window_start"))::int AS "elapsed"
  `);
  const [row] = result.rows as Array<{ count: number; elapsed: number }>;

  const count = Number(row?.count ?? 1);
  const elapsed = Number(row?.elapsed ?? 0);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, windowSeconds - elapsed),
  };
}

/**
 * Best-effort client identity. x-forwarded-for is client-controlled in general,
 * but on Vercel the platform rewrites it, so the leftmost entry is the real
 * peer. Falls back to a shared bucket rather than failing open per-request.
 */
export function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
  return `${scope}:${ip}`;
}

export function rateLimited(result: RateLimitResult) {
  return Response.json(
    { error: "Too many generations from this address. Try again shortly." },
    { status: 429, headers: { "retry-after": String(result.retryAfterSeconds) } },
  );
}
