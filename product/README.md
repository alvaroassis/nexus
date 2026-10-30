# Nexus controller — Raspberry Pi 5 alpha5

Alpha2 boot was confirmed by the owner on the Pi 5 touchscreen. Alpha3 introduced the native Nexus setup and management UI. Alpha4 replaces the floating keyboard with an integrated tablet keyboard.

## Alpha5 experience

The interface adopts the owner's 3FX palette: charcoal, gray, and amber/orange. The original 3FX image is bundled locally, displayed small beside Powered by; see BRANDING.md for its source and checksum. The old boxed header mark and floating keyboard button are removed. Onboard is no longer installed.

Plymouth is included in every installed kernel initramfs, and verification checks the Pi 5 firmware initramfs itself. A separate, locally rendered Nexus animation is visible for at least 2.2 seconds when Chromium starts, including when the display activates after the early boot splash. Reduced-motion preferences are respected by the interface. Physical DSI/HDMI startup timing still needs a Pi acceptance test.

In Devices, administrators can open Add device to see supported devices found by the existing zeroconf, SSDP, DHCP and other native discovery integrations. Detection remains automatic; Refresh updates the list, not an arbitrary IP/port scan. The image retains host networking for multicast discovery. A curated manual catalog includes common TV/audio, lighting and hub integrations.

Pairing is completed through native forms for text, credentials/PIN, numbers, booleans, selects, menus and progress steps. The core validates all fields and carries out discovery and pairing. External authentication and specialized selectors are explicitly marked unavailable on this screen; advanced integration configuration and automation remain separate. Some devices require a hub, approval on the device, internet access or a manufacturer's account. Discovery does not guarantee compatibility with every LAN device.

TV/audio cards show advertised power, play/pause, mute, volume and input controls. Volume is a touch slider from 0 to 100 percent, translated to the core's 0–1 range. Unsupported controls are omitted, and unavailable/off devices disable controls appropriately.

## Local touchscreen flow

Plymouth animated Nexus wordmark → Nexus loading screen → language → country/time zone → Ethernet/Wi-Fi → owner account (or sign in) → home name → native Nexus dashboard.

English, Portuguese and Spanish are supported. Setup can proceed offline; integrations that need cloud services still need internet. Country and time zone are validated against the device's IANA zone database and saved to core configuration. The device time zone is set through a narrowly scoped timedate1 polkit rule. Country selection does not change the Wi-Fi radio regulatory domain (US build default).

The local interface remains on port 8099; it never redirects onboarding or the dashboard into upstream frontend pages. Existing installations can sign in with their existing account. Reload/reboot restores an authenticated session using an HttpOnly, SameSite cookie; clearing browser storage cannot create a second owner. Backend onboarding state remains authoritative.

The native dashboard displays real device states, room filters and favorites, and provides supported light/switch/fan, scene, shade, temperature and media actions. Discovery and supported pairing steps are available in the local Nexus UI. Advanced integration/automation administration remains available separately through the backend web interface. Original panel code is retained for existing deployments.

## Tablet keyboard

Touching an editable field opens the Nexus keyboard docked across the bottom of the screen. The content area shrinks and scrolls the active field into view. Next moves between fields; Done or Hide closes the keyboard. Letters, accents, numbers, punctuation, cursor movement, selection replacement and password fields are supported. The keyboard uses the selected interface language and also works inside device-control dialogs. It does not store typed text or offer network-based suggestions. The native keyboard opens automatically; no floating launcher or Onboard process is needed.

The UI is checked at 800 × 480, 1280 × 800 and 800 × 1280. Physical touchscreen behavior still needs acceptance on the Pi. The integrated keyboard was introduced in alpha4 and is retained with the 3FX palette in alpha5.

## Build and installation

Open Actions → Nexus Raspberry Pi 5 image. The workflow builds on changes to product files on dev. Download nexus-rpi5-arm64-alpha5, extract its outer ZIP, and flash the .img.xz with Raspberry Pi Imager's Use custom option. Avoid applying Imager user customization. Flashing erases the selected card; back up existing configuration first.

Use a Pi 5, adequate power/cooling, and a microSD of at least 32 GB. HDMI/USB touch or supported DSI displays are supported by the underlying OS; hardware-specific calibration may still be needed.

For a disposable native ARM64 Linux builder with Docker, Git, OpenSSL and 40 GB free:
```sh
bash product/image/build.sh
```

The build pins pi-gen commit d346cd53562b3c6b4f94c9155175f814258c456d and core container 2026.10.4; the resolved container digest and image checksums are included. Apt packages are not snapshot-pinned.

## Authentication and security

The loopback-only service validates Host, Origin and a per-process request token. It exposes a fixed set of operations, not an arbitrary API proxy. Backend authentication, permissions and first-owner restrictions are preserved. Account and Wi-Fi passwords are not saved in browser storage or application logs. The refresh credential and a hash of the session cookie are stored in a private 0600 file under the kiosk user's state directory. Signing out revokes the refresh credential. Physical access to the kiosk exposes that signed-in user's controls.

SSH is disabled; the kiosk account is locked and has no sudo/docker membership. Only the active local kiosk may configure its networks and timezone. The alpha does not provide OTA updates, A/B rollback, a factory reset UI, or Supervisor add-ons.

Pairing endpoints require a signed-in administrator. Flow identifiers are checked against current discovery or the same local session; request bodies are schema-bound. Config-entry credentials and secret defaults are never returned to the browser. Media commands remain allowlisted and are checked against the entity's advertised capabilities.

## Verification

A separate isolated Playwright touch journey exercises the integrated keyboard: accented text, punctuation, password masking, caret/selection edits, max length, next/done, numeric dialogs, dismissal and viewport avoidance. Its screenshots are saved as nexus-keyboard-evidence. It uses local API fixtures and does not change a real network or home.

CI checks JavaScript/Python/shell syntax, unit and security regressions, existing panel behavior, real core integration and a Playwright first-run journey. That journey creates an actual owner, applies country/timezone, completes onboarding, enters the native dashboard, reloads and signs out/in, rejects a wrong password, and exercises Wi-Fi failure recovery. CI uses network/timedate fixtures because the runner has no appliance hardware. Screenshots are saved as nexus-onboarding-evidence.

The device interaction journey verifies touch volume conversion, power, mute, source selection, unsupported-control hiding, discovery, a pairing retry and completion, cancellation, and non-admin visibility using isolated fixtures. The real-core journey also checks the discovery API and starts/cancels a real Roku config flow in a disposable core. It does not claim that a physical television has been paired. Screenshots are saved as nexus-device-evidence.

The ARM64 build verifies boot files, checksums, splash payload, installed graphical userspace, keyboard, bundled backend and restart persistence. These tests do not emulate the Pi's firmware, KMS, physical touch or audio.

Physical alpha5 acceptance: cold boot and Plymouth handoff; touch typing; country/timezone applied to the host; Ethernet/Wi-Fi success and failure; owner setup; restart resumes dashboard; control actual devices; audio; power-loss recovery. NEXUS-DIAGNOSTICS.txt on the boot partition remains available for troubleshooting.

Upstream licenses and notices remain intact. The product uses the Home Assistant Core API internally.

