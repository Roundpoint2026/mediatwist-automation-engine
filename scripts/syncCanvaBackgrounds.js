#!/usr/bin/env node
/**
 * syncCanvaBackgrounds.js — Download Canva backgrounds to public/backgrounds/
 * ─────────────────────────────────────────────────────────────────────────────
 * Connects to Canva API, lists all designs in the Mediatwist Backgrounds
 * folders, exports each as PNG, and downloads to public/backgrounds/.
 *
 * Canva Background Folders:
 *   - FAHFP77jWUQ  — Mediatwist Backgrounds (parent)
 *   - FAHFPx33DuE  — Quotes & Inspiration
 *   - FAHFP25xi28  — Abstract & Textures
 *   - FAHFP0EKpZM  — Business & Office
 *
 * Usage:
 *   node scripts/syncCanvaBackgrounds.js           # Full sync
 *   node scripts/syncCanvaBackgrounds.js --quick    # Skip already-downloaded
 *   node scripts/syncCanvaBackgrounds.js --limit 5  # Only sync 5 per folder (testing)
 *
 * Requires: CANVA_ACCESS_TOKEN in .env
 */
'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
const CANVA_ACCESS_TOKEN = process.env.CANVA_ACCESS_TOKEN;

const BG_FOLDERS = {
  'quotes':   'FAHFPx33DuE',
  'abstract': 'FAHFP25xi28',
  'business': 'FAHFP0EKpZM',
};

const OUTPUT_DIR = path.resolve(__dirname, '../public/backgrounds');
const MANIFEST_PATH = path.join(OUTPUT_DIR, '.manifest.json');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const QUICK_MODE = args.includes('--quick');
const limitIdx = args.indexOf('--limit');
const PER_FOLDER_LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function canvaHeaders() {
  return {
    'Authorization': `Bearer ${CANVA_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function canvaGet(endpoint, params = {}) {
  const res = await axios.get(`${CANVA_API_BASE}${endpoint}`, {
    headers: canvaHeaders(),
    params,
  });
  return res.data;
}

async function canvaPost(endpoint, data = {}) {
  const res = await axios.post(`${CANVA_API_BASE}${endpoint}`, data, {
    headers: canvaHeaders(),
  });
  return res.data;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sanitizeFilename(title, id) {
  const clean = title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 60);
  return `${clean}-${id.substring(0, 8)}.png`;
}

// ─── Load/Save Manifest ──────────────────────────────────────────────────────
// Tracks which designs have been synced to avoid re-exporting
function loadManifest() {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    }
  } catch (_) {}
  return { synced: {}, lastSync: null };
}

function saveManifest(manifest) {
  manifest.lastSync = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ─── List designs in a folder ────────────────────────────────────────────────
async function listFolderDesigns(folderId) {
  const designs = [];
  let continuation = null;

  do {
    const params = { item_types: 'design' };
    if (continuation) params.continuation = continuation;

    const data = await canvaGet(`/folders/${folderId}/items`, params);
    if (data.items) {
      for (const item of data.items) {
        if (item.type === 'design' && item.design) {
          designs.push({
            id: item.design.id,
            title: item.design.title || 'untitled',
          });
        }
      }
    }
    continuation = data.continuation || null;
  } while (continuation);

  return designs;
}

// ─── Export a design as PNG ──────────────────────────────────────────────────
async function exportDesignAsPng(designId) {
  try {
    // Start export job
    const exportData = await canvaPost('/exports', {
      design_id: designId,
      format: { type: 'png', width: 1080, quality: 'high' },
    });

    const exportId = exportData.job?.id;
    if (!exportId) {
      console.error(`  ✗ No export job ID for ${designId}`);
      return null;
    }

    // Poll for completion (max ~60 seconds)
    for (let i = 0; i < 12; i++) {
      await sleep(5000);
      const status = await canvaGet(`/exports/${exportId}`);

      if (status.job?.status === 'success') {
        const url = status.job?.result?.url || status.job?.urls?.[0];
        if (url) return url;
        // Try alternate response shapes
        if (status.job?.result?.urls) return status.job.result.urls[0];
        console.error(`  ✗ Export succeeded but no URL in response for ${designId}`);
        return null;
      }
      if (status.job?.status === 'failed') {
        console.error(`  ✗ Export failed for ${designId}: ${status.job?.error?.message || 'unknown'}`);
        return null;
      }
    }
    console.error(`  ✗ Export timed out for ${designId}`);
    return null;
  } catch (err) {
    console.error(`  ✗ Export error for ${designId}: ${err.message}`);
    return null;
  }
}

// ─── Download a file ─────────────────────────────────────────────────────────
async function downloadFile(url, outputPath) {
  const res = await axios.get(url, { responseType: 'stream' });
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// ─── Main Sync ───────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     CANVA BACKGROUNDS SYNC — Mediatwist Automation Engine  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (!CANVA_ACCESS_TOKEN) {
    console.error('✗ CANVA_ACCESS_TOKEN not set in .env — cannot sync');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const manifest = loadManifest();
  let totalSynced = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const [folderName, folderId] of Object.entries(BG_FOLDERS)) {
    console.log(`\n── ${folderName.toUpperCase()} (${folderId}) ──`);

    let designs;
    try {
      designs = await listFolderDesigns(folderId);
    } catch (err) {
      console.error(`  ✗ Failed to list folder: ${err.message}`);
      continue;
    }

    console.log(`  Found ${designs.length} designs`);

    // Apply per-folder limit if set
    const toSync = PER_FOLDER_LIMIT > 0 ? designs.slice(0, PER_FOLDER_LIMIT) : designs;

    for (const design of toSync) {
      const filename = sanitizeFilename(design.title, design.id);
      const outputPath = path.join(OUTPUT_DIR, filename);

      // Skip if already synced (quick mode or file exists)
      if (QUICK_MODE && manifest.synced[design.id]) {
        const existingFile = manifest.synced[design.id].filename;
        if (fs.existsSync(path.join(OUTPUT_DIR, existingFile))) {
          totalSkipped++;
          continue;
        }
      }

      console.log(`  ↓ ${design.title.substring(0, 50)}...`);

      // Export as PNG
      const downloadUrl = await exportDesignAsPng(design.id);
      if (!downloadUrl) {
        totalFailed++;
        continue;
      }

      // Download to public/backgrounds/
      try {
        await downloadFile(downloadUrl, outputPath);
        manifest.synced[design.id] = {
          filename,
          folder: folderName,
          title: design.title,
          syncedAt: new Date().toISOString(),
        };
        totalSynced++;
        console.log(`  ✓ ${filename}`);
      } catch (err) {
        console.error(`  ✗ Download failed: ${err.message}`);
        totalFailed++;
      }

      // Rate limiting — be gentle with Canva API
      await sleep(2000);
    }
  }

  saveManifest(manifest);

  console.log('\n── SYNC COMPLETE ──');
  console.log(`  ✓ Synced:  ${totalSynced}`);
  console.log(`  ⊘ Skipped: ${totalSkipped}`);
  console.log(`  ✗ Failed:  ${totalFailed}`);
  console.log(`  Total backgrounds in folder: ${fs.readdirSync(OUTPUT_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f)).length}`);
}

main().catch(err => {
  console.error('Fatal sync error:', err.message);
  process.exit(1);
});
