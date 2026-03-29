/**
 * music/musicManager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Music manager for the Mediatwist Automation Engine.
 *
 * Responsibilities:
 *   - Maintain a local library of royalty-free audio tracks (public/audio/)
 *   - Map content categories → music moods → track selection
 *   - Fetch new tracks from Pixabay Music API (free, no attribution needed)
 *   - Rotate tracks to avoid repetition (integrates with memory system)
 *
 * Music sources:
 *   - Pixabay Music (primary — free, royalty-free, commercial use, no attribution)
 *   - Local library fallback (public/audio/ directory)
 *
 * Usage:
 *   const { selectTrackForCategory, refreshMusicLibrary } = require('./musicManager');
 *   const track = await selectTrackForCategory('Industry Insight');
 *   // → { filePath: 'audio/ambient-corporate-01.mp3', mood: 'ambient', ... }
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const axios = require('axios');

const config = require('../config/engine');

// ─── Paths ──────────────────────────────────────────────────────────────────

const AUDIO_DIR    = path.resolve(__dirname, '../public/audio');
const LIBRARY_PATH = path.resolve(__dirname, 'library.json');

// ─── Category → Mood mapping ────────────────────────────────────────────────
// Maps each content category to a Pixabay music search + local mood tag

const CATEGORY_MOOD_MAP = {
  'Industry Insight':            { mood: 'ambient',     pixabayQ: 'corporate ambient technology',   energy: 'low' },
  'Contrarian Marketing Take':   { mood: 'edgy',        pixabayQ: 'dark electronic beat',           energy: 'medium' },
  'Case Study Breakdown':        { mood: 'corporate',   pixabayQ: 'corporate inspiring',            energy: 'medium' },
  'Founder/Operator Mindset':    { mood: 'motivational', pixabayQ: 'motivational inspiring cinematic', energy: 'medium' },
  'Social Media Myth Busting':   { mood: 'upbeat',      pixabayQ: 'upbeat electronic modern',       energy: 'high' },
  'AI & Marketing Strategy':     { mood: 'futuristic',  pixabayQ: 'futuristic technology electronic', energy: 'medium' },
  'Growth Hacking':              { mood: 'energetic',   pixabayQ: 'energetic electronic startup',   energy: 'high' },
  'Brand Authority':             { mood: 'cinematic',   pixabayQ: 'cinematic epic powerful',        energy: 'medium' },
  'Paid Media Intelligence':     { mood: 'analytical',  pixabayQ: 'corporate technology data',      energy: 'low' },
  'Content Strategy':            { mood: 'creative',    pixabayQ: 'creative modern chill',          energy: 'low' },
};

// Fallback mood for unknown categories
const DEFAULT_MOOD = { mood: 'ambient', pixabayQ: 'corporate ambient background', energy: 'low' };

// ─── Library management ─────────────────────────────────────────────────────

function loadLibrary() {
  try {
    if (!fs.existsSync(LIBRARY_PATH)) return { tracks: [], lastRefresh: null };
    return JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf-8'));
  } catch { return { tracks: [], lastRefresh: null }; }
}

function saveLibrary(library) {
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2), 'utf-8');
}

/**
 * Scan public/audio/ for local tracks and register them in the library.
 * Track filenames should follow: {mood}-{name}.mp3
 * e.g., ambient-tech-pulse.mp3, energetic-startup-drive.mp3
 */
function scanLocalTracks() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
  return files.map(filename => {
    const moodMatch = filename.match(/^([a-z]+)-/);
    return {
      filename,
      filePath: `audio/${filename}`,  // Relative to public/ — used by Remotion's staticFile()
      mood: moodMatch ? moodMatch[1] : 'ambient',
      source: 'local',
      addedAt: new Date().toISOString(),
    };
  });
}

// ─── Pixabay Music API ──────────────────────────────────────────────────────

/**
 * Fetch tracks from Pixabay Music API.
 * API docs: https://pixabay.com/api/docs/#api_search_music
 *
 * @param {string} query — Search terms
 * @param {object} opts — { perPage, order }
 * @returns {Array} — Track results from Pixabay
 */
