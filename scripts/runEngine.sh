#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# runEngine.sh — Cron wrapper for Mediatwist Automation Engine
#
# This script is called by cron twice daily (9 AM + 8 PM EST).
# It runs renderAndPublish.js, captures output, detects failures,
# and triggers alerts via notify.sh if anything goes wrong.
#
# Usage (manual):
#   ./scripts/runEngine.sh
#   ./scripts/runEngine.sh --dry-run
# ─────────────────────────────────────────────────────────────────────────────

# ── Paths ────────────────────────────────────────────────────────────────────
PROJECT_DIR="/Users/chriskurtz/mediatwist-automation-engine/mediatwist-automation-engine"
SCRIPT_DIR="$PROJECT_DIR/scripts"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/engine.log"
CRON_LOG="$LOG_DIR/cron.log"
NOTIFY="$SCRIPT_DIR/notify.sh"

# ── Ensure log directory exists ──────────────────────────────────────────────
mkdir -p "$LOG_DIR"

# ── Timestamp ────────────────────────────────────────────────────────────────
echo "" >> "$CRON_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$CRON_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] Engine run starting..." >> "$CRON_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$CRON_LOG"

# ── Set up environment for cron (cron has minimal PATH) ──────────────────────
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

# Load nvm if it exists (needed for correct Node.js version)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# Navigate to project
cd "$PROJECT_DIR" || {
  echo "[$(date)] FATAL: Cannot cd to $PROJECT_DIR" >> "$CRON_LOG"
  bash "$NOTIFY" "Cannot find project directory: $PROJECT_DIR" "$CRON_LOG"
  exit 1
}

# ── Verify node is available ─────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[$(date)] FATAL: node not found in PATH" >> "$CRON_LOG"
  bash "$NOTIFY" "Node.js not found — check PATH in runEngine.sh" "$CRON_LOG"
  exit 1
fi

NODE_VERSION=$(node --version)
echo "[$(date)] Node: $NODE_VERSION" >> "$CRON_LOG"

# ── Pass through any flags (e.g. --dry-run) ──────────────────────────────────
EXTRA_FLAGS="$@"

# ── Run the engine ───────────────────────────────────────────────────────────
echo "[$(date)] Running: node scripts/renderAndPublish.js $EXTRA_FLAGS" >> "$CRON_LOG"

# Capture both stdout and stderr, with a 10-minute timeout
TIMEOUT_SECONDS=600
OUTPUT=$(timeout $TIMEOUT_SECONDS node scripts/renderAndPublish.js $EXTRA_FLAGS 2>&1)
EXIT_CODE=$?

# Log full output
echo "$OUTPUT" >> "$CRON_LOG"

# ── Check for timeout ────────────────────────────────────────────────────────
if [ $EXIT_CODE -eq 124 ]; then
  echo "[$(date)] TIMEOUT: Engine exceeded ${TIMEOUT_SECONDS}s limit" >> "$CRON_LOG"
  bash "$NOTIFY" "Engine TIMED OUT after ${TIMEOUT_SECONDS}s — may be stuck on Remotion render" "$CRON_LOG"
  exit 1
fi

# ── Check exit code ──────────────────────────────────────────────────────────
if [ $EXIT_CODE -ne 0 ]; then
  echo "[$(date)] FAILED: Exit code $EXIT_CODE" >> "$CRON_LOG"
  # Extract the most useful error line
  ERROR_LINE=$(echo "$OUTPUT" | grep -E '(❌|FAILED|Fatal|Error|error)' | tail -1)
  bash "$NOTIFY" "Engine crashed (exit $EXIT_CODE): ${ERROR_LINE:-unknown error}" "$CRON_LOG"
  exit 1
fi

# ── Check output for platform failures ───────────────────────────────────────
FAILURES=$(echo "$OUTPUT" | grep -c '❌')
SUCCESSES=$(echo "$OUTPUT" | grep -c '✅')

if [ "$FAILURES" -gt 0 ]; then
  FAIL_DETAILS=$(echo "$OUTPUT" | grep '❌' | head -3)
  echo "[$(date)] PARTIAL FAILURE: $FAILURES platform(s) failed" >> "$CRON_LOG"
  bash "$NOTIFY" "$FAILURES platform(s) failed: $FAIL_DETAILS" "$CRON_LOG"
  # Don't exit 1 — some platforms succeeded
fi

# ── Success ──────────────────────────────────────────────────────────────────
echo "[$(date)] COMPLETE: $SUCCESSES platform(s) published, $FAILURES failed" >> "$CRON_LOG"
echo "" >> "$CRON_LOG"

# Optional: macOS success notification (comment out if too noisy)
if [ "$FAILURES" -eq 0 ] && [ "$SUCCESSES" -gt 0 ]; then
  osascript -e "display notification \"$SUCCESSES platform(s) published successfully\" with title \"Mediatwist Engine\" subtitle \"$(date '+%I:%M %p')\" sound name \"Glass\"" 2>/dev/null
fi

exit 0
