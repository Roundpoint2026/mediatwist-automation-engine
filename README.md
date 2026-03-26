# mediatwist-automation-engine

Remotion video compositions + automated render/upload pipeline for Mediatwist social posts.

---

## Compositions

| ID | Size | Duration | Best for |
|----|------|----------|----------|
| `FeedPost` | 1080×1080 | 10s | Facebook & Instagram feed |
| `ReelsPost` | 1080×1920 | 15s | Facebook & Instagram Reels / Stories |
| `BrandedCaption` | 1080×1080 | 8s | Quote/caption-forward posts |

All compositions accept `captionText: string` as a required prop — so the render script can generate 3 variations automatically from a single command.

---

## Quick Start

```bash
npm install

# Preview all compositions in browser
npm run studio

# Render a single video
npm run render:feed
npm run render:reels
npm run render:caption

# Render 3 caption variations + upload to Cloudinary
npm run render:variations
```

---

## Render 3 Variations → Cloudinary

1. Copy `.env.example` to `.env`
2. Fill in your Cloudinary credentials
3. Set `CAPTION_1`, `CAPTION_2`, `CAPTION_3` to your post copy
4. Run:

```bash
node scripts/renderVariations.js
```

This will:
- Render `FeedPost` 3 times with different caption props
- Upload each to Cloudinary under `mediatwist/posts/`
- Write the resulting URLs to `.env.post`:

```
REMOTION_POST_1_VIDEO_URL=https://res.cloudinary.com/...
REMOTION_POST_2_VIDEO_URL=https://res.cloudinary.com/...
REMOTION_POST_3_VIDEO_URL=https://res.cloudinary.com/...
```

To render a different composition (e.g. Reels):
```bash
node scripts/renderVariations.js --composition ReelsPost
```

---

## Render a Single Frame (Thumbnail)

```bash
npx remotion still src/index.ts FeedPost out/thumbnail.png --frame 60 \
  --props='{"captionText":"Your caption here"}'
```

---

## Props Reference

### FeedPost
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `captionText` | `string` | required | Main body copy |
| `headline` | `string` | `"Mediatwist"` | Bold headline |
| `subText` | `string` | — | Supporting line below caption |
| `brandColor` | `string` | `#6C63FF` | Override accent color |

### ReelsPost
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `captionText` | `string` | required | Main body copy |
| `headline` | `string` | `"Did you know?"` | Hook at top |
| `ctaText` | `string` | `"Follow for more → @mediatwist"` | Bottom CTA |
| `brandColor` | `string` | `#6C63FF` | Override accent color |

### BrandedCaption
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `captionText` | `string` | required | Quote or bold statement |
| `attribution` | `string` | — | Attribution line below |
| `brandColor` | `string` | `#FF6B6B` | Override accent color |

---

## Brand Colors

```ts
primary:  '#6C63FF'   // purple — main brand
accent:   '#FF6B6B'   // red-pink — hooks & emphasis
dark:     '#0f0f1a'   // background
success:  '#4ECDC4'   // teal — stats & wins
```

---

## Project Structure

```
mediatwist-automation-engine/
├── src/
│   ├── index.ts                    ← Remotion entry point
│   ├── Root.tsx                    ← All compositions registered here
│   ├── lib/
│   │   └── colors.ts               ← Brand color palette
│   └── compositions/
│       ├── FeedPost.tsx            ← 1080×1080 feed video
│       ├── ReelsPost.tsx           ← 1080×1920 vertical video
│       └── BrandedCaption.tsx      ← 1080×1080 quote/caption video
├── scripts/
│   └── renderVariations.js         ← Render 3 variants + upload to Cloudinary
├── public/                         ← Static assets (logos, images)
├── out/                            ← Rendered video output (gitignored)
├── remotion.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```
