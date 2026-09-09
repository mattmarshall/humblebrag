"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEveAgent } from "eve/react";
import { GenerationProgress, type GenerationPhase } from "./GenerationProgress";
import {
  HumblebragCard,
  defaultBrag,
  defaultInfluenzrBrag,
  type Humblebrag,
  type Network,
  type RosterPerson,
} from "./HumblebragCard";

type Intensity = "subtle" | "plausible" | "nuclear";

type GeneratorProps = {
  compact?: boolean;
  initialNetwork?: Network;
  initialPrompt?: string;
  initialPersona?: string;
  autoGenerate?: boolean;
  initialPost?: Humblebrag;
  initialPosts?: Partial<Record<Network, Humblebrag>>;
  initialPostIds?: Partial<Record<Network, string>>;
};

const PERSONAS: Record<Network, { value: string; label: string }[]> = {
  workit: [
    { value: "random", label: "Dealer's choice" },
    { value: "startup-founder", label: "Startup founder" },
    { value: "ai-thought-leader", label: "AI thought leader" },
    { value: "corporate-climber", label: "Corporate climber" },
    { value: "fractional-cmo", label: "Fractional CMO" },
    { value: "strategy-consultant", label: "Strategy consultant" },
    { value: "venture-investor", label: "Venture investor" },
  ],
  influenzr: [
    { value: "random", label: "Dealer's choice" },
    { value: "wellness-guru", label: "Wellness guru" },
    { value: "travel-creator", label: "Travel creator" },
    { value: "lifestyle-founder", label: "Lifestyle founder" },
    { value: "productivity-creator", label: "Productivity creator" },
    { value: "fashion-beauty", label: "Fashion / beauty creator" },
    { value: "soft-life-coach", label: "Soft-life coach" },
  ],
};

function sampleForNetwork(network: Network) {
  return network === "workit" ? defaultBrag : defaultInfluenzrBrag;
}

function numeric(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
}

function strings(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 8) : fallback;
}

function comments(value: unknown, fallback: Humblebrag["commentsPreview"]) {
  if (!Array.isArray(value)) return fallback;
  const result = value
    .filter((v): v is { personId?: unknown; text?: unknown } => Boolean(v && typeof v === "object"))
    .map((v, index) => ({ personId: String(v.personId || `commenter-${index + 1}`), text: String(v.text || "So deserved.") }))
    .slice(0, 3);
  return result.length ? result : fallback;
}

function roster(value: unknown, fallback: RosterPerson[]) {
  if (!Array.isArray(value)) return fallback;
  const result = value
    .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === "object"))
    .map((v, index): RosterPerson => ({
      id: String(v.id || (index === 0 ? "author" : `commenter-${index}`)),
      role: v.role === "author" ? "author" : "commenter",
      name: String(v.name || "Supportive Mutual"),
      handle: String(v.handle || `supportive.mutual.${index}`),
      title: String(v.title || "Strategic Supporter"),
      company: String(v.company || "Mutual Admiration Group"),
      appearance: String(v.appearance || "Fictional adult with a natural, approachable profile-photo appearance."),
      avatarPrompt: String(v.avatarPrompt || "Photorealistic profile portrait of a completely fictional adult, natural skin texture, no text, logo, watermark, celebrity, or public figure."),
    }))
    .slice(0, 4);
  return result.length === 4 ? result : fallback;
}

