"""Checks on a real board over USB: does a session survive what a dropped
connection, a restart or a misbehaving app can do to it?

ONLY with the helmet off your head and no coils on the outputs (the DAC
module alone is fine): these checks start sessions and restart the board.

  export HELMET_PORT=/dev/cu.usbserial-1410          # pio device list
  PY=~/.platformio/penv/bin/python                   # has pyserial
  $PY firmware/test/hw/checks.py reopen boot token lines keepalive timing

  reopen     closing and reopening the port 20 times does not stop a session
  boot       BOOT held through the USB bridge's control lines: a short pulse
             does nothing, 80 ms and more is STOP (boards with a bridge chip)
  token      the same start sent twice makes one session
  lines      oversized and damaged requests get an error reply, nothing hangs
  keepalive  stops 10 s after the last request, not before; the clamp
  timing     overruns and session clock while requests arrive

These write log entries and trials, and need the test build for some steps
(PLATFORMIO_BUILD_SRC_FLAGS="-std=gnu++17 -Wall -DGH_TEST_OPS" pio run -e <env> -t upload):
  reset      the reset button in mid-session: the log entry is closed
  crash      panic, software restart, watchdog: closed with reason and run time
  trial      trial.new twice with one token makes one trial
  cleanup    removes what the checks added (the state before the first check
             of a run is remembered in .pio/hw-state.json); flash the normal
             build again afterwards
"""
import json, os, random, string, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import serial
from helmet import Helmet, PORT

REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
PRESET = json.load(open(os.path.join(REPO, 'presets', 'guide-gateway-4hz.json')))
STATE = os.path.join(HERE, '..', '..', '.pio', 'hw-state.json')


def tok():
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(16))


def open_ready(order='browser'):
    h = Helmet(order=order)
    hello = h.wait_ready()
    h.call('time.set', epochMs=int(time.time() * 1000))
    remember(h, hello)
    return h, hello


def remember(h, hello):
    """Once per run: what the board held before, for cleanup."""
    if os.path.exists(STATE):
        return
    log = h.call('log.list', offset=0, limit=1)
    trials = h.call('trial.list', offset=0, limit=1)
    state = {'helmetId': hello.get('helmetId'), 'lastSessionEpoch': hello['lastSessionEpoch'],
             'logFrom': (log['items'][0]['id'] if log['items'] else 0) + 1,
             'trialFrom': (trials['items'][0]['id'] if trials['items'] else 0) + 1,
             'keepaliveS': h.call('settings.get')['keepaliveS']}
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(state, open(STATE, 'w'))
    print('  (remembered the board as it was:', state, ')')


def idle(h):
    if h.call('status')['state'] != 'idle':
        h.call('session.stop')
        for _ in range(20):
            time.sleep(0.5)
            if h.call('status')['state'] == 'idle':
                break


def entry(h, log_id):
    items = h.call('log.list', offset=0, limit=10)['items']
    return next((e for e in items if e['id'] == log_id), None)


def show(e):
    return e and {k: e.get(k) for k in ('id', 'finished', 'completed', 'elapsedMs', 'reason', 'token', 'finalFieldUT', 'fieldChanges', 'skips')}


def start(h, token):
    return h.call('session.start', session=PRESET, presetId=PRESET['id'], fieldUT=1.0, blind=False, token=token)


def result(name, ok, text):
    print(f'RESULT {name}:', text if ok else 'FAILED')
    return ok


def check_reopen(rounds=20):
    h, hello = open_ready()
    print('  firmware', hello['firmware'], hello['board'], '| restarted when the port opened:', h.restarted())
    idle(h)
    h.call('test', mode='dc', channel=0, mA=1.0, seconds=60)
    time.sleep(1.0)
    h.close()
    stopped = None
    for i in range(rounds):
        time.sleep(1.0)
        h = Helmet(order='browser')
        st = h.call('status', timeout=3)
        if st['state'] != 'running' and stopped is None:
            stopped = (i + 1, st['lastStopReason'])
        h.close()
    h = Helmet(order='browser')
    st = h.call('status')
    idle(h)
    h.close()
    return result('reopen', stopped is None, f'the session survived {rounds} reopens (overruns {st["overruns"]})') or print('  stopped at reopen', stopped)


def hold_boot(ms):
    s = serial.Serial(); s.port = PORT; s.baudrate = 115200; s.timeout = 0.05
    s.open()            # DTR and RTS asserted: neither EN nor BOOT pulled
    s.rts = False       # DTR on, RTS off: BOOT low
    time.sleep(ms / 1000)
    s.dtr = False       # released
    s.close()


