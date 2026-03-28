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
    enabled:       !!process.env.CANVA_ACCESS_TOKEN,
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
    cronExpression: process.env.CRON_SCHEDULE || '0 9 * * *',  // Daily at 9 AM
    timezone:       process.env.TZ || 'America/New_York',
  },
};
