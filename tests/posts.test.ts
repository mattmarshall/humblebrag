import assert from "node:assert/strict";
import test from "node:test";
import { humblebragPostSchema } from "../agent/lib/humblebrag";
import { defaultBrag, defaultInfluenzrBrag } from "../components/HumblebragCard";
import { hydratePost } from "../lib/posts";

test("both network fixtures have complete, referentially valid rosters", () => {
  for (const fixture of [defaultBrag, defaultInfluenzrBrag]) {
    const post = humblebragPostSchema.parse(fixture);
    const people = new Map(post.roster.map((person) => [person.id, person]));
    assert.equal(people.size, 4);
    assert.equal(people.get(post.authorId)?.role, "author");
    assert.ok(post.commentsPreview.every((comment) => people.get(comment.personId)?.role === "commenter"));
  }
});

test("legacy posts hydrate into a safe roster without losing comment names", () => {
  const legacyPayload = {
    ...defaultBrag,
    authorId: undefined,
    roster: undefined,
    commentsPreview: [
      { name: "Legacy Colleague", text: "So deserved." },
      { name: "Old Mutual", text: "This is leadership." },
    ],
  };
  const post = hydratePost({
    id: "legacy",
    status: "complete",
    network: "workit",
    premise: "Legacy premise",
    persona: "random",
    intensity: "plausible",
    agentModel: "test",
    imageModel: "test",
    payload: legacyPayload,
    avatarUrl: "https://example.com/author.jpg",
    postImageUrl: "https://example.com/post.jpg",
    error: null,
    createdAt: new Date(),
    completedAt: new Date(),
  } as never);

  assert.equal(post.roster.length, 3);
  assert.equal(post.roster[1].name, "Legacy Colleague");
  assert.equal(post.commentsPreview[0].personId, post.roster[1].id);
  assert.equal(post.avatarUrl, "https://example.com/author.jpg");
});
