/**
 * publishers/linkedin.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Posts images to LinkedIn as personal or organization updates.
 *
 * If LINKEDIN_ORG_ID is set, posts as organization. Otherwise posts as person.
 *
 * Supports image uploads with automatic asset registration, upload, and publishing.
 * Includes retry logic and structured logging.
 *
 * Required .env:
 *   LINKEDIN_ACCESS_TOKEN - Personal access token with:
 *                           - w_member_social (personal posts)
 *                           - w_organization_social (org posts)
 *   LINKEDIN_ORG_ID        - (Optional) LinkedIn organization URN for org posts
 *                           Example: urn:li:organization:12345
 *
 * Exported:
 *   postToLinkedIn(imageUrl, caption, options?) → Promise<object>
 */

'use strict';

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  override: false,
});

const axios = require('axios');
const http = require('http');
const https = require('https');
const { withRetry } = require('./retry');
const { createLogger } = require('./logger');

const logger = createLogger('publisher:linkedin');

/**
 * Downloads a file from a URL and returns its binary buffer.
 * Handles HTTP redirects.
 *
 * @private
 * @param {string} url - File URL
 * @returns {Promise<Buffer>} File buffer
 */
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;

    mod
      .get(url, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(downloadFile(res.headers.location));
        }

        if (res.statusCode < 200 || res.statusCode > 299) {
          return reject(
            new Error(`Download failed with status ${res.statusCode}`)
          );
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

/**
 * Uploads binary file to a presigned LinkedIn upload URL.
 *
 * @private
 * @param {string} uploadUrl - LinkedIn presigned upload URL
 * @param {Buffer} buffer - File buffer
 * @param {string} accessToken - Access token
 * @returns {Promise<number>} HTTP status code
 */
async function uploadBinary(uploadUrl, buffer, accessToken) {
  return new Promise((resolve, reject) => {
    const u = new URL(uploadUrl);
    const protocol = u.protocol === 'https:' ? https : http;

    const req = protocol.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': buffer.length,
        },
      },
      (res) => {
        res.on('data', () => {}); // Drain response
        res.on('end', () => resolve(res.statusCode));
      }
    );

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

/**
 * Makes a JSON request to LinkedIn API.
 *
 * @private
 * @param {string} method - HTTP method
 * @param {string} path - API endpoint path
 * @param {object} body - Request body (will be JSON stringified)
 * @param {string} accessToken - Access token
 * @returns {Promise<object>} { status, body }
 */
async function makeJsonRequest(method, path, body, accessToken) {
  const payload = body ? JSON.stringify(body) : null;

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  };

  if (payload) {
    headers['Content-Length'] = Buffer.byteLength(payload);
  }

  try {
    const response = await axios({
      method,
      url: `https://api.linkedin.com${path}`,
      data: payload ? JSON.parse(payload) : undefined,
      headers,
    });

    return {
      status: response.status,
      body: response.data,
    };
  } catch (err) {
    if (err.response) {
      return {
        status: err.response.status,
        body: err.response.data,
      };
    }
    throw err;
  }
}

/**
 * Posts an image to LinkedIn as a personal or organization update.
 *
 * Steps:
 * 1. Get member ID (if posting as person)
 * 2. Register upload asset
 * 3. Download and upload image binary
 * 4. Create and publish post
 *
 * @param {string} imageUrl - Publicly accessible image URL
 * @param {string} caption - Post caption
 * @param {object} [options={}] - Additional options
 * @returns {Promise<object>} API response with post ID
 *
 * @throws {Error} If required env vars missing, validation fails, or API errors
 */
