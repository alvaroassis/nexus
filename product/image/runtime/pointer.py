"""Show the X11 cursor only while udev reports a physical mouse.

Read device metadata only: never open input events or collect keystrokes.
"""
import ctypes
from pathlib import Path
import signal
import time


def mouse_present(root=Path('/run/udev/data')):
    for path in root.glob('c13:*'):
        try:
            properties = dict(line[2:].split('=', 1) for line in path.read_text().splitlines()
                              if line.startswith('E:') and '=' in line)
        except (OSError, ValueError):
            continue
        if properties.get('ID_INPUT_MOUSE') == '1' and not any(
            properties.get(key) == '1' for key in ('ID_INPUT_TOUCHSCREEN', 'ID_INPUT_TABLET')):
            return True
    return False


def main():
    x11 = ctypes.CDLL('libX11.so.6')
    fixes = ctypes.CDLL('libXfixes.so.3')
    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XOpenDisplay.restype = ctypes.c_void_p
    x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
    x11.XDefaultRootWindow.restype = ctypes.c_ulong
    x11.XFlush.argtypes = [ctypes.c_void_p]
    x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    for name in ('XFixesHideCursor', 'XFixesShowCursor'):
        getattr(fixes, name).argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    display = x11.XOpenDisplay(None)
    if not display:
        raise RuntimeError('Pointer controller could not open the display')
    window = x11.XDefaultRootWindow(display)
    running = True
    def stop(*_):
        nonlocal running
        running = False
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    hidden = False
    try:
        while running:
            hide = not mouse_present()
            if hide != hidden:
                (fixes.XFixesHideCursor if hide else fixes.XFixesShowCursor)(display, window)
                x11.XFlush(display)
                hidden = hide
            time.sleep(0.5)
    finally:
        if hidden:
            fixes.XFixesShowCursor(display, window)
            x11.XFlush(display)
        x11.XCloseDisplay(display)


if __name__ == '__main__':
    main()
