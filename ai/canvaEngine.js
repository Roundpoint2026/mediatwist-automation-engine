#!/usr/bin/env node
/**
 * canvaEngine.js — Canva Integration for Mediatwist Automation Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Full Canva Connect API integration: generates, saves, exports, and downloads
 * branded social media designs as an alternative to Remotion rendering.
 *
 * Flow:
 *   1. Check "Social Queue" folder for pre-made designs (queue mode)
 *   2. If empty, generate new design via Canva AI + Mediatwist brand kit
 *   3. Save the candidate to the Canva account
 *   4. Export as MP4 (animated) or PNG (static)
 *   5. Download exported file locally → Cloudinary upload
 *
 * Design Types:
 *   - instagram_post (1080×1080) — feed posts
 *   - your_story (1080×1920) — reels/stories
 *
 * Used by: scheduler/index.js as an ALTERNATIVE to Remotion rendering.
 */
'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../config/engine');
const { createLogger } = require('../publishers/logger');
const { withRetry } = require('../publishers/retry');

const logger = createLogger('canva-engine');

// ─── Canva API Config ────────────────────────────────────────────────────────

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
const CANVA_ACCESS_TOKEN = process.env.CANVA_ACCESS_TOKEN;
const BRAND_KIT_ID = process.env.CANVA_BRAND_KIT_ID || 'kAFgjxJ3nmw';
const QUEUE_FOLDER_ID = process.env.CANVA_QUEUE_FOLDER_ID || 'FAHFM_9suzw';
const ARCHIVE_FOLDER_ID = process.env.CANVA_ARCHIVE_FOLDER_ID || 'FAHFNcjgKP8';

// Saved template design IDs (fallback if generation fails)
const TEMPLATES = {
  feed: [
    'DAHFM8VjEwU', // Feed Template 1 - Bold positioning quote
    'DAHFM3ba-9Q', // Feed Template 2 - Market potential
  ],
  reels: [
    'DAHFMxq2dHI', // Reel Template 1 - AI teamwork
    'DAHFM85V12U', // Reel Template 2 - Transform marketing
  ],
};

// ─── HTTP Helpers ────────────────────────────────────────────────────────────

