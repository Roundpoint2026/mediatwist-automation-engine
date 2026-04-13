#!/usr/bin/env node
/**
 * blogImageEngine.js — Blog Hero Image Generator for Mediatwist
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates branded blog hero images (1200×630) via Canva AI, stamps the
 * Mediatwist logo in the bottom-left corner, and optionally uploads to
 * Cloudinary for hosting.
 *
 * Uses the same Canva Connect REST API infrastructure as canvaEngine.js.
 *
 * Flow:
 *   1. Takes article title, tag, and meta description
 *   2. Builds a blog-specific Canva AI prompt with brand rules
 *   3. Creates a design via Canva API (facebook_post preset — 1200×630)
 *   4. Exports as high-quality PNG
 *   5. Stamps Mediatwist logo bottom-left via ImageMagick
 *   6. (Optional) Uploads to Cloudinary, returns hosted URL
 *
 * Usage:
 *   node ai/blogImageEngine.js                    # Generate for all seed articles
 *   node ai/blogImageEngine.js --article "title"  # Generate for specific article
 *   node ai/blogImageEngine.js --dry-run          # Preview prompts only
 */
'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ─── Load env if running standalone ──────────────────────────────────────────
if (!process.env.CANVA_ACCESS_TOKEN) {
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  } catch (e) { /* dotenv not required if env already set */ }
}