async function postToLinkedIn(imageUrl, caption, options = {}) {
  // Validate credentials
  const { LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORG_ID } = process.env;

  if (!LINKEDIN_ACCESS_TOKEN) {
    logger.warn(
      'postToLinkedIn: LINKEDIN_ACCESS_TOKEN not set — skipping LinkedIn'
    );
    return null;
  }

  // Validate arguments
  if (!imageUrl) {
    const msg = 'postToLinkedIn: imageUrl is required';
    logger.error(msg);
    throw new Error(msg);
  }

  if (!caption) {
    const msg = 'postToLinkedIn: caption is required';
    logger.error(msg);
    throw new Error(msg);
  }

  try {
    logger.info(`Posting to LinkedIn (org: ${LINKEDIN_ORG_ID ? 'yes' : 'no'})`);

    // Determine owner URN: organization or personal
    let ownerUrn;

    if (LINKEDIN_ORG_ID) {
      // Use organization directly
      ownerUrn = LINKEDIN_ORG_ID;
      logger.info(`Using organization owner: ${ownerUrn}`);
    } else {
      // Get personal member ID
      logger.info('Fetching LinkedIn member ID...');

      const meRes = await withRetry(
        () => makeJsonRequest('GET', '/v2/me', null, LINKEDIN_ACCESS_TOKEN),
        {
          attempts: 3,
          delayMs: 2000,
          backoff: 'exponential',
          onRetry: (attempt, error, nextDelay) => {
            logger.warn(
              `Member fetch retry (attempt ${attempt}): ${error.message}. Waiting ${nextDelay}ms...`
            );
          },
        }
      );

      if (meRes.status !== 200 || !meRes.body?.id) {
        const msg = `postToLinkedIn: Could not get member ID: ${JSON.stringify(meRes.body)}`;
        logger.error(msg);
        throw new Error(msg);
      }

      ownerUrn = `urn:li:person:${meRes.body.id}`;
      logger.info(`Using personal member owner: ${ownerUrn}`);
    }

    // Register upload asset
    logger.info('Registering image upload asset...');

    const registerRes = await withRetry(
      () =>
        makeJsonRequest(
          'POST',
          '/v2/assets?action=registerUpload',
          {
            registerUploadRequest: {
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
              owner: ownerUrn,
              serviceRelationships: [
                {
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent',
                },
              ],
            },
          },
          LINKEDIN_ACCESS_TOKEN
        ),
      {
        attempts: 3,
        delayMs: 2000,
        backoff: 'exponential',
        onRetry: (attempt, error, nextDelay) => {
          logger.warn(
            `Asset registration retry (attempt ${attempt}): ${error.message}. Waiting ${nextDelay}ms...`
          );
        },
      }
    );

    if (registerRes.status !== 200) {
      const msg = `postToLinkedIn: Asset registration failed (${registerRes.status}): ${JSON.stringify(registerRes.body)}`;
      logger.error(msg);
      throw new Error(msg);
    }

    const assetUrn = registerRes.body.value?.asset;
    const uploadUrl = registerRes.body.value?.uploadMechanism?.[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ]?.uploadUrl;

    if (!assetUrn || !uploadUrl) {
      const msg = `postToLinkedIn: Asset registration response missing asset/uploadUrl: ${JSON.stringify(registerRes.body)}`;
      logger.error(msg);
      throw new Error(msg);
    }

    logger.success(`Registered asset: ${assetUrn}`);

    // Download image
    logger.info('Downloading image from URL...');

    const imgBuffer = await downloadFile(imageUrl);
    logger.info(`Downloaded ${imgBuffer.length} bytes`);

    // Upload binary
    logger.info('Uploading image binary to LinkedIn...');

    const uploadStatus = await withRetry(
      () => uploadBinary(uploadUrl, imgBuffer, LINKEDIN_ACCESS_TOKEN),
      {
        attempts: 3,
        delayMs: 2000,
        backoff: 'exponential',
        onRetry: (attempt, error, nextDelay) => {
          logger.warn(
            `Image upload retry (attempt ${attempt}): ${error.message}. Waiting ${nextDelay}ms...`
          );
        },
      }
    );

    if (uploadStatus < 200 || uploadStatus > 299) {
      const msg = `postToLinkedIn: Image upload failed (status ${uploadStatus})`;
      logger.error(msg);
      throw new Error(msg);
    }

    logger.success(`Image uploaded (status ${uploadStatus})`);

    // Create and publish post
    logger.info('Creating and publishing LinkedIn post...');

    const postRes = await withRetry(
      () =>
        makeJsonRequest(
          'POST',
          '/v2/ugcPosts',
          {
            author: ownerUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text: caption },
                shareMediaCategory: 'IMAGE',
                media: [{ status: 'READY', media: assetUrn }],
              },
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
          },
          LINKEDIN_ACCESS_TOKEN
        ),
      {
        attempts: 3,
        delayMs: 2000,
        backoff: 'exponential',
        onRetry: (attempt, error, nextDelay) => {
          logger.warn(
            `Post creation retry (attempt ${attempt}): ${error.message}. Waiting ${nextDelay}ms...`
          );
        },
      }
    );

    if (postRes.status !== 201) {
      const msg = `postToLinkedIn: Post creation failed (${postRes.status}): ${JSON.stringify(postRes.body)}`;
      logger.error(msg);
      throw new Error(msg);
    }

    const post = postRes.body;

    logger.success(`Published to LinkedIn: ${JSON.stringify(post)}`);

    return post;
  } catch (err) {
    const msg = `postToLinkedIn: Failed: ${err.message}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

module.exports = { postToLinkedIn };
