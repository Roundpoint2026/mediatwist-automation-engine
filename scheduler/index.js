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
const { execSync } = require('child_process');

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

    // Step 1b: Select background music track
    let audioTrack = null;
    if (config.music?.enabled !== false) {
      console.log('\n 🎵  Selecting background music...');
      try {
        const { selectTrackForCategory, getRecentlyUsedTracks } = require('../music/musicManager');
        const recentTracks = getRecentlyUsedTracks(10);
        audioTrack = await selectTrackForCategory(content.facebook.category, recentTracks);
      } catch (musicErr) {
        console.warn(`     ⚠️  Music selection failed: ${musicErr.message}`);
        console.warn('     Continuing without audio...');
      }
    } else {
      console.log('\n 🔇  Music disabled (MUSIC_ENABLED=false)');
    }

    // Step 1c: Audio branding for Reels (brands the audio label on IG)
    let trendingAudio = null;
    if (process.env.TRENDING_AUDIO_ENABLED !== 'false') {
      console.log('\n 🏷️  Generating audio branding for Reels...');
      try {
        const { getAudioBranding } = require('../music/trendingAudio');
        const trackFilename = audioTrack ? audioTrack.filename : null;
        trendingAudio = getAudioBranding(content.facebook.category, trackFilename);
        console.log(`     ✅  Audio label: "${trendingAudio.audioName}"`);
      } catch (brandErr) {
        console.warn(`     ⚠️  Audio branding failed: ${brandErr.message}`);
      }
    }

    // Step 2: Render visual asset — POST-TYPE AWARE ROUTING
    console.log('\n ⏳  Rendering visual asset...');
    const postType = content.postType || 'video';
    console.log(`     Post type: ${postType}`);

    let mediaUrl = null;
    let outputPath = null;
    let mediaUrls = null;  // Array for carousel posts
    let visualEngine = 'unknown';

    const {
      getVisualEngine, renderWithCanva,
      renderStaticImage, renderCarousel, renderIllustration,
    } = require('../ai/canvaEngine');
    const engineMode = getVisualEngine();
    console.log(`     Visual engine mode: ${engineMode}`);

    // ── Remotion video renderer (used for 'video' post type) ──
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
        backgroundImageUrl: content.visual_direction.backgroundImageUrl,
        audioSrc:    audioTrack ? audioTrack.filePath : undefined,
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

    // ── Canva video renderer (fallback for 'video' type) ──
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

    try {
      let rendered = false;

      // ── Route by post type ──
      if (postType === 'static_image') {
        // Static branded image via Canva AI (no text overlay)
        console.log('     Rendering static branded image...');
        const result = await renderStaticImage(content.facebook);
        if (result) {
          outputPath = result.filePath;
          visualEngine = 'canva (static_image)';
          rendered = true;
          console.log(` ✅  Static image: ${path.basename(outputPath)}`);
        }
        // Fallback: use Remotion with a still frame export
        if (!rendered) {
          console.log('     Static image failed — falling back to Remotion video...');
          rendered = await tryRemotion();
        }

      } else if (postType === 'carousel') {
        // Multi-slide carousel via Canva AI
        const slides = content.carouselData?.slides || ['Slide 1', 'Slide 2', 'CTA'];
        const style = content.carouselData?.carouselStyle || 'tips';
        console.log(`     Rendering ${slides.length}-slide carousel (${style})...`);
        const result = await renderCarousel(content.facebook, slides, style);
        if (result && result.filePaths.length >= 2) {
          // Carousel produces multiple files — store as array
          mediaUrls = []; // Will be populated after Cloudinary upload
          outputPath = result.filePaths[0]; // Primary for single-asset fallback
          visualEngine = `canva (carousel:${style})`;
          rendered = true;
          // Store file paths for later upload
          content._carouselFilePaths = result.filePaths;
          console.log(` ✅  Carousel: ${result.filePaths.length} slides rendered`);
        }
        // Fallback: single image post
        if (!rendered) {
          console.log('     Carousel render failed — falling back to single image...');
          const staticResult = await renderStaticImage(content.facebook);
          if (staticResult) {
            outputPath = staticResult.filePath;
            visualEngine = 'canva (carousel→static fallback)';
            rendered = true;
          }
        }

      } else if (postType === 'illustration') {
        // Illustration-style image via Canva AI
        console.log('     Rendering illustration-style image...');
        const result = await renderIllustration(content.facebook);
        if (result) {
          outputPath = result.filePath;
          visualEngine = 'canva (illustration)';
          rendered = true;
          console.log(` ✅  Illustration: ${path.basename(outputPath)}`);
        }
        // Fallback: Remotion video
        if (!rendered) {
          console.log('     Illustration failed — falling back to Remotion video...');
          rendered = await tryRemotion();
        }

      } else {
        // Default: 'video' post type — Remotion ↔ Canva routing
        if (engineMode === 'canva') {
          rendered = await tryCanva();
        } else if (engineMode === 'remotion') {
          rendered = await tryRemotion();
        } else if (engineMode === 'canva-first') {
          rendered = await tryCanva();
          if (!rendered) {
            console.log('     Canva unavailable — falling back to Remotion...');
            rendered = await tryRemotion();
          }
        } else if (engineMode === 'remotion-first') {
          try {
            rendered = await tryRemotion();
          } catch (remotionErr) {
            console.warn(`     Remotion failed: ${remotionErr.message}`);
            console.log('     Falling back to Canva...');
            rendered = await tryCanva();
          }
        }
      }

      if (!rendered) {
        throw new Error('All visual engines failed');
      }

      // Step 2b: Merge audio into video via ffmpeg (ONLY for video post type)
      // Layers: (1) "Why Mediatwist?" voice clip at full volume
      //         (2) Background music ducked underneath the voice
      // Remotion's <Audio> is unreliable in SSR — ffmpeg guarantees audio in the MP4.
      // Skip for static_image, carousel, and illustration post types.
      if (postType === 'video' && outputPath && fs.existsSync(outputPath)) {
        // Rotate between available voice clips
        const voiceClips = [
          { name: 'Why Mediatwist_.mp3', path: path.resolve(__dirname, '../public/audio/Why Mediatwist_.mp3') },
          { name: 'Mediatwist CEO.mp3',  path: path.resolve(__dirname, '../public/audio/Mediatwist CEO.mp3') },
        ].filter(clip => fs.existsSync(clip.path));

        const selectedVoice = voiceClips.length > 0
          ? voiceClips[Math.floor(Math.random() * voiceClips.length)]
          : null;
        const voiceClipPath = selectedVoice ? selectedVoice.path : null;
        const hasVoice = !!selectedVoice;
        const musicFilePath = audioTrack ? path.resolve(__dirname, '../public', audioTrack.filePath) : null;
        const hasMusic = musicFilePath && fs.existsSync(musicFilePath);

        if (hasVoice || hasMusic) {
          console.log('\n 🎵  Merging audio into video via ffmpeg...');
          if (hasVoice) console.log(`     🎤  Voice: ${selectedVoice.name}`);
          if (hasMusic) console.log(`     🎶  Music: ${audioTrack.filename}`);

          const outputDir = path.resolve(__dirname, '../outputs');
          const mergedPath = path.join(outputDir, `daily-merged-${Date.now()}.mp4`);
          const musicVolume = config.music?.volume || 0.18;
          const musicDuckedVolume = musicVolume * 0.4; // Duck music to 40% when voice plays
          const voiceVolume = 0.85; // Voice clip slightly below max to avoid clipping
          const fadeOut = config.music?.fadeOutFrames ? (config.music.fadeOutFrames / 30) : 1.5;

          try {
            // Probe video duration for precise timing
            const durationStr = execSync(
              `ffprobe -v error -show_entries format=duration -of csv=p=0 "${outputPath}"`,
              { encoding: 'utf-8', timeout: 10000 }
            ).trim();
            const videoDuration = parseFloat(durationStr) || 10;
            const fadeOutStart = Math.max(0, videoDuration - fadeOut);

            let ffmpegCmd;

            if (hasVoice && hasMusic) {
              // Both voice clip + background music: mix them with ducking
              ffmpegCmd = [
                'ffmpeg -y',
                `-i "${outputPath}"`,                  // 0: video
                `-i "${voiceClipPath}"`,               // 1: voice clip
                `-i "${musicFilePath}"`,               // 2: background music
                '-filter_complex',
                `"[1:a]atrim=0:${videoDuration},asetpts=PTS-STARTPTS,volume=${voiceVolume},afade=t=out:st=${fadeOutStart}:d=${fadeOut}[voice];` +
                `[2:a]atrim=0:${videoDuration},asetpts=PTS-STARTPTS,volume=${musicDuckedVolume},afade=t=in:st=0:d=1,afade=t=out:st=${fadeOutStart}:d=${fadeOut}[music];` +
                `[voice][music]amix=inputs=2:duration=shortest:normalize=0[aout]"`,
                '-map 0:v:0', '-map "[aout]"',
                '-c:v copy', '-c:a aac -b:a 128k',
                '-shortest', `-t ${videoDuration}`,
                `"${mergedPath}"`,
              ].join(' ');
            } else if (hasVoice) {
              // Voice clip only (no background music selected)
              ffmpegCmd = [
                'ffmpeg -y',
                `-i "${outputPath}"`,
                `-i "${voiceClipPath}"`,
                '-map 0:v:0', '-map 1:a:0',
                '-c:v copy', '-c:a aac -b:a 128k',
                `-af "volume=${voiceVolume},atrim=0:${videoDuration},afade=t=out:st=${fadeOutStart}:d=${fadeOut}"`,
                '-shortest', `-t ${videoDuration}`,
                `"${mergedPath}"`,
              ].join(' ');
            } else {
              // Background music only (voice clip file missing)
              ffmpegCmd = [
                'ffmpeg -y',
                `-i "${outputPath}"`,
                `-i "${musicFilePath}"`,
                '-map 0:v:0', '-map 1:a:0',
                '-c:v copy', '-c:a aac -b:a 128k',
                `-af "volume=${musicVolume},afade=t=in:st=0:d=1,afade=t=out:st=${fadeOutStart}:d=${fadeOut}"`,
                '-shortest', `-t ${videoDuration}`,
                `"${mergedPath}"`,
              ].join(' ');
            }

            execSync(ffmpegCmd, { stdio: 'pipe', timeout: 60000 });

            // Verify merged file exists and has size
            if (fs.existsSync(mergedPath) && fs.statSync(mergedPath).size > 0) {
              fs.unlinkSync(outputPath);
              outputPath = mergedPath;
              const layers = [hasVoice ? 'voice' : null, hasMusic ? 'music' : null].filter(Boolean).join(' + ');
              console.log(` ✅  Audio merged: ${path.basename(mergedPath)} (${layers})`);
            } else {
              console.warn('     ⚠️  Merged file empty — using silent video');
            }
          } catch (ffmpegErr) {
            console.warn(`     ⚠️  ffmpeg merge failed: ${ffmpegErr.message}`);
            console.warn('     Continuing with silent video...');
          }
        }
      }

      // Step 3: Upload to Cloudinary
      const { uploadMedia } = require('../publishers/cloudinary');

      if (postType === 'carousel' && content._carouselFilePaths) {
        // Carousel: upload ALL slides to Cloudinary
        console.log(`\n ⏳  Uploading ${content._carouselFilePaths.length} carousel slides to Cloudinary...`);
        mediaUrls = [];
        for (const slidePath of content._carouselFilePaths) {
          const slideUrl = await uploadMedia(slidePath);
          mediaUrls.push(slideUrl);
          console.log(`     ✅  Slide uploaded: ${slideUrl}`);
        }
        mediaUrl = mediaUrls[0]; // Primary URL for fallback/LinkedIn
        console.log(` ✅  All ${mediaUrls.length} slides uploaded (via ${visualEngine})`);
      } else {
        // Single asset: upload one file
        console.log('\n ⏳  Uploading to Cloudinary...');
        mediaUrl = await uploadMedia(outputPath);
        console.log(` ✅  Uploaded: ${mediaUrl} (via ${visualEngine})`);
      }

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
    const isVideo = postType === 'video' && mediaUrl && mediaUrl.includes('.mp4');
    const postPayload = {
      caption: content.facebook.caption,
      imageUrl: isVideo ? null : mediaUrl,
      videoUrl: isVideo ? mediaUrl : null,
      mediaUrls: mediaUrls,          // Array for carousel posts
      postType: postType,             // Post type for publisher routing
      overrides: {
        facebook:  content.facebook.caption,
        instagram: content.instagram.caption,
        linkedin:  content.linkedin.caption,
      },
      // Pass audio branding for Reels (brands the audio label on IG)
      trendingAudio: trendingAudio || null,
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
          postType,           // Track post type for rotation
          mediaUrl,
          visualEngine,       // Track which engine was used
          audioTrack: audioTrack ? audioTrack.filename : null,
        });
      }
    });

    console.log(`\n${DIVIDER}`);
    console.log(` 🎉  DAILY ENGINE COMPLETE`);
    console.log(`     Post type: ${postType}`);
    console.log(`     Visual:   ${visualEngine}`);
    console.log(`     Audio:    ${audioTrack ? audioTrack.filename : 'none'} (baked into MP4 via ffmpeg)`);
    console.log(`     IG Label: ${trendingAudio?.audioName || 'none'}`);
    console.log(DIVIDER);

    return { content, outputPath, mediaUrl, visualEngine, audioTrack, trendingAudio, results };

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
  // Support multiple cron expressions separated by commas (e.g. "30 8 * * *,0 20 * * *")
  const cronRaw = config.scheduler.cronExpression;
  const cronExpressions = cronRaw.includes(',') && cronRaw.split(',').every(c => c.trim().split(/\s+/).length === 5)
    ? cronRaw.split(',').map(c => c.trim())
    : [cronRaw]; // single expression

  console.log(`\n 🕐  Mediatwist Scheduler started`);
  cronExpressions.forEach(c => console.log(`     Cron: ${c}`));
  console.log(`     TZ:   ${config.scheduler.timezone}`);
  console.log(`     Waiting for next trigger...\n`);

  let lastRun = null;

  setInterval(() => {
    const now = new Date();
    const nowMinute = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

    const anyMatch = cronExpressions.some(expr => cronMatches(expr, now));
    if (anyMatch && lastRun !== nowMinute) {
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
