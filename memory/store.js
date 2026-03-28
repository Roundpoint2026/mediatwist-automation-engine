/**
 * memory/store.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent memory system for the Mediatwist content engine.
 *
 * Tracks:
 *   - Every post published (platform, category, hook, timestamp)
 *   - Used hooks (to prevent repetition)
 *   - Category rotation (ensures even distribution)
 *   - Content hashes (deduplication)
 *
 * Storage: JSON file at memory/history.json
 * Thread-safe: reads full file, merges, writes atomically.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const HISTORY_PATH = path.resolve(__dirname, 'history.json');

// ─── Default empty state ──────────────────────────────────────────────────────

function emptyState() {
  return {
    posts: [],
    usedHooks: [],
    usedCategories: [],
    contentHashes: [],
    stats: {
      totalPosts: 0,
      byPlatform: { facebook: 0, instagram: 0, linkedin: 0 },
      byCategory: {},
      lastRunAt: null,
    },
  };
}

// ─── Core I/O ─────────────────────────────────────────────────────────────────

function load() {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return emptyState();
    const raw = fs.readFileSync(HISTORY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return emptyState();
  }
}

function save(state) {
  const tmp = HISTORY_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmp, HISTORY_PATH);
}

// ─── Content hashing ──────────────────────────────────────────────────────────

function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a published post in memory.
 */
function recordPost({ platform, category, hook, caption, compositionId, mediaUrl }) {
  const state = load();
  const hash = hashContent(caption);

  const entry = {
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    platform,
    category,
    hook,
    captionHash: hash,
    compositionId: compositionId || null,
    mediaUrl: mediaUrl || null,
    publishedAt: new Date().toISOString(),
  };

  state.posts.push(entry);
  if (hook && !state.usedHooks.includes(hook)) state.usedHooks.push(hook);
  if (!state.contentHashes.includes(hash)) state.contentHashes.push(hash);

  // Track category usage
  state.usedCategories.push({ category, usedAt: entry.publishedAt });

  // Update stats
  state.stats.totalPosts++;
  if (state.stats.byPlatform[platform] !== undefined) {
    state.stats.byPlatform[platform]++;
  }
  state.stats.byCategory[category] = (state.stats.byCategory[category] || 0) + 1;
  state.stats.lastRunAt = entry.publishedAt;

  save(state);
  return entry;
}

/**
 * Check if a caption (by hash) has already been posted.
 */
function isDuplicate(caption) {
  const state = load();
  return state.contentHashes.includes(hashContent(caption));
}

/**
 * Check if a hook was already used.
 */
function isHookUsed(hook) {
  const state = load();
  return state.usedHooks.includes(hook);
}

/**
 * Get categories sorted by least-recently-used first.
 * Ensures even rotation across all categories.
 */
function getLeastUsedCategories(allCategories) {
  const state = load();
  const counts = {};
  allCategories.forEach(c => { counts[c] = 0; });
  state.usedCategories.forEach(({ category }) => {
    if (counts[category] !== undefined) counts[category]++;
  });
  return allCategories.slice().sort((a, b) => counts[a] - counts[b]);
}

/**
 * Get unused hooks for a given category.
 */
function getUnusedHooks(category, allHooks) {
  const state = load();
  const used = new Set(state.usedHooks);
  const unused = allHooks.filter(h => !used.has(h));
  // If all hooks used, reset and return all (full cycle complete)
  if (unused.length === 0) {
    state.usedHooks = state.usedHooks.filter(h => !allHooks.includes(h));
    save(state);
    return allHooks;
  }
  return unused;
}

/**
 * Get recent posts for context (last N days).
 */
function getRecentPosts(days = 7) {
  const state = load();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return state.posts.filter(p => new Date(p.publishedAt).getTime() > cutoff);
}

/**
 * Get full stats.
 */
function getStats() {
  return load().stats;
}

/**
 * Get total post count.
 */
function getTotalPosts() {
  return load().stats.totalPosts;
}

module.exports = {
  recordPost,
  isDuplicate,
  isHookUsed,
  getLeastUsedCategories,
  getUnusedHooks,
  getRecentPosts,
  getStats,
  getTotalPosts,
  load,
  save,
  hashContent,
};
