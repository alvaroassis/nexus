// SPDX-License-Identifier: Apache-2.0
import { normalizePreferences, serviceFor, validateHomeName, wifiOptions } from "./model.mjs";

// The custom-panel host supplies the authenticated hass object. No separate tokens.
export class NexusAPI {
  constructor(getHass) { this.getHass = getHass; }
  get hass() { const hass = this.getHass(); if (!hass?.connected) throw new Error("offline"); return hass; }
  admin() { if (!this.hass.user?.is_admin) throw new Error("adminOnly"); }
  async preferences() {
    const result = await this.hass.callWS({ type: "frontend/get_user_data", key: "nexus" });
    return normalizePreferences(result.value || {language: this.hass.language?.split("-")[0] || "en"});
  }
  async savePreferences(value) {
    const preferences = normalizePreferences(value);
    await this.hass.callWS({ type: "frontend/set_user_data", key: "nexus", value: preferences });
    return preferences;
  }
  async registries() {
    const hass = this.hass;
    const [areas, entities, devices] = await Promise.all([
      hass.callWS({ type: "config/area_registry/list" }),
      hass.callWS({ type: "config/entity_registry/list" }),
      hass.callWS({ type: "config/device_registry/list" }),
    ]);
    return { areas, entities, devices };
  }
  async home(name) { this.admin(); await this.hass.callWS({ type: "config/core/update", location_name: validateHomeName(name) }); }
  async control(id) {
    const hass = this.hass;
    const action = serviceFor(hass.states[id]);
    await hass.callService(action.domain, action.service, action.data);
  }
  async network() {
    this.admin();
    if (!this.hass.config.components.includes("hassio")) throw new Error("networkUnsupported");
    return this.hass.callWS({ type: "supervisor/api", endpoint: "/network/info", method: "get" });
  }
  async scan(iface) {
    this.admin();
    const info = await this.network();
    if (!info.interfaces.some((item) => item.interface === iface && item.type === "wireless")) throw new Error("noWifi");
    return this.hass.callWS({ type: "supervisor/api", endpoint: `/network/interface/${encodeURIComponent(iface)}/accesspoints`, method: "get", timeout: null });
  }
  async connectWifi(iface, ssid, password, auth) {
    this.admin();
    const options = wifiOptions(ssid, password, auth);
    const info = await this.network();
    if (!info.interfaces.some((item) => item.interface === iface && item.type === "wireless")) throw new Error("noWifi");
    // Never persist the PSK. Do not assume a returned command means connectivity.
    await this.hass.callWS({ type: "supervisor/api", endpoint: `/network/interface/${encodeURIComponent(iface)}/update`, method: "post", data: options, timeout: null });
    return this.network();
  }
}
