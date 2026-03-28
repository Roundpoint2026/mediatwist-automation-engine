/**
 * publishers/facebook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Posts images and videos to Facebook Pages using Meta Graph API v20.0.
 *
 * Supports both image and video URLs.
 * Includes retry logic, structured logging, and response validation.
 *
 * Required .env:
 *   PAGE_ID        — Facebook Page ID
 *   ACCESS_TOKEN   — Long-lived page access token
 *
 * Exported:
 *   postToFacebook(mediaUrl, caption, options?) → Promise<object>
 *   postVideoToFacebook(videoUrl, caption, options?) → Promise<object>
 */

'use strict';

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  override: false,
});

const axios = require('axios');
const { withRetry } = require('./retry');
const { createLogger } = require('./logger');

const logger = createLogger('publisher:facebook');
const GRAPH_API_VERSION = 'v20.0';

/**
 * Posts an image URL + caption to a Facebook Page.
 *
 * @param {string} mediaUrl - Publicly accessible URL of the image
 * @param {string} caption - Post caption/message text
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.published=true] - Publish immediately or as draft
 * @returns {Promise<object>} API response { id, post_id }
 *
 * @throws {Error} If required env vars missing, validation fails, or API error after retries
 */
async function postToFacebook(mediaUrl, caption, options = {}) {
  const { published = true } = options;

  // Validate credentials
  const { PAGE_ID, ACCESS_TOKEN } = process.env;

  if (!PAGE_ID) {
    const msg = 'postToFacebook: PAGE_ID is not set in .env';
    logger.error(msg);
    throw new Error(msg);
  }

  if (!ACCESS_TOKEN) {
    const msg = 'postToFacebook: ACCESS_TOKEN is not set in .env';
    logger.error(msg);
    throw new Error(msg);
  }

  // Validate arguments
  if (!mediaUrl) {
    const msg = 'postToFacebook: mediaUrl is required';
    logger.error(msg);
    throw new Error(msg);
  }

  if (!caption) {
    const msg = 'postToFacebook: caption is required';
    logger.error(msg);
    throw new Error(msg);
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/photos`;

  logger.info(
    `Posting image to Facebook (published: ${published}, caption length: ${caption.length})`
  );

  try {
    const result = await withRetry(
      () =>
        axios.post(endpoint, {
          url: mediaUrl,
          caption,
          access_token: ACCESS_TOKEN,
          published,
        }),
      {
        attempts: 3,
        delayMs: 2000,
        backoff: 'exponential',
        onRetry: (attempt, error, nextDelay) => {
          logger.warn(
            `Facebook post retry (attempt ${attempt}): ${error.message}. Waiting ${nextDelay}ms...`
          );
        },
      }
    );

    const responseData = result.data;

    // Validate response
    if (!responseData?.id) {
      const msg = `postToFacebook: API response missing id field: ${JSON.stringify(responseData)}`;
      logger.error(msg);
      throw new Error(msg);
    }

    logger.success(
      `Posted to Facebook: id=${responseData.id}, post_id=${responseData.post_id || 'N/A'}`
    );

    return responseData;
  } catch (err) {
    const msg = `postToFacebook: Failed to post: ${err.message}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

/**
 * Posts a video URL + caption to a Facebook Page.
 *
 * Uses the /videos endpoint instead of /photos.
 * Facebook will handle transcoding and optimization.
 *
 * @param {string} videoUrl - Publicly accessible URL of the video
 * @param {string} caption - Post caption/message text
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.published=true] - Publish immediately or as draft
 * @returns {Promise<object>} API response { id, post_id }
 *
 * @throws {Error} If required env vars missing, validation fails, or API error after retries
 */
async function postVideoToFacebook(videoUrl, caption, options = {}) {
  const { published = true } = options;

  // Validate credentials
  const { PAGE_ID, ACCESS_TOKEN } = process.env;

  if (!PAGE_ID) {
    const msg = 'postVideoToFacebook: PAGE_ID is not set in .env';
    logger.error(msg);
    throw new Error(msg);
  }

  if (!ACCESS_TOKEN) {
    const msg = 'postVideoToFacebook: ACCESS_TOKEN is not set in .env';
    logger.error(msg);
    throw new Error(msg);
  }

  // Validate arguments
  if (!videoUrl) {
    const msg = 'postVideoToFacebook: videoUrl is required';
    logger.error(msg);
    throw new Error(msg);
  }

  if (!caption) {
    const msg = 'postVideoToFacebook: caption is required';
    logger.error(msg);
    throw new Error(msg);
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/videos`;

  logger.info(
    `Posting video to Facebook (published: ${published}, caption length: ${caption.length})`
  );

  try {
    const result = await withRetry(
      () =>
        axios.post(endpoint, {
          file_url: videoUrl,
          description: caption,
          access_token: ACCESS_TOKEN,
          published,
        }),
      {
        attempts: 3,
        delayMs: 2000,
        backoff: 'exponential',
        onRetry: (attempt, error, nextDelay) => {
          logger.warn(
            `Facebook video post retry (attempt ${attempt}): ${error.message}. Waiting ${nextDelay}ms...`
          );
        },
      }
    );

    const responseData = result.data;

    // Validate response
    if (!responseData?.id) {
      const msg = `postVideoToFacebook: API response missing id field: ${JSON.stringify(responseData)}`;
      logger.error(msg);
      throw new Error(msg);
    }

    logger.success(
      `Posted video to Facebook: id=${responseData.id}, post_id=${responseData.post_id || 'N/A'}`
    );

    return responseData;
  } catch (err) {
    const msg = `postVideoToFacebook: Failed to post video: ${err.message}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

module.exports = { postToFacebook, postVideoToFacebook };
