# humblebrag → resumarsh: the funnel

How humblebrag stops being a standalone joke and becomes the top of resumarsh's
acquisition funnel — by login-gating the *creator's* share artifacts behind a
resumarsh account, while leaving every viral surface wide open.

**Decisions this document commits to**

1. **Identity:** humblebrag signs in against the **same WorkOS AuthKit environment**
   as resumarsh, so a humblebrag login mints a real resumarsh account.
2. **Gate scope:** **creator artifacts only.** Copy-link, PNG download, social
   intent buttons, embed snippet and byline require sign-in. `/p/[id]` permalinks
   and their OG images stay fully public.
3. This document is a specification. No product code has been written for it.

---

## 1. Why these two products fit

resumarsh's own landing page already writes the joke for us:

> **Not a social network for humble brags.**
> Your résumé here answers questions instead of collecting likes.
> — `frontend/app/page.tsx`

humblebrag is the thing resumarsh defines itself against. That is not a conflict,
it is the setup and the punchline:

| | humblebrag | resumarsh |
|---|---|---|
| What it makes | A fictional accomplishment, gorgeously staged | A real one, structured and fact-checked |
| Audience | Everyone, for 45 seconds | The same person, when they need a job |
| Emotional beat | "This is exactly what LinkedIn is" | "…and here's what it should be" |

The funnel is one sentence: **you came to mock the performance; stay to replace it.**

The two products already share a shape — an agent pipeline that turns a premise
into a polished artifact. humblebrag does it for laughs
(`agent/subagents/workit_writer`), resumarsh does it for real (`/start` → agents
structure and fact-check a pasted résumé). Someone who enjoyed the first has
already been shown the mechanic behind the second.

---

## 2. The funnel map

```
             ┌───────────────────────────────────────────────────┐
  embed.js   │  humblebrag.com/           (anonymous, no gate)   │
  OG cards ─▶│  type a premise → watch the agents → see the post │
  word of    └───────────────────┬───────────────────────────────┘
  mouth                          │  "Share this masterpiece"
                                 ▼
                     ╔═══════════════════════════╗
                     ║   THE GATE                ║   ← the only wall
                     ║  Continue with resumarsh  ║      in the funnel
                     ╚═══════════┬═══════════════╝
                                 │ WorkOS AuthKit (shared user pool)
                                 ▼
        ┌────────────────────────────────────────────────────┐
        │  Post is CLAIMED: byline, permanent link, PNG card, │
        │  embed snippet, /me shelf                          │
        │  ── and the interstitial ──                        │
        │  "Your fake accomplishment is live.                │
        │   Want the real one to look this good?"            │
        └───────────────────┬────────────────────────────────┘
                            │  resumarsh.com/start?ref=humblebrag&brag=<id>
                            ▼
        ┌────────────────────────────────────────────────────┐
        │  claim handle → import résumé → agents structure    │
        │  + fact-check → review → publish                   │
        └───────────────────┬────────────────────────────────┘
                            │  reverse funnel
                            ▼
        ┌────────────────────────────────────────────────────┐
        │  resumarsh user turns a REAL bullet into a brag,    │
        │  shares it — the permalink carries their handle     │
        └────────────────────────────────────────────────────┘
                            └──────▶ back to the top
```

### What is free, forever

Everything a *visitor* touches. This is non-negotiable — gate the viral surface
and the funnel has no input.

- Generating a brag (the hook; also the most expensive thing we do, see §8)
- `/p/[id]` permalinks — fully public, no session, no interstitial
- `opengraph-image` for those permalinks — must render for LinkedIn's, X's and
  Slack's unauthenticated crawlers, or shares look broken
- `/embed` and `embed.js` — third-party sites are paid distribution; never gate them

### What the gate covers

Only actions taken by the *creator* to push their own brag outward or keep it:

| Action | Today | After |
|---|---|---|
| Copy share link (`components/ShareLink.tsx`) | free | **sign in** |
| Download the card as PNG | doesn't exist | **sign in** |
| Post to X / LinkedIn (intent buttons) | doesn't exist | **sign in** |
| Copy the embed snippet for *your* brag | free in `Generator` | **sign in** |
| Byline on the permalink (`by @handle` → resumarsh profile) | doesn't exist | **sign in** |
| `/me` — every brag you've made | doesn't exist | **sign in** |
| Guarantee the brag is never garbage-collected | implicit | **sign in** |

This is the whole trick: **the sharer logs in, the audience never does.** The gate
sits at the single highest-intent moment in the product — someone has just made
something they're proud of and wants to show a person — and it costs almost no
reach, because the link they end up sharing is still public.

---

