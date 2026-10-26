FROM debian:trixie-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    xserver-xorg xinit openbox lightdm chromium chromium-sandbox onboard dbus-x11 \
    python3 python3-dbus python3-xdg x11-xserver-utils xauth curl \
    xvfb xdotool fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --shell /bin/bash nexus
COPY product/image/runtime/ /opt/nexus/
COPY product/image/test-graphical.sh /opt/test-graphical.sh
RUN chmod +x /opt/nexus/kiosk.sh
USER nexus
CMD ["bash", "/opt/test-graphical.sh"]
