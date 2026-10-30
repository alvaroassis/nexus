import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "image/runtime"))
import nexus_backend as backend
import nexus_discovery as discovery


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        discovery.PAIRS.clear()
        self.state = {"cookie": "session-a", "refresh": "fake"}

    def test_non_admin_cannot_enumerate_or_pair(self):
        with patch.object(backend, "ws", return_value=[{"is_admin": False}]), patch.object(backend, "request") as request:
            for action in ["discover", "pair", "pair-step", "pair-status", "pair-cancel"]:
                with self.assertRaises(backend.Failure) as result:
                    discovery.perform(backend, self.state, action, {})
                self.assertEqual(result.exception.status, 403)
            request.assert_not_called()

    def test_pairing_rejects_unknown_cross_session_and_injected_flow_ids(self):
        discovery.PAIRS["known"] = {"session": "someone-else", "expires": 1e20, "created": True}
        with patch.object(backend, "ws", return_value=[{"is_admin": True}]), patch.object(backend, "request") as request:
            for identifier in ["../../auth/token", "known", "unknown"]:
                with self.assertRaises(backend.Failure):
                    discovery.perform(backend, self.state, "pair-step", {"flow_id": identifier, "values": {}})
            with self.assertRaises(backend.Failure):
                discovery.perform(backend, self.state, "pair", {"handler": "arbitrary_component"})
            request.assert_not_called()

    def test_flow_result_never_returns_credentials_or_secret_defaults(self):
        result = discovery.clean_flow({"type":"create_entry","handler":"roku","title":"TV","data":{"password":"secret"},"result":{"token":"secret"}})
        self.assertNotIn("secret", str(result))
        result = discovery.clean_flow({"type":"form","handler":"roku","data_schema":[{"name":"password","type":"string","default":"secret"},{"name":"pin","selector":{"text":{"type":"password"}},"description":{"suggested_value":"secret"}}]})
        self.assertNotIn("secret", str([f.get("default") for f in result["fields"]]))

    def test_schema_types_are_checked_without_coercing_credentials(self):
        current = {"type":"form","data_schema":[{"name":"host","type":"string"},{"name":"port","selector":{"number":{"min":1,"max":65535}}},{"name":"enabled","type":"boolean"},{"name":"device","type":"select","options":[["one","TV"]]}]}
        valid = {"host":"192.168.1.20","port":8008,"enabled":True,"device":"one"}
        self.assertEqual(discovery.checked_input(backend,current,valid),valid)
        for bad in [{"extra":"value"},{"port":True},{"port":float("nan")},{"port":99999},{"device":"other"},{"enabled":"yes"}]:
            with self.assertRaises(backend.Failure):
                discovery.checked_input(backend,current,bad)

    def test_discovered_flow_is_confirmed_and_session_bound(self):
        flow = {"flow_id":"found","handler":"roku","context":{"source":"ssdp"}}
        with patch.object(backend,"ws",side_effect=[[{"is_admin":True}],[[flow]]]), patch.object(backend,"access",return_value="fake"), patch.object(backend,"request",return_value={"flow_id":"found","type":"form","handler":"roku","data_schema":[]}) as request:
            result = discovery.perform(backend,self.state,"pair",{"flow_id":"found"})
            self.assertEqual(result["type"],"form")
            self.assertFalse(discovery.PAIRS["found"]["created"])
            request.assert_called_once_with("/api/config/config_entries/flow/found", token="fake")

    def test_cancel_keeps_automatic_discovery_available(self):
        discovery.PAIRS["found"]={"session":"session-a","expires":1e20,"created":False}
        with patch.object(backend,"ws",return_value=[{"is_admin":True}]), patch.object(backend,"access",return_value="fake"), patch.object(backend,"request") as request:
            discovery.perform(backend,self.state,"pair-cancel",{"flow_id":"found"})
            request.assert_not_called()

    def test_media_controls_require_advertised_features_and_valid_values(self):
        entity={"entity_id":"media_player.tv","state":"on","attributes":{"supported_features":4|8|128|256|2048,"source_list":["HDMI 1"]}}
        sent=[]
        def fake_ws(state,commands):
            if commands[0]["type"]=="get_states":
                return [[entity]]
            sent.extend(commands)
            return [{}]
        with patch.object(backend,"authenticated",return_value=self.state), patch.object(backend,"ws",side_effect=fake_ws):
            backend.perform("control",{"entity_id":entity["entity_id"],"service":"volume_set","value":0.65},"cookie")
            self.assertEqual(sent[-1]["service_data"]["volume_level"],0.65)
            backend.perform("control",{"entity_id":entity["entity_id"],"service":"volume_mute","value":True},"cookie")
            self.assertTrue(sent[-1]["service_data"]["is_volume_muted"])
            for data in [{"service":"media_play"},{"service":"volume_set","value":65},{"service":"volume_mute","value":"true"},{"service":"select_source","value":"unknown"}]:
                with self.assertRaises(backend.Failure):
                    backend.perform("control",{"entity_id":entity["entity_id"],**data},"cookie")
            entity["state"]="unavailable"
            with self.assertRaises(backend.Failure):
                backend.perform("control",{"entity_id":entity["entity_id"],"service":"turn_on"},"cookie")


if __name__ == "__main__":
    unittest.main()
