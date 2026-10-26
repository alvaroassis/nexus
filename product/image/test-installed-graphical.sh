#!/bin/bash
# Run the SHIPPED userspace from the mounted image, using a host virtual display.
# No emulation of Pi firmware/GPU, physical touch or audio.
set -Eeuo pipefail
ROOTFS="$1"
EVIDENCE="$2"
mkdir -p "$EVIDENCE"
export DISPLAY=:98
cleanup() {
  docker logs nexus-installed-gui 2>/dev/null || true
  docker exec nexus-installed-gui cat /home/nexus/.local/state/nexus/session.log 2>/dev/null || true
  docker rm -f nexus-installed-gui >/dev/null 2>&1 || true
  if [[ -n "${XVFB_PID:-}" ]]; then kill "$XVFB_PID" || true; fi
}
trap cleanup EXIT
# Exclude the bundled backend archive; it is tested separately by verify.sh.
sudo tar -C "$ROOTFS" --exclude=./opt/nexus/home-assistant.tar.gz -c . |
  docker import - nexus-installed-rootfs >/dev/null
Xvfb :98 -screen 0 1280x800x24 -ac -nolisten tcp > "$EVIDENCE/xvfb.log" 2>&1 &
XVFB_PID=$!
for _ in $(seq 1 30); do
  if xset q >/dev/null 2>&1; then break; fi
  sleep 1
done
docker run -d --name nexus-installed-gui --user 1000:1000 \
  --cap-add SYS_ADMIN --security-opt seccomp=unconfined --shm-size=512m \
  -e HOME=/home/nexus -e DISPLAY=:98 \
  -v /tmp/.X11-unix:/tmp/.X11-unix:ro \
  nexus-installed-rootfs dbus-run-session -- /etc/X11/Xsession openbox-session
READY=0
for _ in $(seq 1 90); do
  if xdotool search --onlyvisible --name 'Nexus.*Welcome' >/dev/null 2>&1 &&
     xdotool search --onlyvisible --class Onboard >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
[[ "$READY" == 1 ]]
docker exec nexus-installed-gui curl -fsS http://127.0.0.1:8099/health
import -window root "$EVIDENCE/installed-graphical-session.png"
echo 'PASS: shipped ARM64 image userspace opened Nexus and Onboard on virtual X11.'
