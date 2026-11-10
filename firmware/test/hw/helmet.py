"""Talks to the helmet over its USB serial port (docs/BLE_PROTOCOL.md): one JSON
line per request, replies start with '@'. Used by checks.py.

The port comes from the environment variable HELMET_PORT, e.g.
  HELMET_PORT=/dev/cu.usbserial-1410   (macOS)   /dev/ttyUSB0 (Linux)   COM5 (Windows)

Helmet(order=...): how the port's control lines are driven after opening.
  'browser'  as the web app does: the system asserts DTR and RTS on open, then
             RTS off, then DTR off (passes through DTR on / RTS off: BOOT low
             for a few milliseconds on boards with a USB bridge chip).
  'reset'    DTR off first, then RTS off (passes through DTR off / RTS on: EN
             low): restarts such a board, like its reset button.
  'none'     leave both asserted.
"""
import json, os, random, time
import serial  # pyserial: part of PlatformIO's own Python (~/.platformio/penv/bin/python)

PORT = os.environ.get('HELMET_PORT', '')


class Helmet:
    def __init__(self, port=None, order='browser'):
        port = port or PORT
        if not port:
            raise SystemExit('Set HELMET_PORT to the helmet\'s serial port (pio device list shows it).')
        self.tag = random.randrange(1, 2**31 - 1)
        self.next = 1
        self.log = []      # lines that are not replies (boot text, log output)
        self.s = serial.Serial()
        self.s.port = port
        self.s.baudrate = 115200
        self.s.timeout = 0.05
        self.s.open()      # the system asserts DTR and RTS
        if order == 'browser':
            self.s.rts = False
            self.s.dtr = False
        elif order == 'reset':
            self.s.dtr = False
            self.s.rts = False

    def close(self):
        self.s.close()

    def _lines(self, until):
        while time.time() < until:
            raw = self.s.readline()
            if not raw:
                continue
            line = raw.decode('utf-8', 'replace').strip()
            if line:
                yield line

    def call(self, op, timeout=5.0, **params):
        """One request; returns its data, or raises RuntimeError with the helmet's error."""
        # The protocol has one "id" member: an operation's own id parameter
        # (log entry, trial) takes the place of the request id, and the helmet
        # answers with it. Request ids start high so the two never meet.
        body = {'c': self.tag, 'id': 1_000_000_000 + self.next, 'op': op, **params}
        rid = body['id']
        self.next += 1
        self.s.write((json.dumps(body) + '\n').encode())
        for line in self._lines(time.time() + timeout):
            if not line.startswith('@'):
                self.log.append(line)
                continue
            try:
                msg = json.loads(line[1:])
            except ValueError:
                self.log.append('unparsable: ' + line[:200])
                continue
            if msg.get('id') != rid:
                continue
            if msg.get('ok'):
                return msg.get('data')
            raise RuntimeError(f"{op}: {msg.get('error')}")
        raise TimeoutError(f'{op}: no answer')

    def wait_ready(self, seconds=20):
        """After a (possible) restart: hello until the helmet answers."""
        end = time.time() + seconds
        while time.time() < end:
            try:
                return self.call('hello', timeout=1.5)
            except TimeoutError:
                pass
        raise TimeoutError('the helmet does not answer')

    def restarted(self):
        return any('God helmet controller' in l for l in self.log)
