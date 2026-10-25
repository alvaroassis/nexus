#!/bin/bash
set -euo pipefail
PRODUCT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="$(find "$PRODUCT/dist" -maxdepth 1 -name '*.img.xz' -print -quit)"
test -n "$IMAGE"
cd "$PRODUCT/dist"
sha256sum -c SHA256SUMS
xz --test "$IMAGE"
UNPACKED="${IMAGE%.xz}"
xz --decompress --keep "$IMAGE"
MOUNT="$(mktemp -d)"
BOOT="$(mktemp -d)"
CONFIG="$(mktemp -d)"
LOOP="$(sudo losetup --find --show --read-only --partscan "$UNPACKED")"
cleanup() {
  docker rm -f nexus-ci-check >/dev/null 2>&1 || true
  sudo umount "$MOUNT" || true
  sudo umount "$BOOT" || true
  sudo losetup --detach "$LOOP" || true
  rm -f "$UNPACKED"
}
trap cleanup EXIT
sudo mount -o ro "${LOOP}p2" "$MOUNT"
sudo mount -o ro "${LOOP}p1" "$BOOT"
test -f "$BOOT/bcm2712-rpi-5-b.dtb"
test -f "$BOOT/kernel_2712.img"
for file in opt/nexus/portal.py opt/nexus/home-assistant.tar.gz etc/systemd/system/nexus-homeassistant.service etc/lightdm/lightdm.conf.d/90-nexus.conf home/nexus/.config/openbox/autostart var/lib/nexus/homeassistant/www/nexus/nexus-panel.mjs; do test -s "$MOUNT/$file"; done
sudo awk -F: '$1=="nexus" {if ($2 !~ /^!/) exit 1; found=1} END {if(!found)exit 1}' "$MOUNT/etc/shadow"
! sudo grep '^sudo:.*[, :]nexus\([, :]\|$\)' "$MOUNT/etc/group"
sudo cp -a "$MOUNT/var/lib/nexus/homeassistant/." "$CONFIG/"
sudo chmod -R a+rwX "$CONFIG"
docker load --input "$MOUNT/opt/nexus/home-assistant.tar.gz"
test "$(docker image inspect ghcr.io/home-assistant/home-assistant:2026.10.4 --format '{{.Architecture}}')" = arm64
docker run -d --name nexus-ci-check -p 127.0.0.1:18123:8123 -v "$CONFIG:/config" ghcr.io/home-assistant/home-assistant:2026.10.4
READY=0
for _ in $(seq 1 120); do
  if curl -fsS http://127.0.0.1:18123/api/onboarding >/dev/null; then READY=1; break; fi
  sleep 2
done
[[ "$READY" == 1 ]] || { docker logs --tail 100 nexus-ci-check; exit 1; }
node "$PRODUCT/tools/smoke-backend.mjs"
docker restart nexus-ci-check >/dev/null
READY=0
for _ in $(seq 1 120); do
  if curl -fsS http://127.0.0.1:18123/ >/dev/null; then READY=1; break; fi
  sleep 2
done
[[ "$READY" == 1 ]]
# Confirm core name and user preference persistence after a backend restart.
sudo python3 - "$CONFIG" <<'PY'
import json,pathlib,sys
root=pathlib.Path(sys.argv[1])/'.storage'
assert json.loads((root/'core.config').read_text())['data']['location_name']=='Nexus verified home'
assert any('"es"' in p.read_text() and '"nexus"' in p.read_text() for p in root.glob('frontend.user_data_*'))
PY
printf '%s\n' 'Image verification passed: checksum, XZ stream, Pi 5 boot files, kiosk payload, locked user, ARM64 backend, real API smoke and restart persistence.' > "$PRODUCT/dist/VERIFICATION.txt"
cat "$PRODUCT/dist/VERIFICATION.txt"
