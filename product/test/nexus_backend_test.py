import importlib.util
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1] / "image/runtime"
sys.path.insert(0, str(ROOT))
import nexus_backend as backend

class BackendTests(unittest.TestCase):
    def test_region_requires_country_timezone_pair(self):
        self.assertEqual(backend.validate_region({"country":"US","time_zone":"America/New_York"}), ("US","America/New_York"))
        for data in [{}, {"country":"BR","time_zone":"America/New_York"}, {"country":"US","time_zone":"../../etc/passwd"}]:
            with self.assertRaises(backend.Failure):
                backend.validate_region(data)

    def test_session_never_authenticated_by_preferences_or_missing_cookie(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(backend,"STATE",pathlib.Path(directory)):
            backend.save_state({"cookie":"", "setup":True, "refresh":"not-a-real-token"})
            for cookie in ["", "wrong"]:
                with self.assertRaises(backend.Failure):
                    backend.authenticated(cookie)
            self.assertEqual((pathlib.Path(directory)/"session.json").stat().st_mode & 0o777,0o600)

    def test_no_arbitrary_services_or_cross_account_tokens(self):
        with patch.object(backend, "authenticated", return_value={"refresh":"test"}):
            for data in [{"entity_id":"lock.front","service":"unlock"},{"entity_id":"light.room","service":"delete"},{"entity_id":"climate.room","service":"set_temperature","value":999}]:
                with self.assertRaises(backend.Failure):
                    backend.perform("control",data,"cookie")

    def test_owner_password_minimum_four(self):
        with patch.object(backend,"onboarding",return_value=[{"step":"user","done":False}]), patch.object(backend,"request",return_value={"auth_code":"test"}) as request, patch.object(backend,"establish",return_value="cookie"):
            for password in ["", "a", "abc"]:
                with self.assertRaises(backend.Failure):
                    backend.perform("owner",{"name":"Owner","username":"owner","password":password},"")
            request.assert_not_called()
            backend.perform("owner",{"name":"Owner","username":"owner","password":"abcd"},"")
            self.assertEqual(request.call_args.args[1]["password"],"abcd")

    def test_owner_creation_obeys_backend_state(self):
        with patch.object(backend,"onboarding",return_value=[{"step":"user","done":True}]):
            with self.assertRaises(backend.Failure):
                backend.perform("owner",{"name":"Another owner"},"")

if __name__ == "__main__":
    unittest.main()

