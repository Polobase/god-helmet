# Bluetooth LE and USB protocol

The web app (webapp/, served from GitHub Pages) talks to the helmet with **Web Bluetooth**, or over a USB cable with **Web Serial**. Both carry the same JSON requests and responses ([below](#requests-and-responses)). Any client that follows this page can control the helmet.

| Platform | Bluetooth | USB |
|---|---|---|
| macOS, Windows, Linux, ChromeOS | Chrome or Edge | Chrome or Edge |
| Android | Chrome or Edge | – |
| iPhone / iPad | **Bluefy** (Safari has no Web Bluetooth) | – |

## GATT

| UUID | Name | Properties | Direction |
|---|---|---|---|
| `a3c87500-8ed3-4bdf-8a39-a01bebede295` | service | – | – |
| `a3c87501-…` | request | write, write without response | app → helmet |
| `a3c87502-…` | response | notify | helmet → app |
| `a3c87503-…` | status | notify | helmet → app: once right after the app subscribes, then every 0.5 s while running, every 2 s idle |

- The helmet advertises the service UUID; the name is `GodHelmet-XXXX`, changeable in Helmet → Settings.
- Up to **two apps** can be connected at once, e.g. the receiver and a telepathy sender.
- An app gets notifications only for the characteristics it subscribed to. A response goes only to the app that sent the request (firmware before 0.4.0 notified every connected app).
- After a disconnect the helmet advertises again at once, and checks every 2 s that it still does.

## Framing

A notification or write carries at most MTU − 3 bytes, so every JSON message is split into packets:

```
[seq: u8][flags: u8][payload bytes …]     flags: bit0 FIRST, bit1 LAST
```

- All packets of one message share `seq`, and a FIRST packet discards any unfinished message.
- The app writes packets of at most 180 bytes. That fits the 185-byte MTU of iOS/macOS; Android negotiates up to 517.
- The helmet sizes its notifications to each app's own MTU, and never sends more than 512 bytes in one (the limit for an attribute value).
- A request the helmet cannot take is answered with an error instead of silence ([below](#requests-and-responses)).

Implementations:
- `firmware/lib/bleframe` (C++, host-tested);
- `webapp/src/ble/frame.js` (JS, tested against the same cases).

## USB

One JSON message per line at 115200 baud (the chips' own USB ignores the baud rate). Implementations: `firmware/src/usblink.cpp`, `webapp/src/ble/serial.js` (tested against a fake board).

```
→ {"c":1234567,"id":7,"op":"hello"}\n
← @{"c":1234567,"id":7,"ok":true,"data":{...}}\n
```

- **Replies** start with `@`. Every other line from the helmet is log text (the boot log, errors), so a terminal program shows both.
- **Requests** are lines that start with `{`, up to 96 KB, like over Bluetooth. Other lines are ignored. A longer line, or one the board has no memory for, is answered with an error.
- **No status pushes:** the app asks with `status`, every 0.5 s while running and every 2 s idle. Each valid request counts as the app being present (status LED, `keepaliveS`); other text on the line does not.
- **Opening the port:** the app turns RTS off, then DTR. Auto-reset circuits, and the chips' own USB, restart the board while RTS is on and DTR is off; this order never produces that. On boards with a USB bridge chip it does pull the BOOT pin low for a few milliseconds. BOOT is a STOP button, so the firmware takes it as STOP only when it is held for 40 ms: closing and reopening the port leaves a running session alone (firmware before 0.4.0 stopped it).
- **Restarts:** the first line after a restart is `God helmet controller <version> (<board>, <chip>)`, the second `Helmet <helmetId>, start <bootId> (<resetReason>)`. Seeing them means the board restarted, and any session on it has ended ([When the connection drops](#when-the-connection-drops)).
- **Two USB sockets:** on the S3, C3 and C6 both work, the chip's own USB and the bridge chip's UART.

## Requests and responses

```json
→ {"c": 1234567, "id": 7, "op": "session.start", "session": {...}, "fieldUT": 1.0, "blind": true}
← {"c": 1234567, "id": 7, "ok": true, "data": {"logId": 12}}
← {"c": 1234567, "id": 8, "ok": false, "error": "a session is already running"}
```

- `c` is a random tag per app. The helmet answers only the app that asked; firmware before 0.4.0 notified every connected app, so an app still keeps only responses with its own tag.
- `id` matches a response to its request. The protocol has a single `id` member: for the operations that take an `id` parameter (`log.rate`, `trial.lock` and the other `trial.*` ones), that entry's id is the request's `id`, and the response carries it. The app numbers its other requests from 1 000 000 000, so the two never meet, and matches such a response to its oldest waiting request with that id.
- The helmet handles requests one at a time, in the order they arrive.
- Write `c` and `id` as the first two members. The helmet reads them from the start of a request, so it can still say whose request it was when it has to drop one.
- **Requests the helmet drops** get an error response at once:

  | `error` | When |
  |---|---|
  | `busy: request dropped` | Six requests were already waiting. Sending it again is safe |
  | `request too large (96 KB at most)` | |
  | `out of memory (program too large for this board)` | The board has no room for a request this long, or for running it |
  | `request damaged: start missing` | A packet arrived without its FIRST packet. `c` and `id` are then 0: the app fails its oldest waiting request. Sending it again is safe |

## Operations

| op | Parameters | Returns |
|---|---|---|
| `hello` | – | `firmware`, `protocol`, `board`, `chip` (e.g. `ESP32-C3`), `helmetId`, `bootId`, `uptimeS`, `resetReason`, `recoveredLogId` (these five: [below](#when-the-connection-drops)), `transports` (`["ble","usb"]`, or `["usb"]` with Bluetooth off), `calibrated`, `safetyAccepted`, `maxReachableUT`, `maxFieldUT`, `defaultFieldUT`, `lastSessionEpoch`, `minIntervalS`, `freeHeap`, `maxAlloc` (the largest free piece of memory), `fsUsed`, `fsTotal` (measured while no session runs), `links` (`ble`: connected apps, `bleStatus`: those subscribed to status, `usb`: ports with a request in the last 10 s), `env` |
| `status` | – | the live status (the same JSON as the Bluetooth status notification) |
| `time.set` | `epochMs` | `env` (the app sends its clock on every connect) |
| `env.set` | `kp` (0–9), `ap`, `source` | `env` |
| `settings.get` | – | settings (below) |
| `settings.set` | any subset of the settings | settings; refused while a session runs |
| `session.start` | `session` (preset JSON), `presetId`, `fieldUT`, `blind`, `token` (optional, [below](#starting-twice-is-starting-once)) | `logId`; needs `safetyAccepted`. Refused when the log entry cannot be written |
| `session.stop` | – | fades out over 2 s |
| `session.skip` | – | next phase (after the last phase: stop) |
| `session.field` | `fieldUT` | live intensity change, clamped to `maxFieldUT` |
| `test` | `mode` `dc`/`rotate`/`led` (one output flashing +, pause, −, pause, for two LEDs in place of a coil)/`leds` (the same on AO1 to AO8 in turn, 2 s each), `channel`, `mA` (≤ 4.6), `seconds` (≤ 120), `layout`, `dir`, `dwellMs`, `blinkHz` (`led`/`leds`: flashes per second of each LED, 0.1–20, default 1; 0 = 0.5, 1, 2, 5, 10 Hz in turn, `seconds`/5 each, at least one round of AO1 to AO8 for `leds`), `token` (optional) | `logId: 0` (not logged) |
| `log.list` | `offset`, `limit` (≤ 10) | `total`, `items` (newest first; unrated blind sessions show `condition: "hidden"`). An entry: `id`, `start`, `presetId`, `presetName`, `blind`, `condition`, `test`, `fieldUT`, `plannedMs`, `elapsedMs`, `finished`, `completed`, `reason`, `kpValid`, `kp`, `ap`, `kpSource`, `lst`, `rating`, `notes`, `trialId`, `token`, and once it has ended `finalFieldUT`, `fieldChanges`, `skips` |
| `log.rate` | `id`, `rating` 0–10, `notes` | the entry with its condition revealed; refused while that session is still running, and for a trial's session until the trial is revealed or aborted |
| `trial.new` | `mode` `rv`/`telepathy`, `manifestHash`, `sets` `[{id, size}]`, optional `session` + `presetId` + `blind` + `fieldUT`, `token` (optional) | public trial. The trial and its log entry are on file before the session starts |
| `trial.lock` | `id`, `responseHash` | public trial (records time, Kp/ap, LST) |
| `trial.judge` | `id` | public trial with `set`, `setSize`, shuffled `order` |
| `trial.ranks` | `id`, `ranks` (rank per display position, a permutation of 1..N) | public trial |
| `trial.reveal` | `id` | full trial: `condition`, `target`, `nonce`, `preimage`, `targetRank` |
| `trial.abort` | `id` | – (the trial stays listed as `aborted`) |
| `trial.sender` | `id` | `{set, target, manifestHash}`, only for open telepathy trials |
| `trial.get` / `trial.list` | `id` / `offset`, `limit` | public trial(s) |
| `rng.bytes` | `n` (1–256) | `{hex, source}`: hardware random bytes (`esp_fill_random`), for micro-PK tasks. A true RNG with Bluetooth on; with Bluetooth off the chip's noise source is switched on for the draw. Trials draw their target and condition the same way |

**Settings:**

| Key | Notes |
|---|---|
| `uTperMA[8]` | Per-coil calibration |
| `calibrated` | |
| `seriesOhm` | 470–100000 |
| `coilOhm` | |
| `vFullScale` | |
| `dacGain2x` | |
| `dacBufferedRef` | |
| `maxFieldUT` | ≤ 10 |
| `defaultFieldUT` | |
| `longitudeDeg` | Used for local sidereal time |
| `keepaliveS` | Stop the session when no app has been present for this many seconds. 0 = off (the default: a session runs on without the app), otherwise 5–3600; other values are brought into that range. Present means, over Bluetooth, an app subscribed to status or sending a request; over USB, a valid request |
| `bleName` | Applies after a restart |
| `lastSessionEpoch` | Read-only |
| `safetyAccepted` | |
| `maxCurrentMA` | Read-only |

**Status notification:** `state` (`idle`/`running`/`stopping`), `armed`, `blind`, `test`, `logId`, `sessionId`, `sessionName`, `phaseName`, `phase`, `phaseCount`, `elapsedMs`, `programMs`, `totalMs`, `phaseMs`, `phaseDurationMs`, `envelope`, `fieldUT`, `testMA`, `overruns`, `lastStopReason`, `bootId`, `token`, `presetId`, `startEpoch`, `trialId`, `levels[8]`.

- The `levels` field is omitted in blind sessions, since it would reveal a sham.
- `token`, `presetId`, `startEpoch`, `trialId` and `logId` describe the session that runs, and stay after it has ended until the next start.
- `overruns` counts output periods (0.5 ms each) that came late or were lost, measured against the clock: a stall of 5 ms adds 10. The session's own time does not fall behind.
- `lastStopReason`: `completed`, `stopped from app`, `skipped past last phase`, `UI keepalive lost`, `STOP button`, `STOP button (BOOT)`, `STOP on screen`.

## When the connection drops

The helmet runs a session by itself. A dropped Bluetooth link, a pulled USB cable or a closed browser tab changes nothing on the helmet: the session runs to its end (unless `keepaliveS` is set). What an app needs to find it again:

| Field | Where | Meaning |
|---|---|---|
| `helmetId` | `hello` | 12 hex digits, fixed for the board (its last four are the `XXXX` of the default name) |
| `bootId` | `hello`, `status` | A number that goes up by one at every start of the helmet |
| `uptimeS` | `hello` | Seconds since that start |
| `resetReason` | `hello` | Why it started: `power-on` (also the reset button, which the chip cannot tell apart), `software restart`, `panic`, `task watchdog`, `interrupt watchdog`, `watchdog`, `brownout`, `external reset`, `wake from sleep`, `usb`, `jtag`, `sdio`, `unknown` |
| `recoveredLogId` | `hello` | The log entry this start had to close because the helmet went down during that session; 0 = none |
| `token` | `status`, log entry | The token of the start request ([below](#starting-twice-is-starting-once)) |

After reconnecting, an app asks `hello` and `status` and compares:

- **Same `helmetId`, same `bootId`, `status.token` is its own token:** it is its session. `state` says whether it still runs; if not, `lastStopReason` and the log entry say how it ended.
- **Same `helmetId`, another `bootId`:** the helmet restarted, and the session ended with it. The log entry `recoveredLogId` has the details.
- **Another `helmetId`:** a different helmet.

**A restart in mid-session.** While a session runs, the helmet notes four times a second how far it has got, in memory that a crash, a watchdog or a software restart does not erase (no flash is written for it). At the next start it closes the session's log entry with the time it really ran and the reason `restart: <resetReason>`, for example `restart: task watchdog`. A power cut erases that memory, and so does the reset button on most boards; the entry is then closed as `power lost` with `elapsedMs` 0. Either way the entry is `finished`, not `completed`, and can be rated as usual.

### Starting twice is starting once

`session.start`, `test` and `trial.new` take an optional `token`: 1 to 24 characters from `A-Z a-z 0-9 _ -`, a new random one for every start. When the reply to a start gets lost, the app does not know whether the session runs. It sends the same request again with the same token:

```json
→ {"c": 1234567, "id": 1000000009, "op": "session.start", "session": {...}, "token": "k3Vx81QmZt0aPw2L"}
← {"c": 1234567, "id": 1000000009, "ok": true, "data": {"logId": 12, "already": true}}
```

`already: true` means nothing was started now: this is the session the first request made, whether it still runs or has ended. `trial.new` answers with the trial it made the first time, plus `already: true`. The helmet remembers the tokens of its last four starts, until it restarts. A start with another token, or with none, is refused as before while something runs.

## Session JSON

Same format as the files in `presets/`. Parsed by `firmware/lib/engine/src/preset_json.cpp` and `webapp/src/engine/session.js`:

```json
{
  "id": "my-preset", "name": "My preset", "layout": "temporal", "uT": 1.0,
  "fadeInS": 10, "fadeOutS": 10,
  "phases": [
    {"name": "Phase 1", "minutes": 20, "level": 1.0, "crossfade": false,
     "pattern": {"type": "burst", "f0": 6, "f1": 30, "sweepMs": 1500, "gapMs": 4000, "pointMs": 3},
     "spatial": {"mode": "rotate", "dir": "ccw", "dwell": [10, 2, 20], "weights": [1,1,1,1,1,1,1,1]}}
  ],
  "tableData": [128, 200, 255]
}
```

| Field | Values |
|---|---|
| Pattern `type` | `off`, `dc`, `sine`, `chirp`, `burst`, `thomas`, `pulse`, `semirandom`, `table` (its own `data` or the program's `tableData`, values 0–255, at most 8192 per table and 16384 per program) |
| Spatial `mode` | `bilateral`, `left`, `right`, `rotate`, `cycle` (one `side`), `alternate` (`alternateMs`), `single` (`channel`) |
| Dwell | `"dwellMs": 20` (fixed) or `"dwell": [start, step, end]` (ramp, repeats) |
| Duration | `minutes` or `seconds` per phase; the total must be ≤ 60 min |

**Send tables packed.** A table can also be given as `dataB64` (in a pattern) or `tableDataB64` (for the whole program): base64 of its bytes, one byte per point. As lists of numbers, a table of more than about 1,000 points is too large for an ESP32 to read: the request is answered with `out of memory`, and 87 of the programs in `presets/` have such tables. Packed, the largest program in `presets/` is 24 KB with one short number list at most. Firmware reads the packed form since 0.3.0; the app always sends programs packed (`webapp/src/engine/compact.js`), with only the fields the firmware reads. `hello`'s `maxAlloc` is the largest free piece of memory, which is what a large program needs.

## Trial commitment

```
preimage   = "godhelmet-trial|id=<id>|manifest=<manifestHash>|set=<set>|target=<k>|condition=<c>|nonce=<32 hex>"
commitment = SHA-256(preimage)                          published by trial.new
manifest   = {"format":"godhelmet-pool-manifest","version":1,"sets":[{"id":…,"images":[<sha256 of each picture>…]}…]}
responseHash = SHA-256(JSON.stringify({trialId, text, sketch}))   sent by trial.lock
```

After the reveal, the app checks three things:
- the commitment matches the preimage;
- the local pool still hashes to `manifestHash`;
- the stored response still hashes to `responseHash`.
