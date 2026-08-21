#!/usr/bin/env bash
# Bootstrap the AWS media plane for humblebrag image generation. Run once in the
# resumarsh account (658367926314) — CloudShell or `AWS_PROFILE=resumarsh`.
# Idempotent; re-run freely.
#
# Background: Bedrock's stability.stable-image-ultra-v1:1 is capped at 1 request
# per minute and the quota is NOT adjustable, so image generation moved to a
# RunPod Serverless endpoint. RunPod publishes no OIDC issuer, so its workers
# cannot assume an AWS role. Instead Vercel — which already federates into this
# account via OIDC — mints presigned S3 PUT URLs and hands them to the worker in
# the job payload. The worker therefore holds no AWS credentials at all, and
# each URL is scoped to exactly one object key.
#
# Creates:
#   - S3 bucket        humblebrag-media-<account>  (private, all public access blocked)
#   - CloudFront       distribution with Origin Access Control over that bucket
#   - bucket policy    s3:GetObject for that distribution only
#   - extends the inline policy on humblebrag-vercel-production with s3:PutObject
#     on posts/* so the Vercel function can SIGN the presigned PUTs
#
# Set RETIRE_BEDROCK_IMAGES=1 to also drop the Bedrock image-model grant. Do that
# only at cutover, once RunPod is generating production images — until then the
# old path must keep working. The Nova text grant that the eve agents depend on
# is preserved either way.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
VERCEL_ROLE="${VERCEL_ROLE:-humblebrag-vercel-production}"
MEDIA_BUCKET="${MEDIA_BUCKET:-humblebrag-media-${ACCOUNT}}"
RETIRE_BEDROCK_IMAGES="${RETIRE_BEDROCK_IMAGES:-0}"
echo "Account: ${ACCOUNT}  Region: ${REGION}"

# 1. Private media bucket. Object keys carry the post id, so objects are
#    immutable and the distribution never needs invalidation.
if ! aws s3api head-bucket --bucket "$MEDIA_BUCKET" 2>/dev/null; then
  echo "Creating media bucket ${MEDIA_BUCKET}…"
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$MEDIA_BUCKET" >/dev/null
  else
    aws s3api create-bucket --bucket "$MEDIA_BUCKET" \
      --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
  fi
else
  echo "Media bucket ${MEDIA_BUCKET} exists."
fi
aws s3api put-public-access-block --bucket "$MEDIA_BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws s3api put-bucket-lifecycle-configuration --bucket "$MEDIA_BUCKET" \
  --lifecycle-configuration \
  '{"Rules":[{"ID":"abort-mpu","Status":"Enabled","Filter":{"Prefix":""},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}}]}'

# No CORS configuration: uploads are server-to-server PUTs from the RunPod
# worker against a presigned URL, and reads go through CloudFront. No browser
# ever talks to the bucket directly.

# 2. CloudFront distribution with Origin Access Control.
oac_id=$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='humblebrag-media'].Id | [0]" --output text 2>/dev/null || true)
if [ -z "$oac_id" ] || [ "$oac_id" = "None" ]; then
  echo "Creating origin access control…"
  oac_id=$(aws cloudfront create-origin-access-control --origin-access-control-config \
    '{"Name":"humblebrag-media","OriginAccessControlOriginType":"s3","SigningBehavior":"always","SigningProtocol":"sigv4"}' \
    --query OriginAccessControl.Id --output text)
fi

