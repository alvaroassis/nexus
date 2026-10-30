#!/bin/bash -e
install -d "${ROOTFS_DIR}/opt/nexus" "${ROOTFS_DIR}/var/lib/nexus/homeassistant/www/nexus" "${ROOTFS_DIR}/etc/lightdm/lightdm.conf.d" "${ROOTFS_DIR}/home/nexus/.config/openbox" "${ROOTFS_DIR}/usr/share/xsessions" "${ROOTFS_DIR}/etc/polkit-1/rules.d"
cp -a files/product/runtime/. "${ROOTFS_DIR}/opt/nexus/"
install -d "${ROOTFS_DIR}/etc/X11/xorg.conf.d"
install -m 644 files/product/runtime/99-nexus-vc4.conf "${ROOTFS_DIR}/etc/X11/xorg.conf.d/99-nexus-vc4.conf"
install -m 644 files/product/runtime/nexus-diagnostics.service "${ROOTFS_DIR}/etc/systemd/system/nexus-diagnostics.service"
install -m 644 files/product/runtime/nexus-diagnostics.timer "${ROOTFS_DIR}/etc/systemd/system/nexus-diagnostics.timer"
cp -a files/product/web/. "${ROOTFS_DIR}/var/lib/nexus/homeassistant/www/nexus/"
install -m 600 files/product/home-assistant.tar.gz "${ROOTFS_DIR}/opt/nexus/home-assistant.tar.gz"
install -m 644 files/product/home-assistant.digest "${ROOTFS_DIR}/opt/nexus/home-assistant.digest"
install -m 644 files/product/runtime/homeassistant.service "${ROOTFS_DIR}/etc/systemd/system/nexus-homeassistant.service"
install -m 644 files/product/runtime/lightdm.conf "${ROOTFS_DIR}/etc/lightdm/lightdm.conf.d/90-nexus.conf"
install -m 644 files/product/runtime/nexus.desktop "${ROOTFS_DIR}/usr/share/xsessions/nexus.desktop"
install -m 644 files/product/runtime/network.rules "${ROOTFS_DIR}/etc/polkit-1/rules.d/50-nexus-network.rules"
install -m 644 files/product/runtime/configuration.yaml "${ROOTFS_DIR}/var/lib/nexus/homeassistant/configuration.yaml"
install -m 755 files/product/runtime/autostart "${ROOTFS_DIR}/home/nexus/.config/openbox/autostart"
install -m 644 files/product/runtime/timezone.rules "${ROOTFS_DIR}/etc/polkit-1/rules.d/51-nexus-timezone.rules"
install -d "${ROOTFS_DIR}/usr/share/plymouth/themes/nexus"
install -m 644 files/product/runtime/nexus.plymouth files/product/runtime/nexus.script "${ROOTFS_DIR}/usr/share/plymouth/themes/nexus/"
# Keep firmware output quiet; serial console and diagnostics remain available.
sed -i 's/ console=tty1//g; s/$/ console=tty1 quiet splash plymouth.ignore-serial-consoles logo.nologo vt.global_cursor_default=0/' "${ROOTFS_DIR}/boot/firmware/cmdline.txt"
printf '\n[all]\ndisable_splash=1\nauto_initramfs=1\n' >> "${ROOTFS_DIR}/boot/firmware/config.txt"
on_chroot <<'CHROOT'
chmod +x /opt/nexus/start-homeassistant.sh /opt/nexus/kiosk.sh
chown -R nexus:nexus /home/nexus/.config
# Physical kiosk session only, no default login password and no administrative group.
passwd -l nexus
gpasswd -d nexus sudo || true
gpasswd -d nexus docker || true
systemctl disable ssh.service || true
systemctl disable userconfig.service || true
systemctl enable NetworkManager docker nexus-homeassistant lightdm nexus-diagnostics.timer
systemctl set-default graphical.target
plymouth-set-default-theme nexus
# Refresh every installed kernel, including the Pi 5 firmware initramfs.
update-initramfs -u -k all
lsinitramfs /boot/firmware/initramfs_2712 | grep 'plymouth/themes/nexus/nexus.script' >/dev/null
CHROOT
