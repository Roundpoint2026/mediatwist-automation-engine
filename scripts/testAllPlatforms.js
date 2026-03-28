#!/usr/bin/env node
/**
 * testAllPlatforms.js — Test publish to Facebook + Instagram + LinkedIn
 *
 * Usage:
 *   node scripts/testAllPlatforms.js              # Publish to all 3
 *   node scripts/testAllPlatforms.js --dry-run    # Preview only
 *   node scripts/testAllPlatforms.js --fb-only    # Facebook only
 *   node scripts/testAllPlatforms.js --ig-only    # Instagram only
 *   node scripts/testAllPlatforms.js --li-only    # LinkedIn only
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');
const memory = require('../memory/store');

const PAGE_ID               = process.env.PAGE_ID;
const ACCESS_TOKEN          = process.env.ACCESS_TOKEN;
const IG_ACCOUNT_ID         = process.env.IG_ACCOUNT_ID;
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_ORG_ID       = process.env.LINKEDIN_ORG_ID;
const GRAPH                 = 'https://graph.facebook.com/v25.0';
const DRY_RUN               = process.argv.includes('--dry-run');
const FB_ONLY               = process.argv.includes('--fb-only');
const IG_ONLY               = process.argv.includes('--ig-only');
const LI_ONLY               = process.argv.includes('--li-only');
const RUN_ALL               = !FB_ONLY && !IG_ONLY && !LI_ONLY;

// ─── Unique test content ──────────────────────────────────────────────────────
const ts = new Date().toLocaleString('en-US', {
  timeZone: 'America/New_York',
  month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', second: '2-digit'
});

const BASE_CAPTION = `The brands winning right now aren't louder — they're sharper.\n\nClarity beats volume every time. When your message is dialed in, you don't need to shout. The market rewards precision over noise.\n\nThe operators who understand this are pulling ahead while everyone else fights for scraps of attention.`;

const FB_CAPTION = `${BASE_CAPTION}\n\n— The Mediatwist Group | ${ts}`;
const IG_CAPTION = `${BASE_CAPTION}\n\n#marketing #branding #mediatwist #strategy #growthmindset\n\n— The Mediatwist Group | ${ts}`;
const LI_CAPTION = `${BASE_CAPTION}\n\nWhat's one thing you've sharpened in your marketing this quarter?\n\n— The Mediatwist Group | ${ts}`;

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1080&q=80';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(emoji, msg) { console.log(`  ${emoji} ${msg}`); }

// ─── Facebook ────────────────────────────────────────────────────────────────
async function postToFB(caption, imageUrl) {
  const res = await axios.post(`${GRAPH}/${PAGE_ID}/photos`, {
    url: imageUrl,
    message: caption,
    access_token: ACCESS_TOKEN,
  });
  return res.data;
}

// ─── Instagram (Content Publishing API) ──────────────────────────────────────
async function postToIG(caption, imageUrl) {
  // Step 1: Create media container
  log('📸', 'Creating IG media container...');
  const containerRes = await axios.post(`${GRAPH}/${IG_ACCOUNT_ID}/media`, null, {
    params: {
      image_url: imageUrl,
      caption: caption,
      access_token: ACCESS_TOKEN,
    }
  });
  const creationId = containerRes.data.id;
  log('📦', `Container created: ${creationId}`);

  // Step 2: Wait for processing (poll status)
  let ready = false;
  let attempts = 0;
  while (!ready && attempts < 10) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await axios.get(`${GRAPH}/${creationId}`, {
      params: { fields: 'status_code', access_token: ACCESS_TOKEN }
    });
    if (statusRes.data.status_code === 'FINISHED') {
      ready = true;
    } else if (statusRes.data.status_code === 'ERROR') {
      throw new Error(`IG container processing failed: ${JSON.stringify(statusRes.data)}`);
    }
    attempts++;
    log('⏳', `Container status: ${statusRes.data.status_code} (attempt ${attempts})`);
  }
  if (!ready) throw new Error('IG container timed out after 20s');

  // Step 3: Publish
  log('🚀', 'Publishing IG post...');
  const publishRes = await axios.post(`${GRAPH}/${IG_ACCOUNT_ID}/media_publish`, null, {
    params: {
      creation_id: creationId,
      access_token: ACCESS_TOKEN,
    }
  });
  return publishRes.data;
}

// ─── LinkedIn (member posting via w_member_social) ──────────────────────────
async function postToLinkedIn(caption, imageUrl) {
  const LI_API = 'https://api.linkedin.com/v2';
  const headers = {
    Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  };

  // Step 1: Get person ID — try /me first, then /userinfo
  let author;
  try {
    const meRes = await axios.get(`${LI_API}/me`, { headers });
    author = `urn:li:person:${meRes.data.id}`;
    log('👤', `LinkedIn author (person): ${author}`);
  } catch (err1) {
    log('⚠️', `/me failed (${err1.response?.status}), trying /userinfo...`);
    try {
      const uiRes = await axios.get('https://api.linkedin.com/v2/userinfo', { headers });
      author = `urn:li:person:${uiRes.data.sub}`;
      log('👤', `LinkedIn author (userinfo): ${author}`);
    } catch (err2) {
      // Last resort: try org
      if (LINKEDIN_ORG_ID) {
        author = `urn:li:organization:${LINKEDIN_ORG_ID}`;
        log('🏢', `LinkedIn author (org fallback): ${author}`);
      } else {
        throw new Error(`LinkedIn auth failed: ${err2.response?.data?.message || err2.message}`);
      }
    }
  }

  // Step 2: Register image upload
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
  log('📤', `Upload registered, asset: ${asset}`);

  // Step 3: Download image and upload to LinkedIn
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  await axios.put(uploadUrl, imageResponse.data, {
    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
  });
  log('🖼️', 'Image uploaded to LinkedIn');

  // Step 4: Create the post
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
  console.log(' 🧪  MEDIATWIST — All-Platform TEST');
  console.log(`     ${new Date().toISOString()}`);
  if (DRY_RUN) console.log('     ⚠️  DRY RUN — no posts will be published');
  console.log('══════════════════════════════════════════════════════════════\n');

  const results = { success: [], failed: [] };

  // ── Facebook ──
  if (RUN_ALL || FB_ONLY) {
    if (memory.isDuplicate(FB_CAPTION)) {
      log('🚫', 'Facebook DUPLICATE — skipping');
    } else if (DRY_RUN) {
      log('📋', `[DRY RUN] Facebook caption:\n${FB_CAPTION}\n`);
    } else {
      try {
        log('📘', 'Posting to Facebook...');
        const fbResult = await postToFB(FB_CAPTION, FALLBACK_IMAGE);
        log('✅', `Facebook SUCCESS! Post ID: ${fbResult.id || fbResult.post_id}`);
        memory.recordPost({
          platform: 'facebook',
          category: 'test',
          hook: 'The brands winning right now aren\'t louder — they\'re sharper.',
          caption: FB_CAPTION,
          compositionId: 'test-all-platforms',
          mediaUrl: FALLBACK_IMAGE,
        });
        results.success.push('Facebook');
      } catch (err) {
        log('❌', `Facebook FAILED: ${err.response?.data?.error?.message || err.message}`);
        results.failed.push('Facebook');
      }
    }
  }

  // ── Instagram ──
  if (RUN_ALL || IG_ONLY) {
    if (!IG_ACCOUNT_ID) {
      log('⚠️', 'Instagram skipped — no IG_ACCOUNT_ID');
    } else if (memory.isDuplicate(IG_CAPTION)) {
      log('🚫', 'Instagram DUPLICATE — skipping');
    } else if (DRY_RUN) {
      log('📋', `[DRY RUN] Instagram caption:\n${IG_CAPTION}\n`);
    } else {
      try {
        log('📸', 'Posting to Instagram...');
        const igResult = await postToIG(IG_CAPTION, FALLBACK_IMAGE);
        log('✅', `Instagram SUCCESS! Media ID: ${igResult.id}`);
        memory.recordPost({
          platform: 'instagram',
          category: 'test',
          hook: 'The brands winning right now aren\'t louder — they\'re sharper.',
          caption: IG_CAPTION,
          compositionId: 'test-all-platforms',
          mediaUrl: FALLBACK_IMAGE,
        });
        results.success.push('Instagram');
      } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        log('❌', `Instagram FAILED: ${errMsg}`);
        if (err.response?.data) {
          log('🔍', `Full error: ${JSON.stringify(err.response.data)}`);
        }
        results.failed.push('Instagram');
      }
    }
  }

  // ── LinkedIn ──
  if (RUN_ALL || LI_ONLY) {
    if (!LINKEDIN_ACCESS_TOKEN) {
      log('⚠️', 'LinkedIn skipped — no LINKEDIN_ACCESS_TOKEN');
    } else if (memory.isDuplicate(LI_CAPTION)) {
      log('🚫', 'LinkedIn DUPLICATE — skipping');
    } else if (DRY_RUN) {
      log('📋', `[DRY RUN] LinkedIn caption:\n${LI_CAPTION}\n`);
    } else {
      try {
        log('💼', 'Posting to LinkedIn...');
        const liResult = await postToLinkedIn(LI_CAPTION, FALLBACK_IMAGE);
        log('✅', `LinkedIn SUCCESS! Post ID: ${liResult.id}`);
        memory.recordPost({
          platform: 'linkedin',
          category: 'test',
          hook: 'The brands winning right now aren\'t louder — they\'re sharper.',
          caption: LI_CAPTION,
          compositionId: 'test-all-platforms',
          mediaUrl: FALLBACK_IMAGE,
        });
        results.success.push('LinkedIn');
      } catch (err) {
        const errMsg = err.response?.data?.message || err.response?.data?.error?.message || err.message;
        log('❌', `LinkedIn FAILED: ${errMsg}`);
        if (err.response?.data) {
          log('🔍', `Full error: ${JSON.stringify(err.response.data)}`);
        }
        results.failed.push('LinkedIn');
      }
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(` 🎉  TEST COMPLETE — ${results.success.length} passed, ${results.failed.length} failed`);
  if (results.success.length) console.log(`     ✅ ${results.success.join(', ')}`);
  if (results.failed.length) console.log(`     ❌ ${results.failed.join(', ')}`);
  console.log('══════════════════════════════════════════════════════════════\n');
})().catch(err => {
  console.error(`\n ❌ Fatal: ${err.message}`);
  process.exit(1);
});
