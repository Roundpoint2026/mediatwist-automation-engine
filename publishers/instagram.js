/**
 * publishers/instagram.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Posts images and videos to Instagram using Meta Graph API.
 *
 * Two-step flow: create media container → publish
 * Supports automatic detection of image vs. video.
 *
 * Includes retry logic, structured logging, and container status polling.
 *
 * Required .env:
 *   IG_ACCOUNT_ID      — Instagram Business Account ID
 *   ACCESS_TOKEN       — Long-lived access token with instagram_business_basic,
 *                        instagram_business_content_publish scopes
 *
 * Exported:
 *   postToInstagram(mediaUrl, caption, options?) → Promise<object>
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

const logger = createLogger('publisher:instagram');
const GRAPH_API_VERSION = 'v20.0';
const GRAPH_BASE = 'https://graph.facebook.com';

/**
 * Detects if URL points to a video based on file extension or Content-Type.
 * Falls back to image type if unable to determine.
 *
 * @private
 * @param {string} mediaUrl - URL to check
 * @returns {Promise<string>} 'IMAGE' or 'VIDEO'
 */
async function detectMediaType(mediaUrl) {
  try {
    const response = await axios.head(mediaUrl, {
      timeout: 5000,
    });

    const contentType = response.headers['content-type'] || '';
    if (contentType.startsWith('video/')) {
      return 'VIDEO';
    }

    // Check URL extension as fallback
    const ext = mediaUrl.split('?')[0].split('/').pop().split('.').pop().toLowerCase();
    const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'm3u8'];
    return videoExts.includes(ext) ? 'VIDEO' : 'IMAGE';
  } catch (err) {
    logger.warn(`Could not determine media type from URL, assuming IMAGE: ${err.message}`);
    return 'IMAGE';
  }
}

/**
 * Polls the container status until it's FINISHED or errors.
 *
 * @private
 * @param {string} containerId - Instagram media container ID
 * @param {string} accessToken - Access token
 * @param {number} maxAttempts - Max polling attempts
 * @param {number} delayMs - Delay between polls
 * @returns {Promise<object>} Container status response
 */
async function pollContainerStatus(
  containerId,
  accessToken,
  maxAttempts = 30,
  delayMs = 3000
) {
  logger.info(`Polling container ${containerId} status...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(
        `${GRAPH_BASE}/${GRAPH_API_VERSION}/${containerId}`,
        {
          params: {
            fields: 'status,status_code,id',
            access_token: accessToken,
          },
        }
      );

      const { status, status_code } = response.data;
      const code = (status_code || '').toUpperCase();
      const statusLower = (status || '').toLowerCase();

      if (code === 'FINISHED' || statusLower.startsWith('finished')) {
        logger.info(`Container ready: ${status}`);
        return response.data;
      }

      if (code === 'ERROR' || statusLower.startsWith('error')) {
        throw new Error(`Container status is ERROR: ${status}`);
      }

      logger.info(`Container status: ${status} (attempt ${attempt}/${maxAttempts})`);

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }

      logger.warn(`Polling error: ${err.message}. Retrying...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `Container status polling timeout after ${maxAttempts} attempts`
  );
}

/**
 * Posts an image or video to Instagram.
 *
 * Auto-detects media type. Uses create-and-publish flow.
 *
 * @param {string} mediaUrl - Publicly accessible URL (image or video)
 * @param {string} caption - Post caption
 * @param {object} [options={}] - Additional options
 * @param {string} [options.mediaType] - Force media type: 'IMAGE' or 'VIDEO'
 * @param {number} [options.pollMaxAttempts=10] - Container status polling max attempts
 * @param {string} [options.audioName] - Trending audio name to attach to Reels (IG music library)
 * @returns {Promise<object>} API response with post ID
 *
 * @throws {Error} If required env vars missing, validation fails, or API errors
 */
