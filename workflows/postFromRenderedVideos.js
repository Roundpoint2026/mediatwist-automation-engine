/**
 * workflows/postFromRenderedVideos.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Takes Cloudinary video URLs + AI-generated post data, and posts each
 * video + caption to Facebook using the existing postToFacebook() function.
 *
 * This file is ONLY an orchestrator — it does NOT rewrite posting logic.
 * All Facebook API interaction happens inside meta/postToFacebook.js.
 *
 * Exported:
 *   postFromRenderedVideos(uploadResults, posts) → Promise<PostResult[]>
 *
 * PostResult:
 *   { postIndex, url, caption, success, response?, error? }
 */

'use strict';

require('dotenv').config();
const { postToFacebook } = require('../meta/postToFacebook');

/**
 * Posts each uploaded video to Facebook with its matching AI caption.
 *
 * @param {Array<{ postIndex: number, filePath: string, url: string }>} uploadResults
 * @param {Array<{ caption: string, scenes: Array }>} posts
 * @returns {Promise<Array<{ postIndex, url, caption, success, response?, error? }>>}
 */
async function postFromRenderedVideos(uploadResults, posts) {
  if (!Array.isArray(uploadResults) || uploadResults.length === 0) {
    throw new Error('postFromRenderedVideos: uploadResults must be a non-empty array');
  }
  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error('postFromRenderedVideos: posts must be a non-empty array');
  }

  const results = [];

  for (let i = 0; i < uploadResults.length; i++) {
    const { postIndex, url } = uploadResults[i];
    const post = posts[i];

    if (!post) {
      console.warn(`   [post] ⚠️  No post data for index ${i} — skipping`);
      continue;
    }
    if (!url) {
      console.warn(`   [post] ⚠️  No URL for post ${postIndex} — skipping`);
      continue;
    }

    const captionPreview = post.caption.split('\n')[0].slice(0, 80);
    console.log(`   [post] Posting to Facebook — post ${postIndex}`);
    console.log(`   [post] URL: ${url}`);
    console.log(`   [post] Caption: "${captionPreview}..."`);

    try {
      const response = await postToFacebook(url, post.caption);
      console.log(`   [post] ✅ Post ${postIndex} published — ID: ${response?.id || 'unknown'}`);

      results.push({
        postIndex,
        url,
        caption:  post.caption,
        success:  true,
        response,
      });

    } catch (err) {
      // Fail gracefully: log the error but continue with remaining posts
      console.error(`   [post] ❌ Post ${postIndex} failed: ${err.message}`);

      results.push({
        postIndex,
        url,
        caption: post.caption,
        success: false,
        error:   err.message,
      });
    }
  }

  return results;
}

module.exports = { postFromRenderedVideos };
