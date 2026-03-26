/**
 * workflows/uploadRenderedVideos.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads rendered MP4 files from /outputs and uploads each to Cloudinary.
 * Returns an array of upload results including the public Cloudinary URL.
 *
 * Called by runDailyEngine.js after renderVideos() completes.
 * Does not render — only uploads already-rendered files.
 *
 * Exported:
 *   uploadRenderedVideos(outputPaths) → Promise<UploadResult[]>
 *
 * UploadResult:
 *   { postIndex, filePath, url }
 */

'use strict';

require('dotenv').config();
const path = require('path');
const fs   = require('fs');

const { uploadToCloudinary } = require('../meta/uploadToCloudinary');

/**
 * Uploads a list of rendered MP4 files to Cloudinary.
 *
 * @param {string[]} outputPaths - Absolute paths to rendered MP4 files
 * @returns {Promise<Array<{ postIndex: number, filePath: string, url: string }>>}
 */
async function uploadRenderedVideos(outputPaths) {
  if (!Array.isArray(outputPaths) || outputPaths.length === 0) {
    throw new Error('uploadRenderedVideos: outputPaths must be a non-empty array');
  }

  const results = [];

  for (let i = 0; i < outputPaths.length; i++) {
    const filePath  = outputPaths[i];
    const postIndex = i + 1;
    const fileName  = path.basename(filePath);

    // Validate file exists before attempting upload
    if (!fs.existsSync(filePath)) {
      throw new Error(`uploadRenderedVideos: File not found: ${filePath}`);
    }

    const fileSizeKB = Math.round(fs.statSync(filePath).size / 1024);
    console.log(`   [upload] Post ${postIndex}: ${fileName} (${fileSizeKB} KB)`);

    try {
      const url = await uploadToCloudinary(filePath, {
        publicId: `post-${postIndex}-${Date.now()}`,
        folder:   'mediatwist/posts',
      });

      console.log(`   [upload] ✅ Post ${postIndex} → ${url}`);
      results.push({ postIndex, filePath, url });

    } catch (err) {
      throw new Error(`uploadRenderedVideos: Upload failed for post ${postIndex}: ${err.message}`);
    }
  }

  return results;
}

module.exports = { uploadRenderedVideos };
