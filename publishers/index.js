/**
 * publishers/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified publisher interface for all social platforms.
 *
 * Orchestrates publishing to Facebook, Instagram, and LinkedIn with:
 * - Parallel requests (fast)
 * - Individual retry logic per platform
 * - Graceful credential handling (skip missing platforms, don't crash)
 * - Test mode support (log but don't post)
 * - Structured logging and error handling
 *
 * Exported:
 *   publishToAll(post, mediaUrl, options?) → Promise<{ facebook, instagram, linkedin }>
 */

'use strict';

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  override: false,
});

const config = require('../config/engine');
const { postToFacebook, postVideoToFacebook } = require('./facebook');
const { postToInstagram } = require('./instagram');
const { postToLinkedIn } = require('./linkedin');
const { createLogger } = require('./logger');

const logger = createLogger('publisher:orchestrator');

/**
 * Publishes a post to all configured platforms.
 *
 * @param {object} post - Post data
 * @param {string} post.caption - Post text (will be truncated per platform limits)
 * @param {string} post.imageUrl - Image URL (optional, required for image posts)
 * @param {string} post.videoUrl - Video URL (optional, required for video posts)
 * @param {object} [post.overrides] - Platform-specific overrides
 * @param {string} [post.overrides.facebook] - Override caption for Facebook
 * @param {string} [post.overrides.instagram] - Override caption for Instagram
 * @param {string} [post.overrides.linkedin] - Override caption for LinkedIn
 *
 * @param {string} mediaUrl - Primary media URL (if not specified in post)
 *
 * @param {object} [options={}] - Publishing options
 * @param {boolean} [options.skipPlatforms=[]] - Platforms to skip (e.g., ['instagram'])
 * @returns {Promise<object>} Results per platform:
 *   {
 *     facebook: { success: boolean, data?: object, error?: string },
 *     instagram: { success: boolean, data?: object, error?: string },
 *     linkedin: { success: boolean, data?: object, error?: string }
 *   }
 *
 * @throws {Error} Only if both post and mediaUrl are missing, or other critical validation fails
 *
 * @example
 * const result = await publishToAll(
 *   {
 *     caption: 'Bold take on marketing...',
 *     imageUrl: 'https://example.com/image.jpg',
 *     overrides: {
 *       linkedin: 'Extended LinkedIn version with more detail...'
 *     }
 *   },
 *   null,  // mediaUrl not needed (imageUrl in post)
 *   { skipPlatforms: ['linkedin'] }
 * );
 *
 * console.log(result);
 * // {
 * //   facebook: { success: true, data: { id: '...' } },
 * //   instagram: { success: true, data: { id: '...' } },
 * //   linkedin: { success: false, error: 'LINKEDIN_ACCESS_TOKEN not set' }
 * // }
 */
async function publishToAll(post, mediaUrl, options = {}) {
  const { skipPlatforms = [] } = options;

  // Test mode check
  const testMode = config.publishing.testMode;

  // Validate inputs
  if (!post) {
    const msg = 'publishToAll: post object is required';
    logger.error(msg);
    throw new Error(msg);
  }

  const {
    caption,
    imageUrl,
    videoUrl,
    overrides = {},
  } = post;

  // Determine media URL to use
  const effectiveMediaUrl = imageUrl || videoUrl || mediaUrl;

  if (!effectiveMediaUrl) {
    const msg = 'publishToAll: imageUrl, videoUrl, or mediaUrl parameter is required';
    logger.error(msg);
    throw new Error(msg);
  }

  if (!caption) {
    const msg = 'publishToAll: caption is required';
    logger.error(msg);
    throw new Error(msg);
  }

  // Detect if media is video
  const isVideo = videoUrl ? true : (effectiveMediaUrl?.includes('.mp4') ||
                                     effectiveMediaUrl?.includes('.webm') ||
                                     effectiveMediaUrl?.includes('.mov'));

  logger.info(
    `Publishing to all platforms (test mode: ${testMode}, media: ${isVideo ? 'video' : 'image'})`
  );

  // Truncate captions per platform limits
  const getTruncatedCaption = (platform) => {
    const overrideCaption = overrides[platform];
    const text = overrideCaption || caption;
    const limit = config.content.maxCaptionLength[platform];
    return text.length > limit ? text.substring(0, limit - 3) + '...' : text;
  };

  // Platform-specific publishers
  const publishers = {
    facebook: {
      name: 'Facebook',
      shouldSkip: () => skipPlatforms.includes('facebook'),
      publish: async () => {
        if (isVideo && videoUrl) {
          return postVideoToFacebook(
            videoUrl,
            getTruncatedCaption('facebook'),
            { published: !testMode }
          );
        }
        return postToFacebook(
          effectiveMediaUrl,
          getTruncatedCaption('facebook'),
          { published: !testMode }
        );
      },
    },

    instagram: {
      name: 'Instagram',
      shouldSkip: () => skipPlatforms.includes('instagram') || !imageUrl && !isVideo,
      publish: async () => {
        return postToInstagram(
          effectiveMediaUrl,
          getTruncatedCaption('instagram')
        );
      },
    },

    linkedin: {
      name: 'LinkedIn',
      shouldSkip: () => skipPlatforms.includes('linkedin') || isVideo,
      publish: async () => {
        return postToLinkedIn(
          effectiveMediaUrl,
          getTruncatedCaption('linkedin')
        );
      },
    },
  };

  // Execute publishers in parallel
  const results = {};

  await Promise.all(
    Object.entries(publishers).map(async ([key, publisher]) => {
      if (publisher.shouldSkip()) {
        logger.info(`${publisher.name}: Skipped`);
        results[key] = {
          success: false,
          error: 'Platform skipped',
        };
        return;
      }

      try {
        if (testMode) {
          logger.info(
            `${publisher.name}: TEST MODE - would publish (caption length: ${getTruncatedCaption(key).length})`
          );
          results[key] = {
            success: true,
            data: { id: 'test-mode-' + Date.now() },
            testMode: true,
          };
          return;
        }

        logger.info(`${publisher.name}: Publishing...`);
        const data = await publisher.publish();

        results[key] = {
          success: true,
          data,
        };

        logger.success(`${publisher.name}: Published`);
      } catch (err) {
        const errorMsg = err.message;

        // If credentials missing, just log and skip (don't treat as failure)
        if (
          errorMsg.includes('not set in .env') ||
          errorMsg.includes('not set —')
        ) {
          logger.warn(`${publisher.name}: Credentials missing, skipped`);
          results[key] = {
            success: false,
            error: 'Credentials not configured',
          };
        } else {
          logger.error(`${publisher.name}: ${errorMsg}`);
          results[key] = {
            success: false,
            error: errorMsg,
          };
        }
      }
    })
  );

  // Summary
  const successCount = Object.values(results).filter((r) => r.success).length;
  logger.info(
    `Publishing complete: ${successCount}/${Object.keys(publishers).length} platforms succeeded`
  );

  return results;
}

module.exports = { publishToAll };
