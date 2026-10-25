// Runs only against a disposable loopback Home Assistant CI container.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { NexusAPI } from "../web/api.mjs";
const origin = "http://127.0.0.1:18123";
const client_id = origin + "/";
const response = await fetch(origin + "/api/onboarding/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Nexus CI",
    username: "nexus_ci",
    password: randomBytes(24).toString("hex"),
    client_id,
    language: "en",
  }),
});
assert.equal(response.status, 200, "Fresh image must allow owner onboarding");
const { auth_code } = await response.json();
const tokenResponse = await fetch(origin + "/auth/token", {
  method: "POST",
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: auth_code,
    client_id,
  }),
});
assert.equal(tokenResponse.status, 200);
const { access_token } = await tokenResponse.json();
const socket = new WebSocket("ws://127.0.0.1:18123/api/websocket");
let nextId = 0;
const pending = new Map();
const authenticated = new Promise((resolve, reject) => {
  socket.addEventListener("error", () => reject(new Error("WebSocket failed")));
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.type === "auth_required")
      socket.send(JSON.stringify({ type: "auth", access_token }));
    else if (message.type === "auth_ok") resolve();
    else if (message.type === "auth_invalid")
      reject(new Error("Authentication failed"));
    else if (message.type === "result") {
      const item = pending.get(message.id);
      if (item) {
        pending.delete(message.id);
        clearTimeout(item.timer);
        message.success
          ? item.resolve(message.result)
          : item.reject(new Error(message.error?.code));
      }
    }
  });
});
const callWS = (request) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("WebSocket request timed out"));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ ...request, id }));
  });
try {
  await authenticated;
  const user = await callWS({ type: "auth/current_user" });
  const config = await callWS({ type: "get_config" });
  const api = new NexusAPI(() => ({
    connected: true,
    user,
    config,
    language: "en",
    callWS,
  }));
  assert.equal((await api.preferences()).language, "en");
  await api.savePreferences({
    setup: true,
    language: "es",
    theme: "dark",
    favorites: ["light.example"],
  });
  assert.equal((await api.preferences()).language, "es");
  await api.home("Nexus verified home");
  assert.equal(
    (await callWS({ type: "get_config" })).location_name,
    "Nexus verified home"
  );
  const registries = await api.registries();
  assert.ok(registries.areas.length > 0);
  await assert.rejects(api.network(), /networkUnsupported/);
  for (const file of [
    "nexus-panel.mjs",
    "api.mjs",
    "model.mjs",
    "strings.mjs",
    "styles.mjs",
    "start.html",
  ]) {
    const result = await fetch(origin + "/local/nexus/" + file);
    assert.equal(result.status, 200, file);
  }
  const panels = await callWS({ type: "get_panels" });
  assert.ok(panels.nexus, "Custom Nexus panel must be registered");
  process.stdout.write(
    "Real Home Assistant smoke passed: owner onboarding, token exchange, WebSocket, persisted preferences, home name, registries, panel registration and assets.\n"
  );
} finally {
  socket.close();
  for (const item of pending.values()) clearTimeout(item.timer);
}
