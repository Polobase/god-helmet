# Simulation fixtures

- `rc-lowpass.cir` must pass: R = 10k and C = 10n give fc = 1/(2πRC) = 1591.55 Hz.
- `rc-lowpass-fail.cir` must fail. It checks that the `@assert` gate actually catches a wrong value and a missing measurement.

`bun run sim -- tests/fixtures/sim/rc-lowpass.cir` runs a bench by hand. Output goes to `build/sim/<name>/`.

## ngspice-47/

This folder holds unmodified ngspice 47 output (Homebrew, macOS arm64), captured on 2026-09-24. The pure
parser tests read these files.

- `tran-real-2vec.dat` is cut down to the first 5 rows.
- All other files are complete.

They were made by running `LC_ALL=C ngspice -b -o capture.log capture.cir` with no `.spiceinit` present, on this netlist:

```spice
* ngspice output capture for the parser fixtures
V1 in 0 DC 0 AC 1 SIN(0 1 1k)
R1 in out 10k
C1 out 0 10n
.param fval=5
.ac dec 1 10 1k
.tran 250u 1m
.meas tran vmax MAX v(out)
.meas tran tvmax MAX_AT v(out)
.meas tran tdiff TRIG v(in) VAL=0.5 RISE=1 TARG v(in) VAL=0.5 RISE=2
.meas tran vpp PP v(out) from=0 to=1m
.meas tran vfind FIND v(out) AT=0.5m
.meas tran tcross WHEN v(in)=0 FALL=1
.meas tran yadd param='fval + 7'
.meas tran never WHEN v(out)=5 RISE=1
.control
set wr_singlescale
set wr_vecnames
ac dec 1 10 1k
wrdata ac-real-names.dat vdb(out) vp(out)
unset wr_vecnames
wrdata ac-complex.dat v(out)
unset wr_singlescale
set wr_vecnames
wrdata ac-complex-2vec-names.dat v(out) v(in)
tran 250u 1m
unset wr_vecnames
wrdata tran-real-2vec.dat v(in) v(out)
meas tran cmax MAX v(out)
let gain = 2.5
print gain
quit
.endc
.end
```
