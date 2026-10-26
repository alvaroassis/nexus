# Nexus controller — Raspberry Pi 5 alpha

Nexus is a touch-oriented smart-home interface built in the Home Assistant frontend fork. The deployable product lives in this directory and uses the supported Home Assistant custom-panel boundary. It does not need a rebuild of the entire upstream frontend. Native ES modules deliberately keep this external panel free of CDN and build-time JavaScript dependencies; the upstream Lit application remains intact.

## Language

English is the default. English, Portuguese, and Spanish are available in the first screen, the Nexus setup guide, and Settings. Product copy is in `web/strings.mjs`; parity tests protect translation coverage. The local boot portal has the same three languages. Home Assistant's native account creation and advanced screens use Home Assistant's own translations. Third-party integration/device names are not translated by Nexus.

## Create the Raspberry Pi image

Open **Actions → Nexus Raspberry Pi 5 image → Run workflow**. The workflow also runs when product files change on `dev`. After a successful build, download the `nexus-rpi5-arm64-alpha` artifact and extract its outer GitHub ZIP. Inside are the flashable `.img.xz`, `SHA256SUMS`, and build provenance. No artifact should be described as tested until the run succeeds and the hardware checklist is completed.

In Raspberry Pi Imager, choose **Raspberry Pi 5 → Choose OS → Use custom**, select the `.img.xz`, select your microSD, and write. No renaming to `.image` is required. Avoid applying Imager user customization: this alpha uses its own locked kiosk account and local first-run flow. Existing contents of the selected card are erased by Imager.

For a local build, use a disposable ARM64 Linux machine (a Pi 5 running 64-bit Linux also works), Docker, Git, OpenSSL, and at least 40 GB of free Linux-filesystem space:

```sh
bash product/image/build.sh
```

The script checks out the official pi-gen ARM64 commit `d346cd53562b3c6b4f94c9155175f814258c456d`, installs a kiosk session, and preloads Home Assistant `2026.10.4` for ARM64. It records the resolved container digest. Debian apt packages are not snapshot-pinned, so builds are auditable but not byte-for-byte reproducible. Outputs are in `product/dist/`. The build refuses to overwrite an existing build directory.

## Hardware and first boot

- Raspberry Pi 5, 64-bit, recommended 4 GB RAM or more and 32 GB microSD or larger.
- Suitable Pi 5 power supply and cooling.
- HDMI + USB touch display, or a supported Raspberry Pi DSI touch display. Vendor-specific overlays, rotation, and calibration depend on your exact screen.
- Ethernet is recommended for first testing. The Pi 5 Wi-Fi adapter is detected through NetworkManager. Build defaults use the US regulatory domain; change `WPA_COUNTRY` for another country before building.
- A USB keyboard is a recovery option while touch/on-screen keyboard behavior is validated.

Boot sequence: local touchscreen portal → language → Ethernet/Wi-Fi → Home Assistant owner-account onboarding → Nexus setup (home name and devices) → dashboard. The portal waits for the preloaded backend; internet is not needed just to start it. Device integrations may need internet. After initial Home Assistant onboarding, choose **Nexus** in the sidebar if Home Assistant opens its default dashboard. On subsequent boots, the portal automatically opens `/nexus` once Home Assistant is ready. Open `http://127.0.0.1:8099/?network=1` on the device to return to network setup.

## Included behavior

- Responsive home, rooms, devices, scenes, and settings screens with light/dark/system appearance.
- Real state and service calls via the host's authenticated `hass` object, not a separate account or token store.
- Direct on/off controls for lights, switches, and fans; explicit confirmation for scenes. Other entities open Home Assistant's existing detail controls.
- Favorites, setup completion, language, and appearance saved to Home Assistant user storage. Home name saved to core configuration.
- Device/room lookup, hidden-entity filtering, unavailable states, permission errors, and conservative error handling.
- Home Assistant OS installations can use Supervisor network APIs. The Pi image uses Container, so host Wi-Fi is handled by the local portal at `127.0.0.1:8099`, accessible only from the device.
- Network portal validates Host, Origin, request size, and a session token. It runs as the active unprivileged kiosk user; NetworkManager/polkit scopes its network access. Wi-Fi secrets go directly to NetworkManager over D-Bus and are not placed in command arguments, logs, or browser storage. NetworkManager persists the connection normally.
- Kiosk account password is locked; SSH is disabled and the user is not in sudo/docker groups. Home Assistant authentication remains enabled. Physical access to the unlocked kiosk grants the browser session's permissions: use a dedicated non-admin Home Assistant user for everyday controls after setup.

## Install just the panel in existing Home Assistant

Copy the production modules in `web/` (excluding demo files) to `/config/www/nexus/`. Merge `image/runtime/configuration.yaml`'s `panel_custom` entry into your existing configuration; do not overwrite your existing configuration. Restart Home Assistant, then open `/nexus`. Do not load demo.mjs in production. Panel assets in `/local` contain no secrets and are publicly retrievable like other Home Assistant static assets; backend actions still enforce the signed-in user's permissions.

## Preview and tests

```sh
cd product
node tools/serve.mjs
# Open http://127.0.0.1:4173/
node tools/check.mjs
node --test test/*.test.mjs
python3 -m unittest discover -s test -p '*_test.py'
```

Preview flags: `?setup&lang=es`, `?lang=pt`, `?nonadmin`, `?no-wifi`, `?container`, `?empty`, `?fail`, and `?action-fail`. The demo is explicitly labeled and never creates accounts or changes real networks. Its preferences intentionally reset on refresh.

## Alpha boundaries and acceptance

The image is **not Home Assistant OS**: it has no Supervisor app/add-on store. Zigbee/Z-Wave USB adapters require explicit device mappings in the container service; Thread/Matter radio/server setup is not included. Do not promise support for every IoT device. No OTA appliance updater, A/B image rollback, secure appliance lockdown, or factory-reset UI is implemented in this alpha. Home Assistant native screens remain for owner creation and advanced management.

Before calling this image hardware-ready, verify: cold boot; image expansion; HDMI/DSI display; touch alignment; on-screen keyboard in password fields; all three languages; Ethernet DHCP; Wi-Fi discovery and incorrect password recovery; Wi-Fi reconnection after reboot; real owner creation; persistent home name/favorites; backend permissions; live control and error feedback; internet-loss behavior; clean shutdown/power-loss recovery; storage capacity and thermal behavior.

Back up Home Assistant before upgrades (native backup UI when available, or stop the container and securely copy `/var/lib/nexus/homeassistant` from the SD card). Reflashing the image does not preserve configuration; restore a backup. This first alpha deliberately does not implement automatic system updates. Retain the previous image and backup for rollback.

## Sources

- https://www.home-assistant.io/integrations/panel_custom/
- https://developers.home-assistant.io/docs/frontend/custom-ui/creating-custom-panels/
- https://github.com/RPi-Distro/pi-gen/tree/arm64
- https://www.raspberrypi.com/documentation/computers/getting-started.html
- https://networkmanager.dev/docs/api/latest/spec.html

Upstream license and notices are preserved at repository root. New product modules use Apache-2.0 SPDX identifiers where applicable. No changes are submitted to the upstream Home Assistant project by this work.

## Automated image verification

The workflow tests the custom panel against a disposable Home Assistant instance before building. It then checks the compressed image checksum, Pi 5 boot files, installed kiosk payload, and account restrictions, and repeats the real API test using the ARM64 backend bundled in the image. Restart persistence is checked separately. A successful run includes `VERIFICATION.txt`; physical boot, display, touch, and Wi-Fi still require the hardware acceptance checks above.