function normalizeBrag(value: unknown, network: Network): Humblebrag | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const fallback = sampleForNetwork(network);
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const avatarPrompt = typeof raw.avatarPrompt === "string" ? raw.avatarPrompt.trim() : "";
  const postImagePrompt = typeof raw.postImagePrompt === "string" ? raw.postImagePrompt.trim() : "";
  if (!body || !avatarPrompt || !postImagePrompt) return null;

  const rawMetrics = raw.metrics && typeof raw.metrics === "object" ? raw.metrics as Record<string, unknown> : {};
  const metrics: Record<string, number> = {};
  for (const [key, v] of Object.entries(rawMetrics)) {
    if (typeof v === "number" && Number.isFinite(v)) metrics[key] = Math.round(v);
  }

  const normalizedRoster = roster(raw.roster, fallback.roster);
  const authorId = typeof raw.authorId === "string" && normalizedRoster.some((person) => person.id === raw.authorId)
    ? raw.authorId
    : normalizedRoster.find((person) => person.role === "author")?.id || fallback.authorId;

  return {
    network,
    personaId: typeof raw.personaId === "string" ? raw.personaId : fallback.personaId,
    name: typeof raw.name === "string" ? raw.name : fallback.name,
    handle: typeof raw.handle === "string" ? raw.handle.replace(/^@/, "") : fallback.handle,
    title: typeof raw.title === "string" ? raw.title : fallback.title,
    company: typeof raw.company === "string" ? raw.company : fallback.company,
    body,
    hashtags: strings(raw.hashtags, fallback.hashtags),
    award: typeof raw.award === "string" ? raw.award : fallback.award,
    event: typeof raw.event === "string" ? raw.event : fallback.event,
    reactions: numeric(raw.reactions, fallback.reactions),
    comments: numeric(raw.comments, fallback.comments),
    reposts: numeric(raw.reposts, fallback.reposts),
    authorId,
    roster: normalizedRoster,
    commentsPreview: comments(raw.commentsPreview, fallback.commentsPreview),
    appearance: typeof raw.appearance === "string" ? raw.appearance : fallback.appearance,
    avatarPrompt,
    postImagePrompt,
    imageSeed: Math.max(1, Math.min(4294967294, numeric(raw.imageSeed, Math.floor(Math.random() * 4_000_000_000) + 1))),
    metrics: Object.keys(metrics).length ? metrics : fallback.metrics,
  };
}

function extractJson(text: string, network: Network): Humblebrag | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    return normalizeBrag(JSON.parse(text.slice(first, last + 1)), network);
  } catch {
    return null;
  }
}

function defaultPrompt(network: Network) {
  return network === "workit"
    ? "A VP announcing a 12-minute panel appearance like it changed the future of leadership."
    : "A creator getting a complimentary two-night hotel stay and framing it as a life-changing return to authenticity.";
}

