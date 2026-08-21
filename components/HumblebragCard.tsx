import Image from "next/image";

export type Network = "workit" | "influenzr";

export type RosterPerson = {
  id: string;
  role: "author" | "commenter";
  name: string;
  handle: string;
  title: string;
  company: string;
  appearance: string;
  avatarPrompt: string;
  avatarUrl?: string;
};

export type Humblebrag = {
  network: Network;
  personaId: string;
  name: string;
  handle: string;
  title: string;
  company: string;
  body: string;
  hashtags: string[];
  award: string;
  event: string;
  reactions: number;
  comments: number;
  reposts: number;
  authorId: string;
  roster: RosterPerson[];
  commentsPreview: { personId: string; text: string }[];
  appearance: string;
  avatarPrompt: string;
  postImagePrompt: string;
  imageSeed: number;
  metrics: Record<string, number>;
  avatarUrl?: string;
  postImageUrl?: string;
};

export const defaultBrag: Humblebrag = {
  network: "workit",
  personaId: "enterprise-alignment-executive",
  name: "Brock Synergson",
  handle: "brock.synergson",
  title: "Chief Vision Alignment Officer",
  company: "Synergize Everything, Inc.",
  body: "Honored and humbled to share that I’ve been invited to moderate an intimate leadership roundtable on strategic authenticity. What began as a 12-minute panel slot somehow became a reminder that leadership isn’t about being seen — it’s about creating space for others to see you creating space.\n\nNone of this happens without an incredible team, generous mentors, and the courage to keep showing up with curiosity, conviction, and a deeply scalable sense of gratitude.",
  hashtags: ["grateful", "leadership", "alignment", "growth"],
  award: "Top 1% Cross-Functional Thought Partner",
  event: "Leadership Forward · Align. Amplify. Ascend.",
  reactions: 16842,
  comments: 612,
  reposts: 73,
  commentsPreview: [
    { personId: "jenna-growthwell", text: "So deserved. This is leadership. 👏" },
    { personId: "miles-excelton", text: "You continue to raise the bar while somehow staying grounded." },
    { personId: "paige-momentum", text: "Huge. Congrats Brock!" },
  ],
  appearance: "Fictional man in his early 40s with short brown hair, rectangular glasses, navy blazer and pale blue shirt, earnest enterprise SaaS executive energy.",
  avatarPrompt: "Photorealistic professional profile portrait of a fictional man in his early 40s with short brown hair, rectangular glasses, navy blazer and pale blue shirt, warm neutral office background, natural corporate headshot, no text, no logo.",
  authorId: "brock-synergson",
  roster: [
    { id: "brock-synergson", role: "author", name: "Brock Synergson", handle: "brock.synergson", title: "Chief Vision Alignment Officer", company: "Synergize Everything, Inc.", appearance: "Fictional man in his early 40s with short brown hair, rectangular glasses, navy blazer and pale blue shirt.", avatarPrompt: "Photorealistic professional profile portrait of a fictional man in his early 40s with short brown hair, rectangular glasses, navy blazer and pale blue shirt, no text or logo." },
    { id: "jenna-growthwell", role: "commenter", name: "Jenna Growthwell", handle: "jenna.growthwell", title: "VP, People Momentum", company: "Northstar Loop", appearance: "Fictional woman in her late 30s with auburn bobbed hair, freckles, green blouse and charcoal blazer.", avatarPrompt: "Photorealistic professional headshot of a fictional woman in her late 30s with auburn bobbed hair, freckles, green blouse and charcoal blazer, no text or logo." },
    { id: "miles-excelton", role: "commenter", name: "Miles Excelton", handle: "miles.excelton", title: "Operating Partner", company: "Summit Arc", appearance: "Fictional Black man in his mid 40s with close-cropped hair, salt-and-pepper beard and a grey knit polo.", avatarPrompt: "Photorealistic professional headshot of a fictional Black man in his mid 40s with close-cropped hair, salt-and-pepper beard and a grey knit polo, no text or logo." },
    { id: "paige-momentum", role: "commenter", name: "Paige Momentum", handle: "paige.momentum", title: "Founder", company: "Forwardly", appearance: "Fictional East Asian woman in her early 30s with long black hair, round glasses and a cream jacket.", avatarPrompt: "Photorealistic professional headshot of a fictional East Asian woman in her early 30s with long black hair, round glasses and a cream jacket, no text or logo." },
  ],
  postImagePrompt: "Photorealistic event photo of the same fictional man in his early 40s with short brown hair, rectangular glasses, navy blazer and pale blue shirt, speaking confidently on a tasteful corporate conference stage, flattering event lighting, no readable text or logos.",
  imageSeed: 1438197,
  metrics: { humilityIndex: 12, buzzwordsInserted: 11, authenticityRemovedPct: 83, phantomRecruitersAlerted: 47 },
};

