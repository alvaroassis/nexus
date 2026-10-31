import importlib.util
from pathlib import Path
import unittest
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location('pointer', Path(__file__).parents[1] / 'image/runtime/pointer.py')
pointer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pointer)

class PointerTests(unittest.TestCase):
    def test_hotplug_and_touch_only(self):
        root, touch, mouse = Mock(), Mock(), Mock()
        root.glob.return_value = []
        self.assertFalse(pointer.mouse_present(root))
        touch.read_text.return_value = 'E:ID_INPUT_MOUSE=1\nE:ID_INPUT_TOUCHSCREEN=1\n'
        root.glob.return_value = [touch]
        self.assertFalse(pointer.mouse_present(root))
        mouse.read_text.return_value = 'E:ID_INPUT_MOUSE=1\nE:ID_BUS=usb\n'
        root.glob.return_value = [touch, mouse]
        self.assertTrue(pointer.mouse_present(root))
        root.glob.return_value = [touch]
        self.assertFalse(pointer.mouse_present(root))
