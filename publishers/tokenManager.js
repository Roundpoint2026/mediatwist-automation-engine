/**
 * publishers/tokenManager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Token management for Meta (Facebook/Instagram) Graph API.
 *
 * Facebook Page tokens from Graph Explorer are SHORT-LIVED (~1-2 hours).
 * This module exchanges them for LONG-LIVED tokens (~60 days) and handles
 * automatic refresh before expiration.
 *
 * Flow:
 *   1. Get short-lived user token from Graph Explorer
 *   2. Exchange for long-lived user token (60 days)
 *   3. Use long-lived user token to get a NEVER-EXPIRING page token
 *
 * Usage:
 *   node publishers/tokenManager.js --exchange          # Exchange short → long-lived
 *   node publishers/tokenManager.js --page-token        # Get never-expiring page token
 *   node publishers/tokenManager.js --check             # Check current token validity
 *
 * Required .env:
 *   ACCESS_TOKEN          — Current token (short or long-lived)
 *   FB_APP_ID             — Facebook App ID
 *   FB_APP_SECRET         — Facebook App Secret
 *   PAGE_ID               — Facebook Page ID
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: false });

const axios  = require('axios');
const fs     = require('fs');
const { createLogger } = require('./logger');

const logger = createLogger('token-manager');
const GRAPH_API = 'https://graph.facebook.com/v20.0';

/**
 * Exchange a short-lived token for a long-lived one (~60 days).
 *
 * @param {string} shortLivedToken - Short-lived user access token from Graph Explorer
 * @returns {Promise<{access_token: string, token_type: string, expires_in: number}>}
 */
async function exchangeForLongLived(shortLivedToken) {
  const { FB_APP_ID, FB_APP_SECRET } = process.env;

  if (!FB_APP_ID || !FB_APP_SECRET) {
    throw new Error('FB_APP_ID and FB_APP_SECRET are required in .env to exchange tokens');
  }

  logger.info('Exchanging short-lived token for long-lived token...');

  const response = await axios.get(`${GRAPH_API}/oauth/access_token`, {
    params: {
      grant_type:        'fb_exchange_token',
      client_id:         FB_APP_ID,
      client_secret:     FB_APP_SECRET,
      fb_exchange_token: shortLivedToken || process.env.ACCESS_TOKEN,
    },
  });

  const { access_token, expires_in } = response.data;

  let expiresAt = 'Unknown';
  let daysApprox = '?';
  if (expires_in && !isNaN(expires_in)) {
    const expiresDate = new Date(Date.now() + expires_in * 1000);
    expiresAt = expiresDate.toISOString();
    daysApprox = Math.round(expires_in / 86400);
  }

  logger.success(`Long-lived token obtained. Expires: ${expiresAt} (~${daysApprox} days)`);

  return {
    access_token,
    token_type: response.data.token_type,
    expires_in: expires_in || 0,
    expires_at: expiresAt,
  };
}

/**
 * Get a NEVER-EXPIRING page access token.
 * Requires a long-lived user token.
 *
 * @param {string} longLivedUserToken - Long-lived user access token
 * @returns {Promise<{pageToken: string, pageName: string}>}
 */
