/**
 * scheduler/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cron-based scheduler for the Mediatwist daily content engine.
 *
 * Supports:
 *   - Daily automated execution via cron expression
 *   - Queue mode: pre-generate content for multiple days
 *   - Manual trigger via CLI
 *   - Dry run mode for testing
 *
 * Usage:
 *   node scheduler/index.js                 # Start cron scheduler
 *   node scheduler/index.js --run-now       # Execute immediately
 *   node scheduler/index.js --queue 7       # Queue 7 days of content
 *   node scheduler/index.js --dry-run       # Generate but don't publish
 *
 * Required .env:
 *   CRON_SCHEDULE    (default: "0 9 * * *" — daily at 9 AM)
 *   TZ               (default: America/New_York)
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const path = require('path');
const fs   = require('fs');

const config = require('../config/engine');

// ─── Minimal cron parser (no external deps) ──────────────────────────────────

/**
 * Parse a 5-field cron expression and check if current time matches.
 * Fields: minute hour dayOfMonth month dayOfWeek
 */
function cronMatches(expression, date) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Invalid cron: ${expression}`);

  const [minF, hourF, domF, monF, dowF] = fields;
  const checks = [
    { field: minF,  value: date.getMinutes() },
    { field: hourF, value: date.getHours() },
    { field: domF,  value: date.getDate() },
    { field: monF,  value: date.getMonth() + 1 },
    { field: dowF,  value: date.getDay() },
  ];

  return checks.every(({ field, value }) => {
    if (field === '*') return true;
    // Handle ranges (1-5), lists (1,3,5), and steps (*/2)
    return field.split(',').some(part => {
      if (part.includes('/')) {
        const [range, step] = part.split('/');
        const s = parseInt(step, 10);
        if (range === '*') return value % s === 0;
        const [start] = range.split('-').map(Number);
        return value >= start && (value - start) % s === 0;
      }
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        return value >= start && value <= end;
      }
      return parseInt(part, 10) === value;
    });
  });
}

// ─── Queue management ─────────────────────────────────────────────────────────

const QUEUE_PATH = path.resolve(__dirname, 'queue.json');

function loadQueue() {
  try {
    if (!fs.existsSync(QUEUE_PATH)) return [];
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  } catch { return []; }
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf-8');
}

function addToQueue(entry) {
  const queue = loadQueue();
  queue.push({ ...entry, queuedAt: new Date().toISOString(), status: 'pending' });
  saveQueue(queue);
}

function getNextQueued() {
  const queue = loadQueue();
  const next = queue.find(e => e.status === 'pending');
  return next || null;
}

function markQueuedComplete(queuedAt) {
  const queue = loadQueue();
  const idx = queue.findIndex(e => e.queuedAt === queuedAt);
  if (idx !== -1) {
    queue[idx].status = 'completed';
    queue[idx].completedAt = new Date().toISOString();
  }
  saveQueue(queue);
}

// ─── Engine execution ─────────────────────────────────────────────────────────

async function executeEngine(options = {}) {
  const { dryRun = false } = options;

  const DIVIDER = '═'.repeat(62);
  console.log(`\n${DIVIDER}`);
  console.log(` 🚀  MEDIATWIST DAILY ENGINE ${dryRun ? '(DRY RUN)' : ''}`);
  console.log(`     ${new Date().toISOString()}`);
  console.log(DIVIDER);

  try {
    // Step 0: Pre-flight token health check (skip for dry-run — no publishing needed)
    if (!dryRun) {
      const { preflightTokenCheck } = require('../publishers/tokenManager');
      console.log('\n 🔑  Checking Meta token...');
      const tokenStatus = await preflightTokenCheck();

      if (!tokenStatus.valid) {
        console.error(` ❌  Token INVALID: ${tokenStatus.error}`);
        console.error('     Fix: Get a new token from Graph Explorer, then run:');
        console.error('       npm run token:exchange && npm run token:page');
        throw new Error(`Meta token invalid: ${tokenStatus.error}`);
      }

      if (tokenStatus.warning) {
        console.warn(` ⚠️  ${tokenStatus.warning}`);
      } else if (tokenStatus.isPageToken) {
        console.log(' ✅  Token valid (never-expiring page token)');
      } else {
        console.log(` ✅  Token valid (expires: ${tokenStatus.expiresAt}, ${tokenStatus.daysRemaining} days remaining)`);
      }
    } else {
      console.log('\n 🔑  Skipping token check (dry run)');
    }

    // Step 1: Generate content
    const { generateDailyContent } = require('../ai/contentEngine');
    console.log('\n ⏳  Generating content...');
    const content = await generateDailyContent();
    const platforms = ['facebook', 'instagram', 'linkedin'];
    console.log(` ✅  Content generated for ${platforms.length} platforms`);

    platforms.forEach(platform => {
      const post = content[platform];
      if (post) console.log(`     [${platform}] ${post.category} — "${post.hook.slice(0, 60)}..."`);
    });

    if (dryRun) {
      console.log('\n 🏁  DRY RUN — skipping render and publish');
      console.log(DIVIDER);
      return { content, rendered: null, published: null };
    }

    // Step 2: Render visual asset (Canva ↔ Remotion routing)
    console.log('\n ⏳  Rendering visual asset...');
    let mediaUrl = null;
    let outputPath = null;
    let visualEngine = 'unknown';

    const { getVisualEngine, renderWithCanva } = require('../ai/canvaEngine');
    const engineMode = getVisualEngine();
    console.log(`     Visual engine mode: ${engineMode}`);

    // Determine render order based on engine mode
    const tryCanva = async () => {
      console.log('     Trying Canva...');
      const canvaResult = await renderWithCanva(content.facebook, {
        format: mapCompositionHint(content.facebook.compositionHint) === 'ReelsPost' ? 'reels' : 'feed',
      });
      if (canvaResult) {
        outputPath = canvaResult.filePath;
        visualEngine = `canva (${canvaResult.source})`;
        console.log(` ✅  Canva ${canvaResult.source}: ${path.basename(outputPath)}`);
        return true;
      }
      return false;
    };

    const tryRemotion = async () => {
      console.log('     Trying Remotion...');
      const { bundle }                          = require('@remotion/bundler');
      const { renderMedia, selectComposition }  = require('@remotion/renderer');
      const entryPoint = path.resolve(__dirname, '../src/index.ts');
      const outputDir  = path.resolve(__dirname, '../outputs');

      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const compositionId = mapCompositionHint(content.facebook.compositionHint);
      const inputProps = {
        captionText: content.facebook.hook,
        headline:    content.facebook.hook,
        subText:     content.facebook.body.split('\n')[0],
        ctaText:     content.facebook.cta,
        brandColor:  config.brand.colors.primary,
      };

      const bundleLocation = await bundle({ entryPoint, webpackOverride: c => c });
      const composition = await selectComposition({
        serveUrl: bundleLocation, id: compositionId, inputProps,
      });

      outputPath = path.join(outputDir, `daily-${Date.now()}.mp4`);
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: config.visual.codec,
        outputLocation: outputPath,
        inputProps,
        crf: config.visual.crf,
        onProgress: ({ progress }) => {
          const pct = Math.round(progress * 100);
          process.stdout.write(`\r     Rendering: ${'█'.repeat(Math.floor(pct / 5))}${'░'.repeat(20 - Math.floor(pct / 5))} ${pct}%`);
        },
      });
      process.stdout.write('\n');
      visualEngine = 'remotion';
      console.log(` ✅  Remotion rendered: ${path.basename(outputPath)}`);
      return true;
    };

    try {
      let rendered = false;

      if (engineMode === 'canva') {
        // Canva only — no fallback
        rendered = await tryCanva();
      } else if (engineMode === 'remotion') {
        // Remotion only — no fallback
        rendered = await tryRemotion();
      } else if (engineMode === 'canva-first') {
        // Try Canva first, fall back to Remotion
        rendered = await tryCanva();
        if (!rendered) {
          console.log('     Canva unavailable — falling back to Remotion...');
          rendered = await tryRemotion();
        }
      } else if (engineMode === 'remotion-first') {
        // Try Remotion first, fall back to Canva
        try {
          rendered = await tryRemotion();
        } catch (remotionErr) {
          console.warn(`     Remotion failed: ${remotionErr.message}`);
          console.log('     Falling back to Canva...');
          rendered = await tryCanva();
        }
      }

      if (!rendered) {
        throw new Error('All visual engines failed');
      }

      // Step 3: Upload to Cloudinary
      const { uploadMedia } = require('../publishers/cloudinary');
      console.log('\n ⏳  Uploading to Cloudinary...');
      mediaUrl = await uploadMedia(outputPath);
      console.log(` ✅  Uploaded: ${mediaUrl} (via ${visualEngine})`);

    } catch (renderErr) {
      console.warn(` ⚠️  Render/upload failed: ${renderErr.message}`);
      console.warn('     Falling back to image-only posting...');
      // Use Unsplash fallback image
      mediaUrl = content.facebook.imageUrl || 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=1080';
      visualEngine = 'fallback-image';
    }

    // Step 4: Publish to all platforms
    console.log('\n ⏳  Publishing to platforms...');
    const { publishToAll } = require('../publishers');

    // Bridge content engine format → publisher format
    const postPayload = {
      caption: content.facebook.caption,
      imageUrl: mediaUrl,
      videoUrl: mediaUrl && mediaUrl.includes('.mp4') ? mediaUrl : null,
      overrides: {
        facebook:  content.facebook.caption,
        instagram: content.instagram.caption,
        linkedin:  content.linkedin.caption,
      },
    };

    const results = await publishToAll(postPayload, mediaUrl);

    const succeeded = Object.values(results).filter(r => r && r.success).length;
    const total = Object.keys(results).length;
    console.log(` ✅  Published: ${succeeded}/${total} platforms`);

    // Step 5: Record in memory
    const memory = require('../memory/store');
    Object.entries(results).forEach(([platform, result]) => {
      if (result && result.success) {
        const post = content[platform];
        memory.recordPost({
          platform,
          category: post.category,
          hook: post.hook,
          caption: post.caption,
          compositionId: post.compositionHint,
          mediaUrl,
          visualEngine, // Track which engine was used
        });
      }
    });

    console.log(`\n${DIVIDER}`);
    console.log(` 🎉  DAILY ENGINE COMPLETE (visual: ${visualEngine})`);
    console.log(DIVIDER);

    return { content, outputPath, mediaUrl, visualEngine, results };

  } catch (err) {
    console.error(`\n ❌  Engine failed: ${err.message}`);
    if (process.env.DEBUG === 'true') console.error(err.stack);
    throw err;
  }
}

/**
 * Map a composition hint from the content engine to a Remotion composition ID.
 */
function mapCompositionHint(hint) {
  const MAP = {
    'kinetic-typography':    'KineticType',
    'bold-text-motion':      'KineticType',
    'futuristic-glitch':     'KineticType',
    'animated-stat-reveal':  'KineticType',
    'data-dashboard':        'DataDashboard',
    'dynamic-dashboard':     'DataDashboard',
    'philosophical-typography': 'BrandedCaption',
    'elegant-minimal':       'BrandedCaption',
    'narrative-flow':        'BrandedCaption',
    'exponential-curve':     'FeedPost',
    'insight-animation':     'FeedPost',
    'authority-visual':      'FeedPost',
    'radar-scanning':        'ReelsPost',
    'myth-buster':           'KineticType',
    'growth-metrics':        'DataDashboard',
    'signal-tracking':       'FeedPost',
    'content-blueprint':     'BrandedCaption',
  };
  return MAP[hint] || config.visual.defaultComposition;
}

// ─── Queue mode: pre-generate content for multiple days ──────────────────────

async function queueDays(numDays) {
  const { generateDailyContent } = require('../ai/contentEngine');
  console.log(`\n 📋  Queueing content for ${numDays} days...\n`);

  for (let i = 0; i < numDays; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];

    console.log(` Day ${i + 1} (${dateStr}):`);
    const content = await generateDailyContent();
    addToQueue({
      targetDate: dateStr,
      content,
    });
    console.log(`   ✅  Queued: ${content.facebook.category} — "${content.facebook.hook.slice(0, 50)}..."`);
  }

  console.log(`\n ✅  ${numDays} days queued. Run scheduler to publish on schedule.`);
}

// ─── Cron loop ────────────────────────────────────────────────────────────────

function startScheduler() {
  const cron = config.scheduler.cronExpression;
  console.log(`\n 🕐  Mediatwist Scheduler started`);
  console.log(`     Cron: ${cron}`);
  console.log(`     TZ:   ${config.scheduler.timezone}`);
  console.log(`     Waiting for next trigger...\n`);

  let lastRun = null;

  setInterval(() => {
    const now = new Date();
    const nowMinute = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

    if (cronMatches(cron, now) && lastRun !== nowMinute) {
      lastRun = nowMinute;
      console.log(`\n ⏰  Cron triggered at ${now.toISOString()}`);

      // Check queue first
      const queued = getNextQueued();
      if (queued) {
        console.log(`     Using queued content from ${queued.targetDate}`);
        // Publish queued content
        publishQueued(queued).catch(err => {
          console.error(`     ❌ Queue publish failed: ${err.message}`);
        });
      } else {
        // Generate fresh
        executeEngine().catch(err => {
          console.error(`     ❌ Engine execution failed: ${err.message}`);
        });
      }
    }
  }, 30000); // Check every 30 seconds
}

async function publishQueued(queueEntry) {
  const { publishToAll } = require('../publishers');
  const memory = require('../memory/store');

  const results = await publishToAll(queueEntry.content, null);
  markQueuedComplete(queueEntry.queuedAt);

  Object.entries(results).forEach(([platform, result]) => {
    if (result && result.success) {
      const post = queueEntry.content[platform];
      memory.recordPost({
        platform,
        category: post.category,
        hook: post.hook,
        caption: post.caption,
      });
    }
  });

  return results;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--run-now')) {
    const dryRun = args.includes('--dry-run');
    executeEngine({ dryRun })
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (args.includes('--queue')) {
    const idx = args.indexOf('--queue');
    const days = parseInt(args[idx + 1], 10) || 7;
    queueDays(days)
      .then(() => process.exit(0))
      .catch(err => { console.error(err); process.exit(1); });
  } else if (args.includes('--dry-run')) {
    executeEngine({ dryRun: true })
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    startScheduler();
  }
}

module.exports = { executeEngine, startScheduler, queueDays, mapCompositionHint };
