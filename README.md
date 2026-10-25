# Nexus — smart home controller

Touch-first controller for Raspberry Pi 5, built on Home Assistant. English is the default; Portuguese and Spanish are supported throughout the Nexus UI.

- **[Build, flash, install and test](product/README.md)**
- **[Raspberry Pi 5 image workflow](https://github.com/alvaroassis/nexus/actions/workflows/nexus-image.yml)**
- **[Product vision and scope](NEXUS.md)**

The product is an alpha for hardware testing. A successful image build does not certify a particular touchscreen, radio adapter, or physical installation. Nexus uses Raspberry Pi OS + Home Assistant Container for the same-device kiosk, and preserves native Home Assistant authentication and advanced settings.

## Upstream frontend

This repository is a fork of `home-assistant/frontend`; the original source history, license and notices remain intact. The standalone deployable Nexus panel and image builder are in `product/`.

---

# Home Assistant Frontend

Upstream is the repository for the official [Home Assistant](https://home-assistant.io) frontend.

[![Screenshot of the frontend](https://raw.githubusercontent.com/home-assistant/frontend/master/docs/screenshot.png)](https://demo.home-assistant.io/)

- [View demo of Home Assistant](https://demo.home-assistant.io/)
- [More information about Home Assistant](https://home-assistant.io)
- [Frontend development instructions](https://contributors.home-assistant.io/frontend/development/)

## Development

- Initial setup: `script/setup`
- Development: [Instructions](https://contributors.home-assistant.io/frontend/development/)
- Production build: `pnpm build`
- Gallery: `cd gallery && script/develop_gallery`

## Frontend development

### Classic environment

A complete guide can be found at the following [link](https://www.home-assistant.io/developers/frontend/). It describes a short guide for the build of project.

## License

Home Assistant is open-source and Apache 2 licensed. Feel free to browse the repository, learn and reuse parts in your own projects.

We use [BrowserStack](https://www.browserstack.com) to test Home Assistant on a large variety of devices.

[![Home Assistant - A project from the Open Home Foundation](https://www.openhomefoundation.org/badges/home-assistant.png)](https://www.openhomefoundation.org/)
