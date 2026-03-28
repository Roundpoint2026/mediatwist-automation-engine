#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# notify.sh — Mediatwist Automation Engine Failure Alerter
#
# Sends macOS desktop notification AND email when the engine fails.
# Called automatically by the cron wrapper (runEngine.sh).
#
# Usage:
#   ./scripts/notify.sh "Engine crashed: Remotion render failed"
#   ./scripts/notify.sh "LinkedIn publish failed" /path/to/engine.log
# ─────────────────────────────────────────────────────────────────────────────

ALERT_EMAIL="chris@atriummedia.com"
SUBJECT_PREFIX="[Mediatwist Engine ALERT]"
MESSAGE="${1:-Engine failure detected}"
LOG_FILE="${2:-}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')

# ── macOS Desktop Notification ───────────────────────────────────────────────
osascript -e "display notification \"$MESSAGE\" with title \"Mediatwist Engine Failed\" subtitle \"$TIMESTAMP\" sound name \"Basso\"" 2>/dev/null

# ── Email via macOS built-in mail (uses your configured Mail.app account) ────
# Build the email body
EMAIL_BODY="MEDIATWIST AUTOMATION ENGINE — FAILURE ALERT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Time:    $TIMESTAMP
Host:    $(hostname)
Error:   $MESSAGE
"

# Attach last 50 lines of log if available
if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
  EMAIL_BODY="$EMAIL_BODY
─── Last 50 lines of engine log ───
$(tail -50 "$LOG_FILE")
"
fi

EMAIL_BODY="$EMAIL_BODY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Check your Mac or SSH in to investigate.
Project: ~/mediatwist-automation-engine/mediatwist-automation-engine/
"

# Try multiple mail methods (first available wins)

# Method 1: macOS `mail` command (works if postfix is configured)
if command -v mail &>/dev/null; then
  echo "$EMAIL_BODY" | mail -s "$SUBJECT_PREFIX $MESSAGE" "$ALERT_EMAIL" 2>/dev/null && {
    echo "[notify] Email sent via mail command to $ALERT_EMAIL"
    exit 0
  }
fi

# Method 2: Python (always available on macOS) using smtplib via Gmail SMTP
# This requires an App Password if using Gmail — see setup instructions
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SMTP_CONFIG="$SCRIPT_DIR/../.smtp-config"

if [ -f "$SMTP_CONFIG" ]; then
  source "$SMTP_CONFIG"
  python3 -c "
import smtplib
from email.mime.text import MIMEText
import os

msg = MIMEText('''$EMAIL_BODY''')
msg['Subject'] = '$SUBJECT_PREFIX $MESSAGE'
msg['From'] = os.environ.get('SMTP_FROM', '$ALERT_EMAIL')
msg['To'] = '$ALERT_EMAIL'

try:
    server = smtplib.SMTP(os.environ.get('SMTP_HOST', 'smtp.gmail.com'), int(os.environ.get('SMTP_PORT', '587')))
    server.starttls()
    server.login(os.environ.get('SMTP_USER', '$ALERT_EMAIL'), os.environ.get('SMTP_PASS', ''))
    server.send_message(msg)
    server.quit()
    print('[notify] Email sent via SMTP to $ALERT_EMAIL')
except Exception as e:
    print(f'[notify] SMTP email failed: {e}')
" 2>/dev/null && exit 0
fi

# Method 3: Fallback — just log it
echo "[notify] ⚠️  Could not send email. Desktop notification was shown."
echo "[notify] Error: $MESSAGE"
echo "[notify] Time: $TIMESTAMP"
echo "[notify] To enable email alerts, create .smtp-config with your credentials."
echo "[notify] See scripts/SETUP.md for instructions."
