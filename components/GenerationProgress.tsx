"use client";

import { useEffect, useMemo, useState } from "react";
import type { Network } from "./HumblebragCard";

export type GenerationPhase = "copy" | "avatar" | "scene" | "finishing" | "error";

const WORKIT_COPY = [
  "Routing premise to the Career Theater desk…",
  "Converting a modest accomplishment into a leadership journey…",
  "Calibrating humility coefficient…",
  "Adding cross-functional alignment where none was requested…",
  "Finding a way to thank the team while remaining the protagonist…",
  "Manufacturing peer validation from people named Chad…",
  "Checking whether ‘honored and humbled’ can survive another fiscal quarter…",
];

const INFLUENZR_COPY = [
  "Routing premise to Curated Authenticity…",
  "Turning a perk into a chapter of personal growth…",
  "Searching for the lesson the universe allegedly sent…",
  "Balancing relatability against visible luxury…",
  "Removing three percent of the vulnerability for brand safety…",
  "Adding one lowercase sentence for intimacy…",
  "Determining whether ‘still processing this’ tests better than ‘pinch me’…",
];

const WORKIT_AVATAR = [
  "Casting a fictional executive with excellent dental coverage…",
  "Selecting a blazer that says servant leadership but invoices business class…",
  "Generating an approachable headshot with board-ready cheekbones…",
  "Retouching authenticity without making it look retouched…",
];

const INFLUENZR_AVATAR = [
  "Casting a fictional creator who definitely woke up like this…",
  "Negotiating with the ring light…",
  "Generating skin texture acceptable to both reality and sponsorships…",
  "Introducing one strategically imperfect hair strand…",
];

const WORKIT_SCENE = [
  "Staging photographic evidence of disproportionate importance…",
  "Positioning lanyard for maximum executive credibility…",
  "Generating conference lighting suspiciously kinder than nature…",
  "Adding an audience just outside the crop…",
];

const INFLUENZR_SCENE = [
  "Locating the golden hour…",
  "Generating effortless candid after 47 imaginary takes…",
  "Moving the oat-milk latte 11 pixels toward aspiration…",
  "Ensuring the hotel looks gifted but not *too* gifted…",
];

function rangeForPhase(phase: GenerationPhase) {
  if (phase === "copy") return [5, 48] as const;
  if (phase === "avatar") return [51, 67] as const;
  if (phase === "scene") return [70, 91] as const;
  if (phase === "finishing") return [94, 99] as const;
  return [0, 0] as const;
}

function phaseMessages(phase: GenerationPhase, network: Network) {
  if (phase === "copy") return network === "workit" ? WORKIT_COPY : INFLUENZR_COPY;
  if (phase === "avatar") return network === "workit" ? WORKIT_AVATAR : INFLUENZR_AVATAR;
  if (phase === "scene") return network === "workit" ? WORKIT_SCENE : INFLUENZR_SCENE;
  if (phase === "finishing") return network === "workit"
    ? ["Inflating engagement to enterprise-grade levels…", "Running final self-awareness removal…", "Shipping thought leadership into the feed…"]
    : ["Seeding comments from impossibly supportive mutuals…", "Applying final main-character pass…", "Preparing lifestyle evidence for public consumption…"];
  return ["The synergy engine experienced an unplanned authenticity event."];
}

function stepStatus(index: number, phase: GenerationPhase) {
  const current = phase === "copy" ? 1 : phase === "avatar" ? 2 : phase === "scene" ? 3 : phase === "finishing" ? 4 : -1;
  if (index < current) return "DONE";
  if (index === current) return "RUNNING";
  return "QUEUED";
}

function metricValue(start: number, target: number, progress: number, invert = false) {
  const normalized = Math.max(0, Math.min(1, progress / 100));
  const curved = 1 - Math.pow(1 - normalized, 1.8);
  const value = invert ? start - (start - target) * curved : start + (target - start) * curved;
  return Math.round(value);
}

