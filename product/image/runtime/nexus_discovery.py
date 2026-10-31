"""Local, administrator-only device pairing through the core's config flows."""
import math
import re
import time

CATALOG = {
    "cast": "Google Cast", "samsungtv": "Samsung TV", "webostv": "LG webOS TV",
    "braviatv": "Sony Bravia", "roku": "Roku", "dlna_dmr": "DLNA",
    "sonos": "Sonos", "denonavr": "Denon / Marantz", "onkyo": "Onkyo",
    "shelly": "Shelly", "esphome": "ESPHome", "hue": "Philips Hue",
    "wled": "WLED", "lutron_caseta": "Lutron Caséta", "homekit_controller": "HomeKit Device",
}
SOURCES = {"ssdp", "zeroconf", "dhcp", "discovery", "homekit", "integration_discovery", "bluetooth", "usb", "mqtt", "esphome"}
PAIRS = {}
IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


def title(domain):
    return CATALOG.get(domain, domain.replace("_", " ").title())


def fields_of(schema):
    result = []
    for field in schema or []:
        name = field.get("name", "")
        if not isinstance(name, str) or not IDENTIFIER.fullmatch(name):
            continue
        selector = field.get("selector") or {}
        kind = field.get("type")
        config = {}
        if selector:
            kind = next(iter(selector))
            config = selector[kind] or {}
        if kind in ("integer", "float"):
            kind = "number"
        if kind in ("string", "text"):
            kind = "text"
        if kind not in ("text", "number", "boolean", "select"):
            kind = "unsupported"
        secret = any(word in name.lower() for word in ("password", "secret", "token", "key", "pin", "code")) or config.get("type") == "password"
        item = {"name": name, "kind": kind, "required": bool(field.get("required")), "secret": secret}
        if kind == "select":
            raw = config.get("options", field.get("options", []))
            options = []
            if isinstance(raw, dict):
                raw = list(raw.items())
            for option in raw:
                if isinstance(option, dict):
                    value, label = option.get("value"), option.get("label", option.get("value"))
                elif isinstance(option, (tuple, list)) and len(option) == 2:
                    value, label = option
                else:
                    value = label = option
                if isinstance(value, (str, int, float, bool)) and len(str(value)) <= 512:
                    options.append({"value": value, "label": str(label)[:200]})
            item["options"] = options
            item["multiple"] = bool(config.get("multiple"))
            if config.get("custom_value"):
                item["kind"] = "text"
        for key in ("min", "max", "step"):
            value = config.get(key, field.get(key))
            if type(value) in (int, float) and math.isfinite(value):
                item[key] = value
        default = field.get("default", (field.get("description") or {}).get("suggested_value"))
        if not secret and isinstance(default, (str, int, float, bool)):
            item["default"] = default
        result.append(item)
    return result


def clean_flow(result):
    kind = result.get("type")
    output = {"type": kind, "flow_id": result.get("flow_id", ""), "handler": result.get("handler", ""),
              "step_id": result.get("step_id", ""), "title": title(result.get("handler", ""))}
    if kind == "form":
        output["fields"] = fields_of(result.get("data_schema"))
        output["errors"] = {str(k): str(v)[:160] for k, v in (result.get("errors") or {}).items()}
        output["supported"] = all(f["kind"] != "unsupported" for f in output["fields"])
    elif kind == "menu":
        options = result.get("menu_options") or []
        output["menu"] = [{"value": str(x), "label": str(options[x]) if isinstance(options, dict) else str(x)} for x in options]
    elif kind == "create_entry":
        output["title"] = str(result.get("title") or output["title"])[:200]
    elif kind == "abort":
        output["reason"] = str(result.get("reason", ""))[:160]
    return output


