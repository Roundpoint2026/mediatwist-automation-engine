#!/usr/bin/env node
/**
 * Download Mediatwist logos from Canva Brand Kit and save to project.
 * Run: node scripts/download-canva-logos.js
 *
 * Downloads two logo variants:
 * 1. 3D "THE MEDIA TWIST GROUP" logo (transparent BG)
 * 2. Circular Mediatwist badge logo (transparent BG)
 *
 * Saves the best one to public/logo.png and assets/logo.png
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const LOGOS = [
  {
    name: '3D Logo',
    // Re-export this from Canva if URL expired: Design ID DAG_RRJ0rww
    url: process.argv[2] || '',
    saveTo: 'mediatwist-logo-3d.png',
  },
  {
    name: 'Circular Logo',
    // Re-export this from Canva if URL expired: Design ID DAHDrVAwE4Y
    url: process.argv[3] || '',
    saveTo: 'mediatwist-logo-circular.png',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const publicDir = path.join(__dirname, '..', 'public');

  // If no URLs passed, check Downloads folder for already-downloaded logos
  if (!LOGOS[0].url && !LOGOS[1].url) {
    const home = process.env.HOME || process.env.USERPROFILE;
    const downloadsDir = path.join(home, 'Downloads');

    const files = ['mediatwist-logo-3d.png', 'mediatwist-logo-circular.png'];
    let found = null;

    for (const f of files) {
      const p = path.join(downloadsDir, f);
      if (fs.existsSync(p)) {
        found = p;
        console.log(`✅ Found ${f} in Downloads folder`);
        break;
      }
    }

    if (!found) {
      // Check for any recent Canva export PNG
      const allFiles = fs.readdirSync(downloadsDir)
        .filter(f => f.endsWith('.png') && (f.includes('mediatwist') || f.includes('0001-')))
        .map(f => ({ name: f, path: path.join(downloadsDir, f), mtime: fs.statSync(path.join(downloadsDir, f)).mtime }))
        .sort((a, b) => b.mtime - a.mtime);

      if (allFiles.length > 0) {
        found = allFiles[0].path;
        console.log(`✅ Found recent Canva logo: ${allFiles[0].name}`);
      }
    }

    if (found) {
      // Copy to project
      const dest1 = path.join(publicDir, 'logo.png');
      const dest2 = path.join(assetsDir, 'logo.png');
      fs.copyFileSync(found, dest1);
      fs.copyFileSync(found, dest2);
      console.log(`📋 Copied to public/logo.png (${fs.statSync(dest1).size} bytes)`);
      console.log(`📋 Copied to assets/logo.png (${fs.statSync(dest2).size} bytes)`);
      console.log('\n🎉 Logo updated! Your Remotion compositions will now use the new logo.');
      return;
    }

    console.log('⚠️  No logos found in Downloads folder.');
    console.log('');
    console.log('Option 1: Download from Canva manually:');
    console.log('  1. Go to canva.com → Brand Kit → Logos');
    console.log('  2. Download your preferred logo as PNG with transparent background');
    console.log('  3. Save it to your Downloads folder as "mediatwist-logo-3d.png"');
    console.log('  4. Run this script again');
    console.log('');
    console.log('Option 2: Pass Canva export URLs directly:');
    console.log('  node scripts/download-canva-logos.js "https://export-url-1" "https://export-url-2"');
    return;
  }

  // Download from URLs
  for (const logo of LOGOS) {
    if (!logo.url) continue;
    const dest = path.join(assetsDir, logo.saveTo);
    console.log(`⬇️  Downloading ${logo.name}...`);
    try {
      await download(logo.url, dest);
      const size = fs.statSync(dest).size;
      console.log(`✅ Saved ${logo.saveTo} (${size} bytes)`);
    } catch (err) {
      console.log(`❌ Failed to download ${logo.name}: ${err.message}`);
    }
  }

  // Use the 3D logo as the primary if it exists, otherwise circular
  const primary = path.join(assetsDir, 'mediatwist-logo-3d.png');
  const fallback = path.join(assetsDir, 'mediatwist-logo-circular.png');
  const source = fs.existsSync(primary) ? primary : fs.existsSync(fallback) ? fallback : null;

  if (source) {
    fs.copyFileSync(source, path.join(publicDir, 'logo.png'));
    fs.copyFileSync(source, path.join(assetsDir, 'logo.png'));
    console.log(`\n🎉 Updated public/logo.png and assets/logo.png with ${path.basename(source)}`);
  }
}

main().catch(console.error);