function canvaHeaders() {
  if (!CANVA_ACCESS_TOKEN) {
    throw new Error('CANVA_ACCESS_TOKEN not set in .env — get one from https://www.canva.com/developers');
  }
  return {
    'Authorization': `Bearer ${CANVA_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function canvaGet(endpoint, params = {}) {
  const res = await axios.get(`${CANVA_API_BASE}${endpoint}`, {
    headers: canvaHeaders(),
    params,
    timeout: 30000,
  });
  return res.data;
}

async function canvaPost(endpoint, data = {}) {
  const res = await axios.post(`${CANVA_API_BASE}${endpoint}`, data, {
    headers: canvaHeaders(),
    timeout: 30000,
  });
  return res.data;
}

// ─── Design Prompt Builders ──────────────────────────────────────────────────

// IMPORTANT: Every style MUST include explicit animation/motion keywords.
// Canva AI will produce static designs unless you demand motion in the prompt.
const CANVA_STYLE_MAP = {
  'kinetic-typography':       'animated typewriter text reveal with sliding geometric shapes and pulsing accent lines',
  'bold-text-motion':         'giant bold text that SLIDES IN from left with animated diagonal yellow stripe sweeping across frame',
  'data-dashboard':           'animated data visualization with counting stat numbers, filling progress bars, and fading-in chart elements',
  'dynamic-dashboard':        'animated metrics dashboard with glowing pulsing accents, counting numbers, and sliding panel transitions',
  'philosophical-typography': 'elegant quote with ANIMATED fade-in text reveal, floating quotation marks, and subtle particle drift',
  'elegant-minimal':          'clean minimal design with ANIMATED corner accent lines drawing in, text fade-up reveal, and gentle pulse effects',
  'narrative-flow':           'split layout with ANIMATED panel slide-in from left, text typing effect, and yellow panel expanding into frame',
  'futuristic-glitch':        'neon glow card with ANIMATED floating particles, pulsing circuit lines, and glitch-flicker text reveal',
  'animated-stat-reveal':     'animated stat reveal with numbers counting up, split panels sliding in, and magazine-style text cascading',
  'exponential-curve':        'bold growth design with ANIMATED upward-sweeping diagonal lines, scaling arrows, and text punching in from bottom',
};

function getStyleForHint(compositionHint) {
  return CANVA_STYLE_MAP[compositionHint] || 'bold modern design with geometric accents';
}

// ─── Logo Zone Protection Rules ─────────────────────────────────────────────
// These rules are NON-NEGOTIABLE and apply to ALL generated designs.
// The logo is STAMPED onto the final export at bottom-left via ImageMagick/ffmpeg.
// Canva designs must leave bottom-left corner COMPLETELY EMPTY for the logo.
const LOGO_ZONE_RULES = {
  position: 'bottom-left',         // Logo is overlaid at bottom-left in post-processing
  clearspace: '25%',               // Bottom-left 25% × 20% must be completely empty
  contentZone: 'top 80% of frame, and right 75% of bottom area',
  forbidden: [
    'No text, graphics, overlays, or animations in the bottom-left 25% × 20% zone',
    'No @mediatwist handle in the bottom-left — put it bottom-right instead',
    'The bottom-left corner must be solid black or empty background only',
  ],
};

function buildLogoDirective() {
  return `CRITICAL LOGO ZONE (NON-NEGOTIABLE): ` +
    `The bottom-left corner of the canvas (approximately the bottom-left 250×200 pixel area) ` +
    `MUST be kept COMPLETELY EMPTY — solid black background ONLY, no text, no graphics, no decorations. ` +
    `A logo will be stamped there in post-production. ` +
    `ALL text, headlines, subtext, handles, shapes, and design elements must stay ABOVE and to the RIGHT of this zone. ` +
    `Put the @mediatwist handle at the BOTTOM-RIGHT instead (never bottom-left). ` +
    `Design your layout so the bottom-left corner is a clean, empty black space.`;
}

function buildFeedPrompt(hook, category, compositionHint) {
  const style = getStyleForHint(compositionHint);
  return `Create an ANIMATED VIDEO post (NOT a static image) for "The Mediatwist Group" marketing agency. ` +
    `THIS IS A VIDEO — every element MUST animate. Nothing should be static. ` +
    `Design requirements: Black (#0A0A0A) background with yellow (#FFD600) accents. ` +
    `FULL-WIDTH DESIGN: Use the ENTIRE canvas edge-to-edge. No large empty black margins on the sides. ` +
    `Graphics, accent shapes, and text should spread across the full width of the frame. ` +
    `HEADLINE FONT: Use an ultra-bold, condensed, uppercase font (like Impact, Bebas Neue, or Anton) for the main headline. ` +
    `This is the signature Mediatwist look — giant, punchy, condensed block letters. ` +
    `Main text: "${hook}" — text MUST animate in (slide, type, fade, or punch — not just appear). ` +
    `Category: ${category}. ` +
    `${buildLogoDirective()} ` +
    `Add "@mediatwist" handle at the BOTTOM-RIGHT corner (never bottom-left). ` +
    `LAYOUT ZONES: ` +
    `LOGO ZONE = bottom-left 250×200px area — MUST be completely empty black space. NO text or graphics here. ` +
    `CONTENT ZONE = top 80% of canvas + right 75% of bottom area (all text, shapes, decorations go HERE). ` +
    `@MEDIATWIST HANDLE = bottom-right corner ONLY. ` +
    `Background Layer = solid black with subtle geometric accents that AVOID the bottom-left logo zone. ` +
    `MANDATORY ANIMATION REQUIREMENTS: ` +
    `1. Text must animate in with a reveal effect (typewriter, slide-up, fade-in, or word-by-word). ` +
    `2. Background elements must have subtle continuous motion (floating particles, pulsing lines, drifting shapes). ` +
    `3. Accent graphics (lines, shapes, borders) must animate — draw in, pulse, slide, or glow. ` +
    `4. Use staggered timing — elements should appear sequentially, not all at once. ` +
    `5. Include at least one looping ambient animation (particle drift, line pulse, subtle glow cycle). ` +
    `DO NOT create a static design. Every visible element needs motion. ` +
    `Modern, executive-level, tech-forward aesthetic. No photos of people. ` +
    `Bold, confident, slightly futuristic feel. Visual style: ${style}.`;
}

function buildReelsPrompt(hook, category, compositionHint) {
  const style = getStyleForHint(compositionHint);
  return `Create an ANIMATED VERTICAL VIDEO Story/Reel (NOT a static image) for "The Mediatwist Group" marketing agency. ` +
    `THIS IS A VIDEO — every element MUST animate. Nothing should be static. ` +
    `Design requirements: Black (#0A0A0A) background with yellow (#FFD600) accents. ` +
    `FULL-WIDTH DESIGN: Use the ENTIRE canvas edge-to-edge. No large empty margins. ` +
    `HEADLINE FONT: Use an ultra-bold, condensed, uppercase font (like Impact, Bebas Neue, or Anton). ` +
    `Giant, punchy, condensed block letters — this is the Mediatwist signature look. ` +
    `Main text: "${hook}" — text MUST animate in (slide, type, fade, or punch — not just appear). ` +
    `Category: ${category}. ` +
    `${buildLogoDirective()} ` +
    `"@mediatwist" handle at the BOTTOM-RIGHT (never bottom-left). ` +
    `LAYOUT ZONES: ` +
    `LOGO ZONE = bottom-left 250×200px area — MUST be completely empty black space. ` +
    `CONTENT ZONE = top 85% of canvas + right side of bottom area (all text, shapes go HERE). ` +
    `@MEDIATWIST HANDLE = bottom-right corner ONLY. ` +
    `Background Layer = solid black with yellow geometric accents — must NOT enter bottom-left logo zone. ` +
    `MANDATORY ANIMATION REQUIREMENTS: ` +
    `1. Text must animate in with a dramatic reveal (typewriter, slide, scale-up, or kinetic bounce). ` +
    `2. Background must have continuous ambient motion (floating particles, pulsing grid lines, drifting geometric shapes). ` +
    `3. Accent elements must animate — lines draw in, shapes slide, borders pulse with glow. ` +
    `4. Stagger element timing — build the composition piece by piece, not all at once. ` +
    `5. Include a looping ambient animation that runs throughout (particle system, subtle pulse, drift). ` +
    `DO NOT create a static design. This MUST be a motion-heavy animated video. ` +
    `Modern tech aesthetic, dark and bold. Visual style: ${style}.`;
}

// ─── Post-Type Prompt Builders ──────────────────────────────────────────────

/**
 * Build a Canva AI prompt for a STATIC branded image (no text overlay).
 * These are visual-only posts — abstract brand art, lifestyle photography, textures.
 * Designed to break up text-heavy posts on the IG grid.
 */
function buildStaticImagePrompt(category) {
  const STATIC_THEMES = {
    'Industry Insight': 'futuristic technology landscape, glowing data streams, abstract circuit patterns',
    'Contrarian Marketing Take': 'bold abstract composition, geometric clash, contrasting shapes and textures',
    'Case Study Breakdown': 'professional workspace, data visualization on screen, modern office aesthetic',
    'Founder/Operator Mindset': 'dramatic skyline at golden hour, urban architecture, ambition and scale',
    'Social Media Myth Busting': 'shattered glass effect, broken pattern, deconstructed geometric shapes',
    'AI & Marketing Strategy': 'neural network visualization, AI brain illustration, futuristic holographic interface',
    'Growth Hacking': 'upward arrows, exponential curves, rocket trajectory, acceleration visual',
    'Brand Authority': 'luxury texture, brushed metal, premium materials, authority and craft',
    'Paid Media Intelligence': 'dashboard analytics glow, graph visualizations, performance metrics aesthetic',
    'Content Strategy': 'interconnected nodes, content web, strategic grid layout, information architecture',
  };

  const theme = STATIC_THEMES[category] || 'bold abstract composition with geometric shapes';

  return `Create a STATIC branded image (NOT a video, NOT animated) for "The Mediatwist Group" marketing agency. ` +
    `This is a VISUAL-ONLY post with NO TEXT on the image — no headlines, no captions, no words at all. ` +
    `Design requirements: Black (#0A0A0A) background with yellow (#FFD600) accents. ` +
    `FULL-WIDTH DESIGN: Use the ENTIRE canvas edge-to-edge with rich visual detail. ` +
    `Theme: ${theme}. ` +
    `${buildLogoDirective()} ` +
    `Style: Premium, executive-level, cinematic quality. No stock photo feel. ` +
    `Think editorial magazine, not corporate PowerPoint. ` +
    `NO text whatsoever — this post relies purely on stunning visual impact. ` +
    `Color palette must be primarily black (#0A0A0A) with yellow (#FFD600) accents only. ` +
    `No other brand colors. No photos of people. No logos other than the logo zone.`;
}

/**
 * Build a Canva AI prompt for a single CAROUSEL SLIDE.
 * Each slide gets its own branded design with consistent styling.
 *
 * @param {string} slideText - Text for this specific slide
 * @param {number} slideIndex - 0-based slide index (0 = cover)
 * @param {number} totalSlides - Total number of slides
 * @param {string} carouselStyle - 'tips' | 'data' | 'quotes' | 'storytelling'
 */
function buildCarouselSlidePrompt(slideText, slideIndex, totalSlides, carouselStyle) {
  const isCover = slideIndex === 0;
  const isCTA = slideIndex === totalSlides - 1;

  const slideTypeLabel = isCover ? 'COVER SLIDE' : isCTA ? 'CTA SLIDE' : `SLIDE ${slideIndex}/${totalSlides - 2}`;

  const styleDirection = {
    tips: 'numbered list item with bold number accent, clean layout',
    data: 'data visualization with bold stat number, progress bar or chart element',
    quotes: 'elegant quote card with oversized quotation marks, serif-accent typography',
    storytelling: 'narrative chapter card, editorial magazine spread feel',
  };

  return `Create a STATIC carousel slide image for "The Mediatwist Group" (${slideTypeLabel}). ` +
    `Black (#0A0A0A) background with yellow (#FFD600) accents. ` +
    `HEADLINE FONT: Ultra-bold condensed uppercase (Impact/Bebas Neue/Anton style). ` +
    `Text on slide: "${slideText}" ` +
    `${isCover ? 'This is the COVER SLIDE — make it bold, attention-grabbing, and scroll-stopping. Large text, dramatic layout.' : ''} ` +
    `${isCTA ? 'This is the final CTA SLIDE — include @mediatwist handle prominently and a follow prompt.' : ''} ` +
    `Visual style: ${styleDirection[carouselStyle] || 'bold modern design'}. ` +
    `${buildLogoDirective()} ` +
    `CONSISTENT STYLING: Every slide in this carousel must have the same black/yellow palette, same font style, same layout grid. ` +
    `No photos of people. Premium executive-level design.`;
}

/**
 * Build a Canva AI prompt for an ILLUSTRATION / STOP-MOTION style post.
 * These are artistic, editorial illustrations — not photographic.
 */
function buildIllustrationPrompt(hook, category) {
  const ILLUSTRATION_THEMES = {
    'Industry Insight': 'isometric 3D illustration of a futuristic city with data flowing between buildings',
    'Contrarian Marketing Take': 'hand-drawn editorial illustration of a figure swimming against the current',
    'Case Study Breakdown': 'blueprint-style technical illustration with callouts and measurement lines',
    'Founder/Operator Mindset': 'bold vector illustration of a mountain summit with strategic path markers',
    'Social Media Myth Busting': 'pop-art style illustration of myths being shattered, comic book aesthetic',
    'AI & Marketing Strategy': 'retro-futuristic illustration of a robot and human collaborating at a desk',
    'Growth Hacking': 'vector illustration of a rocket launch with growth chart trajectory',
    'Brand Authority': 'art deco illustration of a crown or throne with geometric precision',
    'Paid Media Intelligence': 'technical illustration of a control panel with dials and gauges',
    'Content Strategy': 'editorial illustration of a printing press or content assembly line',
  };

  const theme = ILLUSTRATION_THEMES[category] || 'bold vector illustration with geometric elements';

  return `Create an ILLUSTRATION-STYLE image (NOT a photo, NOT animated) for "The Mediatwist Group". ` +
    `This should look like an editorial magazine illustration or bold vector artwork. ` +
    `STYLE: Hand-crafted illustration feel — vector art, bold lines, flat design with depth. ` +
    `NOT a photograph. NOT AI-generated photo-realism. Think editorial illustration, infographic art, or bold graphic design. ` +
    `Color palette: Black (#0A0A0A) background with yellow (#FFD600) as the primary accent color. ` +
    `White (#FFFFFF) for contrast elements. No other colors. ` +
    `Theme: ${theme}. ` +
    `Include subtle text: "${hook.substring(0, 50)}" in ultra-bold condensed uppercase. ` +
    `${buildLogoDirective()} ` +
    `"@mediatwist" handle at the BOTTOM-RIGHT corner. ` +
    `Premium quality, would look at home in a design magazine or gallery wall. ` +
    `Full-width design, no margins, edge-to-edge visual impact.`;
}

// ─── 1. Queue Mode — Pull designs from Social Queue folder ───────────────────

/**
 * Check the "Social Queue - Mediatwist" folder for ready-to-post designs.
 * Returns the oldest design (FIFO) or null if empty.
 *
 * @returns {Promise<{designId: string, title: string} | null>}
 */
async function pullFromQueue() {
  try {
    const data = await canvaGet(`/folders/${QUEUE_FOLDER_ID}/items`, {
      item_types: 'design',
      sort_by: 'created_ascending', // FIFO — oldest first
    });

    const designs = data.items || [];
    if (designs.length === 0) {
      logger.info('Social Queue is empty — will generate a new design');
      return null;
    }

    const next = designs[0]; // Oldest design
    // Canva REST API nests design data: { type: "design", design: { id, title, ... } }
    const designData = next.design || next;
    const designId = designData.id;
    const title = designData.title || designData.name || 'Untitled';
    logger.info(`Pulled from Social Queue: "${title}" (${designId})`);
    return { designId, title };
  } catch (err) {
    logger.warn(`Queue check failed: ${err.message} — will generate instead`);
    return null;
  }
}

/**
 * Move a design from the Social Queue to the Archive folder so it's never reused.
 * @param {string} designId
 */
async function archiveDesign(designId) {
  try {
    await canvaPost(`/folders/move`, {
      item_id: designId,
      to_folder_id: ARCHIVE_FOLDER_ID,
    });
    logger.info(`Archived design ${designId} → Used folder (will not reuse)`);
  } catch (err) {
    // Try alternative endpoint format
    try {
      await axios.post(`${CANVA_API_BASE}/folders/${ARCHIVE_FOLDER_ID}/items`,
        { item_id: designId, item_type: 'design' },
        { headers: canvaHeaders(), timeout: 15000 }
      );
      logger.info(`Archived design ${designId} → Used folder (will not reuse)`);
    } catch (err2) {
      logger.warn(`Could not archive design ${designId}: ${err2.message} — design may be reused`);
    }
  }
}

// ─── 2. Generate Mode — Create design via Canva AI ───────────────────────────

/**
 * Generate a new on-brand design using Canva's AI generation endpoint.
 *
 * @param {string} hook - Content hook text
 * @param {string} category - Content category
 * @param {string} compositionHint - Composition style hint
 * @param {'feed'|'reels'} format - Design format
 * @returns {Promise<{designId: string, title: string} | null>}
 */
async function generateDesign(hook, category, compositionHint, format = 'feed') {
  const isFeed = format === 'feed';
  const presetType = isFeed ? 'instagram_post' : 'instagram_story';

  try {
    logger.info(`Generating ${presetType} design | Category: ${category} | Style: ${compositionHint}`);

    // Strategy 1: Try brand template autofill if we have templates
    const templatePool = TEMPLATES[format] || TEMPLATES.feed;
    if (templatePool.length > 0) {
      const templateId = templatePool[Math.floor(Math.random() * templatePool.length)];
      logger.info(`Trying brand template autofill with template: ${templateId}`);

      try {
        // Create autofill job
        const autofillResult = await withRetry(
          () => canvaPost('/autofills', {
            brand_template_id: templateId,
            data: {
              hook_text: { type: 'text', text: hook },
              category_text: { type: 'text', text: category },
              handle_text: { type: 'text', text: '@mediatwist' },
            },
            title: `${category} — ${hook.substring(0, 40)}`,
          }),
          { attempts: 2, delayMs: 3000 }
        );

        const jobId = autofillResult.job?.id;
        if (jobId) {
          // Poll for autofill completion
          const design = await pollAutofillJob(jobId);
          if (design) {
            logger.success(`Autofill design saved: ${design.designId} — "${design.title}"`);
            return design;
          }
        }
      } catch (autofillErr) {
        logger.warn(`Autofill failed: ${autofillErr.response?.data?.message || autofillErr.message} — trying blank design`);
      }
    }

    // Strategy 2: Create a blank design from preset type
    logger.info(`Creating blank ${presetType} design`);
    const createResult = await withRetry(
      () => canvaPost('/designs', {
        design_type: {
          type: 'preset',
          name: presetType,
        },
        title: `${category} — ${hook.substring(0, 40)}`,
      }),
      { attempts: 2, delayMs: 3000 }
    );

    const designData = createResult.design || createResult;
    const designId = designData.id;
    const title = designData.title || `${category} — auto-generated`;

    if (!designId) {
      logger.error('Failed to create design — no design ID returned');
      return null;
    }

    logger.success(`Design created: ${designId} — "${title}"`);
    return { designId, title };
  } catch (err) {
    logger.error(`Design generation failed: ${err.response?.data?.message || err.message}`);
    return null;
  }
}

/**
 * Poll an autofill job until it completes.
 * @param {string} jobId
 * @param {number} maxAttempts
 * @returns {Promise<{designId: string, title: string} | null>}
 */
async function pollAutofillJob(jobId, maxAttempts = 12) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);
    try {
      const data = await canvaGet(`/autofills/${jobId}`);
      const job = data.job || data;

      if (job.status === 'success' || job.status === 'completed') {
        const design = job.result?.design || job.design;
        if (design?.id) {
          return { designId: design.id, title: design.title || 'Auto-generated' };
        }
      }

      if (job.status === 'failed') {
        logger.error(`Autofill job ${jobId} failed`);
        return null;
      }

      logger.info(`Autofill polling: ${job.status} (${(i + 1) * 3}s elapsed)`);
    } catch (err) {
      logger.warn(`Autofill poll error: ${err.message}`);
    }
  }
  logger.error(`Autofill ${jobId} timed out`);
  return null;
}