async function getPageToken(longLivedUserToken) {
  const { PAGE_ID } = process.env;
  const token = longLivedUserToken || process.env.ACCESS_TOKEN;

  logger.info('Fetching never-expiring page access token...');

  // Fetch all pages with pagination support
  let allPages = [];
  let url = `${GRAPH_API}/me/accounts`;
  let params = { access_token: token, limit: 100 };

  while (url) {
    const response = await axios.get(url, { params });
    const pages = response.data.data || [];
    allPages = allPages.concat(pages);
    // Follow pagination cursor if present
    url = response.data.paging && response.data.paging.next ? response.data.paging.next : null;
    params = {}; // next URL includes all params
  }

  logger.info(`Found ${allPages.length} page(s) accessible to this token`);

  const page = PAGE_ID
    ? allPages.find(p => p.id === PAGE_ID)
    : allPages[0];

  if (!page) {
    // If page not found, try fetching the page token directly via PAGE_ID
    if (PAGE_ID) {
      logger.info(`Page ${PAGE_ID} not in /me/accounts list. Trying direct fetch...`);
      try {
        const directResponse = await axios.get(`${GRAPH_API}/${PAGE_ID}`, {
          params: { fields: 'access_token,name,id', access_token: token },
        });
        if (directResponse.data && directResponse.data.access_token) {
          logger.success(`Page token obtained directly for "${directResponse.data.name}" (${directResponse.data.id})`);
          logger.info('This page token NEVER expires as long as the app is not removed from the page.');
          return {
            pageToken: directResponse.data.access_token,
            pageId:    directResponse.data.id,
            pageName:  directResponse.data.name,
          };
        }
      } catch (directErr) {
        logger.error(`Direct page fetch also failed: ${directErr.message}`);
      }
    }
    throw new Error(`Page not found. Available pages: ${allPages.map(p => `${p.name} (${p.id})`).join(', ')}`);
  }

  logger.success(`Page token obtained for "${page.name}" (${page.id})`);
  logger.info('This page token NEVER expires as long as the app is not removed from the page.');

  return {
    pageToken: page.access_token,
    pageId:    page.id,
    pageName:  page.name,
  };
}

/**
 * Check if the current ACCESS_TOKEN is valid and get its debug info.
 *
 * @returns {Promise<object>} Token debug info
 */
async function checkToken() {
  const token = process.env.ACCESS_TOKEN;
  if (!token) throw new Error('ACCESS_TOKEN not set in .env');

  logger.info('Checking token validity...');

  try {
    // Try a simple API call
    const response = await axios.get(`${GRAPH_API}/me`, {
      params: { access_token: token },
    });

    logger.success(`Token is valid. User/Page: ${response.data.name || response.data.id}`);

    // Try to get token debug info
    const { FB_APP_ID, FB_APP_SECRET } = process.env;
    if (FB_APP_ID && FB_APP_SECRET) {
      const debugResponse = await axios.get(`${GRAPH_API}/debug_token`, {
        params: {
          input_token:  token,
          access_token: `${FB_APP_ID}|${FB_APP_SECRET}`,
        },
      });

      const data = debugResponse.data.data;
      const expiresAt = data.expires_at
        ? new Date(data.expires_at * 1000).toISOString()
        : 'Never (page token)';

      return {
        valid:     data.is_valid,
        type:      data.type,
        appId:     data.app_id,
        expiresAt,
        scopes:    data.scopes,
      };
    }

    return { valid: true, name: response.data.name };
  } catch (err) {
    logger.error(`Token check failed: ${err.response?.data?.error?.message || err.message}`);
    return { valid: false, error: err.response?.data?.error?.message || err.message };
  }
}

/**
 * Update the .env file with a new ACCESS_TOKEN value.
 */
