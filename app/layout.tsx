import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Humblebrag — synthetic achievement theater",
  description: "Generate satirical WorkIt and Influenzr posts with fictional personas and images.",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
