/**
 * meta/postToFacebook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Posts an image or video URL + caption to a Facebook Page
 * using the Meta Graph API v20.0 /photos endpoint.
 *
 * dotenv is loaded here as a fallback so this file works whether called
 * from run.js (root) or from any subdirectory workflow.
 *
 * Required .env:
 *   PAGE_ID        — your Facebook Page ID
 *   ACCESS_TOKEN   — long-lived page access token
 *
 * Exported:
 *   postToFacebook(imageUrl, caption) → Promise<{ id, post_id }>
 */

'use strict';

const path = require('path');

// Load .env relative to the repo root (two levels up from /meta/)
// config({ override: false }) means it won't overwrite vars already loaded
require('dotenv').config({
  path:     path.resolve(__dirname, '../.env'),
  override: false,
});

const axios = require('axios');

const GRAPH_API_VERSION = 'v20.0';

/**
 * Posts an image/video URL + caption to a Facebook Page.
 *
 * @param {string} imageUrl  - Publicly accessible URL of the image or video
 * @param {string} caption   - Post caption / message text
 * @returns {Promise<object>} Facebook API response { id, post_id }
 */
async function postToFacebook(imageUrl, caption) {
  const { PAGE_ID, ACCESS_TOKEN } = process.env;

  // Validate required env vars
  if (!PAGE_ID)      throw new Error('postToFacebook: PAGE_ID is not set in .env');
  if (!ACCESS_TOKEN) throw new Error('postToFacebook: ACCESS_TOKEN is not set in .env');

  // Validate required arguments
  if (!imageUrl) throw new Error('postToFacebook: imageUrl is required');
  if (!caption)  throw new Error('postToFacebook: caption is required');

  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/photos`;

  const response = await axios.post(endpoint, {
    url:          imageUrl,
    caption:      caption,
    access_token: ACCESS_TOKEN,
  });

  return response.data;
}

module.exports = { postToFacebook };
