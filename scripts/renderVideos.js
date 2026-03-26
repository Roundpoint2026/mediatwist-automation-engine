/**
 * scripts/renderVideos.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders 3 MP4 videos using Remotion's programmatic renderMedia() API.
 *
 * Pipeline:
 *   1. Calls generatePosts() to get AI post data
 *   2. Calls buildVideoData() to transform each post into Remotion inputProps
 *   3. Bundles the Remotion project once (shared across all 3 renders)
 *   4. Renders each post as an MP4 to /outputs/post-N.mp4
 *
 * Returns: { posts, outputPaths }
 *   posts       — raw AI post data (used downstream for captions)
 *   outputPaths — absolute paths to the 3 rendered MP4 files
 *
 * Usage (standalone):
 *   node scripts/renderVideos.js
 *
 * Usage (programmatic):
 *   const { renderVideos } = require('./scripts/renderVideos');
 *   const { posts, outputPaths } = await renderVideos();
 */

'use strict';

require('dotenv').config();
const path  = require('path');
const fs    = require('fs');

const { bundle }             = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');

const { generatePosts }  = require('../ai/generatePost');
const { buildVideoData } = require('../remotion/buildVideoData');

// ─── Config ───────────────────────────────────────────────────────────────────

const COMPOSITION_ID = process.env.REMOTION_COMPOSITION || 'FeedPost';
const ENTRY_POINT    = path.resolve(__dirname, '../src/index.ts');
const OUTPUT_DIR     = path.resolve(__dirname, '../outputs');

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * Renders all 3 generated posts to MP4 files.
 *
 * @returns {Promise<{ posts: Array, outputPaths: string[] }>}
 */
async function renderVideos() {

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`   Created output directory: ${OUTPUT_DIR}`);
  }

  // ── Step A: Generate posts ────────────────────────────────────────────────
  console.log('   [renderVideos] Generating posts...');
  const posts = await generatePosts();
  console.log(`   [renderVideos] ${posts.length} posts generated.`);

  // ── Step B: Bundle Remotion project (once, shared across renders) ─────────
  console.log(`   [renderVideos] Bundling Remotion entry point...`);
  console.log(`   Entry: ${ENTRY_POINT}`);

  let bundleLocation;
  try {
    bundleLocation = await bundle({
      entryPoint: ENTRY_POINT,
      // Pass through webpack config unchanged
      webpackOverride: (config) => config,
    });
    console.log('   [renderVideos] Bundle complete.');
  } catch (err) {
    throw new Error(`Remotion bundle failed: ${err.message}`);
  }

  // ── Step C: Render each post ──────────────────────────────────────────────
  const outputPaths = [];

  for (let i = 0; i < posts.length; i++) {
    const post       = posts[i];
    const videoData  = buildVideoData(post, i);
    const outputPath = path.join(OUTPUT_DIR, `post-${i + 1}.mp4`);

    console.log(`\n   [renderVideos] Rendering post ${i + 1} of ${posts.length}`);
    console.log(`   Composition: ${COMPOSITION_ID}`);
    console.log(`   Caption: "${videoData.captionText.replace(/\n/g, ' ').slice(0, 70)}..."`);
    console.log(`   Output: ${outputPath}`);

    try {
      // Select the composition and apply inputProps
      const composition = await selectComposition({
        serveUrl:   bundleLocation,
        id:         COMPOSITION_ID,
        inputProps: videoData,
      });

      // Render to MP4
      await renderMedia({
        composition,
        serveUrl:       bundleLocation,
        codec:          'h264',
        outputLocation: outputPath,
        inputProps:     videoData,
        crf:            20,                // quality: lower = better, 20 is a good balance
        onProgress: ({ progress }) => {
          const pct = Math.round(progress * 100);
          process.stdout.write(`\r   Progress: ${'█'.repeat(Math.floor(pct / 5))}${'░'.repeat(20 - Math.floor(pct / 5))} ${pct}%`);
        },
      });

      process.stdout.write('\n');
      console.log(`   ✅ Rendered: ${path.basename(outputPath)}`);
      outputPaths.push(outputPath);

    } catch (err) {
      throw new Error(`Render failed for post ${i + 1}: ${err.message}`);
    }
  }

  return { posts, outputPaths };
}

// ─── Standalone execution ─────────────────────────────────────────────────────

if (require.main === module) {
  renderVideos()
    .then(({ outputPaths }) => {
      console.log('\n✅ All videos rendered:');
      outputPaths.forEach(p => console.log(`   ${p}`));
    })
    .catch(err => {
      console.error('\n❌ Render failed:', err.message);
      process.exit(1);
    });
}

module.exports = { renderVideos };
