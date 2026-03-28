# Publishers Module Architecture

## Module Dependency Graph

```
index.js (orchestrator)
├── facebook.js
│   ├── retry.js
│   └── logger.js
├── instagram.js
│   ├── retry.js
│   └── logger.js
├── linkedin.js
│   ├── retry.js
│   └── logger.js
├── cloudinary.js
│   ├── retry.js
│   └── logger.js
└── config/engine.js
```

## Data Flow

### Publishing Flow

```
publishToAll()
  ├─→ [validate inputs]
  ├─→ [determine media type]
  ├─→ [truncate captions per platform]
  └─→ [parallel execution]
       ├─→ postToFacebook()
       │    └─→ withRetry() → logger
       ├─→ postToInstagram()
       │    ├─→ [detect media type]
       │    ├─→ [create container]
       │    ├─→ [poll status]
       │    ├─→ [publish]
       │    └─→ withRetry() → logger
       └─→ postToLinkedIn()
            ├─→ [fetch member ID or use org]
            ├─→ [register asset]
            ├─→ [download binary]
            ├─→ [upload binary]
            ├─→ [create post]
            └─→ withRetry() → logger
```

### Retry Flow

```
withRetry(fn, options)
  ├─→ Attempt 1
  │    ├─→ Success? → return result
  │    └─→ Fail? → logger.warn() → wait(delayMs)
  ├─→ Attempt 2
  │    ├─→ Success? → return result
  │    └─→ Fail? → logger.warn() → wait(delayMs * 2)
  └─→ Attempt 3
       ├─→ Success? → return result
       └─→ Fail? → throw error
```

### Logging Flow

```
logger methods (info, warn, error, success)
  ├─→ formatLog(level, module, message)
  ├─→ console.log/warn/error(formatted)
  └─→ fs.appendFileSync(logs/engine.log)
```

## Request/Response Patterns

### Facebook (Graph API v20.0)

**Image Post:**
```
POST /v20.0/{PAGE_ID}/photos
├─ url: string (publicly accessible)
├─ caption: string
├─ access_token: string
└─ published: boolean

Response: { id, post_id }
```

**Video Post:**
```
POST /v20.0/{PAGE_ID}/videos
├─ file_url: string
├─ description: string
├─ access_token: string
└─ published: boolean

Response: { id, post_id }
```

### Instagram (Graph API v19.0)

**Create Container:**
```
POST /v19.0/{IG_ACCOUNT_ID}/media
├─ image_url: string (for IMAGE)
├─ video_url: string (for VIDEO)
├─ media_type: 'IMAGE' | 'VIDEO'
├─ caption: string
└─ access_token: string

Response: { id }
```

**Poll Status:**
```
GET /v19.0/{CONTAINER_ID}?fields=status

Response: { status: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' }
```

**Publish Container:**
```
POST /v19.0/{IG_ACCOUNT_ID}/media_publish
├─ creation_id: string
└─ access_token: string

Response: { id }
```

### LinkedIn (REST API v2)

**Get Member ID:**
```
GET /v2/me
Header: Authorization: Bearer {token}

Response: { id: '123456789' }
```

**Register Upload:**
```
POST /v2/assets?action=registerUpload
Header: Authorization: Bearer {token}
Body: {
  registerUploadRequest: {
    recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
    owner: 'urn:li:person:{id}' | 'urn:li:organization:{id}',
    serviceRelationships: [...]
  }
}

Response: {
  value: {
    asset: 'urn:li:digitalmedia:...',
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: 'https://...'
      }
    }
  }
}
```

**Upload Binary:**
```
PUT {uploadUrl}
Header: Authorization: Bearer {token}
Header: Content-Type: application/octet-stream
Body: <binary image data>

Response: 201 Created
```

**Create Post:**
```
POST /v2/ugcPosts
Header: Authorization: Bearer {token}
Body: {
  author: 'urn:li:person:{id}' | 'urn:li:organization:{id}',
  lifecycleState: 'PUBLISHED',
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: { text: 'caption' },
      shareMediaCategory: 'IMAGE',
      media: [{ status: 'READY', media: 'urn:li:digitalmedia:...' }]
    }
  },
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
  }
}

Response: 201 Created
{ id: 'urn:li:share:...' }
```

### Cloudinary (Upload API)

```
POST https://api.cloudinary.com/v1_1/{cloud_name}/upload
Body: FormData
├─ file: binary or url
├─ resource_type: 'image' | 'video' | 'auto'
├─ folder: string
├─ public_id: string (optional)
└─ api_key, api_secret

Response: {
  secure_url: 'https://res.cloudinary.com/...',
  public_id: 'folder/name',
  resource_type: 'image' | 'video'
}
```

