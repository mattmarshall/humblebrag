<p align="center">
  <img src="./public/brand/readme-hero.png" alt="humblebrag — Bragging rights. Humbly." width="100%" />
</p>

<p align="center">
  <strong>Professional and lifestyle self-importance, automated.</strong>
</p>

Synthetic social achievement theater: an embeddable Next.js + React generator backed by Vercel eve agents and AWS Bedrock.

The identity pairs a self-satisfied gentleman mascot with deep navy, electric periwinkle, and a restrained flash of gold: witty and relatable, confident but not cocky, and unapologetically dev-friendly.

## Brand assets

- `public/brand/humblebrag-mark-512.png` — transparent, web-optimized mascot mark
- `public/brand/readme-hero.png` — repository and social hero
- `public/favicon.ico`, `public/icon.png`, and `public/apple-touch-icon.png` — browser and device icons

## Networks

- **WorkIt** — fictional professional-network parody. Dedicated `workit_writer` eve subagent generates corporate career theater.
- **Influenzr** — fictional image-first lifestyle-network parody. Dedicated `influenzr_writer` eve subagent generates curated-authenticity lifestyle posts.

The two networks intentionally have separate agent instructions, persona vocabularies, captions, comments, metrics, image briefs, and React presentation skins.

## Generation pipeline

1. Root eve agent routes the premise to the network-specific subagent.
2. Specialist returns structured JSON for a fictional persona/post.
3. Bedrock Stable Image Ultra creates a fictional avatar.
4. Stable Image Ultra creates the post scene, using the avatar as an image-to-image identity reference when possible.
5. React renders the final post in the selected parody network skin.

The progress UI exposes humorous generated artifacts while the real pipeline advances through copy, avatar, scene, and finishing stages.

## AWS / Vercel configuration

Node 24+ is required.

```text
AWS_ROLE_ARN=arn:aws:iam::658367926314:role/humblebrag-vercel-production
BEDROCK_REGION=us-west-2
BEDROCK_TEXT_MODEL=us.amazon.nova-pro-v1:0
BEDROCK_TEXT_FALLBACK_MODEL=us.amazon.nova-lite-v1:0
BEDROCK_IMAGE_MODEL=stability.stable-image-ultra-v1:1
```

**Important:** do not use `AWS_REGION` as the application Bedrock region. Vercel Functions populate `AWS_REGION` based on the Function's execution location. The app deliberately uses `BEDROCK_REGION` and defaults it to `us-west-2`.

## Embed

```html
<script
  async
  src="https://humblebrag-hq.vercel.app/embed.js"
  data-network="workit"
  data-persona="startup-founder"
  data-prompt="A founder announcing a tiny podcast appearance as if it were a Nobel Prize">
</script>
```

The embed loader creates an iframe pointed at `/embed` and auto-generates the requested post.

## Safety / parody boundaries

All generated people, companies, brands, events, and comments are fictional. Image prompts explicitly exclude real celebrities/public figures, logos, and readable brand marks. The UI uses original parody names and marks rather than copying official trademarks.
