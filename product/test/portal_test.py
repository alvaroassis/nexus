import importlib.util
import pathlib
import io
import unittest

spec = importlib.util.spec_from_file_location("portal", pathlib.Path(__file__).resolve().parents[1] / "image/runtime/portal.py")
portal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(portal)


class PortalTest(unittest.TestCase):
    def test_wifi_validation(self):
        self.assertEqual(portal.validate_wifi({"ssid":"Home","interface":"wlan0","auth":"wpa-psk","password":"12345678"})[0], "Home")
        for data in [None, {}, {"ssid":"é"*17,"interface":"wlan0","auth":"open"}, {"ssid":"Home","interface":"wlan0;bad","auth":"open"}, {"ssid":"Home","interface":"wlan0","auth":"wpa-psk","password":"short"}]:
            with self.assertRaises(ValueError):
                portal.validate_wifi(data)

    def test_rejects_cross_origin_and_rebinding_without_network_access(self):
        class Socket:
            def __init__(self, request):
                self.request = request
                self.response = bytearray()
            def makefile(self, *_args):
                return io.BytesIO(self.request)
            def sendall(self, data):
                self.response.extend(data)
        for host, origin, token in [("evil.test","http://evil.test",portal.TOKEN), ("127.0.0.1:8099","http://evil.test",portal.TOKEN), ("127.0.0.1:8099",portal.ORIGIN,"wrong")]:
            request = f"POST /join HTTP/1.0\r\nHost: {host}\r\nOrigin: {origin}\r\nX-Nexus-Token: {token}\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{{}}".encode()
            socket = Socket(request)
            portal.Handler(socket, ("127.0.0.1", 1234), None)
            self.assertTrue(socket.response.startswith(b"HTTP/1.0 403"))


if __name__ == "__main__":
    unittest.main()