export const defaultInfluenzrBrag: Humblebrag = {
  network: "influenzr",
  personaId: "wellness-founder-creator",
  name: "Sage Marlowe",
  handle: "sagemarlowe",
  title: "founder · creator · recovering overthinker",
  company: "Soft Signal Studio",
  body: "still processing this little chapter 🤍 what was supposed to be two quiet nights away turned into the reminder I didn’t know I needed: rest is productive, softness is strategy, and sometimes the universe sends you a mineral pool with late checkout. feeling very held, very hydrated, and deeply grateful for the people who keep making space for me to choose myself.",
  hashtags: ["softlife", "grateful", "reset", "littlemoments"],
  award: "Two Complimentary Nights of Radical Receiving",
  event: "The Aster House · somewhere intentionally undisclosed",
  reactions: 42871,
  comments: 938,
  reposts: 204,
  commentsPreview: [
    { personId: "mila-sunday", text: "the ENERGY in this photo 😭✨" },
    { personId: "rowan-bloom", text: "you deserve every soft thing coming to you bb" },
    { personId: "tess-daylight", text: "okay but drop the robe details immediately" },
  ],
  appearance: "Fictional woman in her early 30s with shoulder-length dark blonde waves, warm olive skin, expressive brown eyes, minimal gold jewelry, cream linen shirt, polished-but-effortless wellness founder vibe.",
  avatarPrompt: "Photorealistic social profile portrait of a fictional woman in her early 30s with shoulder-length dark blonde waves, warm olive skin, expressive brown eyes, minimal gold jewelry and a cream linen shirt, soft window light, believable phone-camera portrait, no text or logo.",
  authorId: "sage-marlowe",
  roster: [
    { id: "sage-marlowe", role: "author", name: "Sage Marlowe", handle: "sagemarlowe", title: "founder · creator · recovering overthinker", company: "Soft Signal Studio", appearance: "Fictional woman in her early 30s with shoulder-length dark blonde waves, warm olive skin and a cream linen shirt.", avatarPrompt: "Photorealistic social profile portrait of a fictional woman in her early 30s with shoulder-length dark blonde waves, warm olive skin and a cream linen shirt, no text or logo." },
    { id: "mila-sunday", role: "commenter", name: "Mila Sunday", handle: "milasunday", title: "slow living creator", company: "Sunday Ritual", appearance: "Fictional South Asian woman in her late 20s with long wavy black hair, warm brown skin and a coral linen top.", avatarPrompt: "Photorealistic social-profile portrait of a fictional South Asian woman in her late 20s with long wavy black hair, warm brown skin and a coral linen top, no text or logo." },
    { id: "rowan-bloom", role: "commenter", name: "Rowan Bloom", handle: "rowanbloom", title: "ceramicist · creator", company: "Bloom Form", appearance: "Fictional white nonbinary adult in their early 30s with short copper curls, blue eyes and an oatmeal sweater.", avatarPrompt: "Photorealistic social-profile portrait of a fictional white nonbinary adult in their early 30s with short copper curls, blue eyes and an oatmeal sweater, no text or logo." },
    { id: "tess-daylight", role: "commenter", name: "Tess Daylight", handle: "tessdaylight", title: "travel creator", company: "Daylight Notes", appearance: "Fictional Black woman in her early 30s with shoulder-length locs, deep brown skin and a saffron silk blouse.", avatarPrompt: "Photorealistic social-profile portrait of a fictional Black woman in her early 30s with shoulder-length locs, deep brown skin and a saffron silk blouse, no text or logo." },
  ],
  postImagePrompt: "Photorealistic lifestyle photo of the same fictional woman in her early 30s with shoulder-length dark blonde waves, warm olive skin, expressive brown eyes, minimal gold jewelry and cream linen clothing, relaxing at a tasteful boutique wellness hotel during golden hour, candid but curated, no readable text or logos.",
  imageSeed: 8827711,
  metrics: { mainCharacterEnergy: 94, aestheticSaturationPct: 89, casualnessSimulationPct: 97, brandCollabsManifested: 8 },
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((v) => v[0]).join("").slice(0, 2).toUpperCase();
}

function personFor(brag: Humblebrag, personId: string) {
  return brag.roster.find((person) => person.id === personId);
}

function PersonAvatar({ person, className = "miniAvatar" }: { person?: RosterPerson; className?: string }) {
  if (person?.avatarUrl) return <Image className={className} src={person.avatarUrl} alt={`Fictional avatar for ${person.name}`} width={60} height={60} sizes="30px" />;
  return <div className={className}>{initials(person?.name || "Supportive Mutual").slice(0, 1)}</div>;
}

function Avatar({ brag, compact = false }: { brag: Humblebrag; compact?: boolean }) {
  if (brag.avatarUrl) {
    return <Image className={compact ? "avatarPhoto miniProfilePhoto" : "avatarPhoto"} src={brag.avatarUrl} alt={`Fictional avatar for ${brag.name}`} width={96} height={96} sizes="48px" />;
  }
  return <div className={compact ? "avatarFallback miniProfilePhoto" : "avatarFallback"}>{initials(brag.name)}</div>;
}

function DotsIcon() {
  return <span aria-hidden="true" className="dotsIcon">•••</span>;
}

function WorkItReactionStack() {
  return <span className="reactionStack" aria-hidden="true"><i>👍</i><i>👏</i><i>♥</i></span>;
}

