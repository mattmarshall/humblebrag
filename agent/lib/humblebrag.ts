import { z } from "zod";

const commentSchema = z.object({
  name: z.string().min(1),
  text: z.string().min(1),
});

const commonPostSchema = z.object({
  personaId: z.string().min(1),
  name: z.string().min(1),
  handle: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  body: z.string().min(1),
  hashtags: z.array(z.string().min(1)).length(4),
  award: z.string().min(1),
  event: z.string().min(1),
  reactions: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  reposts: z.number().int().nonnegative(),
  commentsPreview: z.array(commentSchema).length(3),
  appearance: z.string().min(1),
  avatarPrompt: z.string().min(1),
  postImagePrompt: z.string().min(1),
  imageSeed: z.number().int().min(1).max(4_294_967_294),
});

export const workitPostSchema = commonPostSchema.extend({
  network: z.literal("workit"),
  metrics: z.object({
    humilityIndex: z.number().int().nonnegative(),
    buzzwordsInserted: z.number().int().nonnegative(),
    authenticityRemovedPct: z.number().int().min(0).max(100),
    phantomRecruitersAlerted: z.number().int().nonnegative(),
  }),
});

export const influenzrPostSchema = commonPostSchema.extend({
  network: z.literal("influenzr"),
  metrics: z.object({
    mainCharacterEnergy: z.number().int().nonnegative(),
    aestheticSaturationPct: z.number().int().min(0).max(100),
    casualnessSimulationPct: z.number().int().min(0).max(100),
    brandCollabsManifested: z.number().int().nonnegative(),
  }),
});

export const humblebragPostSchema = z.discriminatedUnion("network", [
  workitPostSchema,
  influenzrPostSchema,
]);

export type HumblebragPost = z.infer<typeof humblebragPostSchema>;