function Artifacts({ network, progress, metrics }: { network: Network; progress: number; metrics?: Record<string, number> }) {
  if (network === "workit") {
    const humility = metrics?.humilityIndex ?? 13;
    const buzz = metrics?.buzzwordsInserted ?? 12;
    const authenticity = metrics?.authenticityRemovedPct ?? 84;
    const recruiters = metrics?.phantomRecruitersAlerted ?? 43;
    const items = [
      ["Humility index", metricValue(91, humility, progress, true), "/100"],
      ["Buzzwords inserted", metricValue(0, buzz, progress), ""],
      ["Authenticity removed", metricValue(0, authenticity, progress), "%"],
      ["Phantom recruiters", metricValue(0, recruiters, progress), ""],
    ] as const;
    return <div className="artifactGrid">{items.map(([label, value, suffix]) => <div className="artifactCard" key={label}><span>{label}</span><strong>{value}{suffix}</strong></div>)}</div>;
  }

  const mainCharacter = metrics?.mainCharacterEnergy ?? 93;
  const aesthetic = metrics?.aestheticSaturationPct ?? 89;
  const casual = metrics?.casualnessSimulationPct ?? 96;
  const collabs = metrics?.brandCollabsManifested ?? 8;
  const items = [
    ["Main-character energy", metricValue(18, mainCharacter, progress), "/100"],
    ["Aesthetic saturation", metricValue(12, aesthetic, progress), "%"],
    ["Casualness simulated", metricValue(4, casual, progress), "%"],
    ["Brand collabs manifested", metricValue(0, collabs, progress), ""],
  ] as const;
  return <div className="artifactGrid">{items.map(([label, value, suffix]) => <div className="artifactCard" key={label}><span>{label}</span><strong>{value}{suffix}</strong></div>)}</div>;
}

export function GenerationProgress({
  phase,
  network,
  error,
  metrics,
}: {
  phase: GenerationPhase;
  network: Network;
  error?: string;
  metrics?: Record<string, number>;
}) {
  const [tick, setTick] = useState(0);
  const [progress, setProgress] = useState<number>(() => rangeForPhase(phase)[0]);
  const messages = useMemo(() => phaseMessages(phase, network), [phase, network]);

  useEffect(() => {
    setTick(0);
    setProgress(rangeForPhase(phase)[0]);
    if (phase === "error") return;
    const messageTimer = window.setInterval(() => setTick((n) => n + 1), 1450);
    const progressTimer = window.setInterval(() => {
      const [, max] = rangeForPhase(phase);
      setProgress((value) => Math.min(max, value + Math.max(1, Math.round((max - value) * 0.12))));
    }, 520);
    return () => { window.clearInterval(messageTimer); window.clearInterval(progressTimer); };
  }, [phase]);

  const message = phase === "error" ? messages[0] : messages[tick % messages.length];
  const agentLabel = phase === "copy"
    ? network === "workit" ? "WorkIt Narrative Agent" : "Influenzr Caption Agent"
    : phase === "avatar" ? "Persona Casting"
      : phase === "scene" ? "Evidence Fabrication"
        : phase === "finishing" ? "Engagement Ops" : "Crisis Comms";

  const steps = network === "workit"
    ? [
      ["Network routing", "Send premise to the WorkIt specialist"],
      ["Manufacture narrative", "Career theater, jargon & peer validation"],
      ["Cast executive", "Fictional professional portrait"],
      ["Stage evidence", "Conference / office / leadership photography"],
      ["Optimize reception", "Reactions, comments & final WorkIt chrome"],
    ]
    : [
      ["Network routing", "Send premise to the Influenzr specialist"],
      ["Curate authenticity", "Caption, vibe & supportive mutuals"],
      ["Cast creator", "Fictional social profile portrait"],
      ["Stage lifestyle", "Golden-hour / travel / wellness photography"],
      ["Optimize reception", "Likes, comments & final Influenzr chrome"],
    ];

  return <div className={`generationStage network-${network} ${phase === "error" ? "generationError" : ""}`} aria-live="polite" aria-busy={phase !== "error"}>
    <div className="progressBrand">{network === "workit" ? <><span className="workitMark">wi</span><b>WorkIt</b></> : <><span className="influenzrMark">◎</span><b>Influenzr</b></>}<span className="syntheticBadge">SIMULATION</span></div>

    <div className="agentPulse"><span className="pulseCore"/><span>{agentLabel}</span><small>{phase === "error" ? "needs adult supervision" : "working irresponsibly hard"}</small></div>
    <h3>{message}</h3>

    {phase === "error" ? <>
      <p className="errorDetail">{error || "Generation failed. Please try again."}</p>
      <div className="errorCode">STATUS: SYNERGY_DEGRADED</div>
    </> : <>
      <div className="progressMeta"><span>Overall progress</span><strong>{progress}%</strong></div>
      <progress max="100" value={progress}>{progress}%</progress>

      <Artifacts network={network} progress={progress} metrics={metrics} />

      <div className="activityLog">
        {steps.map(([title, detail], index) => {
          const status = stepStatus(index, phase);
          return <div className={status === "RUNNING" ? "activeStep" : status === "DONE" ? "completeStep" : "pendingStep"} key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p><b>{title}</b><small>{detail}</small></p>
            <em>{status}</em>
          </div>;
        })}
      </div>
      <p className="progressFootnote">No actual thought leaders or creators were consulted.</p>
    </>}
  </div>;
}
