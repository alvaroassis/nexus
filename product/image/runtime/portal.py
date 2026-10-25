#!/usr/bin/env python3
"""Local touchscreen provisioning. Runs as the unprivileged active kiosk user.

Only NetworkManager operations explicitly allowed by polkit are exposed.
No shell, arbitrary paths, browser-stored passwords, or remote listeners.
"""
import hmac
import json
import re
import secrets
import threading
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ORIGIN = "http://127.0.0.1:8099"
TOKEN = secrets.token_urlsafe(32)
LOCK = threading.Lock()
ROOT = Path(__file__).resolve().parent
NM = "org.freedesktop.NetworkManager"


def validate_wifi(data):
    if not isinstance(data, dict):
        raise ValueError("invalidWifi")
    ssid, password, iface = (data.get(k, "") for k in ("ssid", "password", "interface"))
    auth = data.get("auth")
    if not all(isinstance(v, str) for v in (ssid, password, iface)):
        raise ValueError("invalidWifi")
    if not 1 <= len(ssid.encode("utf-8")) <= 32 or any(ord(c) < 32 for c in ssid):
        raise ValueError("invalidWifi")
    if auth not in ("open", "wpa-psk") or not re.fullmatch(r"[a-zA-Z0-9_.-]{1,32}", iface):
        raise ValueError("invalidWifi")
    if auth == "wpa-psk" and not (8 <= len(password) <= 63 or re.fullmatch(r"[a-fA-F0-9]{64}", password)):
        raise ValueError("invalidWifi")
    return ssid, password, iface, auth


class Network:
    def __init__(self):
        import dbus
        self.dbus = dbus
        self.bus = dbus.SystemBus(private=True)
        self.manager = dbus.Interface(self.bus.get_object(NM, "/org/freedesktop/NetworkManager"), NM)

    def properties(self, path, interface):
        obj = self.bus.get_object(NM, path)
        return self.dbus.Interface(obj, "org.freedesktop.DBus.Properties").GetAll(interface)

    def devices(self):
        result = []
        for path in self.manager.GetDevices():
            p = self.properties(path, NM + ".Device")
            if int(p["DeviceType"]) in (1, 2):
                result.append((path, p))
        return result

    def status(self):
        return {"interfaces": [{"interface": str(p["Interface"]), "type": "wireless" if int(p["DeviceType"]) == 2 else "ethernet", "connected": int(p["State"]) == 100} for _, p in self.devices()]}

    def wireless(self, iface):
        for path, p in self.devices():
            if str(p["Interface"]) == iface and int(p["DeviceType"]) == 2:
                return path
        raise ValueError("noWifi")

    def scan(self, iface):
        path = self.wireless(iface)
        wifi = self.dbus.Interface(self.bus.get_object(NM, path), NM + ".Device.Wireless")
        # RequestScan is asynchronous; return cached observations and allow refresh.
        try:
            wifi.RequestScan(self.dbus.Dictionary({}, signature="sv"))
        except self.dbus.DBusException:
            pass
        points = []
        for ap in wifi.GetAllAccessPoints():
            p = self.properties(ap, NM + ".AccessPoint")
            ssid = bytes(p["Ssid"]).decode("utf-8", errors="replace")
            if ssid:
                points.append({"ssid": ssid, "signal": int(p["Strength"])})
        return {"accesspoints": points}

    def join(self, data):
        ssid, password, iface, auth = validate_wifi(data)
        path = self.wireless(iface)
        d = self.dbus
        connection = {
            "connection": {"id": "Nexus " + ssid, "uuid": str(uuid.uuid4()), "type": "802-11-wireless", "interface-name": iface, "autoconnect": True, "permissions": d.Array(["user:nexus:"], signature="s")},
            "802-11-wireless": {"ssid": d.ByteArray(ssid.encode("utf-8")), "mode": "infrastructure"},
            "ipv4": {"method": "auto"},
            "ipv6": {"method": "auto"},
        }
        if auth == "wpa-psk":
            connection["802-11-wireless-security"] = {"key-mgmt": "wpa-psk", "psk": password}
        self.manager.AddAndActivateConnection(connection, path, d.ObjectPath("/"), timeout=30)
        return {"requested": True}  # Not a claim of successful authentication.

    def close(self):
        self.bus.close()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Never log request bodies or Wi-Fi credentials.

    def reply(self, status, value, mime="application/json"):
        body = json.dumps(value).encode() if mime == "application/json" else value
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def allowed_host(self):
        return self.headers.get("Host") == "127.0.0.1:8099"

    def do_GET(self):
        if not self.allowed_host():
            self.reply(403, {"error": "forbidden"}); return
        path = self.path.split("?", 1)[0]
        if path == "/health":
            self.reply(200, {"ok": True}); return
        if path == "/session":
            self.reply(200, {"token": TOKEN}); return
        if path == "/ready":
            try:
                with urllib.request.urlopen("http://127.0.0.1:8123/", timeout=2) as result:
                    ready = result.status == 200
            except Exception:
                ready = False
            self.reply(200, {"ready": ready}); return
        if path in ("/", "/portal.mjs"):
            name = "portal.html" if path == "/" else "portal.mjs"
            self.reply(200, (ROOT / name).read_bytes(), "text/html; charset=utf-8" if path == "/" else "text/javascript; charset=utf-8"); return
        if path == "/network":
            self.network_call("status", {}); return
        self.reply(404, {"error": "not_found"})

    def do_POST(self):
        if not self.allowed_host() or self.headers.get("Origin") != ORIGIN or not hmac.compare_digest(self.headers.get("X-Nexus-Token", ""), TOKEN):
            self.reply(403, {"error": "forbidden"}); return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > 4096 or self.headers.get("Content-Type") != "application/json":
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError()
        except (ValueError, UnicodeError):
            self.reply(400, {"error": "invalidWifi"}); return
        if self.path not in ("/scan", "/join"):
            self.reply(404, {"error": "not_found"}); return
        self.network_call(self.path[1:], data)

    def network_call(self, action, data):
        if not LOCK.acquire(blocking=False):
            self.reply(409, {"error": "busy"}); return
        network = None
        try:
            network = Network()
            value = network.status() if action == "status" else network.scan(data.get("interface")) if action == "scan" else network.join(data)
            self.reply(200, value)
        except ValueError as error:
            self.reply(400, {"error": str(error)})
        except Exception:
            self.reply(503, {"error": "networkFailed"})
        finally:
            if network:
                network.close()
            LOCK.release()


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8099), Handler).serve_forever()
