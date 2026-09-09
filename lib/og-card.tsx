import { ImageResponse } from "next/og";
import type { StoredPost } from "./db/schema";

/**
 * The share card, used both as the permalink's opengraph-image and as the PNG a
 * creator downloads.
 *
 * ⛔ THE OG PATH IS PUBLIC AND MUST STAY THAT WAY. Crawlers arrive with no
 * cookies; a session read here would make every shared link render as a broken
 * preview, which is exactly the reach the gate is supposed to preserve.
 *
 * The footer is the point: it travels inside the image, so the plug survives a
 * screenshot and a repost.
 */
export const CARD_SIZE = { width: 1200, height: 630 };
export const CARD_CONTENT_TYPE = "image/png";

const NAVY = "#08245c";
const PAPER = "#fbfaf7";
const PERIWINKLE = "#9296ff";
const GOLD = "#f5ac16";

export function renderCard(record: Pick<StoredPost, "payload" | "postImageUrl" | "network">) {
  const post = record.payload;
  const scene = record.postImageUrl ?? undefined;
  const network = record.network === "influenzr" ? "Influenzr" : "WorkIt";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: NAVY, color: PAPER, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56, width: scene ? 700 : 1200 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 4, color: GOLD, textTransform: "uppercase" }}>
              {network} · humblebrag
            </div>
            <div style={{ display: "flex", fontSize: 54, lineHeight: 1.08, marginTop: 22, fontWeight: 700 }}>
              {post.name} is deeply humbled.
            </div>
            <div style={{ display: "flex", fontSize: 25, lineHeight: 1.42, marginTop: 24, color: "rgba(251,250,247,.82)" }}>
              {post.body.slice(0, 180)}{post.body.length > 180 ? "…" : ""}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 21 }}>
            <div style={{ display: "flex", color: "rgba(251,250,247,.55)" }}>Entirely fictional. Unfortunately plausible.</div>
            <div style={{ display: "flex", marginTop: 8, color: PERIWINKLE }}>
              The real version of this lives at resumarsh.com
            </div>
          </div>
        </div>
        {scene ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={scene} alt="" width={500} height={630} style={{ objectFit: "cover" }} />
        ) : null}
      </div>
    ),
    CARD_SIZE,
  );
}
