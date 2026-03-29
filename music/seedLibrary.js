#!/usr/bin/env node
/**
 * music/seedLibrary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generate a starter set of royalty-free background music tracks using ffmpeg.
 *
 * Generates synthesized audio tracks locally — no external downloads needed.
 * Each track uses layered sine waves, filtered noise, and LFO modulation
 * to create mood-appropriate background music for social media videos.
 *
 * Usage:
 *   node music/seedLibrary.js           # Generate all starter tracks
 *   node music/seedLibrary.js --check   # Check which tracks exist
 *
 * Each track is named by mood for automatic category matching:
 *   ambient-*.mp3    → Industry Insight, Paid Media Intelligence
 *   edgy-*.mp3       → Contrarian Marketing Take
 *   corporate-*.mp3  → Case Study Breakdown
 *   motivational-*.mp3 → Founder/Operator Mindset
 *   upbeat-*.mp3     → Social Media Myth Busting
 *   futuristic-*.mp3 → AI & Marketing Strategy
 *   energetic-*.mp3  → Growth Hacking
 *   cinematic-*.mp3  → Brand Authority
 *   analytical-*.mp3 → Paid Media Intelligence
 *   creative-*.mp3   → Content Strategy
 *
 * Requires: ffmpeg installed and on PATH
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AUDIO_DIR = path.resolve(__dirname, '../public/audio');

// ─── Track definitions ──────────────────────────────────────────────────────
// Each track uses ffmpeg's aevalsrc/sine/anoisesrc filters to generate
// mood-appropriate synthesized audio. Duration: 20s (covers longest comp + fade).

const TRACKS = [
  // ── Ambient (soft pad + slow LFO) ────────────────────────────────────────
  {
    filename: 'ambient-tech-pulse.mp3',
    mood: 'ambient',
    description: 'Soft electronic ambient with subtle pulse',
    ffmpeg: `-f lavfi -i "sine=frequency=174:duration=20" -f lavfi -i "sine=frequency=220:duration=20" -f lavfi -i "sine=frequency=261:duration=20" -f lavfi -i "anoisesrc=color=pink:duration=20" -filter_complex "[0]volume=0.15[a];[1]volume=0.12[b];[2]volume=0.08[c];[3]volume=0.03,lowpass=f=800[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=2,afade=t=out:st=18:d=2,lowpass=f=3000"`,
  },
  {
    filename: 'ambient-digital-horizon.mp3',
    mood: 'ambient',
    description: 'Warm atmospheric pad with harmonic overtones',
    ffmpeg: `-f lavfi -i "sine=frequency=130:duration=20" -f lavfi -i "sine=frequency=196:duration=20" -f lavfi -i "sine=frequency=330:duration=20" -f lavfi -i "anoisesrc=color=brown:duration=20" -filter_complex "[0]volume=0.18,tremolo=f=0.3:d=0.3[a];[1]volume=0.12,tremolo=f=0.2:d=0.4[b];[2]volume=0.06[c];[3]volume=0.02,lowpass=f=600[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=3,afade=t=out:st=17:d=3,lowpass=f=2500"`,
  },

  // ── Corporate (clean, uplifting tones) ────────────────────────────────────
  {
    filename: 'corporate-success-story.mp3',
    mood: 'corporate',
    description: 'Clean professional background with major chord feel',
    ffmpeg: `-f lavfi -i "sine=frequency=261:duration=20" -f lavfi -i "sine=frequency=329:duration=20" -f lavfi -i "sine=frequency=392:duration=20" -f lavfi -i "sine=frequency=523:duration=20" -filter_complex "[0]volume=0.15[a];[1]volume=0.12[b];[2]volume=0.10[c];[3]volume=0.06,tremolo=f=2:d=0.3[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=1.5,afade=t=out:st=18:d=2,lowpass=f=4000"`,
  },
  {
    filename: 'corporate-forward-motion.mp3',
    mood: 'corporate',
    description: 'Uplifting corporate with rhythmic pulse',
    ffmpeg: `-f lavfi -i "sine=frequency=220:duration=20" -f lavfi -i "sine=frequency=277:duration=20" -f lavfi -i "sine=frequency=330:duration=20" -f lavfi -i "sine=frequency=440:duration=20" -filter_complex "[0]volume=0.14,tremolo=f=4:d=0.5[a];[1]volume=0.10[b];[2]volume=0.12[c];[3]volume=0.05,tremolo=f=1:d=0.4[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=1,afade=t=out:st=18:d=2,lowpass=f=3500"`,
  },

  // ── Motivational (building energy, inspiring) ─────────────────────────────
  {
    filename: 'motivational-rise-up.mp3',
    mood: 'motivational',
    description: 'Inspiring build with rising frequencies',
    ffmpeg: `-f lavfi -i "sine=frequency=196:duration=20" -f lavfi -i "sine=frequency=293:duration=20" -f lavfi -i "sine=frequency=392:duration=20" -f lavfi -i "sine=frequency=587:duration=20" -filter_complex "[0]volume=0.16[a];[1]volume=0.13[b];[2]volume=0.11[c];[3]volume=0.07,tremolo=f=0.5:d=0.6[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=2,afade=t=out:st=17:d=3,lowpass=f=5000"`,
  },
  {
    filename: 'motivational-new-heights.mp3',
    mood: 'motivational',
    description: 'Warm inspiring tones with subtle movement',
    ffmpeg: `-f lavfi -i "sine=frequency=164:duration=20" -f lavfi -i "sine=frequency=246:duration=20" -f lavfi -i "sine=frequency=329:duration=20" -f lavfi -i "sine=frequency=493:duration=20" -filter_complex "[0]volume=0.15,tremolo=f=0.4:d=0.3[a];[1]volume=0.12[b];[2]volume=0.10,tremolo=f=0.6:d=0.4[c];[3]volume=0.06[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=2,afade=t=out:st=17:d=3"`,
  },

  // ── Edgy (darker, tension, minor key) ─────────────────────────────────────
  {
    filename: 'edgy-dark-beat.mp3',
    mood: 'edgy',
    description: 'Dark electronic tension with minor intervals',
    ffmpeg: `-f lavfi -i "sine=frequency=110:duration=20" -f lavfi -i "sine=frequency=130:duration=20" -f lavfi -i "sine=frequency=164:duration=20" -f lavfi -i "anoisesrc=color=brown:duration=20" -filter_complex "[0]volume=0.20,tremolo=f=6:d=0.7[a];[1]volume=0.12,tremolo=f=3:d=0.5[b];[2]volume=0.08[c];[3]volume=0.04,bandpass=f=200:w=100[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=1,afade=t=out:st=18:d=2,lowpass=f=2000"`,
  },
  {
    filename: 'edgy-tension-wire.mp3',
    mood: 'edgy',
    description: 'Tense undercurrent with gritty texture',
    ffmpeg: `-f lavfi -i "sine=frequency=82:duration=20" -f lavfi -i "sine=frequency=155:duration=20" -f lavfi -i "sine=frequency=233:duration=20" -f lavfi -i "anoisesrc=color=pink:duration=20" -filter_complex "[0]volume=0.18,tremolo=f=8:d=0.6[a];[1]volume=0.10,tremolo=f=2:d=0.4[b];[2]volume=0.07[c];[3]volume=0.05,bandpass=f=300:w=150[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=1.5,afade=t=out:st=18:d=2,lowpass=f=2500"`,
  },

  // ── Upbeat (bright, fun, energetic) ───────────────────────────────────────
  {
    filename: 'upbeat-social-groove.mp3',
    mood: 'upbeat',
    description: 'Fun bright groove with rhythmic movement',
    ffmpeg: `-f lavfi -i "sine=frequency=330:duration=20" -f lavfi -i "sine=frequency=440:duration=20" -f lavfi -i "sine=frequency=523:duration=20" -f lavfi -i "sine=frequency=659:duration=20" -filter_complex "[0]volume=0.12,tremolo=f=8:d=0.6[a];[1]volume=0.10,tremolo=f=4:d=0.5[b];[2]volume=0.08,tremolo=f=6:d=0.4[c];[3]volume=0.06[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=1,afade=t=out:st=18:d=2,lowpass=f=6000"`,
  },

  // ── Futuristic (synth, electronic, sci-fi) ────────────────────────────────
  {
    filename: 'futuristic-ai-dream.mp3',
    mood: 'futuristic',
    description: 'Futuristic synth with modulated tones',
    ffmpeg: `-f lavfi -i "sine=frequency=146:duration=20" -f lavfi -i "sine=frequency=220:duration=20" -f lavfi -i "sine=frequency=440:duration=20" -f lavfi -i "anoisesrc=color=white:duration=20" -filter_complex "[0]volume=0.14,tremolo=f=0.5:d=0.8[a];[1]volume=0.10,tremolo=f=1.5:d=0.6[b];[2]volume=0.06,tremolo=f=3:d=0.5[c];[3]volume=0.02,bandpass=f=4000:w=2000[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=2,afade=t=out:st=17:d=3,lowpass=f=5000"`,
  },
  {
    filename: 'futuristic-neon-city.mp3',
    mood: 'futuristic',
    description: 'Cyberpunk electronic atmosphere',
    ffmpeg: `-f lavfi -i "sine=frequency=98:duration=20" -f lavfi -i "sine=frequency=196:duration=20" -f lavfi -i "sine=frequency=370:duration=20" -f lavfi -i "anoisesrc=color=pink:duration=20" -filter_complex "[0]volume=0.16,tremolo=f=2:d=0.7[a];[1]volume=0.10,tremolo=f=0.8:d=0.5[b];[2]volume=0.08,tremolo=f=4:d=0.4[c];[3]volume=0.03,bandpass=f=1500:w=500[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=1.5,afade=t=out:st=17:d=3,lowpass=f=4000"`,
  },

  // ── Energetic (high tempo, driving) ───────────────────────────────────────
  {
    filename: 'energetic-startup-drive.mp3',
    mood: 'energetic',
    description: 'High-energy driving pulse',
    ffmpeg: `-f lavfi -i "sine=frequency=220:duration=20" -f lavfi -i "sine=frequency=330:duration=20" -f lavfi -i "sine=frequency=440:duration=20" -f lavfi -i "sine=frequency=550:duration=20" -filter_complex "[0]volume=0.15,tremolo=f=10:d=0.7[a];[1]volume=0.12,tremolo=f=5:d=0.5[b];[2]volume=0.09,tremolo=f=8:d=0.4[c];[3]volume=0.06,tremolo=f=3:d=0.6[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=0.5,afade=t=out:st=18:d=2,lowpass=f=6000"`,
  },

  // ── Cinematic (epic, orchestral feel) ─────────────────────────────────────
  {
    filename: 'cinematic-power-surge.mp3',
    mood: 'cinematic',
    description: 'Epic cinematic with building power',
    ffmpeg: `-f lavfi -i "sine=frequency=65:duration=20" -f lavfi -i "sine=frequency=130:duration=20" -f lavfi -i "sine=frequency=196:duration=20" -f lavfi -i "sine=frequency=261:duration=20" -filter_complex "[0]volume=0.20[a];[1]volume=0.15,tremolo=f=0.3:d=0.5[b];[2]volume=0.12[c];[3]volume=0.08,tremolo=f=0.5:d=0.3[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=3,afade=t=out:st=17:d=3,lowpass=f=3000"`,
  },
  {
    filename: 'cinematic-dark-horizon.mp3',
    mood: 'cinematic',
    description: 'Deep cinematic atmosphere',
    ffmpeg: `-f lavfi -i "sine=frequency=55:duration=20" -f lavfi -i "sine=frequency=110:duration=20" -f lavfi -i "sine=frequency=165:duration=20" -f lavfi -i "anoisesrc=color=brown:duration=20" -filter_complex "[0]volume=0.22[a];[1]volume=0.14,tremolo=f=0.2:d=0.6[b];[2]volume=0.08[c];[3]volume=0.03,lowpass=f=400[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=3,afade=t=out:st=16:d=4,lowpass=f=2000"`,
  },

  // ── Analytical (minimal, focused) ─────────────────────────────────────────
  {
    filename: 'analytical-data-flow.mp3',
    mood: 'analytical',
    description: 'Minimal electronic, clean and focused',
    ffmpeg: `-f lavfi -i "sine=frequency=349:duration=20" -f lavfi -i "sine=frequency=440:duration=20" -f lavfi -i "sine=frequency=523:duration=20" -filter_complex "[0]volume=0.10,tremolo=f=1:d=0.3[a];[1]volume=0.08[b];[2]volume=0.05,tremolo=f=2:d=0.2[c];[a][b][c]amix=inputs=3:duration=longest,afade=t=in:st=0:d=2,afade=t=out:st=18:d=2,lowpass=f=3500"`,
  },

  // ── Creative (chill, lo-fi vibe) ──────────────────────────────────────────
  {
    filename: 'creative-chill-wave.mp3',
    mood: 'creative',
    description: 'Chill lo-fi wave with warm texture',
    ffmpeg: `-f lavfi -i "sine=frequency=196:duration=20" -f lavfi -i "sine=frequency=293:duration=20" -f lavfi -i "sine=frequency=349:duration=20" -f lavfi -i "anoisesrc=color=pink:duration=20" -filter_complex "[0]volume=0.14,tremolo=f=0.5:d=0.4[a];[1]volume=0.10,tremolo=f=0.3:d=0.5[b];[2]volume=0.08[c];[3]volume=0.04,lowpass=f=1000[d];[a][b][c][d]amix=inputs=4:duration=longest,afade=t=in:st=0:d=2,afade=t=out:st=17:d=3,lowpass=f=3000"`,
  },
  {
    filename: 'creative-flow-state.mp3',
    mood: 'creative',
    description: 'Warm creative atmosphere with gentle movement',
    ffmpeg: `-f lavfi -i "sine=frequency=174:duration=20" -f lavfi -i "sine=frequency=261:duration=20" -f lavfi -i "sine=frequency=392:duration=20" -filter_complex "[0]volume=0.12,tremolo=f=0.4:d=0.3[a];[1]volume=0.10,tremolo=f=0.6:d=0.4[b];[2]volume=0.06[c];[a][b][c]amix=inputs=3:duration=longest,afade=t=in:st=0:d=2.5,afade=t=out:st=17:d=3,lowpass=f=2800"`,
  },
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function seedLibrary() {
  console.log('\n 🎵  Mediatwist Music Library Generator');
  console.log('═'.repeat(50));

  // Check ffmpeg
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
  } catch {
    console.error(' ❌  ffmpeg not found. Install it first:');
    console.error('     macOS:  brew install ffmpeg');
    console.error('     Ubuntu: sudo apt install ffmpeg');
    console.error('     Windows: choco install ffmpeg');
    process.exit(1);
  }

  // Ensure directory exists
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    console.log(` 📁  Created: public/audio/`);
  }

  const checkOnly = process.argv.includes('--check');

  if (checkOnly) {
    console.log('\n Checking existing tracks:\n');
    let existing = 0;
    let missing = 0;
    TRACKS.forEach(track => {
      const exists = fs.existsSync(path.join(AUDIO_DIR, track.filename));
      console.log(` ${exists ? '✅' : '❌'}  ${track.filename} (${track.mood})`);
      if (exists) existing++; else missing++;
    });
    console.log(`\n Total: ${existing} present, ${missing} missing out of ${TRACKS.length}`);
    return;
  }

  console.log(` Generating ${TRACKS.length} tracks with ffmpeg...\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const track of TRACKS) {
    const destPath = path.join(AUDIO_DIR, track.filename);

    if (fs.existsSync(destPath)) {
      console.log(` ⏭️  ${track.filename} (already exists)`);
      skipped++;
      continue;
    }

    try {
      process.stdout.write(` 🔊  ${track.filename}...`);
      const cmd = `ffmpeg -y ${track.ffmpeg} -ac 2 -ar 44100 -b:a 128k "${destPath}" 2>/dev/null`;
      execSync(cmd, { timeout: 30000 });
      console.log(' ✅');
      generated++;
    } catch (err) {
      console.log(` ❌ (${err.message.split('\n')[0]})`);
      // Clean up partial file
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      failed++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(` ✅  Generated: ${generated}`);
  console.log(` ⏭️  Skipped:   ${skipped}`);
  if (failed > 0) console.log(` ❌  Failed:    ${failed}`);
  console.log(`\n 💡  Tracks saved to: public/audio/`);
  console.log('     Mood-prefix naming enables automatic category matching.');
  console.log('     Add your own .mp3 tracks with the format: {mood}-{name}.mp3\n');

  // Update library.json
  const { refreshLibrary } = require('./musicManager');
  const library = refreshLibrary();
  console.log(` 📋  Library updated: ${library.totalTracks} total tracks`);
  Object.entries(library.moodBreakdown).forEach(([mood, count]) => {
    console.log(`     ${mood}: ${count} track${count > 1 ? 's' : ''}`);
  });
}

if (require.main === module) {
  seedLibrary().catch(err => {
    console.error(`\n ❌  Generator failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { seedLibrary, TRACKS };
