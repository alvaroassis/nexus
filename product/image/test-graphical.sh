#!/bin/bash
# Virtual X11 integration: does not emulate Pi firmware, KMS or HDMI.
set -Eeuo pipefail
export DISPLAY=:99
export HOME=/home/nexus
mkdir -p "$HOME/.config/openbox"
cp /opt/nexus/autostart "$HOME/.config/openbox/autostart"
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp > /tmp/xvfb.log 2>&1 &
for _ in $(seq 1 30); do
  if xset q >/dev/null 2>&1; then break; fi
  sleep 1
done
dbus-run-session -- /etc/X11/Xsession openbox-session > /tmp/xsession.log 2>&1 &
cleanup() {
  cat /tmp/xvfb.log /tmp/xsession.log "$HOME/.local/state/nexus/session.log" 2>/dev/null || true
}
trap cleanup EXIT
for _ in $(seq 1 90); do
  if xdotool search --onlyvisible --class chromium >/dev/null 2>&1 &&
     xdotool search --onlyvisible --name 'Nexus.*Welcome' >/dev/null 2>&1; then
    curl -fsS http://127.0.0.1:8099/health
    [[ "$(gsettings get org.onboard.window force-to-top)" == true ]]
    pgrep -x onboard
    xdotool search --onlyvisible --class Onboard
    import -window root /evidence/graphical-session.png
    echo 'PASS: Openbox autostart launched portal and visible Chromium Nexus window.'
    exit 0
  fi
  sleep 2
done
echo 'FAIL: graphical startup did not display Nexus.' >&2
exit 1