## 3. Identity: a humblebrag login *is* a resumarsh account

A gate that creates a humblebrag-only account is worthless. The login has to mint
the thing we actually want.

resumarsh's identity is WorkOS AuthKit (`frontend/lib/session.ts`), and
`AppSession.userId` is the WorkOS `user_…` id, which is the BFF subject.

**humblebrag adds `@workos-inc/authkit-nextjs` pointed at the same WorkOS
environment**, with humblebrag's callback added to that environment's redirect URIs.

- A humblebrag sign-in creates a real resumarsh user. `/start` then finds an
  existing session and drops the person straight at "claim your handle" — the
  funnel's second step is already half-done before they arrive.
- Cost: roughly a day. Two route files copied from resumarsh
  (`app/sign-in/route.ts`, `app/callback/route.ts`), a `lib/session.ts`,
  `middleware.ts` for cookie refresh, and env vars.
- **Trade-off accepted deliberately:** AuthKit's hosted login screen is branded per
  *environment*, so the login page will say resumarsh. On a humblebrag gate that is
  the point — the plug lands before the user even converts. Branding it humblebrag
  would require a second environment, which breaks the shared user pool and makes
  this entire section pointless.
- Disclose it. humblebrag's privacy note must say the account is a resumarsh
  account, and the gate copy says so too ("resumarsh runs the login — same account,
  different vice").

### The OAuth option, and why it is not first

resumarsh already runs an authorization server at `frontend/app/api/oauth/*`
(RFC 7591 dynamic registration, authorization code + PKCE S256), built for MCP.
humblebrag could become an OAuth client of it and show a literal "Sign in with
resumarsh" button. It is blocked today at
`frontend/app/api/oauth/authorize/route.ts`:

```ts
const caller = await c.identity.getCaller({ name: "caller" });
profile = caller.ownedProfiles[0];
if (!profile) { /* access_denied — "claim one at /start, then connect again" */ }
```

Every cold humblebrag visitor owns no profile, so every one of them would be
refused at exactly the moment we are trying to convert them. Making it work needs
BFF changes: an identity-only authorization with no profile bound, a scope for it,
and an identity endpoint humblebrag can call.

Revisit it when humblebrag needs to *read* resumarsh data on the user's behalf —
specifically the split-screen in §4b, where the real résumé bullet has to come out
of their actual profile.

---

## 4. The bridge: make the plug part of the product, not an ad

Three mechanics, in order of leverage.

### 4a. The premise is already a real accomplishment

The user typed something true into the box — "got promoted to senior engineer",
"my side project hit 500 users" — and humblebrag deliberately inflated it. The
same string is the perfect input for the opposite transformation.

At the post-claim interstitial:

> You told us: *"shipped a podcast episode"*
> WorkIt turned that into a Nobel Prize.
> resumarsh turns it into a line a hiring manager believes.
> **[ Show me the real version → ]**

The link is `resumarsh.com/start?ref=humblebrag&brag=<id>&premise=<encoded>`, and
`/start` seeds its paste step (`frontend/app/start/StartWizard.tsx:206` in resumarsh) with it. The person
watches the *same* premise go through the *opposite* pipeline. That is not a
banner, it is a demo — and it costs one query parameter on each side.

### 4b. The split-screen share card

The strongest shareable unit is not the brag alone, it is the contrast:

```
┌──────────────────────────┬──────────────────────────┐
│  WorkIt (fictional)      │  resumarsh (real)        │
│  "Humbled and honored…"  │  Senior Engineer, 2024   │
│  1,847 🔥  312 💬        │  Led migration of …      │
│                          │  → resumarsh.com/marsh   │
└──────────────────────────┴──────────────────────────┘
        humblebrag.com · the antidote lives at resumarsh.com
```

Every share of this puts resumarsh's value proposition *inside the image*, where
it survives being screenshotted and reposted. Ship the left half first (brag plus
footer plug); the right half needs the OAuth option or a signed-in resumarsh
profile to source a real bullet.

### 4c. Bylines are backlinks

A claimed brag renders `by @marsh`, linking to `resumarsh.com/marsh`. Every shared
permalink becomes a referral link to a real résumé — and gives the creator a
selfish reason to claim: their name on the joke everyone liked.

---

## 5. The reverse funnel (don't skip this)

Once someone publishes on resumarsh, offer — next to any published event in
`/admin` — **"Make the ridiculous version"**, linking to humblebrag prefilled with
that real bullet as the premise.

This is the cheapest content engine available: resumarsh users produce
high-quality brag premises (real, specific, funny in contrast), share them because
they are about *themselves*, and every one of those shares carries their resumarsh
handle back into the top of the funnel. It also gives resumarsh — a serious product
people visit twice a year — a reason to be shared at all.

---

## 6. Implementation — humblebrag

| File | Change |
|---|---|
| `package.json` | `+ @workos-inc/authkit-nextjs` |
| `lib/session.ts` *(new)* | `getSession()` returning `{ userId, email, name, image }` — copy of `resumarsh/frontend/lib/session.ts` |
| `middleware.ts` *(new)* | `authkitMiddleware` for cookie refresh only. **Gate nothing here** — `/`, `/p/*`, `/embed`, `/api/posts` stay anonymous |
| `app/sign-in/route.ts` *(new)* | `getSignInUrl({ returnTo })`; mirror resumarsh's, including the 503 when unconfigured |
| `app/callback/route.ts` *(new)* | `handleAuth({ returnPathname: "/" })` plus resumarsh's `onError` recovery — the bounded one-retry cookie is worth copying wholesale, it has already been debugged in production |
| `lib/db/schema.ts` | `posts`: `+ ownerUserId text`, `+ ownerHandle text`, `+ claimedAt timestamptz`. New `shareEvents` table: `id, postId, kind ('link'\|'png'\|'x'\|'linkedin'\|'embed'\|'gate_view'\|'gate_signin'), userId, createdAt, referrer` |
| `drizzle/0002_claimable_posts.sql` *(new)* | The migration. All new `posts` columns nullable so every existing row stays valid |
| `app/api/posts/route.ts` | On create, set an httpOnly `hb_creator` cookie (rolling list of the last ~20 post ids, 30d). If a session already exists, set `ownerUserId` immediately and skip the gate later |
| `app/api/posts/[id]/claim/route.ts` *(new)* | `POST`. Requires a session **and** (`hb_creator` contains the id **or** the post is unclaimed and under 15 minutes old). Sets `ownerUserId`/`claimedAt`, resolves `ownerHandle`, records a share event. Without the cookie check anyone can claim any permalink — this is the one security-relevant piece of the design |
| `components/ShareGate.tsx` *(new, replaces `ShareLink.tsx`)* | Signed in → copy / PNG / X / LinkedIn / embed. Signed out → one button to `/sign-in?returnTo=/p/[id]%3Fclaim%3D1`, plus the gate copy from §9 |
| `app/p/[id]/page.tsx` | Stays public. Adds the byline when claimed, `<ShareGate>`, and the "antidote" CTA block. On `?claim=1` with a session, auto-POSTs the claim |
| `app/p/[id]/opengraph-image.tsx` *(new)* | Public `ImageResponse`: the card plus `humblebrag.com · the real version lives at resumarsh.com`. Public on purpose — crawlers have no cookies |
| `app/api/posts/[id]/card.png/route.ts` *(new)* | Same renderer, `content-disposition: attachment`, **session required** |
| `app/me/page.tsx` *(new)* | The brag shelf. Signed-in only; the retention hook and the second CTA placement |
| `components/PlugFooter.tsx` *(new)* | One line on `/`, `/p/*` and inside `/embed`: *"humblebrag makes the fake one. [resumarsh](https://resumarsh.com) makes the real one."* The embed placement is free distribution on other people's sites |
| `components/Generator.tsx` | Embed-snippet copy button routes through `<ShareGate>`; on completion, if signed out, show the CTA card rather than a bare permalink push (`components/Generator.tsx:365`) |

resumarsh-side changes live in that repo's `docs/humblebrag-funnel.md`.

---

## 7. Instrumentation — the six numbers

Nothing here is worth arguing about without these. `shareEvents` on the humblebrag
side, an `rsm_ref` cookie on the resumarsh side.

1. **generate → share-intent** — did they want to share at all
2. **share-intent → sign-in complete** — the gate's true cost, the number that decides everything
3. **sign-in → `/start` click** — is the interstitial doing its job
4. **`/start` → handle claimed**
5. **handle → résumé imported → published**
6. **viral coefficient** — permalink views per share, and permalink → new generation

Plus the one that keeps you honest: **generations per share**, before and after the
gate. If it collapses, the gate is eating the input.

### Worked example — is the trade good?

Illustrative, with placeholders to replace once real numbers exist. Say 1,000
generations per month.

| Step | Rate | Count |
|---|---|---|
| Generations | — | 1,000 |
| Share intent | 25% | 250 |
| Sign in at the gate | 40% | 100 accounts |
| Click through to `/start` | 45% | 45 |
| Claim a handle | 55% | 25 |
| Import + publish | 50% | **12 real profiles** |

Cost: 150 people who wanted to share and didn't. At roughly 3 permalink views per
share and 0.3 new generations per share, that is about 45 lost generations —
**4.5% of top-of-funnel** — traded for 12 activated profiles and 100 accounts, from
a product that currently converts zero of either.

The trade only holds while permalinks and OG images stay public. Gate those and the
loss goes from 4.5% to most of the traffic.

---

## 8. One real cost to plan around

Every generation runs an eve agent plus four Bedrock Stable Image Ultra calls
(`app/api/queues/generate-images/route.ts`), all for anonymous users. A funnel that
succeeds at bringing traffic will raise that bill quickly, and abuse is unmetered
today.

Do this *with* the gate, not after: rate-limit anonymous generation per IP (3–5 a
day is generous for the hook) and let a signed-in account raise the limit. That
turns cost control into a second, positive reason to log in — "sign in for more
brags" reads as a perk, not a wall.

---

## 9. Copy deck

**The gate (signed out, on a fresh permalink)**

> **Claim this brag.**
> Sign in to keep the link, download the card, and put your name on it.
> resumarsh runs the login — same account, different vice.
> **[ Continue with resumarsh ]**
> *Your brag is already public at this URL. Signing in is how you keep it.*

That last line matters. It turns the gate from "pay to share" into "pay to own",
which is both truer and less resented.

**The interstitial (immediately after claiming)**

> **Fictional accomplishment: secured.**
> You wrote *"{premise}"*. WorkIt made it a Nobel Prize.
> resumarsh does the other thing — same accomplishment, structured, fact-checked,
> and answerable to questions from an actual recruiter.
> **[ Turn it into the real version → ]**   *Takes about four minutes.*

**`/start` when `ref=humblebrag`**

> **You've done the bit. Now do the résumé.**
> Same accomplishment, minus the 1,847 reactions from people you've never met.
> Paste your résumé — agents structure it and fact-check the draft against what you
> actually wrote. Private until you publish.

**The permalink footer (public, on every shared page)**

> Entirely fictional people. Unfortunately plausible behavior.
> The non-fictional version of this lives at **resumarsh.com**.

---

## 10. Rollout

**Phase 1 — plug, no gate (½ day).** `PlugFooter` on `/`, `/p/*` and `/embed`;
resumarsh's landing line becomes a link; permalink footer copy. Zero risk, starts
producing the baseline for §7, and puts a backlink on every embed.

**Phase 2 — identity (1 day).** WorkOS auth, `hb_creator` cookie, claim route,
schema and migration. Sign-in optional, no gate yet. Measure how many people claim
voluntarily — that is the ceiling the gate is pushing against.

**Phase 3 — the gate (2 days), as a 50/50 experiment.** Half of new sessions get
gated sharing, half keep it free. Run two weeks. Compare share-intent → account
against generations-per-share. Ship the gate if accounts rise more than reach
falls, and keep the holdout running for a month either way.

**Phase 4 — the bridge (2–3 days).** `ref`/`premise` deep link, `/start` tailoring,
the interstitial, `/me` shelf, PNG card.

**Phase 5 — the loop (ongoing).** Reverse-funnel button in `/admin`, the
split-screen card, rate limits as a sign-in perk.

**Kill criteria.** Abandon the gate if generations-per-share drops more than 20%
against the holdout, or if gate → sign-in lands under 20%. Either means the wall is
in the wrong place — fall back to Phase 1+2 (plug plus voluntary claim), which
keeps most of the benefit and none of the friction.

---

## 11. Risks

- **Gating a joke is friction.** People will bounce. That is why it ships as an
  experiment with explicit kill criteria, why the permalink stays public, and why
  the copy sells ownership rather than access. Two alternatives were considered and
  rejected: a hard gate that hides the permalink from strangers (kills reach and
  breaks OG previews) and a pure soft gate with free sharing (lowest friction, but
  converts too few accounts to be worth building).
- **Brand bleed.** resumarsh sells credibility; humblebrag sells satire. The link
  between them must always read as *antidote*, never as *same company, same tone*.
  No resumarsh surface adopts humblebrag's voice.
- **Identity confusion.** Users must understand at the gate that they are making a
  resumarsh account. Say it in the button, say it in the privacy note.
- **Never auto-post.** Intent links only. A tool that posts to someone's real
  LinkedIn on their behalf is a different, worse product.
- **Keep the parody boundary.** Generated people stay fictional (README, "Safety /
  parody boundaries"). A byline says *"@marsh made this"*, never *"@marsh is this
  person"*, and a claimed brag must never be presentable as the claimant's real
  accomplishment.
- **Email.** A gate sign-in is not marketing consent. Don't drip-campaign the people
  it catches without a separate opt-in.
