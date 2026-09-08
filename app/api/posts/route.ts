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
import { runImageJob } from "../queues/generate-images/route";

export const runtime = "nodejs";

const createPostSchema = z.object({
  post: humblebragPostSchema,
  premise: z.string().min(1).max(2_000),
  persona: z.string().min(1).max(100),
  intensity: intensitySchema,
});

export async function POST(request: Request) {
  try {
    const input = createPostSchema.parse(await request.json());
    const peopleById = new Map(input.post.roster.map((person) => [person.id, person]));
    if (peopleById.size !== input.post.roster.length) throw new Error("Roster IDs must be unique");
    const author = peopleById.get(input.post.authorId);
    if (!author || author.role !== "author" || author.name !== input.post.name) throw new Error("Roster author must match the post author");
    if (input.post.commentsPreview.some((comment) => peopleById.get(comment.personId)?.role !== "commenter")) {
      throw new Error("Every comment must reference a roster commenter");
    }
    await ensureDatabase();
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

    waitUntil(runImageJob(id));
    return Response.json({ id, permalink: `/p/${id}`, claimed: Boolean(session) }, { status: 201 });
  } catch (cause) {
    console.error("[humblebrag:create-post]", cause);
    return Response.json({ error: cause instanceof Error ? cause.message : "Could not save post" }, { status: 400 });
  }
}
