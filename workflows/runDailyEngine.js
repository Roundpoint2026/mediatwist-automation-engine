/**
 * workflows/runDailyEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * MASTER ENTRY POINT — Mediatwist AI Content Engine
 *
 * Runs the full end-to-end pipeline:
 *
 *   STEP 1  generatePosts()          AI generates 3 posts (caption + scene data)
 *   STEP 2  renderVideos()           Remotion renders 3 MP4s to /outputs/
 *   STEP 3  uploadRenderedVideos()   Each MP4 uploaded to Cloudinary → 3 URLs
 *   STEP 4  postFromRenderedVideos() Each URL + caption posted to Facebook
 *
 * Usage:
 *   node workflows/runDailyEngine.js
 *
 * Required .env:
 *   PAGE_ID                    Facebook Page ID
 *   ACCESS_TOKEN               Facebook Page access token
 *   CLOUDINARY_CLOUD_NAME      Cloudinary cloud name
 *   CLOUDINARY_API_KEY         Cloudinary API key
 *   CLOUDINARY_API_SECRET      Cloudinary API secret
 *
 * Optional .env:
 *   REMOTION_COMPOSITION       Composition ID to render (default: FeedPost)
 *   DEBUG=true                 Print full stack traces on error
 */

'use strict';

require('dotenv').config();

const { renderVideos }           = require('../scripts/renderVideos');
const { uploadRenderedVideos }   = require('./uploadRenderedVideos');
const { postFromRenderedVideos } = require('./postFromRenderedVideos');

// ─── Logging helpers ──────────────────────────────────────────────────────────

const DIVIDER      = '─'.repeat(62);
const THICK_DIVIDER = '═'.repeat(62);

function logStep(n, label) {
  console.log(`\n${DIVIDER}`);
  console.log(` STEP ${n}  ${label}`);
  console.log(DIVIDER);
}

function logDone(msg) { console.log(`\n ✅  ${msg}`); }
function logFail(n, err) {
  console.error(`\n ❌  STEP ${n} FAILED — ${err.message}`);
  if (process.env.DEBUG === 'true') console.error(err.stack);
}

// ─── Env validation ───────────────────────────────────────────────────────────

function validateEnv() {
  const required = [
    'PAGE_ID',
    'ACCESS_TOKEN',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('\n ❌  Missing required environment variables:');
    missing.forEach(k => console.error(`      ${k}`));
    console.error('\n    Copy .env.example to .env and fill in the values.\n');
    process.exit(1);
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function runDailyEngine() {
  console.log(`\n${THICK_DIVIDER}`);
  console.log(' 🚀  MEDIATWIST DAILY CONTENT ENGINE');
  console.log(`     ${new Date().toISOString()}`);
  console.log(THICK_DIVIDER);

  validateEnv();

  let posts, outputPaths, uploadResults, postResults;

  // ── STEP 1 + 2: Generate posts & render videos ────────────────────────────
  // renderVideos() calls generatePosts() internally, so steps 1 & 2 run together.
  logStep('1–2', 'Generate AI Posts + Render Videos');
  try {
    const result = await renderVideos();
    posts       = result.posts;
    outputPaths = result.outputPaths;
    logDone(`${posts.length} posts generated, ${outputPaths.length} videos rendered`);
    outputPaths.forEach((p, i) => console.log(`      post-${i + 1}.mp4 → ${p}`));
  } catch (err) {
    logFail('1–2', err);
    process.exit(1);
  }

  // ── STEP 3: Upload to Cloudinary ──────────────────────────────────────────
  logStep(3, 'Upload Videos to Cloudinary');
  try {
    uploadResults = await uploadRenderedVideos(outputPaths);
    logDone(`${uploadResults.length} videos uploaded`);
    uploadResults.forEach(r => console.log(`      Post ${r.postIndex}: ${r.url}`));
  } catch (err) {
    logFail(3, err);
    process.exit(1);
  }

  // ── STEP 4: Post to Facebook ──────────────────────────────────────────────
  logStep(4, 'Post to Facebook');
  try {
    postResults = await postFromRenderedVideos(uploadResults, posts);
  } catch (err) {
    logFail(4, err);
    process.exit(1);
  }

  const succeeded = postResults.filter(r => r.success).length;
  const failed    = postResults.filter(r => !r.success).length;
  logDone(`${succeeded}/${postResults.length} posts published to Facebook`);
  if (failed > 0) {
    console.warn(`\n ⚠️   ${failed} post(s) failed:`);
    postResults.filter(r => !r.success).forEach(r =>
      console.warn(`      Post ${r.postIndex}: ${r.error}`)
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${THICK_DIVIDER}`);
  console.log(' 🎉  DAILY ENGINE COMPLETE');
  console.log(THICK_DIVIDER);
  console.log(` Posts generated : ${posts.length}`);
  console.log(` Videos rendered : ${outputPaths.length}`);
  console.log(` Videos uploaded : ${uploadResults.length}`);
  console.log(` Facebook posts  : ${succeeded} succeeded, ${failed} failed`);
  console.log(` Finished at     : ${new Date().toISOString()}`);
  console.log(THICK_DIVIDER + '\n');

  // Exit with error code if any Facebook posts failed
  if (failed > 0) process.exit(1);
}

runDailyEngine();
