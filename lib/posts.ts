import { desc, eq } from "drizzle-orm";
import { cache } from "react";
import type { Humblebrag, RosterPerson } from "../components/HumblebragCard";
import { getDb } from "./db";
import { ensureDatabase } from "./db/ensure";
import { postPeople, posts, type StoredPerson, type StoredPost } from "./db/schema";

export const DEFAULT_POST_ID = "brock-panel";

type StoredPostWithPeople = StoredPost & { people?: StoredPerson[] };

export function hydratePost(record: StoredPostWithPeople) {
  const payload = record.payload as unknown as Omit<Humblebrag, "commentsPreview" | "roster"> & {
    commentsPreview: Array<{ personId?: string; name?: string; text: string }>;
    roster?: RosterPerson[];
  };
  const legacyId = (name: string, index: number) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "commenter"}-${index + 1}`;
  const legacyComments = payload.commentsPreview.map((comment, index) => ({
    personId: comment.personId || legacyId(comment.name || "Supportive Mutual", index),
    text: comment.text,
  }));
  const legacyRoster = [
    {
      id: payload.authorId || "author",
      role: "author" as const,
      name: payload.name,
      handle: payload.handle,
      title: payload.title,
      company: payload.company,
      appearance: payload.appearance,
      avatarPrompt: payload.avatarPrompt,
      avatarUrl: record.avatarUrl || payload.avatarUrl,
    },
    ...payload.commentsPreview.map((comment, index) => ({
      id: comment.personId || legacyId(comment.name || "Supportive Mutual", index),
      role: "commenter" as const,
      name: comment.name || "Supportive Mutual",
      handle: (comment.name || "supportive mutual").toLowerCase().replace(/[^a-z0-9]+/g, "."),
      title: "Supportive Mutual",
      company: "Professional Internet",
      appearance: "Fictional adult commenter",
      avatarPrompt: "Photorealistic profile portrait of a completely fictional adult, no text or logo.",
    })),
  ];
  const roster: RosterPerson[] = record.people?.length
    ? record.people.map(({ postId: _postId, position: _position, avatarUrl, role, ...person }) => ({
      ...person,
      role: role === "author" ? "author" : "commenter",
      avatarUrl: avatarUrl || undefined,
    }))
    : payload.roster?.length ? payload.roster : legacyRoster;
  return {
    ...payload,
    authorId: payload.authorId || roster.find((person) => person.role === "author")?.id || "author",
    roster,
    commentsPreview: legacyComments,
    avatarUrl: record.avatarUrl || record.payload.avatarUrl,
    postImageUrl: record.postImageUrl || record.payload.postImageUrl,
  };
}

export const findPost = cache(async (id: string) => {
  await ensureDatabase();
  const [record] = await getDb().select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!record) return undefined;
  const people = await getDb().select().from(postPeople).where(eq(postPeople.postId, id)).orderBy(postPeople.position);
  return { ...record, people };
});

export async function findHomepagePost() {
  try {
    const preferred = await findPost(DEFAULT_POST_ID);
    if (preferred?.status === "complete") return preferred;

    const [latest] = await getDb()
      .select()
      .from(posts)
      .where(eq(posts.status, "complete"))
      .orderBy(desc(posts.completedAt))
      .limit(1);
    if (!latest) return undefined;
    const people = await getDb().select().from(postPeople).where(eq(postPeople.postId, latest.id)).orderBy(postPeople.position);
    return { ...latest, people };
  } catch (cause) {
    console.warn("[humblebrag:homepage-post]", cause);
    return undefined;
  }
}
