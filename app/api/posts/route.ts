import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { posts } from "../../../lib/db/schema";
import { ensureDatabase } from "../../../lib/db/ensure";
import type { Humblebrag } from "../../../components/HumblebragCard";
import { humblebragPostSchema, intensitySchema } from "../../../agent/lib/humblebrag";

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
    await ensureDatabase();
    const id = nanoid(12);
    await getDb().insert(posts).values({
      id,
      network: input.post.network,
      premise: input.premise,
      persona: input.persona,
      intensity: input.intensity,
      payload: input.post as unknown as Humblebrag,
    });
    return Response.json({ id, permalink: `/p/${id}` }, { status: 201 });
  } catch (cause) {
    console.error("[humblebrag:create-post]", cause);
    return Response.json({ error: cause instanceof Error ? cause.message : "Could not save post" }, { status: 400 });
  }
}
