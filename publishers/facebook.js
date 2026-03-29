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

/**
 * Posts a carousel (multi-image) to a Facebook Page.
 *
 * Flow:
 *   1. Upload each image as unpublished photo → get photo IDs
 *   2. Create a feed post with attached_media referencing those IDs
 *
 * @param {string[]} imageUrls - Array of publicly accessible image URLs (2-10)
 * @param {string} caption - Post caption/message text
 * @param {object} [options={}]
 * @param {boolean} [options.published=true]
 * @returns {Promise<object>} API response { id }
 */
async function postCarouselToFacebook(imageUrls, caption, options = {}) {
  const { published = true } = options;

  const { PAGE_ID, ACCESS_TOKEN } = process.env;
  if (!PAGE_ID) throw new Error('postCarouselToFacebook: PAGE_ID is not set in .env');
  if (!ACCESS_TOKEN) throw new Error('postCarouselToFacebook: ACCESS_TOKEN is not set in .env');
  if (!imageUrls || imageUrls.length < 2) throw new Error('postCarouselToFacebook: need at least 2 image URLs');

  logger.info(`Posting carousel to Facebook (${imageUrls.length} images, caption length: ${caption.length})`);

  try {
    // Step 1: Upload each image as unpublished photo to get media IDs
    const photoIds = [];
    for (const url of imageUrls) {
      const uploadResult = await withRetry(
        () => axios.post(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/photos`,
          {
            url,
            published: false,  // Unpublished — just get the ID
            access_token: ACCESS_TOKEN,
          }
        ),
        { attempts: 2, delayMs: 2000 }
      );
      if (uploadResult.data?.id) {
        photoIds.push(uploadResult.data.id);
        logger.info(`  Uploaded photo ${photoIds.length}/${imageUrls.length}: ${uploadResult.data.id}`);
      }
    }

    if (photoIds.length < 2) {
      throw new Error(`Only uploaded ${photoIds.length} photos — need at least 2 for carousel`);
    }

    // Step 2: Create the carousel post referencing all photo IDs
    const attachedMedia = photoIds.map(id => ({ media_fbid: id }));

    const result = await withRetry(
      () => axios.post(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/feed`,
        {
          message: caption,
          attached_media: attachedMedia,
          access_token: ACCESS_TOKEN,
          published,
        }
      ),
      { attempts: 3, delayMs: 2000, backoff: 'exponential' }
    );

    if (!result.data?.id) {
      throw new Error(`Carousel post response missing id: ${JSON.stringify(result.data)}`);
    }

    logger.success(`Posted carousel to Facebook: id=${result.data.id} (${photoIds.length} images)`);
    return result.data;

  } catch (err) {
    const msg = `postCarouselToFacebook: Failed: ${err.message}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

module.exports = { postToFacebook, postVideoToFacebook, postCarouselToFacebook };
