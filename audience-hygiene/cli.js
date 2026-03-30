#!/usr/bin/env node

/**
 * Instagram Audience Hygiene CLI
 *
 * Usage:
 *   node cli.js --followers data/followers.csv --following data/following.csv
 *   node cli.js --followers data/followers.csv --following data/following.csv --output output/
 *   node cli.js --sample                         # Generate sample CSVs
 *   node cli.js --help
 */

const fs = require('fs');
const path = require('path');
const { analyzeAudience } = require('./lib/analyzer');
const { readFollowerCSV, resultsToCSV, batchesToCSV, writeOutput } = require('./lib/csvParser');

// ─── Argument Parsing ────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const hasFlag = (flag) => args.includes(flag);

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
  ┌──────────────────────────────────────────────────────┐
  │   📊  Instagram Audience Hygiene Tool — Mediatwist   │
  └──────────────────────────────────────────────────────┘

  USAGE:
    node cli.js --followers <path> --following <path> [options]

  OPTIONS:
    --followers <path>    Path to followers CSV
    --following <path>    Path to following CSV
    --output <dir>        Output directory (default: ./output)
    --batch-size <n>      Accounts per daily batch (default: 50)
    --sample              Generate sample CSV files in data/sample/
    --json                Also output JSON reports
    --help                Show this help

  EXAMPLES:
    node cli.js --sample
    node cli.js --followers data/followers.csv --following data/following.csv
    node cli.js --followers data/followers.csv --following data/following.csv --json
  `);
  process.exit(0);
}

if (hasFlag('--sample')) {
  generateSampleData();
  process.exit(0);
}

// ─── Main ────────────────────────────────────────────────────────

const followersPath = getArg('--followers');
const followingPath = getArg('--following');
const outputDir = getArg('--output') || path.join(__dirname, 'output');
const outputJSON = hasFlag('--json');

if (!followersPath || !followingPath) {
  console.error('❌  Missing required arguments. Use --help for usage.');
  process.exit(1);
}

if (!fs.existsSync(followersPath)) {
  console.error(`❌  Followers file not found: ${followersPath}`);
  process.exit(1);
}
if (!fs.existsSync(followingPath)) {
  console.error(`❌  Following file not found: ${followingPath}`);
  process.exit(1);
}

console.log('\n┌──────────────────────────────────────────────────────┐');
console.log('│   📊  Instagram Audience Hygiene — Analysis Engine   │');
console.log('└──────────────────────────────────────────────────────┘\n');

// 1. Ingest
console.log('⏳  Reading CSV files...');
const followers = readFollowerCSV(path.resolve(followersPath));
const following = readFollowerCSV(path.resolve(followingPath));
console.log(`   ✓ ${followers.length} followers loaded`);
console.log(`   ✓ ${following.length} following loaded\n`);

// 2. Analyze
console.log('⏳  Running analysis...');
const analysis = analyzeAudience(followers, following);
const { results, removalQueue, dailyBatches, stats } = analysis;

// 3. Print Summary
console.log('\n┌──────────────── SUMMARY ─────────────────┐');
console.log(`│  Total accounts analyzed:  ${String(stats.totalAccounts).padStart(6)}`);
console.log(`│  Your followers:           ${String(stats.totalFollowers).padStart(6)}`);
console.log(`│  You follow:               ${String(stats.totalFollowing).padStart(6)}`);
console.log(`│  Mutual follows:           ${String(stats.mutualFollows).padStart(6)}`);
console.log(`│  Not following you back:    ${String(stats.notFollowingBack).padStart(6)}`);
console.log(`│  You don't follow back:     ${String(stats.dontFollowBack).padStart(6)}`);
console.log('├──────────────────────────────────────────┤');
console.log(`│  🟢 KEEP:                  ${String(stats.keepCount).padStart(6)}`);
console.log(`│  🟡 REVIEW:                ${String(stats.reviewCount).padStart(6)}`);
console.log(`│  🔴 REMOVE:                ${String(stats.removeCount).padStart(6)}`);
console.log('├──────────────────────────────────────────┤');
console.log(`│  🤖 Suspected spam:        ${String(stats.spamCount).padStart(6)}`);
console.log(`│  💤 Inactive:              ${String(stats.inactiveCount).padStart(6)}`);
console.log(`│  ⭐ Audience Quality Score: ${String(stats.audienceQualityScore).padStart(5)}%`);
console.log(`│  📅 Days to clean up:      ${String(stats.totalDays).padStart(6)}`);
console.log('└──────────────────────────────────────────┘\n');

