#!/bin/bash
set -euo pipefail
IMAGE='ghcr.io/home-assistant/home-assistant:2026.10.4'
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker load --input /opt/nexus/home-assistant.tar.gz
fi
if docker container inspect nexus-homeassistant >/dev/null 2>&1; then
  exec docker start --attach nexus-homeassistant
fi
exec docker run --name nexus-homeassistant --network host \
  -e TZ=Etc/UTC \
  -v /var/lib/nexus/homeassistant:/config \
  -v /run/dbus:/run/dbus:ro \
  "$IMAGE"
