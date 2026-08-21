import { Generator } from "../../components/Generator";
import type { Network } from "../../components/HumblebragCard";

export default async function Embed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawNetwork = Array.isArray(params.network) ? params.network[0] : params.network;
  const network: Network = rawNetwork === "influenzr" ? "influenzr" : "workit";
  const prompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;
  const persona = Array.isArray(params.persona) ? params.persona[0] : params.persona;
  return <main className="embedShell"><Generator compact initialNetwork={network} initialPrompt={prompt} initialPersona={persona || "random"} autoGenerate={Boolean(prompt)} /></main>;
}
