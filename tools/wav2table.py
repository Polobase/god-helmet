#!/usr/bin/env python3
"""Convert a WAV file into a point table (0..255) for the firmware.

Shakti-style sessions are audio files whose waveform is the field pattern.
This averages the audio over each point duration (e.g. 1 ms) and normalises
it to the full table range. Stereo files: pick --channel left/right/mix; to
reproduce left/right alternation, convert each channel separately and use two
phases with spatial "left" and "right".

    python3 tools/wav2table.py signal.wav --point-ms 1 -o signal.csv
"""
import argparse
import struct
import sys
import wave

MAX_POINTS = 8192


def read_wav(path):
    with wave.open(path, "rb") as w:
        n_ch, width, rate, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if width == 1:
        samples = [(b - 128) / 128.0 for b in raw]
    elif width == 2:
        samples = [s / 32768.0 for s in struct.unpack("<%dh" % (len(raw) // 2), raw)]
    elif width == 3:
        samples = []
        for i in range(0, len(raw), 3):
            v = int.from_bytes(raw[i:i + 3], "little", signed=True)
            samples.append(v / 8388608.0)
    elif width == 4:
        samples = [s / 2147483648.0 for s in struct.unpack("<%di" % (len(raw) // 4), raw)]
    else:
        sys.exit(f"unsupported sample width {width}")
    channels = [samples[c::n_ch] for c in range(n_ch)]
    return channels, rate


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wav")
    ap.add_argument("--point-ms", type=float, default=1.0)
    ap.add_argument("--channel", choices=["left", "right", "mix"], default="mix")
    ap.add_argument("--start-s", type=float, default=0.0, help="skip the first seconds")
    ap.add_argument("--no-normalise", action="store_true")
    ap.add_argument("-o", "--output")
    args = ap.parse_args()

    channels, rate = read_wav(args.wav)
    if args.channel == "left" or len(channels) == 1:
        sig = channels[0]
    elif args.channel == "right":
        sig = channels[1]
    else:
        sig = [sum(v) / len(v) for v in zip(*channels)]
    sig = sig[int(args.start_s * rate):]

    per_point = max(1, int(round(rate * args.point_ms / 1000.0)))
    points = [sum(sig[i:i + per_point]) / len(sig[i:i + per_point]) for i in range(0, len(sig), per_point)]
    if len(points) > MAX_POINTS:
        print(f"note: truncated {len(points)} -> {MAX_POINTS} points "
              f"({MAX_POINTS * args.point_ms / 1000:.1f} s); use --start-s or a larger --point-ms",
              file=sys.stderr)
        points = points[:MAX_POINTS]
    peak = max((abs(p) for p in points), default=0) or 1.0
    scale = 1.0 if args.no_normalise else 1.0 / peak
    data = [max(0, min(255, int(round(128 + 127 * p * scale)))) for p in points]

    text = (f"# from {args.wav} ({args.channel}), {len(data)} points of {args.point_ms} ms\n"
            + "\n".join(map(str, data)) + "\n")
    if args.output:
        with open(args.output, "w") as f:
            f.write(text)
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
