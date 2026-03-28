# Publishers Module Index

## Overview

Production-ready multi-platform social media publishing system with retry logic, structured logging, and comprehensive error handling.

**Total Code:** 2,354 lines (7 modules + 3 docs)

## Module Files

### Core Orchestrator

#### `index.js` (404 lines)
**Unified publisher interface for all platforms**

- Exports: `publishToAll(post, mediaUrl, options?)`
- Coordinates parallel publishing to Facebook, Instagram, LinkedIn
- Handles graceful credential fallback
- Platform-specific caption truncation
- Test mode support
- Individual error handling per platform

**Key Functions:**
- `publishToAll()` - Main orchestrator

**Dependencies:**
- ./facebook.js, ./instagram.js, ./linkedin.js
- ./logger.js, ./retry.js
- ../config/engine.js

### Utility Modules

#### `retry.js` (99 lines)
**Exponential backoff retry utility**

- Exports: `withRetry(fn, options?)`
- Supports exponential and linear backoff
- Configurable attempts and delays
- Optional retry callback
- Used by all platform publishers

**Key Functions:**
- `withRetry()` - Execute with automatic retries

**Configuration Options:**
- `attempts`: Number of retry attempts (default: 3)
- `delayMs`: Initial delay in milliseconds (default: 2000)
- `backoff`: Strategy ('exponential' or 'linear')
- `onRetry`: Callback function on retry

#### `logger.js` (102 lines)
**Structured logging to console and file**

- Exports: `createLogger(moduleName)`
- Logs with ISO timestamps to console
- Appends to logs/engine.log
- Four log levels: info, warn, error, success
- Auto-creates logs directory

**Key Functions:**
- `createLogger()` - Create logger instance
- `logger.info()` - Info level log
- `logger.warn()` - Warning level log
- `logger.error()` - Error level log
- `logger.success()` - Success level log

**Output Format:**
`[2026-03-27T18:15:42Z] [LEVEL] [module:name] Message here`

### Platform Publishers

#### `facebook.js` (180 lines)
**Facebook Page posting via Graph API v20.0**

- Exports: `postToFacebook()`, `postVideoToFacebook()`
- Image posts via /photos endpoint
- Video posts via /videos endpoint
- Built-in retry and logging
- Response validation

**Key Functions:**
- `postToFacebook(mediaUrl, caption, options?)` - Post image
- `postVideoToFacebook(videoUrl, caption, options?)` - Post video

**Required .env:**
- PAGE_ID
- ACCESS_TOKEN

**Features:**
- Auto-retry on network failures
- Response validation (checks for id field)
- Supports draft/published modes
- Structured error logging

#### `instagram.js` (320 lines)
**Instagram posting with two-step container flow**

- Exports: `postToInstagram()`
- Auto-detects image vs. video media type
- Create media container → poll status → publish flow
- Built-in retry and logging
- Container status polling

**Key Functions:**
- `postToInstagram(mediaUrl, caption, options?)` - Post image/video
- `detectMediaType()` - Auto-detect from URL/content-type
- `pollContainerStatus()` - Poll until FINISHED or timeout

**Required .env:**
- IG_ACCOUNT_ID
- ACCESS_TOKEN (with instagram_business_basic, instagram_business_content_publish)

**Features:**
- Automatic media type detection
- Adaptive polling (stops on FINISHED)
- Handles both images and videos
- Retry with exponential backoff

#### `linkedin.js` (405 lines)
**LinkedIn posting (personal or organizational)**

- Exports: `postToLinkedIn()`
- Posts as person if no ORG_ID, as organization if set
- Image upload via presigned URLs
- Binary download and upload support
- Built-in retry and logging

**Key Functions:**
- `postToLinkedIn(imageUrl, caption, options?)` - Post image
- `downloadFile()` - Download image binary
- `uploadBinary()` - Upload to presigned URL
- `makeJsonRequest()` - LinkedIn API requests

**Required .env:**
- LINKEDIN_ACCESS_TOKEN
- LINKEDIN_ORG_ID (optional, format: urn:li:organization:12345)

**Features:**
- Personal or organization posting
- Binary image upload
- Member/org URN auto-selection
- Asset registration and upload flow
- Retry on failures

#### `cloudinary.js` (164 lines)
**Media upload to Cloudinary**

- Exports: `uploadMedia()`
- Auto-detects image vs. video from file extension
- Date-based folder organization
- Retry logic and structured logging
- Returns secure public URL

**Key Functions:**
- `uploadMedia(filePath, options?)` - Upload file
- `detectResourceType()` - Auto-detect from extension
- `getFolderPath()` - Generate dated folder path

**Required .env:**
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

**Features:**
- Auto-detection of resource type
- Date-based folder organization (mediatwist/posts/YYYY-MM-DD/)
- Retry on upload failures
- Cloudinary URL returned

### Documentation

#### `README.md` (550+ lines)
**Comprehensive module documentation**

Covers:
- Architecture overview
- Core features with examples
- Platform modules (Facebook, Instagram, LinkedIn, Cloudinary)
- Configuration and environment variables
- Usage examples for every scenario
- Error handling patterns
- API status codes
- Logging details
- Testing approaches
- Troubleshooting guide
- Production deployment checklist

#### `QUICK_START.md` (300+ lines)
**Quick reference guide for getting started**