function updateEnvToken(newToken) {
  const envPath = path.resolve(__dirname, '../.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');

  if (envContent.includes('ACCESS_TOKEN=')) {
    envContent = envContent.replace(
      /ACCESS_TOKEN=.*/,
      `ACCESS_TOKEN=${newToken}`
    );
  } else {
    envContent += `\nACCESS_TOKEN=${newToken}\n`;
  }

  fs.writeFileSync(envPath, envContent, 'utf-8');
  logger.success('Updated ACCESS_TOKEN in .env file');
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const DIVIDER = '═'.repeat(62);

  (async () => {
    console.log(`\n${DIVIDER}`);
    console.log(' 🔑  META TOKEN MANAGER');
    console.log(DIVIDER);

    if (args.includes('--exchange')) {
      const result = await exchangeForLongLived();
      console.log('\n Long-lived token:');
      console.log(` ${result.access_token.slice(0, 30)}...`);
      console.log(` Expires: ${result.expires_at}`);

      if (args.includes('--save')) {
        updateEnvToken(result.access_token);
      } else {
        console.log('\n Run with --save to update .env automatically.');
      }

    } else if (args.includes('--page-token')) {
      const result = await getPageToken();
      console.log(`\n Page: ${result.pageName} (${result.pageId})`);
      console.log(` Token: ${result.pageToken.slice(0, 30)}...`);
      console.log(' This token NEVER expires.');

      if (args.includes('--save')) {
        updateEnvToken(result.pageToken);
      } else {
        console.log('\n Run with --save to update .env automatically.');
      }

    } else if (args.includes('--check')) {
      const info = await checkToken();
      console.log('\n Token info:', JSON.stringify(info, null, 2));

    } else {
      console.log('\n Usage:');
      console.log('   node publishers/tokenManager.js --exchange [--save]');
      console.log('   node publishers/tokenManager.js --page-token [--save]');
      console.log('   node publishers/tokenManager.js --check');
      console.log('\n Steps for a never-expiring token:');
      console.log('   1. Get a short-lived token from Graph Explorer');
      console.log('   2. Run: node publishers/tokenManager.js --exchange --save');
      console.log('   3. Run: node publishers/tokenManager.js --page-token --save');
      console.log('   4. Your .env now has a never-expiring page token!');
    }

    console.log(`\n${DIVIDER}\n`);
  })().catch(err => {
    console.error(`\n ❌ ${err.message}\n`);
    process.exit(1);
  });
}

/**
 * Pre-flight token health check for use before engine runs.
 * Returns { valid, expiresAt, daysRemaining, isPageToken, warning }.
 * If token expires within WARNING_DAYS, returns a warning message.
 * If token is expired or invalid, returns valid: false with error.
 *
 * @param {number} [warningDays=7] - Warn if token expires within this many days
 * @returns {Promise<object>}
 */
async function preflightTokenCheck(warningDays = 7) {
  const token = process.env.ACCESS_TOKEN;
  if (!token) {
    return { valid: false, error: 'ACCESS_TOKEN not set in .env' };
  }

  try {
    // Quick validity check
    await axios.get(`${GRAPH_API}/me`, { params: { access_token: token }, timeout: 10000 });

    // Get detailed token info
    const { FB_APP_ID, FB_APP_SECRET } = process.env;
    if (FB_APP_ID && FB_APP_SECRET) {
      const debugResponse = await axios.get(`${GRAPH_API}/debug_token`, {
        params: {
          input_token:  token,
          access_token: `${FB_APP_ID}|${FB_APP_SECRET}`,
        },
        timeout: 10000,
      });

      const data = debugResponse.data.data;

      if (!data.is_valid) {
        return { valid: false, error: 'Token is marked as invalid by Facebook' };
      }

      // expires_at === 0 means never-expiring page token
      if (!data.expires_at || data.expires_at === 0) {
        return {
          valid: true,
          expiresAt: 'Never',
          daysRemaining: Infinity,
          isPageToken: true,
          warning: null,
        };
      }

      const expiresAt = new Date(data.expires_at * 1000);
      const now = new Date();
      const daysRemaining = Math.round((expiresAt - now) / (1000 * 60 * 60 * 24));

      let warning = null;
      if (daysRemaining <= 0) {
        return { valid: false, error: `Token expired on ${expiresAt.toISOString()}` };
      } else if (daysRemaining <= warningDays) {
        warning = `Token expires in ${daysRemaining} day(s) on ${expiresAt.toISOString()}. ` +
          'Run: npm run token:exchange && npm run token:page';
      }

      return {
        valid: true,
        expiresAt: expiresAt.toISOString(),
        daysRemaining,
        isPageToken: data.type === 'PAGE',
        warning,
      };
    }

    // No app credentials to do deep check — token works, that's all we know
    return { valid: true, expiresAt: 'Unknown (no FB_APP_ID/FB_APP_SECRET for debug)', daysRemaining: null, warning: null };

  } catch (err) {
    const fbError = err.response?.data?.error?.message || err.message;
    return { valid: false, error: fbError };
  }
}

module.exports = { exchangeForLongLived, getPageToken, checkToken, updateEnvToken, preflightTokenCheck };
