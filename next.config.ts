import type { NextConfig } from "next";
import { withEve } from "eve/next";
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Images generated on RunPod land in S3 and are served through CloudFront.
      { protocol: "https", hostname: "d1m34fjnqlwt1i.cloudfront.net" },
      // Posts created before the cutover still point at Vercel Blob.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};
export default withEve(nextConfig);