// ─── Try to load project modules (graceful fallback for standalone) ──────────
let logger, withRetry;
try {
  const { createLogger } = require('../publishers/logger');
  logger = createLogger('blog-image');
} catch (e) {
  logger = {
    info: (...a) => console.log('[blog-image]', ...a),
    success: (...a) => console.log('[blog-image] ✓', ...a),
    warn: (...a) => console.warn('[blog-image] ⚠', ...a),
    error: (...a) => console.error('[blog-image] ✗', ...a),
  };
}
try {
  ({ withRetry } = require('../publishers/retry'));
} catch (e) {
  withRetry = async (fn, opts = {}) => {
    const { attempts = 2, delayMs = 3000 } = opts;
    for (let i = 0; i < attempts; i++) {
      try { return await fn(); } catch (err) {
        if (i === attempts - 1) throw err;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  };
}

// ─── Blog Image History (Deduplication & Style Variation) ───────────────────

const IMAGE_HISTORY_PATH = path.resolve(__dirname, '../memory/blog-image-history.json');

/**
 * Style variants that rotate to guarantee visual uniqueness across blog heroes.
 * Each variant defines a distinct art direction for the AI image generator.
 */
const STYLE_VARIANTS = [
  { id: 'isometric-3d',     desc: 'isometric 3D blocks and floating geometric shapes, low-poly tech aesthetic' },
  { id: 'circuit-blueprint', desc: 'circuit board blueprint with glowing traces and connection nodes, technical schematic style' },
  { id: 'neon-grid',        desc: 'retro-futuristic neon grid landscape with glowing horizon line and wireframe mountains' },
  { id: 'data-flow',        desc: 'flowing data streams and particle trails connecting abstract data nodes' },
  { id: 'brutalist-type',   desc: 'brutalist typography collage with overlapping bold letterforms and hard geometric cuts' },
  { id: 'topographic',      desc: 'topographic contour map with elevation lines in yellow on black, data terrain visualization' },
  { id: 'shattered-glass',  desc: 'shattered glass mosaic with sharp angular fragments reflecting yellow light on dark void' },
  { id: 'radar-pulse',      desc: 'radar sweep with concentric pulse rings and detection blips, surveillance tech aesthetic' },
  { id: 'waveform',         desc: 'audio waveform / frequency spectrum visualization with dynamic peaks and valleys' },
  { id: 'constellation',    desc: 'star constellation map with connected dots forming abstract network topology' },
  { id: 'glitch-art',       desc: 'digital glitch art with horizontal scan lines, pixel displacement, and databending artifacts' },
  { id: 'split-diagonal',   desc: 'bold diagonal split composition — dark black on one side, rich yellow on the other' },
  { id: 'hex-grid',         desc: 'hexagonal grid matrix with selective cells illuminated in yellow, honeycomb data structure' },
  { id: 'ink-splash',       desc: 'explosive ink splash / paint splatter in yellow on deep black, controlled chaos aesthetic' },
  { id: 'venetian-blinds',  desc: 'horizontal slat/blind effect with alternating reveal and shadow, layered depth' },
  { id: 'dot-matrix',       desc: 'halftone dot matrix pattern transitioning from dense to sparse, retro print aesthetic' },
  { id: 'fractal-zoom',     desc: 'fractal zoom with recursive geometric patterns spiraling inward, mathematical beauty' },
  { id: 'layered-paper',    desc: 'layered paper cutout depth effect with stacked black/yellow layers casting shadows' },
  { id: 'barcode-data',     desc: 'abstract barcode / QR code elements as decorative pattern with encoded data aesthetic' },
  { id: 'smoke-tendrils',   desc: 'ethereal smoke tendrils and wisps curling through darkness, illuminated by yellow light' },
];

function loadImageHistory() {
  try {
    if (!fs.existsSync(IMAGE_HISTORY_PATH)) return { generatedImages: [], usedPromptSeeds: [], usedStyleVariants: [], stats: { totalGenerated: 0, bySource: {}, byTag: {}, lastGeneratedAt: null } };
    return JSON.parse(fs.readFileSync(IMAGE_HISTORY_PATH, 'utf-8'));
  } catch { return { generatedImages: [], usedPromptSeeds: [], usedStyleVariants: [], stats: { totalGenerated: 0, bySource: {}, byTag: {}, lastGeneratedAt: null } }; }
}

function saveImageHistory(history) {
  const tmp = IMAGE_HISTORY_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(history, null, 2), 'utf-8');
  fs.renameSync(tmp, IMAGE_HISTORY_PATH);
}

/**
 * Pick a style variant that hasn't been used recently.
 * Cycles through all 20 variants before repeating.
 */
function pickFreshStyleVariant() {
  const history = loadImageHistory();
  const used = history.usedStyleVariants || [];
  // Find variants not yet used in this cycle
  const available = STYLE_VARIANTS.filter(v => !used.includes(v.id));
  if (available.length === 0) {
    // All used — reset cycle and pick first
    history.usedStyleVariants = [];
    saveImageHistory(history);
    return STYLE_VARIANTS[Math.floor(Math.random() * STYLE_VARIANTS.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Record a generated image in history for deduplication.
 */
function recordGeneratedImage(article, source, styleVariant, filePath) {
  const history = loadImageHistory();
  const record = {
    articleId: article.id || null,
    title: article.title,
    tag: article.tag,
    source,
    styleVariant: styleVariant?.id || null,
    filePath: path.basename(filePath),
    promptHash: crypto.createHash('sha256').update(article.title + (styleVariant?.id || '')).digest('hex').substring(0, 12),
    generatedAt: new Date().toISOString(),
  };

  history.generatedImages.push(record);
  if (styleVariant) {
    if (!history.usedStyleVariants) history.usedStyleVariants = [];
    history.usedStyleVariants.push(styleVariant.id);
  }

  // Update stats
  history.stats.totalGenerated = (history.stats.totalGenerated || 0) + 1;
  history.stats.bySource = history.stats.bySource || {};
  history.stats.bySource[source] = (history.stats.bySource[source] || 0) + 1;
  history.stats.byTag = history.stats.byTag || {};
  history.stats.byTag[article.tag] = (history.stats.byTag[article.tag] || 0) + 1;
  history.stats.lastGeneratedAt = new Date().toISOString();

  saveImageHistory(history);
  logger.info(`Image recorded in history: ${record.promptHash} (style: ${styleVariant?.id || 'none'}, total: ${history.stats.totalGenerated})`);
}

/**
 * Check if an image with the same title+style combo was already generated.
 */
function isDuplicateImage(title, styleVariantId) {
  const history = loadImageHistory();
  const hash = crypto.createHash('sha256').update(title + (styleVariantId || '')).digest('hex').substring(0, 12);
  return history.generatedImages.some(img => img.promptHash === hash);
}

// ─── Canva Token Auto-Refresh ────────────────────────────────────────────────

let canvaTokenManager = null;
try {
  canvaTokenManager = require('../scripts/canvaTokenManager');
} catch (e) {
  logger.warn('canvaTokenManager not available — token auto-refresh disabled');
}

// ─── Canva API Config ────────────────────────────────────────────────────────

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
let CANVA_ACCESS_TOKEN = process.env.CANVA_ACCESS_TOKEN;
const BRAND_KIT_ID = process.env.CANVA_BRAND_KIT_ID || 'kAFgjxJ3nmw';

// Blog hero output directory
const BLOG_HEROES_DIR = path.resolve(__dirname, '../outputs/blog-heroes');

// ─── HTTP Helpers (with auto-refresh on 401) ────────────────────────────────

function canvaHeaders() {
  const token = process.env.CANVA_ACCESS_TOKEN || CANVA_ACCESS_TOKEN;
  if (!token) {
    throw new Error('CANVA_ACCESS_TOKEN not set in .env');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function canvaGet(endpoint, params = {}) {
  try {
    const res = await axios.get(`${CANVA_API_BASE}${endpoint}`, {
      headers: canvaHeaders(), params, timeout: 30000,
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401 && canvaTokenManager) {
      const recovery = await canvaTokenManager.handleCanva401();
      if (recovery.recovered) {
        CANVA_ACCESS_TOKEN = process.env.CANVA_ACCESS_TOKEN;
        const res = await axios.get(`${CANVA_API_BASE}${endpoint}`, {
          headers: canvaHeaders(), params, timeout: 30000,
        });
        return res.data;
      }
    }
    throw err;
  }
}

async function canvaPost(endpoint, data = {}) {
  try {
    const res = await axios.post(`${CANVA_API_BASE}${endpoint}`, data, {
      headers: canvaHeaders(), timeout: 30000,
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401 && canvaTokenManager) {
      const recovery = await canvaTokenManager.handleCanva401();
      if (recovery.recovered) {
        CANVA_ACCESS_TOKEN = process.env.CANVA_ACCESS_TOKEN;
        const res = await axios.post(`${CANVA_API_BASE}${endpoint}`, data, {
          headers: canvaHeaders(), timeout: 30000,
        });
        return res.data;
      }
    }
    throw err;
  }
}

// ─── Nano Banana (Google Gemini) Image Generation ──────────────────────────
// Uses Gemini's native image generation (Nano Banana 2) as primary hero strategy.
// Requires GEMINI_API_KEY in .env.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Generate a blog hero image using Google Nano Banana (Gemini image generation).
 * Now accepts an optional styleVariant to guarantee unique art direction per blog.
 *
 * @param {string} title - Article title
 * @param {string} tag - Article category tag
 * @param {string} meta - Article description
 * @param {string} outputPath - Where to save the PNG
 * @param {object} [styleVariant] - Style variant for uniqueness (from STYLE_VARIANTS)
 * @returns {Promise<{filePath: string}|null>}
 */
async function nanoBananaGenerateHero(title, tag, meta, outputPath, styleVariant) {
  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set — skipping Nano Banana strategy');
    return null;
  }

  const theme = BLOG_VISUAL_THEMES[tag] || 'bold abstract composition with geometric shapes and tech elements';
  const styleDirective = styleVariant
    ? `ART DIRECTION (MANDATORY): Use a ${styleVariant.desc} visual treatment as the primary background/composition style. This specific art direction MUST dominate the image. `
    : '';
  const dateSeed = `UNIQUE SEED: ${new Date().toISOString().split('T')[0]}-${crypto.randomBytes(4).toString('hex')} `;

  const prompt = `Create a wide blog hero image (16:9 aspect ratio, 1200x630 feel) for a marketing agency called "The Mediatwist Group". ` +
    `ARTICLE TITLE: "${title}" ` +
    `CATEGORY: ${tag} ` +
    `VISUAL THEME: ${theme} ` +
    `${styleDirective}` +
    `${dateSeed}` +
    `BRAND RULES: ` +
    `- Black (#0A0A0A) and yellow (#FFD600) color palette ONLY. No other colors. ` +
    `- Bold, premium, executive-level editorial design. ` +
    `- NO photos of people, NO portraits, NO faces, NO silhouettes. ` +
    `- Use abstract, architectural, data, or conceptual imagery. ` +
    `- The headline "${title}" should be the dominant text element in ultra-bold condensed uppercase white or yellow letters. ` +
    `- Small "${tag}" label/badge in the top-left area with yellow background. ` +
    `- Bottom-left 200x140px area MUST be empty dark space (logo goes there in post-production). ` +
    `- "@mediatwist" handle in the bottom-right corner. ` +
    `- Style: Like a premium magazine cover. Dark, confident, slightly futuristic. ` +
    `- This image MUST look completely different from any other blog hero — unique composition, unique background treatment, unique layout.`;

  logger.info(`Nano Banana prompt: ${prompt.substring(0, 200)}...`);

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: { aspectRatio: '16:9' },
        },
      },
      { timeout: 120000, headers: { 'Content-Type': 'application/json' } }
    );

    // Extract image from response
    const candidates = response.data?.candidates;
    if (!candidates || !candidates[0]?.content?.parts) {
      logger.warn('Nano Banana returned no candidates');
      return null;
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
        const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
        fs.writeFileSync(outputPath, imageBuffer);
        const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);
        logger.success(`Nano Banana generated ${sizeMB}MB image → ${path.basename(outputPath)}`);
        return { filePath: outputPath, source: 'nano-banana' };
      }
    }

    logger.warn('Nano Banana response contained no image data');
    return null;
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    logger.warn(`Nano Banana generation failed: ${errMsg}`);
    return null;
  }
}

// ─── Blog Hero Prompt Builders ───────────────────────────────────────────────

/**
 * Visual theme map — each blog tag maps to a visual concept
 * that Canva AI will use to generate the hero image.
 */
const BLOG_VISUAL_THEMES = {
  'Geofencing':          'digital map grid with glowing geofence boundary circles, location pins with yellow pulse rings, invisible boundary visualization',
  'Omnipresence':        'interconnected platform icons in a web/constellation, omnipresence network visualization, multi-channel connected grid',
  'Zero-Party Data':     'secure data vault with flowing data streams, privacy shield iconography, first-party data collection funnel',
  'Conference Targeting':'conference venue blueprint with geofence radius overlay, trade show floor map with targeting zones',
  'Paid Social':         'funnel architecture diagram with cold/warm/hot audience layers, paid media dashboard with conversion flow arrows',
  'Case Study':          'results dashboard with upward growth charts, campaign performance metrics, dramatic stat visualization',
  'Content Strategy':    'content web with interconnected nodes, editorial calendar grid, strategic content distribution map',
  'Brand Authority':     'authority tower with trust signals, premium brand elements, luxury positioning visual',
  'Reporting':            'data dashboard with clean charts, metrics display, results visualization with branded elements',
  'Growth Hacking':      'exponential growth curve, rocket trajectory, scaling arrows and acceleration metrics',
};

/**
 * Build the logo placement directive for blog hero images.
 * The logo is stamped via ImageMagick post-processing at bottom-left.
 */
function buildBlogLogoDirective() {
  return `CRITICAL LOGO ZONE (NON-NEGOTIABLE): ` +
    `The bottom-left corner of the canvas (approximately 200×140 pixel area) ` +
    `MUST be kept COMPLETELY EMPTY — solid black or dark background ONLY. ` +
    `No text, graphics, or decorations in this zone. ` +
    `The official Mediatwist logo will be stamped there in post-production. ` +
    `ALL text and design elements must stay ABOVE and to the RIGHT of this zone. ` +
    `Put "@mediatwist" at the BOTTOM-RIGHT corner (never bottom-left).`;
}

/**
 * Build a Canva AI prompt for a blog hero image.
 * Accepts optional styleVariant for guaranteed visual uniqueness.
 *
 * @param {string} title - Article title
 * @param {string} tag   - Article category tag
 * @param {string} meta  - Article subtitle/description
 * @param {object} [styleVariant] - Style variant for uniqueness
 * @returns {string} Prompt for Canva AI
 */
function buildBlogHeroPrompt(title, tag, meta, styleVariant) {
  const theme = BLOG_VISUAL_THEMES[tag] || 'bold abstract composition with geometric shapes and tech elements';
  const styleDirective = styleVariant
    ? `MANDATORY ART DIRECTION: Use a ${styleVariant.desc} visual treatment as the primary background/composition style. `
    : '';

  return `Create a STATIC blog hero image (NOT animated, NOT a video) for "The Mediatwist Group" marketing agency. ` +
    `${styleDirective}` +
    `This will be used as the featured image for a blog article. ` +
    `Design requirements: Black (#0A0A0A) background with yellow (#FFD600) accents ONLY — no other colors. ` +
    `FULL-WIDTH DESIGN: Use the ENTIRE canvas edge-to-edge with rich visual detail. No large empty margins. ` +
    `HEADLINE: Display the article title "${title}" in ultra-bold condensed uppercase font (Impact/Bebas Neue/Anton style). ` +
    `This is the signature Mediatwist look — giant, punchy, condensed block letters in yellow (#FFD600) or white. ` +
    `The headline should be the dominant visual element, taking up at least 40% of the canvas. ` +
    `CATEGORY TAG: Show "${tag}" as a small label/badge in the top-left area. ` +
    `VISUAL THEME: ${theme}. ` +
    `Use subtle background graphics that reinforce the article topic without competing with the headline. ` +
    `${buildBlogLogoDirective()} ` +
    `"@mediatwist" handle at the BOTTOM-RIGHT corner. ` +
    `LAYOUT ZONES: ` +
    `LOGO ZONE = bottom-left 200×140px area — MUST be completely empty dark space. ` +
    `HEADLINE ZONE = center and upper area of canvas (main text goes here). ` +
    `BACKGROUND = subtle thematic graphics in black/yellow palette behind the text. ` +
    `@MEDIATWIST = bottom-right corner ONLY. ` +
    `Style: Premium editorial magazine cover feel. Executive-level. No stock photo aesthetic. ` +
    `CRITICAL IMAGE RULES: ` +
    `1. NO photos of people — no portraits, no headshots, no silhouettes, no faces. ` +
    `2. Each blog hero MUST be visually unique — never reuse the same background, pattern, or layout across articles. ` +
    `3. Use varied Mediatwist logo variants as design elements (seal badge, 3D block logo, MT circle, characters banner) for variety. ` +
    `4. Try different layout styles: split panels, diagonal stripes, grid overlays, photo backgrounds with dark overlays, bold color blocks. ` +
    `Bold, confident, slightly futuristic.`;
}

// ─── Logo Overlay ────────────────────────────────────────────────────────────

const LOGO_PATH = path.resolve(__dirname, '../assets/logo-transparent.png');
const LOGO_FALLBACK = path.resolve(__dirname, '../assets/logo.png');

function getLogoPath() {
  if (fs.existsSync(LOGO_PATH)) return LOGO_PATH;
  if (fs.existsSync(LOGO_FALLBACK)) return LOGO_FALLBACK;
  logger.warn('No logo file found in assets/ — skipping overlay');
  return null;
}

/**
 * Stamp the Mediatwist logo onto a blog hero image.
 * Places logo in bottom-left corner at ~18% width with padding.
 *
 * @param {string} imagePath - Path to the exported image
 * @returns {string} Path to the image with logo
 */
function overlayBlogLogo(imagePath) {
  const logo = getLogoPath();
  if (!logo) return imagePath;

  try {
    // Logo at 80px wide, snug bottom-left corner with padding
    execSync(
      `convert "${imagePath}" \\( "${logo}" -resize 80x80 \\) ` +
      `-gravity SouthWest -geometry +20+12 -composite "${imagePath}"`,
      { stdio: 'pipe', timeout: 30000 }
    );
    logger.success('Mediatwist logo stamped on blog hero (bottom-left)');
  } catch (err) {
    logger.warn(`Logo overlay failed: ${err.message}`);
  }
  return imagePath;
}

// ─── Export Helpers (mirrors canvaEngine.js) ──────────────────────────────────

async function exportDesign(designId, format = 'png') {
  logger.info(`Exporting design ${designId} as ${format}...`);

  const formatConfig = {
    png: { type: 'png', lossless: true, export_quality: 'pro' },
    jpg: { type: 'jpg', quality: 95, export_quality: 'pro' },
  };

  const exportResult = await canvaPost('/exports', {
    design_id: designId,
    format: formatConfig[format] || formatConfig.png,
  });

  const job = exportResult.job || exportResult;

  if (job.status === 'success' && job.urls?.length > 0) {
    return job.urls[0];
  }

  const exportId = job.id;
  if (!exportId) {
    logger.error('No export job ID returned');
    return null;
  }

  // Poll for completion
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    try {
      const data = await canvaGet(`/exports/${exportId}`);
      const pollJob = data.job || data;

      if (pollJob.status === 'success' || pollJob.status === 'completed') {
        const urls = pollJob.urls || pollJob.result?.urls || [];
        if (urls.length > 0) {
          logger.success(`Export ready after ${(i + 1) * 5}s`);
          return urls[0];
        }
      }
      if (pollJob.status === 'failed') {
        logger.error(`Export ${exportId} failed`);
        return null;
      }
      logger.info(`Export polling: ${pollJob.status} (${(i + 1) * 5}s)`);
    } catch (err) {
      logger.warn(`Export poll error: ${err.message}`);
    }
  }

  logger.error(`Export timed out`);
  return null;
}

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

// ─── Main: Generate Blog Hero Image ──────────────────────────────────────────

/**
 * Generate a single blog hero image.
 *
 * @param {Object} article - Article data { title, tag, meta, id }
 * @param {Object} [options]
 * @param {string} [options.outputDir] - Output directory
 * @param {boolean} [options.dryRun] - Preview prompt only
 * @returns {Promise<{filePath: string, designId: string} | null>}
 */
async function generateBlogHero(article, options = {}) {
  const { outputDir = BLOG_HEROES_DIR, dryRun = false } = options;
  const { title, tag, meta, id } = article;

  logger.info(`\n${'═'.repeat(60)}`);
  logger.info(`Generating blog hero: "${title}"`);
  logger.info(`Tag: ${tag} | ID: ${id || 'auto'}`);
  logger.info('═'.repeat(60));

  // ── Pick a fresh style variant for guaranteed visual uniqueness ──
  const styleVariant = pickFreshStyleVariant();
  logger.info(`Style variant selected: ${styleVariant.id} — ${styleVariant.desc.substring(0, 60)}...`);

  // ── Check for duplicate (same title + same style = skip) ──
  if (isDuplicateImage(title, styleVariant.id)) {
    logger.warn(`Duplicate detected for "${title}" + style "${styleVariant.id}" — picking alternate style`);
    // Force a different variant
    const altVariants = STYLE_VARIANTS.filter(v => v.id !== styleVariant.id && !isDuplicateImage(title, v.id));
    if (altVariants.length > 0) {
      Object.assign(styleVariant, altVariants[Math.floor(Math.random() * altVariants.length)]);
      logger.info(`Alternate style: ${styleVariant.id}`);
    }
  }

  const prompt = buildBlogHeroPrompt(title, tag, meta);

  if (dryRun) {
    logger.info(`[DRY RUN] Style: ${styleVariant.id}`);
    logger.info(`[DRY RUN] Prompt preview:\n${prompt.substring(0, 300)}...`);
    return { filePath: null, designId: null, prompt, styleVariant: styleVariant.id };
  }

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  // Use timestamp in filename to prevent overwriting previous heroes for same article
  const slug = (id || title.substring(0, 30)).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const timestamp = Date.now().toString(36);
  const outputPath = path.join(outputDir, `hero-${slug}-${timestamp}.png`);

  // ── Strategy 0: Try Nano Banana (Google Gemini AI image generation) ──
  try {
    logger.info('Strategy 0: Nano Banana (Gemini AI image generation)...');
    const result = await nanoBananaGenerateHero(title, tag, meta, outputPath, styleVariant);
    if (result) {
      overlayBlogLogo(outputPath);
      recordGeneratedImage(article, 'nano-banana', styleVariant, outputPath);
      logger.success(`Blog hero ready (Nano Banana): ${path.basename(outputPath)}`);
      return { filePath: outputPath, designId: null, title, source: 'nano-banana', styleVariant: styleVariant.id };
    }
  } catch (err) {
    logger.warn(`Nano Banana failed: ${err.message}`);
  }

  // ── Strategy 1: Try Canva autofill with brand templates ──
  const token = process.env.CANVA_ACCESS_TOKEN || CANVA_ACCESS_TOKEN;
  if (token) {
    try {
      logger.info('Strategy 1: Canva brand template autofill...');
      const result = await canvaAutofillHero(title, tag, outputPath);
      if (result) {
        overlayBlogLogo(outputPath);
        recordGeneratedImage(article, 'canva-autofill', styleVariant, outputPath);
        logger.success(`Blog hero ready (Canva autofill): ${path.basename(outputPath)}`);
        return { filePath: outputPath, designId: result.designId, title, source: 'canva-autofill', styleVariant: styleVariant.id };
      }
    } catch (err) {
      logger.warn(`Canva autofill failed: ${err.response?.data?.message || err.response?.data?.error?.message || err.message}`);
    }

    // ── Strategy 2: Canva AI-generated design with brand kit ──
    try {
      logger.info('Strategy 2: Canva AI design generation (1200×630)...');
      const result = await canvaAIGeneratedHero(title, tag, styleVariant, outputPath);
      if (result) {
        overlayBlogLogo(outputPath);
        recordGeneratedImage(article, 'canva-ai', styleVariant, outputPath);
        logger.success(`Blog hero ready (Canva AI): ${path.basename(outputPath)}`);
        return { filePath: outputPath, designId: result.designId, title, source: 'canva-ai', styleVariant: styleVariant.id };
      }
    } catch (err) {
      logger.warn(`Canva AI design failed: ${err.response?.data?.message || err.response?.data?.error?.message || err.message}`);
    }
  }

  // ── Strategy 3: Local HTML-to-PNG (always works, no API needed) ──
  logger.info('Strategy 3: Local HTML-to-PNG generation (no API needed)...');
  try {
    const result = await generateLocalHero(title, tag, meta, outputPath);
    if (result) {
      overlayBlogLogo(outputPath);
      recordGeneratedImage(article, 'local', styleVariant, outputPath);
      logger.success(`Blog hero ready (local): ${path.basename(outputPath)}`);
      return { filePath: outputPath, designId: null, title, source: 'local', styleVariant: styleVariant.id };
    }
  } catch (err) {
    logger.error(`Local generation failed: ${err.message}`);
  }

  logger.error(`All strategies failed for "${title}"`);
  return null;
}

// ── Canva Strategy 1: Autofill with brand templates ──────────────────────────

// Cache discovered brand template IDs to avoid repeated lookups
let _brandTemplateCache = null;

async function discoverBrandTemplates() {
  if (_brandTemplateCache) return _brandTemplateCache;
  try {
    // List brand templates from the Canva account
    const data = await canvaGet('/brand-templates', { brand_kit_id: BRAND_KIT_ID });
    const templates = data.items || data.brand_templates || [];
    _brandTemplateCache = templates.map(t => t.id).filter(Boolean);
    if (_brandTemplateCache.length > 0) {
      logger.info(`Discovered ${_brandTemplateCache.length} brand templates for autofill`);
    } else {
      logger.warn('No brand templates found — autofill will be skipped');
    }
    return _brandTemplateCache;
  } catch (err) {
    logger.warn(`Brand template discovery failed: ${err.response?.data?.message || err.message}`);
    _brandTemplateCache = [];
    return _brandTemplateCache;
  }
}

async function canvaAutofillHero(title, tag, outputPath) {
  // Discover actual brand template IDs (not the brand kit ID!)
  const templateIds = await discoverBrandTemplates();
  if (templateIds.length === 0) return null;

  // Pick a random template from the discovered pool
  const templateId = templateIds[Math.floor(Math.random() * templateIds.length)];
  logger.info(`Using brand template: ${templateId}`);

  const autofillResult = await withRetry(
    () => canvaPost('/autofills', {
      brand_template_id: templateId,
      data: {
        headline: { type: 'text', text: title.toUpperCase() },
        category: { type: 'text', text: tag },
        handle: { type: 'text', text: '@mediatwist' },
      },
      title: `Blog Hero — ${title.substring(0, 40)}`,
    }),
    { attempts: 1, delayMs: 2000 }
  );

  const jobId = autofillResult.job?.id;
  if (!jobId) return null;

  // Poll for completion
  for (let i = 0; i < 12; i++) {
    await sleep(3000);
    const data = await canvaGet(`/autofills/${jobId}`);
    const job = data.job || data;
    if (job.status === 'success' || job.status === 'completed') {
      const design = job.result?.design || job.design;
      if (design?.id) {
        const downloadUrl = await exportDesign(design.id, 'png');
        if (downloadUrl) {
          await downloadExport(downloadUrl, outputPath);
          return { designId: design.id };
        }
      }
    }
    if (job.status === 'failed') return null;
  }
  return null;
}

// ── Canva Strategy 2: AI-generated design with brand kit ─────────────────────

async function canvaAIGeneratedHero(title, tag, styleVariant, outputPath) {
  // Use Canva's AI design generation with the Mediatwist brand kit
  // This produces actual designed content (not a blank canvas)
  const styleDesc = styleVariant?.desc || 'bold, dark, executive-level editorial';
  const prompt = `Blog hero image (1200x630) for a marketing agency. ` +
    `Title: "${title}" | Category: ${tag}. ` +
    `Style: ${styleDesc}. ` +
    `Color palette: black (#0A0A0A) and yellow (#FFD600) ONLY. ` +
    `Bold premium editorial design. The headline should be the dominant text. ` +
    `Leave bottom-left 200x140px empty for logo overlay.`;

  logger.info(`Canva AI design prompt: ${prompt.substring(0, 120)}...`);

  const generateResult = await withRetry(
    () => canvaPost('/designs/ai', {
      query: prompt,
      brand_kit_id: BRAND_KIT_ID,
      design_type: {
        type: 'custom',
        width: 1200,
        height: 630,
      },
      title: `Blog Hero — ${title.substring(0, 50)}`,
    }),
    { attempts: 2, delayMs: 3000 }
  );

  // Handle async job-based response
  const jobId = generateResult.job?.id;
  if (jobId) {
    for (let i = 0; i < 20; i++) {
      await sleep(3000);
      const data = await canvaGet(`/designs/ai/${jobId}`);
      const job = data.job || data;
      if (job.status === 'success' || job.status === 'completed') {
        const design = job.result?.design || job.design || (job.candidates && job.candidates[0]);
        const designId = design?.id || design?.design_id;
        if (designId) {
          const downloadUrl = await exportDesign(designId, 'png');
          if (downloadUrl) {
            await downloadExport(downloadUrl, outputPath);
            return { designId };
          }
        }
      }
      if (job.status === 'failed') {
        logger.warn(`Canva AI generation job failed: ${job.error?.message || 'unknown'}`);
        return null;
      }
    }
    return null;
  }

  // Handle synchronous response (direct design returned)
  const designData = generateResult.design || generateResult;
  const designId = designData.id;
  if (!designId) return null;

  logger.info(`AI design created: ${designId}`);
  const downloadUrl = await exportDesign(designId, 'png');
  if (!downloadUrl) return null;

  await downloadExport(downloadUrl, outputPath);
  return { designId };
}

// ── Strategy 3: Local HTML-to-PNG (ImageMagick, zero API dependency) ─────────

async function generateLocalHero(title, tag, meta, outputPath) {
  const theme = BLOG_VISUAL_THEMES[tag] || {};

  // Build branded hero image using ImageMagick convert (always available)
  // Creates a 1200×630 black/yellow hero with bold typography
  const lines = wrapText(title.toUpperCase(), 28); // ~28 chars per line for bold display

  // Build the ImageMagick command for a branded hero
  // Layout: tag badge top-left, headline in upper portion, logo tucked in bottom-left corner
  const fontSize = lines.length <= 2 ? 58 : lines.length <= 3 ? 48 : 40;
  const lineHeight = Math.round(fontSize * 1.3);
  const totalTextHeight = lines.length * lineHeight;
  // Place text in the upper area — leave bottom 180px clear for logo zone
  const availableHeight = 430;
  const startY = Math.max(110, Math.round((availableHeight - totalTextHeight) / 2) + 50);

  const cmdParts = [
    `convert -size 1200x630 xc:"#0A0A0A"`,
    // Yellow accent bar at top
    `-fill "#FFD600" -draw "rectangle 0,0 1200,5"`,
    // Category tag badge (top-left)
    `-fill "#FFD600" -draw "roundrectangle 50,24 ${50 + tag.length * 11 + 28},52 4,4"`,
    `-fill "#0A0A0A" -font "Helvetica-Bold" -pointsize 13`,
    `-annotate +64+44 "${tag.toUpperCase()}"`,
    // Small yellow accent line under tag
    `-fill "#FFD600" -draw "rectangle 50,62 140,64"`,
  ];

  // Main headline — large bold yellow text, each line
  lines.forEach((line, i) => {
    const y = startY + (i * lineHeight);
    cmdParts.push(
      `-fill "#FFD600" -font "Helvetica-Bold" -pointsize ${fontSize}`,
      `-annotate +50+${y} "${line.replace(/"/g, '\\"')}"`
    );
  });

  // Subtle decorative element — thin yellow vertical bar on right side
  cmdParts.push(`-fill "#FFD600" -draw "rectangle 1170,80 1174,400"`);

  // @mediatwist handle (bottom-right)
  cmdParts.push(
    `-fill "gray60" -font "Helvetica" -pointsize 13`,
    `-annotate +1075+612 "@mediatwist"`
  );

  // Yellow accent bar at bottom
  cmdParts.push(`-fill "#FFD600" -draw "rectangle 0,625 1200,630"`);

  // Output
  cmdParts.push(`"${outputPath}"`);

  execSync(cmdParts.join(' \\\n  '), { stdio: 'pipe', timeout: 30000 });
  logger.success(`Local hero generated: ${path.basename(outputPath)}`);
  return { filePath: outputPath };
}

/**
 * Wrap text into lines of approximately maxChars length, breaking at word boundaries.
 */
function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generate blog hero images for multiple articles.
 *
 * @param {Object[]} articles - Array of { title, tag, meta, id }
 * @param {Object} [options]
 * @returns {Promise<Object[]>} Array of results
 */
async function generateAllBlogHeroes(articles, options = {}) {
  const results = [];

  logger.info(`\n${'▓'.repeat(60)}`);
  logger.info(`BLOG HERO IMAGE GENERATOR`);
  logger.info(`Generating ${articles.length} hero images`);
  logger.info('▓'.repeat(60));

  for (let i = 0; i < articles.length; i++) {
    logger.info(`\n[${i + 1}/${articles.length}] Processing: "${articles[i].title}"`);

    const result = await generateBlogHero(articles[i], options);
    results.push({
      article: articles[i],
      result,
    });

    // Rate limiting: wait between generations
    if (i < articles.length - 1 && !options.dryRun) {
      logger.info('Waiting 3s before next generation...');
      await sleep(3000);
    }
  }

  // Summary
  const succeeded = results.filter(r => r.result?.filePath).length;
  const failed = results.filter(r => !r.result?.filePath && !options.dryRun).length;

  logger.info(`\n${'─'.repeat(60)}`);
  logger.info(`RESULTS: ${succeeded} succeeded, ${failed} failed, ${articles.length} total`);
  logger.info('─'.repeat(60));

  return results;
}

// ─── Seed Articles (from website) ────────────────────────────────────────────

const SEED_ARTICLES = [
  {
    id: 's1',
    title: 'Why Geofencing Is the Most Underused Weapon in Modern Marketing',
    tag: 'Geofencing',
    meta: 'We draw invisible boundaries around competitor locations and convert their foot traffic into your customers.',
  },
  {
    id: 's2',
    title: 'The Omnipresence Playbook: Be Everywhere Your Audience Looks',
    tag: 'Omnipresence',
    meta: 'Omnipresence is not about outspending — it is about out-positioning with coordinated cross-platform strategy.',
  },
  {
    id: 's3',
    title: 'Conference Geofencing: Own the Room Before You Walk In',
    tag: 'Conference Targeting',
    meta: 'We geofence venues, hotels, airports at industry conferences to reach decision-makers at their highest-intent moments.',
  },
  {
    id: 's4',
    title: 'Zero-Party Data: Why Owning Your Audience Is the Only Strategy That Scales',
    tag: 'Zero-Party Data',
    meta: 'Algorithm changes destroy businesses overnight. Zero-party data makes you immune.',
  },
  {
    id: 's5',
    title: 'Stop Boosting Posts: The Real Way to Run Paid Social',
    tag: 'Paid Social',
    meta: 'Boosting posts is lighting money on fire. We break down the exact conversion funnel architecture for Fortune 500 brands.',
  },
  {
    id: 's6',
    title: 'How Marketing Agencies Should Report Results',
    tag: 'Reporting',
    meta: 'Vanity metrics are dead. Here\'s what real reporting looks like — and why most agencies hide behind impressions.',
  },
];

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
  Blog Hero Image Generator — The Mediatwist Group
  ─────────────────────────────────────────────────

  Usage:
    node ai/blogImageEngine.js                       Generate heroes for all seed articles
    node ai/blogImageEngine.js --article "title"     Generate for a specific article
    node ai/blogImageEngine.js --dry-run             Preview prompts only (no API calls)
    node ai/blogImageEngine.js --output-dir ./path   Custom output directory
    node ai/blogImageEngine.js --help                Show this help

  Output:
    PNG files saved to outputs/blog-heroes/ (or custom dir)
    Each image is 1200×630 with Mediatwist logo stamped bottom-left.

  Environment:
    CANVA_ACCESS_TOKEN    Required — Canva Connect API token
    CANVA_BRAND_KIT_ID    Optional — defaults to Mediatwist kit
    `);
    return;
  }

  const dryRun = args.includes('--dry-run');
  const outputDir = args.includes('--output-dir')
    ? args[args.indexOf('--output-dir') + 1]
    : BLOG_HEROES_DIR;

  // Specific article?
  const articleIdx = args.indexOf('--article');
  if (articleIdx !== -1) {
    const search = args[articleIdx + 1];
    const article = SEED_ARTICLES.find(a =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.tag.toLowerCase().includes(search.toLowerCase()) ||
      a.id === search
    );
    if (!article) {
      logger.error(`Article not found: "${search}"`);
      logger.info('Available articles:');
      SEED_ARTICLES.forEach(a => logger.info(`  [${a.id}] ${a.title}`));
      process.exit(1);
    }
    await generateBlogHero(article, { outputDir, dryRun });
    return;
  }

  // All articles
  await generateAllBlogHeroes(SEED_ARTICLES, { outputDir, dryRun });
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Programmatic entry point (called from index.js --blog-heroes) ───────────

async function run(options = {}) {
  const { dryRun = false, articleTitle, outputDir = BLOG_HEROES_DIR } = options;
  try {
    if (articleTitle) {
      const article = SEED_ARTICLES.find(a =>
        a.title.toLowerCase().includes(articleTitle.toLowerCase()) ||
        a.tag.toLowerCase().includes(articleTitle.toLowerCase()) ||
        a.id === articleTitle
      );
      if (!article) {
        logger.error(`Article not found: "${articleTitle}"`);
        logger.info('Available articles:');
        SEED_ARTICLES.forEach(a => logger.info(`  [${a.id}] ${a.title}`));
        return { success: false, error: `Article not found: "${articleTitle}"` };
      }
      const result = await generateBlogHero(article, { outputDir, dryRun });
      return { success: true, results: [result] };
    }
    const results = await generateAllBlogHeroes(SEED_ARTICLES, { outputDir, dryRun });
    return { success: true, results };
  } catch (err) {
    logger.error(`Blog hero generation failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

function printHelp() {
  console.log(`
  Blog Hero Image Generator — The Mediatwist Group
  ─────────────────────────────────────────────────

  Usage:
    node index.js --blog-heroes                       Generate heroes for all seed articles
    node index.js --blog-heroes --article "title"     Generate for a specific article
    node index.js --blog-heroes --dry-run             Preview prompts only (no API calls)
    node index.js --blog-heroes --output-dir ./path   Custom output directory

  npm scripts:
    npm run blog:heroes          Generate all blog hero images
    npm run blog:heroes:dry      Preview prompts only
  `);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  generateBlogHero,
  generateAllBlogHeroes,
  nanoBananaGenerateHero,
  buildBlogHeroPrompt,
  buildBlogLogoDirective,
  overlayBlogLogo,
  run,
  printHelp,
  // Deduplication & style system
  loadImageHistory,
  saveImageHistory,
  pickFreshStyleVariant,
  recordGeneratedImage,
  isDuplicateImage,
  STYLE_VARIANTS,
  SEED_ARTICLES,
  BLOG_VISUAL_THEMES,
};

// Run standalone
if (require.main === module) {
  main().catch(err => {
    logger.error(`Fatal: ${err.message}`);
    process.exit(1);
  });
}
