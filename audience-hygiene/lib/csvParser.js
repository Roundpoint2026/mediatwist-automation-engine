/**
 * CSV Parser — handles ingestion and export of CSV data.
 *
 * Zero external dependencies — uses a lightweight built-in parser
 * that handles quoted fields, commas inside quotes, and newlines.
 */

const fs = require('fs');
const path = require('path');
const { normalizeUser } = require('./analyzer');

/**
 * Parse a CSV string into an array of objects.
 * Handles quoted fields and commas within quotes.
 */
function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

/**
 * Read a CSV file and return normalized user objects.
 */
function readFollowerCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(raw);
  return rows.map(normalizeUser);
}

/**
 * Convert analysis results to CSV string.
 */
function resultsToCSV(results) {
  const headers = [
    'username', 'full_name', 'follows_you', 'you_follow',
    'followers', 'following', 'posts', 'has_profile_pic',
    'is_verified', 'risk_score', 'risk_reasons', 'inactive',
    'tag', 'recommended_action'
  ];

  const lines = [headers.join(',')];
  for (const r of results) {
    lines.push([
      r.username,
      `"${(r.fullName || '').replace(/"/g, '""')}"`,
      r.followsYou ? 'yes' : 'no',
      r.youFollow ? 'yes' : 'no',
      r.followers,
      r.following,
      r.posts,
      r.hasProfilePic ? 'yes' : 'no',
      r.isVerified ? 'yes' : 'no',
      r.riskScore,
      `"${r.riskReasons.join('; ')}"`,
      r.inactive ? 'yes' : 'no',
      r.tag,
      r.recommendedAction,
    ].join(','));
  }
  return lines.join('\n');
}

/**
 * Convert daily batches to CSV string.
 */
function batchesToCSV(dailyBatches) {
  const headers = ['day', 'username', 'risk_score', 'risk_reasons', 'follows_you'];
  const lines = [headers.join(',')];

  for (const batch of dailyBatches) {
    for (const account of batch.accounts) {
      lines.push([
        `Day ${batch.day}`,
        account.username,
        account.riskScore,
        `"${account.riskReasons.join('; ')}"`,
        account.followsYou ? 'yes' : 'no',
      ].join(','));
    }
  }
  return lines.join('\n');
}

/**
 * Write string to file, creating directories as needed.
 */
function writeOutput(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

module.exports = {
  parseCSV,
  readFollowerCSV,
  resultsToCSV,
  batchesToCSV,
  writeOutput,
};