## Error Handling Strategy

### Categorization

| Error Type | Handler | Retry | Log |
|-----------|---------|-------|-----|
| Network timeout | withRetry | Yes (3x) | WARN |
| Server 5xx | withRetry | Yes (3x) | WARN |
| Invalid token (401) | Fail + skip platform | No | ERROR |
| Missing credentials | Skip platform | No | WARN |
| Invalid parameters (400) | Fail + return error | No | ERROR |
| Rate limit (429) | withRetry | Yes (3x) | WARN |
| Container status ERROR | Fail | No | ERROR |

### Recovery Strategies

1. **Transient errors (4xx, 5xx, timeouts):** Retry with exponential backoff
2. **Missing credentials:** Skip platform, continue with others
3. **Invalid input:** Return error to caller, don't retry
4. **API validation failures:** Return error with details

## Performance Characteristics

### Sequential vs. Parallel

**publishToAll():** Parallel execution of all platforms
- **Best case:** 1-2 seconds (all platforms fast)
- **Average case:** 5-10 seconds (includes retries)
- **Worst case:** 30+ seconds (3 retries × 3 platforms with backoff)

**Individual publishers:** Sequential operations within platform
- Facebook: 1-2 seconds
- Instagram: 3-5 seconds (includes container polling)
- LinkedIn: 5-10 seconds (includes binary download/upload)
- Cloudinary: 2-5 seconds (includes file upload)

### Polling

**Instagram container status:** Poll up to 10 times, 500ms apart
- Total wait: up to 5 seconds
- Adaptive: stops immediately on FINISHED

**LinkedIn download:** Single request, no polling
- Download size matters (image 100KB-5MB typical)

## Configuration Sources

1. **Environment Variables (.env)** - API credentials, secrets
2. **config/engine.js** - Default settings, limits, behavior
3. **Function options** - Per-call overrides

Precedence: Function options > .env > config/engine.js defaults

## Extensibility Points

### Adding a New Platform

1. Create `publishers/{platform}.js`
   - Export `post{Platform}(mediaUrl, caption, options)`
   - Use `withRetry()` for reliability
   - Use `createLogger()` for structured logging
   - Handle missing credentials gracefully

2. Update `publishers/index.js`
   - Add to imports
   - Add entry to `publishers` object
   - Define `shouldSkip()` logic
   - Define `publish()` function

3. Update `config/engine.js`
   - Add caption length limit
   - Add platform to enabled list

4. Update `.env.example`
   - Document required credentials

### Adding a New Retry Strategy

Modify `publishers/retry.js`:
- Add new backoff strategy (e.g., 'jittered')
- Export `withRetry()` unchanged
- Update existing calls to use new strategy if needed

### Custom Logging

Modify `publishers/logger.js`:
- Add new log levels (e.g., DEBUG)
- Change log format
- Add log rotation
- Send to external service (e.g., Sentry)

## Testing Strategy

### Unit Tests (per file)

- `retry.js`: Test backoff calculations, retries, timing
- `logger.js`: Test log formatting, file writes
- `facebook.js`: Test request formatting, error handling
- `instagram.js`: Test media type detection, polling logic
- `linkedin.js`: Test member ID fetch, binary upload
- `cloudinary.js`: Test resource type detection, folder path

### Integration Tests

- `publishToAll()`: Test parallel execution, results aggregation
- Multi-platform posting with mixed success/failure
- Test mode validation
- Credential fallback behavior

### Regression Tests

- Old Facebook tokens still work
- Instagram container polling doesn't timeout
- LinkedIn binary upload completes
- Cloudinary URL returns valid asset

## Monitoring & Observability

### Key Metrics

- Requests per platform per day
- Success rate per platform
- Avg. response time per platform
- Retry count (indicator of reliability)
- Error rate by error type

### Log Queries

```bash
# Success rate
grep SUCCESS logs/engine.log | wc -l

# Errors
grep ERROR logs/engine.log

# By platform
grep '\[publisher:facebook\]' logs/engine.log

# Retries
grep 'retry' logs/engine.log

# Response times (estimate from timestamps)
grep 'Posting\|Published' logs/engine.log
```

### Alerting Rules

- Any ERROR level in logs
- 3+ consecutive retries for same platform
- >2 minute response time for publishToAll()
- 0% success rate for 24+ hours
