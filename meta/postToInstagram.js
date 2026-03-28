require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
var https = require('https');
var querystring = require('querystring');

var ACCESS_TOKEN = process.env.ACCESS_TOKEN;
var IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;

function makePost(hostname, path, body) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: hostname,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    var req = https.request(options, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function postToInstagram(imageUrl, caption) {
  if (!IG_ACCOUNT_ID) {
    console.log('[Instagram] IG_ACCOUNT_ID not set in .env — skipping');
    return null;
  }
  try {
    var containerBody = querystring.stringify({
      image_url: imageUrl,
      caption: caption,
      access_token: ACCESS_TOKEN
    });
    var container = await makePost('graph.facebook.com', '/v19.0/' + IG_ACCOUNT_ID + '/media', containerBody);
    if (!container.id) {
      console.log('[Instagram] Container error:', JSON.stringify(container));
      return container;
    }
    var publishBody = querystring.stringify({
      creation_id: container.id,
      access_token: ACCESS_TOKEN
    });
    var result = await makePost('graph.facebook.com', '/v19.0/' + IG_ACCOUNT_ID + '/media_publish', publishBody);
    return result;
  } catch(e) {
    console.error('[Instagram] Error:', e.message);
    return null;
  }
}

module.exports = { postToInstagram: postToInstagram };
