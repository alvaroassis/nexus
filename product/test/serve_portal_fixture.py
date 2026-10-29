"""Disposable CI only: network and timedate1 stand-ins; auth/core remain real."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "image/runtime"))
import portal
class NetworkFixture:
    def status(self):
        return {"interfaces":[{"interface":"eth0","type":"ethernet","connected":True},{"interface":"wlan0","type":"wireless","connected":False}]}
    def scan(self, iface):
        return {"accesspoints":[{"ssid":"Nexus test Wi-Fi","signal":90}]}
    def join(self, data):
        portal.validate_wifi(data)
        raise ValueError("networkFailed")
    def close(self):
        pass
portal.Network=NetworkFixture
def timezone_fixture(zone):
    portal.backend.ZoneInfo(zone)
portal.backend.host_timezone=timezone_fixture
portal.ThreadingHTTPServer(("127.0.0.1",8099),portal.Handler).serve_forever()