dist_id=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='humblebrag media'].Id | [0]" --output text 2>/dev/null || true)
if [ -z "$dist_id" ] || [ "$dist_id" = "None" ]; then
  echo "Creating CloudFront distribution…"
  # CachePolicyId 658327ea-… is the AWS-managed CachingOptimized policy.
  dist_out=$(aws cloudfront create-distribution --distribution-config "$(cat <<JSON
{"CallerReference":"humblebrag-media-$(date +%s)","Comment":"humblebrag media","Enabled":true,
 "DefaultCacheBehavior":{"TargetOriginId":"media-s3","ViewerProtocolPolicy":"redirect-to-https",
   "CachePolicyId":"658327ea-f89d-4fab-a63d-7e88639e58f6","Compress":true,
   "AllowedMethods":{"Quantity":2,"Items":["GET","HEAD"]}},
 "Origins":{"Quantity":1,"Items":[{"Id":"media-s3","DomainName":"${MEDIA_BUCKET}.s3.${REGION}.amazonaws.com",
   "OriginAccessControlId":"${oac_id}","S3OriginConfig":{"OriginAccessIdentity":""}}]},
 "PriceClass":"PriceClass_100"}
JSON
)")
  dist_id=$(echo "$dist_out" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Distribution"]["Id"])')
else
  echo "CloudFront distribution ${dist_id} exists."
fi
dist_domain=$(aws cloudfront get-distribution --id "$dist_id" --query Distribution.DomainName --output text)
dist_arn="arn:aws:cloudfront::${ACCOUNT}:distribution/${dist_id}"

aws s3api put-bucket-policy --bucket "$MEDIA_BUCKET" --policy "$(cat <<JSON
{"Version":"2012-10-17","Statement":[
  {"Sid":"AllowCloudFront","Effect":"Allow","Principal":{"Service":"cloudfront.amazonaws.com"},
   "Action":"s3:GetObject","Resource":"arn:aws:s3:::${MEDIA_BUCKET}/*",
   "Condition":{"StringEquals":{"AWS:SourceArn":"${dist_arn}"}}}
]}
JSON
)"

# 3. Let the Vercel function sign presigned PUTs. put-role-policy replaces the
#    whole document, so both statements are restated here every run.
image_stmt='
  {"Sid":"HumblebragImageModels","Effect":"Allow",
   "Action":["bedrock:InvokeModel"],
   "Resource":["arn:aws:bedrock:us-west-2::foundation-model/stability.stable-image-ultra-v1:1"]},'
if [ "$RETIRE_BEDROCK_IMAGES" = "1" ]; then
  echo "Retiring the Bedrock image-model grant…"
  image_stmt=''
fi

aws iam put-role-policy --role-name "$VERCEL_ROLE" --policy-name humblebrag-bedrock-runtime \
  --policy-document "$(cat <<JSON
{"Version":"2012-10-17","Statement":[
  {"Sid":"HumblebragTextModels","Effect":"Allow",
   "Action":["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream"],
   "Resource":[
     "arn:aws:bedrock:us-east-1:${ACCOUNT}:inference-profile/us.amazon.nova-pro-v1:0",
     "arn:aws:bedrock:us-east-2:${ACCOUNT}:inference-profile/us.amazon.nova-pro-v1:0",
     "arn:aws:bedrock:us-west-2:${ACCOUNT}:inference-profile/us.amazon.nova-pro-v1:0",
     "arn:aws:bedrock:us-east-1:${ACCOUNT}:inference-profile/us.amazon.nova-lite-v1:0",
     "arn:aws:bedrock:us-east-2:${ACCOUNT}:inference-profile/us.amazon.nova-lite-v1:0",
     "arn:aws:bedrock:us-west-2:${ACCOUNT}:inference-profile/us.amazon.nova-lite-v1:0",
     "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
     "arn:aws:bedrock:us-east-2::foundation-model/amazon.nova-pro-v1:0",
     "arn:aws:bedrock:us-west-2::foundation-model/amazon.nova-pro-v1:0",
     "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0",
     "arn:aws:bedrock:us-east-2::foundation-model/amazon.nova-lite-v1:0",
     "arn:aws:bedrock:us-west-2::foundation-model/amazon.nova-lite-v1:0"
   ]},${image_stmt}
  {"Sid":"HumblebragMediaS3","Effect":"Allow",
   "Action":["s3:PutObject"],
   "Resource":"arn:aws:s3:::${MEDIA_BUCKET}/posts/*"}
]}
JSON
)"

cat <<SUMMARY

Done. Put these in the humblebrag Vercel project (production):

  MEDIA_BUCKET   = ${MEDIA_BUCKET}
  MEDIA_REGION   = ${REGION}
  MEDIA_CDN_HOST = ${dist_domain}

A new distribution takes ~15 minutes to reach Deployed. Check with:
  aws cloudfront get-distribution --id ${dist_id} --query Distribution.Status --output text
SUMMARY