// 4. Export
console.log('⏳  Writing output files...');
fs.mkdirSync(outputDir, { recursive: true });

const timestamp = new Date().toISOString().slice(0, 10);

// Full dashboard CSV
const dashboardPath = path.join(outputDir, `audit_dashboard_${timestamp}.csv`);
writeOutput(dashboardPath, resultsToCSV(results));
console.log(`   ✓ Dashboard:       ${dashboardPath}`);

// Removal queue CSV
const removalPath = path.join(outputDir, `removal_queue_${timestamp}.csv`);
writeOutput(removalPath, resultsToCSV(removalQueue));
console.log(`   ✓ Removal queue:   ${removalPath}`);

// Daily batches CSV
const batchPath = path.join(outputDir, `daily_batches_${timestamp}.csv`);
writeOutput(batchPath, batchesToCSV(dailyBatches));
console.log(`   ✓ Daily batches:   ${batchPath}`);

// JSON output (optional)
if (outputJSON) {
  const jsonPath = path.join(outputDir, `full_report_${timestamp}.json`);
  writeOutput(jsonPath, JSON.stringify({ stats, results, dailyBatches }, null, 2));
  console.log(`   ✓ JSON report:     ${jsonPath}`);
}

// Top 10 highest risk
console.log('\n┌──────────── TOP 10 HIGHEST RISK ──────────┐');
console.log('│  Username              Score  Action       │');
console.log('├────────────────────────────────────────────┤');
results.slice(0, 10).forEach(r => {
  const user = r.username.padEnd(22).slice(0, 22);
  const score = String(r.riskScore).padStart(3);
  const action = r.recommendedAction.padEnd(8);
  console.log(`│  ${user} ${score}   ${action}      │`);
});
console.log('└────────────────────────────────────────────┘');

console.log('\n✅  Analysis complete. Review outputs in:', outputDir);
console.log('⚠️   Always manually review before taking any action on Instagram.\n');

// ─── Sample Data Generator ───────────────────────────────────────

