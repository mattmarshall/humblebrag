/**
 * The brag shelf. The reason a claim is worth making after the first share, and
 * the second place the antidote gets offered.
 */
import Link from "next/link";
import { Brand } from "../../components/Brand";
import { PlugFooter } from "../../components/PlugFooter";
import { startSignIn } from "../../lib/auth-actions";
import { findPostsByOwner, hydratePost } from "../../lib/posts";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your brags · humblebrag" };

export default async function BragShelf() {
  const session = await getSession();

  return <main className="siteShell">
    <header className="siteNav">
      <Link className="brand" href="/" aria-label="Humblebrag home"><Brand compact priority /></Link>
      <Link className="navAside" href="/">make another ↗</Link>
    </header>

    {session ? <Shelf userId={session.userId} name={session.name} /> : <SignedOut />}
    <PlugFooter />
  </main>;
}

function SignedOut() {
  return <section className="shelfEmpty">
    <span className="eyebrow">Your permanent record</span>
    <h1>Sign in to see<br/><em>everything you&rsquo;ve claimed.</em></h1>
    <p>resumarsh runs the login — same account, different vice.</p>
    <form action={startSignIn}>
      <input type="hidden" name="returnTo" value="/me" />
      <button className="copyLinkButton" type="submit">Continue with resumarsh</button>
    </form>
  </section>;
}

async function Shelf({ userId, name }: { userId: string; name?: string }) {
  const records = await findPostsByOwner(userId);

  if (records.length === 0) {
    return <section className="shelfEmpty">
      <span className="eyebrow">Your permanent record</span>
      <h1>Nothing claimed<br/><em>yet.</em></h1>
      <p>Make one, then put your name on it. It stays at its permalink either way.</p>
      <Link className="copyLinkButton" href="/">Make a brag</Link>
    </section>;
  }

  return <section className="shelf">
    <div className="shelfHead">
      <span className="eyebrow">Your permanent record</span>
      <h1>{name ? `${name}'s` : "Your"} strategic<br/><em>humility.</em></h1>
      <p className="shelfCount">{records.length} claimed {records.length === 1 ? "brag" : "brags"}.</p>
    </div>
    <ul className="shelfList">
      {records.map((record) => {
        const post = hydratePost(record);
        return <li key={record.id}>
          <Link href={`/p/${record.id}`}>
            <span className="shelfNetwork">{record.network === "influenzr" ? "Influenzr" : "WorkIt"}</span>
            <span className="shelfName">{post.name} is deeply humbled.</span>
            <span className="shelfPremise">{record.premise}</span>
          </Link>
        </li>;
      })}
    </ul>
  </section>;
}
