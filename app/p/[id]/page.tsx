import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AntidoteCta } from "../../../components/AntidoteCta";
import { Brand } from "../../../components/Brand";
import { HumblebragCard } from "../../../components/HumblebragCard";
import { PlugFooter } from "../../../components/PlugFooter";
import { ShareGate } from "../../../components/ShareGate";
import { BUCKET_COOKIE, gateMode, normalizeBucket, shouldGate } from "../../../lib/experiment";
import { findPost, hydratePost } from "../../../lib/posts";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const record = await findPost(id);
  if (!record) return { title: "Post not found · humblebrag" };
  const post = hydratePost(record);
  return {
    title: `${post.name} is deeply humbled · humblebrag`,
    description: post.body.slice(0, 155),
    // A post whose images were only generated because the requester accepted a
    // borderline result keeps its permalink, but stays out of search results.
    robots: record.sensitive ? { index: false, follow: false } : undefined,
    // og:image now comes from ./opengraph-image.tsx — one source, and it carries
    // the plug. It suppresses the scene for a sensitive post itself, which is
    // how the "out of link previews" half of the rule above survives the move.
  };
}

export default async function PermalinkPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const record = await findPost(id);
  if (!record || record.status !== "complete") notFound();
  const post = hydratePost(record);

  // The page stays public whatever this resolves to — only the creator's own
  // share actions are ever gated. See components/ShareGate.tsx.
  const [session, jar, query] = await Promise.all([getSession(), cookies(), searchParams]);
  const gated = shouldGate({
    bucket: normalizeBucket(jar.get(BUCKET_COOKIE)?.value),
    mode: gateMode(),
    isEmbed: false,
  });
  const claimIntent = query.claim === "1";
  const mine = Boolean(session && record.ownerUserId === session.userId);

  return <main className="siteShell permalinkShell">
    <header className="siteNav"><Link className="brand" href="/" aria-label="Humblebrag home"><Brand compact priority /></Link><Link className="navAside" href="/">make another ↗</Link></header>
    <section className="permalinkIntro">
      <div>
        <span className="eyebrow">Permanent record of strategic humility</span>
        <h1>{post.name} is<br/><em>deeply humbled.</em></h1>
        {record.ownerHandle
          ? <p className="permalinkByline">Made by <a href={`https://resumarsh.com/${record.ownerHandle}?ref=humblebrag`} target="_blank" rel="noopener">@{record.ownerHandle}</a>, whose real résumé is a different genre entirely.</p>
          : mine ? <p className="permalinkByline">Yours. Claimed and kept.</p> : null}
      </div>
      <ShareGate
        postId={id}
        gated={gated}
        signedIn={Boolean(session)}
        claimIntent={claimIntent}
        shareText={`${post.name} is deeply humbled.`}
      />
    </section>
    <div className="permalinkCard"><HumblebragCard brag={post} /></div>
    <p className="permalinkMeta">Entirely fictional people. Unfortunately plausible behavior. · {record.completedAt?.toLocaleDateString("en-US", { dateStyle: "long" })}</p>
    <AntidoteCta postId={id} premise={record.premise} network={record.network === "influenzr" ? "influenzr" : "workit"} claimed={mine} />
    <PlugFooter variant="permalink" />
  </main>;
}
