#!/usr/bin/env node
/**
 * renderAndPublish.js — Complete Mediatwist Automation Engine
 *
 * Full pipeline:
 *   1. Content Engine generates fresh, deduped content (with Claude enhancement if API key set)
 *   2. Maps content category → Remotion composition (animated video)
 *   3. Renders video via Remotion (1080×1080 feed + optional 1080×1920 reels)
 *   4. Uploads to Cloudinary
 *   5. Publishes VIDEO (not static images) to Facebook, Instagram, and LinkedIn
 *   6. Records to memory system (SHA-256 dedup)
 *
 * Usage:
 *   node scripts/renderAndPublish.js                # Full run — render + publish all 3
 *   node scripts/renderAndPublish.js --dry-run      # Generate content + render, no publish
 *   node scripts/renderAndPublish.js --content-only  # Generate content preview, no render
 *   node scripts/renderAndPublish.js --fb-only      # Publish to Facebook only
 *   node scripts/renderAndPublish.js --ig-only      # Publish to Instagram only
 *   node scripts/renderAndPublish.js --li-only      # Publish to LinkedIn only
 *   node scripts/renderAndPublish.js --reels        # Also render vertical Reels version
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { execSync } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const memory = require('../memory/store');
const contentEngine = require('../ai/contentEngine');

// ─── Config ──────────────────────────────────────────────────────────────────
const PAGE_ID               = process.env.PAGE_ID;
const ACCESS_TOKEN          = process.env.ACCESS_TOKEN;
const IG_ACCOUNT_ID         = process.env.IG_ACCOUNT_ID;
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_ORG_ID       = process.env.LINKEDIN_ORG_ID;
const GRAPH                 = 'https://graph.facebook.com/v25.0';
const ROOT_DIR              = path.resolve(__dirname, '..');
const OUT_DIR               = path.join(ROOT_DIR, 'out');

// Cloudinary
const CLOUD_NAME   = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUD_KEY    = process.env.CLOUDINARY_API_KEY;
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET;

// Flags
const DRY_RUN      = process.argv.includes('--dry-run');
const CONTENT_ONLY = process.argv.includes('--content-only');
const FB_ONLY      = process.argv.includes('--fb-only');
const IG_ONLY      = process.argv.includes('--ig-only');
const LI_ONLY      = process.argv.includes('--li-only');
const RENDER_REELS = process.argv.includes('--reels');
const RUN_ALL      = !FB_ONLY && !IG_ONLY && !LI_ONLY;

// Fallback image (used if Remotion render + Cloudinary both fail)
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1080&q=80';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DIVIDER = '═'.repeat(64);
function log(emoji, msg) { console.log(`  ${emoji} ${msg}`); }

// ─── Composition Mapping ─────────────────────────────────────────────────────
// Maps content engine compositionHints → Remotion composition IDs + props
// Now with 8 compositions for maximum visual variety
// backgroundImageUrl is an optional photo URL/staticFile path for composition backgrounds
function mapToComposition(category, compositionHint, hook, body, backgroundImageUrl) {
  const result = _mapToCompositionInner(category, compositionHint, hook, body);
  // Inject backgroundImageUrl into every composition's props
  if (backgroundImageUrl) {
    result.props.backgroundImageUrl = backgroundImageUrl;
  }
  return result;
}

function _mapToCompositionInner(category, compositionHint, hook, body) {
  // Short hook for video overlay (first sentence or first 80 chars)
  const shortHook = hook.length > 100 ? hook.split('.')[0] + '.' : hook;

  // Data dashboard categories get the DataDashboard composition
  if (['data-dashboard', 'dynamic-dashboard'].includes(compositionHint)) {
    return {
      compositionId: 'DataDashboard',
      props: {
        headline: category,
        captionText: shortHook,
        stats: generateStatsForCategory(category),
      },
    };
  }

  // Bold contrarian takes → BoldStatement (giant full-bleed typography)
  if (['bold-text-motion'].includes(compositionHint)) {
    return {
      compositionId: 'BoldStatement',
      props: {
        captionText: shortHook,
        tagline: category.toUpperCase(),
      },
    };
  }

  // AI & futuristic topics → GlowCard (neon glow, particles, tech feel)
  if (['futuristic-glitch'].includes(compositionHint)) {
    return {
      compositionId: 'GlowCard',
      props: {
        captionText: shortHook,
        tagline: category.toUpperCase(),
      },
    };
  }

  // Social media myth busting → SplitLayout (editorial magazine split)
  if (['animated-stat-reveal'].includes(compositionHint)) {
    return {
      compositionId: 'SplitLayout',
      props: {
        captionText: shortHook,
        headline: category.length > 20 ? category.split(' ').slice(0, 3).join(' ') : category,
        tagline: 'THE MEDIATWIST GROUP',
      },
    };
  }

  // Quote/philosophical → BrandedCaption (quote-forward minimal)
  if (['philosophical-typography', 'elegant-minimal'].includes(compositionHint)) {
    return {
      compositionId: 'BrandedCaption',
      props: {
        captionText: shortHook,
        attribution: '— The Mediatwist Group',
      },
    };
  }

  // Kinetic typography stays as KineticType
  if (['kinetic-typography'].includes(compositionHint)) {
    return {
      compositionId: 'KineticType',
      props: {
        captionText: shortHook,
      },
    };
  }

  // Narrative/content strategy → SplitLayout
  if (['narrative-flow'].includes(compositionHint)) {
    return {
      compositionId: 'SplitLayout',
      props: {
        captionText: shortHook,
        headline: 'STRATEGY',
        tagline: 'THE MEDIATWIST GROUP',
      },
    };
  }

  // Growth/curve categories → BoldStatement with custom tagline
  if (['exponential-curve'].includes(compositionHint)) {
    return {
      compositionId: 'BoldStatement',
      props: {
        captionText: shortHook,
        tagline: category.toUpperCase(),
      },
    };
  }

  // Default: cycle between FeedPost, BoldStatement, and GlowCard for variety
  const defaults = ['FeedPost', 'BoldStatement', 'GlowCard'];
  const pick = defaults[Math.floor(Math.random() * defaults.length)];

  if (pick === 'BoldStatement') {
    return {
      compositionId: 'BoldStatement',
      props: {
        captionText: shortHook,
        tagline: category.toUpperCase(),
      },
    };
  }
  if (pick === 'GlowCard') {
    return {
      compositionId: 'GlowCard',
      props: {
        captionText: shortHook,
        tagline: category.toUpperCase(),
      },
    };
  }

  return {
    compositionId: 'FeedPost',
    props: {
      captionText: shortHook,
      headline: category,
      subText: '— The Mediatwist Group',
    },
  };
}

// Generate realistic-looking stats for DataDashboard compositions
function generateStatsForCategory(category) {
  const statSets = {
    'Case Study Breakdown': [
      { label: 'CAC Reduction', value: '-38%' },
      { label: 'Conversion Rate', value: '3.2x' },
      { label: 'Pipeline Growth', value: '+420%' },
      { label: 'Sales Cycle', value: '-45%' },
    ],
    'Paid Media Intelligence': [
      { label: 'ROAS', value: '5.8x' },
      { label: 'CPM Savings', value: '-32%' },
      { label: 'CTR Lift', value: '+180%' },
      { label: 'Conv. Rate', value: '4.1%' },
    ],
  };
  return statSets[category] || [
    { label: 'Growth', value: '+340%' },
    { label: 'Reach', value: '2.3M' },
    { label: 'Engagement', value: '8.7K' },
    { label: 'ROI', value: '+220%' },
  ];
}

// ─── Step 1: Remotion Render ─────────────────────────────────────────────────
function renderVideo(compositionId, props, outputName) {
  const outFile = path.join(OUT_DIR, `${outputName}.mp4`);

  log('🎬', `Rendering ${compositionId} → ${outputName}.mp4`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Write props to temp file (avoids shell escaping nightmares)
  const propsFile = path.join(OUT_DIR, `${outputName}-props.json`);
  fs.writeFileSync(propsFile, JSON.stringify(props));

  const cmd = [
    'npx', 'remotion', 'render',
    'src/index.ts',
    compositionId,
    outFile,
    `--props=${propsFile}`,
    '--codec=h264',
    '--log=error',
  ].join(' ');

  try {
    execSync(cmd, { cwd: ROOT_DIR, stdio: 'inherit', timeout: 300000 });
    log('✅', `Rendered: ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(1)}MB)`);
    try { fs.unlinkSync(propsFile); } catch (_) {}
    return outFile;
  } catch (err) {
    log('❌', `Render failed: ${err.message}`);
    try { fs.unlinkSync(propsFile); } catch (_) {}
    return null;
  }
}

// ─── Step 2: Cloudinary Upload ───────────────────────────────────────────────
async function uploadToCloudinary(filePath, resourceType = 'video') {
  if (!CLOUD_NAME || !CLOUD_KEY || !CLOUD_SECRET) {
    log('⚠️', 'Cloudinary not configured — skipping upload');
    return null;
  }

  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: CLOUD_KEY,
    api_secret: CLOUD_SECRET,
  });

  const fileName = path.basename(filePath, path.extname(filePath));
  const dateFolder = new Date().toISOString().slice(0, 10).replace(/-/g, '/');

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: resourceType,
      folder: `mediatwist/${dateFolder}`,
      public_id: fileName,
      overwrite: true,
    });
    log('☁️', `Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (err) {
    log('❌', `Cloudinary upload failed: ${err.message}`);
    return null;
  }
}

// ─── Step 3: Publish to Facebook ─────────────────────────────────────────────
async function postToFB(caption, mediaUrl, isVideo) {
  if (isVideo) {
    // Video post to Facebook
    const res = await axios.post(`${GRAPH}/${PAGE_ID}/videos`, {
      file_url: mediaUrl,
      description: caption,
      access_token: ACCESS_TOKEN,
    });
    return res.data;
  } else {
    // Photo post fallback
    const res = await axios.post(`${GRAPH}/${PAGE_ID}/photos`, {
      url: mediaUrl,
      message: caption,
      access_token: ACCESS_TOKEN,
    });
    return res.data;
  }
}

// ─── Step 4: Publish to Instagram ────────────────────────────────────────────
async function postToIG(caption, mediaUrl, isVideo) {
  const containerParams = {
    caption,
    access_token: ACCESS_TOKEN,
  };

  if (isVideo) {
    // Video → published as Reels
    containerParams.media_type = 'REELS';
    containerParams.video_url = mediaUrl;
  } else {
    containerParams.image_url = mediaUrl;
  }

  // Create container
  const container = await axios.post(`${GRAPH}/${IG_ACCOUNT_ID}/media`, null, {
    params: containerParams,
  });
  const containerId = container.data.id;
  log('📦', `IG container: ${containerId}`);

  // Wait for processing (videos take longer)
  let status = 'IN_PROGRESS';
  let attempts = 0;
  const maxAttempts = isVideo ? 60 : 15; // Videos: up to 3min, images: 30s
  while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 3000));
    const check = await axios.get(`${GRAPH}/${containerId}`, {
      params: { fields: 'status_code', access_token: ACCESS_TOKEN },
    });
    status = check.data.status_code;
    attempts++;
    if (status === 'ERROR') throw new Error(`IG processing error at attempt ${attempts}`);
    if (attempts % 5 === 0) log('⏳', `IG processing... ${attempts * 3}s (status: ${status})`);
  }

  if (status !== 'FINISHED') {
    throw new Error(`IG container timed out: ${status} after ${attempts * 3}s`);
  }

  // Publish
  const pub = await axios.post(`${GRAPH}/${IG_ACCOUNT_ID}/media_publish`, null, {
    params: { creation_id: containerId, access_token: ACCESS_TOKEN },
  });
  return pub.data;
}

// ─── Step 5: Publish to LinkedIn (VIDEO) ─────────────────────────────────────
async function postToLinkedIn(caption, mediaUrl, localVideoPath) {
  const LI_API = 'https://api.linkedin.com/v2';
  const headers = {
    Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  };

  // Resolve author — try /userinfo (openid), then /me, then org fallback
  let author;
  try {
    const uiRes = await axios.get(`${LI_API}/userinfo`, { headers });
    author = `urn:li:person:${uiRes.data.sub}`;
    log('👤', `LinkedIn: posting as person ${uiRes.data.sub}`);
  } catch (err1) {
    try {
      const meRes = await axios.get(`${LI_API}/me`, { headers });
      author = `urn:li:person:${meRes.data.id}`;
      log('👤', `LinkedIn: posting as person ${meRes.data.id}`);
    } catch (err2) {
      if (LINKEDIN_ORG_ID) {
        author = `urn:li:organization:${LINKEDIN_ORG_ID}`;
        log('🏢', `LinkedIn: posting as org ${LINKEDIN_ORG_ID}`);
      } else {
        throw new Error('LinkedIn auth failed — no person or org resolved');
      }
    }
  }

  // Determine if we have a local video file to upload natively
  const hasLocalVideo = localVideoPath && fs.existsSync(localVideoPath);
  const isVideoPost = hasLocalVideo;
  const recipe = isVideoPost
    ? 'urn:li:digitalmediaRecipe:feedshare-video'
    : 'urn:li:digitalmediaRecipe:feedshare-image';
  const mediaCategory = isVideoPost ? 'VIDEO' : 'IMAGE';

  log('🎬', `LinkedIn media type: ${mediaCategory}`);

  // Register upload
  const registerRes = await axios.post(`${LI_API}/assets?action=registerUpload`, {
    registerUploadRequest: {
      recipes: [recipe],
      owner: author,
      serviceRelationships: [{
        relationshipType: 'OWNER',
        identifier: 'urn:li:userGeneratedContent',
      }],
    },
  }, { headers });

  const uploadUrl = registerRes.data.value.uploadMechanism[
    'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
  ].uploadUrl;
  const asset = registerRes.data.value.asset;
  log('📤', `LinkedIn asset: ${asset}`);

  // Upload the media binary
  let uploadData;
  let contentType;
  if (hasLocalVideo) {
    // Read local video file directly (no HTTP download needed)
    uploadData = fs.readFileSync(localVideoPath);
    contentType = 'video/mp4';
    log('📁', `Uploading local video (${(uploadData.length / 1024 / 1024).toFixed(1)}MB)`);
  } else {
    // Download from URL (image fallback)
    const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    uploadData = response.data;
    contentType = 'application/octet-stream';
  }

  await axios.put(uploadUrl, uploadData, {
    headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`, 'Content-Type': contentType },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  log('✅', 'LinkedIn upload complete');

  // For video: wait for processing to finish
  if (isVideoPost) {
    log('⏳', 'Waiting for LinkedIn video processing...');
    let assetStatus = 'PROCESSING';
    let attempts = 0;
    while (assetStatus !== 'ALLOWED' && attempts < 40) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const statusRes = await axios.get(`${LI_API}/assets/${asset.split(':').pop()}`, { headers });
        const recipes = statusRes.data.recipes || [];
        const recipeStatus = recipes[0]?.status || 'PROCESSING';
        assetStatus = recipeStatus;
      } catch (statusErr) {
        // Asset status endpoint can be flaky, keep trying
      }
      attempts++;
      if (attempts % 4 === 0) log('⏳', `Still processing... ${attempts * 5}s`);
    }
    // Even if status check fails, try to publish — LinkedIn sometimes processes faster than the API reports
    if (assetStatus !== 'ALLOWED' && attempts >= 40) {
      log('⚠️', `Video processing status: ${assetStatus} after ${attempts * 5}s — attempting publish anyway`);
    }
  }

  // Create the post
  const postBody = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: caption },
        shareMediaCategory: mediaCategory,
        media: [{ status: 'READY', media: asset }],
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const postRes = await axios.post(`${LI_API}/ugcPosts`, postBody, { headers });
  return postRes.data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════
(async () => {
  console.log(`\n${DIVIDER}`);
  console.log(' 🚀  MEDIATWIST AUTOMATION ENGINE');
  console.log(`     ${new Date().toISOString()}`);
  console.log('     Pipeline: Content → Remotion Video → Cloudinary → Publish');
  console.log(`     Platforms: ${RUN_ALL ? 'Facebook + Instagram + LinkedIn' : [FB_ONLY && 'Facebook', IG_ONLY && 'Instagram', LI_ONLY && 'LinkedIn'].filter(Boolean).join(' + ')}`);
  if (DRY_RUN) console.log('     ⚠️  DRY RUN — render but no publish');
  if (CONTENT_ONLY) console.log('     ⚠️  CONTENT ONLY — preview, no render');
  console.log(DIVIDER);

  // Validate required env vars
  if (!ACCESS_TOKEN || !PAGE_ID) {
    console.error('\n ❌ Missing ACCESS_TOKEN or PAGE_ID in .env');
    process.exit(1);
  }

  // ── Step 1: Generate Content ─────────────────────────────────────────────
  console.log('\n ── STEP 1: CONTENT GENERATION ──────────────────────────────');
  const content = await contentEngine.generateDailyContent();
  const { facebook, instagram, linkedin, metadata, visual_direction } = content;

  log('📝', `Category: ${metadata.category}`);
  log('🎯', `Hook: "${facebook.hook.slice(0, 80)}..."`);
  log('🎨', `Composition hint: ${facebook.compositionHint}`);

  if (CONTENT_ONLY) {
    console.log('\n ── CONTENT PREVIEW ────────────────────────────────────────');
    console.log('\n  📘 FACEBOOK:\n');
    console.log(facebook.caption);
    console.log('\n  📸 INSTAGRAM:\n');
    console.log(instagram.caption);
    console.log('\n  💼 LINKEDIN:\n');
    console.log(linkedin.caption);
    console.log(`\n${DIVIDER}`);
    console.log(' ✅  Content preview complete');
    console.log(DIVIDER);
    return;
  }

  // ── Dedup Check ─────────────────────────────────────────────────────────
  if (memory.isDuplicate(facebook.caption)) {
    log('🚫', 'DUPLICATE DETECTED — this content has already been published');
    log('⏭️', 'Exiting. Run again to generate fresh content.');
    return;
  }

  // ── Step 2: Map to Remotion Composition ──────────────────────────────────
  console.log('\n ── STEP 2: REMOTION VIDEO RENDERING ────────────────────────');
  const bgUrl = visual_direction?.backgroundImageUrl || null;
  const { compositionId, props } = mapToComposition(
    metadata.category,
    facebook.compositionHint,
    facebook.hook,
    facebook.body,
    bgUrl
  );
  if (bgUrl) log('🖼️', `Background photo: ${bgUrl.substring(0, 80)}...`);
  log('🎬', `Composition: ${compositionId}`);
  log('📐', 'Format: 1080×1080 (feed)');

  // Render feed video (1080×1080 — works for FB feed, IG feed, LinkedIn)
  const ts = Date.now();
  const feedVideo = renderVideo(compositionId, props, `feed-${ts}`);

  // Optionally render Reels version (1080×1920)
  let reelsVideo = null;
  if (RENDER_REELS && feedVideo) {
    log('📐', 'Also rendering 1080×1920 (Reels)');
    const reelsProps = {
      captionText: props.captionText || facebook.hook,
      headline: metadata.category,
      ctaText: 'Follow for more → @mediatwist',
    };
    reelsVideo = renderVideo('ReelsPost', reelsProps, `reels-${ts}`);
  }

  // ── Step 3: Upload to Cloudinary ─────────────────────────────────────────
  console.log('\n ── STEP 3: CLOUDINARY UPLOAD ───────────────────────────────');
  let feedMediaUrl = null;
  let reelsMediaUrl = null;
  let isVideo = false;

  if (feedVideo && fs.existsSync(feedVideo)) {
    feedMediaUrl = await uploadToCloudinary(feedVideo, 'video');
    if (feedMediaUrl) isVideo = true;
  }

  if (reelsVideo && fs.existsSync(reelsVideo)) {
    reelsMediaUrl = await uploadToCloudinary(reelsVideo, 'video');
  }

  // Fallback: upload a thumbnail as static image
  if (!feedMediaUrl) {
    log('⚠️', 'Video pipeline failed — falling back to static image');
    feedMediaUrl = FALLBACK_IMAGE;
    isVideo = false;
  }

  // LinkedIn will receive the actual rendered video file for native video upload

  if (DRY_RUN) {
    console.log('\n ── DRY RUN PREVIEW ────────────────────────────────────────');
    log('📋', `FB caption: "${facebook.caption.slice(0, 80)}..."`);
    log('📋', `IG caption: "${instagram.caption.slice(0, 80)}..."`);
    log('📋', `LI caption: "${linkedin.caption.slice(0, 80)}..."`);
    log('🎥', `Feed video: ${feedMediaUrl}`);
    log('🎥', `Reels video: ${reelsMediaUrl || 'not rendered'}`);
    log('🎥', `LinkedIn video: ${feedVideo || 'none (will use Cloudinary URL)'}`);
    console.log(`\n${DIVIDER}`);
    console.log(' ✅  Dry run complete — no posts published');
    console.log(DIVIDER);
    return;
  }

  // ── Step 4: Publish ──────────────────────────────────────────────────────
  console.log('\n ── STEP 4: PUBLISHING ──────────────────────────────────────');
  const results = { success: [], failed: [] };

  // ── Facebook ──
  if (RUN_ALL || FB_ONLY) {
    try {
      log('📘', `Posting to Facebook (${isVideo ? 'VIDEO' : 'PHOTO'})...`);
      const fbResult = await postToFB(facebook.caption, feedMediaUrl, isVideo);
      const postId = fbResult.id || fbResult.post_id;
      log('✅', `Facebook SUCCESS! Post ID: ${postId}`);
      memory.recordPost({
        platform: 'facebook',
        category: metadata.category,
        hook: facebook.hook,
        caption: facebook.caption,
        compositionId,
        mediaUrl: feedMediaUrl,
        mediaType: isVideo ? 'video' : 'image',
      });
      results.success.push('Facebook');
    } catch (err) {
      log('❌', `Facebook FAILED: ${err.response?.data?.error?.message || err.message}`);
      results.failed.push('Facebook');
    }
  }

  // ── Instagram ──
  if (RUN_ALL || IG_ONLY) {
    if (!IG_ACCOUNT_ID) {
      log('⚠️', 'Instagram skipped — no IG_ACCOUNT_ID');
    } else {
      try {
        // Use reels URL if available and rendering video, otherwise feed
        const igMediaUrl = (isVideo && reelsMediaUrl) ? reelsMediaUrl : feedMediaUrl;
        const igIsVideo = isVideo; // Always use video if we have it
        log('📸', `Posting to Instagram (${igIsVideo ? 'REELS' : 'PHOTO'})...`);
        const igResult = await postToIG(instagram.caption, igMediaUrl, igIsVideo);
        log('✅', `Instagram SUCCESS! Media ID: ${igResult.id}`);
        memory.recordPost({
          platform: 'instagram',
          category: metadata.category,
          hook: instagram.hook,
          caption: instagram.caption,
          compositionId,
          mediaUrl: igMediaUrl,
          mediaType: igIsVideo ? 'reels' : 'image',
        });
        results.success.push('Instagram');
      } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        log('❌', `Instagram FAILED: ${errMsg}`);
        if (err.response?.data) {
          log('🔍', `Detail: ${JSON.stringify(err.response.data).slice(0, 200)}`);
        }
        results.failed.push('Instagram');
      }
    }
  }

  // ── LinkedIn ──
  if (RUN_ALL || LI_ONLY) {
    if (!LINKEDIN_ACCESS_TOKEN) {
      log('⚠️', 'LinkedIn skipped — no LINKEDIN_ACCESS_TOKEN');
    } else {
      try {
        log('💼', `Posting to LinkedIn (${isVideo ? 'VIDEO' : 'IMAGE'})...`);
        const liResult = await postToLinkedIn(linkedin.caption, feedMediaUrl, feedVideo);
        log('✅', `LinkedIn SUCCESS! Post ID: ${liResult.id}`);
        memory.recordPost({
          platform: 'linkedin',
          category: metadata.category,
          hook: linkedin.hook,
          caption: linkedin.caption,
          compositionId,
          mediaUrl: feedMediaUrl,
          mediaType: isVideo ? 'video' : 'image',
        });
        results.success.push('LinkedIn');
      } catch (err) {
        const errMsg = err.response?.data?.message || err.response?.data?.error?.message || err.message;
        log('❌', `LinkedIn FAILED: ${errMsg}`);
        if (err.response?.data) {
          log('🔍', `Detail: ${JSON.stringify(err.response.data).slice(0, 200)}`);
        }
        results.failed.push('LinkedIn');
      }
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${DIVIDER}`);
  console.log(` 🎉  ENGINE COMPLETE — ${results.success.length} published, ${results.failed.length} failed`);
  if (results.success.length) console.log(`     ✅ ${results.success.join(', ')}`);
  if (results.failed.length) console.log(`     ❌ ${results.failed.join(', ')}`);
  console.log(`     📂 Category: ${metadata.category}`);
  console.log(`     🎬 Composition: ${compositionId}`);
  console.log(`     🎥 Media: ${isVideo ? 'Remotion Video' : 'Static Image'}`);
  console.log(DIVIDER);

})().catch(err => {
  console.error(`\n ❌ Fatal: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
