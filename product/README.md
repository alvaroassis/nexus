# Nexus controller — Raspberry Pi 5 alpha4

Alpha2 boot was confirmed by the owner on the Pi 5 touchscreen. Alpha3 introduced the native Nexus setup and management UI. Alpha4 replaces the floating keyboard with an integrated tablet keyboard.

## Local touchscreen flow

Plymouth animated Nexus wordmark → Nexus loading screen → language → country/time zone → Ethernet/Wi-Fi → owner account (or sign in) → home name → native Nexus dashboard.

English, Portuguese and Spanish are supported. Setup can proceed offline; integrations that need cloud services still need internet. Country and time zone are validated against the device's IANA zone database and saved to core configuration. The device time zone is set through a narrowly scoped timedate1 polkit rule. Country selection does not change the Wi-Fi radio regulatory domain (US build default).

The local interface remains on port 8099; it never redirects onboarding or the dashboard into upstream frontend pages. Existing installations can sign in with their existing account. Reload/reboot restores an authenticated session using an HttpOnly, SameSite cookie; clearing browser storage cannot create a second owner. Backend onboarding state remains authoritative.

The native dashboard displays real device states, room filters and favorites, and provides supported light/switch/fan, scene, shade, temperature and media actions. Advanced integration/automation administration remains available separately through the backend web interface; it is not yet reimplemented in the local Nexus UI. Original panel code is retained for existing deployments.

## Tablet keyboard

Touching an editable field opens the Nexus keyboard docked across the bottom of the screen. The content area shrinks and scrolls the active field into view. Next moves between fields; Done or Hide closes the keyboard. Letters, accents, numbers, punctuation, cursor movement, selection replacement and password fields are supported. The keyboard uses the selected interface language and also works inside device-control dialogs. It does not store typed text or offer network-based suggestions. Onboard no longer starts in the graphical session.

The UI is checked at 800 × 480, 1280 × 800 and 800 × 1280. Physical touchscreen behavior still needs acceptance on the Pi. This change is in the alpha4 image; an already-downloaded alpha3 image retains the floating keyboard.

## Build and installation

Open Actions → Nexus Raspberry Pi 5 image. The workflow builds on changes to product files on dev. Download nexus-rpi5-arm64-alpha4, extract its outer ZIP, and flash the .img.xz with Raspberry Pi Imager's Use custom option. Avoid applying Imager user customization. Flashing erases the selected card; back up existing configuration first.

Use a Pi 5, adequate power/cooling, and a microSD of at least 32 GB. HDMI/USB touch or supported DSI displays are supported by the underlying OS; hardware-specific calibration may still be needed.

For a disposable native ARM64 Linux builder with Docker, Git, OpenSSL and 40 GB free:
```sh
bash product/image/build.sh
```

The build pins pi-gen commit d346cd53562b3c6b4f94c9155175f814258c456d and core container 2026.10.4; the resolved container digest and image checksums are included. Apt packages are not snapshot-pinned.

## Authentication and security

The loopback-only service validates Host, Origin and a per-process request token. It exposes a fixed set of operations, not an arbitrary API proxy. Backend authentication, permissions and first-owner restrictions are preserved. Account and Wi-Fi passwords are not saved in browser storage or application logs. The refresh credential and a hash of the session cookie are stored in a private 0600 file under the kiosk user's state directory. Signing out revokes the refresh credential. Physical access to the kiosk exposes that signed-in user's controls.

SSH is disabled; the kiosk account is locked and has no sudo/docker membership. Only the active local kiosk may configure its networks and timezone. The alpha does not provide OTA updates, A/B rollback, a factory reset UI, or Supervisor add-ons.

## Verification

A separate isolated Playwright touch journey exercises the integrated keyboard: accented text, punctuation, password masking, caret/selection edits, max length, next/done, numeric dialogs, dismissal and viewport avoidance. Its screenshots are saved as nexus-keyboard-evidence. It uses local API fixtures and does not change a real network or home.

CI checks JavaScript/Python/shell syntax, unit and security regressions, existing panel behavior, real core integration and a Playwright first-run journey. That journey creates an actual owner, applies country/timezone, completes onboarding, enters the native dashboard, reloads and signs out/in, rejects a wrong password, and exercises Wi-Fi failure recovery. CI uses network/timedate fixtures because the runner has no appliance hardware. Screenshots are saved as nexus-onboarding-evidence.

The ARM64 build verifies boot files, checksums, splash payload, installed graphical userspace, keyboard, bundled backend and restart persistence. These tests do not emulate the Pi's firmware, KMS, physical touch or audio.

Physical alpha4 acceptance: cold boot and Plymouth handoff; touch typing; country/timezone applied to the host; Ethernet/Wi-Fi success and failure; owner setup; restart resumes dashboard; control actual devices; audio; power-loss recovery. NEXUS-DIAGNOSTICS.txt on the boot partition remains available for troubleshooting.

Upstream licenses and notices remain intact. The product uses the Home Assistant Core API internally.