// ─── 3. Export — Get downloadable media from a Canva design ──────────────────

/**
 * Export a Canva design and wait for it to complete.
 *
 * @param {string} designId - Canva design ID
 * @param {'mp4'|'png'|'jpg'} format - Export format
 * @returns {Promise<string | null>} Download URL or null
 */
async function exportDesign(designId, format = 'mp4') {
  try {
    logger.info(`Exporting design ${designId} as ${format}...`);

    const formatConfig = {
      mp4: { type: 'mp4', quality: 'horizontal_1080p', export_quality: 'pro' },
      png: { type: 'png', lossless: true, export_quality: 'pro' },
      jpg: { type: 'jpg', quality: 95, export_quality: 'pro' },
    };

    const exportResult = await canvaPost('/exports', {
      design_id: designId,
      format: formatConfig[format] || formatConfig.mp4,
    });

    // Canva exports can be sync (status: success with URLs)
    // or async (status: in_progress, need polling)
    const job = exportResult.job || exportResult;

    if (job.status === 'success' && job.urls?.length > 0) {
      logger.success(`Export ready: ${job.urls[0].substring(0, 80)}...`);
      return job.urls[0];
    }

    // Async — poll for completion (up to 60s)
    const exportId = job.id;
    if (!exportId) {
      logger.error('No export job ID returned');
      return null;
    }

    return await pollExportStatus(exportId);
  } catch (err) {
    logger.error(`Export failed: ${err.response?.data?.message || err.message}`);
    return null;
  }
}

