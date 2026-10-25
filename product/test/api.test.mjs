import test from "node:test";
import assert from "node:assert/strict";
import { NexusAPI, withTimeout } from "../web/api.mjs";
function fixture(overrides = {}) {
  const calls = [];
  const hass = {
    connected: true,
    user: { is_admin: true },
    config: { components: ["hassio"] },
    states: { "light.a": { entity_id: "light.a", state: "off" } },
    callWS: async (request) => {
      calls.push(request);
      return request.type === "frontend/get_user_data"
        ? { value: null }
        : { interfaces: [{ interface: "wlan0", type: "wireless" }] };
    },
    callService: async (...args) => calls.push(args),
    ...overrides,
  };
  return { api: new NexusAPI(() => hass), calls, hass };
}
test("non-admin cannot write home or network settings", async () => {
  const { api, calls } = fixture({ user: { is_admin: false } });
  await assert.rejects(api.home("Home"), /adminOnly/);
  await assert.rejects(
    api.connectWifi("wlan0", "Home", "12345678", "wpa-psk"),
    /adminOnly/
  );
  assert.equal(calls.length, 0);
});
test("disconnected clients cannot send commands", async () => {
  const { api, calls } = fixture({ connected: false });
  await assert.rejects(api.control("light.a"), /offline/);
  assert.equal(calls.length, 0);
});
test("container deployments do not pretend to support Supervisor networking", async () => {
  const { api, calls } = fixture({ config: { components: [] } });
  await assert.rejects(api.network(), /networkUnsupported/);
  assert.equal(calls.length, 0);
});
test("home name is persisted through the real config endpoint", async () => {
  const { api, calls } = fixture();
  await api.home(" Aurora ");
  assert.deepEqual(calls, [
    { type: "config/core/update", location_name: "Aurora" },
  ]);
});
test("unsupported network interface is rejected before mutation", async () => {
  const { api, calls } = fixture();
  await assert.rejects(
    api.connectWifi("eth0", "Home", "12345678", "wpa-psk"),
    /noWifi/
  );
  assert.equal(
    calls.some((c) => c.method === "post"),
    false
  );
});
test("network update is followed by a fresh status read", async () => {
  const { api, calls } = fixture();
  await api.connectWifi("wlan0", "Home", "12345678", "wpa-psk");
  assert.deepEqual(
    calls.map((c) => c.endpoint),
    ["/network/info", "/network/interface/wlan0/update", "/network/info"]
  );
  assert.equal(calls[1].data.wifi.psk, "12345678");
});
test("service errors propagate without fabricated success", async () => {
  const { api } = fixture({
    callService: async () => {
      throw new Error("denied");
    },
  });
  await assert.rejects(api.control("light.a"), /denied/);
});
test("preferences use server-side user storage and strip extra fields", async () => {
  const { api, calls } = fixture();
  await api.savePreferences({ setup: true, token: "secret", favorites: [] });
  assert.equal(calls[0].type, "frontend/set_user_data");
  assert.equal(calls[0].key, "nexus");
  assert.equal("token" in calls[0].value, false);
});
test("lost network responses time out with an indeterminate outcome", async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 5), /networkPending/);
  assert.equal(await withTimeout(Promise.resolve("ok"), 50), "ok");
});
