#!/bin/bash
# Includes local network topology for troubleshooting; no credentials or session logs.
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
  echo 'Network interfaces and addresses:'
  ip -brief address || true
  echo 'Network interface flags (including multicast):'
  ip -brief link || true
  echo 'IPv4 routes:'
  ip -4 route || true
  echo 'NetworkManager device state:'
  nmcli -t -f DEVICE,TYPE,STATE device status || true
  echo 'Core container network mode:'
  docker inspect --format '{{.HostConfig.NetworkMode}}' nexus-homeassistant || true
  echo 'Pointer controller:'
  pgrep -f '^python3 /opt/nexus/pointer.py$' >/dev/null && echo running || echo stopped
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
