#!/usr/bin/env node
/**
 * scripts/canvaAuth.js — Canva OAuth2 Authorization Flow
 * ─────────────────────────────────────────────────────────────────────────────
 * Run this once to get your Canva access token + refresh token.
 *
 * Usage:
 *   node scripts/canvaAuth.js
 *
 * What it does:
 *   1. Generates a PKCE code challenge
 *   2. Opens your browser to Canva's authorization page
 *   3. Starts a local server on port 3000 to catch the callback
 *   4. Exchanges the auth code for access + refresh tokens
 *   5. Saves both tokens to your .env file
 *
 * After running this, your engine can use the Canva Connect API.
 * The access token lasts ~4 hours; use canvaRefresh.js to refresh it.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ─── Config ──────────────────────────────────────────────────────────────────

const CLIENT_ID = process.env.CANVA_CLIENT_ID || 'OC-AZ0yjf66YdT9';
const CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://127.0.0.1:3000/callback';
const SCOPES = [
  'profile:read',
  'folder:read',
  'folder:write',
  'design:meta:read',
  'design:content:read',
  'design:content:write',
  'asset:read',
  'asset:write',
].join(' ');

const ENV_PATH = path.resolve(__dirname, '../.env');

// ─── PKCE Helpers ────────────────────────────────────────────────────────────

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ─── .env Writer ─────────────────────────────────────────────────────────────

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

// ─── Main Flow ───────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔐  Canva OAuth2 Authorization');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!CLIENT_SECRET) {
    console.error('❌  CANVA_CLIENT_SECRET not set in .env');
    process.exit(1);
  }

  // Step 1: Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  console.log('  ✅  Generated PKCE code challenge');

  // Step 2: Build authorization URL
  const authUrl = new URL('https://www.canva.com/api/oauth/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Step 3: Start local server to catch the callback
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization Failed</h1><p>${error}</p>`);
        console.error(`\n  ❌  Authorization failed: ${error}`);
        server.close();
        reject(new Error(error));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Missing authorization code</h1>');
        return;
      }

      console.log('  ✅  Received authorization code');
      console.log('  ⏳  Exchanging for access token...');

      try {
        // Step 4: Exchange code for tokens
        const tokenResponse = await axios.post(
          'https://api.canva.com/rest/v1/oauth/token',
          new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            code_verifier: codeVerifier,
            redirect_uri: REDIRECT_URI,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
            },
          }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        if (!access_token) {
          throw new Error('No access_token in response');
        }

        // Step 5: Save to .env
        updateEnvValue('CANVA_ACCESS_TOKEN', access_token);
        if (refresh_token) {
          updateEnvValue('CANVA_REFRESH_TOKEN', refresh_token);
        }

        console.log('  ✅  Access token saved to .env');
        if (refresh_token) console.log('  ✅  Refresh token saved to .env');
        console.log(`  ⏱   Token expires in ${Math.round(expires_in / 3600)} hours`);
        console.log('\n  🎉  Canva is ready! Run your engine with:');
        console.log('      node index.js --canva-first\n');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="background:#0A0A0A;color:#FFD600;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
              <div style="text-align:center">
                <h1 style="font-size:3em">✅</h1>
                <h2>Canva Connected!</h2>
                <p style="color:#ccc">Access token saved to .env — you can close this tab.</p>
                <p style="color:#666;font-size:0.8em">The Mediatwist Group</p>
              </div>
            </body>
          </html>
        `);

        server.close();
        resolve({ access_token, refresh_token });
      } catch (err) {
        const errMsg = err.response?.data?.error_description || err.message;
        console.error(`\n  ❌  Token exchange failed: ${errMsg}`);
        if (err.response?.data) {
          console.error('     Response:', JSON.stringify(err.response.data, null, 2));
        }

        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Token Exchange Failed</h1><p>${errMsg}</p>`);
        server.close();
        reject(err);
      }
    });

    server.listen(3000, '127.0.0.1', () => {
      console.log('  ✅  Local callback server running on http://127.0.0.1:3000');
      console.log('\n  🌐  Opening browser for authorization...\n');

      // Open browser (macOS)
      try {
        execSync(`open "${authUrl.toString()}"`);
      } catch {
        console.log('  ⚠️  Could not open browser automatically.');
        console.log('  📋  Open this URL manually:\n');
        console.log(`  ${authUrl.toString()}\n`);
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      console.error('\n  ❌  Timeout: No authorization received in 5 minutes');
      server.close();
      reject(new Error('Authorization timeout'));
    }, 5 * 60 * 1000);
  });
}

// ─── Execute ─────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error(`\n  Fatal: ${err.message}`);
  process.exit(1);
});
