/**
 * config/engine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central configuration for the Mediatwist content engine.
 * All tunables live here — no magic numbers in business logic.
 */

'use strict';

require('dotenv').config();

module.exports = {
  // ─── Brand ────────────────────────────────────────────────────────────────
  brand: {
    name: 'The Mediatwist Group',
    handle: '@mediatwist',
    tagline: 'Bold Strategy. Real Results.',
    colors: {
      primary:   '#FFD600',  // Yellow — main brand accent
      secondary: '#000000',  // Black — backgrounds & text
      dark:      '#0A0A0A',  // Near-black background
      darkAlt:   '#141414',  // Slightly lighter bg
      text:      '#FFFFFF',
      subtext:   '#CCCCCC',
      muted:     '#666666',
      accent:    '#FFD600',
    },
    tone: 'Bold, authoritative, slightly irreverent. Executive-level insight.',
    audience: 'CEOs, Marketing Directors, Operators',
  },

  // ─── Content Engine ──────────────────────────────────────────────────────
  content: {
    postsPerRun: 1,         // 1 post per platform per day
    platforms: ['facebook', 'instagram', 'linkedin'],
    maxCaptionLength: {
      facebook:  2000,
      instagram: 2200,
      linkedin:  3000,
    },
    categories: [
      'Industry Insight',
      'Contrarian Marketing Take',
      'Case Study Breakdown',
      'Founder/Operator Mindset',
      'Social Media Myth Busting',
      'AI & Marketing Strategy',
      'Growth Hacking',
      'Brand Authority',
      'Paid Media Intelligence',
      'Content Strategy',
    ],
  },

  // ─── Post Types ─────────────────────────────────────────────────────────
  // Controls the variety of visual post formats to keep the IG grid diverse.
  // Weights must sum to 1.0.
  postTypes: {
    enabled: ['video', 'static_image', 'carousel', 'illustration'],
    weights: {
      video:          0.30,  // Remotion animated text videos
      static_image:   0.30,  // Canva AI-generated branded images (no text overlay)
      carousel:       0.25,  // Multi-slide carousels (tips, data, quotes, storytelling)
      illustration:   0.15,  // Illustration / stop-motion style via Canva AI
    },
    carousel: {
      minSlides: 3,
      maxSlides: 7,
      styles: ['tips', 'data', 'quotes', 'storytelling'],
    },
  },

  // ─── Claude API ──────────────────────────────────────────────────────────
  claude: {
    apiKey:     process.env.ANTHROPIC_API_KEY || null,
    model:      process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    maxTokens:  1024,
    enabled:    !!process.env.ANTHROPIC_API_KEY,
  },

  // ─── Visual Engine ───────────────────────────────────────────────────────
  visual: {
    // Engine routing: 'canva-first' | 'remotion-first' | 'canva-only' | 'remotion-only' | 'random'
    engine:             process.env.VISUAL_ENGINE || 'canva-first',
    defaultComposition: process.env.REMOTION_COMPOSITION || 'FeedPost',
    outputDir:          'outputs',
    codec:              'h264',
    crf:                18,  // High quality
    compositions: {
      feed:    { id: 'FeedPost',        width: 1080, height: 1080, fps: 30, durationFrames: 300 },
      reels:   { id: 'ReelsPost',       width: 1080, height: 1920, fps: 30, durationFrames: 450 },
      caption: { id: 'BrandedCaption',  width: 1080, height: 1080, fps: 30, durationFrames: 240 },
    },
  },

  // ─── Canva ─────────────────────────────────────────────────────────────
  canva: {
    accessToken:   process.env.CANVA_ACCESS_TOKEN || null,
    brandKitId:    process.env.CANVA_BRAND_KIT_ID || 'kAFgjxJ3nmw',
    queueFolderId: process.env.CANVA_QUEUE_FOLDER_ID || 'FAHFM_9suzw',
    backgroundsFolderId: process.env.CANVA_BACKGROUNDS_FOLDER_ID || 'FAHFP77jWUQ',
    backgroundSubfolders: {
      quotes:    'FAHFPx33DuE',  // Quotes & Inspiration
      business:  'FAHFP0EKpZM',  // Business & Office
      abstract:  'FAHFP25xi28',  // Abstract & Textures
    },
    enabled:       !!process.env.CANVA_ACCESS_TOKEN,
  },

  // ─── Music / Audio ──────────────────────────────────────────────────────
  music: {
    enabled:        process.env.MUSIC_ENABLED !== 'false',   // Enabled by default
    volume:         parseFloat(process.env.MUSIC_VOLUME) || 0.18,  // Subtle (0-1)
    fadeInFrames:   30,   // 1 second at 30fps
    fadeOutFrames:  45,   // 1.5 seconds at 30fps
    pixabayApiKey:  process.env.PIXABAY_API_KEY || null,     // Optional — for auto-fetching
    trending: {
      enabled:      process.env.TRENDING_AUDIO_ENABLED !== 'false',  // Enabled by default
      cacheHours:   parseInt(process.env.TRENDING_AUDIO_CACHE_HOURS) || 6,
    },
  },

  // ─── Publishing ──────────────────────────────────────────────────────────
  publishing: {
    retryAttempts: 3,
    retryDelayMs:  2000,
    testMode:      process.env.TEST_MODE === 'true',
    graphApiVersion: 'v25.0',
  },

  // ─── Scheduler ───────────────────────────────────────────────────────────
  scheduler: {
    cronExpression: process.env.CRON_SCHEDULE || '30 8 * * *,0 20 * * *',  // Twice daily: 8:30 AM + 8:00 PM ET
    timezone:       process.env.TZ || 'America/New_York',
  },
};
