#!/usr/bin/env node
/**
 * index.js — Mediatwist Automation Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Master entry point. Routes to the appropriate subsystem based on CLI args.
 *
 * Usage:
 *   node index.js                    # Run daily engine once (generate → render → publish)
 *   node index.js --schedule         # Start cron scheduler (long-running)
 *   node index.js --queue 7          # Queue 7 days of content
 *   node index.js --dry-run          # Generate content only (no publish)
 *   node index.js --content-only     # Generate and print content (no render/publish)
 *   node index.js --stats            # Show engine stats from memory
 *   node index.js --test-post        # Publish a test post to verify API keys
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const args = process.argv.slice(2);

// ─── Route to subsystem ──────────────────────────────────────────────────────

async function main() {
  const DIVIDER = '═'.repeat(62);

  if (args.includes('--schedule')) {
    const { startScheduler } = require('./scheduler');
    startScheduler();
    return; // Long-running — doesn't exit

  } else if (args.includes('--queue')) {
    const { queueDays } = require('./scheduler');
    const idx = args.indexOf('--queue');
    const days = parseInt(args[idx + 1], 10) || 7;
    await queueDays(days);

  } else if (args.includes('--content-only')) {
    const { generateDailyContent } = require('./ai/contentEngine');
    console.log(`\n${DIVIDER}`);
    console.log(' 📝  CONTENT PREVIEW MODE');
    console.log(DIVIDER);
    const content = await generateDailyContent();
    ['facebook', 'instagram', 'linkedin'].forEach(platform => {
      const post = content[platform];
      if (!post) return;
      console.log(`\n─── ${platform.toUpperCase()} ───────────────────────────────`);
      console.log(`Category: ${post.category}`);
      console.log(`Composition: ${post.compositionHint}`);
      console.log(`Hook: ${post.hook}`);
      console.log(`\n${post.caption}`);
    });
    if (content.metadata) {
      console.log(`\n─── METADATA ───────────────────────────────`);
      console.log(`Generated: ${content.metadata.timestamp}`);
      console.log(`Category: ${content.metadata.category}`);
    }
    console.log(`\n${DIVIDER}\n`);

  } else if (args.includes('--stats')) {
    const memory = require('./memory/store');
    const stats = memory.getStats();
    const recent = memory.getRecentPosts(7);
    console.log(`\n${DIVIDER}`);
    console.log(' 📊  ENGINE STATS');
    console.log(DIVIDER);
    console.log(` Total posts:    ${stats.totalPosts}`);
    console.log(` Last run:       ${stats.lastRunAt || 'never'}`);
    console.log(` By platform:`);
    Object.entries(stats.byPlatform).forEach(([p, c]) => {
      console.log(`   ${p}: ${c}`);
    });
    console.log(` By category:`);
    Object.entries(stats.byCategory).forEach(([cat, c]) => {
      console.log(`   ${cat}: ${c}`);
    });
    console.log(` Recent (7d):    ${recent.length} posts`);
    console.log(DIVIDER);

  } else if (args.includes('--test-post')) {
    const { generateDailyContent } = require('./ai/contentEngine');
    const { publishToAll } = require('./publishers');
    const memory = require('./memory/store');

    console.log(`\n${DIVIDER}`);
    console.log(' 🧪  TEST POST MODE');
    console.log(DIVIDER);

    const content = await generateDailyContent();
    const testCaption = `[TEST] ${content.facebook.caption}`;
    const imageUrl = 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=1080';

    console.log(`\n Caption preview: "${testCaption.slice(0, 80)}..."`);
    console.log(` Using test image: ${imageUrl}\n`);

    // Override content captions with [TEST] prefix
    Object.keys(content).forEach(platform => {
      content[platform].caption = `[TEST] ${content[platform].caption}`;
    });

    const results = await publishToAll(content, imageUrl);

    Object.entries(results).forEach(([platform, result]) => {
      if (result && result.success) {
        console.log(` ✅  [${platform}] Published`);
        memory.recordPost({
          platform,
          category: content[platform].category,
          hook: content[platform].hook,
          caption: content[platform].caption,
        });
      } else {
        console.log(` ❌  [${platform}] ${result?.error || 'Failed'}`);
      }
    });

    console.log(`\n${DIVIDER}\n`);

  } else {
    // Default: run the full daily engine once
    const { executeEngine } = require('./scheduler');
    const dryRun = args.includes('--dry-run');
    await executeEngine({ dryRun });
  }
}

// ─── Execute ──────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error(`\n ❌  Fatal error: ${err.message}`);
  if (process.env.DEBUG === 'true') console.error(err.stack);
  process.exit(1);
});
