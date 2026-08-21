import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://humblebrag-hq.vercel.app"),
  title: "humblebrag — bragging rights. humbly.",
  description: "Generate satirical WorkIt and Influenzr posts with fictional personas and images.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "64x64" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "humblebrag — bragging rights. humbly.",
    description: "Synthetic social achievement theater for the strategically humble.",
    images: [{ url: "/brand/readme-hero.png", width: 1600, height: 520, alt: "humblebrag" }],
  },
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
