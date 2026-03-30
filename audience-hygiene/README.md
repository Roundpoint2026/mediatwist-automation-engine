# Instagram Audience Hygiene System

**The Mediatwist Group** — Internal Tool for Instagram Audience Quality Management

A safe, TOS-compliant system that identifies spam, inactive, and non-reciprocal followers, then generates prioritized cleanup batches for manual execution. No automation, no bots, no API hacking.

---

## Quick Start

### CLI Tool

```bash
cd audience-hygiene

# 1. Generate sample data
node cli.js --sample

# 2. Run analysis on sample data
node cli.js --followers data/sample/followers.csv --following data/sample/following.csv --json

# 3. Review outputs in ./output/
```

### React Dashboard

Open `dashboard.jsx` in Cowork — it renders an interactive dashboard with built-in sample data, or paste your own CSV data.

---

## How to Get Your Instagram Data

### Option A — Official Instagram Data Download (Recommended)

1. Open Instagram → Settings → Your Activity → Download Your Information
2. Select **JSON** format, request download
3. Wait for email (can take up to 48 hours)
4. Extract `followers_1.json` and `following.json`
5. Convert to CSV using:
   ```bash
   # Quick Python one-liner to convert Instagram JSON to CSV:
   python3 -c "
   import json, csv, sys
   data = json.load(open(sys.argv[1]))
   with open(sys.argv[2], 'w', newline='') as f:
       w = csv.writer(f)
       w.writerow(['username'])
       for item in data.get('relationships_followers', data):
           for sd in item.get('string_list_data', []):
               w.writerow([sd['value']])
   " followers_1.json data/followers.csv
   ```

### Option B — Third-Party Export Services

These tools can export richer data (follower counts, post counts, etc.):

- **IGExport** (Chrome extension) — exports follower/following lists as CSV
- **Phantombuster** — scraping automation with CSV output
- **Inflact** — profile analyzer with data export
- **NotJustAnalytics** — free follower analysis with CSV export

> Always check that any third-party tool complies with Instagram's terms of service.

### Expected CSV Format

**Minimum required column:** `username`

**Full format (better analysis accuracy):**

```csv
username,full_name,followers,following,posts,has_profile_pic,bio,is_private,is_verified
sarah.marketing,"Sarah Chen",1240,890,156,true,"Digital Marketing | NYC",false,false
user928374829,"",12,4500,0,false,"",false,false
```

| Column | Required | Description |
|--------|----------|-------------|
| `username` | Yes | Instagram handle (no @) |
| `full_name` | No | Display name |
| `followers` | No | Follower count |
| `following` | No | Following count |
| `posts` | No | Media count |
| `has_profile_pic` | No | true/false |
| `bio` | No | Profile biography text |
| `is_private` | No | true/false |
| `is_verified` | No | true/false (blue check) |

---

## Risk Scoring System

Each account receives a risk score (0–11) based on:

| Signal | Points | Rationale |
|--------|--------|-----------|
| No posts | +2 | Ghost / bot accounts rarely post |
| Following > 1,000 | +2 | Mass-follow behavior |
| Followers < 50 | +2 | Low credibility indicator |
| Random username pattern | +1 | Bot-generated handles |
| No profile picture | +1 | Low-effort account |
| Following/Follower ratio > 20:1 | +2 | Classic spam pattern |
| No bio / very short bio | +1 | Low-effort indicator |

### Classification

| Score | Action | Meaning |
|-------|--------|---------|
| 0–2 | **KEEP** | Likely real, engaged audience |
| 3–4 | **REVIEW** | Manual inspection recommended |
| 5+ | **REMOVE** | High confidence spam/bot |

---

## Output Files

The CLI generates three reports in `./output/`:

| File | Description |
|------|-------------|
| `audit_dashboard_YYYY-MM-DD.csv` | Full account-level detail with scores |
| `removal_queue_YYYY-MM-DD.csv` | Priority-sorted removal candidates |
| `daily_batches_YYYY-MM-DD.csv` | Day 1, Day 2... batches (50/day) |
| `full_report_YYYY-MM-DD.json` | Complete JSON report (with `--json` flag) |

---

## Safety Rules

This tool is designed to **assist human decision-making**, not replace it.

- **No login automation** — never touches your Instagram credentials
- **No API actions** — does not follow, unfollow, or block anyone
- **No headless browsers** — no Puppeteer, Selenium, or similar
- **No password handling** — zero credential storage
- **Rate-limited batches** — 50 accounts/day max in removal queue
- **Manual execution only** — you review every account before acting

---

## Scaling Into an Agency Product

### Phase 1 — Internal Tool (Current)
- CSV-based workflow for Mediatwist accounts
- Manual cleanup with daily batch limits
- React dashboard for visual review

### Phase 2 — Multi-Client Dashboard
- Add client management (multiple IG accounts)
- Persistent database (SQLite → PostgreSQL)
- Login/auth for team members
- Historical tracking: before/after quality scores
- Weekly automated reports via email

### Phase 3 — SaaS Product
- Stripe billing integration
- Instagram Basic Display API for automatic data pull
- Scheduled weekly scans
- White-label option for other agencies
- API endpoints for programmatic access
- Competitive analysis (compare client audience quality)

### Phase 4 — Advanced Analytics
- ML-based spam detection (train on labeled data)
- Engagement correlation scoring
- Follower growth trend analysis
- Audience overlap between accounts
- Industry benchmark comparisons

### Pricing Model Suggestion
| Tier | Accounts | Price | Features |
|------|----------|-------|----------|
| Starter | 1 | $29/mo | Basic analysis, CSV export |
| Agency | 5 | $99/mo | Dashboard, weekly reports, history |
| Enterprise | 25+ | $249/mo | API access, white-label, priority support |

---

## Architecture

```
audience-hygiene/
├── cli.js              # Command-line interface
├── dashboard.jsx       # React interactive dashboard
├── lib/
│   ├── analyzer.js     # Core analysis engine (scoring, classification)
│   └── csvParser.js    # CSV ingestion and export utilities
├── data/
│   └── sample/         # Sample CSV files (generated with --sample)
├── output/             # Analysis results (generated)
└── README.md           # This file
```

All modules are zero-dependency (Node.js built-ins only). The React dashboard is self-contained with inline analysis logic.
