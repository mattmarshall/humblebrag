import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { awsCredentialsProvider } from "@vercel/functions/oidc";

// Do not read AWS_REGION here. Vercel Functions populate AWS_REGION with the
// function execution region (typically us-east-1), while our Bedrock image
// model is intentionally hosted in us-west-2. Keep Bedrock routing explicit.
export const bedrockRegion = process.env.BEDROCK_REGION?.trim() || "us-west-2";
export const roleArn = process.env.AWS_ROLE_ARN?.trim() || "arn:aws:iam::658367926314:role/humblebrag-vercel-production";
export const textModelId = process.env.BEDROCK_TEXT_MODEL?.trim() || "us.amazon.nova-pro-v1:0";
export const fallbackTextModelId = process.env.BEDROCK_TEXT_FALLBACK_MODEL?.trim() || "us.amazon.nova-lite-v1:0";

export const bedrock = createAmazonBedrock({
  region: bedrockRegion,
  credentialProvider: awsCredentialsProvider({
    roleArn,
    clientConfig: { region: bedrockRegion },
  }),
});
