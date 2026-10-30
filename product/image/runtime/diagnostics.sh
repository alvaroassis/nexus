#!/bin/bash
# Excludes network credentials, IPs, HA logs and browser/session logs.
set -uo pipefail
REPORT=/boot/firmware/NEXUS-DIAGNOSTICS.txt
TEMP="$(mktemp /boot/firmware/nexus-diagnostics.XXXXXX)"
trap 'rm -f "$TEMP"' EXIT
{
  echo 'Nexus boot diagnostics'
  date -u
  uname -r
  for unit in lightdm nexus-homeassistant NetworkManager plymouth-start plymouth-quit-wait; do
    echo "$unit"
    systemctl show "$unit" -p ActiveState -p SubState -p Result -p NRestarts
  done
  echo 'Selected boot theme:'
  plymouth-set-default-theme || true
  echo 'Firmware initramfs files:'
  ls -l /boot/firmware/initramfs* 2>/dev/null || true
  echo 'Graphical processes:'
  ps -C Xorg,openbox,chromium,onboard -o comm= || true
  echo 'DRM connectors and modes:'
  for status in /sys/class/drm/card*-*/status; do
    [[ -f "$status" ]] || continue
    echo "${status%/status}"
    cat "$status" "${status%/status}/modes" 2>/dev/null || true
  done
  echo 'Input device names:'
  grep '^N: Name=' /proc/bus/input/devices || true
  echo 'Sound cards:'
  cat /proc/asound/cards 2>/dev/null || true
  echo 'Xorg warnings and errors:'
  for log in /var/log/Xorg.0.log /var/log/lightdm/x-0.log /home/nexus/.local/share/xorg/Xorg.0.log; do
    if [[ -f "$log" ]]; then
      grep -E '\(EE\)|\(WW\)|PrimaryGPU|modeset\(' "$log" | tail -n 60 || true
    fi
  done
} > "$TEMP" 2>&1
mv -f "$TEMP" "$REPORT"
