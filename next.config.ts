import type { NextConfig } from "next";
import { withEve } from "eve/next";
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};
export default withEve(nextConfig);