export function WorkItCard({ brag }: { brag: Humblebrag }) {
  return <article className="workitCard" aria-label="WorkIt parody post">
    <header className="workitHeader">
      <Avatar brag={brag} />
      <div className="identity">
        <div className="identityName">{brag.name} <span className="connection">· 2nd</span></div>
        <div className="identitySub identityHeadline">{brag.title} · {brag.company}</div>
        <div className="identitySub">3d · <span aria-label="Visible to everyone">◉</span></div>
      </div>
      <button className="moreButton" aria-label="More options" type="button"><DotsIcon /></button>
    </header>

    <div className="workitBody">
      <div className="workitPostText">{brag.body}</div>
      <div className="hashtagRow">{brag.hashtags.map((h) => `#${h}`).join(" ")}</div>
    </div>

    {brag.postImageUrl
      ? <Image className="workitMedia" src={brag.postImageUrl} alt="Fictional professional-network post scene" width={1100} height={576} sizes="(max-width: 700px) 100vw, 555px" />
      : <div className="workitMedia workitMediaFallback"><span>WORKIT LEADERSHIP EVENT</span><b>{brag.award}</b><small>{brag.event}</small></div>}

    <div className="workitStats">
      <span className="reactionCount"><WorkItReactionStack /> {brag.reactions.toLocaleString()}</span>
      <span>{brag.comments.toLocaleString()} comments · {brag.reposts.toLocaleString()} reposts</span>
    </div>

    <div className="workitActions">
      <button type="button"><span aria-hidden="true">♡</span><b>Like</b></button>
      <button type="button"><span aria-hidden="true">◯</span><b>Comment</b></button>
      <button type="button"><span aria-hidden="true">↻</span><b>Repost</b></button>
      <button type="button"><span aria-hidden="true">✈</span><b>Send</b></button>
    </div>

    <div className="workitComments">
      {brag.commentsPreview.slice(0, 2).map((c, i) => {
        const person = personFor(brag, c.personId);
        return <div className="workitComment" key={`${c.personId}-${i}`}>
          <PersonAvatar person={person} />
          <div className="commentBubble"><b>{person?.name || "Supportive Mutual"}</b><small> · 2nd</small><p>{c.text}</p></div>
        </div>;
      })}
    </div>
  </article>;
}

function HeartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>;
}
function CommentIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.8 9.8 0 0 1-3.8-.8L3 21l1.7-4.7A8.2 8.2 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" /></svg>;
}
function SendIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7.2 20-4-8.8L2 9.2 22 2Z" /><path d="M10.8 13.2 22 2" /></svg>;
}
function SaveIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18l-7-4-7 4V3Z" /></svg>;
}

export function InfluenzrCard({ brag }: { brag: Humblebrag }) {
  const handle = brag.handle || brag.name.toLowerCase().replaceAll(" ", ".");
  return <article className="influenzrCard" aria-label="Influenzr parody post">
    <header className="influenzrHeader">
      <div className="storyRing"><Avatar brag={brag} compact /></div>
      <div className="igIdentity"><div className="igName">{handle} <span className="fakeVerified" aria-label="Influenzr verified parody badge">✓</span></div><div className="igLocation">{brag.event || brag.company}</div></div>
      <button className="moreButton" aria-label="More options" type="button"><DotsIcon /></button>
    </header>

    {brag.postImageUrl
      ? <Image className="influenzrMedia" src={brag.postImageUrl} alt="Fictional image-first social post scene" width={1000} height={1000} sizes="(max-width: 700px) 100vw, 470px" />
      : <div className="influenzrMedia igFallback"><span>golden hour pending</span><small>{brag.award}</small></div>}

    <div className="igActions">
      <div className="igActionCluster"><button type="button" aria-label="Like"><HeartIcon /></button><button type="button" aria-label="Comment"><CommentIcon /></button><button type="button" aria-label="Share"><SendIcon /></button></div>
      <button type="button" aria-label="Save"><SaveIcon /></button>
    </div>

    <div className="igCaption">
      <b className="igLikes">{brag.reactions.toLocaleString()} likes</b>
      <p><strong>{handle}</strong> {brag.body}</p>
      <div className="igTags">{brag.hashtags.map((h) => `#${h}`).join(" ")}</div>
      <button className="igMuted" type="button">View all {brag.comments.toLocaleString()} comments</button>
      {brag.commentsPreview.slice(0, 2).map((c, i) => {
        const person = personFor(brag, c.personId);
        return <div className="igCommentRow" key={`${c.personId}-${i}`}><PersonAvatar person={person} className="igCommentAvatar" /><p className="igComment"><strong>{(person?.handle || person?.name || "supportive_mutual").toLowerCase().replaceAll(" ", "_")}</strong> {c.text}</p></div>;
      })}
      <div className="igTime">3 DAYS AGO</div>
    </div>
  </article>;
}

export function HumblebragCard({ brag }: { brag: Humblebrag }) {
  return brag.network === "influenzr" ? <InfluenzrCard brag={brag} /> : <WorkItCard brag={brag} />;
}
