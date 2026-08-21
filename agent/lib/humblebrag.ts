import { z } from "zod";

export const intensitySchema = z.enum(["subtle", "plausible", "nuclear"]);

export const commentSchema = z.object({
  personId: z.string().min(1),
  text: z.string().min(1),
});

export const rosterPersonSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["author", "commenter"]),
  name: z.string().min(1),
  handle: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  appearance: z.string().min(1),
  avatarPrompt: z.string().min(1),
});

export const rosterSchema = z.object({
  authorId: z.string().min(1),
  roster: z.array(rosterPersonSchema).length(4),
});

export const personaSchema = z.object({
  personaId: z.string().min(1),
  name: z.string().min(1),
  handle: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  appearance: z.string().min(1),
});

export const copySchema = z.object({
  body: z.string().min(1),
  hashtags: z.array(z.string().min(1)).length(4),
  award: z.string().min(1),
  event: z.string().min(1),
  commentsPreview: z.array(commentSchema).length(3),
});

export const visualBriefSchema = z.object({
  avatarPrompt: z.string().min(1),
  postImagePrompt: z.string().min(1),
  imageSeed: z.number().int().min(1).max(4_294_967_294),
});

export const engagementSchema = z.object({
  reactions: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  reposts: z.number().int().nonnegative(),
});

export const generationBriefSchema = z.object({
  network: z.enum(["workit", "influenzr"]),
  persona: z.string().min(1),
  intensity: intensitySchema,
  premise: z.string().min(1),
});

const commonPostSchema = personaSchema
  .merge(copySchema)
  .merge(rosterSchema)
  .merge(visualBriefSchema)
  .merge(engagementSchema);

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
