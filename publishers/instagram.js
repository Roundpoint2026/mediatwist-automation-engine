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
const GRAPH_API_VERSION = 'v19.0';

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
  maxAttempts = 10,
  delayMs = 500
) {
  logger.info(`Polling container ${containerId} status...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(
        `https://graph.instagram.com/${GRAPH_API_VERSION}/${containerId}`,
        {
          params: {
            fields: 'status,id',
            access_token: accessToken,
          },
        }
      );

      const { status } = response.data;

      if (status === 'FINISHED') {
        logger.info(`Container status: ${status}`);
        return response.data;
      }

      if (status === 'ERROR') {
        throw new Error(`Container status is ERROR`);
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
 * @returns {Promise<object>} API response with post ID
 *
 * @throws {Error} If required env vars missing, validation fails, or API errors
 */
async function postToInstagram(mediaUrl, caption, options = {}) {
  const { mediaType: forcedMediaType = null, pollMaxAttempts = 10 } = options;

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
      containerPayload.video_url = mediaUrl;
      containerPayload.media_type = 'VIDEO';
    } else {
      containerPayload.image_url = mediaUrl;
    }

    const containerResult = await withRetry(
      () =>
        axios.post(
          `https://graph.instagram.com/${GRAPH_API_VERSION}/${IG_ACCOUNT_ID}/media`,
          containerPayload
        ),
      {
        attempts: 3,
        delayMs: 2000,
        backoff: 'exponential',
        onRetry: (attempt, error, nextDelay) => {
          logger.warn(
            `Container creation retry (attempt ${attempt}): ${error.message}. Waiting ${nextDelay}ms...`
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
      500
    );

    // Step 3: Publish container
    logger.info('Publishing Instagram media container...');

    const publishResult = await withRetry(
      () =>
        axios.post(
          `https://graph.instagram.com/${GRAPH_API_VERSION}/${IG_ACCOUNT_ID}/media_publish`,
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
    const msg = `postToInstagram: Failed: ${err.message}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

module.exports = { postToInstagram };
