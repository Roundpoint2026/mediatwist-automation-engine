require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
var https = require('https');

var LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;

function jsonRequest(method, path, body) {
  return new Promise(function(resolve, reject) {
    var payload = body ? JSON.stringify(body) : null;
    var headers = {
      'Authorization': 'Bearer ' + LINKEDIN_TOKEN,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    var req = https.request({ hostname: 'api.linkedin.com', path: path, method: method, headers: headers }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var raw = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function downloadImage(url) {
  return new Promise(function(resolve, reject) {
    var mod = url.startsWith('https') ? https : require('http');
    mod.get(url, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadImage(res.headers.location));
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks)); });
    }).on('error', reject);
  });
}

function putBinary(uploadUrl, buffer) {
  return new Promise(function(resolve, reject) {
    var u = new URL(uploadUrl);
    var req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + LINKEDIN_TOKEN,
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length
      }
    }, function(res) {
      res.on('data', function() {});
      res.on('end', function() { resolve(res.statusCode); });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

async function postToLinkedIn(imageUrl, caption) {
  if (!LINKEDIN_TOKEN) {
    console.log('[LinkedIn] LINKEDIN_ACCESS_TOKEN not set — skipping');
    return null;
  }
  try {
    var meRes = await jsonRequest('GET', '/v2/me');
    if (!meRes.body || !meRes.body.id) {
      console.log('[LinkedIn] Could not get member ID:', JSON.stringify(meRes.body));
      return meRes.body;
    }
    var personUrn = 'urn:li:person:' + meRes.body.id;

    var reg = await jsonRequest('POST', '/v2/assets?action=registerUpload', {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }]
      }
    });
    if (reg.status !== 200) {
      console.log('[LinkedIn] Register upload failed:', JSON.stringify(reg.body));
      return reg.body;
    }

    var assetUrn = reg.body.value.asset;
    var uploadUrl = reg.body.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    var imgBuffer = await downloadImage(imageUrl);
    var uploadStatus = await putBinary(uploadUrl, imgBuffer);
    if (uploadStatus < 200 || uploadStatus > 299) {
      console.log('[LinkedIn] Image upload failed, status:', uploadStatus);
      return null;
    }

    var post = await jsonRequest('POST', '/v2/ugcPosts', {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory: 'IMAGE',
          media: [{ status: 'READY', media: assetUrn }]
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    });
    return post.body;
  } catch(e) {
    console.error('[LinkedIn] Error:', e.message);
    return null;
  }
}

module.exports = { postToLinkedIn: postToLinkedIn };
