import { mediaUrl, personSlot, presignUpload, type ImageSlot } from "./media";
import type { hydratePost } from "./posts";

// RunPod Serverless is the queue. /run enqueues durably (24h TTL, built-in
// retry, 200 concurrent) and the endpoint webhooks us on completion, so there is
// no lease, no backoff table and no cron drain to maintain on our side.
const apiKey = process.env.RUNPOD_API_KEY?.trim();
const endpointId = process.env.RUNPOD_ENDPOINT_ID?.trim();
const webhookBase = process.env.RUNPOD_WEBHOOK_BASE?.trim()
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

const MAX_SEED = 4_294_967_294;

// These carry the parody boundaries documented in README.md — no real people,
// no logos, no readable brand marks — and RunPod applies no managed content
// filter of its own, so they are the only thing enforcing them.
//
// Deliberately NOT the Bedrock prompts. Stable Image Ultra followed
// instructions; SDXL is CLIP-conditioned, truncates around 77 tokens, and has
// no instruction-following at all — it renders instruction text as literal
// content. The first live scene came back plastered with garbled words lifted
// straight out of the prompt. So: short descriptive phrases only, negations
// live in the negative prompt, and nothing about preserving identity (InstantID
// does that architecturally, and saying it just wastes prompt budget).
// "facing camera, head and shoulders" counteracts the roster prompts, which say
// "Profile portrait of..." meaning a profile *picture*. SDXL reads "profile"
// literally and renders a side view, which is wrong for a small round avatar.
const AVATAR_SUFFIX = "photorealistic portrait photograph, facing camera, head and shoulders, natural skin texture, sharp focus";
const AVATAR_NEGATIVE = "side view, profile view, looking away, back of head, text, words, letters, typography, caption, watermark, logo, signage, celebrity, famous person, child, malformed face, duplicated person, extra fingers, plastic skin, uncanny eyes, illustration, cartoon";
// "color photograph" is load-bearing: without it "candid photograph, natural
// light" drifted to monochrome on a live run.
const SCENE_SUFFIX = "candid color photograph, natural light, shallow depth of field";
const SCENE_NEGATIVE = "black and white, monochrome, greyscale, sepia, text, words, letters, typography, caption, subtitles, poster, banner, signage, watermark, logo, celebrity, famous person, child, multiple people dominating frame, malformed face, extra fingers, plastic skin, illustration, cartoon, collage";

type HydratedPost = ReturnType<typeof hydratePost>;

export type ImageRequest = {
  slot: ImageSlot;
  kind: "avatar" | "scene";
  prompt: string;
  negativePrompt: string;
  aspectRatio: "1:1" | "3:2";
  seed: number;
  uploadUrl: string;
  /** Slot whose generated image seeds InstantID for this one. */
  identityFrom?: ImageSlot;
};

/**
 * Reject minor-adjacent prompts before anything is generated.
 *
 * The image classifier scores sexual content; it does not estimate age, so it
 * cannot be the control here. The premise is user-supplied and reaches the
 * prompt through the agent, so the final prompts are checked directly. This is
 * deliberately blunt — these words have no legitimate use in a generator whose
 * roster is adult professionals, so a false positive costs a retry while a false
 * negative publishes to a public URL.
 */
const MINOR_TERMS = [
  "child", "children", "kid", "kids", "boy", "girl", "teen", "teenage", "teenager",
  "minor", "toddler", "infant", "baby", "babies", "schoolgirl", "schoolboy",
  "underage", "preteen", "pre-teen", "adolescent", "juvenile", "youngster",
  "kindergarten", "elementary school", "middle school", "high school", "student",
];

export function findMinorTerm(text: string) {
  const haystack = text.toLowerCase();
  return MINOR_TERMS.find((term) => new RegExp(`\\b${term.replace(/[-\s]/g, "[-\\s]")}\\b`).test(haystack));
}

function assertNoMinorTerms(images: ImageRequest[]) {
  for (const image of images) {
    const term = findMinorTerm(image.prompt);
    if (term) {
      throw new Error(`Image prompt for ${image.slot} references a minor ("${term}") and will not be generated`);
    }
  }
}

function clampSeed(value: number) {
  const n = Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.min(MAX_SEED, Math.max(1, n));
}

/**
 * Build the full five-image job. Prompts come from the persisted row rather than
 * the request body: the retired path validated that a caller-supplied prompt
 * matched the post, and reading straight from the database preserves that
 * guarantee without needing the check.
 */
export async function buildJobInput(post: HydratedPost, postId: string) {
  const seed = clampSeed(post.imageSeed);
  const commenters = post.roster.filter((person) => person.role === "commenter");

  const slots: Array<{ slot: ImageSlot; build: (uploadUrl: string) => ImageRequest }> = [
    {
      slot: "avatar",
      build: (uploadUrl) => ({
        slot: "avatar",
        kind: "avatar",
        prompt: `${post.avatarPrompt} ${AVATAR_SUFFIX}`,
        negativePrompt: AVATAR_NEGATIVE,
        aspectRatio: "1:1",
        seed,
        uploadUrl,
      }),
    },
    {
      slot: "scene",
      build: (uploadUrl) => ({
        slot: "scene",
        kind: "scene",
        prompt: `${post.postImagePrompt} ${SCENE_SUFFIX}`,
        negativePrompt: SCENE_NEGATIVE,
        aspectRatio: post.network === "influenzr" ? "1:1" : "3:2",
        seed,
        uploadUrl,
        identityFrom: "avatar",
      }),
    },
    ...commenters.map((person, index) => ({
      slot: personSlot(person.id),
      build: (uploadUrl: string): ImageRequest => ({
        slot: personSlot(person.id),
        kind: "avatar",
        prompt: `${person.avatarPrompt} ${AVATAR_SUFFIX}`,
        negativePrompt: AVATAR_NEGATIVE,
        aspectRatio: "1:1",
        seed: clampSeed(seed + index + 1),
        uploadUrl,
      }),
    })),
  ];

  const images = await Promise.all(slots.map(async ({ slot, build }) => build(await presignUpload(postId, slot))));
  assertNoMinorTerms(images);
  return { postId, network: post.network, images };
}

async function runpod(path: string, init?: RequestInit) {
  if (!apiKey || !endpointId) throw new Error("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID are not configured");
  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`RunPod ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

export async function submitPostJob(post: HydratedPost, postId: string, allowSensitive = false) {
  const input = { ...(await buildJobInput(post, postId)), allowSensitive };
  const body = await runpod("/run", {
    method: "POST",
    body: JSON.stringify({
      input,
      ...(webhookBase ? { webhook: `${webhookBase}/api/webhooks/runpod` } : {}),
    }),
  }) as { id?: string; status?: string };
  if (!body.id) throw new Error("RunPod did not return a job id");
  return body.id;
}

export type JobStatus = {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
  output?: {
    postId?: string;
    uploaded?: string[];
    failed?: Array<{ slot: string; error: string; nsfwScore?: number }>;
    sensitive?: string[];
    nsfwScores?: Record<string, number>;
  };
  error?: string;
};

export async function getJobStatus(jobId: string) {
  return runpod(`/status/${encodeURIComponent(jobId)}`) as Promise<JobStatus>;
}

export function isRunpodConfigured() {
  return Boolean(apiKey && endpointId);
}

export { mediaUrl };
