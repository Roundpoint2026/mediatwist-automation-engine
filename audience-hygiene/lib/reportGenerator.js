/**
 * Report Generator — produces HTML email reports and summary JSON
 * for the GitHub Actions audience hygiene workflow.
 */

const { analyzeAudience } = require('./analyzer');
const { readFollowerCSV, resultsToCSV, batchesToCSV, writeOutput } = require('./csvParser');
const fs = require('fs');
const path = require('path');

/**
 * Generate a complete HTML email report from analysis results.
 */
function generateHTMLReport(analysis, timestamp) {
  const { stats, results, removalQueue, dailyBatches } = analysis;

  const qualityColor = stats.audienceQualityScore >= 70 ? '#22c55e'
    : stats.audienceQualityScore >= 50 ? '#f59e0b' : '#ef4444';
  const qualityLabel = stats.audienceQualityScore >= 70 ? 'Healthy'
    : stats.audienceQualityScore >= 50 ? 'Needs Work' : 'Poor';

  const top10 = results.slice(0, 10).map(r => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #222;font-weight:600;">@${r.username}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #222;text-align:center;">
        <span style="background:${r.riskScore >= 5 ? '#7f1d1d' : r.riskScore >= 3 ? '#78350f' : '#064e3b'};color:${r.riskScore >= 5 ? '#fca5a5' : r.riskScore >= 3 ? '#fbbf24' : '#6ee7b7'};padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700;">${r.riskScore}</span>
      </td>
      <td style="padding:6px 12px;border-bottom:1px solid #222;font-size:12px;color:#888;">${r.riskReasons.join(', ')}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #222;text-align:center;">
        <span style="background:${r.recommendedAction === 'REMOVE' ? '#7f1d1d' : r.recommendedAction === 'REVIEW' ? '#78350f' : '#064e3b'};color:${r.recommendedAction === 'REMOVE' ? '#fca5a5' : r.recommendedAction === 'REVIEW' ? '#fbbf24' : '#6ee7b7'};padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;">${r.recommendedAction}</span>
      </td>
    </tr>`).join('');

  // Load previous report if it exists for comparison
  let delta = null;
  const historyPath = path.join(__dirname, '..', 'data', 'history.json');
  if (fs.existsSync(historyPath)) {
    try {
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      const prev = history[history.length - 1];
      if (prev) {
        delta = {
          qualityDelta: stats.audienceQualityScore - (prev.audienceQualityScore || 0),
          spamDelta: stats.spamCount - (prev.spamCount || 0),
          followerDelta: stats.totalFollowers - (prev.totalFollowers || 0),
        };
      }
    } catch (_) { /* ignore */ }
  }

  const deltaHTML = delta ? `
    <div style="margin-top:12px;padding:12px 16px;background:#1a1a1a;border-radius:8px;font-size:13px;">
      <strong style="color:#FFD600;">vs. Last Week:</strong>&nbsp;&nbsp;
      Quality ${delta.qualityDelta >= 0 ? '↑' : '↓'} ${Math.abs(delta.qualityDelta)}pts &nbsp;|&nbsp;
      Spam ${delta.spamDelta <= 0 ? '↓' : '↑'} ${Math.abs(delta.spamDelta)} &nbsp;|&nbsp;
      Followers ${delta.followerDelta >= 0 ? '↑' : '↓'} ${Math.abs(delta.followerDelta)}
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0A;color:#fff;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="text-align:center;padding:24px 0;border-bottom:2px solid #FFD600;">
      <div style="font-size:28px;font-weight:900;color:#FFD600;text-transform:uppercase;letter-spacing:1px;">Audience Hygiene Report</div>
      <div style="color:#888;font-size:13px;margin-top:4px;">The Mediatwist Group — ${timestamp}</div>
    </div>

    <!-- Quality Score -->
    <div style="text-align:center;padding:32px 0;">
      <div style="font-size:64px;font-weight:900;color:${qualityColor};">${stats.audienceQualityScore}<span style="font-size:24px;">%</span></div>
      <div style="font-size:14px;color:#888;">Audience Quality Score — <strong style="color:${qualityColor};">${qualityLabel}</strong></div>
      ${deltaHTML}
    </div>

    <!-- Stats Grid -->
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px;">
      <div style="flex:1;min-width:140px;background:#2A2A2A;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:800;">${stats.totalFollowers.toLocaleString()}</div>
        <div style="font-size:11px;color:#888;">Followers</div>
      </div>
      <div style="flex:1;min-width:140px;background:#2A2A2A;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:800;">${stats.totalFollowing.toLocaleString()}</div>
        <div style="font-size:11px;color:#888;">Following</div>
      </div>
      <div style="flex:1;min-width:140px;background:#2A2A2A;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:800;">${stats.mutualFollows}</div>
        <div style="font-size:11px;color:#888;">Mutual</div>
      </div>
      <div style="flex:1;min-width:140px;background:#2A2A2A;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#ef4444;">${stats.notFollowingBack}</div>
        <div style="font-size:11px;color:#888;">Not Following Back</div>
      </div>
    </div>

    <!-- Action Breakdown -->
    <div style="background:#2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-weight:700;color:#FFD600;margin-bottom:12px;">Action Breakdown</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div><span style="font-size:22px;font-weight:800;color:#22c55e;">${stats.keepCount}</span> <span style="font-size:12px;color:#888;">KEEP</span></div>
        <div><span style="font-size:22px;font-weight:800;color:#f59e0b;">${stats.reviewCount}</span> <span style="font-size:12px;color:#888;">REVIEW</span></div>
        <div><span style="font-size:22px;font-weight:800;color:#ef4444;">${stats.removeCount}</span> <span style="font-size:12px;color:#888;">REMOVE</span></div>
        <div><span style="font-size:22px;font-weight:800;color:#f59e0b;">${stats.spamCount}</span> <span style="font-size:12px;color:#888;">SPAM</span></div>
        <div><span style="font-size:22px;font-weight:800;color:#f59e0b;">${stats.inactiveCount}</span> <span style="font-size:12px;color:#888;">INACTIVE</span></div>
      </div>
    </div>

    <!-- Cleanup Plan -->
    <div style="background:#2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-weight:700;color:#FFD600;margin-bottom:8px;">Cleanup Plan</div>
      <div style="font-size:14px;color:#ccc;line-height:1.8;">
        ${stats.removeCount} accounts flagged for removal across <strong>${stats.totalDays}</strong> ${stats.totalDays === 1 ? 'day' : 'days'} (50/day safe limit).
        CSVs with full details are attached to this workflow run as artifacts.
      </div>
    </div>

    <!-- Top 10 Risk -->
    <div style="margin-bottom:24px;">
      <div style="font-weight:700;color:#FFD600;margin-bottom:12px;">Top 10 Highest Risk</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #444;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Username</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:#888;text-transform:uppercase;">Risk</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Reasons</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:#888;text-transform:uppercase;">Action</th>
          </tr>
        </thead>
        <tbody>${top10}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0;border-top:1px solid #222;color:#555;font-size:11px;">
      The Mediatwist Group — Audience Hygiene System<br>
      Always manually review before taking any action on Instagram.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Save analysis stats to history for week-over-week tracking.
 */
function saveToHistory(stats, timestamp) {
  const historyPath = path.join(__dirname, '..', 'data', 'history.json');
  let history = [];
  if (fs.existsSync(historyPath)) {
    try { history = JSON.parse(fs.readFileSync(historyPath, 'utf-8')); } catch (_) {}
  }
  history.push({ ...stats, timestamp });
  // Keep last 52 weeks
  if (history.length > 52) history = history.slice(-52);
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
}

/**
 * Run the full automated pipeline.
 * Looks for CSVs in data/, runs analysis, writes all outputs.
 */
function runAutomatedPipeline(options = {}) {
  const baseDir = path.join(__dirname, '..');
  const dataDir = options.dataDir || path.join(baseDir, 'data');
  const outputDir = options.outputDir || path.join(baseDir, 'output');
  const timestamp = new Date().toISOString().slice(0, 10);

  // Find CSV files
  const followersPath = findCSV(dataDir, ['followers.csv', 'followers_1.csv', 'follower_list.csv']);
  const followingPath = findCSV(dataDir, ['following.csv', 'following_list.csv']);

  if (!followersPath) {
    console.error('❌  No followers CSV found in', dataDir);
    console.error('   Expected: followers.csv, followers_1.csv, or follower_list.csv');
    process.exit(1);
  }
  if (!followingPath) {
    console.error('❌  No following CSV found in', dataDir);
    console.error('   Expected: following.csv or following_list.csv');
    process.exit(1);
  }

  console.log(`📂  Followers: ${followersPath}`);
  console.log(`📂  Following: ${followingPath}`);

  // Ingest
  const followers = readFollowerCSV(followersPath);
  const following = readFollowerCSV(followingPath);
  console.log(`✓  ${followers.length} followers, ${following.length} following loaded`);

  // Analyze
  const analysis = analyzeAudience(followers, following);
  const { results, removalQueue, dailyBatches, stats } = analysis;

  // Write CSVs
  fs.mkdirSync(outputDir, { recursive: true });
  writeOutput(path.join(outputDir, `audit_dashboard_${timestamp}.csv`), resultsToCSV(results));
  writeOutput(path.join(outputDir, `removal_queue_${timestamp}.csv`), resultsToCSV(removalQueue));
  writeOutput(path.join(outputDir, `daily_batches_${timestamp}.csv`), batchesToCSV(dailyBatches));
  writeOutput(path.join(outputDir, `full_report_${timestamp}.json`), JSON.stringify({ stats, results, dailyBatches }, null, 2));

  // Write HTML report
  const htmlReport = generateHTMLReport(analysis, timestamp);
  writeOutput(path.join(outputDir, `report_${timestamp}.html`), htmlReport);

  // Save to history
  saveToHistory(stats, timestamp);

  // Write summary for GitHub Actions
  const summary = [
    `## Audience Hygiene Report — ${timestamp}`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Audience Quality Score | **${stats.audienceQualityScore}%** |`,
    `| Total Followers | ${stats.totalFollowers} |`,
    `| Total Following | ${stats.totalFollowing} |`,
    `| Mutual Follows | ${stats.mutualFollows} |`,
    `| Not Following Back | ${stats.notFollowingBack} |`,
    `| KEEP | ${stats.keepCount} |`,
    `| REVIEW | ${stats.reviewCount} |`,
    `| REMOVE | ${stats.removeCount} |`,
    `| Spam Detected | ${stats.spamCount} |`,
    `| Inactive | ${stats.inactiveCount} |`,
    `| Days to Clean Up | ${stats.totalDays} |`,
    '',
    `### Top 5 Highest Risk`,
    '| Username | Risk Score | Action |',
    '|----------|------------|--------|',
    ...results.slice(0, 5).map(r => `| @${r.username} | ${r.riskScore} | ${r.recommendedAction} |`),
  ].join('\n');

  writeOutput(path.join(outputDir, 'SUMMARY.md'), summary);

  console.log(`\n✅  Reports written to ${outputDir}`);
  console.log(`   - audit_dashboard_${timestamp}.csv`);
  console.log(`   - removal_queue_${timestamp}.csv`);
  console.log(`   - daily_batches_${timestamp}.csv`);
  console.log(`   - report_${timestamp}.html`);
  console.log(`   - full_report_${timestamp}.json`);
  console.log(`   - SUMMARY.md (for GitHub Actions)`);

  return { analysis, stats, timestamp };
}

function findCSV(dir, candidates) {
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  // Also check subdirectories (e.g., data/sample/)
  if (fs.existsSync(dir)) {
    const subdirs = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const sub of subdirs) {
      for (const name of candidates) {
        const p = path.join(dir, sub.name, name);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

module.exports = { generateHTMLReport, saveToHistory, runAutomatedPipeline };
