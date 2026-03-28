#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# installCron.sh — Install/update cron jobs for Mediatwist Engine
#
# Schedules the engine to run twice daily:
#   • 9:00 AM EST  (14:00 UTC during EDT / 14:00 UTC during EST)
#   • 8:00 PM EST  (01:00 UTC next day during EDT / 01:00 UTC during EST)
#
# macOS cron uses the system timezone, so we use America/New_York directly.
#
# Usage:
#   ./scripts/installCron.sh           # Install cron jobs
#   ./scripts/installCron.sh --remove  # Remove cron jobs
#   ./scripts/installCron.sh --status  # Check current cron jobs
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_DIR="/Users/chriskurtz/mediatwist-automation-engine/mediatwist-automation-engine"
RUNNER="$PROJECT_DIR/scripts/runEngine.sh"
CRON_TAG="# mediatwist-engine"

# ── Make scripts executable ──────────────────────────────────────────────────
chmod +x "$PROJECT_DIR/scripts/runEngine.sh" 2>/dev/null
chmod +x "$PROJECT_DIR/scripts/notify.sh" 2>/dev/null

# ── Handle flags ─────────────────────────────────────────────────────────────
if [ "$1" = "--remove" ]; then
  echo "Removing Mediatwist cron jobs..."
  crontab -l 2>/dev/null | grep -v "$CRON_TAG" | crontab -
  echo "✅ Cron jobs removed."
  echo "Current crontab:"
  crontab -l 2>/dev/null || echo "(empty)"
  exit 0
fi

if [ "$1" = "--status" ]; then
  echo "Current Mediatwist cron jobs:"
  crontab -l 2>/dev/null | grep -A1 "mediatwist" || echo "No Mediatwist cron jobs found."
  echo ""
  echo "All cron jobs:"
  crontab -l 2>/dev/null || echo "(empty crontab)"
  exit 0
fi

# ── Detect timezone ──────────────────────────────────────────────────────────
CURRENT_TZ=$(readlink /etc/localtime 2>/dev/null | sed 's|.*/zoneinfo/||')
echo "System timezone: ${CURRENT_TZ:-unknown}"

# We need cron times in the LOCAL timezone of this Mac.
# If the Mac is set to America/New_York (ET), we use 9:00 and 20:00 directly.
# If it's in a different timezone, we calculate the offset.

# For simplicity and reliability, we use the TZ environment variable in cron
# to force Eastern Time interpretation regardless of system timezone.

# ── Build cron entries ───────────────────────────────────────────────────────
CRON_9AM="0 9 * * * TZ=America/New_York bash $RUNNER $CRON_TAG-9am"
CRON_8PM="0 20 * * * TZ=America/New_York bash $RUNNER $CRON_TAG-8pm"

# ── Install ──────────────────────────────────────────────────────────────────
echo ""
echo "Installing Mediatwist Engine cron jobs..."
echo "  → 9:00 AM Eastern — daily"
echo "  → 8:00 PM Eastern — daily"
echo ""

# Remove any existing mediatwist entries, then append new ones
EXISTING=$(crontab -l 2>/dev/null | grep -v "$CRON_TAG" || true)

NEW_CRONTAB="$EXISTING
# ── Mediatwist Automation Engine ──────────────────────
$CRON_9AM
$CRON_8PM
"

# Write it (trim leading blank lines)
echo "$NEW_CRONTAB" | sed '/^$/N;/^\n$/d' | crontab -

echo "✅ Cron jobs installed!"
echo ""
echo "Verify with:"
echo "  crontab -l"
echo ""
echo "Current crontab:"
crontab -l
echo ""
echo "─────────────────────────────────────────────────────────"
echo "IMPORTANT: macOS may ask for 'cron' to have Full Disk Access."
echo "If posts don't run, go to:"
echo "  System Settings → Privacy & Security → Full Disk Access"
echo "  Add: /usr/sbin/cron"
echo "─────────────────────────────────────────────────────────"