def checked_input(backend, current, values):
    if not isinstance(values, dict) or len(values) > 40:
        raise backend.Failure("invalid")
    if current.get("type") == "menu":
        options = current.get("menu_options") or []
        if set(values) != {"next_step_id"} or values["next_step_id"] not in options:
            raise backend.Failure("invalid")
        return values
    fields = {f["name"]: f for f in fields_of(current.get("data_schema"))}
    if any(f["kind"] == "unsupported" for f in fields.values()):
        raise backend.Failure("pairUnsupported")
    if set(values) - set(fields):
        raise backend.Failure("invalid")
    for key, value in values.items():
        field = fields[key]
        kind = field["kind"]
        if kind == "boolean":
            valid = type(value) is bool
        elif kind == "number":
            valid = type(value) in (int, float) and math.isfinite(value)
            valid = valid and value >= field.get("min", -1e15) and value <= field.get("max", 1e15)
        elif kind == "select":
            allowed = [o["value"] for o in field["options"]]
            valid = (isinstance(value, list) and len(value) <= 100 and all(v in allowed for v in value)) if field.get("multiple") else value in allowed
        else:
            valid = isinstance(value, str) and len(value) <= 1024
        if not valid:
            raise backend.Failure("invalid")
    return values


def perform(backend, state, action, data):
    user = backend.ws(state, [{"type": "auth/current_user"}])[0]
    if not user.get("is_admin"):
        raise backend.Failure("adminOnly", 403)
    now = time.time()
    for key in list(PAIRS):
        if PAIRS[key]["expires"] < now:
            del PAIRS[key]
    session = state.get("cookie")
    if action == "discover":
        flows, entries, config = backend.ws(state, [{"type": "config_entries/flow/progress"}, {"type": "config_entries/get"}, {"type": "get_config"}])
        handlers = backend.request("/api/config/config_entries/flow_handlers?type=integration", token=backend.access(state))
        found = []
        for flow in flows:
            context = flow.get("context") or {}
            if context.get("source") not in SOURCES:
                continue
            placeholders = context.get("title_placeholders") or {}
            domain = flow.get("handler", "")
            name = placeholders.get("name") or placeholders.get("title") or title(domain)
            found.append({"flow_id": flow["flow_id"], "handler": domain, "name": str(name)[:200], "brand": title(domain)})
        return {"diagnostics": {"ssdp": "ssdp" in config.get("components", []), "zeroconf": "zeroconf" in config.get("components", [])}, "found": found, "configured": [{"name": e.get("title", title(e["domain"])), "brand": title(e["domain"]), "state": e.get("state")} for e in entries if e.get("source") not in ("ignore", "system")],
                "catalog": [{"handler": key, "name": value} for key, value in CATALOG.items() if key in handlers]}
    flow_id = data.get("flow_id")
    if action == "pair" and not flow_id:
        handler = data.get("handler")
        if handler not in CATALOG:
            raise backend.Failure("invalid")
        result = backend.request("/api/config/config_entries/flow", {"handler": handler}, backend.access(state))
        flow_id = result.get("flow_id")
        if flow_id and result.get("type") not in ("create_entry", "abort"):
            PAIRS[flow_id] = {"session": session, "created": True, "expires": now + 1800}
        return clean_flow(result)
    if not isinstance(flow_id, str) or not IDENTIFIER.fullmatch(flow_id):
        raise backend.Failure("invalid")
    pending = PAIRS.get(flow_id)
    if action == "pair" and not pending:
        flows = backend.ws(state, [{"type": "config_entries/flow/progress"}])[0]
        if not any(f["flow_id"] == flow_id and (f.get("context") or {}).get("source") in SOURCES for f in flows):
            raise backend.Failure("pairExpired", 404)
        pending = PAIRS[flow_id] = {"session": session, "created": False, "expires": now + 1800}
    if not pending or pending["session"] != session:
        raise backend.Failure("pairExpired", 404)
    path = "/api/config/config_entries/flow/" + flow_id
    token = backend.access(state)
    if action == "pair-cancel":
        if pending["created"]:
            try:
                backend.request(path, token=token, method="DELETE")
            except backend.Failure as error:
                if error.status != 404:
                    raise
        PAIRS.pop(flow_id, None)
        return {"ok": True}
    if action not in ("pair", "pair-status", "pair-step"):
        raise backend.Failure("not_found", 404)
    current = backend.request(path, token=token)
    if action == "pair-step":
        values = checked_input(backend, current, data.get("values"))
        current = backend.request(path, values, token)
    if current.get("type") in ("create_entry", "abort"):
        PAIRS.pop(flow_id, None)
    return clean_flow(current)