async function postToInstagram(mediaUrl, caption, options = {}) {
  const { mediaType: forcedMediaType = null, pollMaxAttempts = 30, audioName = null } = options;

  // Validate credentials
  const { IG_ACCOUNT_ID, ACCESS_TOKEN } = process.env;

  if (!IG_ACCOUNT_ID) {
    logger.warn(
      'postToInstagram: IG_ACCOUNT_ID not set in .env — skipping Instagram'
    );
    return null;
  }

  if (!ACCESS_TOKEN) {
    logger.warn(
      'postToInstagram: ACCESS_TOKEN not set in .env — skipping Instagram'
    );
    return null;
  }

  // Validate arguments
  if (!mediaUrl) {
    const msg = 'postToInstagram: mediaUrl is required';
    logger.error(msg);
    throw new Error(msg);
  }

  if (!caption) {
    const msg = 'postToInstagram: caption is required';
    logger.error(msg);
    throw new Error(msg);
  }

  try {
    // Detect media type
    const mediaType =
      forcedMediaType || (await detectMediaType(mediaUrl));
    logger.info(`Detected media type: ${mediaType}`);

    // Step 1: Create media container
    logger.info('Creating Instagram media container...');

    const containerPayload = {
      access_token: ACCESS_TOKEN,
      caption,
    };

    if (mediaType === 'VIDEO') {
      // Instagram deprecated VIDEO media type — all videos are now REELS
      containerPayload.video_url = mediaUrl;
      containerPayload.media_type = 'REELS';

      // Attach trending audio from Instagram's music library (if provided)
      if (audioName) {
        containerPayload.audio_name = audioName;
        logger.info(`Attaching trending audio: "${audioName}"`);
      }
    } else {
      containerPayload.image_url = mediaUrl;
    }

    const containerResult = await withRetry(
      () =>
        axios.post(
          `${GRAPH_BASE}/${GRAPH_API_VERSION}/${IG_ACCOUNT_ID}/media`,
          containerPayload
        ),
      {
        attempts: 3,
        delayMs: 2000,
        backoff: 'exponential',
        onRetry: (attempt, error, nextDelay) => {
          const apiErr = error.response?.data?.error;
          const detail = apiErr ? `${apiErr.message} (code: ${apiErr.code})` : error.message;
          logger.warn(
            `Container creation retry (attempt ${attempt}): ${detail}. Waiting ${nextDelay}ms...`
          );
        },
      }
    );

    const container = containerResult.data;

    if (!container?.id) {
      const msg = `postToInstagram: Container creation response missing id: ${JSON.stringify(container)}`;
      logger.error(msg);
      throw new Error(msg);
    }

    logger.success(`Created media container: ${container.id}`);

    // Step 2: Poll container status
    const containerId = container.id;
    await pollContainerStatus(
      containerId,
      ACCESS_TOKEN,
      pollMaxAttempts,
      3000
    );

    // Step 3: Publish container
    logger.info('Publishing Instagram media container...');

    const publishResult = await withRetry(
      () =>
        axios.post(
          `${GRAPH_BASE}/${GRAPH_API_VERSION}/${IG_ACCOUNT_ID}/media_publish`,
          {
            creation_id: containerId,
            access_token: ACCESS_TOKEN,
          }
        ),
      {
        attempts: 3,
        delayMs: 2000,
        backoff: 'exponential',
        onRetry: (attempt, error, nextDelay) => {
          logger.warn(
            `Publish retry (attempt ${attempt}): ${error.message}. Waiting ${nextDelay}ms...`
          );
        },
      }
    );

    const published = publishResult.data;

    if (!published?.id) {
      const msg = `postToInstagram: Publish response missing id: ${JSON.stringify(published)}`;
      logger.error(msg);
      throw new Error(msg);
    }

    logger.success(
      `Published to Instagram: post_id=${published.id}, media_type=${mediaType}`
    );

    return published;
  } catch (err) {
    // Extract detailed error from Facebook API response
    const apiError = err.response?.data?.error;
    const detail = apiError
      ? `${apiError.message} (code: ${apiError.code}, subcode: ${apiError.error_subcode || 'N/A'}, type: ${apiError.type})`
      : err.message;
    const msg = `postToInstagram: Failed: ${detail}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

/**
 * Posts a carousel (multi-image album) to Instagram.
 *
 * Flow:
 *   1. Create an item container for each image
 *   2. Create a carousel container referencing all item IDs
 *   3. Poll carousel container status
 *   4. Publish the carousel
 *
 * @param {string[]} imageUrls - Array of publicly accessible image URLs (2-10)
 * @param {string} caption - Post caption
 * @param {object} [options={}]
 * @returns {Promise<object>} API response with post ID
 */
async function postCarouselToInstagram(imageUrls, caption, options = {}) {
  const { pollMaxAttempts = 30 } = options;

  const { IG_ACCOUNT_ID, ACCESS_TOKEN } = process.env;
  if (!IG_ACCOUNT_ID) {
    logger.warn('postCarouselToInstagram: IG_ACCOUNT_ID not set — skipping');
    return null;
  }
  if (!ACCESS_TOKEN) {
    logger.warn('postCarouselToInstagram: ACCESS_TOKEN not set — skipping');
    return null;
  }
  if (!imageUrls || imageUrls.length < 2) {
    throw new Error('postCarouselToInstagram: need at least 2 image URLs');
  }

  logger.info(`Posting carousel to Instagram (${imageUrls.length} images)`);

  try {
    // Step 1: Create individual item containers for each image
    const childIds = [];
    for (const url of imageUrls) {
      const itemResult = await withRetry(
        () => axios.post(
          `${GRAPH_BASE}/${GRAPH_API_VERSION}/${IG_ACCOUNT_ID}/media`,
          {
            image_url: url,
            is_carousel_item: true,
            access_token: ACCESS_TOKEN,
          }
        ),
        { attempts: 2, delayMs: 2000 }
      );

      if (itemResult.data?.id) {
        childIds.push(itemResult.data.id);
        logger.info(`  Created carousel item ${childIds.length}/${imageUrls.length}: ${itemResult.data.id}`);
      }
    }

    if (childIds.length < 2) {
      throw new Error(`Only created ${childIds.length} items — need at least 2`);
    }

    // Step 2: Create the carousel container
    logger.info('Creating Instagram carousel container...');
    const carouselResult = await withRetry(
      () => axios.post(
        `${GRAPH_BASE}/${GRAPH_API_VERSION}/${IG_ACCOUNT_ID}/media`,
        {
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption,
          access_token: ACCESS_TOKEN,
        }
      ),
      { attempts: 3, delayMs: 2000, backoff: 'exponential' }
    );

    const carouselId = carouselResult.data?.id;
    if (!carouselId) {
      throw new Error(`Carousel container missing id: ${JSON.stringify(carouselResult.data)}`);
    }

    logger.success(`Created carousel container: ${carouselId}`);

    // Step 3: Poll container status
    await pollContainerStatus(carouselId, ACCESS_TOKEN, pollMaxAttempts, 3000);

    // Step 4: Publish
    logger.info('Publishing Instagram carousel...');
    const publishResult = await withRetry(
      () => axios.post(
        `${GRAPH_BASE}/${GRAPH_API_VERSION}/${IG_ACCOUNT_ID}/media_publish`,
        {
          creation_id: carouselId,
          access_token: ACCESS_TOKEN,
        }
      ),
      { attempts: 3, delayMs: 2000, backoff: 'exponential' }
    );

    if (!publishResult.data?.id) {
      throw new Error(`Carousel publish missing id: ${JSON.stringify(publishResult.data)}`);
    }

    logger.success(`Published carousel to Instagram: post_id=${publishResult.data.id} (${childIds.length} images)`);
    return publishResult.data;

  } catch (err) {
    const apiError = err.response?.data?.error;
    const detail = apiError
      ? `${apiError.message} (code: ${apiError.code})`
      : err.message;
    const msg = `postCarouselToInstagram: Failed: ${detail}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

module.exports = { postToInstagram, postCarouselToInstagram };
