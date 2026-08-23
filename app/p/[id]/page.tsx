import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "../../../components/Brand";
import { HumblebragCard } from "../../../components/HumblebragCard";
import { ShareLink } from "../../../components/ShareLink";
import { findPost, hydratePost } from "../../../lib/posts";

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
    // borderline result keeps its permalink, but stays out of search results and
    // out of link previews.
    robots: record.sensitive ? { index: false, follow: false } : undefined,
    openGraph: record.postImageUrl && !record.sensitive ? { images: [record.postImageUrl] } : undefined,
  };
}

export default async function PermalinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await findPost(id);
  if (!record || record.status !== "complete") notFound();
  const post = hydratePost(record);

  return <main className="siteShell permalinkShell">
    <header className="siteNav"><Link className="brand" href="/" aria-label="Humblebrag home"><Brand compact priority /></Link><Link className="navAside" href="/">make another ↗</Link></header>
    <section className="permalinkIntro">
      <div><span className="eyebrow">Permanent record of strategic humility</span><h1>{post.name} is<br/><em>deeply humbled.</em></h1></div>
      <ShareLink />
    </section>
    <div className="permalinkCard"><HumblebragCard brag={post} /></div>
    <p className="permalinkMeta">Entirely fictional people. Unfortunately plausible behavior. · {record.completedAt?.toLocaleDateString("en-US", { dateStyle: "long" })}</p>
  </main>;
}
