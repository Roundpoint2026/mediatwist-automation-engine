/**
 * music/trendingAudio.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Audio branding for Instagram and Facebook Reels.
 *
 * IMPORTANT — Platform music limitation:
 *   Instagram and Facebook do NOT expose their licensed music library via API.
 *   Trending/licensed audio can ONLY be added through the native mobile app.
 *   This is a hard platform restriction — not a bug.
 *
 * What this module DOES do:
 *   - Generates a branded `audio_name` label for Reels
 *   - The `audio_name` param renames the audio track viewers see on your Reel
 *     (from "Original Audio" → your branded name)
 *   - Maps content categories to compelling audio labels
 *
 * How audio actually works in the pipeline:
 *   1. Remotion renders the video (visual only — audio is unreliable in SSR)
 *   2. ffmpeg merges a mood-matched background track into the MP4
 *   3. The video is uploaded to FB/IG/LinkedIn WITH audio baked in
 *   4. `audio_name` brands the audio label on Instagram Reels
 *
 * Required .env:
 *   (none — this module has no external dependencies)
 *
 * Exported:
 *   getAudioBranding(category, trackFilename) → { audioName, ig, fb }
 */

'use strict';

// ─── Category → Audio branding map ──────────────────────────────────────────
// These labels show up on Instagram Reels as the audio track name.
// They should be compelling, brandable, and category-appropriate.

const AUDIO_LABEL_MAP = {
  'Industry Insight':            'Mediatwist · Industry Signal',
  'Contrarian Marketing Take':   'Mediatwist · The Contrarian',
  'Case Study Breakdown':        'Mediatwist · Case Files',
  'Founder/Operator Mindset':    'Mediatwist · Founder Mode',
  'Social Media Myth Busting':   'Mediatwist · Myth Busted',
  'AI & Marketing Strategy':     'Mediatwist · AI Playbook',
  'Growth Hacking':              'Mediatwist · Growth Engine',
  'Brand Authority':             'Mediatwist · Brand Power',
  'Paid Media Intelligence':     'Mediatwist · Media Intel',
  'Content Strategy':            'Mediatwist · Content Lab',
};

const DEFAULT_LABEL = 'Mediatwist · Original';

/**
 * Generate audio branding parameters for a post.
 *
 * Returns the `audio_name` to attach when publishing Instagram Reels.
 * This brands your audio track with a category-specific label instead
 * of the default "Original Audio".
 *
 * @param {string} category — Content category name
 * @param {string} [trackFilename] — Background track filename (for reference)
 * @returns {object} — { audioName, ig: { audio_name }, label }
 */
function getAudioBranding(category, trackFilename = null) {
  const label = AUDIO_LABEL_MAP[category] || DEFAULT_LABEL;

  return {
    audioName: label,
    ig: {
      audio_name: label,  // IG Reels container parameter — brands the audio track
    },
    label,
    trackFilename,
  };
}

/**
 * Preview audio branding for all categories (CLI utility).
 */
function previewBranding() {
  console.log('\n 🎵  Audio Branding Preview');
  console.log('═'.repeat(50));
  console.log('\n These labels appear as the audio track name on Instagram Reels:\n');

  Object.entries(AUDIO_LABEL_MAP).forEach(([category, label]) => {
    console.log(`  ${category}`);
    console.log(`    → "${label}"\n`);
  });

  console.log('═'.repeat(50));
  console.log(' ℹ️  Platform note: Instagram and Facebook do NOT expose their');
  console.log('    licensed music library via API. Trending audio can only be');
  console.log('    added through the native mobile app. Our audio is baked');
  console.log('    into the video via ffmpeg before upload.\n');
}

if (require.main === module) {
  previewBranding();
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  getAudioBranding,
  AUDIO_LABEL_MAP,
  DEFAULT_LABEL,
};
