"""Nexus local UI backend. Credentials stay on disk (0600), never in browser JS."""
import hashlib
import json
import os
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

BASE = os.environ.get("NEXUS_CORE_URL", "http://127.0.0.1:8123")
CLIENT = "http://127.0.0.1:8099/"
STATE = Path(os.environ.get("NEXUS_STATE_DIR", str(Path.home() / ".local/state/nexus")))
LOCK = threading.RLock()
FLOW = {}
ACCESS = {}
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


class Failure(Exception):
    def __init__(self, code, status=400):
        self.code, self.status = code, status


def read_state():
    try:
        return json.loads((STATE / "session.json").read_text())
    except (FileNotFoundError, ValueError):
        return {}


def save_state(value):
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = STATE / "session.tmp"
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(value, stream)
    os.replace(path, STATE / "session.json")


def request(path, data=None, token=None, form=False, method=None):
    headers = {"Content-Type": "application/x-www-form-urlencoded" if form else "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = (urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode()) if data is not None else None
    try:
        with HTTP.open(urllib.request.Request(BASE + path, data=body, headers=headers, method=method), timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        raise Failure("signIn" if error.code in (401, 403) else "invalid", error.code) from None
    except (OSError, ValueError):
        raise Failure("starting", 503) from None


def onboarding():
    try:
        return request("/api/onboarding")
    except Failure as error:
        if error.status == 404:
            return []
        raise


def authenticated(cookie):
    state = read_state()
    digest = hashlib.sha256(cookie.encode()).hexdigest()
    if not cookie or not secrets.compare_digest(digest, state.get("cookie", "")):
        raise Failure("signIn", 401)
    return state


def access(state):
    refresh = state.get("refresh", "")
    cached = ACCESS.get(refresh)
    if cached and cached[1] > time.time():
        return cached[0]
    result = request("/auth/token", {"grant_type": "refresh_token", "refresh_token": refresh, "client_id": CLIENT}, form=True)
    ACCESS.clear()
    ACCESS[refresh] = (result["access_token"], time.time() + result["expires_in"] - 60)
    return result["access_token"]


def ws(state, commands):
    import websocket
    sock = websocket.create_connection(BASE.replace("http", "ws", 1) + "/api/websocket", timeout=25, suppress_origin=True)
    try:
        json.loads(sock.recv())
        sock.send(json.dumps({"type": "auth", "access_token": access(state)}))
        if json.loads(sock.recv()).get("type") != "auth_ok":
            ACCESS.clear()
            raise Failure("signIn", 401)
        results = []
        for index, command in enumerate(commands, 1):
            sock.send(json.dumps(dict(command, id=index)))
            result = json.loads(sock.recv())
            if not result.get("success"):
                code = result.get("error", {}).get("code")
                raise Failure("adminOnly" if code == "unauthorized" else "invalid", 403 if code == "unauthorized" else 400)
            results.append(result.get("result"))
        return results
    finally:
        sock.close()


def establish(code):
    result = request("/auth/token", {"grant_type": "authorization_code", "code": code, "client_id": CLIENT}, form=True)
    cookie = secrets.token_urlsafe(32)
    old = read_state()
    state = {"refresh": result["refresh_token"], "cookie": hashlib.sha256(cookie.encode()).hexdigest()}
    # Reuse non-secret preferences only; backend preferences are authoritative.
    save_state(state)
    ACCESS.clear()
    ACCESS[state["refresh"]] = (result["access_token"], time.time() + result["expires_in"] - 60)
    if old.get("refresh"):
        try:
            request("/auth/token", {"action": "revoke", "token": old["refresh"]}, form=True)
        except Failure:
            pass
    return cookie


def regions():
    zones = {}
    for line in Path("/usr/share/zoneinfo/zone.tab").read_text().splitlines():
        if line and not line.startswith("#"):
            country, _, zone, *_ = line.split("\t")
            zones.setdefault(country, []).append(zone)
    return zones


def validate_region(data):
    country, zone = data.get("country"), data.get("time_zone")
    if country not in regions() or zone not in regions()[country]:
        raise Failure("invalidRegion")
    ZoneInfo(zone)
    return country, zone


def host_timezone(zone):
    import dbus
    bus = dbus.SystemBus(private=True)
    try:
        manager = dbus.Interface(bus.get_object("org.freedesktop.timedate1", "/org/freedesktop/timedate1"), "org.freedesktop.timedate1")
        manager.SetTimezone(zone, False)
    finally:
        bus.close()


def status(cookie):
    steps = onboarding()
    new = any(s["step"] == "user" and not s["done"] for s in steps)
    try:
        state = authenticated(cookie)
    except Failure:
        return {"ready": True, "new": new, "authenticated": False}
    user, config, prefs = ws(state, [{"type": "auth/current_user"}, {"type": "get_config"}, {"type": "frontend/get_user_data", "key": "nexus"}])
    return {"ready": True, "new": False, "authenticated": True, "user": user, "config": config, "preferences": prefs.get("value") or {}}


def perform(action, data, cookie):
    with LOCK:
        if action == "owner":
            if not any(s["step"] == "user" and not s["done"] for s in onboarding()):
                raise Failure("signIn", 409)
            if not all(isinstance(data.get(k), str) and 1 <= len(data[k]) <= 128 for k in ("name", "username", "password")) or len(data["password"]) < 12:
                raise Failure("invalid")
            result = request("/api/onboarding/users", {k: data[k] for k in ("name", "username", "password")} | {"client_id": CLIENT, "language": data.get("language", "en")})
            return {"ok": True}, establish(result["auth_code"])
        if action == "login":
            now = time.time()
            for key in list(FLOW):
                if FLOW[key][1] < now:
                    del FLOW[key]
            if data.get("flow"):
                pending = FLOW.pop(data["flow"], None)
                if not pending:
                    raise Failure("signIn", 401)
                flow_id = pending[0]
                fields = {"code": str(data.get("code", ""))}
            else:
                result = request("/auth/login_flow", {"client_id": CLIENT, "redirect_uri": CLIENT, "handler": ["homeassistant", None]})
                flow_id = result["flow_id"]
                fields = {"username": str(data.get("username", "")), "password": str(data.get("password", ""))}
            result = request("/auth/login_flow/" + flow_id, fields | {"client_id": CLIENT})
            if result["type"] == "create_entry":
                return {"ok": True}, establish(result["result"])
            if result.get("step_id") == "mfa":
                key = secrets.token_urlsafe(32)
                FLOW[key] = (flow_id, now + 180)
                return {"flow": key, "invalid": bool(result.get("errors"))}, None
            raise Failure("signIn", 401)
        state = authenticated(cookie)
        if action in ("discover", "pair", "pair-status", "pair-step", "pair-cancel"):
            import nexus_discovery
            return nexus_discovery.perform(__import__(__name__), state, action, data), None
        if action == "logout":
            try:
                request("/auth/token", {"action": "revoke", "token": state["refresh"]}, form=True)
            finally:
                save_state({})
                ACCESS.clear()
            return {"ok": True}, ""
        if action == "snapshot":
            user, config, states, areas, entities, devices, prefs = ws(state, [
                {"type": "auth/current_user"}, {"type": "get_config"}, {"type": "get_states"},
                {"type": "config/area_registry/list"}, {"type": "config/entity_registry/list"}, {"type": "config/device_registry/list"},
                {"type": "frontend/get_user_data", "key": "nexus"}])
            return {"user": user, "config": config, "states": states, "areas": areas, "entities": entities, "devices": devices, "preferences": prefs.get("value") or {}}, None
        if action == "finish":
            country, zone = validate_region(data)
            name = data.get("home", "").strip()
            language = data.get("language")
            if not name or len(name) > 80 or language not in ("en", "pt", "es"):
                raise Failure("invalid")
            user = ws(state, [{"type": "auth/current_user"}])[0]
            if not user["is_admin"]:
                raise Failure("adminOnly", 403)
            # Apply the backend before changing the host; retry is idempotent.
            ws(state, [{"type": "config/core/update", "location_name": name, "country": country, "time_zone": zone}])
            try:
                host_timezone(zone)
            except Exception:
                raise Failure("timezoneFailed", 503) from None
            for step in onboarding():
                if not step["done"] and step["step"] in ("core_config", "analytics", "integration"):
                    payload = {"client_id": CLIENT, "redirect_uri": CLIENT} if step["step"] == "integration" else {}
                    request("/api/onboarding/" + step["step"], payload, access(state))
            prefs = ws(state, [{"type": "frontend/get_user_data", "key": "nexus"}])[0].get("value") or {}
            prefs.update({"language": language, "setup": True})
            ws(state, [{"type": "frontend/set_user_data", "key": "nexus", "value": prefs}])
            return {"ok": True}, None
        if action == "preferences":
            prefs = ws(state, [{"type": "frontend/get_user_data", "key": "nexus"}])[0].get("value") or {}
            if data.get("language") in ("en", "pt", "es"):
                prefs["language"] = data["language"]
            if "favorites" in data:
                if not isinstance(data["favorites"], list) or len(data["favorites"]) > 500 or not all(isinstance(x, str) and len(x) < 256 for x in data["favorites"]):
                    raise Failure("invalid")
                prefs["favorites"] = data["favorites"]
            ws(state, [{"type": "frontend/set_user_data", "key": "nexus", "value": prefs}])
            return {"ok": True}, None
        if action == "control":
            entity = data.get("entity_id", "")
            if not isinstance(entity, str) or "." not in entity:
                raise Failure("invalid")
            domain = entity.split(".")[0]
            allowed = {"light": ["turn_on", "turn_off"], "switch": ["turn_on", "turn_off"], "fan": ["turn_on", "turn_off"], "scene": ["turn_on"], "cover": ["open_cover", "close_cover", "stop_cover"], "climate": ["set_temperature"], "media_player": ["turn_on", "turn_off", "media_play", "media_pause", "media_play_pause", "volume_set", "volume_mute", "volume_up", "volume_down", "select_source"]}
            service = data.get("service")
            if service not in allowed.get(domain, []):
                raise Failure("invalid")
            payload = {"entity_id": entity}
            if domain == "media_player":
                states = ws(state, [{"type": "get_states"}])[0]
                current = next((s for s in states if s["entity_id"] == entity), None)
                if not current or current.get("state") in ("unavailable", "unknown"):
                    raise Failure("unavailable")
                attributes = current.get("attributes") or {}
                features = int(attributes.get("supported_features", 0))
                flags = {"turn_on": 128, "turn_off": 256, "volume_set": 4, "volume_mute": 8,
                         "volume_up": 1024, "volume_down": 1024, "select_source": 2048,
                         "media_play": 16384, "media_pause": 1}
                required = flags.get(service, 1 if current["state"] == "playing" else 16384)
                if not features & required:
                    raise Failure("unsupportedControl")
                if service == "volume_mute":
                    if type(data.get("value")) is not bool:
                        raise Failure("invalid")
                    payload["is_volume_muted"] = data["value"]
                if service == "select_source":
                    source = data.get("value")
                    if not isinstance(source, str) or source not in attributes.get("source_list", []):
                        raise Failure("invalid")
                    payload["source"] = source
            if service == "set_temperature":
                value = data.get("value")
                if type(value) not in (int, float) or not -50 <= value <= 100:
                    raise Failure("invalid")
                payload["temperature"] = value
            if service == "volume_set":
                value = data.get("value")
                if type(value) not in (int, float) or not 0 <= value <= 1:
                    raise Failure("invalid")
                payload["volume_level"] = value
            ws(state, [{"type": "call_service", "domain": domain, "service": service, "service_data": payload}])
            return {"ok": True}, None
        raise Failure("not_found", 404)
