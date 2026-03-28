#!/usr/bin/env node
/**
 * scripts/canvaRefresh.js — Refresh Canva Access Token
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage: node scripts/canvaRefresh.js
 *
 * Uses the refresh token to get a new access token without re-authorizing.
 * Saves the new tokens to .env automatically.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CLIENT_ID = process.env.CANVA_CLIENT_ID;
const CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.CANVA_REFRESH_TOKEN;
const ENV_PATH = path.resolve(__dirname, '../.env');

function updateEnvValue(key, value) {
  let envContent = fs.readFileSync(ENV_PATH, 'utf8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, envContent, 'utf8');
}

async function main() {
  console.log('\n🔄  Refreshing Canva access token...\n');

  if (!REFRESH_TOKEN) {
    console.error('❌  CANVA_REFRESH_TOKEN not set in .env');
    console.error('   Run: node scripts/canvaAuth.js first');
    process.exit(1);
  }

  const response = await axios.post(
    'https://api.canva.com/rest/v1/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
    }
  );

  const { access_token, refresh_token, expires_in } = response.data;

  updateEnvValue('CANVA_ACCESS_TOKEN', access_token);
  if (refresh_token) updateEnvValue('CANVA_REFRESH_TOKEN', refresh_token);

  console.log('✅  New access token saved to .env');
  console.log(`⏱   Expires in ${Math.round(expires_in / 3600)} hours\n`);
}

main().catch(err => {
  console.error(`❌  Refresh failed: ${err.response?.data?.error_description || err.message}`);
  process.exit(1);
});