function generateSampleData() {
  const sampleDir = path.join(__dirname, 'data', 'sample');
  fs.mkdirSync(sampleDir, { recursive: true });

  const headers = 'username,full_name,followers,following,posts,has_profile_pic,bio,is_private,is_verified\n';

  // Generate followers
  const followerRows = [];
  const followingRows = [];

  // Real-looking accounts (followers)
  const realNames = [
    { u: 'sarah.marketing', n: 'Sarah Chen', flw: 1240, flg: 890, p: 156, pic: true, bio: 'Digital Marketing | NYC', v: false },
    { u: 'jakedesigns', n: 'Jake Rivera', flw: 3400, flg: 1100, p: 234, pic: true, bio: 'UI/UX Designer', v: false },
    { u: 'ceo_mindset', n: 'Alex Thompson', flw: 8900, flg: 2100, p: 412, pic: true, bio: 'CEO | Speaker | Author', v: true },
    { u: 'brand.builder.co', n: 'BrandBuilder Co', flw: 5600, flg: 3200, p: 890, pic: true, bio: 'We build brands that last', v: false },
    { u: 'emma.writes', n: 'Emma Collins', flw: 780, flg: 430, p: 89, pic: true, bio: 'Content writer & coffee lover', v: false },
    { u: 'digitaldan', n: 'Dan Marks', flw: 2100, flg: 1500, p: 312, pic: true, bio: 'Growth hacker', v: false },
    { u: 'thefoodnetworkchef', n: 'Maria Lopez', flw: 45000, flg: 800, p: 1200, pic: true, bio: 'Chef | Cookbook Author', v: true },
    { u: 'startup.daily', n: 'Startup Daily', flw: 12000, flg: 900, p: 2300, pic: true, bio: 'Your daily dose of startup news', v: false },
    { u: 'kate.social', n: 'Kate Brown', flw: 670, flg: 380, p: 67, pic: true, bio: 'Social media manager', v: false },
    { u: 'techreviewer_mike', n: 'Mike Walsh', flw: 9800, flg: 1200, p: 567, pic: true, bio: 'Tech reviews & more', v: false },
  ];

  // Suspicious/spam accounts (followers)
  const spamAccounts = [
    { u: 'user928374829', n: '', flw: 12, flg: 4500, p: 0, pic: false, bio: '', v: false },
    { u: 'follow4follow_2024', n: 'Follow Me', flw: 34, flg: 7500, p: 1, pic: false, bio: '', v: false },
    { u: 'maria.92847', n: 'Maria', flw: 8, flg: 3200, p: 0, pic: false, bio: '', v: false },
    { u: 'get_rich_now_99', n: 'Money Guru', flw: 45, flg: 6000, p: 3, pic: true, bio: 'DM me for $$$', v: false },
    { u: 'beauty_deals_4u', n: '', flw: 23, flg: 5100, p: 0, pic: false, bio: '', v: false },
    { u: 'xxyyzz12345', n: '', flw: 5, flg: 2800, p: 0, pic: false, bio: '', v: false },
    { u: 'free.followers.now', n: 'Free Followers', flw: 67, flg: 7800, p: 2, pic: false, bio: 'Get 10k followers FREE', v: false },
    { u: 'bot.account.38291', n: '', flw: 0, flg: 4200, p: 0, pic: false, bio: '', v: false },
  ];

  // Inactive accounts (followers)
  const inactiveAccounts = [
    { u: 'old.account.2019', n: 'Tom', flw: 120, flg: 340, p: 0, pic: true, bio: '', v: false },
    { u: 'jenny_old', n: 'Jennifer', flw: 89, flg: 1200, p: 0, pic: true, bio: 'hey', v: false },
    { u: 'mark.abandoned', n: 'Mark', flw: 45, flg: 1800, p: 2, pic: false, bio: '', v: false },
    { u: 'ghostaccount.99', n: '', flw: 12, flg: 900, p: 0, pic: false, bio: '', v: false },
    { u: 'unused_profile', n: 'Alex', flw: 67, flg: 1100, p: 0, pic: true, bio: 'hi', v: false },
  ];

  // Accounts you follow but don't follow you back
  const notFollowingBack = [
    { u: 'garyvee', n: 'Gary Vaynerchuk', flw: 9800000, flg: 2100, p: 12000, pic: true, bio: 'CEO of VaynerMedia', v: true },
    { u: 'hubspot', n: 'HubSpot', flw: 560000, flg: 890, p: 5600, pic: true, bio: 'Grow better.', v: true },
    { u: 'neilpatel', n: 'Neil Patel', flw: 420000, flg: 1200, p: 3400, pic: true, bio: 'Helping you succeed online', v: true },
    { u: 'buffer', n: 'Buffer', flw: 340000, flg: 670, p: 4500, pic: true, bio: 'Social media management', v: true },
    { u: 'dormant.agency', n: 'Dead Agency', flw: 230, flg: 890, p: 12, pic: true, bio: 'We do things', v: false },
  ];

  // Spam accounts you follow that DON'T follow back (triggers REMOVE)
  const spamNotFollowingBack = [
    { u: 'spam_king_99887', n: '', flw: 3, flg: 8200, p: 0, pic: false, bio: '', v: false },
    { u: 'buy.likes.cheap', n: 'Buy Likes', flw: 18, flg: 5500, p: 0, pic: false, bio: '', v: false },
    { u: 'insta.growth.42918', n: '', flw: 7, flg: 6100, p: 0, pic: false, bio: '', v: false },
    { u: 'make_money_fast_1', n: 'Money', flw: 22, flg: 4800, p: 1, pic: false, bio: 'DM for $$', v: false },
    { u: 'follow.train.2025', n: '', flw: 41, flg: 7900, p: 0, pic: false, bio: '', v: false },
  ];

  // Build followers CSV (real + spam + inactive)
  const allFollowers = [...realNames, ...spamAccounts, ...inactiveAccounts];
  allFollowers.forEach(a => {
    followerRows.push(`${a.u},"${a.n}",${a.flw},${a.flg},${a.p},${a.pic},"${a.bio}",false,${a.v}`);
  });

  // Build following CSV (real + notFollowingBack + spamNotFollowingBack + some overlap)
  const allFollowing = [...realNames.slice(0, 7), ...notFollowingBack, ...spamNotFollowingBack, ...spamAccounts.slice(0, 3)];
  allFollowing.forEach(a => {
    followingRows.push(`${a.u},"${a.n}",${a.flw},${a.flg},${a.p},${a.pic},"${a.bio}",false,${a.v}`);
  });

  writeOutput(
    path.join(sampleDir, 'followers.csv'),
    headers + followerRows.join('\n')
  );
  writeOutput(
    path.join(sampleDir, 'following.csv'),
    headers + followingRows.join('\n')
  );

  console.log(`\n✅  Sample CSVs generated in: ${sampleDir}`);
  console.log('   - followers.csv  (23 sample followers)');
  console.log('   - following.csv  (15 sample following)');
  console.log('\nRun analysis with:');
  console.log(`   node cli.js --followers ${path.join(sampleDir, 'followers.csv')} --following ${path.join(sampleDir, 'following.csv')} --json\n`);
}
