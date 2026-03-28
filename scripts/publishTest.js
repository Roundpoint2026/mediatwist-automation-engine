/**
 * publishTest.js — Fire 2 real posts to Facebook + Instagram
 * Run: node scripts/publishTest.js
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const axios = require('axios');

const PAGE_ID        = process.env.PAGE_ID;
const ACCESS_TOKEN   = process.env.ACCESS_TOKEN;
const IG_ACCOUNT_ID  = process.env.IG_ACCOUNT_ID;
const GRAPH          = 'https://graph.facebook.com/v20.0';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=1080',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1080',
];

const POSTS = [
  {
    facebook: "Your competitors are already using this—and you don't even know it yet.\n\nMarket saturation is creating a strange new advantage: the ability to stand out through actual substance. Brands that invested in real differentiation while others chased trends are seeing exponential returns. Generic positioning is becoming commodity. Conviction and clear perspective are the new moats.\n\nRead the full breakdown in comments.",
    instagram: "Your competitors are already using this—and you don't even know it yet.\n\nMarket saturation is creating a strange new advantage: the ability to stand out through actual substance. Brands that invested in real differentiation while others chased trends are seeing exponential returns. Generic positioning is becoming commodity. Conviction and clear perspective are the new moats.\n\nSave this. Screenshot it.\n\n#MarketingStrategy #IndustryInsight #MarketingLeadership #B2BMarketing #OperatorLife",
    image: FALLBACK_IMAGES[0],
  },
  {
    facebook: "The next 18 months will separate the operators from the pretenders.\n\nIndustry consolidation accelerates in downturns, but it creates a peculiar advantage for well-positioned players. The best time to build market share isn't during growth cycles—it's when competitors are resource-constrained. Your tech stack, creative velocity, and ability to ship fast become 10x more valuable.\n\nTag someone who needs to read this.",
    instagram: "The next 18 months will separate the operators from the pretenders.\n\nIndustry consolidation accelerates in downturns, but it creates a peculiar advantage for well-positioned players. The best time to build market share isn't during growth cycles—it's when competitors are resource-constrained. Your tech stack, creative velocity, and ability to ship fast become 10x more valuable.\n\nShare this with your team.\n\n#MarketingStrategy #IndustryInsight #MarketingLeadership #B2BMarketing #OperatorLife",
    image: FALLBACK_IMAGES[1],
  },
];

async function postToFB(caption, imageUrl) {
  const res = await axios.post(`${GRAPH}/${PAGE_ID}/photos`, {
    url: imageUrl,
    message: caption,
    access_token: ACCESS_TOKEN,
  });
  return res.data;
}

async function postToIG(caption, imageUrl) {
  // Step 1: Create container
  const container = await axios.post(`${GRAPH}/${IG_ACCOUNT_ID}/media`, {
    image_url: imageUrl,
    caption,
    access_token: ACCESS_TOKEN,
  });
  const containerId = container.data.id;
  console.log(`     IG container created: ${containerId}`);

  // Step 2: Wait for processing
  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status === 'IN_PROGRESS' && attempts < 30) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await axios.get(`${GRAPH}/${containerId}`, {
      params: { fields: 'status_code', access_token: ACCESS_TOKEN },
    });
    status = check.data.status_code;
    attempts++;
  }

  if (status !== 'FINISHED') {
    throw new Error(`IG container status: ${status} after ${attempts} attempts`);
  }

  // Step 3: Publish
  const pub = await axios.post(`${GRAPH}/${IG_ACCOUNT_ID}/media_publish`, {
    creation_id: containerId,
    access_token: ACCESS_TOKEN,
  });
  return pub.data;
}

(async () => {
  const D = '═'.repeat(62);
  console.log(`\n${D}`);
  console.log(' 🚀  MEDIATWIST PUBLISH TEST — 2 posts × 2 platforms');
  console.log(`     ${new Date().toISOString()}`);
  console.log(D);

  for (let i = 0; i < POSTS.length; i++) {
    const post = POSTS[i];
    console.log(`\n ── POST ${i + 1} ──────────────────────────────────────────────`);
    console.log(` Hook: "${post.facebook.split('\n')[0].slice(0, 60)}..."`);

    // Facebook
    try {
      console.log('\n  📘 Facebook...');
      const fbResult = await postToFB(post.facebook, post.image);
      console.log(`  ✅ Facebook posted! ID: ${fbResult.id || fbResult.post_id}`);
    } catch (err) {
      console.log(`  ❌ Facebook failed: ${err.response?.data?.error?.message || err.message}`);
    }

    // Instagram
    try {
      console.log('\n  📸 Instagram...');
      const igResult = await postToIG(post.instagram, post.image);
      console.log(`  ✅ Instagram posted! ID: ${igResult.id}`);
    } catch (err) {
      console.log(`  ❌ Instagram failed: ${err.response?.data?.error?.message || err.message}`);
    }

    // Small delay between posts
    if (i < POSTS.length - 1) {
      console.log('\n  ⏳ Waiting 5s before next post...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`\n${D}`);
  console.log(' 🎉  PUBLISH TEST COMPLETE');
  console.log(D);
})().catch(err => {
  console.error(`\n ❌ Fatal: ${err.message}`);
  process.exit(1);
});
