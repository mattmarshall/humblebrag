import { Generator } from "../components/Generator";
import { Brand } from "../components/Brand";

export default function Home() {
  return <main className="siteShell">
    <header className="siteNav"><a className="brand" href="/" aria-label="Humblebrag home"><Brand compact priority /></a><span className="navAside">bragging rights. humbly.</span></header>
    <section className="intro">
      <div><span className="eyebrow">Professional and lifestyle self-importance, automated.</span><h1>Make something<br/><em>deeply postable.</em></h1></div>
      <p>Choose your fake network. Turn an ordinary accomplishment into a breathtaking display of strategic humility or curated authenticity—complete with a fictional persona, admirers, and suspiciously polished photography.</p>
    </section>
    <Generator />
  </main>;
}