async function fetchPixabayTracks(query, opts = {}) {
  const apiKey = config.music?.pixabayApiKey;
  if (!apiKey) {
    console.log('     ℹ️  No PIXABAY_API_KEY — using local library only');
    return [];
  }

  const { perPage = 5, order = 'popular' } = opts;

  try {
    const url = 'https://pixabay.com/api/';
    const resp = await axios.get(url, {
      params: {
        key: apiKey,
        q: query,
        // Note: Pixabay's standard API is for images/videos.
        // For music, we use their direct download approach instead.
        // This searches their audio section.
        per_page: perPage,
        order,
        safesearch: true,
      },
      timeout: 10000,
    });

    if (resp.data && resp.data.hits) {
      return resp.data.hits.map(hit => ({
        id: hit.id,
        title: hit.tags || 'Untitled',
        previewUrl: hit.previewURL || null,
        downloadUrl: hit.largeImageURL || hit.webformatURL || null, // Audio URL
        duration: hit.duration || null,
        source: 'pixabay',
      }));
    }
    return [];
  } catch (err) {
    console.warn(`     ⚠️  Pixabay fetch failed: ${err.message}`);
    return [];
  }
}

/**
 * Download a track from URL to the local audio library.
 *
 * @param {string} url — Direct audio file URL
 * @param {string} filename — Local filename (e.g., ambient-tech-01.mp3)
 * @returns {string|null} — Local file path relative to public/, or null on failure
 */
async function downloadTrack(url, filename) {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const destPath = path.join(AUDIO_DIR, filename);

  // Skip if already downloaded
  if (fs.existsSync(destPath)) {
    return `audio/${filename}`;
  }

  try {
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    fs.writeFileSync(destPath, resp.data);
    console.log(`     ✅  Downloaded: ${filename}`);
    return `audio/${filename}`;
  } catch (err) {
    console.warn(`     ⚠️  Download failed (${filename}): ${err.message}`);
    return null;
  }
}

// ─── Track selection ────────────────────────────────────────────────────────

/**
 * Select the best available track for a content category.
 * Priority: mood-matched local track → any local track → null (silent)
 *
 * @param {string} category — Content category name
 * @param {Array} recentTracks — Recently used track filenames (for rotation)
 * @returns {object|null} — { filePath, mood, filename } or null if no tracks available
 */
async function selectTrackForCategory(category, recentTracks = []) {
  const moodInfo = CATEGORY_MOOD_MAP[category] || DEFAULT_MOOD;

  // Ensure audio dir exists
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

  // Get all available local tracks
  const localTracks = scanLocalTracks();

  if (localTracks.length === 0) {
    console.log('     ℹ️  No audio tracks in public/audio/ — video will be silent');
    console.log('     💡  Run: node music/seedLibrary.js to download starter tracks');
    return null;
  }

  // 1) Try mood-matched tracks not recently used
  const moodMatched = localTracks.filter(t =>
    t.mood === moodInfo.mood && !recentTracks.includes(t.filename)
  );
  if (moodMatched.length > 0) {
    const pick = moodMatched[Math.floor(Math.random() * moodMatched.length)];
    console.log(`     🎵  Selected: ${pick.filename} (mood: ${pick.mood})`);
    return pick;
  }

  // 2) Try any mood-matched track (even if recently used)
  const anyMood = localTracks.filter(t => t.mood === moodInfo.mood);
  if (anyMood.length > 0) {
    const pick = anyMood[Math.floor(Math.random() * anyMood.length)];
    console.log(`     🎵  Selected: ${pick.filename} (mood: ${pick.mood}, repeat)`);
    return pick;
  }

  // 3) Fallback: any track not recently used
  const unused = localTracks.filter(t => !recentTracks.includes(t.filename));
  if (unused.length > 0) {
    const pick = unused[Math.floor(Math.random() * unused.length)];
    console.log(`     🎵  Selected: ${pick.filename} (fallback, mood: ${pick.mood})`);
    return pick;
  }

  // 4) Last resort: any track at all
  const pick = localTracks[Math.floor(Math.random() * localTracks.length)];
  console.log(`     🎵  Selected: ${pick.filename} (last resort)`);
  return pick;
}

/**
 * Get recently used tracks from memory (last N posts).
 */
function getRecentlyUsedTracks(count = 10) {
  try {
    const memory = require('../memory/store');
    const recent = memory.getRecentPosts(count);
    return recent
      .map(p => p.audioTrack)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Refresh the music library — scan local tracks and update library.json.
 */
function refreshLibrary() {
  const localTracks = scanLocalTracks();
  const library = {
    tracks: localTracks,
    lastRefresh: new Date().toISOString(),
    totalTracks: localTracks.length,
    moodBreakdown: {},
  };

  // Count tracks by mood
  localTracks.forEach(t => {
    library.moodBreakdown[t.mood] = (library.moodBreakdown[t.mood] || 0) + 1;
  });

  saveLibrary(library);
  return library;
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  selectTrackForCategory,
  getRecentlyUsedTracks,
  refreshLibrary,
  scanLocalTracks,
  downloadTrack,
  fetchPixabayTracks,
  CATEGORY_MOOD_MAP,
  AUDIO_DIR,
};