Covers:
- Installation and setup
- Basic usage patterns
- Individual platform publishing
- Error handling
- Common tasks
- Troubleshooting
- API token requirements
- Next steps

#### `ARCHITECTURE.md` (400+ lines)
**Technical architecture and design details**

Covers:
- Module dependency graph
- Data flow diagrams
- Request/response patterns per platform
- Error handling strategy
- Performance characteristics
- Configuration sources
- Extensibility points
- Testing strategy
- Monitoring and observability

## Usage Patterns

### Pattern 1: Post to All Platforms

```javascript
const { publishToAll } = require('./publishers');

const result = await publishToAll({
  caption: 'Post text',
  imageUrl: 'https://example.com/image.jpg'
}, null, {});
```

### Pattern 2: Upload and Post

```javascript
const { uploadMedia } = require('./publishers/cloudinary');
const { publishToAll } = require('./publishers');

const url = await uploadMedia('/path/to/file.mp4');
const result = await publishToAll({
  caption: 'Post text',
  imageUrl: url
}, null, {});
```

### Pattern 3: Individual Platform

```javascript
const { postToFacebook } = require('./publishers/facebook');

const result = await postToFacebook(
  'https://example.com/image.jpg',
  'Caption'
);
```

### Pattern 4: Test Mode

```javascript
process.env.TEST_MODE = 'true';
const result = await publishToAll({
  caption: 'Test',
  imageUrl: 'https://example.com/image.jpg'
}, null, {});
// All results will have testMode: true
```

## File Organization

```
publishers/
├── Core
│   └── index.js                 (404 lines) Main orchestrator
├── Utilities
│   ├── retry.js                 (99 lines)  Retry logic
│   └── logger.js                (102 lines) Structured logging
├── Platforms
│   ├── facebook.js              (180 lines) Facebook posting
│   ├── instagram.js             (320 lines) Instagram posting
│   ├── linkedin.js              (405 lines) LinkedIn posting
│   └── cloudinary.js            (164 lines) Media upload
└── Documentation
    ├── README.md                (550+ lines) Full documentation
    ├── QUICK_START.md           (300+ lines) Quick reference
    ├── ARCHITECTURE.md          (400+ lines) Technical details
    └── INDEX.md                 (this file)
```

## Dependencies

### External NPM Packages
- `axios` - HTTP client (Facebook, Instagram, LinkedIn, Cloudinary)
- `dotenv` - Environment variables
- `cloudinary` - Cloudinary SDK

### Node.js Built-ins
- `path` - File path utilities
- `fs` - File system (logging)
- `https` - HTTPS requests (LinkedIn)
- `http` - HTTP requests (LinkedIn redirects)

### Internal Dependencies
- `../config/engine.js` - Configuration
- `../.env` - Environment variables

## Development

### Adding a New Platform

1. Create `publishers/{platform}.js`
2. Export main function: `post{Platform}(mediaUrl, caption, options)`
3. Use `withRetry()` and `createLogger()`
4. Update `publishers/index.js` to include new platform
5. Update `config/engine.js` with caption limits

### Adding a New Feature

1. Modify relevant module
2. Update JSDoc
3. Update README.md
4. Update QUICK_START.md if user-facing
5. Update ARCHITECTURE.md if structural change

## Testing

### Validate Syntax
```bash
node -c publishers/*.js
```

### Test Individual Module
```javascript
const { postToFacebook } = require('./publishers/facebook');
const result = await postToFacebook(url, caption);
```

### Test All Platforms
```javascript
const { publishToAll } = require('./publishers');
const result = await publishToAll({caption, imageUrl}, null, {});
```

### Check Logs
```bash
tail -f logs/engine.log
grep ERROR logs/engine.log
grep SUCCESS logs/engine.log
```

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Facebook post | 1-2s | Includes retry |
| Instagram post | 3-5s | Includes polling |
| LinkedIn post | 5-10s | Includes download/upload |
| Cloudinary upload | 2-5s | Depends on file size |
| publishToAll() | 5-15s | Parallel execution |

## Error Codes

### Retryable Errors
- Network timeouts
- Server 5xx errors
- Rate limits (429)
- Instagram container still processing

### Non-Retryable Errors
- Invalid token (401)
- Missing credentials
- Invalid parameters (400)
- Permission denied (403)

## Monitoring

### Key Logs to Watch
```bash
# All errors
grep ERROR logs/engine.log

# All successes
grep SUCCESS logs/engine.log

# By platform
grep 'publisher:facebook' logs/engine.log
grep 'publisher:instagram' logs/engine.log
grep 'publisher:linkedin' logs/engine.log

# Retries
grep 'retry' logs/engine.log
```

### Success Metrics
- `grep SUCCESS logs/engine.log | wc -l` - Total posts
- `grep 'publisher:facebook.*SUCCESS' logs/engine.log | wc -l` - Facebook posts
- Response time from [INFO] Posting to [SUCCESS] Posted

## Contact & Support

See README.md for:
- Full API documentation
- Platform-specific requirements
- Token acquisition instructions
- Troubleshooting guide
- Production deployment checklist

See ARCHITECTURE.md for:
- Request/response patterns
- Error handling strategy
- Performance characteristics
- Testing strategy

See QUICK_START.md for:
- Quick setup
- Common tasks
- Basic examples
