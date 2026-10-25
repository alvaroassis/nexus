#!/bin/bash
set -euo pipefail
# Run on a disposable native ARM64 Linux builder with Docker and 40+ GB free.
[[ "$(uname -m)" == aarch64 ]] || { echo 'Use native ARM64 Linux (for example ubuntu-24.04-arm in GitHub Actions).'; exit 1; }
command -v docker >/dev/null
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${NEXUS_BUILD_DIR:-$PWD/nexus-image-build}"
[[ ! -e "$BUILD_DIR" ]] || { echo "Build directory already exists: $BUILD_DIR. Choose an empty NEXUS_BUILD_DIR."; exit 1; }
mkdir -p "$BUILD_DIR"
git clone https://github.com/RPi-Distro/pi-gen.git "$BUILD_DIR/pi-gen"
cd "$BUILD_DIR/pi-gen"
git checkout d346cd53562b3c6b4f94c9155175f814258c456d
cp -a "$SOURCE/image/stage-nexus" stage-nexus
mkdir -p stage-nexus/00-install/files/product
cp -a "$SOURCE/web" "$SOURCE/image/runtime" stage-nexus/00-install/files/product/
HA_IMAGE='ghcr.io/home-assistant/home-assistant:2026.10.4'
docker pull --platform linux/arm64 "$HA_IMAGE"
docker image inspect "$HA_IMAGE" --format '{{index .RepoDigests 0}}' > stage-nexus/00-install/files/product/home-assistant.digest
docker save "$HA_IMAGE" | gzip -1 > stage-nexus/00-install/files/product/home-assistant.tar.gz
cat > config <<'CONFIG'
IMG_NAME='nexus-rpi5-arm64-alpha'
PI_GEN_RELEASE='Nexus development image'
RELEASE='trixie'
DEPLOY_COMPRESSION='xz'
COMPRESSION_LEVEL=3
LOCALE_DEFAULT='en_US.UTF-8'
KEYBOARD_KEYMAP='us'
KEYBOARD_LAYOUT='English (US)'
TIMEZONE_DEFAULT='Etc/UTC'
TARGET_HOSTNAME='nexus'
FIRST_USER_NAME='nexus'
DISABLE_FIRST_BOOT_USER_RENAME=1
PASSWORDLESS_SUDO=0
ENABLE_SSH=0
ENABLE_CLOUD_INIT=0
WPA_COUNTRY='US'
STAGE_LIST='stage0 stage1 stage2 stage-nexus'
CONFIG
# Build-only random password; account is locked by stage-nexus and never shipped usable.
printf "FIRST_USER_PASS='%s'\n" "$(openssl rand -hex 32)" >> config
touch stage2/SKIP_IMAGES
chmod +x stage-nexus/prerun.sh stage-nexus/00-install/00-run.sh
./build-docker.sh
mkdir -p "$SOURCE/dist"
cp deploy/*nexus*.img.xz "$SOURCE/dist/"
cp stage-nexus/00-install/files/product/home-assistant.digest "$SOURCE/dist/"
git rev-parse HEAD > "$SOURCE/dist/pi-gen.commit"
cd "$SOURCE/dist"
sha256sum ./*.img.xz > SHA256SUMS
echo "Image and checksums: $SOURCE/dist"
