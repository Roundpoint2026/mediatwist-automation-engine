# Quick Start Guide

## Installation

All dependencies already in `package.json`:
- `axios` (HTTP client)
- `dotenv` (environment variables)
- `cloudinary` (media upload)

## Setup

### 1. Environment Variables

Add to `.env`:

```env
# Facebook
PAGE_ID=your_page_id
ACCESS_TOKEN=your_page_token

# Instagram
IG_ACCOUNT_ID=your_ig_business_id

# LinkedIn
LINKEDIN_ACCESS_TOKEN=your_linkedin_token
LINKEDIN_ORG_ID=urn:li:organization:your_org_id

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Publishing
TEST_MODE=false
```

### 2. Import in Your Code

```javascript
const { publishToAll } = require('./publishers');
```

## Basic Usage

### Post to All Platforms

```javascript
const result = await publishToAll(
  {
    caption: 'Your post text here',
    imageUrl: 'https://example.com/image.jpg'
  },
  null,
  {}
);

console.log(result);
// {
//   facebook: { success: true, data: { id: '...' } },
//   instagram: { success: true, data: { id: '...' } },
//   linkedin: { success: true, data: { id: '...' } }
// }
```

### Post Video

```javascript
await publishToAll(
  {
    caption: 'Video post',
    videoUrl: 'https://example.com/video.mp4'
  },
  null,
  { skipPlatforms: ['instagram'] }  // IG doesn't support simple video posts
);
```

### Platform-Specific Captions

```javascript
await publishToAll(
  {
    caption: 'Default caption',
    imageUrl: 'https://example.com/image.jpg',
    overrides: {
      linkedin: 'Extended LinkedIn version with hashtags #marketing',
      instagram: 'Short punchy version with emojis 🚀'
    }
  },
  null,
  {}
);
```

### Test Mode (Log Only)

```javascript
process.env.TEST_MODE = 'true';

const result = await publishToAll({
  caption: 'This will not post',
  imageUrl: 'https://example.com/image.jpg'
});

// All results will have testMode: true
```

## Individual Platform Publishing

### Facebook

```javascript
const { postToFacebook, postVideoToFacebook } = require('./publishers/facebook');

// Image
await postToFacebook(
  'https://example.com/image.jpg',
  'Post caption'
);

// Video
await postVideoToFacebook(
  'https://example.com/video.mp4',
  'Video caption'
);
```

### Instagram

```javascript
const { postToInstagram } = require('./publishers/instagram');

await postToInstagram(
  'https://example.com/media.jpg',  // or .mp4
  'Instagram caption'
);
```

### LinkedIn

```javascript
const { postToLinkedIn } = require('./publishers/linkedin');

await postToLinkedIn(
  'https://example.com/image.jpg',
  'LinkedIn post'
);
```

### Cloudinary Upload

```javascript
const { uploadMedia } = require('./publishers/cloudinary');

const url = await uploadMedia('/local/path/to/video.mp4');
console.log('Uploaded to:', url);
```

## Error Handling

```javascript
try {
  const result = await publishToAll({
    caption: 'Post content',
    imageUrl: 'https://example.com/image.jpg'
  }, null, {});

  // Check each platform
  if (!result.facebook.success) {
    console.error('Facebook failed:', result.facebook.error);
  }
  if (!result.instagram.success) {
    console.error('Instagram failed:', result.instagram.error);
  }
  if (!result.linkedin.success) {
    console.error('LinkedIn failed:', result.linkedin.error);
  }

} catch (err) {
  // Critical validation error (missing caption, etc)
  console.error('Critical error:', err.message);
}
```

## Logging

Logs go to:
1. **Console** - real-time output
2. **logs/engine.log** - persistent file

```
[2026-03-27T18:15:42Z] [INFO] [publisher:facebook] Posting image...
[2026-03-27T18:15:43Z] [SUCCESS] [publisher:facebook] Posted successfully: id=123456
```

## Common Tasks

### Upload from Local File and Post

```javascript
const { uploadMedia } = require('./publishers/cloudinary');
const { publishToAll } = require('./publishers');

async function uploadAndPublish(filePath, caption) {
  // Upload to Cloudinary first
  const url = await uploadMedia(filePath);

  // Then publish to all platforms
  const result = await publishToAll({
    caption,
    imageUrl: url
  }, null, {});

  return result;
}
```

### Post Only to Specific Platforms

```javascript
// Only Facebook and LinkedIn (skip Instagram)
await publishToAll({
  caption: 'Post text',
  imageUrl: 'https://example.com/image.jpg'
}, null, {
  skipPlatforms: ['instagram']
});
```

### Check What Would Post (Test Mode)

```javascript
process.env.TEST_MODE = 'true';

const result = await publishToAll({
  caption: 'Check this before posting',
  imageUrl: 'https://example.com/image.jpg'
}, null, {});

// Review result, check logs
console.log(result);

// When ready, disable test mode
process.env.TEST_MODE = 'false';

// Post for real
const liveResult = await publishToAll({
  caption: 'Check this before posting',
  imageUrl: 'https://example.com/image.jpg'
}, null, {});
```

### Handle Different Caption Lengths per Platform

Captions are automatically truncated to platform limits:
- Facebook: 2000 characters
- Instagram: 2200 characters
- LinkedIn: 3000 characters

Override if needed:

```javascript
await publishToAll({
  caption: 'Short version for all',
  imageUrl: 'https://example.com/image.jpg',
  overrides: {
    linkedin: 'Long version with full story, context, and hashtags #strategy #marketing'
  }
}, null, {});
```

## Troubleshooting

### Missing Credentials

If a credential is missing for a platform, that platform is skipped gracefully:

```javascript
// If IG_ACCOUNT_ID not set in .env:
result.instagram = {
  success: false,
  error: 'Credentials not configured'
};
```

No need to handle this specially - just check the result.

### Retry Behavior

If a post fails due to network error, it's automatically retried 3 times:

```
Attempt 1 fails → wait 2s → Attempt 2 fails → wait 4s → Attempt 3 fails → error
```

No action needed - happens automatically.

### Check Logs for Detailed Info

```bash
# Real-time logs
tail -f logs/engine.log

# Search for errors
grep ERROR logs/engine.log

# Success count
grep SUCCESS logs/engine.log | wc -l
```

## API Token Requirements

### Facebook

- Token: Long-lived page access token
- Scope: `pages_manage_posts`
- Get: Facebook App → Tools → Get Token

### Instagram

- Token: Same as Facebook or separate app token
- Scopes: `instagram_business_basic`, `instagram_business_content_publish`
- Account: Business/Creator (not personal)

### LinkedIn

- Token: OAuth token or personal access token
- Scopes: `w_member_social` (personal) + `w_organization_social` (org posts)
- Get: LinkedIn App → OAuth 2.0 Settings

### Cloudinary

- Cloud Name: Your Cloudinary account name
- API Key: From Account Settings
- API Secret: From Account Settings (keep secret!)

## Next Steps

1. Set up `.env` with your credentials
2. Test with `TEST_MODE=true`
3. Review `logs/engine.log` for any issues
4. Set `TEST_MODE=false` for production
5. Integrate with your content pipeline
6. Monitor `logs/engine.log` for errors

See `README.md` for full documentation.
