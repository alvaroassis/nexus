// SPDX-License-Identifier: Apache-2.0
import { NexusAPI } from "./api.mjs";
import { domainOf, escapeHTML as esc, normalizePreferences, resolveArea, unavailable, uniqueAccessPoints, visibleEntities } from "./model.mjs";
import { translate } from "./strings.mjs";
import { styles } from "./styles.mjs";

const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  rooms: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  devices: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
  scenes: '<path d="m12 2-2 7-7 3 7 2 2 8 3-8 7-2-7-3z"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  light: '<path d="M9 18h6m-5 3h4M8 13a6 6 0 1 1 8 0l-1 3H9z"/>',
  switch: '<path d="M12 2v9m-5-7a9 9 0 1 0 10 0"/>',
  climate: '<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 8v10"/>',
  sensor: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  cover: '<path d="M4 3h16v17H4zm0 4h16M4 11h16M4 15h16M12 20v2"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0"/><circle cx="12" cy="20" r="1"/>',
  ethernet: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v5m5-5v5m5-5v5M9 19v3h6v-3"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.devices}</svg>`;

export class NexusPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:"open"});
    this.api = new NexusAPI(() => this._hass);
    this.preferences = normalizePreferences(null);
    this.registry = { areas: [], entities: [], devices: [] };
    this.page = "home";
    this.area = "";
    this.search = "";
    this.step = null;
    this.busy = new Set();
    this.error = "";
    this.message = "";
    this.loaded = false;
    this.loading = false;
    this.networkInfo = null;
    this.networkError = "";
    this.accessPoints = [];
    this.networkChangePending = false;
    this._onClick = (event) => this.click(event);
    this._onSubmit = (event) => this.submit(event);
    this._onChange = (event) => this.change(event);
  }
  set hass(value) {
    const previous = this._hass;
    this._hass = value;
    if (previous?.user?.id && previous.user.id !== value?.user?.id) {
      this.loaded = false; this.loading = false; this.preferences = normalizePreferences(null);
      this.registry = {areas:[],entities:[],devices:[]}; this.step = null; this._generation = (this._generation || 0) + 1;
    }
    if (this.isConnected && !this.loaded && !this.loading && value?.connected) void this.initialize();
    if (!this.shadowRoot.activeElement?.matches("input,select") && this.step === null) this.queueRender();
  }
  get hass() { return this._hass; }
  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._onClick);
    this.shadowRoot.addEventListener("submit", this._onSubmit);
    this.shadowRoot.addEventListener("change", this._onChange);
    if (this._hass?.connected && !this.loaded) void this.initialize();
    this.render();
  }
  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._onClick);
    this.shadowRoot.removeEventListener("submit", this._onSubmit);
    this.shadowRoot.removeEventListener("change", this._onChange);
    this._generation = (this._generation || 0) + 1;
    this.loading = false;
  }
  t(key) { return translate(this.preferences.language, key); }
  get admin() { return !!this._hass?.user?.is_admin; }
  get demo() { return this.hasAttribute("demo"); }
  queueRender() {
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => { this._queued = false; if (this.isConnected) this.render(); });
  }
  async initialize() {
    if (this.loading) return;
    this.loading = true; this.error = ""; this.render();
    const generation = this._generation || 0;
    try {
      const preferences = await this.api.preferences();
      if (!this.isConnected || generation !== (this._generation || 0)) return;
      this.preferences = preferences;
      this.loaded = true;
      this.step = preferences.setup ? null : 0;
      await this.loadRegistry();
    } catch { this.error = "preferencesError"; }
    finally { this.loading = false; if (this.isConnected) this.render(); }
  }
  async loadRegistry() {
    const generation = this._generation || 0;
    try {
      const registry = await this.api.registries();
      if (generation === (this._generation || 0) && this.isConnected) { this.registry = registry; this.registryError = false; }
    } catch { this.registryError = true; }
  }
  async run(key, action) {
    if (this.busy.has(key)) return;
    this.busy.add(key); this.error = ""; this.message = ""; this.render();
    try { await action(); }
    catch (error) { this.error = ["invalidName", "invalidWifi", "noWifi", "adminOnly", "offline", "networkUnsupported"].includes(error?.message) ? error.message : "actionFailed"; }
    finally { this.busy.delete(key); if (this.isConnected) this.render(); }
  }
  button(action, label, className = "secondary", extra = "") {
    return `<button type="button" class="${className}" data-action="${action}" ${extra}>${this.t(label)}</button>`;
  }
  link(path, label) { return `<a class="secondary" href="${path}" data-ha-link>${this.t(label)}</a>`; }
  render() {
    const focused = this.shadowRoot.activeElement;
    const focusId = focused?.id;
    const cursor = focused?.selectionStart;
    this.setAttribute("theme", this.preferences.theme);
    this.setAttribute("lang", this.preferences.language === "pt" ? "pt-BR" : this.preferences.language);
    const state = this._hass?.connected ? "online" : "offline";
    const nav = ["home", "rooms", "devices", "scenes", "settings"].map((page) => `<button id="nav-${page}" class="nav ${this.page === page && this.step === null ? "active" : ""}" data-page="${page}" aria-label="${this.t(page)}" ${this.page === page ? 'aria-current="page"' : ""}>${icon(page)}<span>${this.t(page)}</span></button>`).join("");
    const content = !this.loaded ? `<div class="empty"><h2>${this.t(this.error || "loading")}</h2>${this.button("retry","retry")}</div>` : this.step !== null ? this.wizard() : this.dashboard();
    this.shadowRoot.innerHTML = `<style>${styles}</style>${this.demo ? `<div class="demo">${this.t("demo")}</div>` : ""}<div class="shell"><nav class="rail" aria-label="${this.t("menu")}"><div class="brand">nexus<span class="brand-dot">.</span></div>${nav}<div class="rail-end">${icon("home")}</div></nav><main class="main"><header class="topbar"><span class="wordmark">NEXUS / ${esc(this._hass?.config?.location_name || this.t("newHome"))}</span><span class="status"><span class="dot"></span>${this.t(state)}</span></header>${this.error && this.loaded ? `<div role="alert" class="notice error">${this.t(this.error)}</div>` : ""}${this.message ? `<div role="status" class="notice">${this.t(this.message)}</div>` : ""}${this.registryError ? `<div role="status" class="notice">${this.t("registryError")}</div>` : ""}${content}<footer>${this.t("version")} · ${this.t(this.demo ? "demoHelp" : "session")}</footer></main></div>`;
    if (focusId) {
      const target = this.shadowRoot.getElementById(focusId);
      target?.focus({preventScroll:true});
      if (typeof cursor === "number" && target?.type === "search") target.setSelectionRange(cursor, cursor);
    }
  }
  entities() { return visibleEntities(this._hass?.states, this.registry.entities); }
  room(id) { return resolveArea(id, this.registry.entities, this.registry.devices); }
  dashboard() {
    if (this.page === "settings") return this.settings();
    const entities = this.entities();
    if (this.page === "rooms") return `<h1>${this.t("rooms")}</h1><div class="section-head"><p>${this.t("subtitle")}</p>${this.button("refresh","refresh")}</div><div class="room-grid">${this.registry.areas.map((area) => `<button class="room-card" data-room="${esc(area.area_id)}">${icon("home")}<strong>${esc(area.name)}</strong><span class="muted">${entities.filter((item) => this.room(item.entity_id) === area.area_id).length} ${this.t("devices").toLowerCase()}</span></button>`).join("") || this.empty("emptyHelp")}</div>`;
    let list = entities.filter((item) => this.page === "scenes" ? domainOf(item.entity_id) === "scene" : domainOf(item.entity_id) !== "scene");
    if (this.page === "home") list = list.filter((item) => this.preferences.favorites.includes(item.entity_id));
    if (this.area) list = list.filter((item) => this.room(item.entity_id) === this.area);
    if (this.search) list = list.filter((item) => `${item.entity_id} ${item.attributes.friendly_name || ""}`.toLocaleLowerCase().includes(this.search.toLocaleLowerCase()));
    const hero = this.page === "home" ? `<section class="hero"><div class="hero-copy"><span class="eyebrow">${this.t("greeting")}</span><h1>${esc(this._hass.config.location_name)}</h1><p>${this.t("subtitle")}</p></div><div class="house-art">${icon("home")}</div></section><div class="stats"><div class="stat">${icon("light")}<div><strong>${entities.filter((item) => domainOf(item.entity_id) === "light" && item.state === "on").length}</strong><span>${this.t("lightsOn")}</span></div></div><div class="stat">${icon("rooms")}<div><strong>${this.registry.areas.length}</strong><span>${this.t("roomCount")}</span></div></div><div class="stat">${icon("devices")}<div><strong>${entities.filter((item) => !unavailable(item)).length}</strong><span>${this.t("connectedDevices")}</span></div></div></div>` : `<h1>${this.t(this.page)}</h1>`;
    return `${hero}<div class="section-head"><h2>${this.t(this.page === "home" ? "favorites" : "ready")}</h2>${this.page === "home" ? this.button("viewAll","viewAll","text-link") : `<form id="search-form"><input id="search" name="search" type="search" aria-label="${this.t("search")}" placeholder="${this.t("search")}" value="${esc(this.search)}"></form>`}</div><div class="filters"><button class="pill ${!this.area ? "active" : ""}" data-filter="">${this.t("all")}</button>${this.registry.areas.map((area) => `<button class="pill ${this.area === area.area_id ? "active" : ""}" data-filter="${esc(area.area_id)}">${esc(area.name)}</button>`).join("")}</div><div class="grid">${list.map((entity) => this.card(entity)).join("") || this.empty(this.page === "home" ? "noFavorites" : this.page === "scenes" ? "noScenes" : "emptyHelp")}</div>`;
  }
  empty(help) { return `<div class="empty"><h3>${this.t("empty")}</h3><p>${this.t(help)}</p>${this.admin ? this.link("/config/integrations", "integrations") : ""}</div>`; }
  card(entity) {
    const domain = domainOf(entity.entity_id);
    const favorite = this.preferences.favorites.includes(entity.entity_id);
    const pending = this.busy.has(entity.entity_id);
    const disabled = unavailable(entity) || !this._hass.connected || pending;
    const name = entity.attributes.friendly_name || entity.entity_id;
    const state = ["on","off","unknown","unavailable"].includes(entity.state) ? this.t(entity.state) : this._hass.formatEntityState?.(entity) || entity.state;
    const room = this.registry.areas.find((area) => area.area_id === this.room(entity.entity_id));
    let control = `<button class="icon-button" data-details="${esc(entity.entity_id)}" aria-label="${this.t("details")}: ${esc(name)}">${icon("settings")}</button>`;
    if (["light","switch","fan"].includes(domain) && ["on","off"].includes(entity.state)) control = `<button id="control-${esc(entity.entity_id)}" class="toggle" role="switch" aria-checked="${entity.state === "on"}" aria-label="${esc(name)}" data-control="${esc(entity.entity_id)}" ${disabled ? "disabled" : ""}><span class="toggle-track"><span class="toggle-knob"></span></span></button>`;
    if (domain === "scene") control = `<button class="secondary" data-control="${esc(entity.entity_id)}" ${disabled ? "disabled" : ""}>${this.t("activate")}</button>`;
    return `<article class="device ${entity.state === "on" ? "on" : ""}" aria-busy="${pending}"><div class="device-top"><span class="device-icon">${icon(domain === "scene" ? "scenes" : domain)}</span><button id="star-${esc(entity.entity_id)}" class="star ${favorite ? "selected" : ""}" aria-label="${this.t(favorite ? "unfavorite" : "favorite")}: ${esc(name)}" aria-pressed="${favorite}" data-favorite="${esc(entity.entity_id)}" ${this.busy.has("preferences") ? "disabled" : ""}>${favorite ? "★" : "☆"}</button></div><h3>${esc(name)}</h3><small>${esc(room?.name || this.t("currentHome"))}</small><div class="device-footer"><span>${pending ? this.t("pending") : esc(state)}</span>${control}</div></article>`;
  }
  settings() {
    return `<h1>${this.t("settings")}</h1><div class="section-head"><p>${this.t("configure")}</p>${this.button("setup","setup")}</div><div class="settings"><section class="settings-card"><h2>${this.t("appearance")}</h2><form id="preferences-form" class="form"><label>${this.t("appearance")}<select name="theme">${["auto","light","dark"].map((mode) => `<option value="${mode}" ${this.preferences.theme === mode ? "selected" : ""}>${this.t(mode)}</option>`).join("")}</select></label><label>${this.t("language")}<select name="language"><option value="en" ${this.preferences.language === "en" ? "selected" : ""}>English</option><option value="pt" ${this.preferences.language === "pt" ? "selected" : ""}>Português</option><option value="es" ${this.preferences.language === "es" ? "selected" : ""}>Español</option></select></label><button class="primary" ${this.busy.has("preferences") ? "disabled" : ""}>${this.t("save")}</button></form></section><section class="settings-card"><h2>${this.t("account")}</h2><p>${this.t("owner")} <strong>${esc(this._hass.user?.name)}</strong></p>${this.link("/profile","profile")}<p>${this.t("accountHelp")}</p></section>${this.admin ? `<section class="settings-card"><h2>${this.t("adminSettings")}</h2>${this.link("/config/integrations","integrations")}${this.link("/config/automation/dashboard","automations")}${this.link("/config/scene/dashboard","scenes")}${this.link("/config/users","users")}${this.link("/config/backup/overview","backups")}${this.link("/config/updates","updates")}${this.button("network","network")}</section><section class="settings-card"><h2>${this.t("homeName")}</h2>${this.nameForm(false)}${this.link("/config","advanced")}</section>` : ""}</div>`;
  }
  nameForm(wizard) {
    return `<form id="home-form" class="form" data-wizard="${wizard}"><label>${this.t("homeName")}<input id="home-name" name="home" required maxlength="80" autocomplete="off" value="${esc(this._hass.config.location_name)}" ${!this.admin ? "disabled" : ""}></label>${this.admin ? `<button class="primary" ${this.busy.has("home") ? "disabled" : ""}>${this.t(wizard ? "next" : "save")}</button>` : `<p>${this.t("adminOnly")}</p>${wizard ? this.button("next","next","primary") : ""}`}</form>`;
  }
  wizard() {
    const headings = ["welcome", "account", "name", "network", "discover"];
    let body = "";
    if (this.step === 0) body = `${this.languagePicker()}<div class="house-art">${icon("home")}</div><p>${this.t("subtitle")}</p>${this.button("next","begin","primary")}`;
    if (this.step === 1) body = `<p>${this.t("accountHelp")}</p><div class="notice">${this.t("owner")} <strong>${esc(this._hass.user?.name)}</strong></div>${this.button("next","next","primary")}`;
    if (this.step === 2) body = `<p>${this.t("nameHelp")}</p>${this.nameForm(true)}`;
    if (this.step === 3) body = `${this.networkView()}${this.button("next","skipNetwork","primary")}`;
    if (this.step === 4) body = `<p>${this.t("discoverHelp")}</p><span class="badge">${this.entities().length} ${this.t("devices")}</span><div class="actions">${this.admin ? this.link("/config/integrations","integrations") : ""}${this.button("finish","finish","primary",this.busy.has("preferences") ? "disabled" : "")}</div>`;
    return `<section class="wizard"><div class="steps" role="progressbar" aria-label="${this.t("setupProgress")}" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${this.step + 1}">${headings.map((_, index) => `<span class="step ${index <= this.step ? "done" : ""}"></span>`).join("")}</div><div class="wizard-card"><span class="eyebrow">NEXUS · ${this.step + 1} / 5</span><h1>${this.t(headings[this.step])}</h1>${body}${this.step > 0 ? this.button("back","back","text-link") : ""}</div></section>`;
  }
  networkView() {
    if (!this.admin) return `<p>${this.t("adminOnly")}</p>`;
    const wifi = this.networkInfo?.interfaces.filter((item) => item.type === "wireless") || [];
    return `<p>${this.t("networkHelp")}</p>${!this.demo && ["localhost","127.0.0.1"].includes(location.hostname) ? `<a class="primary" href="http://127.0.0.1:8099/?network=1">${this.t("network")}</a>` : ""}${this.networkError ? `<div class="notice">${this.t(this.networkError)}</div>` : ""}${this.networkInfo ? `${this.networkInfo.interfaces.map((item) => `<div class="network-row"><span>${icon(item.type === "wireless" ? "wifi" : "ethernet")} ${esc(item.interface)} ${esc(item.wifi?.ssid || "")}</span><span class="badge">${this.t(item.connected ? "connected" : "disconnected")}</span></div>`).join("")}<div class="network-row"><span>${this.t("internet")}</span><span>${this.t(this.networkInfo.host_internet === true ? "connected" : this.networkInfo.host_internet === false ? "disconnected" : "notChecked")}</span></div>${!wifi.length ? `<p>${this.t("noWifi")}</p>` : ""}` : ""}${this.button("network-refresh","verify","secondary",this.busy.has("network") ? "disabled" : "")}${wifi.length ? `<form id="wifi-form" class="form network-form"><label>${this.t("wifi")}<select id="wifi-interface" name="interface">${wifi.map((item) => `<option value="${esc(item.interface)}">${esc(item.interface)}</option>`).join("")}</select></label>${this.button("scan","scan","secondary",this.busy.has("scan") ? "disabled" : "")}<label>${this.t("ssid")}<input name="ssid" id="ssid" list="networks" required maxlength="32" autocomplete="off"><datalist id="networks">${this.accessPoints.map((point) => `<option value="${esc(point.ssid)}"></option>`).join("")}</datalist></label><label>${this.t("security")}<select name="auth"><option value="wpa-psk">${this.t("wpa")}</option><option value="open">${this.t("open")}</option></select></label><label>${this.t("password")}<input name="password" id="wifi-password" type="password" autocomplete="off" maxlength="64"></label><p>${this.t("networkWarning")}</p><button class="primary" ${this.networkChangePending || this.busy.has("join") ? "disabled" : ""}>${this.t("join")}</button></form>` : ""}`;
  }
  async refreshNetwork() {
    this.networkError = "";
    try { this.networkInfo = await this.api.network(); this.networkChangePending = false; }
    catch (error) { this.networkError = ["adminOnly","networkUnsupported","offline"].includes(error?.message) ? error.message : "actionFailed"; }
  }
  async click(event) {
    const target = event.target.closest("button,a");
    if (!target || target.disabled) return;
    if (target.hasAttribute("data-ha-link")) {
      if (this.demo) { event.preventDefault(); this.message = "demoLink"; this.render(); }
      return;
    }
    if (target.dataset.page) { this.page = target.dataset.page; this.step = null; this.area = ""; this.search = ""; this.error = ""; this.message = ""; this.render(); return; }
    if (target.hasAttribute("data-filter")) { this.area = target.dataset.filter; this.render(); return; }
    if (target.dataset.room) { this.area = target.dataset.room; this.page = "devices"; this.render(); return; }
    if (target.dataset.favorite) {
      const id = target.dataset.favorite;
      await this.run("preferences", async () => {
        const favorites = this.preferences.favorites.includes(id) ? this.preferences.favorites.filter((item) => item !== id) : [...this.preferences.favorites, id];
        this.preferences = await this.api.savePreferences({...this.preferences, favorites});
      }); return;
    }
    if (target.dataset.control) {
      const id = target.dataset.control;
      if (domainOf(id) === "scene" && !window.confirm(this.t("sceneWarning"))) return;
      await this.run(id, async () => { await this.api.control(id); this.message = "commandSent"; }); return;
    }
    if (target.dataset.details) {
      if (this.demo) { this.message = "demoLink"; this.render(); }
      else this.dispatchEvent(new CustomEvent("hass-more-info", {detail:{entityId:target.dataset.details},bubbles:true,composed:true}));
      return;
    }
    const action = target.dataset.action;
    if (action === "retry") { await this.initialize(); return; }
    if (action === "viewAll") { this.page = "devices"; this.area = ""; this.search = ""; }
    if (action === "setup") this.step = 0;
    if (action === "back") this.step = Math.max(0, this.step - 1);
    if (action === "next") { if (this.step === 0) { await this.run("preferences", async () => { this.preferences = await this.api.savePreferences(this.preferences); }); if (this.error) return; } this.step = Math.min(4, this.step + 1); if (this.step === 3) await this.run("network", () => this.refreshNetwork()); }
    if (action === "finish") { await this.run("preferences", async () => { this.preferences = await this.api.savePreferences({...this.preferences,setup:true}); this.step = null; this.page = "home"; this.message = "complete"; }); return; }
    if (action === "refresh") { await this.run("registry", () => this.loadRegistry()); return; }
    if (action === "network") { this.step = 3; await this.run("network", () => this.refreshNetwork()); return; }
    if (action === "network-refresh") { await this.run("network", () => this.refreshNetwork()); return; }
    if (action === "scan") {
      const iface = this.shadowRoot.getElementById("wifi-interface")?.value;
      await this.run("scan", async () => { this.accessPoints = uniqueAccessPoints((await this.api.scan(iface)).accesspoints); }); return;
    }
    this.render();
  }
  languagePicker() { return `<label>${this.t("language")}<select id="initial-language" aria-label="${this.t("language")}">${[["en","English"],["pt","Português"],["es","Español"]].map(([code,label]) => `<option value="${code}" ${this.preferences.language === code ? "selected" : ""}>${label}</option>`).join("")}</select></label>`; }
  change(event) {
    if (event.target.id === "initial-language") { this.preferences = {...this.preferences,language:event.target.value}; this.render(); }
    if (event.target.id === "search") { this.search = event.target.value; this.render(); }
  }
  async submit(event) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    if (form.id === "search-form") { this.search = String(data.get("search") || ""); this.render(); }
    if (form.id === "home-form") {
      const name = String(data.get("home") || "");
      const wizard = form.dataset.wizard === "true";
      await this.run("home", async () => { await this.api.home(name); this.message = "saved"; if (wizard) { this.step = 3; await this.refreshNetwork(); } });
    }
    if (form.id === "preferences-form") await this.run("preferences", async () => {
      this.preferences = await this.api.savePreferences({...this.preferences, theme: data.get("theme"), language:data.get("language")}); this.message = "saved";
    });
    if (form.id === "wifi-form") {
      if (!window.confirm(this.t("networkWarning"))) return;
      const password = String(data.get("password") || "");
      form.reset();
      await this.run("join", async () => {
        this.networkChangePending = true;
        this.message = "networkPending";
        this.networkInfo = await this.api.connectWifi(String(data.get("interface")),String(data.get("ssid")),password,String(data.get("auth")));
        this.networkChangePending = false;
      });
    }
  }
}
if (!customElements.get("nexus-panel")) customElements.define("nexus-panel", NexusPanel);
