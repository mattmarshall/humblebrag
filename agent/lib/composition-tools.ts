import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  copySchema,
  engagementSchema,
  influenzrPostSchema,
  intensitySchema,
  personaSchema,
  visualBriefSchema,
  workitPostSchema,
} from "./humblebrag";

type Network = "workit" | "influenzr";

export function composePersonaTool(network: Network) {
  return defineTool({
    description: `Compose the fictional adult persona for a ${network} post. Call once before writing copy or visual prompts.`,
    inputSchema: personaSchema,
    outputSchema: personaSchema,
    execute(persona) {
      return persona;
    },
  });
}

export function composePostCopyTool(network: Network) {
  return defineTool({
    description: `Compose native ${network} post copy, exactly four hashtags, and exactly three fictional comments. Call once after composing the persona.`,
    inputSchema: copySchema,
    outputSchema: copySchema,
    execute(copy) {
      return {
        ...copy,
        hashtags: copy.hashtags.map((tag) => tag.replace(/^#+/, "").trim()),
      };
    },
  });
}

export function composeVisualBriefTool(network: Network) {
  return defineTool({
    description: `Compose the avatar and post-image prompts for the same fictional ${network} persona. Both prompts must repeat the persona's distinctive appearance and exclude text, logos, watermarks, and real people.`,
    inputSchema: visualBriefSchema,
    outputSchema: visualBriefSchema,
    execute(brief) {
      return brief;
    },
  });
}

const calibrationInputSchema = z.object({
  intensity: intensitySchema,
  exuberance: z.number().int().min(0).max(100),
});

const workitCalibrationSchema = engagementSchema.extend({
  metrics: workitPostSchema.shape.metrics,
});

const influenzrCalibrationSchema = engagementSchema.extend({
  metrics: influenzrPostSchema.shape.metrics,
});

export function calibrateMetricsTool(network: Network) {
  const outputSchema = network === "workit" ? workitCalibrationSchema : influenzrCalibrationSchema;
  return defineTool({
    description: `Generate internally consistent ${network} engagement and satire metrics from intensity. Call once; use the returned numbers unchanged.`,
    inputSchema: calibrationInputSchema,
    outputSchema,
    execute({ intensity, exuberance }) {
      const level = intensity === "subtle" ? 1 : intensity === "plausible" ? 2 : 3;
      const lift = level * 1_000 + exuberance * 37;
      if (network === "workit") {
        return {
          reactions: 3_800 + lift,
          comments: 120 + level * 90 + exuberance * 3,
          reposts: 18 + level * 21 + Math.floor(exuberance / 3),
          metrics: {
            humilityIndex: Math.max(1, 35 - level * 8 - Math.floor(exuberance / 10)),
            buzzwordsInserted: 4 + level * 3 + Math.floor(exuberance / 20),
            authenticityRemovedPct: Math.min(100, 38 + level * 16 + Math.floor(exuberance / 5)),
            phantomRecruitersAlerted: 9 + level * 12 + Math.floor(exuberance / 4),
          },
        };
      }
      return {
        reactions: 9_500 + lift * 3,
        comments: 280 + level * 170 + exuberance * 5,
        reposts: 45 + level * 42 + exuberance,
        metrics: {
          mainCharacterEnergy: Math.min(100, 44 + level * 15 + Math.floor(exuberance / 8)),
          aestheticSaturationPct: Math.min(100, 48 + level * 13 + Math.floor(exuberance / 9)),
          casualnessSimulationPct: Math.min(100, 52 + level * 14 + Math.floor(exuberance / 10)),
          brandCollabsManifested: level + Math.floor(exuberance / 14),
        },
      };
    },
  });
}

export function assembleHumblebragTool(network: Network) {
  const schema = network === "workit" ? workitPostSchema : influenzrPostSchema;
  return defineTool({
    description: `Assemble and validate the complete ${network} post from the outputs of the persona, copy, visual, and metrics tools. Call exactly once, then return its output unchanged.`,
    inputSchema: schema,
    outputSchema: schema,
    execute(post) {
      return post;
    },
  });
}
