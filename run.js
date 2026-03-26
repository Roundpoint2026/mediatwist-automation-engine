/**
 * run.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single entry point for the Mediatwist Facebook poster.
 *
 * Usage:
 *   node run.js
 *
 * Required in .env (same folder as this file):
 *   PAGE_ID        — your Facebook Page ID
 *   ACCESS_TOKEN   — your Page access token
 */

'use strict';

// Load .env from the same directory as this file — works regardless of
// which directory you run `node` from.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { postToFacebook } = require('./meta/postToFacebook');

// ─── Post content ─────────────────────────────────────────────────────────────
// Change these values to customise what gets posted.

const imageUrl = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1080';
const caption  = [
  'Stop scrolling. Start growing. 🚀',
  '',
  'Most businesses waste 80% of their social budget on content that never converts.',
  'We build systems that actually move the needle.',
  '',
  '📲 Book your free strategy call → link in bio',
  '',
  '#SocialMediaMarketing #ContentStrategy #Mediatwist',
].join('\n');

// ─── Run ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n────────────────────────────────────────');
  console.log(' Mediatwist — Facebook Post');
  console.log('────────────────────────────────────────');
  console.log(` PAGE_ID:  ${process.env.PAGE_ID     || '⚠️  NOT SET'}`);
  console.log(` TOKEN:    ${process.env.ACCESS_TOKEN ? '✅ loaded' : '⚠️  NOT SET'}`);
  console.log(` Image:    ${imageUrl}`);
  console.log(` Caption:  "${caption.split('\n')[0]}..."`);
  console.log('────────────────────────────────────────\n');

  try {
    const result = await postToFacebook(imageUrl, caption);
    console.log('✅ Post published successfully!');
    console.log('   Response:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('❌ Post failed:', err.message);

    // Surface the Facebook API error detail if available
    if (err.response?.data?.error) {
      const fbErr = err.response.data.error;
      console.error(`   FB Error ${fbErr.code}: ${fbErr.message}`);
      if (fbErr.error_subcode) console.error(`   Subcode: ${fbErr.error_subcode}`);
    }

    process.exit(1);
  }
})();
