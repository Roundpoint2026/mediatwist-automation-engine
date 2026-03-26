/**
 * remotion/buildVideoData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Transforms a raw post object (from generatePost.js) into structured props
 * that Remotion compositions can consume via inputProps.
 *
 * This is the bridge between AI output and the Remotion render pipeline.
 * It normalises the data so compositions don't need to know about the AI format.
 *
 * Exported:
 *   buildVideoData(post, index) → RemotionInputProps
 */

'use strict';

/**
 * Maps an AI scene style string to a Mediatwist brand color.
 * These match the MEDIATWIST_COLORS palette in src/lib/colors.ts.
 *
 * @param {string} style
 * @returns {string} hex color
 */
function styleToColor(style) {
  const MAP = {
    'bold-headline': '#6C63FF', // primary purple
    'stat':          '#4ECDC4', // teal — facts & numbers
    'emphasis':      '#FF6B6B', // accent red-pink
    'question':      '#6C63FF',
    'body':          '#ffffff',
    'cta':           '#FF6B6B',
  };
  return MAP[style] || '#6C63FF';
}

/**
 * Builds the inputProps object for a Remotion FeedPost (or any composition
 * that accepts { captionText, headline, subText, ctaText, brandColor }).
 *
 * @param {{ caption: string, scenes: Array<{text: string, style: string}> }} post
 * @param {number} index - 0-based post index
 * @returns {object} Remotion inputProps
 */
function buildVideoData(post, index) {
  if (!post) {
    throw new Error(`buildVideoData: post at index ${index} is null/undefined`);
  }
  if (typeof post.caption !== 'string') {
    throw new Error(`buildVideoData: post[${index}].caption must be a string`);
  }
  if (!Array.isArray(post.scenes) || post.scenes.length === 0) {
    throw new Error(`buildVideoData: post[${index}].scenes must be a non-empty array`);
  }

  const firstScene  = post.scenes[0];
  const lastScene   = post.scenes[post.scenes.length - 1];
  const middleScene = post.scenes.length > 2 ? post.scenes[1] : null;

  return {
    // ── Core composition props ──────────────────────────────────────────────
    captionText: firstScene.text,
    headline:    firstScene.text,
    subText:     middleScene?.text || '',
    ctaText:     lastScene.text,
    brandColor:  styleToColor(firstScene.style),

    // ── Full scene data (for multi-scene compositions) ─────────────────────
    scenes: post.scenes.map(scene => ({
      text:  scene.text,
      style: scene.style,
      color: styleToColor(scene.style),
    })),

    // ── Social caption (passed through for posting workflow) ───────────────
    caption: post.caption,

    // ── Metadata ────────────────────────────────────────────────────────────
    postIndex:   index + 1,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { buildVideoData };
