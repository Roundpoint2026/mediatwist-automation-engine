require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
var postToFacebook   = require('./meta/postToFacebook').postToFacebook;
var postToInstagram  = require('./meta/postToInstagram').postToInstagram;
var postToLinkedIn   = require('./linkedin/postToLinkedIn').postToLinkedIn;
var generatePosts    = require('./ai/generatePost').generatePosts;

(async function() {
  var post = generatePosts()[0];
  var caption  = post.caption;
  var imageUrl = post.imageUrl;
  var category = post.category;

  console.log('==============================');
  console.log('Category:', category);
  console.log('Caption preview:', caption.substring(0, 80) + '...');
  console.log('==============================');

  var results = await Promise.allSettled([
    postToFacebook(imageUrl, caption),
    postToInstagram(imageUrl, caption),
    postToLinkedIn(imageUrl, caption)
  ]);

  var platforms = ['Facebook', 'Instagram', 'LinkedIn'];
  results.forEach(function(result, i) {
    if (result.status === 'fulfilled') {
      var val = result.value;
      if (val === null) {
        console.log('[' + platforms[i] + '] Skipped — credentials not configured yet');
      } else if (val && (val.id || val.post_id)) {
        console.log('[' + platforms[i] + '] Published! ' + JSON.stringify(val));
      } else {
        console.log('[' + platforms[i] + '] Response:', JSON.stringify(val));
      }
    } else {
      console.log('[' + platforms[i] + '] Error:', result.reason && result.reason.message);
    }
  });
})();