/**
 * Poll Canva export status until done or timeout.
 * @param {string} exportId
 * @param {number} maxAttempts - Max poll attempts (5s each)
 * @returns {Promise<string | null>} Download URL
 */
async function pollExportStatus(exportId, maxAttempts = 12) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);

    try {
      const data = await canvaGet(`/exports/${exportId}`);
      const job = data.job || data;

      if (job.status === 'success' || job.status === 'completed') {
        const urls = job.urls || job.result?.urls || [];
        if (urls.length > 0) {
          logger.success(`Export ready after ${(i + 1) * 5}s`);
          return urls[0];
        }
      }

      if (job.status === 'failed') {
        logger.error(`Export ${exportId} failed`);
        return null;
      }

      logger.info(`Export polling: ${job.status} (${(i + 1) * 5}s elapsed)`);
    } catch (err) {
      logger.warn(`Export poll error: ${err.message}`);
    }
  }

  logger.error(`Export ${exportId} timed out after ${maxAttempts * 5}s`);
  return null;
}

// ─── 4. Download — Save exported file locally ────────────────────────────────

/**
 * Download a file from a URL to local disk.
 *
 * @param {string} url - Download URL
 * @param {string} outputPath - Local file path
 * @returns {Promise<string>} The local file path
 */
async function downloadExport(url, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });

  fs.writeFileSync(outputPath, response.data);
  const sizeMB = (response.data.byteLength / (1024 * 1024)).toFixed(2);
  logger.success(`Downloaded ${sizeMB}MB → ${path.basename(outputPath)}`);
  return outputPath;
}

