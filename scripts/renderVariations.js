/**
 * renderVariations.js
 *
 * Renders 3 caption variations of FeedPost (or any composition),
 * uploads each to Cloudinary, and writes the resulting URLs to .env.post
 *
 * Usage:
 *   node scripts/renderVariations.js
 *   node scripts/renderVariations.js --composition ReelsPost
 *
 * Env vars required (.env):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *   CAPTION_1, CAPTION_2, CAPTION_3        ← variation captions
 *   HEADLINE_1, HEADLINE_2, HEADLINE_3     ← optional per-variation headlines
 */

require('dotenv').config();
const { execSync } = require('child_process');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

const COMPOSITION = process.argv.includes('--composition')
  ? process.argv[process.argv.indexOf('--composition') + 1]
  : 'FeedPost';

const OUT_DIR = path.join(__dirname, '../out');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Variation definitions ────────────────────────────────────────────────────
// Captions pulled from env (set these before running, or edit defaults below)

const variations = [
  {
    id: 1,
    props: {
      captionText: process.env.CAPTION_1 || 'Stop boosting posts. Start building strategy. 🚀',
      headline:    process.env.HEADLINE_1 || 'Mediatwist',
    },
  },
  {
    id: 2,
    props: {
      captionText: process.env.CAPTION_2 || 'Your content calendar should run itself. Here\'s how.',
      headline:    process.env.HEADLINE_2 || 'Mediatwist',
    },
  },
  {
    id: 3,
    props: {
      captionText: process.env.CAPTION_3 || '90% of businesses miss this one posting window.',
      headline:    process.env.HEADLINE_3 || 'Mediatwist',
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateEnv() {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ Missing env vars: ${missing.join(', ')}`);
    console.error('   Copy .env.example to .env and fill in your Cloudinary credentials.');
    process.exit(1);
  }
}

async function renderVariation(variation, outFile) {
  const propsJson = JSON.stringify(variation.props);
  const cmd = `npx remotion render src/index.ts ${COMPOSITION} "${outFile}" --props='${propsJson}' --codec h264 --crf 20`;
  console.log(`\n🎬 [Variation ${variation.id}] Rendering ${COMPOSITION}...`);
  console.log(`   Caption: "${variation.props.captionText}"`);
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

async function uploadToCloudinary(filePath, variationId) {
  console.log(`☁️  [Variation ${variationId}] Uploading to Cloudinary...`);
  const result = await cloudinary.uploader.upload(filePath, {
    folder:        'mediatwist/posts',
    resource_type: 'video',
    public_id:     `${COMPOSITION.toLowerCase()}-v${variationId}-${Date.now()}`,
    overwrite:     true,
  });
  console.log(`✅ [Variation ${variationId}] Uploaded: ${result.secure_url}`);
  return result.secure_url;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  validateEnv();

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const urls = {};

  for (const variation of variations) {
    const outFile = path.join(OUT_DIR, `${COMPOSITION.toLowerCase()}-variation-${variation.id}.mp4`);

    await renderVariation(variation, outFile);
    const url = await uploadToCloudinary(outFile, variation.id);
    urls[`REMOTION_POST_${variation.id}_VIDEO_URL`] = url;
  }

  // Write URLs to .env.post so the posting workflow can pick them up
  const envContent = Object.entries(urls)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const envPostPath = path.join(__dirname, '../.env.post');
  fs.writeFileSync(envPostPath, envContent + '\n');

  console.log('\n─────────────────────────────────────────');
  console.log('📝 URLs written to .env.post:');
  console.log(envContent);
  console.log('─────────────────────────────────────────');
  console.log('\n✅ All variations rendered and uploaded.');
  console.log('   Next step: run your posting workflow with these URLs.');
}

main().catch(err => {
  console.error('\n❌ Render pipeline failed:', err.message);
  process.exit(1);
});
