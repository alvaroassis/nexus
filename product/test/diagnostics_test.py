"""Execute the boot report, including its tail, without touching the boot partition."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

BASH = shutil.which("bash")


@unittest.skipUnless(BASH, "Boot diagnostics run on Linux")
class DiagnosticsTest(unittest.TestCase):
    def test_complete_report_with_network_and_pointer_status(self):
        source = Path(__file__).resolve().parents[1] / "image/runtime/diagnostics.sh"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            binary = root / "bin"
            binary.mkdir()
            for name in ("systemctl", "plymouth-set-default-theme", "ps", "ip", "nmcli", "docker"):
                stub = binary / name
                stub.write_text("#!/bin/sh\nprintf '%s\\n' 'fixture-" + name + "'\n")
                stub.chmod(0o755)
            pointer = binary / "pgrep"
            pointer.write_text("#!/bin/sh\n[ \"$1\" = '-f' ] && [ \"$2\" = '^python3 /opt/nexus/pointer.py$' ]\n")
            pointer.chmod(0o755)
            script = root / "diagnostics.sh"
            script.write_text(source.read_text().replace("/boot/firmware/", directory + "/"))
            environment = dict(os.environ, PATH=str(binary) + os.pathsep + os.environ["PATH"])
            result = subprocess.run([BASH, str(script)], env=environment, capture_output=True, text=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, "")
            report = (root / "NEXUS-DIAGNOSTICS.txt").read_text()
            for heading in ("Network interfaces and addresses:", "IPv4 routes:",
                            "NetworkManager device state:", "Core container network mode:",
                            "Pointer controller:", "Input device names:", "Sound cards:",
                            "Xorg warnings and errors:"):
                self.assertEqual(report.count(heading), 1, heading)
            self.assertIn("Pointer controller:\nrunning\nInput device names:", report)
            self.assertIn("fixture-ip", report)
            self.assertIn("fixture-nmcli", report)
            self.assertIn("fixture-docker", report)
            self.assertNotIn("syntax error", report)
            self.assertNotIn("mv -f", report)
