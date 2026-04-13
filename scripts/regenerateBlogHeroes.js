#!/usr/bin/env node
/**
 * regenerateBlogHeroes.js — One-time script to regenerate all blog hero images
 * with unique AI-generated art using the new style variant system.
 *
 * Replaces the old duplicate ~9KB ImageMagick fallbacks with proper
 * Gemini AI-generated custom art, each with a unique visual style.
 *
 * Usage:
 *   node scripts/regenerateBlogHeroes.js              # Regenerate all
 *   node scripts/regenerateBlogHeroes.js --dry-run    # Preview styles only
 *   node scripts/regenerateBlogHeroes.js --article s1 # Single article
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const {
  generateBlogHero,
  SEED_ARTICLES,
  STYLE_VARIANTS,
  loadImageHistory,
  pickFreshStyleVariant,
} = require('../ai/blogImageEngine');

const OUTPUT_DIR = path.resolve(__dirname, '../outputs/blog-heroes');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const articleArg = args.includes('--article') ? args[args.indexOf('--article') + 1] : null;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Blog Hero Regeneration — Unique AI Art for Every Post  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`Style variants available: ${STYLE_VARIANTS.length}`);
  console.log(`Articles to process: ${articleArg ? 1 : SEED_ARTICLES.length}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'LIVE (generating images)'}\n`);

  const articles = articleArg
    ? SEED_ARTICLES.filter(a => a.id === articleArg || a.title.toLowerCase().includes(articleArg.toLowerCase()))
    : SEED_ARTICLES;

  if (articles.length === 0) {
    console.error(`No articles found matching "${articleArg}"`);
    console.log('Available:', SEED_ARTICLES.map(a => `${a.id}: ${a.title}`).join('\n  '));
    process.exit(1);
  }

  const results = [];
  for (const article of articles) {
    const style = pickFreshStyleVariant();
    console.log(`\n🎨 [${article.id}] "${article.title}"`);
    console.log(`   Style: ${style.id} — ${style.desc.substring(0, 70)}...`);

    if (dryRun) {
      console.log('   ⏭  Skipped (dry run)');
      results.push({ article: article.id, style: style.id, status: 'skipped' });
      continue;
    }

    try {
      const result = await generateBlogHero(article, { outputDir: OUTPUT_DIR });
      if (result?.filePath) {
        console.log(`   ✅ Generated: ${path.basename(result.filePath)} (source: ${result.source})`);
        results.push({ article: article.id, style: result.styleVariant, status: 'success', file: path.basename(result.filePath) });
      } else {
        console.log('   ❌ All strategies failed');
        results.push({ article: article.id, style: style.id, status: 'failed' });
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      results.push({ article: article.id, style: style.id, status: 'error', error: err.message });
    }

    // Small delay between API calls
    if (articles.indexOf(article) < articles.length - 1) {
      console.log('   ⏳ Waiting 3s before next...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Results:');
  const success = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
  console.log(`  ✅ ${success} generated | ❌ ${failed} failed | ⏭ ${results.filter(r => r.status === 'skipped').length} skipped`);

  const history = loadImageHistory();
  console.log(`  📊 Total images in history: ${history.stats.totalGenerated}`);
  console.log(`  🎨 Style variants used: ${(history.usedStyleVariants || []).length}/${STYLE_VARIANTS.length}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
