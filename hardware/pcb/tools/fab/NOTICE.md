# Third-party data

## transformations.csv

Copyright 2022 Benny Megidish.

`transformations.csv` is copied unmodified from the Fabrication Toolkit KiCad plugin by
Benny Megidish, https://github.com/bennymeg/Fabrication-Toolkit/blob/038cd1ddbe36c1e013aa3b4f284b0326cc4bdb77/plugins/transformations.csv
(commit 038cd1d, 2024-02-27; still byte-identical at 642b069, 2026-05-15). It is licensed under
the Apache License, Version 2.0; the licence text is in `LICENSE-Apache-2.0.txt` next to this
file (fetched from https://www.apache.org/licenses/LICENSE-2.0.txt on 2026-09-24). Upstream
ships no NOTICE file. The table maps KiCad footprint names (regex) to the rotation/offset
corrections JLCPCB's placement needs. JLCPCB engineers still review rotation and polarity before
assembly (https://jlcpcb.com/help/article/pcb-assembly-faqs-part-2).

### Known conflict: `^VSSOP-8_`

Lines 49 and 50 list the same pattern `^VSSOP-8_` with 180 and with 270, and line 51
(`^VSSOP-8_3.0x3.0mm_P0.65mm`, 270) comes after both. Which value is right is unverified. The
table is kept as upstream ships it, and `cpl.ts` reads it the way the plugin does
(`_get_rotation_from_db`, plugins/process.py @642b069): the first matching line wins, so every
VSSOP-8 footprint gets 180. `loadCorrections` records the conflict, and the fab README lists
every part whose correction another matching line contradicts, to be checked in JLCPCB's
placement preview.
