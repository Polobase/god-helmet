# Environment

Checked on 2026-09-28 (macOS 26.7, Apple Silicon, after a fresh setup of this Mac) and again on 2026-11-13
(macOS 26.7.1: Bun 1.4.2, kicad-cli 10.0.6, ngspice-47, OpenJDK 27). `bun run doctor` re-checks the tools it
knows.

| Tool | Version | Install | Used for |
|---|---|---|---|
| git | 2.54.0 (Apple) | Xcode command-line tools | version control |
| Bun | 1.4.2 | `curl -fsSL https://bun.sh/install \| bash` (into `~/.bun`), then `bun upgrade` | runtime, package manager, scripts, tests |
| TypeScript | 7.0.2 (devDependency) | `bun install` | type-checking only (`bun run typecheck`) |
| KiCad | **10.0.6** (pinned to 10.0.x) | `brew install --cask kicad` — needs `sudo` for the demo folder, so run it in a terminal | schematics, ERC, PCB, DRC, Gerbers (`kicad-cli`) |
| KiCad's Python | 3.9.13 with `pcbnew` (inside KiCad.app) | comes with KiCad | `tools/pcb/kicad_pcb.py`: board build, Specctra DSN/SES |
| ngspice | 47 (XSPICE enabled) | `brew install ngspice` | `bun run sim` |
| Java | OpenJDK 27 (Homebrew, keg-only: `/opt/homebrew/opt/openjdk/bin/java`) | `brew install openjdk` | Freerouting 2.4.1, which needs **Java 25** or newer (its classes are version 69) |
| Node.js | not needed | — | not used by the toolchain |

Dependencies are pinned exactly in `package.json` (zod 4.6.5, yaml 2.9.1, fflate 0.8.3,
typescript 7.0.2, @types/bun 1.4.2). The only Python file is `tools/pcb/kicad_pcb.py`, run by KiCad's
bundled interpreter because kicad-cli can neither build a board nor export Specctra.

## Shell setup

- `~/.zprofile` puts `~/.bun/bin` and `/opt/homebrew/opt/openjdk/bin` on PATH. Homebrew's OpenJDK is keg-only,
  and macOS's `/usr/bin/java` is only a stub that offers to install Java. The tools also find Java through
  `$JAVA_HOME` and Homebrew's keg path without PATH.
- Non-login shells don't read `~/.zprofile`; that includes Claude Code's shell, git hooks and some editors. Put
  the same PATH lines in `~/.zshenv` for them.

## KiCad details

- `kicad-cli` is linked into `/opt/homebrew/bin`; the tools also look at `$KICAD_CLI` and
  `/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli`, and refuse anything that is not 10.0.x.
- Every `kicad-cli` call runs with `KICAD_CONFIG_HOME=hardware/pcb/.kicad-config` (gitignored), seeded with
  `system.language = English`, so your own KiCad settings and OS language never change results.
- Stock libraries: the bundle ships packed `.kicad_sym` files under
  `KiCad.app/Contents/SharedSupport/{symbols,footprints}` and no library `LICENSE.md`
  (`lib:import` takes the licence from the GitLab tag, or the pinned copy in `lib/kicad/LICENSE.md`). Vendoring
  from the bundle and from the GitLab `10.0.6` tag gives byte-identical files.
- The installed build reports `Compiler: Clang 16.0.0` (`kicad-cli version --format about`).
- Some stock footprints point at 3D models the Homebrew bundle does not ship (seen 2026-11-13: the HRO
  TYPE-C-31-M-12, the Connfly RJ45, the PJ-320D-4A jack, the WS2812B-2020, two QFNs and the XKB switch).
  `bun run render` shows those parts without a body unless `tools/pcb/render3d.ts` gets a stand-in for them.

### Known KiCad issues and how the toolchain handles them

| Issue | Affects | Handling |
|---|---|---|
| [#25583](https://gitlab.com/kicad/code/kicad/-/issues/25583): points with equal x²+y² merge into one net | builds made with libc++ 22 / Xcode 26 | this build uses Clang 16; the canary test in `tests/kicad/pipeline.test.ts` must pass after every KiCad update |
| [#25582](https://gitlab.com/kicad/code/kicad/-/work_items/25582): ERC JSON positions are 100× too small | 9.0.0–10.0.6, fixed in 10.0.7 | gates use JSON counts/types only; positions come from the `.rpt` report |
| [#25413](https://gitlab.com/kicad/code/kicad/-/work_items/25413): headless DRC can crash on macOS | 10.0.4–10.0.6, fixed in 10.0.7 | not seen so far; if `bun run fab` crashes in DRC, run it from a logged-in Terminal and report |

After upgrading KiCad: run `bun run test:full` (canary, negative ERC variants, re-save fidelity,
fab fixture) before trusting any gate, then update this file.

## Tests

- `bun test` skips suites whose external tool is missing; `bun run test:full` sets
  `REQUIRE_EXTERNAL_TOOLS=1` so a missing `kicad-cli` or `ngspice` fails instead of skipping.
- Integration tests run in temporary folders with their own `KICAD_CONFIG_HOME`.

## Disk space

The KiCad cask needs about 5 GB. On 2026-09-24 the disk was nearly full and tests failed with
`ENOSPC`; clearing the Homebrew and Bun caches (`brew cleanup --prune=all`, `bun pm cache rm`)
freed about 9 GB.
