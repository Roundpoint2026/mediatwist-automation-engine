#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# runNow.sh — Run the Mediatwist Engine on demand
#
# Usage:
#   bash scripts/runNow.sh              # Full run (generates + publishes)
#   bash scripts/runNow.sh --dry-run    # Generate only, don't publish
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR" || { echo "ERROR: Can't find project directory"; exit 1; }

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Mediatwist Automation Engine — Manual Run"
echo "  $(date '+%A, %B %d %Y at %I:%M %p %Z')"
echo "══════════════════════════════════════════════════════════"
echo ""

# Check for dry-run flag
if [ "$1" = "--dry-run" ]; then
  echo "  MODE: Dry run (no publishing)"
else
  echo "  MODE: LIVE (will publish to all platforms)"
fi
echo ""

# Make sure node is available
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Make sure it's installed."
  exit 1
fi

echo "  Node: $(node --version)"
echo ""

# Run the engine with live output (not captured like the cron wrapper)
node scripts/renderAndPublish.js "$@"
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "══════════════════════════════════════════════════════════"
  echo "  Done! Check above for results."
  echo "══════════════════════════════════════════════════════════"
else
  echo "══════════════════════════════════════════════════════════"
  echo "  Engine exited with error code $EXIT_CODE"
  echo "══════════════════════════════════════════════════════════"
fi

exit $EXIT_CODE
