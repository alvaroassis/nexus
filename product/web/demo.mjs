// SPDX-License-Identifier: Apache-2.0
// Explicit mock adapter for visual review. Never imported by the production panel.
import "./nexus-panel.mjs";
const panel = document.querySelector("nexus-panel");
const params = new URLSearchParams(location.search);
const areaNames = {
  living: "Sala de estar",
  kitchen: "Cozinha",
  bedroom: "Quarto",
  garden: "Jardim",
};
const samples = [
  ["light.living", "Luz da sala", "on", "living"],
  ["light.kitchen", "Bancada da cozinha", "off", "kitchen"],
  [
    "climate.living",
    "Climatização",
    "cool",
    "living",
    { current_temperature: 23, temperature: 22 },
  ],
  ["cover.bedroom", "Cortinas do quarto", "open", "bedroom"],
  [
    "sensor.garden",
    "Temperatura externa",
    "26",
    "garden",
    { unit_of_measurement: "°C" },
  ],
  ["switch.garden", "Iluminação do jardim", "off", "garden"],
  ["light.bedroom", "Luminária de leitura", "on", "bedroom"],
  ["binary_sensor.front", "Porta de entrada", "off", "living"],
  ["media_player.living", "Som da sala", "unavailable", "living"],
  ["scene.evening", "Fim de tarde", "scening", "living"],
  ["scene.goodnight", "Boa noite", "scening", "bedroom"],
];
let preferences = {
  version: 1,
  setup: !params.has("setup"),
  theme: "light",
  language: ["en", "pt", "es"].includes(params.get("lang"))
    ? params.get("lang")
    : "en",
  favorites: [
    "light.living",
    "climate.living",
    "light.kitchen",
    "cover.bedroom",
    "sensor.garden",
    "switch.garden",
  ],
};
let hass = {
  connected: !params.has("offline"),
  user: { id: "demo-user", name: "Álvaro", is_admin: !params.has("nonadmin") },
  config: {
    location_name: "Casa Aurora",
    components: params.has("container") ? [] : ["hassio"],
  },
  states: params.has("empty")
    ? {}
    : Object.fromEntries(
        samples.map(([id, name, state, , attributes]) => [
          id,
          {
            entity_id: id,
            state,
            attributes: { friendly_name: name, ...attributes },
          },
        ])
      ),
  formatEntityState(entity) {
    return entity.attributes.unit_of_measurement
      ? `${entity.state} ${entity.attributes.unit_of_measurement}`
      : entity.state;
  },
  async callWS(request) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (params.has("fail")) throw new Error("demo_failure");
    switch (request.type) {
      case "frontend/get_user_data":
        return { value: structuredClone(preferences) };
      case "frontend/set_user_data":
        preferences = structuredClone(request.value);
        return;
      case "config/area_registry/list":
        return Object.entries(areaNames).map(([area_id, name]) => ({
          area_id,
          name,
        }));
      case "config/entity_registry/list":
        return samples.map(([entity_id, , , area_id]) => ({
          entity_id,
          area_id,
        }));
      case "config/device_registry/list":
        return [];
      case "config/core/update":
        hass = {
          ...hass,
          config: { ...hass.config, location_name: request.location_name },
        };
        panel.hass = hass;
        return;
      case "supervisor/api":
        if (request.endpoint.endsWith("accesspoints"))
          return {
            accesspoints: [
              { ssid: "Aurora Home", signal: 95 },
              { ssid: "Aurora Guest", signal: 70 },
            ],
          };
        if (request.endpoint.endsWith("update")) return;
        return {
          interfaces: [
            { interface: "eth0", type: "ethernet", connected: true },
            ...(!params.has("no-wifi")
              ? [{ interface: "wlan0", type: "wireless", connected: false }]
              : []),
          ],
          host_internet: true,
        };
      default:
        throw new Error("Unsupported demo request");
    }
  },
  async callService(domain, service, data) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (params.has("action-fail")) throw new Error("demo_failure");
    if (domain !== "scene") {
      const entity = hass.states[data.entity_id];
      hass = {
        ...hass,
        states: {
          ...hass.states,
          [data.entity_id]: {
            ...entity,
            state: service === "turn_on" ? "on" : "off",
          },
        },
      };
      panel.hass = hass;
    }
  },
};
panel.hass = hass;
