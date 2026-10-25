# Nexus

## Status

Nexus starts as a fork of `home-assistant/frontend`. The inherited frontend is present; the Nexus interface, hardware image, network provisioning, and touch onboarding described below are planned, not implemented or tested on hardware yet.

## Product vision

A dedicated smart-home controller built around a Raspberry Pi and a touchscreen. Nexus will offer a calm, polished, accessible experience inspired by the simplicity of Apple and Google products, with its own visual identity. Home Assistant will provide device integrations and automation capabilities. Compatibility depends on supported integrations, device capabilities, and required radio hardware; universal IoT support is not assumed.

## First-run experience

1. Welcome and language selection.
2. Network setup: detect wired Ethernet and its connection status; offer Wi-Fi only when compatible hardware is detected. Support network selection, password entry, connection testing, retry, and clear error states. Distinguish local connectivity from internet availability.
3. Create the owner account using Home Assistant authentication. Never store passwords in application logs or browser persistence.
4. Name the home and confirm regional preferences.
5. Discover supported devices, confirm additions, and assign rooms.
6. Open the home dashboard and introduce essential controls.

The setup must be usable entirely by touch, including an on-screen keyboard, back navigation, understandable progress, and recovery after interruption. Owner-account creation must remain protected by backend onboarding state and must not be re-enabled by resetting browser storage.

## Main experience

- Home overview with favorite devices, relevant status, and quick actions.
- Rooms and device controls for supported lights, climate, shades, sensors, media, and other integrations.
- Scenes and automations with understandable feedback.
- Settings for users, home, network, display, integrations, updates, and backup/recovery.
- Large touch targets, accessible contrast, light/dark appearance, and layouts adapted to the selected display.
- Clear unavailable-device states and confirmation for consequential controls.
- Local operation wherever the integration supports it; clearly identify cloud-dependent functions.

## Technical boundaries

This repository contains the frontend, not the complete Home Assistant operating system or backend. Keep the upstream history, licensing, and attribution intact. Maintain compatibility with Home Assistant authentication and APIs and keep product changes isolated enough to support upstream updates.

A same-device touchscreen product also needs an operating-system/display stack, kiosk startup, touch and keyboard support, and a privileged network-provisioning service. A browser UI alone cannot configure host Ethernet or Wi-Fi. Choose and validate that deployment architecture before promising an installable Raspberry Pi image. Evaluate Home Assistant OS plus a supported local-display approach versus a Linux kiosk host running Home Assistant Container; document operational differences before selection.

## Delivery milestones

1. Confirm Raspberry Pi model, display connection/resolution, touch support, storage, and any Zigbee/Thread/Z-Wave adapters.
2. Prototype and review the visual system, onboarding screens, and home dashboard using clearly labeled simulated data.
3. Integrate real authentication, home configuration, device discovery, and controls with Home Assistant.
4. Implement and test host network provisioning and kiosk behavior on the chosen hardware.
5. Package a reproducible image with update, backup, and recovery procedures.

## Acceptance goals

- Complete first-time setup entirely from the attached touchscreen.
- Handle Ethernet, supported Wi-Fi, missing Wi-Fi hardware, invalid credentials, and interrupted setup.
- Persist the real owner account and home name across reboots.
- Display real device states and reflect successful/failed actions accurately.
- Validate local control during internet loss for integrations that support it.
- Boot into the Nexus interface and recover predictably from power loss.

## Upstream

- Frontend: https://github.com/home-assistant/frontend
- Core: https://github.com/home-assistant/core
- Operating system: https://github.com/home-assistant/operating-system

No complete hardware product is delivered by this initial repository setup.