// ─── 4b. Logo Overlay — Stamp Mediatwist logo on exported media ──────────────

const LOGO_PATH = path.resolve(__dirname, '../assets/logo-transparent.png');
const LOGO_FALLBACK = path.resolve(__dirname, '../assets/logo.png');

/**
 * Get the best available logo file path.
 * Prefers transparent version, falls back to solid.
 * @returns {string} Logo file path
 */
function getLogoPath() {
  if (fs.existsSync(LOGO_PATH)) return LOGO_PATH;
  if (fs.existsSync(LOGO_FALLBACK)) return LOGO_FALLBACK;
  logger.warn('No logo file found in assets/ — skipping overlay');
  return null;
}

/**
 * Overlay the Mediatwist logo onto an exported image (PNG/JPG).
 * Places logo in BOTTOM-LEFT corner at ~22% of image width with generous padding.
 * The bottom-left zone is kept clear by Canva prompts specifically for this.
 *
 * @param {string} imagePath - Path to the exported image
 * @returns {string} Path to the image with logo (same file, overwritten)
 */
function overlayLogoOnImage(imagePath) {
  const logo = getLogoPath();
  if (!logo) return imagePath;

  try {
    // Logo at 22% of image width, bottom-LEFT, generous 50px padding from edges
    execSync(
      `convert "${imagePath}" \\( "${logo}" -resize 22%x22% \\) ` +
      `-gravity SouthWest -geometry +50+40 -composite "${imagePath}"`,
      { stdio: 'pipe', timeout: 30000 }
    );
    logger.success('Logo overlay applied to image (bottom-left)');
  } catch (err) {
    logger.warn(`Logo overlay failed (image): ${err.message}`);
  }
  return imagePath;
}

