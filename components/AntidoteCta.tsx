/**
 * The bridge. The premise someone typed here was a real accomplishment before
 * humblebrag inflated it, so the highest-converting thing we can offer is the
 * same string run through the opposite pipeline — not a banner, a demo.
 */
const RESUMARSH_START = "https://resumarsh.com/start";

function trim(premise: string, max = 120) {
  const clean = premise.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function AntidoteCta({ postId, premise, network, claimed }: {
  postId: string;
  premise: string;
  network: "workit" | "influenzr";
  claimed: boolean;
}) {
  const href = `${RESUMARSH_START}?ref=humblebrag&brag=${encodeURIComponent(postId)}&premise=${encodeURIComponent(premise.trim().slice(0, 600))}`;
  return <aside className="antidote">
    <h2>{claimed ? "Fictional accomplishment: secured." : "That was the fiction."}</h2>
    <p>
      You wrote <em>&ldquo;{trim(premise)}&rdquo;</em>. {network === "workit" ? "WorkIt" : "Influenzr"} made it a Nobel Prize.
      resumarsh does the other thing — same accomplishment, structured, fact-checked, and
      answerable to questions from an actual recruiter.
    </p>
    <a className="antidoteCta" href={href} target="_blank" rel="noopener">Turn it into the real version →</a>
    <span className="antidoteTime">Takes about four minutes.</span>
  </aside>;
}
