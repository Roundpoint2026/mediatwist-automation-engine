/**
 * meta/uploadToCloudinary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Uploads a local file to Cloudinary and returns its secure public URL.
 * Supports both images and videos via resource_type detection.
 *
 * Required .env:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Exported:
 *   uploadToCloudinary(filePath, options?) → Promise<string>  (secure_url)
 */

'use strict';

require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');

// Configure once at module load time
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file to Cloudinary.
 *
 * @param {string} filePath           - Absolute or relative path to local file
 * @param {object} [options={}]       - Optional Cloudinary upload options
 * @param {string} [options.folder]   - Cloudinary folder (default: mediatwist/posts)
 * @param {string} [options.publicId] - Custom public ID (default: auto)
 * @returns {Promise<string>}         - The secure public URL of the uploaded asset
 */
async function uploadToCloudinary(filePath, options = {}) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('uploadToCloudinary: Missing Cloudinary credentials in .env');
  }

  const uploadOptions = {
    folder:        options.folder    || 'mediatwist/posts',
    resource_type: options.type      || 'video',
    overwrite:     true,
    ...(options.publicId ? { public_id: options.publicId } : {}),
  };

  const result = await cloudinary.uploader.upload(filePath, uploadOptions);

  if (!result?.secure_url) {
    throw new Error('uploadToCloudinary: Upload succeeded but no secure_url returned');
  }

  return result.secure_url;
}

module.exports = { uploadToCloudinary };