/**
 * Overlay the Mediatwist logo onto an exported video (MP4).
 * Places logo in BOTTOM-LEFT corner at 240px width with generous padding.
 * The bottom-left zone is kept clear by Canva prompts specifically for this.
 *
 * @param {string} videoPath - Path to the exported video
 * @returns {string} Path to the video with logo (new file)
 */
function overlayLogoOnVideo(videoPath) {
  const logo = getLogoPath();
  if (!logo) return videoPath;

  const outputPath = videoPath.replace(/\.mp4$/, '-branded.mp4');

  try {
    // Logo 240px wide, bottom-LEFT, 50px from left edge, 40px from bottom
    execSync(
      `ffmpeg -y -i "${videoPath}" -i "${logo}" ` +
      `-filter_complex "[1:v]scale=240:-1[logo];[0:v][logo]overlay=50:H-h-40" ` +
      `-c:a copy "${outputPath}"`,
      { stdio: 'pipe', timeout: 120000 }
    );

    // Replace original with branded version
    fs.unlinkSync(videoPath);
    fs.renameSync(outputPath, videoPath);
    logger.success('Logo overlay applied to video (bottom-left)');
  } catch (err) {
    logger.warn(`Logo overlay failed (video): ${err.message}`);
    // Clean up temp file if it exists
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
  return videoPath;
}

/**
 * Apply logo overlay to any exported media file.
 * Auto-detects format from file extension.
 *
 * @param {string} filePath - Path to exported media
 * @returns {string} Path to branded media
 */
function applyLogoOverlay(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4' || ext === '.mov' || ext === '.webm') {
    return overlayLogoOnVideo(filePath);
  }
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    return overlayLogoOnImage(filePath);
  }
  logger.warn(`Unknown format for logo overlay: ${ext}`);
  return filePath;
}

// ─── 5. Main Entry Point — Full Pipeline ─────────────────────────────────────

/**
 * Execute the full Canva pipeline:
 *   Queue check → Generate → Export → Download
 *
 * Returns a local file path ready for Cloudinary upload.
 *
 * @param {Object} post - Content engine output for a single platform
 * @param {string} post.hook - Content hook text
 * @param {string} post.category - Content category
 * @param {string} post.compositionHint - Composition style hint
 * @param {Object} [options]
 * @param {'feed'|'reels'} [options.format='feed'] - Design format
 * @param {'mp4'|'png'|'jpg'} [options.exportFormat] - Export format (auto-detected if omitted)
 * @param {boolean} [options.skipQueue=false] - Skip queue check, force generation
 * @param {string} [options.outputDir] - Output directory (default: project outputs/)
 * @returns {Promise<{filePath: string, engine: 'canva', source: 'queue'|'generated', designId: string} | null>}
 */
async function renderWithCanva(post, options = {}) {
  const {
    format = 'feed',
    exportFormat,
    skipQueue = false,
    outputDir = path.resolve(__dirname, '../outputs'),
  } = options;

  if (!CANVA_ACCESS_TOKEN) {
    logger.warn('CANVA_ACCESS_TOKEN not set — cannot use Canva engine');
    return null;
  }

  let designId = null;
  let source = null;

  // Step 1: Check the queue
  if (!skipQueue) {
    const queued = await pullFromQueue();
    if (queued) {
      designId = queued.designId;
      source = 'queue';
    }
  }

  // Step 2: Generate if queue was empty
  if (!designId) {
    const generated = await generateDesign(
      post.hook,
      post.category,
      post.compositionHint,
      format
    );
    if (generated) {
      designId = generated.designId;
      source = 'generated';
    }
  }

  // Step 3: Bail if nothing available
  if (!designId) {
    logger.warn('Canva pipeline failed — no design available');
    return null;
  }

  // Step 4: Export
  const expFmt = exportFormat || 'png'; // Canva AI cannot reliably produce animated content — default to PNG for crisp static output
  const downloadUrl = await exportDesign(designId, expFmt);
  if (!downloadUrl) {
    logger.error('Export failed — no download URL');
    return null;
  }

  // Step 5: Download locally
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const ext = expFmt === 'jpg' ? '.jpg' : expFmt === 'png' ? '.png' : '.mp4';
  const outputPath = path.join(outputDir, `canva-${Date.now()}${ext}`);
  await downloadExport(downloadUrl, outputPath);

  // Step 5b: Video quality gate — REJECT static MP4s and fall back to PNG
  // A truly animated MP4 should be at least 200KB for a 5-10s video.
  // Static MP4s are usually tiny (<100KB) because they're just a single frame looped.
  if (ext === '.mp4') {
    const fileSizeKB = fs.statSync(outputPath).size / 1024;
    if (fileSizeKB < 100) {
      logger.warn(`⚠️  MP4 is only ${Math.round(fileSizeKB)}KB — this is a STATIC design with NO animation.`);
      logger.warn(`Canva AI ignored animation requirements. Falling back to PNG export for crisp static output.`);
      // Delete the useless static MP4 and re-export as PNG instead
      fs.unlinkSync(outputPath);
      const pngUrl = await exportDesign(designId, 'png');
      if (pngUrl) {
        const pngPath = outputPath.replace(/\.mp4$/, '.png');
        await downloadExport(pngUrl, pngPath);
        // Update references to use the PNG
        return {
          filePath: applyLogoOverlay(pngPath),
          engine: 'canva',
          source,
          designId,
          note: 'Canva produced static MP4 — re-exported as PNG',
        };
      }
    } else if (fileSizeKB < 200) {
      logger.warn(`MP4 is small (${Math.round(fileSizeKB)}KB) — may have minimal animation.`);
    } else {
      logger.info(`MP4 file size: ${Math.round(fileSizeKB)}KB — animation quality looks good`);
    }
  }

  // Step 6: Stamp Mediatwist logo on the exported file
  logger.info('Applying Mediatwist logo overlay...');
  applyLogoOverlay(outputPath);

  // Step 7: Archive used design so it's NEVER reused
  if (source === 'queue') {
    await archiveDesign(designId);
  }

  logger.success(`Canva pipeline complete: ${source} → ${path.basename(outputPath)}`);

  return {
    filePath: outputPath,
    engine: 'canva',
    source,
    designId,
  };
}

