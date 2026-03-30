#!/usr/bin/env node

/**
 * Audience Hygiene — Automated Runner
 *
 * Entry point for GitHub Actions (and manual use).
 * Looks for CSV data in data/, runs analysis, writes reports to output/.
 *
 * Usage:
 *   node audience-hygiene/run.js
 *   node audience-hygiene/run.js --data-dir ./my-data --output-dir ./my-output
 */

const path = require('path');
const { runAutomatedPipeline } = require('./lib/reportGenerator');

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return (idx !== -1 && idx + 1 < args.length) ? args[idx + 1] : null;
}

const dataDir = getArg('--data-dir') || path.join(__dirname, 'data');
const outputDir = getArg('--output-dir') || path.join(__dirname, 'output');

console.log('┌──────────────────────────────────────────────────────┐');
console.log('│   📊  Audience Hygiene — Automated Weekly Run        │');
console.log('└──────────────────────────────────────────────────────┘\n');

try {
  const { stats } = runAutomatedPipeline({ dataDir, outputDir });

  // Set GitHub Actions output if running in CI
  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = require('fs');
    const summaryPath = path.join(outputDir, 'SUMMARY.md');
    if (fs.existsSync(summaryPath)) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, fs.readFileSync(summaryPath, 'utf-8'));
    }
  }

  // Exit with code based on quality
  if (stats.audienceQualityScore < 30) {
    console.log('\n⚠️  Audience quality is critically low. Immediate cleanup recommended.');
  }
  process.exit(0);
} catch (err) {
  console.error('❌  Pipeline failed:', err.message);
  process.exit(1);
}
