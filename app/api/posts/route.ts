import { and, desc, eq, lt, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { CREATOR_COOKIE, CREATOR_COOKIE_MAX_AGE_SECONDS, withCreatorId } from "../../../lib/claim";
import { getSession } from "../../../lib/session";
import { getDb } from "../../../lib/db";
import { postPeople, posts } from "../../../lib/db/schema";
import { ensureDatabase } from "../../../lib/db/ensure";
import type { Humblebrag } from "../../../components/HumblebragCard";
import { humblebragPostSchema, intensitySchema } from "../../../agent/lib/humblebrag";
import { enqueuePostImages } from "../../../lib/image-jobs";
import { hydratePost, publiclyListable } from "../../../lib/posts";
import { checkRateLimit, clientKey, rateLimited } from "../../../lib/rate-limit";

export const runtime = "nodejs";

const createPostSchema = z.object({
  post: humblebragPostSchema,
  premise: z.string().min(1).max(2_000),
  persona: z.string().min(1).max(100),
  intensity: intensitySchema,
  allowSensitive: z.boolean().optional(),
});


export const GALLERY_PAGE_SIZE = 24;

/**
 * Public gallery listing.
 *
 * Two filters are load-bearing, not incidental:
 *  - status complete, so half-generated posts never appear
 *  - NOT sensitive, mirroring findHomepagePostForNetwork. A post whose images
 *    were only produced because the requester accepted a borderline result is
 *    kept off the homepage and noindexed on its permalink; listing it here
 *    would undo both.
 *
 * Keyset pagination on (completedAt, id) rather than OFFSET, so a post
 * completing mid-scroll cannot shift rows and cause skips or repeats.
 */
export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit")) || GALLERY_PAGE_SIZE, 1),
      48,
    );

    let cursorFilter;
    const cursor = url.searchParams.get("cursor");
    if (cursor) {
      const [at, id] = Buffer.from(cursor, "base64url").toString().split("|");
      const completedAt = new Date(at);
      if (!id || Number.isNaN(completedAt.getTime())) {
        return Response.json({ error: "Invalid cursor" }, { status: 400 });
      }
      cursorFilter = or(
        lt(posts.completedAt, completedAt),
        and(eq(posts.completedAt, completedAt), lt(posts.id, id)),
      );
    }

    const rows = await getDb().select().from(posts)
      .where(and(publiclyListable(), cursorFilter))
      .orderBy(desc(posts.completedAt), desc(posts.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor = rows.length > limit && last?.completedAt
      ? Buffer.from(`${last.completedAt.toISOString()}|${last.id}`).toString("base64url")
      : null;

    return Response.json({
      posts: page.map((record) => {
        const post = hydratePost(record);
        return {
          id: record.id,
          permalink: `/p/${record.id}`,
          network: record.network,
          name: post.name,
          handle: post.handle,
          title: post.title,
          company: post.company,
          body: post.body,
          avatarUrl: post.avatarUrl,
          postImageUrl: post.postImageUrl,
          completedAt: record.completedAt,
        };
      }),
      nextCursor,
    });
  } catch (cause) {
    console.error("[humblebrag:gallery]", cause);
    return Response.json({ error: "Could not list posts" }, { status: 500 });
  }
}

// Six GPU renders per accepted request, on a public unauthenticated endpoint.
const CREATE_LIMIT = 5;
const CREATE_WINDOW_SECONDS = 60 * 60;

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const limit = await checkRateLimit(clientKey(request, "create"), CREATE_LIMIT, CREATE_WINDOW_SECONDS);
    if (!limit.allowed) return rateLimited(limit);

    const input = createPostSchema.parse(await request.json());
    const peopleById = new Map(input.post.roster.map((person) => [person.id, person]));
    if (peopleById.size !== input.post.roster.length) throw new Error("Roster IDs must be unique");
    const author = peopleById.get(input.post.authorId);
    if (!author || author.role !== "author" || author.name !== input.post.name) throw new Error("Roster author must match the post author");
    if (input.post.commentsPreview.some((comment) => peopleById.get(comment.personId)?.role !== "commenter")) {
      throw new Error("Every comment must reference a roster commenter");
    }
    const id = nanoid(12);
    // Already signed in? Then there is nothing to claim later — own it now.
    const session = await getSession();
    await getDb().batch([
      getDb().insert(posts).values({
        id,
        network: input.post.network,
        premise: input.premise,
        persona: input.persona,
        intensity: input.intensity,
        payload: input.post as unknown as Humblebrag,
        allowSensitive: input.allowSensitive === true,
        ownerUserId: session?.userId ?? null,
        claimedAt: session ? new Date() : null,
      }),
      getDb().insert(postPeople).values(input.post.roster.map((person, position) => ({
        postId: id,
        position,
        ...person,
      }))),
    ]);
    // Proof of authorship for a later claim: this browser made this post. It is
    // httpOnly because it is the only thing standing between a public permalink
    // and a stranger putting their byline on it.
    const jar = await cookies();
    jar.set(CREATOR_COOKIE, withCreatorId(jar.get(CREATOR_COOKIE)?.value, id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: CREATOR_COOKIE_MAX_AGE_SECONDS,
      secure: new URL(request.url).protocol === "https:",
    });

    waitUntil(enqueuePostImages(id));
    return Response.json({ id, permalink: `/p/${id}`, claimed: Boolean(session) }, { status: 201 });
  } catch (cause) {
    console.error("[humblebrag:create-post]", cause);
    return Response.json({ error: cause instanceof Error ? cause.message : "Could not save post" }, { status: 400 });
  }
}