def check_boot():
    seen = {}
    for ms in (5, 20, 80, 300):
        h, _ = open_ready(); idle(h)
        h.call('test', mode='dc', channel=0, mA=1.0, seconds=60)
        time.sleep(0.8); h.close(); time.sleep(0.3)
        hold_boot(ms)
        time.sleep(0.5)
        h = Helmet(order='browser')
        st = h.call('status')
        seen[ms] = st['state']
        print(f'  BOOT low for about {ms:3} ms: {st["state"]:8} {st["lastStopReason"]!r}')
        idle(h); h.close(); time.sleep(0.3)
    ok = seen[5] == seen[20] == 'running' and seen[80] == seen[300] == 'idle'
    result('boot', ok, 'a short pulse is ignored, a held BOOT is STOP')


def check_token():
    h, _ = open_ready(); idle(h)
    t = tok()
    a = start(h, t); b = start(h, t)
    print('  first:', a, '| again:', b)
    for what, token in (('another token', tok()), ('a bad token', 'has space')):
        try:
            print(f'  {what}:', start(h, token))
        except RuntimeError as e:
            print(f'  {what}:', e)
    time.sleep(1.2)
    st = h.call('status')
    h.call('session.field', fieldUT=0.8); h.call('session.skip'); time.sleep(1.0)
    h.call('session.stop'); time.sleep(3.0)
    c = start(h, t)
    print('  same token after it ended:', c, '| log entry:', show(entry(h, a['logId'])))
    ok = b == {'logId': a['logId'], 'already': True} and c == b and st['token'] == t and h.call('status')['state'] == 'idle'
    result('token', ok, 'one session for one token')
    h.close()


def after_restart(what, log_id, boot_before, expect_ms):
    h, hello = open_ready()
    e = entry(h, log_id)
    print(f'  {what}: bootId {boot_before} -> {hello["bootId"]}, resetReason {hello["resetReason"]!r}, recoveredLogId {hello["recoveredLogId"]}')
    print('  entry:', show(e))
    ok = hello['bootId'] != boot_before and e and e['finished'] and not e['completed'] and hello['recoveredLogId'] == log_id
    result(what, ok, f'closed as {e and e["reason"]!r} after {e and e["elapsedMs"]} ms (ran about {expect_ms} ms)')
    h.close()


def run_for(h, seconds):
    log_id = start(h, tok())['logId']
    time.sleep(seconds)
    return log_id, h.call('status')['elapsedMs']


def check_reset():
    h, hello = open_ready(); idle(h)
    log_id, ms = run_for(h, 3.0)
    h.close(); time.sleep(0.5)
    r = Helmet(order='reset'); time.sleep(0.2); r.close()   # EN low: the reset button
    time.sleep(2.5)
    after_restart('reset', log_id, hello['bootId'], ms)


def check_crash():
    for how, extra in (('panic', 0), ('restart', 0), ('hang', 5000)):
        h, hello = open_ready(); idle(h)
        log_id, ms = run_for(h, 3.0)
        try:
            h.call('debug.crash', how=how, timeout=1.0)
        except TimeoutError:
            pass
        except RuntimeError as e:
            print('  ', e, '(needs the test build)'); h.close(); return
        h.close()
        time.sleep(5.5 + extra / 1000)
        after_restart(how, log_id, hello['bootId'], ms + extra)


def check_keepalive():
    h, _ = open_ready(); idle(h)
    before = h.call('settings.get')['keepaliveS']
    clamp = {want: h.call('settings.set', keepaliveS=want)['keepaliveS'] for want in (2, 99999, -1, 10)}
    print('  asked -> stored:', clamp)
    h.call('test', mode='dc', channel=0, mA=1.0, seconds=60)
    polled = []
    for _ in range(8):
        time.sleep(2); polled.append(h.call('status')['state'])
    for _ in range(6):   # no request for 12 s; noise on the line must not count as an app
        time.sleep(2); h.s.write(b'{this is not a request\nhello there\n')
    time.sleep(1.5)
    st = h.call('status')
    print(f'  polled for 16 s: {set(polled)}; then silent 13.5 s: {st["state"]} {st["lastStopReason"]!r} at {st["elapsedMs"]} ms')
    h.call('settings.set', keepaliveS=before)
    ok = clamp == {2: 5, 99999: 3600, -1: 0, 10: 10} and set(polled) == {'running'} and st['lastStopReason'] == 'UI keepalive lost'
    result('keepalive', ok, 'stopped 10 s after the last request, not while polled')
    h.close()


