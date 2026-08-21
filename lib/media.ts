import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsCredentialsProvider } from "@vercel/functions/oidc";

// Images live in a private S3 bucket fronted by CloudFront (see
// infra/aws-bootstrap-media.sh). RunPod workers cannot assume an AWS role —
// RunPod publishes no OIDC issuer — so this module mints presigned PUT URLs and
// the worker uploads against them without ever holding a credential.
const region = process.env.MEDIA_REGION?.trim() || "us-east-1";
const bucket = process.env.MEDIA_BUCKET?.trim();
const cdnHost = process.env.MEDIA_CDN_HOST?.trim();
const roleArn = process.env.AWS_ROLE_ARN?.trim() || "arn:aws:iam::658367926314:role/humblebrag-vercel-production";

// The role's MaxSessionDuration is 3600, and a URL signed with STS temporary
// credentials dies with those credentials, so an hour is the practical ceiling.
// Jobs normally start within seconds; anything still queued after that is
// re-submitted with fresh URLs by /api/cron/reconcile.
const UPLOAD_TTL_SECONDS = 3_600;

let client: S3Client | undefined;

function getClient() {
  if (!bucket) throw new Error("MEDIA_BUCKET is not configured");
  client ??= new S3Client({
    region,
    credentials: awsCredentialsProvider({ roleArn, clientConfig: { region } }),
  });
  return client;
}

/**
 * Object keys mirror the paths the previous Vercel Blob implementation used, so
 * the two schemes read identically in the database and in logs.
 */
export function mediaKey(postId: string, slot: ImageSlot) {
  if (slot === "avatar") return `posts/${postId}/avatar.jpg`;
  if (slot === "scene") return `posts/${postId}/post.jpg`;
  return `posts/${postId}/people/${slot.slice("person:".length)}.jpg`;
}

export type ImageSlot = "avatar" | "scene" | `person:${string}`;

export function personSlot(personId: string): ImageSlot {
  return `person:${personId}`;
}

export function personIdFromSlot(slot: string) {
  return slot.startsWith("person:") ? slot.slice("person:".length) : undefined;
}

/** Public CloudFront URL for a slot. Derived, never taken from the worker. */
export function mediaUrl(postId: string, slot: ImageSlot) {
  if (!cdnHost) throw new Error("MEDIA_CDN_HOST is not configured");
  return `https://${cdnHost}/${mediaKey(postId, slot)}`;
}

/**
 * Presign a single-object PUT, locked to one key and to image/jpeg.
 *
 * signableHeaders is load-bearing. Passing ContentType on the command alone does
 * NOT constrain the upload — the presigner leaves content-type out of
 * X-Amz-SignedHeaders, so the URL will happily accept text/html and CloudFront
 * will then serve that key as HTML. Forcing content-type into the signature
 * makes any other value fail with SignatureDoesNotMatch.
 */
export async function presignUpload(postId: string, slot: ImageSlot) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: mediaKey(postId, slot),
    ContentType: "image/jpeg",
  });
  return getSignedUrl(getClient(), command, {
    expiresIn: UPLOAD_TTL_SECONDS,
    signableHeaders: new Set(["content-type", "host"]),
  });
}

export function isMediaConfigured() {
  return Boolean(bucket && cdnHost);
}
