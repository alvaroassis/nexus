// SPDX-License-Identifier: Apache-2.0
export const domains = new Set(["light", "switch", "fan", "climate", "cover", "sensor", "binary_sensor", "lock", "media_player", "scene"]);
export const domainOf = (id) => String(id).split(".")[0];
export const unavailable = (entity) => !entity || ["unavailable", "unknown"].includes(entity.state);
export const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
export function normalizePreferences(value) {
  return {
    version: 1,
    setup: value?.setup === true,
    favorites: Array.isArray(value?.favorites) ? [...new Set(value.favorites.filter((id) => typeof id === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(id)))].slice(0, 100) : [],
    theme: ["light", "dark", "auto"].includes(value?.theme) ? value.theme : "auto",
    language: ["en", "pt", "es"].includes(value?.language) ? value.language : "en",
  };
}
export function resolveArea(entityId, entities, devices) {
  const entry = entities.find((item) => item.entity_id === entityId);
  return entry?.area_id || devices.find((device) => device.id === entry?.device_id)?.area_id || "";
}
export function visibleEntities(states, registry = []) {
  const hidden = new Set(registry.filter((entry) => entry.hidden_by || entry.disabled_by).map((entry) => entry.entity_id));
  return Object.values(states || {}).filter((entity) => domains.has(domainOf(entity.entity_id)) && !hidden.has(entity.entity_id))
    .sort((a, b) => String(a.attributes?.friendly_name || a.entity_id).localeCompare(String(b.attributes?.friendly_name || b.entity_id)));
}
export function serviceFor(entity) {
  if (unavailable(entity)) throw new Error("unavailable");
  const domain = domainOf(entity.entity_id);
  if (["light", "switch", "fan"].includes(domain) && ["on", "off"].includes(entity.state)) {
    return { domain, service: entity.state === "on" ? "turn_off" : "turn_on", data: { entity_id: entity.entity_id } };
  }
  if (domain === "scene") return { domain, service: "turn_on", data: { entity_id: entity.entity_id } };
  throw new Error("unsupported");
}
export function validateHomeName(name) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80 || /[\x00-\x1f]/.test(name)) throw new Error("invalidName");
  return name.trim();
}
export function wifiOptions(ssid, password, auth) {
  if (!ssid || new TextEncoder().encode(ssid).length > 32 || /[\x00-\x1f]/.test(ssid)) throw new Error("invalidWifi");
  if (!["open", "wpa-psk"].includes(auth)) throw new Error("invalidWifi");
  if (auth === "wpa-psk" && !(password.length >= 8 && password.length <= 63) && !/^[a-f0-9]{64}$/i.test(password)) throw new Error("invalidWifi");
  return { enabled: true, ipv4: { method: "auto" }, wifi: { mode: "infrastructure", auth, ssid, ...(auth === "wpa-psk" ? { psk: password } : {}) } };
}
export function uniqueAccessPoints(points) {
  const result = new Map();
  for (const point of points || []) if (point.ssid && (!result.has(point.ssid) || result.get(point.ssid).signal < point.signal)) result.set(point.ssid, point);
  return [...result.values()].sort((a, b) => b.signal - a.signal);
}
