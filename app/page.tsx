import { Generator } from "../components/Generator";
import { Brand } from "../components/Brand";
import { PlugFooter } from "../components/PlugFooter";
import Link from "next/link";
import { findHomepagePosts, hydratePost } from "../lib/posts";
import { getSession } from "../lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [records, session] = await Promise.all([findHomepagePosts(), getSession()]);
  const initialPosts = {
    workit: records.workit ? hydratePost(records.workit) : undefined,
    influenzr: records.influenzr ? hydratePost(records.influenzr) : undefined,
  };
  const initialPostIds = {
    workit: records.workit?.id,
    influenzr: records.influenzr?.id,
  };
  return <main className="siteShell">
    <header className="siteNav"><Link className="brand" href="/" aria-label="Humblebrag home"><Brand compact priority /></Link>{session ? <Link className="navAside" href="/me">your brags ↗</Link> : <span className="navAside">bragging rights. humbly.</span>}</header>
    <section className="intro">
      <div><span className="eyebrow">Professional and lifestyle self-importance, automated.</span><h1>Make something<br/><em>deeply postable.</em></h1></div>
      <p>Choose your fake network. Turn an ordinary accomplishment into a breathtaking display of strategic humility or curated authenticity—complete with a fictional persona, admirers, and suspiciously polished photography.</p>
    </section>
    <Generator initialPosts={initialPosts} initialPostIds={initialPostIds} />
    <PlugFooter />
  </main>;
}
