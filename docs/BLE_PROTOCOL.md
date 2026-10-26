# Bluetooth LE protocol

The web app (webapp/, served from GitHub Pages) talks to the helmet with **Web Bluetooth**. Any client that follows this page can control the helmet.

| Platform | Browser |
|---|---|
| Android, macOS, Windows, Linux, ChromeOS | Chrome or Edge |
| iPhone / iPad | **Bluefy** (Safari has no Web Bluetooth) |

## GATT

| UUID | Name | Properties | Direction |
|---|---|---|---|
| `a3c87500-8ed3-4bdf-8a39-a01bebede295` | service | – | – |
| `a3c87501-…` | request | write, write without response | app → helmet |
| `a3c87502-…` | response | notify | helmet → app |
| `a3c87503-…` | status | notify | helmet → app, every 0.5 s while running, every 2 s idle |

- The helmet advertises the service UUID; the name is `GodHelmet-XXXX`, changeable in Setup.
- Up to **two apps** can be connected at once, e.g. the receiver and a telepathy sender.

## Framing

A notification or write carries at most MTU − 3 bytes, so every JSON message is split into packets:

```
[seq: u8][flags: u8][payload bytes …]     flags: bit0 FIRST, bit1 LAST
```

- All packets of one message share `seq`, and a FIRST packet discards any unfinished message.
- The app writes packets of at most 180 bytes. That fits the 185-byte MTU of iOS/macOS; Android negotiates up to 517.
- The helmet sizes its notifications to the smallest MTU among connected apps.

Implementations:
- `firmware/lib/bleframe` (C++, host-tested);
- `webapp/src/ble/frame.js` (JS, tested against the same cases).

## Requests and responses

```json
→ {"c": 1234567, "id": 7, "op": "session.start", "session": {...}, "fieldUT": 1.0, "blind": true}
← {"c": 1234567, "id": 7, "ok": true, "data": {"logId": 12}}
← {"c": 1234567, "id": 8, "ok": false, "error": "a session is already running"}
```

- `c` is a random tag per app. Responses are notified to every connected app, so each app keeps only its own.
- `id` matches a response to its request.
- The helmet handles requests one at a time.

## Operations

| op | Parameters | Returns |
|---|---|---|
| `hello` | – | `firmware`, `protocol`, `board`, `calibrated`, `safetyAccepted`, `maxReachableUT`, `maxFieldUT`, `defaultFieldUT`, `lastSessionEpoch`, `minIntervalS`, `freeHeap`, `fsUsed`, `fsTotal`, `env` |
| `time.set` | `epochMs` | `env` (the app sends its clock on every connect) |
| `env.set` | `kp` (0–9), `ap`, `source` | `env` |
| `settings.get` | – | settings (below) |
| `settings.set` | any subset of the settings | settings; refused while a session runs |
| `session.start` | `session` (preset JSON), `presetId`, `fieldUT`, `blind` | `logId`; needs `safetyAccepted` |
| `session.stop` | – | fades out over 2 s |
| `session.skip` | – | next phase (after the last phase: stop) |
| `session.field` | `fieldUT` | live intensity change, clamped to `maxFieldUT` |
| `test` | `mode` `dc`/`rotate`, `channel`, `mA` (≤ 4.6), `seconds` (≤ 120), `layout`, `dir`, `dwellMs` | `logId: 0` (not logged) |
| `log.list` | `offset`, `limit` (≤ 10) | `total`, `items` (newest first; unrated blind sessions show `condition: "hidden"`) |
| `log.rate` | `id`, `rating` 0–10, `notes` | the entry with its condition revealed |
| `trial.new` | `mode` `rv`/`telepathy`, `manifestHash`, `sets` `[{id, size}]`, optional `session` + `presetId` + `blind` + `fieldUT` | public trial |
| `trial.lock` | `id`, `responseHash` | public trial (records time, Kp/ap, LST) |
| `trial.judge` | `id` | public trial with `set`, `setSize`, shuffled `order` |
| `trial.ranks` | `id`, `ranks` (rank per display position, a permutation of 1..N) | public trial |
| `trial.reveal` | `id` | full trial: `condition`, `target`, `nonce`, `preimage`, `targetRank` |
| `trial.abort` | `id` | – (the trial stays listed as `aborted`) |
| `trial.sender` | `id` | `{set, target, manifestHash}`, only for open telepathy trials |
| `trial.get` / `trial.list` | `id` / `offset`, `limit` | public trial(s) |

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
| `keepaliveS` | Stop if no app has been connected this long; 0 = off |
| `bleName` | Applies after a restart |
| `lastSessionEpoch` | Read-only |
| `safetyAccepted` | |
| `maxCurrentMA` | Read-only |

**Status notification:** `state` (`idle`/`running`/`stopping`), `armed`, `blind`, `test`, `logId`, `sessionId`, `sessionName`, `phaseName`, `phase`, `phaseCount`, `elapsedMs`, `programMs`, `totalMs`, `phaseMs`, `phaseDurationMs`, `envelope`, `fieldUT`, `testMA`, `overruns`, `lastStopReason`, `levels[8]`. The `levels` field is omitted in blind sessions, since it would reveal a sham.

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
| Pattern `type` | `off`, `dc`, `sine`, `chirp`, `burst`, `thomas`, `pulse`, `semirandom`, `table` (needs `tableData`, values 0–255, at most 8192) |
| Spatial `mode` | `bilateral`, `left`, `right`, `rotate`, `cycle` (one `side`), `alternate` (`alternateMs`), `single` (`channel`) |
| Dwell | `"dwellMs": 20` (fixed) or `"dwell": [start, step, end]` (ramp, repeats) |
| Duration | `minutes` or `seconds` per phase; the total must be ≤ 60 min |

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
