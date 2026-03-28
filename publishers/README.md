# Publishers Module

Production-ready publishing system for multi-platform social media posting (Facebook, Instagram, LinkedIn) with enterprise-grade retry logic, structured logging, and error handling.

## Architecture

```
publishers/
├── index.js          # Unified orchestrator (publishToAll)
├── retry.js          # Exponential backoff retry utility
├── logger.js         # Structured logging to console + logs/engine.log
├── cloudinary.js     # Media upload (image/video auto-detection)
├── facebook.js       # Facebook Graph API v20.0
├── instagram.js      # Instagram two-step media flow
└── linkedin.js       # LinkedIn personal/org posts with binary upload
```

## Core Features

### 1. Unified Publisher Interface

**Entry point:** `publishers/index.js`

```javascript
const { publishToAll } = require('./publishers');

const result = await publishToAll(
  {
    caption: 'Bold take on marketing...',
    imageUrl: 'https://example.com/image.jpg',
    videoUrl: undefined,
    overrides: {
      linkedin: 'Extended version for LinkedIn audience...'
    }
  },
  null,  // mediaUrl (optional if in post)
  { skipPlatforms: ['instagram'] }
);

// Returns:
{
  facebook: { success: true, data: { id: '...' } },
  instagram: { success: true, data: { id: '...' } },
  linkedin: { success: false, error: 'Credentials not configured' }
}
```

