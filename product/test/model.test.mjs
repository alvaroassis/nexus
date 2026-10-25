import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHTML,
  normalizePreferences,
  resolveArea,
  serviceFor,
  uniqueAccessPoints,
  validateHomeName,
  visibleEntities,
  wifiOptions,
} from "../web/model.mjs";
import { strings } from "../web/strings.mjs";
test("backend-provided names cannot inject HTML", () => {
  assert.equal(
    escapeHTML('<img src=x onerror="bad()">&'),
    "&lt;img src=x onerror=&quot;bad()&quot;&gt;&amp;"
  );
});
test("only allowlisted available domains can receive direct actions", () => {
  assert.equal(
    serviceFor({ entity_id: "light.test", state: "on" }).service,
    "turn_off"
  );
  assert.equal(
    serviceFor({ entity_id: "switch.test", state: "off" }).service,
    "turn_on"
  );
  for (const entity of [
    undefined,
    { entity_id: "lock.front", state: "locked" },
    { entity_id: "cover.garage", state: "open" },
    { entity_id: "light.test", state: "unavailable" },
    { entity_id: "fan.test", state: "unknown" },
  ])
    assert.throws(() => serviceFor(entity));
});
test("entity area overrides inherited device area", () => {
  const devices = [{ id: "device", area_id: "living" }];
  assert.equal(
    resolveArea(
      "light.x",
      [{ entity_id: "light.x", device_id: "device", area_id: "kitchen" }],
      devices
    ),
    "kitchen"
  );
  assert.equal(
    resolveArea(
      "light.x",
      [{ entity_id: "light.x", device_id: "device" }],
      devices
    ),
    "living"
  );
  assert.equal(resolveArea("light.y", [], devices), "");
});
test("hidden and disabled entities stay hidden", () => {
  const states = {
    a: { entity_id: "light.a", attributes: {} },
    b: { entity_id: "light.b", attributes: {} },
    c: { entity_id: "light.c", attributes: {} },
    d: { entity_id: "automation.d", attributes: {} },
  };
  assert.deepEqual(
    visibleEntities(states, [
      { entity_id: "light.a", hidden_by: "user" },
      { entity_id: "light.b", disabled_by: "integration" },
    ]).map((e) => e.entity_id),
    ["light.c"]
  );
});
test("untrusted preferences are normalized without credentials", () => {
  assert.deepEqual(
    normalizePreferences({
      setup: "yes",
      favorites: ["light.a", "light.a", 1, "<bad>"],
      password: "secret",
      theme: "evil",
    }),
    {
      version: 1,
      setup: false,
      favorites: ["light.a"],
      theme: "auto",
      language: "en",
    }
  );
});
test("home names require nonempty bounded text", () => {
  assert.equal(validateHomeName("  Aurora  "), "Aurora");
  for (const name of ["", " ", "a".repeat(81), "bad\nname", null])
    assert.throws(() => validateHomeName(name));
});
test("Wi-Fi validates SSID byte length and personal authentication", () => {
  assert.throws(() => wifiOptions("é".repeat(17), "12345678", "wpa-psk"));
  assert.throws(() => wifiOptions("Home", "short", "wpa-psk"));
  assert.throws(() => wifiOptions("Home", "12345678", "wep"));
  assert.equal(wifiOptions("Home", "12345678", "wpa-psk").wifi.psk, "12345678");
  assert.equal(
    wifiOptions("Home", "a".repeat(64), "wpa-psk").wifi.psk.length,
    64
  );
  assert.equal("psk" in wifiOptions("Guest", "ignored", "open").wifi, false);
});
test("access points deduplicate SSIDs by strongest signal", () => {
  assert.deepEqual(
    uniqueAccessPoints([
      { ssid: "Home", signal: 20 },
      { ssid: "Home", signal: 90 },
      { ssid: "", signal: 100 },
      { ssid: "Guest", signal: 30 },
    ]).map((p) => [p.ssid, p.signal]),
    [
      ["Home", 90],
      ["Guest", 30],
    ]
  );
});
test("Portuguese translations cover every English key", () =>
  assert.deepEqual(
    Object.keys(strings.en).sort(),
    Object.keys(strings.pt).sort()
  ));

test("Spanish translations cover every English key", () =>
  assert.deepEqual(
    Object.keys(strings.en).sort(),
    Object.keys(strings.es).sort()
  ));