def check_timing():
    h, _ = open_ready(); idle(h)
    h.call('test', mode='dc', channel=0, mA=1.0, seconds=60)
    time.sleep(1.0)
    first = h.call('status')['overruns']
    for op, n in (('status', 100), ('hello', 100), ('settings.get', 30), ('log.list', 10)):
        before = h.call('status')['overruns']; t = time.time()
        for _ in range(n):
            h.call(op)
        print(f'  {n:3} x {op:13} {1000 * (time.time() - t) / n:6.1f} ms each, overruns +{h.call("status")["overruns"] - before}')
    total = h.call('status')['overruns'] - first
    idle(h); h.close()
    result('timing', total < 20, f'{total} late output periods (0.5 ms each) while 240 requests were served')


def check_lines():
    h, _ = open_ready(); idle(h)
    h.s.write((json.dumps({'c': h.tag, 'id': 9001, 'op': 'session.start', 'pad': 'x' * 100000}) + '\n').encode())
    got = None; end = time.time() + 15
    while time.time() < end and got is None:
        raw = h.s.readline()
        if raw.startswith(b'@'):
            got = json.loads(raw[1:])
    print('  a 100 KB request ->', got)
    h.s.write(b'{"c":%d,"id":9002,"op":\n' % h.tag)
    raw = b''; end = time.time() + 3
    while time.time() < end and not raw.startswith(b'@'):
        raw = h.s.readline()
    print('  a damaged request ->', raw.decode().strip()[:110])
    alive = h.call('hello')['firmware']
    result('lines', bool(got) and got.get('id') == 9001 and got.get('ok') is False and b'9002' in raw, f'both answered with an error; still serving ({alive})')
    h.close()


def check_trial():
    h, _ = open_ready(); idle(h)
    args = dict(mode='rv', manifestHash='ab' * 32, sets=[{'id': 'set-a', 'size': 4}, {'id': 'set-b', 'size': 4}],
                session=PRESET, presetId=PRESET['id'], blind=True, fieldUT=1.0, token=tok())
    a = h.call('trial.new', **args); b = h.call('trial.new', **args)
    time.sleep(1.2)
    st = h.call('status')
    print('  first:', {k: a.get(k) for k in ('id', 'logId', 'condition')}, '| again:', {k: b.get(k) for k in ('id', 'logId', 'already')}, '| status trialId', st['trialId'])
    idle(h)
    h.call('trial.abort', id=a['id'])
    ok = b['id'] == a['id'] and b.get('already') is True and st['trialId'] == a['id'] and a['condition'] == 'hidden' and 'levels' not in st
    result('trial', ok, 'one trial for one token; the blind condition stays hidden')
    h.close()


def cleanup():
    if not os.path.exists(STATE):
        print('  nothing remembered: nothing to remove'); return
    state = json.load(open(STATE))
    h = Helmet(); hello = h.wait_ready(); idle(h)
    if hello.get('helmetId') != state['helmetId']:
        print('  another helmet than the one remembered: nothing removed'); h.close(); return
    try:
        print('  removed:', h.call('debug.cleanup', logFrom=state['logFrom'], trialFrom=state['trialFrom'], lastSessionEpoch=state['lastSessionEpoch']))
    except RuntimeError as e:
        print('  ', e, '(needs the test build)'); h.close(); return
    h.call('settings.set', keepaliveS=state['keepaliveS'])
    log = h.call('log.list', offset=0, limit=10)
    print('  now: log entries', log['total'], '| trials', h.call('trial.list', offset=0, limit=1)['total'], '| lastSessionEpoch', h.call('hello')['lastSessionEpoch'])
    os.remove(STATE)
    h.close()


CHECKS = {'reopen': check_reopen, 'boot': check_boot, 'token': check_token, 'lines': check_lines, 'keepalive': check_keepalive,
          'timing': check_timing, 'reset': check_reset, 'crash': check_crash, 'trial': check_trial, 'cleanup': cleanup}
if __name__ == '__main__':
    names = sys.argv[1:]
    if not names or any(n not in CHECKS for n in names):
        raise SystemExit(__doc__)
    for name in names:
        print('==', name)
        CHECKS[name]()
