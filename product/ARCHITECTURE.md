# Nexus frontend and Home Assistant Core

The product direction is an independent Nexus frontend backed by Home Assistant
Core. Maintaining a fork of Home Assistant's frontend is not required.

## Current implementation

The image runs the official Home Assistant Container. It does not compile or
install the frontend fork from this repository. Nexus currently runs as a
panel_custom web component inside the standard frontend shipped with that
container, receiving its authenticated hass object from the host. Advanced
settings and entity dialogs also depend on that frontend. This is not yet a
standalone frontend.

## Target implementation

Serve Nexus as its own application. Replace the injected hass object with a Core
client using the documented authorization-code flow, refresh tokens, authenticated
/api/websocket, subscriptions, registries and service calls. Do not embed shared
administrator credentials or long-lived tokens in the image. Core must enforce
ownership and permissions. Replace host-specific dialogs and navigation with Nexus
screens; retain the HA interface as an explicitly labeled advanced administration
option during migration.

Keep hardware provisioning (NetworkManager, display, touch and audio) in the OS
layer. Default to English, with Portuguese and Spanish throughout the experience.

Migration requires real Core tests for authentication, refresh, reconnects, live
entity changes, service calls, permissions and onboarding. UI mocks alone do not
establish completion. The current panel remains until that client is implemented.

## Boot validation boundary

The original image passed backend and web tests but failed on the user's Pi 5.
Static checks do not prove graphical boot. The VC4 OutputClass selects the display
GPU by driver rather than unstable card numbers. It addresses a known Pi 5 Xorg
configuration issue; confirmation on the actual tablet is still required.

CI also launches the shipped ARM64 userspace from the mounted image and its actual Openbox autostart, provisioning server and Chromium in
virtual X11. This covers userspace startup, not firmware, HDMI, touch or speakers.
At 90 and 240 seconds after boot, the device writes NEXUS-DIAGNOSTICS.txt on the SD
boot partition. If the screen remains black, shut down before removing the card
and read the report on another computer. Credentials and HA logs are excluded.

Sources:

- https://developers.home-assistant.io/docs/auth_api/
- https://developers.home-assistant.io/docs/api/websocket/
- https://docs.voidlinux.org/installation/guides/arm-devices/raspberry-pi.html
