/**
 * Public — no session read, ever. See lib/og-card.tsx.
 */
import { findPost } from "../../../lib/posts";
import { CARD_CONTENT_TYPE, CARD_SIZE, renderCard } from "../../../lib/og-card";

export const runtime = "nodejs";
export const alt = "A humblebrag post";
export const size = CARD_SIZE;
export const contentType = CARD_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  // Awaited, not indexed: Next 15 passes a Promise here and nothing type-checks
  // this signature, so reading `params.id` directly would quietly serve the
  // fallback card on every share.
  const { id } = await params;
  const record = await findPost(id);
  // A sensitive post keeps its card but loses the scene: main suppressed the
  // og:image for these entirely, and dropping just the imagery preserves that
  // intent while still letting the creator share the link.
  if (record?.sensitive) return renderCard({ ...record, postImageUrl: null });
  if (!record) {
    return renderCard({
      network: "workit",
      postImageUrl: null,
      payload: { name: "This brag", body: "It appears to have been too humble to survive." } as never,
    });
  }
  return renderCard(record);
}