**Features:**
- Posts to all platforms in parallel (fast)
- Gracefully handles missing credentials (skips, doesn't crash)
- Platform-specific caption truncation (per config limits)
- Test mode: logs but doesn't post (when `TEST_MODE=true`)
- Platform-specific overrides for captions
- Video/image auto-detection

### 2. Retry Logic with Exponential Backoff

**Module:** `publishers/retry.js`

```javascript
const { withRetry } = require('./retry');

const result = await withRetry(
  () => someAsyncFunction(),
  {
    attempts: 3,
    delayMs: 2000,
    backoff: 'exponential',
    onRetry: (attempt, error, nextDelay) => {
      console.log(`Attempt ${attempt} failed, retrying in ${nextDelay}ms...`);
    }
  }
);
```

**Backoff strategies:**
- `exponential`: delay = 2000ms, 4000ms, 8000ms, ...
- `linear`: delay = 2000ms, 4000ms, 6000ms, ...

**All publishers use:**
- 3 attempts by default
- 2000ms initial delay
- Exponential backoff
- Structured retry logging

### 3. Structured Logging

**Module:** `publishers/logger.js`

Logs to both console and `logs/engine.log`:

```javascript
const { createLogger } = require('./logger');
const logger = createLogger('publisher:facebook');

logger.info('Posting image...');
logger.warn('Retrying after timeout');
logger.error('Post failed: invalid token');
logger.success('Posted successfully: id=12345');
```

**Output format:**
```
[2026-03-27T18:15:42.123Z] [INFO] [publisher:facebook] Posting image...
[2026-03-27T18:15:43.456Z] [SUCCESS] [publisher:facebook] Posted successfully: id=12345
```

**Log file:** `logs/engine.log` (created automatically)

### 4. Platform Modules

#### Facebook (`publishers/facebook.js`)

Posts images and videos using Graph API v20.0.

```javascript
const { postToFacebook, postVideoToFacebook } = require('./publishers/facebook');

// Image post
const result = await postToFacebook(
  'https://example.com/image.jpg',
  'Check out this bold take on marketing...',
  { published: true }  // false = draft
);

// Video post
const result = await postVideoToFacebook(
  'https://example.com/video.mp4',
  'New video insight...',
  { published: true }
);
```

**Requirements:**
- `.env`: `PAGE_ID`, `ACCESS_TOKEN`
- Access token: long-lived page token with publish permissions

**Features:**
- Auto-retry on network failures
- Response validation
- Structured logging
- Supports both published and draft modes

#### Instagram (`publishers/instagram.js`)

Posts images and videos with two-step container flow.

```javascript
const { postToInstagram } = require('./publishers/instagram');

const result = await postToInstagram(
  'https://example.com/media.jpg',  // or .mp4
  'Instagram caption here...',
  {
    mediaType: 'IMAGE',  // auto-detected if omitted
    pollMaxAttempts: 10  // container status polling
  }
);
```

**Requirements:**
- `.env`: `IG_ACCOUNT_ID`, `ACCESS_TOKEN`
- Scopes: `instagram_business_basic`, `instagram_business_content_publish`

**Features:**
- Automatic media type detection (image/video)
- Container status polling (waits for FINISHED)
- Two-step secure flow: create → publish
- Retry on transient failures

#### LinkedIn (`publishers/linkedin.js`)

Posts images as personal or organization updates.

```javascript
const { postToLinkedIn } = require('./publishers/linkedin');

const result = await postToLinkedIn(
  'https://example.com/image.jpg',
  'Professional insights...'
);
```

**Requirements:**
- `.env`: `LINKEDIN_ACCESS_TOKEN`
- Optional: `LINKEDIN_ORG_ID` (format: `urn:li:organization:12345`)
- Scopes: `w_member_social` (personal) or `w_organization_social` (org)

**Features:**
- Posts as person if no ORG_ID; as organization if set
- Binary image upload with presigned URLs
- Member/org URN auto-selection
- Asset registration flow

#### Cloudinary (`publishers/cloudinary.js`)

Uploads local files (images/videos) to Cloudinary.

```javascript
const { uploadMedia } = require('./publishers/cloudinary');

const url = await uploadMedia(
  '/path/to/video.mp4',
  {
    folder: 'mediatwist/posts/2026-03-27',  // auto-dated if omitted
    publicId: 'custom-id',  // optional
    overwrite: true
  }
);
// Returns: https://res.cloudinary.com/...
```

**Requirements:**
- `.env`: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

**Features:**
- Auto-detection of resource type (image/video)
- Date-based folder organization: `mediatwist/posts/YYYY-MM-DD/`
- Retry logic on upload failures
- Returns secure public URL

## Configuration

### Environment Variables (.env)

```env
# Facebook
PAGE_ID=123456789
ACCESS_TOKEN=EAAF...

# Instagram
IG_ACCOUNT_ID=987654321

# LinkedIn
LINKEDIN_ACCESS_TOKEN=AQV...
LINKEDIN_ORG_ID=urn:li:organization:12345

# Cloudinary
CLOUDINARY_CLOUD_NAME=mycloud
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abcdef...

# Publishing
TEST_MODE=false  # true = log but don't post
```

### Config (config/engine.js)

Platform-specific caption limits:

```javascript
content: {
  maxCaptionLength: {
    facebook:  2000,
    instagram: 2200,
    linkedin:  3000,
  },
},

publishing: {
  retryAttempts: 3,
  retryDelayMs:  2000,
  testMode:      process.env.TEST_MODE === 'true',
  graphApiVersion: 'v20.0',
}
```

## Usage Examples

### Example 1: Post with Image to All Platforms

```javascript
const { publishToAll } = require('./publishers');

async function postDailyContent() {
  const result = await publishToAll(
    {
      caption: 'Bold take: Most marketing strategies are outdated. Here\'s why...',
      imageUrl: 'https://cdn.example.com/posts/2026-03-27.jpg'
    },
    null,
    {}
  );

  if (result.facebook.success) {
    console.log('Facebook post: ' + result.facebook.data.id);
  }
  if (result.instagram.success) {
    console.log('Instagram post: ' + result.instagram.data.id);
  }
  if (result.linkedin.success) {
    console.log('LinkedIn post: ' + result.linkedin.data.id);
  }
}
```

### Example 2: Post with Video (Skip Instagram)

```javascript
const result = await publishToAll(
  {
    caption: 'Video insight about content strategy',
    videoUrl: 'https://example.com/video.mp4'
  },
  null,
  { skipPlatforms: ['instagram'] }  // Instagram only supports image carousel with videos
);
```

### Example 3: Platform-Specific Captions

```javascript
const result = await publishToAll(
  {
    caption: 'Base caption for all platforms',
    imageUrl: 'https://example.com/image.jpg',
    overrides: {
      linkedin: 'Extended LinkedIn version with article links and professional tone...',
      instagram: 'Short punchy version with emojis 🚀',
      facebook: 'Facebook version with engagement hook...'
    }
  },
  null,
  {}
);
```

### Example 4: Upload to Cloudinary First

```javascript
const { uploadMedia } = require('./publishers/cloudinary');
const { publishToAll } = require('./publishers');

async function uploadAndPublish(filePath) {
  // Upload to Cloudinary
  const imageUrl = await uploadMedia(filePath);

  // Then publish
  const result = await publishToAll(
    {
      caption: 'Check out our latest content...',
      imageUrl
    },
    null,
    {}
  );

  return result;
}
```

### Example 5: Test Mode

```javascript
// Set TEST_MODE=true in .env or:
process.env.TEST_MODE = 'true';

const result = await publishToAll(
  {
    caption: 'Will not actually post',
    imageUrl: 'https://example.com/image.jpg'
  },
  null,
  {}
);

// result.facebook.testMode === true
// result.instagram.testMode === true
// result.linkedin.testMode === true
```

## Error Handling

### Graceful Credential Failures

Missing credentials don't crash the entire system:

```javascript
// If IG_ACCOUNT_ID not set:
result.instagram = {
  success: false,
  error: 'Credentials not configured'
};

// System continues and posts to other platforms
result.facebook = { success: true, data: { id: '...' } };
result.linkedin = { success: true, data: { id: '...' } };
```

### Retry on Transient Failures

Network timeouts, temporary 5xx errors, etc. are retried automatically:

```
[2026-03-27T18:15:42Z] [WARN] [publisher:facebook] Facebook post retry (attempt 1): ECONNRESET. Waiting 2000ms...
[2026-03-27T18:15:44Z] [INFO] [publisher:facebook] Posting image...
[2026-03-27T18:15:45Z] [SUCCESS] [publisher:facebook] Posted successfully: id=123456
```

### Final Failures

After 3 retries, returns error in result:

```javascript
result.linkedin = {
  success: false,
  error: 'Invalid access token'
};
```

## API Status Codes

### Facebook Graph API

- `200`: Success
- `400`: Invalid parameters
- `401`: Invalid token
- `403`: Permission denied
- `429`: Rate limited (auto-retried)
- `500+`: Server error (auto-retried)

### Instagram Graph API

- `200`: Success
- `400`: Invalid parameters
- `401`: Invalid token
- `429`: Rate limited (auto-retried)

Container status polling:
- `FINISHED`: Ready to publish
- `ERROR`: Container failed, abort
- `IN_PROGRESS`: Still processing, keep polling

### LinkedIn API

- `200`: Member info
- `201`: Post created
- `400`: Invalid request
- `401`: Invalid token
- `403`: Permission denied

## Logging

### Log Levels

- `INFO`: General operations (post created, upload started)
- `WARN`: Retries, missing non-critical config
- `ERROR`: Failures, validation errors
- `SUCCESS`: Successful posts/uploads

### Example Log Output

```
[2026-03-27T18:15:42.123Z] [INFO] [publisher:orchestrator] Publishing to all platforms (test mode: false, media: image)
[2026-03-27T18:15:42.456Z] [INFO] [publisher:facebook] Posting image...
[2026-03-27T18:15:43.789Z] [SUCCESS] [publisher:facebook] Posted to Facebook: id=123456789, post_id=987654321
[2026-03-27T18:15:43.790Z] [INFO] [publisher:instagram] Creating Instagram media container...
[2026-03-27T18:15:44.100Z] [SUCCESS] [publisher:instagram] Created media container: 123456789
[2026-03-27T18:15:44.101Z] [INFO] [publisher:instagram] Polling container 123456789 status...
[2026-03-27T18:15:44.500Z] [INFO] [publisher:instagram] Container status: FINISHED
[2026-03-27T18:15:44.501Z] [INFO] [publisher:instagram] Publishing Instagram media container...
[2026-03-27T18:15:45.200Z] [SUCCESS] [publisher:instagram] Published to Instagram: post_id=987654321, media_type=IMAGE
[2026-03-27T18:15:45.201Z] [INFO] [publisher:linkedin] Posting to LinkedIn (org: yes)
[2026-03-27T18:15:45.600Z] [INFO] [publisher:linkedin] Registering image upload asset...
[2026-03-27T18:15:46.100Z] [SUCCESS] [publisher:linkedin] Registered asset: urn:li:digitalmedia:123456789
[2026-03-27T18:15:46.101Z] [INFO] [publisher:linkedin] Downloading image from URL...
[2026-03-27T18:15:46.500Z] [INFO] [publisher:linkedin] Downloaded 524288 bytes
[2026-03-27T18:15:46.501Z] [INFO] [publisher:linkedin] Uploading image binary to LinkedIn...
[2026-03-27T18:15:47.200Z] [SUCCESS] [publisher:linkedin] Image uploaded (status 201)
[2026-03-27T18:15:47.201Z] [INFO] [publisher:linkedin] Creating and publishing LinkedIn post...
[2026-03-27T18:15:47.900Z] [SUCCESS] [publisher:linkedin] Published to LinkedIn: {"id":"urn:li:share:..."}
[2026-03-27T18:15:47.901Z] [INFO] [publisher:orchestrator] Publishing complete: 3/3 platforms succeeded
```

## Testing

### Unit Testing Individual Publishers

```javascript
const { postToFacebook } = require('./publishers/facebook');

// Will retry on failure
try {
  const result = await postToFacebook(
    'https://example.com/image.jpg',
    'Test caption'
  );
  console.log('Success:', result.id);
} catch (err) {
  console.error('Failed after retries:', err.message);
}
```

### Integration Testing with publishToAll

```javascript
const { publishToAll } = require('./publishers');

process.env.TEST_MODE = 'true';

const result = await publishToAll(
  {
    caption: 'Test content',
    imageUrl: 'https://example.com/test.jpg'
  },
  null,
  {}
);

// All results will have testMode: true
assert(result.facebook.testMode === true);
assert(result.instagram.testMode === true);
assert(result.linkedin.testMode === true);
```

## Troubleshooting

### "PAGE_ID is not set in .env"

**Solution:** Add `PAGE_ID=your_page_id` to `.env`

### "Container status polling timeout"

**Cause:** Instagram processing taking longer than expected

**Solution:** Increase `pollMaxAttempts` option (default 10, ~5 seconds):

```javascript
await postToInstagram(url, caption, { pollMaxAttempts: 20 });
```

### "Invalid access token"

**Cause:** Token expired or invalid permissions

**Solution:**
1. Verify token has correct scopes
2. Get fresh token if expired
3. Check token is for correct platform

### Rate Limiting (429 errors)

**Behavior:** Automatically retried with exponential backoff

**Best practice:** Stagger posts to avoid rate limits
- Facebook: ~1 post per minute
- Instagram: ~1 post per minute
- LinkedIn: ~1 post per day (org), higher for personal

## Production Deployment Checklist

- [ ] All `.env` variables set and tested
- [ ] Credentials have correct scopes/permissions
- [ ] `logs/` directory writable
- [ ] Test mode disabled (`TEST_MODE=false`)
- [ ] Retry configuration appropriate for your rate limits
- [ ] Log rotation setup (logs/engine.log can grow large)
- [ ] Monitoring on `logs/engine.log` for ERROR levels
- [ ] Fallback process if all platforms fail
- [ ] Caption length limits verified for each platform

## File Structure

```
publishers/
├── index.js          (402 lines)  Unified orchestrator
├── retry.js          (99 lines)   Exponential backoff utility
├── logger.js         (102 lines)  Structured logging
├── cloudinary.js     (164 lines)  Media upload
├── facebook.js       (180 lines)  Facebook posting
├── instagram.js      (320 lines)  Instagram two-step flow
├── linkedin.js       (405 lines)  LinkedIn posting
└── README.md         (this file)
```

All files are production-ready with:
- Complete JSDoc
- Error handling
- Retry logic
- Structured logging
- No placeholder code