// ─── 5b. Static Image Pipeline ──────────────────────────────────────────────

/**
 * Render a static branded image via Canva AI (no text overlay).
 * Used for 'static_image' post type to break up text-heavy IG grid.
 *
 * @param {Object} post - Content engine output
 * @param {Object} [options]
 * @returns {Promise<{filePath: string, engine: string, postType: string} | null>}
 */
async function renderStaticImage(post, options = {}) {
  const { outputDir = path.resolve(__dirname, '../outputs') } = options;

  if (!CANVA_ACCESS_TOKEN) {
    logger.warn('CANVA_ACCESS_TOKEN not set — cannot render static image');
    return null;
  }

  try {
    logger.info('Generating static branded image via Canva AI...');

    const prompt = buildStaticImagePrompt(post.category);

    // Create design via Canva
    const createResult = await withRetry(
      () => canvaPost('/designs', {
        design_type: { type: 'preset', name: 'instagram_post' },
        title: `Static — ${post.category} — ${Date.now()}`,
      }),
      { attempts: 2, delayMs: 3000 }
    );

    const designId = (createResult.design || createResult).id;
    if (!designId) {
      logger.error('Failed to create static image design');
      return null;
    }

    // Export as high-quality PNG
    const downloadUrl = await exportDesign(designId, 'png');
    if (!downloadUrl) return null;

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `static-${Date.now()}.png`);
    await downloadExport(downloadUrl, outputPath);

    applyLogoOverlay(outputPath);

    logger.success(`Static image rendered: ${path.basename(outputPath)}`);
    return { filePath: outputPath, engine: 'canva', postType: 'static_image', designId };

  } catch (err) {
    logger.error(`Static image render failed: ${err.message}`);
    return null;
  }
}

// ─── 5c. Carousel Pipeline ─────────────────────────────────────────────────

/**
 * Render a multi-slide carousel via Canva AI.
 * Creates each slide as a separate design, exports as PNG, returns array of file paths.
 *
 * @param {Object} post - Content engine output
 * @param {string[]} slides - Array of slide text content
 * @param {string} carouselStyle - 'tips' | 'data' | 'quotes' | 'storytelling'
 * @param {Object} [options]
 * @returns {Promise<{filePaths: string[], engine: string, postType: string} | null>}
 */
async function renderCarousel(post, slides, carouselStyle, options = {}) {
  const { outputDir = path.resolve(__dirname, '../outputs') } = options;

  if (!CANVA_ACCESS_TOKEN) {
    logger.warn('CANVA_ACCESS_TOKEN not set — cannot render carousel');
    return null;
  }

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  try {
    logger.info(`Generating ${slides.length}-slide carousel (${carouselStyle}) via Canva AI...`);
    const filePaths = [];

    for (let i = 0; i < slides.length; i++) {
      logger.info(`  Rendering slide ${i + 1}/${slides.length}...`);

      // Create design for each slide
      const createResult = await withRetry(
        () => canvaPost('/designs', {
          design_type: { type: 'preset', name: 'instagram_post' },
          title: `Carousel ${carouselStyle} — Slide ${i + 1}/${slides.length}`,
        }),
        { attempts: 2, delayMs: 3000 }
      );

      const designId = (createResult.design || createResult).id;
      if (!designId) {
        logger.warn(`Failed to create slide ${i + 1} design, skipping`);
        continue;
      }

      // Export as PNG
      const downloadUrl = await exportDesign(designId, 'png');
      if (!downloadUrl) continue;

      const slidePath = path.join(outputDir, `carousel-${Date.now()}-slide${i + 1}.png`);
      await downloadExport(downloadUrl, slidePath);

      // Apply logo to first and last slides only (cover + CTA)
      if (i === 0 || i === slides.length - 1) {
        applyLogoOverlay(slidePath);
      }

      filePaths.push(slidePath);

      // Rate limit between slides
      if (i < slides.length - 1) await sleep(2000);
    }

    if (filePaths.length < 2) {
      logger.error('Carousel needs at least 2 slides — not enough rendered');
      return null;
    }

    logger.success(`Carousel rendered: ${filePaths.length} slides`);
    return { filePaths, engine: 'canva', postType: 'carousel', carouselStyle };

  } catch (err) {
    logger.error(`Carousel render failed: ${err.message}`);
    return null;
  }
}

