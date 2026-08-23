import assert from "node:assert/strict";
import test from "node:test";
import { humblebragPostSchema } from "../agent/lib/humblebrag";
import { defaultBrag, defaultInfluenzrBrag } from "../components/HumblebragCard";
import { hydratePost } from "../lib/posts";
import { findMinorTerm } from "../lib/runpod";

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

test("minor-adjacent prompts are rejected before anything is generated", () => {
  // The image classifier scores sexual content and cannot estimate age, so this
  // gate is the only control for minor-adjacent imagery.
  const blocked = [
    "A child accepting an award on stage",
    "Portrait of a teenage founder",
    "A schoolgirl at a conference",
    "Photo of a high school student presenting",
    "A toddler in a boardroom",
  ];
  for (const text of blocked) {
    assert.ok(findMinorTerm(text), `should have been rejected: ${text}`);
  }
  const allowed = [
    "Corporate headshot of a man in his 40s with greying hair",
    "A woman in her 30s presenting at a meetup",
    "An adult accepting an award at a business breakfast",
  ];
  for (const text of allowed) {
    assert.equal(findMinorTerm(text), undefined, `should have been allowed: ${text}`);
  }
});
