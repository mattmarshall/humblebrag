import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { Brand } from "../../components/Brand";
import { getDb } from "../../lib/db";
import { ensureDatabase } from "../../lib/db/ensure";
import { posts } from "../../lib/db/schema";
import { hydratePost, publiclyListable } from "../../lib/posts";
import { GALLERY_PAGE_SIZE } from "../api/posts/route";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The archive · humblebrag",
  description: "Every fictional accomplishment, preserved for posterity.",
};

export default async function GalleryPage() {
  await ensureDatabase();
  const records = await getDb().select().from(posts)
    .where(publiclyListable())
    .orderBy(desc(posts.completedAt), desc(posts.id))
    .limit(GALLERY_PAGE_SIZE);

  return <main className="siteShell">
    <header className="siteNav">
      <Link className="brand" href="/" aria-label="Humblebrag home"><Brand compact priority /></Link>
      <Link className="navAside" href="/">make another ↗</Link>
    </header>

    <section className="intro">
      <div>
        <span className="eyebrow">Preserved for posterity</span>
        <h1>The<br /><em>archive.</em></h1>
      </div>
      <p>Every fictional accomplishment this machine has ever produced. All people, companies, awards and admirers are invented.</p>
    </section>

    {records.length === 0
      ? <p className="galleryEmpty">Nothing has been humbly bragged about yet.</p>
      : <ul className="galleryGrid">
        {records.map((record) => {
          const post = hydratePost(record);
          return <li key={record.id} className={`galleryItem network-${record.network}`}>
            <Link href={`/p/${record.id}`}>
              {post.postImageUrl
                ? <Image className="galleryImage" src={post.postImageUrl} alt="" width={480} height={320} sizes="(max-width: 720px) 100vw, 360px" />
                : <span className="galleryImage galleryImagePlaceholder" aria-hidden="true" />}
              <div className="galleryBody">
                <span className="galleryNetwork">{record.network === "workit" ? "WorkIt" : "Influenzr"}</span>
                <strong>{post.name}</strong>
                <small>{post.title} · {post.company}</small>
                <p>{post.body}</p>
              </div>
            </Link>
          </li>;
        })}
      </ul>}
  </main>;
}