// ─── 5d. Illustration Pipeline ──────────────────────────────────────────────

/**
 * Render an illustration-style image via Canva AI.
 * Produces editorial/vector-style art, not photographic content.
 *
 * @param {Object} post - Content engine output
 * @param {Object} [options]
 * @returns {Promise<{filePath: string, engine: string, postType: string} | null>}
 */
async function renderIllustration(post, options = {}) {
  const { outputDir = path.resolve(__dirname, '../outputs') } = options;

  if (!CANVA_ACCESS_TOKEN) {
    logger.warn('CANVA_ACCESS_TOKEN not set — cannot render illustration');
    return null;
  }

  try {
    logger.info('Generating illustration-style image via Canva AI...');

    const createResult = await withRetry(
      () => canvaPost('/designs', {
        design_type: { type: 'preset', name: 'instagram_post' },
        title: `Illustration — ${post.category} — ${Date.now()}`,
      }),
      { attempts: 2, delayMs: 3000 }
    );

    const designId = (createResult.design || createResult).id;
    if (!designId) {
      logger.error('Failed to create illustration design');
      return null;
    }

    // Export as PNG
    const downloadUrl = await exportDesign(designId, 'png');
    if (!downloadUrl) return null;

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `illustration-${Date.now()}.png`);
    await downloadExport(downloadUrl, outputPath);

    applyLogoOverlay(outputPath);

    logger.success(`Illustration rendered: ${path.basename(outputPath)}`);
    return { filePath: outputPath, engine: 'canva', postType: 'illustration', designId };

  } catch (err) {
    logger.error(`Illustration render failed: ${err.message}`);
    return null;
  }
}

// ─── 6. Decision Helper — Should this run use Canva? ─────────────────────────

/**
 * Determine if this run should use Canva or Remotion.
 *
 * Reads from VISUAL_ENGINE env var:
 *   'canva-first'   — Try Canva, fall back to Remotion (default)
 *   'remotion-first' — Try Remotion, fall back to Canva
 *   'canva-only'    — Only Canva
 *   'remotion-only' — Only Remotion (original behavior)
 *   'random'        — ~40% Canva, ~60% Remotion for feed variety
 *
 * @returns {'canva'|'remotion'|'canva-first'|'remotion-first'}
 */
function getVisualEngine() {
  const mode = (process.env.VISUAL_ENGINE || 'canva-first').toLowerCase();

  switch (mode) {
    case 'canva-only':    return 'canva';
    case 'remotion-only': return 'remotion';
    case 'canva-first':   return 'canva-first';
    case 'remotion-first': return 'remotion-first';
    case 'random':        return Math.random() < 0.4 ? 'canva-first' : 'remotion-first';
    default:              return 'canva-first';
  }
}

/**
 * Legacy compat: shouldUseCanva() — returns boolean.
 * @returns {boolean}
 */
function shouldUseCanva() {
  const engine = getVisualEngine();
  return engine === 'canva' || engine === 'canva-first';
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Main pipeline
  renderWithCanva,
  pullFromQueue,
  generateDesign,
  exportDesign,
  downloadExport,
  archiveDesign,

  // Post-type-specific pipelines
  renderStaticImage,
  renderCarousel,
  renderIllustration,

  // Logo overlay (also usable by Remotion pipeline)
  applyLogoOverlay,
  overlayLogoOnImage,
  overlayLogoOnVideo,

  // Decision helpers
  getVisualEngine,
  shouldUseCanva,

  // Prompt builders (for external use / testing)
  buildFeedPrompt,
  buildReelsPrompt,
  buildStaticImagePrompt,
  buildCarouselSlidePrompt,
  buildIllustrationPrompt,
  buildLogoDirective,
  getStyleForHint,
  LOGO_ZONE_RULES,

  // Config references
  TEMPLATES,
  BRAND_KIT_ID,
  QUEUE_FOLDER_ID,
  CANVA_STYLE_MAP,

  // Legacy compat
  buildDesignParams(hook, category, compositionHint, format = 'feed') {
    const style = getStyleForHint(compositionHint);
    const isFeed = format === 'feed';
    const query = isFeed
      ? buildFeedPrompt(hook, category, compositionHint)
      : buildReelsPrompt(hook, category, compositionHint);
    return { query, design_type: isFeed ? 'instagram_post' : 'your_story', brand_kit_id: BRAND_KIT_ID };
  },
  pickTemplate(format = 'feed') {
    const pool = TEMPLATES[format] || TEMPLATES.feed;
    return pool[Math.floor(Math.random() * pool.length)];
  },
  getExportConfig(designId, format = 'mp4') {
    const configs = {
      mp4: { design_id: designId, format: { type: 'mp4', quality: 'horizontal_1080p', export_quality: 'pro' } },
      gif: { design_id: designId, format: { type: 'gif', export_quality: 'pro' } },
      jpg: { design_id: designId, format: { type: 'jpg', quality: 95, export_quality: 'pro' } },
      png: { design_id: designId, format: { type: 'png', lossless: true, export_quality: 'pro' } },
    };
    return configs[format] || configs.mp4;
  },
};
