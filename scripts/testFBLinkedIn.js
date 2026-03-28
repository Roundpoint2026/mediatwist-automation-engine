#!/usr/bin/env node
/**
 * testFBLinkedIn.js — Quick test: publish one unique post to Facebook + LinkedIn
 *
 * Usage:
 *   node scripts/testFBLinkedIn.js
 *   node scripts/testFBLinkedIn.js --dry-run
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');
const memory = require('../memory/store');

const PAGE_ID               = process.env.PAGE_ID;
const ACCESS_TOKEN          = process.env.ACCESS_TOKEN;
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_ORG_ID       = process.env.LINKEDIN_ORG_ID;
const GRAPH                 = 'https://graph.facebook.com/v20.0';
const DRY_RUN               = process.argv.includes('--dry-run');

// ─── Unique test content (timestamp-salted to guarantee uniqueness) ──────────
const ts = new Date().toLocaleString('en-US', {
  timeZone: 'America/New_York',
  month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit'
});

const FB_CAPTION = `The brands winning right now aren't louder — they're sharper.\n\nClarity beats volume every time. When your message is dialed in, you don't need to shout. The market rewards precision over noise.\n\nThe operators who understand this are pulling ahead while everyone else fights for scraps of attention.\n\n— The Mediatwist Group | ${ts}`;

const LI_CAPTION = `The brands winning right now aren't louder — they're sharper.\n\nClarity beats volume every time. When your message is dialed in, you don't need to shout. The market rewards precision over noise.\n\nThe operators who understand this are pulling ahead while everyone else fights for scraps of attention.\n\nWhat's one thing you've sharpened in your marketing this quarter?\n\n— The Mediatwist Group | ${ts}`;

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1080&q=80';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(emoji, msg) { console.log(`  ${emoji} ${msg}`); }

// ─── Publish to Facebook ─────────────────────────────────────────────────────
async function postToFB(caption, imageUrl) {
  const res = await axios.post(`${GRAPH}/${PAGE_ID}/photos`, {
    url: imageUrl,
    message: caption,
    access_token: ACCESS_TOKEN,
  });
  return res.data;
}

// ─── Publish to LinkedIn (member posting via w_member_social) ────────────────
async function postToLinkedIn(caption, imageUrl) {
  const LI_API = 'https://api.linkedin.com/v2';
  const headers = {
    Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  };

  // Get person ID from /me endpoint
  let author;
  try {
    const meRes = await axios.get(`${LI_API}/me`, { headers });
    author = `urn:li:person:${meRes.data.id}`;
    log('👤', `LinkedIn author: ${author}`);
  } catch (err) {
    // Try org fallback
    if (LINKEDIN_ORG_ID) {
      author = `urn:li:organization:${LINKEDIN_ORG_ID}`;
      log('🏢', `LinkedIn author (org): ${author}`);
    } else {
      throw new Error(`LinkedIn /me failed: ${err.response?.data?.message || err.message}`);
    }
  }

  // Register image upload
  const registerRes = await axios.post(`${LI_API}/assets?action=registerUpload`, {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: author,
      serviceRelationships: [{
        relationshipType: 'OWNER',
        identifier: 'urn:li:userGeneratedContent',
      }],
    },
  }, { headers });

  const uploadUrl = registerRes.data.value.uploadMechanism[
    'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
  ].uploadUrl;
  const asset = registerRes.data.value.asset;

  // Download image and upload to LinkedIn
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  await axios.put(uploadUrl, imageResponse.data, {
    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
  });

  // Create the post
  const postBody = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: caption },
        shareMediaCategory: 'IMAGE',
        media: [{ status: 'READY', media: asset }],
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const postRes = await axios.post(`${LI_API}/ugcPosts`, postBody, { headers });
  return postRes.data;
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' 🧪  MEDIATWIST — Facebook + LinkedIn TEST');
  console.log(`     ${new Date().toISOString()}`);
  if (DRY_RUN) console.log('     ⚠️  DRY RUN — no posts will be published');
  console.log('══════════════════════════════════════════════════════════════\n');

  // Dedup check
  if (memory.isDuplicate(FB_CAPTION)) {
    log('🚫', 'DUPLICATE — this exact content was already posted. Aborting.');
    process.exit(0);
  }

  if (DRY_RUN) {
    log('📋', `[DRY RUN] Facebook caption:\n${FB_CAPTION}\n`);
    log('📋', `[DRY RUN] LinkedIn caption:\n${LI_CAPTION}\n`);
    log('📋', `[DRY RUN] Image: ${FALLBACK_IMAGE}`);
    process.exit(0);
  }

  // ── Facebook ──
  try {
    log('📘', 'Posting to Facebook...');
    const fbResult = await postToFB(FB_CAPTION, FALLBACK_IMAGE);
    log('✅', `Facebook SUCCESS! Post ID: ${fbResult.id || fbResult.post_id}`);
    memory.recordPost({
      platform: 'facebook',
      category: 'operator_mindset',
      hook: 'The brands winning right now aren\'t louder — they\'re sharper.',
      caption: FB_CAPTION,
      compositionId: 'test',
      mediaUrl: FALLBACK_IMAGE,
    });
  } catch (err) {
    log('❌', `Facebook FAILED: ${err.response?.data?.error?.message || err.message}`);
  }

  // ── LinkedIn ──
  if (LINKEDIN_ACCESS_TOKEN) {
    try {
      log('💼', 'Posting to LinkedIn...');
      const liResult = await postToLinkedIn(LI_CAPTION, FALLBACK_IMAGE);
      log('✅', `LinkedIn SUCCESS! Post ID: ${liResult.id}`);
      memory.recordPost({
        platform: 'linkedin',
        category: 'operator_mindset',
        hook: 'The brands winning right now aren\'t louder — they\'re sharper.',
        caption: LI_CAPTION,
        compositionId: 'test',
        mediaUrl: FALLBACK_IMAGE,
      });
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error?.message || err.message;
      log('❌', `LinkedIn FAILED: ${errMsg}`);
      if (err.response?.data) {
        log('🔍', `Full error: ${JSON.stringify(err.response.data)}`);
      }
    }
  } else {
    log('⚠️', 'LinkedIn skipped — no LINKEDIN_ACCESS_TOKEN');
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' 🎉  TEST COMPLETE');
  console.log('══════════════════════════════════════════════════════════════\n');
})().catch(err => {
  console.error(`\n ❌ Fatal: ${err.message}`);
  process.exit(1);
});
