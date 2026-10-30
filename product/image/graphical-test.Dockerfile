FROM debian:trixie-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    xserver-xorg xinit openbox lightdm chromium chromium-sandbox dbus-x11 \
    python3 python3-dbus python3-xdg x11-xserver-utils xauth curl \
    libglib2.0-bin dconf-gsettings-backend gsettings-desktop-schemas gir1.2-atspi-2.0 at-spi2-core xvfb xdotool fonts-dejavu-core imagemagick procps && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --shell /bin/bash nexus
COPY product/image/runtime/ /opt/nexus/
COPY product/image/test-graphical.sh /opt/test-graphical.sh
RUN chmod +x /opt/nexus/kiosk.sh
USER nexus
CMD ["bash", "/opt/test-graphical.sh"]
