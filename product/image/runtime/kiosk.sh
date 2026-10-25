#!/bin/bash
set -euo pipefail
until curl -fsS http://127.0.0.1:8099/health >/dev/null; do sleep 1; done
while true; do
  chromium --kiosk --no-first-run --no-default-browser-check --force-renderer-accessibility \
    --password-store=basic --disable-session-crashed-bubble \
    --user-data-dir=/home/nexus/.config/nexus-browser \
    http://127.0.0.1:8099/
  sleep 3
done