export function Generator({
  compact = false,
  initialNetwork = "workit",
  initialPrompt,
  initialPersona = "random",
  autoGenerate = false,
  initialPost,
  initialPosts,
  initialPostIds,
}: GeneratorProps) {
  const router = useRouter();
  const [network, setNetwork] = useState<Network>(initialNetwork);
  const [persona, setPersona] = useState(initialPersona);
  const [intensity, setIntensity] = useState<Intensity>("plausible");
  const [prompt, setPrompt] = useState(initialPrompt || defaultPrompt(initialNetwork));
  const [brag, setBrag] = useState<Humblebrag>(() => initialPosts?.[initialNetwork] || initialPost || sampleForNetwork(initialNetwork));
  const [previewPostId, setPreviewPostId] = useState<string | undefined>(() => initialPostIds?.[initialNetwork]);
  const [draftBrag, setDraftBrag] = useState<Humblebrag>();
  const [phase, setPhase] = useState<GenerationPhase | null>(null);
  const [error, setError] = useState<string>();
  const [errorStage, setErrorStage] = useState<"copy" | "avatar" | "scene">();
  const [allowSensitive, setAllowSensitive] = useState(false);
  const inFlightNetwork = useRef<Network>(initialNetwork);
  const inFlightPersona = useRef(initialPersona);
  const autoRan = useRef(false);
  const postId = useRef<string | undefined>(undefined);

  const agent = useEveAgent({
    onError(cause) {
      setErrorStage("copy");
      setError(cause.message || "The network specialist failed.");
      setPhase("error");
    },
    onFinish(snapshot) {
      if (snapshot.status === "error") return;
      const messages = snapshot.data.messages ?? [];
      const submitted = [...messages]
        .reverse()
        .flatMap((message) => [...message.parts].reverse())
        .find((part) =>
          part.type === "dynamic-tool" &&
          (part.toolName === "submit_workit" || part.toolName === "submit_influenzr") &&
          part.state === "output-available" &&
          !part.partial,
        );
      const toolOutput = submitted?.type === "dynamic-tool" && submitted.state === "output-available"
        ? normalizeBrag(submitted.output, inFlightNetwork.current)
        : null;
      if (toolOutput) {
        void persistAndGenerate({ ...toolOutput, personaId: inFlightPersona.current });
        return;
      }
      const last = [...messages].reverse().find((message) => message.role === "assistant");
      const text = last?.parts
        ?.filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("\n") ?? "";
      const parsed = extractJson(text, inFlightNetwork.current);
      if (!parsed) {
        setErrorStage("copy");
        setError("The specialist returned something too visionary to parse as a post.");
        setPhase("error");
        return;
      }
      void persistAndGenerate({ ...parsed, personaId: inFlightPersona.current });
    },
  });

  const persistAndGenerate = async (next: Humblebrag) => {
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post: next, premise: prompt.trim(), persona: inFlightPersona.current, intensity, allowSensitive }),
      });
      const saved = await response.json() as { id?: string; error?: string };
      if (!response.ok || !saved.id) throw new Error(saved.error || "Could not create a permanent post record.");
      postId.current = saved.id;
      setDraftBrag(next);
      setPhase("avatar");
      setErrorStage("avatar");
      await waitForQueuedImages(saved.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not persist the post.");
      setErrorStage("copy");
      setPhase("error");
    }
  };

  const waitForQueuedImages = async (id: string) => {
    const deadline = Date.now() + 10 * 60 * 1_000;
    while (Date.now() < deadline) {
      const response = await fetch(`/api/posts/${id}`, { cache: "no-store" });
      const result = await response.json() as { status?: string; post?: Humblebrag; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not read image job status.");
      if (result.post) {
        setDraftBrag(result.post);
        setPhase(result.post.avatarUrl ? "scene" : "avatar");
        setErrorStage(result.post.avatarUrl ? "scene" : "avatar");
      }
      if (result.status === "error") throw new Error(result.error || "Image generation failed.");
      if (result.status === "complete" && result.post) {
        const finished = result.post;
        setPhase("finishing");
        window.setTimeout(() => {
          setBrag(finished);
          setPreviewPostId(id);
          setDraftBrag(undefined);
          setError(undefined);
          setErrorStage(undefined);
          setPhase(null);
          if (!compact) router.push(`/p/${id}`);
        }, 850);
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    }
    throw new Error("Image generation is taking longer than expected. The durable job will keep retrying; use the permalink to check back.");
  };

  const busy = phase !== null && phase !== "error";
  const embed = useMemo(() => `<script async src="https://humblebrag-hq.vercel.app/embed.js" data-network="${network}" data-persona="${persona}" data-prompt="${prompt.replaceAll('"', '&quot;')}"></script>`, [network, persona, prompt]);

  const runGeneration = (premise: string) => {
    const clean = premise.trim();
    if (!clean || busy) return;
    inFlightNetwork.current = network;
    inFlightPersona.current = persona;
    setError(undefined);
    setErrorStage("copy");
    setDraftBrag(undefined);
    setPreviewPostId(undefined);
    postId.current = undefined;
    setPhase("copy");
    agent.reset();
    void agent.send(`NETWORK: ${network}\nPERSONA: ${persona}\nINTENSITY: ${intensity}\nPREMISE: ${clean}`);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runGeneration(prompt);
  };

  useEffect(() => {
    if (!autoGenerate || autoRan.current) return;
    autoRan.current = true;
    const timer = window.setTimeout(() => runGeneration(prompt), 80);
    return () => window.clearTimeout(timer);
    // Deliberately run once for the initial embed parameters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

  const switchNetwork = (next: Network) => {
    if (busy || next === network) return;
    setNetwork(next);
    setPersona("random");
    setPrompt(defaultPrompt(next));
    setBrag(initialPosts?.[next] || sampleForNetwork(next));
    setPreviewPostId(initialPostIds?.[next]);
    setError(undefined);
    setPhase(null);
  };

  const retryImages = async () => {
    if (!draftBrag || !postId.current) return;
    setError(undefined);
    setPhase(draftBrag.avatarUrl ? "scene" : "avatar");
    const response = await fetch(`/api/posts/${postId.current}/images`, { method: "POST" });
    if (!response.ok) {
      setError("Could not requeue image generation.");
      setPhase("error");
      return;
    }
    void waitForQueuedImages(postId.current);
  };

  const showTextOnly = () => {
    if (draftBrag) setBrag(draftBrag);
    setPhase(null);
    setError(undefined);
    setErrorStage(undefined);
    setDraftBrag(undefined);
  };

  const activeMetrics = draftBrag?.metrics;

  return <div className={compact ? "generator compactGenerator" : "generator"}>
    {!compact && <div className="generatorTopline">
      <div><span className="eyebrow">Choose your arena</span><h2>Where are we performing?</h2></div>
      <div className="networkSwitch" role="group" aria-label="Parody network">
        <button className={network === "workit" ? "selected workitSelect" : ""} onClick={() => switchNetwork("workit")} type="button" disabled={busy}>
          <span className="workitMark">wi</span><span><b>WorkIt</b><small>career theater</small></span>
        </button>
        <button className={network === "influenzr" ? "selected influenzrSelect" : ""} onClick={() => switchNetwork("influenzr")} type="button" disabled={busy}>
          <span className="influenzrMark">◎</span><span><b>Influenzr</b><small>curated authenticity</small></span>
        </button>
      </div>
    </div>}

    <div className={compact ? "compactGrid" : "generatorGrid"}>
      {!compact && <form className="promptPanel" onSubmit={submit}>
        <label htmlFor="humblebrag-prompt">Describe the flex</label>
        <textarea
          id="humblebrag-prompt"
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={busy}
        />

        <div className="controlRow">
          <label><span>Persona</span>
            <select value={persona} onChange={(e) => setPersona(e.target.value)} disabled={busy}>
              {PERSONAS[network].map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label><span>Cringe</span>
            <select value={intensity} onChange={(e) => setIntensity(e.target.value as Intensity)} disabled={busy}>
              <option value="subtle">Subtle</option>
              <option value="plausible">Plausible</option>
              <option value="nuclear">Nuclear</option>
            </select>
          </label>
        </div>

        <label className="sensitiveOptIn">
          <input type="checkbox" checked={allowSensitive} disabled={busy}
            onChange={(e) => setAllowSensitive(e.target.checked)} />
          <span>Keep borderline results instead of failing. Such posts stay off the home page and out of search.</span>
        </label>

        <div className="promptHints"><span>Try:</span><button type="button" disabled={busy} onClick={() => setPrompt(network === "workit" ? "A founder announcing a minor podcast appearance as if it were a Nobel Prize." : "A wellness creator receiving a free bathrobe and describing it as generational healing.")}>{network === "workit" ? "minor podcast → Nobel Prize" : "free bathrobe → healing"}</button></div>
        <button className="generateButton" disabled={busy || !prompt.trim()} type="submit">{busy ? "Agents are overachieving…" : "Generate humblebrag"}<span>↗</span></button>
        <p className="privacyNote">Entirely fictional people. Unfortunately plausible behavior.</p>
      </form>}

      <div className={`previewPanel ${phase ? "isGenerating" : ""}`}>
        <div className="previewHeader"><span>{phase ? "Agent activity" : "Live preview"}</span><span className="previewHeaderActions">{!phase && previewPostId ? <Link href={`/p/${previewPostId}`}>permalink ↗</Link> : null}<span className="previewNetwork">{network === "workit" ? "WorkIt" : "Influenzr"}</span></span></div>
        <div className="previewBody">
          {phase
            ? <GenerationProgress phase={phase} network={inFlightNetwork.current} error={error} metrics={activeMetrics} />
            : <HumblebragCard brag={brag} />}
        </div>
        {phase === "error" && <div className="errorActions">
          {draftBrag && errorStage !== "copy" && <button type="button" onClick={retryImages}>Retry visual agents</button>}
          {draftBrag && <button type="button" onClick={showTextOnly}>Show copy anyway</button>}
          <button type="button" onClick={() => { setPhase(null); setError(undefined); setErrorStage(undefined); setDraftBrag(undefined); }}>Back to generator</button>
        </div>}
      </div>
    </div>

    {!compact && <details className="embedDetails"><summary>Embed this nonsense elsewhere</summary><pre>{embed}</pre></details>}
  </div>;
}
