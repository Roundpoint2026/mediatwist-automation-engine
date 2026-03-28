/**
 * publishers/cloudinary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cloudinary media upload with retry logic and structured logging.
 *
 * Detects resource type (image/video) from file extension.
 * Organizes uploads by date: mediatwist/posts/YYYY-MM-DD/
 *
 * Required .env:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Exported:
 *   uploadMedia(filePath, options?) → Promise<string>  (secure_url)
 */

'use strict';

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  override: false,
});

const { v2: cloudinary } = require('cloudinary');
const { withRetry } = require('./retry');
const { createLogger } = require('./logger');

const logger = createLogger('publisher:cloudinary');

// Configure Cloudinary once at module load time
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Detects resource type from file extension.
 * @private
 * @param {string} filePath - Path to file
 * @returns {string} 'image' or 'video'
 */
function detectResourceType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const videoExts = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
  return videoExts.includes(ext) ? 'video' : 'image';
}

/**
 * Gets the folder path for today's uploads.
 * @private
 * @returns {string} Folder path (mediatwist/posts/YYYY-MM-DD)
 */
function getFolderPath() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `mediatwist/posts/${year}-${month}-${day}`;
}

/**
 * Uploads a local file (image or video) to Cloudinary.
 *
 * @param {string} filePath - Absolute or relative path to local file
 * @param {object} [options={}] - Upload options
 * @param {string} [options.folder] - Cloudinary folder (default: dated)
 * @param {string} [options.publicId] - Custom public ID (default: auto)
 * @param {boolean} [options.overwrite=true] - Overwrite if exists
 * @returns {Promise<string>} Secure public URL of uploaded asset
 *
 * @throws {Error} If validation fails or upload fails after retries
 */
async function uploadMedia(filePath, options = {}) {
  const {
    folder = getFolderPath(),
    publicId = undefined,
    overwrite = true,
  } = options;

  // Validate required env vars
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const msg =
      'uploadMedia: Missing Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)';
    logger.error(msg);
    throw new Error(msg);
  }

  // Validate file path
  if (!filePath) {
    const msg = 'uploadMedia: filePath is required';
    logger.error(msg);
    throw new Error(msg);
  }

  const resourceType = detectResourceType(filePath);
  logger.info(
    `Uploading ${resourceType} from ${filePath} to folder: ${folder}`
  );

  const uploadOptions = {
    folder,
    resource_type: resourceType,
    overwrite,
    ...(publicId ? { public_id: publicId } : {}),
  };

  try {
    const result = await withRetry(
      () => cloudinary.uploader.upload(filePath, uploadOptions),
      {
        attempts: 3,
        delayMs: 2000,
        backoff: 'exponential',
        onRetry: (attempt, error, nextDelay) => {
          logger.warn(
            `Upload retry (attempt ${attempt}): ${error.message}. Waiting ${nextDelay}ms...`
          );
        },
      }
    );

    if (!result?.secure_url) {
      const msg =
        'uploadMedia: Upload succeeded but no secure_url returned from API';
      logger.error(msg);
      throw new Error(msg);
    }

    logger.success(
      `Uploaded ${resourceType} to Cloudinary: ${result.secure_url}`
    );
    return result.secure_url;
  } catch (err) {
    const msg = `uploadMedia: Upload failed: ${err.message}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

module.exports = { uploadMedia };
