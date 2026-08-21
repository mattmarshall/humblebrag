import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { posts } from "../../../lib/db/schema";
import { ensureDatabase } from "../../../lib/db/ensure";

export const runtime = "nodejs";
export const maxDuration = 90;

// Important: Vercel injects AWS_REGION based on the Function's own hosting
// region. Stable Image Ultra 1.1 is available in us-west-2, so we keep the
// Bedrock region separate and explicit.
const region = process.env.BEDROCK_REGION?.trim() || "us-west-2";
const roleArn = process.env.AWS_ROLE_ARN?.trim() || "arn:aws:iam::658367926314:role/humblebrag-vercel-production";
const configuredModel = process.env.BEDROCK_IMAGE_MODEL?.trim();
const canonicalModel = "stability.stable-image-ultra-v1:1";
const modelId = configuredModel?.startsWith("stability.") ? configuredModel : canonicalModel;

const client = new BedrockRuntimeClient({
  region,
  credentials: awsCredentialsProvider({ roleArn, clientConfig: { region } }),
});

type ImageKind = "avatar" | "post";
type Network = "workit" | "influenzr";

type GenerateInput = {
  postId?: string;
  kind?: ImageKind;
  network?: Network;
  prompt?: string;
  seed?: number;
  referenceImageDataUrl?: string;
};

type StabilityResponse = {
  images?: string[];
  finish_reasons?: (string | null)[];
  seeds?: number[];
};

function clampSeed(value: unknown) {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return n > 0 && n <= 4294967294 ? n : 0;
}

function base64FromDataUrl(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,(.+)$/i);
  return match?.[1];
}

async function invoke(body: Record<string, unknown>) {
  const response = await client.send(new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  }));

  const parsed = JSON.parse(new TextDecoder().decode(response.body)) as StabilityResponse;
  if (!parsed.images?.[0]) {
    throw new Error(parsed.finish_reasons?.[0] || "Bedrock returned no image");
  }
  return {
    base64: parsed.images[0],
    dataUrl: `data:image/jpeg;base64,${parsed.images[0]}`,
    seed: parsed.seeds?.[0],
  };
}

async function generateAvatar(prompt: string, seed: number) {
  return invoke({
    prompt: `${prompt} Entirely fictional adult, not a celebrity or public figure. Natural skin texture, believable optics, plausible asymmetry, no beauty-filter plastic skin.`,
    mode: "text-to-image",
    aspect_ratio: "1:1",
    output_format: "jpeg",
    seed,
    negative_prompt: "real celebrity, recognizable public figure, child, text, letters, logo, watermark, malformed face, duplicated person, extra fingers, plastic skin, uncanny eyes",
  });
}

async function generatePost(input: GenerateInput, prompt: string, seed: number) {
  const reference = base64FromDataUrl(input.referenceImageDataUrl);

  // Prefer image-to-image when we have the avatar. It gives the persona a much
  // better chance of reading as the same invented person in the post photo.
  if (reference) {
    try {
      return await invoke({
        prompt: `${prompt} Preserve the identity and distinctive facial traits of the reference adult while changing pose, environment, camera distance, and wardrobe only as needed for the scene. Plausible social-media photography, natural skin texture.`,
        image: reference,
        strength: input.network === "influenzr" ? 0.62 : 0.66,
        output_format: "jpeg",
        seed,
        negative_prompt: "different person, multiple people dominating frame, real celebrity, recognizable public figure, child, text, letters, logo, watermark, malformed face, extra fingers, plastic skin",
      });
    } catch (cause) {
      console.warn("[humblebrag:image-generation] image-to-image fallback", {
        message: cause instanceof Error ? cause.message : String(cause),
        modelId,
        region,
      });
    }
  }

  return invoke({
    prompt: `${prompt} Entirely fictional adult, not a celebrity or public figure. Plausible social-media photography, natural skin texture.`,
    mode: "text-to-image",
    aspect_ratio: input.network === "influenzr" ? "4:5" : "3:2",
    output_format: "jpeg",
    seed,
    negative_prompt: "real celebrity, recognizable public figure, child, text, letters, logo, watermark, malformed face, extra fingers, duplicated person, plastic skin",
  });
}

export async function GET() {
  return Response.json({ ok: true, provider: "bedrock", region, modelId });
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as GenerateInput;
    const kind = input.kind;
    const prompt = input.prompt?.trim();
    if ((kind !== "avatar" && kind !== "post") || !prompt) {
      return Response.json({ error: "kind and prompt are required" }, { status: 400 });
    }

    const seed = clampSeed(input.seed);
    const result = kind === "avatar"
      ? await generateAvatar(prompt, seed)
      : await generatePost(input, prompt, seed);

    let url: string | undefined;
    if (input.postId) {
      await ensureDatabase();
      const blob = await put(`posts/${input.postId}/${kind}.jpg`, Buffer.from(result.base64, "base64"), {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      url = blob.url;
      await getDb().update(posts).set(kind === "avatar" ? { avatarUrl: url } : { postImageUrl: url }).where(eq(posts.id, input.postId));
    }

    return Response.json({ dataUrl: result.dataUrl, url, seed: result.seed, kind, modelId, region });
  } catch (cause) {
    console.error("[humblebrag:image-generation]", {
      cause,
      modelId,
      region,
    });
    const message = cause instanceof Error ? cause.message : "Image generation failed";
    return Response.json({
      error: `${message} [model=${modelId}, region=${region}]`,
      modelId,
      region,
    }, { status: 500 });
  }
}
