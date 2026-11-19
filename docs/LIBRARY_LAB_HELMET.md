# Library notes: the lab helmet

These are reading notes. They were taken in November 2026 while every program of the library was checked against its sources ([PRESET_AUDIT.md](PRESET_AUDIT.md)), and they are published as they were taken: one row per statement, with the page and, where it is short, the passage. Pages are PDF page numbers with the printed page in brackets, for example `p.3 [661]`. The last column says how a statement was read: `image` on the page image, `text` in the text layer only (scans confuse µT with mT and drop minus signs, so no decision rests on such a value alone), `web` on a web page. Statements about the vendor's products come from the vendor's own pages and are claims. Nothing here was measured on a helmet.

## Sources read

- **R93**: Richards, Persinger & Koren 1993: Richards 1993, "Modification of activation and evaluation properties of narratives by weak complex magnetic…"
- **R92**: Richards, Koren & Persinger 1992: Richards 1992, "Experimental stimulation by burst-firing weak magnetic fields over the right temporal lobe m…"
- **H96**: Healey, Persinger & Koren 1996: Healey 1996, "Enhanced hypnotic suggestibility following application of burst-firing magnetic fields over th…"
- **P00**: Persinger, Tiller & Koren 2000: Persinger 2000, "Experimental simulation of a haunt experience and elicitation of paroxysmal electroencephal…"
- **PH02**: Persinger & Healey 2002: Persinger 2002, "Experimental facilitation of the sensed presence possible intercalation between the hemisph…"
- **SP06**: St-Pierre & Persinger 2006: St-Pierre 2006, "Experimental facilitation of the sensed presence is predicted by the specific patterns of t…"
- **S13**: Saroka & Persinger 2013: Saroka 2013, "Potential production of Hughlings Jacksons parasitic consciousness by physiologically-patterne…"
- **PK05**: Persinger & Koren 2005 (letter): Persinger 2005, "A response to Granqvist et al Sensed presence and mystical experiences are predicted by sug…"
- **C97**: Cook & Persinger 1997: Cook 1997, "Experimental induction of the sensed presence in normal subjects and an exceptional subject…"
- **T94**: Tiller & Persinger 1994: Tiller 1994, "Enhanced hypnotizability by cerebrally applied magnetic fields depends upon the order of hemis…"
- **B03**: Booth, Koren & Persinger 2003: Booth 2003, "Increased proportions of sensed presences and occipital spikes with 1- and 10-msec point durati…"
- **P99**: Persinger 1999 (alpha): Persinger 1999, "Increased emergence of alpha activity over the left but not the right temporal lobe within…"
- **P97**: Persinger, Richards & Koren 1997: Persinger 1997, "Differential entrainment of electroencephalographic activity by weak complex electromagneti…"
- **C01**: Cook & Persinger 2001: Cook 2001, "Geophysical variables and behavior XCII Experimental elicitation of the experience of a sentient…"
- **D87**: De Sano & Persinger 1987: De 1987, "Geophysical variables and behavior XXXIX Alterations in imaginings and suggestibility during brief…"
- **G93**: Gillis & Persinger 1993: Gillis 1993, "Shifts in the Plutchik emotion profile indices following three weekly treatments with pulsed v…"
- **T02**: Tiller & Persinger 2002: Tiller 2002, "Geophysical variables and behavior XCVII Increased proportions of the left-sided sense of pres…"
- **GQ05**: Granqvist et al. 2005: Granqvist 2005, "Sensed presence and mystical experiences are predicted by suggestibility not by the applica…"
- **GM12**: Gendle & McGrath 2012: Gendle 2012, "Can the 8-coil Shakti alter subjective emotional experience A randomized placebo-controlled st…"
- **DX01**: Dixon & Persinger 2001: Dixon 2001, "Suppression of analgesia in rats induced by morphine or L-NAME but not both drugs by microTesla…"
- **RY02**: Ryczko & Persinger 2002: Ryczko 2002, "Increased analgesia to thermal stimuli in rats after brief exposures to complex pulsed 1 micro…"
- **M04**: Martin & Persinger 2004: Martin 2004, "Thermal analgesia induced by 30-min exposure to 1 microT burst-firing magnetic fields is stron…"
- **P09**: Persinger, Hoang & Baker-Price 2009: Persinger 2009, "Entrainment of stage 2 sleep spindles by weak transcerebral magnetic stimulation in an epil…"
- **TS04**: Tsang, Koren & Persinger 2004: Tsang 2004, "Electrophysiological and quantitative electroencephalographic measurements after treatment by t…"
- **BU15**: Buckner et al. 2015: Buckner 2015, "Inhibition of cancer cell growth by exposure to a specific time-varying electromagnetic field…"
- **PB99**: Persinger & Belanger-Chellew 1999: Persinger 1999, "Facilitation of seizures in limbic epileptic rats by complex 1 microTesla magnetic fields…"
- **F96**: Freeman & Persinger 1996: Freeman 1996, "Repeated verbal interruptions during exposure to complex transcerebral magnetic fields elicit…"
- **COL**: Collins 2014 (thesis): Collins 2014, "Quantitative differences in participants exposed to patterned weak-intensity electromagnetic…"
- **CAR**: Carniello 2020 (thesis): Carniello 2020, "Characterizing the structural Influence of electromagnetic field application geometry on bi…"
- **SAR15**: Saroka 2015 (thesis): Saroka 2015, "A fugal discourse on the electromagnetic coupling of electromagnetic processes in the earth-io…"
- **MUR**: Murugan 2013 (thesis): Murugan 2013, "Physical and chemical changes in planarian and non-living aqueous systems from exposure to te…"
- **PAT76**: US 6,312,376 B1 (Koren & Persinger): US patent 6,312,376

## Koren helmet apparatus

What the sources add up to: a motorcycle (snowmobile) helmet with **four small solenoids on each side**, set on an ellipse about 7.5 cm long and 5 cm high over the temporal / temporoparietal region. Each solenoid was wired to its counterpart on the other side, giving four left-right pairs. An **8-bit DAC** on a DOS PC turned a text file of numbers 0-255 into about ±5 V; a separate **commutator sent that signal to one pair at a time for 0.5 s**, so the active pair went round the ellipse once every 2 s, independent of the pattern's own timing. Switches on the helmet weakened one side. The lab called it the 'Koren helmet' (P00 Table 1; S13 p.4). US 6,312,376 describes a different head set (eight pairs on a headband, the circumcerebral device) with the same DAC and software.

### Solenoids per side and wiring

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Solenoids per side | 4 (two sets of four) | helmet, Exp. I | Richards 1993 | p.3 [73] | "interfaced with two sets of four solenoids (250 ohm coils from 5 V DC relays, with the reed removed and replaced with a small steel finishing nail). Each set was embedded along an ellipsoid on each side of a medium size motorcycle helmet." | image |
| Solenoids per side DISAGREE | 'four pairs ... on each side' (would be 8 per side) | helmet | Richards 1992 | p.2 [668] | "A modified motorcycle helmet within which was embedded four pairs of solenoids on each side along the plane of the temporal lobes was worn during the experiment." | image |
| Solenoids per side | 4 ('a cluster of four') | helmet | Tiller 1994 | p.2 [158] | "A cluster of four solenoids had been embedded within the helmet along each of the two temporal planes." | image |
| Solenoids per side | 4 | helmet | Healey 1996 | p.2 [202] | "Along both sides of the helmet four small solenoids were embedded in an elliptical pattern (major axis: 7.5 cm; minor axis: 5 cm) such that the magnetic field maximally penetrated through the temporoparietal regions of the subject's brain." | image |
| Solenoids per side | 4 | helmet | Persinger 2000 | p.3 [661] | "The helmet contained four solenoids on each side at the level of the temporal plane." | image |
| Solenoids per side (ambiguous wording) | 'four pairs ... on the left and right side' | helmet | Persinger 1999 | p.2 [164] | "The helmet contained four pairs of solenoids embedded in an epileptoid [sic] pattern on the left and right side within the approximate position of the temporoparietal region" | image |
| Pairing | each solenoid connected to the homologous one on the other side | helmet | Persinger 2002 | p.2 [534] | "On both sides of the helmet were four equidistant solenoids that were arranged in an elliptical pattern (Richards et al., 1993). Each solenoid on one side of the helmet was connected to the homologous solenoid on the other side of the helmet." | image |
| One pair active at a time | one left + one right solenoid per 0.5-s interval | helmet | Persinger 2000 | p.3 [661] | "The circuitry was designed such that for any given 0.5-sec. interval only one pair (one left, one right) of solenoids was activated so that the flux lines could penetrate through the horizontal axis of the cerebrum." | image |
| Wiring drawn in the schematic | 4 channels; channel 1 feeds 1R and 1L, both drawn S-N in the same direction (field through the head, not opposing); drawn as one loop through both (series) - my reading of the figure, no text says series | Fig. 1 labels | Persinger 2000 | p.4 [662] | "4 Channel Sequencer (0.5 seconds) 12341234... / Example Channel 1 / 1R S N ... S N 1L / Helmet with 2 solenoid assemblies" | image |
| Wiring DISAGREE (different device) | pair coupled in parallel; some pairs N-N, some N-S | 8-pair headband of the patent, not the helmet | US patent 6,312,376 | p.5 col.3 l.7-16 | "Each output channel of the selector 24 is electrically coupled to a pair of solenoid assemblies 30 (only one pair of which is shown) in parallel, by a shielded cable 32." | image |
| Pairs | 4 pairs (bilateral) | helmet | Saroka 2013 | p.4 [398] | "The Koren helmet contained 4 pairs (bilateral) of solenoids (modified reed switches with small iron cores) embedded within its lateral sides. The circuit was constructed to produce a weak-intensity magnetic field between a single pair of left and right-sided solenoids placed over the temporoparietal region." | image |
| Same layout in two boxes ('Koren boxes') | 4 solenoids per container, homologous pairs | containers strapped to the head | Persinger 1997 | p.2 [528] | "Each container housed four solenoids, each of which was connected to the homologous solenoid within the container placed against the scalp over the opposite hemisphere." | image |

### Solenoid type and core

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Solenoid | 250-ohm coil from a 5 V DC reed relay, reed replaced by a small steel finishing nail | helmet | Richards 1993 | p.3 [73] | "250 ohm coils from 5 V DC relays, with the reed removed and replaced with a small steel finishing nail" | image |
| Solenoid | reed relay Intertan 275-232, reed switch replaced by a steel nail core | patent head set | US patent 6,312,376 | p.5 col.3 l.22-25 | "Each solenoid assembly 30 includes a solenoid constructed from a reed relay (Intertan 275–232) with the reed switch removed and replaced by a steel nail core." | image |
| Solenoid | modified reed switches with small iron cores | helmet | Saroka 2013 | p.4 [398] | "solenoids (modified reed switches with small iron cores)" | image |
| Same part in later lab devices | 5VDC reed relay, Radio Shack #275-232 | '4-D box' for cell cultures | Carniello 2020 | p.101 [85] | "three pairs of reed relay solenoids (5VDC Reed Relay, 0.5A at 125VAC; Radio Shack, Sault Ste. Marie, MI; #275-232)" | image |
| Earlier (1987) electromagnet, not the helmet | 25 cm x 1 cm soft-iron nail, 1050 turns of 20-gauge wire, one per side | retractable arms | De 1987 | p.1 [968] | "retractable arms, each containing a 25 cm (1 cm cross-section) soft iron nail wrapped (1050 turns) with insulated wire (20 gauge)" | image |

### Spacing and shape

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Shape | ellipse, major axis 7.5 cm, minor axis 5 cm | each side of helmet | Healey 1996 | p.2 [202] | "embedded in an elliptical pattern (major axis: 7.5 cm; minor axis: 5 cm)" | image |
| Spacing | 'four equidistant solenoids' on the ellipse | each side | Persinger 2002 | p.2 [534] | "four equidistant solenoids that were arranged in an elliptical pattern" | image |
| Positions on the ellipse | drawn at the ends of the two axes: 1 top, 2 one end, 3 bottom, 4 other end; stepped 1-2-3-4 | schematic (my reading) | Persinger 2000 | p.4 [662] | "4 Channel Sequencer (0.5 seconds) 12341234..." | image |
| Long axis | at the level of the mid-temporal lobes | helmet | Richards 1993 | p.3 [73] | "The long axis of the ellipsoid was at the level of the mid-temporal lobes of the average subject." | image |
| Patent head set (different device) | 8 pairs diametrically opposed on a headband, neighbours about 0.8 inch apart | headband | US patent 6,312,376 | p.5 col.3 l.17-21 | "positioned on the headband so that the solenoid assemblies of each pair are diametrically opposed. Adjacent solenoid assemblies 30 are separated by a distance equal to approximately 0.8 inches." | image |

### Where on the head

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Region | temporal plane / mid-temporal level | helmet | Richards 1993 | p.3 [73] | "The long axis of the ellipsoid was at the level of the mid-temporal lobes of the average subject." | image |
| Region | temporoparietal | helmet | Healey 1996 | p.2 [202] | "such that the magnetic field maximally penetrated through the temporoparietal regions of the subject's brain" | image |
| Only landmark with a 10-20 name | a pickup solenoid 5 cm behind the array was at about P3 | helmet surface | Richards 1993 | p.7 [77] | "by placing a similar solenoid on the surface of the helmet, 5 cm behind the array (approximately P3)" | image |
| Field extent | whole cerebrum, measured | helmet | Saroka 2013 | p.4 [398] | "Although the solenoid clusters were situated over this region, the magnetic field, as measured by power meters sensitive to 10 nT, encompassed the entire cerebrum." | image |
| No 10-20 site for the solenoids | none given in any paper read |  | Richards 1993 | pp.3, 7 |  | image |

### Commutation time per pair and rotation period

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Dwell / rotation | 0.5 s per solenoid (pair), 2 s per rotation | helmet; commutator | Richards 1993 | p.3 [73] | "Because the commutator shifted the field sequentially to each solenoid every .5 sec, the focus of the magnetic field rotated spatially around the ellipsoid once every 2 seconds." | image |
| Sequencer | Gerbrands 300 series; 0.5 s per pair, 2 s cycle | helmet | Tiller 1994 | p.2 [158] | "Each pair of solenoids was activated for 0.5 sec by a Gerbrands 300 series sequencer such that a full spatial cycle (ellipsoid pathway) required 2 sec." | image |
| Dwell / rotation | each of four pairs once every 2 s; commutator outside the chamber | helmet | Healey 1996 | p.3 [203] | "The field pattern was rotated (by a commutator external to the chamber) to each of four pairs of solenoids once every 2 sec (0.5 Hz spatial rotation)." | image |
| Dwell / rotation | 0.5 s per pair, once every 2 s | helmet | Persinger 1999 | p.3 [165] | "a commutator that activated successively each pair of the opposing solenoids for 0.5 s. Consequently the pattern was rotating spatially over the temporoparietal lobes once every 2 s" | image |
| Dwell / rotation | 0.5 s per pair | helmet | Persinger 2002 | p.3 [535] | "The electric current generated from this pattern of voltages was distributed successively for .5 seconds through each pair of solenoids (1 rotation = .5 Hz)." | image |
| Dwell / rotation | 0.5 s per pair, 2 s cycle | 19 experiments | St-Pierre 2006 | p.6 [1084] | "The fields were generated through the brain between each pair of solenoids for 0.5 s before moving to the next pair (complete cycle 2 s)." | image |
| Dwell / rotation | 0.5 s, 2 s | helmet | Saroka 2013 | p.4 [398] | "the field was presented between each pair of the four sets of solenoids for 0.5 s such that one complete spatial (rotational) cycle was 2 s" | image |
| Dwell / rotation DISAGREE | 5 s per pair, 20 s per rotation (as printed; possibly a misprint) | helmet, 8 x 5-min patterns | Tiller 2002 | p.2 [27] | "Each pair of the four pairs of solenoids generated the fields for 5 sec. It took 20 sec. for a complete rotation." | image |
| Why 0.5 Hz | glial oscillations; rat .5 Hz field studies | rationale | Richards 1993 | p.3 [73] | "The rotation frequency was selected because: 1) of its similarity to the endogenous oscillation patterns of glial cells ... and 2) rats exposed to .5 Hz magnetic fields display changes in emotional behaviors and analgesic thresholds" | image |
| Commutation not locked to the pattern | a 26-s beat at each solenoid when the field was on 1 s in 4 | edge of skull, Metex-3800 | Richards 1993 | p.8 [78] | "Because current to the solenoids shifted every .5 seconds and the pulsed field was generated for only 1 second once every 4 seconds in this condition, a sinusoidal intensity period was generated at each solenoid. Direct measurement (Metex-3800; along the edge of the skull), revealed a 26 second period during which time the field strengths ranged from 1 mG to not more than 25 mG." | image |
| Replication copy (two head boxes) | each solenoid 0.5 s | Granqvist's device from Koren | Granqvist 2005 | p.3 [3] | "The waveform signal was cycled in a circular fashion between the solenoids at a rate of 2 Hz, i.e., each solenoid was active for 0.5 s, after which the signal was routed to the neighboring solenoid." | image |

### DAC: bits, voltage range, files, computer

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Resolution | 8 bit | schematic of helmet system | Persinger 2000 | p.4 [662] | "Digital to Analogue Converter (8 bit) (DAC)" | image |
| Resolution | 8-bit values, 200-1000 per pattern | Zenith 1211-DE (159 series) | Persinger 1997 | pp.2-3 [528-529] | "The patterns were produced by converting a sequence of between 200 and 1000 8-bit values ranging between 0 and 255 (128 = zero polarity) to a corresponding voltage at a rate measured in millisecond per point." | image |
| Chip and amplifier | National Semiconductor DAC0800LCN, two-stage LM741CN amplifier, on the PC parallel port; ELPAC WM113 supply | patent embodiment | US patent 6,312,376 | p.4 col.2 l.57-67 | "an interface 14 including an 8-bit digital to analog converter 16 such as that manufactured by National Semiconductor under part No. DAC0800LCN, and a two-stage direct coupled operational amplifier circuit 18 utilizing LM741CN operational amplifiers" | image |
| Voltage range | -5 V to +5 V, 127 = neutral | helmet | Persinger 1999 | p.3 [165] | "Each value for the series of numbers that generated the pattern ranged from 0 to 255 (-5 V to +5 V) where 127 = neutral polarity and values below or above 128 were negative and positive polarity, respectively." | image |
| Voltage range | ± 5 V | 19 experiments | St-Pierre 2006 | p.6 [1084] | "transformed by specific software (various versions of Koren's Complex software) to voltages (± 5 V) through custom built direct to alternating current converters (DACs)" | image |
| Voltage range DISAGREE | -6 V to +6 V (255 = 6 V, 127 = 0 V, 0 = -6 V) | patent | US patent 6,312,376 | p.5 col.3 l.46-51; Fig. 3 p.3 | "value 255 (binary “11111111”) corresponds to an analog voltage equal to 6 volts, value 127 (binary “01111111”) corresponds to an analog voltage equal to 0 volts, and a value 0 (binary “00000000”) corresponds to an analog voltage equal to −6 volts" | image |
| Voltage as plotted | burst-firing output drawn between about +5.5 V and -6 V (read from the graph) | Fig. 1C, y axis 'Output Voltage (Volts)' | Richards 1993 | p.8 [78] | "The burst-firing pattern that was generated by converting a series of preprogrammed successive numbers by computer software to voltage (Y-axis) approximately every 1 millisec." | image |
| Zero code | 127 (below negative, above positive) | helmet | Richards 1993 | p.7 [77] | "values below 127 were negative polarity while those above 127 were positive polarity" | image |
| Zero code DISAGREE | 128 | containers | Persinger 1997 | p.3 [529] | "ranging between 0 and 255 (128 = zero polarity)" | image |
| Value range DISAGREE | 'between 0 and 256' | review | Saroka 2013 | p.3 [397] | "a series of numbers, each between 0 and 256, to a voltage between −5 V and +5 V (127 = 0 V)" | image |
| File format | DOS/ASCII text, one point per line, header = number of points | patent | US patent 6,312,376 | p.5 col.3 l.28-38 | "The DAC file is either in the form of a DOS-text or ASCII-text file with one individual point entry per line. Each individual point has a value in the range of 0 to 255 represented as an 8-bit binary number." | image |
| Software parameters | delay between points, number of repeats, delay between repeats, channel sequence, time per channel, acceleration | patent | US patent 6,312,376 | p.5 cols.3-4 | "(ii) determine the delay between each individual point ... (iv) determine the delay between each repeat of the electromagnetic waveform; ... (vi) determine the duration the electromagnetic waveform is to be applied to each channel" | image |
| Computer | Zenith 159 (Z159) PC | helmet 1992-93 | Richards 1993 | p.3 [73] | "The magnetic fields were generated either by a Heath Schlumberger Function Generator or by a Zenith 159 computer." | image |
| Computer | Zenith XT | helmet 1999 | Persinger 1999 | p.3 [165] | "transformed from the Zenith XT personal computer (port latency = 140 µs) by a custom-built digital-to-analogue converter" | image |
| Software / platform | Complex 1.15, written for XT and 286 PCs under DOS | letter | Persinger 2005 | p.1 [346] | "the software we gave them to generate the magnetic field configurations was designed for XT and 286 IBM PCs using DOS" | image |
| Burst-firing file length | 230 points | helmet | Healey 1996 | p.3 [203] | "Each successive voltage point or pixel was 3 msec and there were a total of 230 successive points." | image |
| Burst-firing file length | 230 points | helmet | Persinger 2000 | pp.5-6 [663-664] | "The pixel duration for each of the 230 points was 3 msec.; this resulted in a duration of 690 msec." | image |
| Burst-firing file length DISAGREE | 250 points (but see calculation 1 below) | helmet 1993 | Richards 1993 | p.7 [77] | "The duration of each of the 250 successive temporal points that constituted the wave were programmable." | image |
| Burst-firing file length DISAGREE | 289 points ('Burstx') | helmet, sensed-presence protocol | Saroka 2013 | p.5 [399] | "the increased frequency-modulated (289 points, “Burstx” pattern) field was presented as 3-ms point durations once every 3000 ms (3 s) for 30 min" | image |
| Burst-firing file length DISAGREE | 290 pixels (Thomas 890) | rat coil | Persinger 1999 | p.4 [489] | "the 890 pixel sequences for the Thomas pattern and the 290 pixel sequences for the burst pattern" | image |
| Burst-firing file length DISAGREE | 248 points (Thomas 849) | planarian coil | Murugan 2013 | p.44 [44] | "The total numbers of points (values between 0 and 256) for the two patterned fields were 849 for the “Thomas pulse” and 248 for the “burst-x” pattern." | image |
| Thomas file length | 849 values | helmet | Persinger 2000 | p.3 [661] | "The pattern contains 849 values between 0 and 255 which are converted to voltages to generate the fields." | image |
| Thomas file length DISAGREE | 837 points | rat solenoids | Dixon 2001 | p.4 [90] | "It was composed of 837 successive temporal points each of which was presented for 1 ms." | image |
| Thomas file length DISAGREE | 859 values | cell cultures | Carniello 2020 | p.105 [89] | "The Thomas-EMF was generated by converting 859 integer values between 0 and 256 to a corresponding voltage of -5 V to +5V (127 = 0V), producing 18 doublet peaks" | image |
| Burst-firing shape is printed | pixel value against point (0-250) and Thomas pattern (0-900) | Fig. 2 | Persinger 2000 | p.5 [663] | "Pictorial presentation of the two patterns applied transcerebrally" | image |
| Burst-firing described in numbers | 16 peaks/s on average, interpulse 10-110 Hz, maximum excursions 12-15 ms | 230 points at 3 ms | Persinger 2000 | p.6 [664] | "Whereas the average frequency was 16 peaks per sec., the interpulse times ranged between the equivalents of 10 Hz and 110 Hz over the duration of the pattern. The durations of the maximum excursions were between 12 msec. and 15 msec." | image |

### Point durations used

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Point duration | 1 ms (programmable) | burst-firing 1993 | Richards 1993 | p.7 [77] | "We selected 1 msec; this meant that each voltage option lasted for 1 msec + 190 microsec (the response latency of the computer)." | image |
| Point duration | 3 ms | burst-firing 1996 on | Healey 1996 | p.3 [203] | "Each successive voltage point or pixel was 3 msec" | image |
| Point duration | 1 ms or 3 ms | 19 experiments | St-Pierre 2006 | p.6 [1084] | "The point duration, the time each value between 0 and 255 was maintained at the particular voltage, was either 1 ms or 3 ms with a port latency of about 100 micro-s." | image |
| Point duration | 1, 3, 5, 7, 10, 20 ms | 7 Hz sine study | Booth 2003 | p.1 [951] | "point (“pixel”) durations of 1, 3, 5, 7, 10, or 20 msec." | image |
| Point duration | 1 ms for most patterns; 2 and 3 ms for two blocks | 23-block sequence, Table 1 | Persinger 1997 | p.4 [530] | "Burst Firing Pattern 49 1 3000" | image |
| Meaning of 'interstimulus' | time between presentations of the whole pattern (a pause, not the cycle) | definition | Persinger 1999 | p.4 [489] | "The interstimulus time was the time between the presentation of the whole pattern while the pixel duration was the time the voltage value (between 0 and 255) or a pixel was generated before the next point value was generated." | image |
| Pause confirmed by count | 0.7 s on, 4000 ms between, 380 presentations in 30 min | helmet | Persinger 1999 | p.3 [165] | "The resulting burst pattern occurred for approximately 700 ms. The time between the presentation of the pattern was 4000 ms (4 s). There were 380 presentations of the pattern during the 30-min period." | image |
| Pause confirmed in words | 1 second on, 4 seconds off | rat study, same schedule | Dixon 2001 | p.4 [90] | "each presentation of the pattern was separated by 4 sec. Consequently, the rat received 12 presentations per min ... this temporal arrangement (1 second on, 4 seconds off)" | image |
| Pause confirmed | 690 ms pattern, 3.69 s cycle at ISI 3 s | cell cultures | Carniello 2020 | p.189 [173] | "The duration of the 230-point burst-firing pattern with PD set to 3 msec was 690 msec while the cycle duration lasted 3.69 s." | image |

### Latency and timing error reported by the lab

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Latency per point | 190 µs; 250 x 1 ms 'required 275 millisec' | Zenith 159 | Richards 1993 | p.7 [77] | "each voltage option lasted for 1 msec + 190 microsec (the response latency of the computer). This meant that one cycle of the program required 275 millisec, resulting in 3.7 repetitions per second." | image |
| Latency per point | 190 µs ('intrinsic delay per pixel') | Zenith 1211-DE | Persinger 1997 | p.3 [529] | "The intrinsic delay per pixel (point) was 190 microsec." | image |
| Latency per point | 190 µs ('disk-to-port') | helmet | Cook 1997 | p.4 [686] | "Real time disk-to-port latency for each pixel was 190 microsec." | image |
| Latency per point DISAGREE | 140 µs | Zenith XT | Persinger 1999 | p.3 [165] | "(port latency = 140 µs)" | image |
| Latency per point DISAGREE | about 100 µs | 19 experiments | St-Pierre 2006 | p.6 [1084] | "with a port latency of about 100 micro-s" | image |
| Pattern length with port time | Thomas 849 x 3 ms = 2.56 s 'with port time' | helmet | Persinger 2000 | p.3 [661] | "each pattern, whose duration was 2.56 sec. (3 msec. multiplied by 849 points + port time), was 3 msec." | image |
| Measured strength depended on point duration | .8, .5, .3 µT for 1, 2, 3 ms points, same file and gain | rat coil, middle cages | Persinger 1999 | p.4 [489] | "For both patterns, the averaged field strengths for the 1-msec., 2-msec., and 3-msec. pixel durations were .8 microT, .5 microT, and .3 microT, respectively, within the cages in the middle of the coil" | image |
| Timing on faster PCs | distorted under Windows / fast computers (lab's claim) | letter | Persinger 2005 | p.1 [346] | "Faster computers and WINDOWS in particular distort the timing of the point durations and disconfigure the temporal patterns of the applied magnetic fields" | image |
| Field check before each subject | presence and 'acoustic signature (timing)' | letter | Persinger 2005 | p.1 [346] | "verified the presence of the field and the appropriate acoustic signature (timing) of the field before each subject" | image |

### Field strength: value, place, instrument

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Field, Exp. I | 20-30 mG (2-3 µT) | along the external edge of the skull | Richards 1993 | p.3 [73] | "the field strength along the external edge of the skull was 20 to 30 milligauss (mG)" | image |
| Field, Exp. I | 2-10 mG (0.2-1 µT); frontal / occipital 1-3 mG | midline between the solenoid sets; Model 113-2 power meter checked with Metex-3800 multimeter and probe (Electric Field Measurement, W. Stockbridge MA) | Richards 1993 | p.4 [74] | "the magnetic field strength [as measured by a Model 113-2 power meter (verified with a Metex-3800 multimeter and probe); Electric Field Measurement, Rte 183, W. Stockbridge, MA 01266; 413-673-1929] varied between 2 mG to 10 mG" | image |
| Field, Exp. II (burst-firing) | 20-40 mG edge of skull; 8-11 mG (.8-1.1 µT) midline; 1-5 mG frontal; 3-7 mG occipital | same helmet | Richards 1993 | p.7 [77] | "Along the edge of the skull the field strengths were 20 mG to 40 mG. Within the space between the sets of solenoids (midline of brain), the values varied between 8 mG and 11 mG (.8 to 1.1 microT)." | image |
| Field, one side driven | 70-90 mG (7-9 µT) stimulated side; 6-10 mG other side; < 1 mG occipital; 2-5 mG frontal | 'over the stimulated side'; Metex M-3800 multimeter and sensor | Richards 1992 | p.2 [668] | "the field strength over the stimulated side was 70 to 90 mG while the residual over the nonstimulated side was 6 to 10 mG; within the occipital area, the field strength was less than 1 mG while within the frontal region the strengths ranged between 2 and 5 mG" | image |
| Field, one side driven | about 10 mG (1 µT) active side, about 1 mG other side, ±10 % | 'within the estimated volume of temporal cortices'; Metex 3800 and probe | Tiller 1994 | pp.2-3 [158-159] | "produced a field strength of approximately 10 mG (1 microT) within the estimated volume of temporal cortices and a field strength of approximately 1 mG (0.1 microT) within the homologous region of the left side; the variability within this space was +/-10%" | image |
| Field | 10-50 mG (1-5 µT) | 'over the activated hemisphere' | Healey 1996 | p.3 [203] | "The field strength over the activated hemisphere was 10 to 50 mG (1 to 5 microT)" | image |
| Field | 5 µT at 1 cm, 1 µT within 4 cm | distance from the source | Cook 1997 | p.4 [686] | "They generated 5 microT fields at 1 cm from the source and 1 microT within 4 cm of the source (within the cortical depth)." | image |
| Field | 1-5 µT at the scalp; 0.2-1 µT at deep cortical distance | scalp; air measurement | Persinger 1999 | p.2 [164] | "The maximum field strength over the stimulated hemisphere ranged between 1 and 5 µT (10 and 50 mG) at the level of the scalp. Air measurements at the approximate distance of the deep layers of the cerebral cortices ranged between 200 nT and 1 µT." | image |
| Field, Thomas phase | 5 µT right, 1 µT left (averages) | level of the scalp | Persinger 2000 | p.3 [661] | "the magnetic field strength at the level of the scalp averaged 5 microTesla over the right temporal region and 1 microTesla over the left homologous region" | image |
| Field, burst phase | peak 2 µT, both sides | level of the scalp | Persinger 2000 | p.5 [663] | "applied with equal strength (peak of 2 microTesla at the level of the scalp) through both sides of the helmet" | image |
| Field DISAGREE (lower) | 100 nT at midpoint, 1 µT inside surface of helmet | bilateral; 'a sensor' | Persinger 2002 | p.3 [535] | "the strengths ranged between 100 nT near the midpoint between the sides of the helmet and 1 µT along the inside of the helmet during bilateral stimulation" | image |
| Field | peak 1 µT (10 mG) | 'distances equivalent to within the cerebrum'; Metex N380 meter with magnetic sensor 140-3-60-1499 (Electric Field Measurements) | St-Pierre 2006 | p.6 [1084] | "The peak field strengths (Metex N380 Meter coupled to a magnetic sensor, 140-3-60-1499, from Electric Field Measurements) at distances equivalent to within the cerebrum were 1 microT (10 mG)." | image |
| Field DISAGREE (same paper) | about 1 µT at the skull, nT at the cortex (calculated) | level of the skull | St-Pierre 2006 | p.3 [1081] | "Although the strengths of these fields are about one microTesla (10 mG) at the level of the skull, they have been calculated to be within the nanoTesla range ... at the depths of the cerebral cortices" | image |
| Field | 1-5 µT | 'within the volume of the helmet occupied by the subject's head'; power meters sensitive to 10 nT | Saroka 2013 | p.4 [398] | "The rapidly changing magnetic field strengths within the volume of the helmet occupied by the subject's head ranged between 1 and 5 μT (or between 10 and 50 mG)." | image |
| Field | about 1 µT | inside edge of the lateral sides of the helmet | Persinger 2009 | p.3 [376] | "The strength of the field was about 1 microTesla along the inside edge of the lateral sides of the helmet through which the fields were delivered." | image |
| Field (boxes) | 1-5 µT | 'within the spatial extension of the pairs of containers'; a field meter | Persinger 1997 | p.3 [529] | "A field meter indicated that field strengths within the spatial extension of the pairs of containers ranged between 1 microT and 5 microT." | image |
| Field meter | sensitive to 10 nT | helmet, 1 µT | Freeman 1996 | p.2 [640] | "The presence and strength of the field over the appropriate regions were verified by a field meter sensitive to 10 nT." | image |
| Field (replication copy) | 3-10 µT | distances 'estimated to correspond to the intracranial distance'; BMM3 meter (Radians Innova) | Granqvist 2005 | p.3 [3] | "fields were between 3 and 10 µT at distances from the solenoids that were estimated to correspond to the intracranial distance" | image |
| Chamber background | < 0.1 mG, 1 Hz-1 kHz | inside chamber | Richards 1993 | p.4 [74] | "Background field strengths (within the 1 Hz to 1 kHz range) were less than .1 mG within the chamber." | image |

### Attenuation between sides

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Side ratio | about 9:1 (70-90 mG vs 6-10 mG) | Metex M-3800 | Richards 1992 | p.2 [668] | "the field strength over the stimulated side was 70 to 90 mG while the residual over the nonstimulated side was 6 to 10 mG" | image |
| Side ratio | 10:1 (10 mG vs 1 mG) | temporal cortex volume | Tiller 1994 | pp.2-3 [158-159] | "approximately 10 mG (1 microT) ... and a field strength of approximately 1 mG (0.1 microT) within the homologous region of the left side" | image |
| Side ratio | 10:1; set by helmet switches that change magnitude, not rate | helmet | Healey 1996 | p.3 [203] | "The different geometries were applied by activating or deactivating switches on the helmet that determined the delivery of the magnitude (but not the rate) of current to the solenoids. ... the strength over the non-stimulated side was about 1/10 this value." | image |
| Side ratio | 10:1 | direct measurement | Persinger 1999 | p.2 [164] | "the activated solenoids produced a field whose strength was approximately 10 times stronger than the nonactivated solenoids" | image |
| Side ratio DISAGREE | 5:1 (5 µT vs 1 µT) | scalp | Persinger 2000 | p.3 [661] | "averaged 5 microTesla over the right temporal region and 1 microTesla over the left homologous region" | image |
| Side ratio DISAGREE | 2-3:1 | switch on the helmet | Persinger 2002 | p.3 [535] | "During either right- or left-side stimulation, which was controlled by activating a switch directly on the helmet, the strength of the field on the activated side was about two to three times the value on the nonactivated side." | image |
| Side ratio DISAGREE | about 10 % ('attenuation (by about 10%)'; 'slight 10% increase over the right') | switch on each side | Saroka 2013 | pp.4-5 [398-399] | "A small switch on the left and on the right side of the helmet allowed attenuation (by about 10%) of the strength of the field to be controlled." | image |
| Sham side effect of the switch setting | 20-40 nT DC higher over the right with switches set, program idle | MEDA FM-300 magnetometer | St-Pierre 2006 | p.6 [1084] | "The former was associated with a 20–40 nT increase (as measured by a MEDA FM-300 magnetometer) in the steady-state (d.c.) magnetic field over the right hemisphere compared to the left when the helmet switches were set for this procedure" | image |

### Session structure (which pattern, which side, how long)

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Single side | burst-firing 1 s every 4 s, right or left, 20 min | 24 people, no sham | Richards 1992 | p.2 [668] | "Each subject was stimulated over the right or the left temporal lobe for 20 min. ... The burst-firing field pattern was generated for 1 sec. every 4 sec. for 20 min." | image |
| Both sides, on/off blocks | field on in alternate 5-min blocks, 3 off-on pairs, 30 min | 4 Hz spike or 4 Hz complex wave vs sham | Richards 1993 | pp.4-5 [74-75] | "The fields were activated every alternative 5 minutes such that there were 3 pairs of field-off and field-on intervals." | image |
| Both sides, burst-firing | 5 min baseline, then 10 min continuous (3.7 repetitions/s) or 250 ms once every 4 s; caption says 1 s every 4 s | Exp. II | Richards 1993 | p.8 [78] | "received the wave pattern (3.7 repetitions per sec) continuously for 10 minutes after the initial 5 minutes of baseline while the other half of the subjects received the same wave pattern except that it was presented for only 250 msec once every 4 seconds during the 10 minute period" | image |
| Each side in turn | 15 min right and 15 min left (or reverse), HIP after each; 10-12 Hz rising sinusoid 0.6 s every 4 s | 36 people | Tiller 1994 | pp.2-3 [158-159] | "This pattern was presented for 0.6 sec. once every four sec. for a total of 15 min. ... Each subject received 15 min of stimulation to the left and to the right temporal lobes." | image |
| Four groups | sham / left / right / bilateral, burst-firing 1 s every 4 s, 20 min | 48 people | Healey 1996 | p.3 [203] | "A subject received only one of four treatments: 1) sham field (no activation of field), 2) field over the left temporoparietal region, 3) field over the right temporoparietal region, and 4) bilateral application of the field" | image |
| Two-phase, 20 + 20 | Thomas (849 x 3 ms, 3 ms between) favouring the right for 20 min; questionnaire; burst-firing (230 x 3 ms once every 3 s) equal both sides for 20 min | one subject | Persinger 2000 | pp.3-6 [661-664] | "During the first 20 min. the Thomas pattern ... During the second 20 min, a burst-firing pattern (Fig. 2) was applied with equal strength ... This pattern was presented once every 3,000 msec. (3 sec.)." | image |
| Two fields per person, 20 + 20 | Thomas 3 ms primarily right 20 min; burst-firing 3 ms once every 4 s both sides 20 min; order reversed in half | 16 people | Cook 2001 | p.1 [447] | "a frequency-modulated (Thomas pulse) pattern with pixel durations of 3 msec. primarily over the right hemisphere for 20 min. and a burst-firing magnetic field with 3-msec. pixel durations presented once every 4 sec. for 20 min. through both hemispheres ... The order of the presentations was reversed in half the subjects." | image |
| Two-phase, 30 + ? | FM (3 ms, 3 ms ISI) preferentially right 30 min, then bilateral burst-firing (3 ms, 4000 ms ISI) | review of 19 experiments | St-Pierre 2006 | p.10 [1088] | "Preferential right hemispheric stimulation with the frequency-modulated field (3 ms point duration, 3 ms interstimulus interval) for 30 min ... Subsequent bilateral stimulation with the burst-firing pattern (3 ms point duration, 4000 ms interstimulus interval)" | image |
| Two-phase, 30 + 30 | Thomas 849 points 3 ms with 10 % more on the right, 30 min; questionnaire about 5 min, blindfold off; Burstx 289 points 3 ms once every 3000 ms, 30 min | 'sensed presence protocol' | Saroka 2013 | pp.4-5 [398-399] | "During the first 30 min, the decreasing frequency-modulated pattern (849 points, the “Thomas pattern”) with 3-ms point durations was presented with a slight 10% increase over the right hemisphere compared with the left. The blindfold was removed, and the exit questionnaire was given (about 5 min were required)." | image |
| Two-phase as summarised | 30 min right-biased slowing FM, then bilateral burst-firing '1 s every 3 s' for 30 min | review | Saroka 2013 | p.3 [397] | "a slowing frequency-modulated field was first applied continuously with a slightly right hemisphere bias for 30 min followed by the equalized bilateral application of an accelerating frequency-modulated (burst-firing) field for 1 s every 3 s for 30 min" | image |
| Two-phase DISAGREE (first phase bilateral) | 30 min bilateral temporo-parietal Thomas, then 30 min BurstX | thesis | Saroka 2015 | p.46 [29] | "presence protocol consists of a 30-minute bilateral temporo-parietal application of a frequency-modulated pattern (also called the Thomas pattern), followed by a 30-minute application of the BurstX pattern" | image |
| Burst-firing alone | bilateral burst-firing or sham, 30 min | two experiments, n = 75 | St-Pierre 2006 | p.7 [1085] | "all subjects (n = 75) received the exit questionnaire after 30 min of exposure to the bilateral burst-firing magnetic field ... or sham field (all equipment operating, but no field generated)" | text |
| Multi-pattern screens | 6 to 8 successive 5-min sequences, counterbalanced, with blank fields | 47 subjects as own controls | St-Pierre 2006 | pp.9-10 [1087-1088] | "The subjects were then exposed to 6 to 8 successive (counterbalanced between subjects) 5-min sequences of different very complex magnetic fields or blank fields (all point values = 127)" | image |
| Exposure length the lab calls necessary | 20-40 min; EEG change needs more than 15 min | letter | Persinger 2005 | p.1 [346] | "exposures of between 20 and 40 min are required for maximum response to weak magnetic fields" | image |
| Replication protocol | sham 30 min, or Thomas right 15 min then burst bilateral 15 min (3 ms; 3 ms and 3000 ms 'cycle interval') | Granqvist, N = 89 | Granqvist 2005 | p.3 [3] | "Participants received either sham-field for 30 or 15 min “Thomas waves” (specific program parameters were 3 ms pixel duration and 3 ms cycle interval) over the right side immediately followed by 15 min of “burst waves” (3 ms pixel duration, 3000 ms cycle interval) bilaterally" | image |

### Sham procedure

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Sham | interface between sources and helmet disconnected | 1993 | Richards 1993 | p.5 [75] | "For the sham field treatment, the same procedures were followed except the interface between the field sources and the helmet had been disconnected." | image |
| Sham | all equipment on except the final switch outside the chamber; sensor found no field | 2002 | Persinger 2002 | p.3 [535] | "The sham-field condition consisted of activating all of the equipment except for the final switch (outside of the chamber) between the generating equipment and the helmet. A sensor indicated no discernable fields generated between the solenoids" | image |
| Sham, two kinds | (a) computer on with a file loaded, program never started; (b) computer idle, helmet circuits off; presence reports 15 % and 6 % | review | St-Pierre 2006 | p.6 [1084] | "Two types of sham field conditions have been employed. The most frequent has involved identical procedures including the activation of the computer for a specific file but the computer program was never activated. The second involved the computer in the resting state and the circuits to the helmet turned off." | image |
| Sham inside a session | blank file, all point values 127 | within-subject designs | St-Pierre 2006 | p.10 [1088] | "blank fields (all point values = 127)" | image |
| Sham inside a session | 'no pulse' 3-min intervals | 1997 | Cook 1997 | p.4 [686] | "The duration of the no-pulse interval was 3 min. while the field intervals were 2.5 min." | image |
| Sham rate quoted by the lab | about 12 % report a presence in a sham field in the dark, quiet room; database 20 % (high scorers) and 9 % (low) | 2001 | Cook 2001 | pp.1-2 [447-448] | "about 12% respond in a sham field when sitting in the dark, quiet room" | image |

### Room: chamber, Faraday cage, light, sound

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Chamber | standard industrial acoustic chamber; signal fed through its wall | 1993 | Richards 1993 | p.3 [73] | "From the sequencer the signal was sent through the walls of a standard industrial acoustic chamber" | image |
| Chamber | double-walled metal acoustic chamber, grounded Faraday cage, 2.74 x 2.54 x 1.98 m, completely dark, chair facing east | review | St-Pierre 2006 | p.5 [1083] | "Each subject sat on a comfortable arm chair, facing eastward, that was housed within a completely darkened, double-walled metal acoustic chamber (which was also a grounded Faraday cage) with the dimensions 2.74 m × 2.54 m × 1.98 m, high." | image |
| Chamber | same dimensions, 'completely darkened', blindfold | letter | Persinger 2005 | p.1 [346] | "housed within a completely darkened acoustic chamber (which is also a grounded Faraday cage with the dimensions 2.74 m × 2.54 m × 1.98 m, high)" | image |
| Geomagnetic field inside | about half the usual intensity | chamber | Saroka 2013 | p.4 [398] | "The room was also a Faraday cage and reduced the local geomagnetic field to about half the usual intensity." | image |
| Light | red photographic bulb, about 1 lux | 1992 | Richards 1992 | p.2 [668] | "within an acoustic chamber wherein the ambient light was generated by a red photographic development bulb (about 1 lux)" | image |
| Light | red light switched on; tape of exotic sounds (Exp. I only) | 1993 | Richards 1993 | p.4 [74] | "a red light was switched on and a tape containing exotic sounds was activated" | image |
| Light | small red photographic light the only illumination | 1994 | Tiller 1994 | p.2 [158] | "A small red photographic developing light was the only background source of illumination." | image |
| Light | dark except one small red light | 2000 | Persinger 2000 | p.3 [661] | "During the experiment the chamber was dark except for a single, small photographer's (red) light." | image |
| Light DISAGREE | lights extinguished / completely darkened | 1997; 2006; 2013 | Persinger 1997 | p.2 [528] | "The chamber doors were closed and the lights were extinguished." | image |
| Light | semidarkness | 1993 | Gillis 1993 | p.1 [168] | "each subject sat in a comfortable chair in semidarkness within an acoustic chamber and was asked to wear a helmet" | image |
| Posture | seated in a comfortable (arm) chair | all studies | Persinger 2002 | p.2 [534] | "each subject was seated in a comfortable armchair that was housed within a commercial acoustic chamber" | image |
| Instruction | experiences are subtle; do not label them | review | St-Pierre 2006 | p.5 [1083] | "The subjects were told that any experiences they might have would be subtle and that they should not try to label them, just experience them." | image |
| Replication room | isolation chamber about 2 m2, ear plugs, light switched off, no blindfold mentioned | Granqvist | Granqvist 2005 | p.3 [3] | "placed them on a comfortable office chair in the center of an isolation chamber, which was approximately 2 m2 in size" | image |

### Eye cover

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Eye cover | two halves of a ping-pong ball lined with cotton, as goggles | 1993 | Richards 1993 | p.4 [74] | "After placing two halves of a ping-pong ball, lined with cotton and fashioned as goggles over the subject's eyes" | image |
| Eye cover | half ping-pong balls filled with cotton | 1994 | Tiller 1994 | p.2 [158] | "After each half of a pingpong ball (filled with cotton) had been placed over the eyes" | image |
| Eye cover | halves of a ping-pong ball filled with cotton; eyes closed | 1999 | Persinger 1999 | p.2 [164] | "The person was then blindfolded by placing halves of a ping-pong ball filled with cotton over each eye. The subject was requested to relax, with the eyes closed" | image |
| Eye cover | goggles | 1996 | Healey 1996 | p.2 [202] | "Goggles were then placed over the eyes of the subject" | image |
| Eye cover | small mask | 1997 | Cook 1997 | p.3 [685] | "The eyes were covered with a small mask." | image |
| Eye cover | modified swimmer's goggles | 2000 | Persinger 2000 | p.3 [661] | "He was blindfolded with a pair of modified swimmer's goggles." | image |
| Eye cover | blindfold, 'because this enhanced the occurrence of a sensed presence' | review | St-Pierre 2006 | p.5 [1083] | "The subjects were also blindfolded because this enhanced the occurrence of a sensed presence." | image |

### Exclusion and geomagnetic conditions

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Exclusion | no history of epilepsy (protocol criterion) | 2000 | Persinger 2000 | p.3 [661] | "The subject did not report a history of epilepsy and consequently met the criterion of the protocol that had been approved by the departmental ethics committee." | image |
| Handedness | right-handed only | 1996; 1999; 2002 | Healey 1996 | p.2 [202] | "A total of 48, right handed, university men and women (ages 19 through 21 years)" | image |
| Time of day | 18:00-22:00 | 1997 | Cook 1997 | p.5 [687] | "All testing occurred during the evening, between 1800 and 2200 hr." | image |
| Geomagnetic condition | A index (Fredericksburg) not above 20 on the day and the day before | 1997 | Cook 1997 | p.5 [687] | "During the day of and the day before the exposures the daily global geomagnetic activity, as inferred by the A values from Fredericksburg, Virginia, did not exceed 20." | image |
| Geomagnetic sensitivity claimed | vestibular reports rise above about 20 nT daily aa | 1997 | Cook 1997 | p.5 [687] | "reports of vestibular experiences increase significantly in our experimental setting if the daily aa (average antipodal) global geomagnetic activity exceeds about 20 nT" | image |
| Geomagnetic sensitivity claimed | correlations .40-.60 with activity over 20-30 nT | review | St-Pierre 2006 | p.6 [1084] | "reliable moderate strength correlations (.40 to .60) between global geomagnetic activity over 20 to 30 nT and both the proportion of alpha rhythms over the temporal lobes" | image |
| Subjects per day | no more than two (2006) / three (2002) |  | St-Pierre 2006 | p.5 [1083] | "No more than two subjects were tested per day." | image |
| EEG watch for discharges | T3/T4 and O1/O2 monitored for 'anomalous synchronized cortical discharges' | 1993 Exp. II | Richards 1993 | p.7 [77] | "The EEG was monitored for each subject to insure that anomalous synchronized cortical discharges did not appear." | image |
| Exclusion in the replication | no epileptic seizure or psychotic phase ever | Granqvist | Granqvist 2005 | p.3 [3] | "Eligible for inclusion were participants who had never experienced an epileptic seizure or psychotic phase." | image |

### Calculations of mine on the figures above (not source statements)

1. Richards 1993 says 250 points at 1 ms + 190 µs take 275 ms. 250 x 1.19 ms = 297.5 ms; 230 x 1.19 ms = 273.7 ms. The stated cycle time fits 230 points, the count every later paper gives; '250' may be a misprint.

2. Persinger 1999: 1800 s / 380 presentations = 4.74 s per cycle = 4.00 s pause + 0.74 s pattern; 0.74 s / 230 points = 3.2 ms per point, i.e. 3 ms + about 0.2 ms latency. So '1 s every 4 s' in the abstracts is about 0.7 s on and 4 s off, and the true point period on the lab's PCs was about 3.1-3.2 ms.

3. Persinger 2000: 849 x 3 ms = 2.547 s; the stated 2.56 s leaves 13 ms of 'port time' for 849 points (15 µs per point), which does not fit the 100-190 µs per point stated elsewhere (849 x 3.14 ms = 2.67 s).

4. Dixon 2001: 837 x 1 ms + 4 s = 4.84 s per cycle = 12.4 per minute; the paper says 12 per minute and 360 in 30 min. A 4-s cycle would give 15 per minute.

5. Side ratios stated for one helmet span 1.1:1 to 10:1 (section 11) and field values near the head span 1 to 9 µT (section 10). On this helmet uT 1 means about 24 µT at the scalp, 1 µT at 20 mm, 0.18 µT at 40 mm (helmet field model): above the lab's scalp figures, equal to its 'within the cerebrum' figures, below its midline figures of Richards 1993.

## Other apparatus and protocol facts (per study)

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Booth 2003: design | 7 Hz sine, points of 1, 3, 5, 7, 10, 20 ms, 5 min each, 6 subjects, balanced order, 1 µT | over the right hemisphere | Booth 2003 | p.1 [951] | "digital-to-analogue computer generated 7-Hz sine-waves were applied with point (“pixel”) durations of 1, 3, 5, 7, 10, or 20 msec. for 5 min. each in a sequential counterbalanced order for six subjects" | image |
| Booth 2003: amplitude | standardised to 1 µT by software gain; place not stated |  | Booth 2003 | p.1 [951] | "The changes in intensity associated with these different durations were standardized to 1 microTesla by adjusting the amplifier function within the software." | image |
| Booth 2003: results | left presences 23, 9, 15, 13, 28, 12 %; spikes 21, 12, 10, 6, 31, 19 % | 1, 3, 5, 7, 10, 20 ms | Booth 2003 | p.2 [952] | "the percentages of left-side responses for the 1-, 3-, 5-, 7-, 10-, and 20-msec. point durations were 23 (SEM: 4), 9 (SEM: 3), 15 (SEM: 5), 13 (SEM: 4), 28 (SEM: 9), and 12 (SEM: 3)" | image |
| Booth 2003 as described later | more intense over the right than the left |  | St-Pierre 2006 | p.10 [1088] | "applied more intensely over the right hemisphere (Sandyk, 1992, 1995) compared to the left" | image |
| Persinger 1999: timing | 230 points, 3 ms, about 700 ms, 4000 ms between, 380 presentations in 30 min | left or right, 30 min | Persinger 1999 | pp.2-3 [164-165] | "The time between the presentation of the pattern was 4000 ms (4 s). There were 380 presentations of the pattern during the 30-min period." | image |
| Persinger 1999: subjects DISAGREE (same paper) | 32 stated; 18 + 18 per side |  | Persinger 1999 | p.2 [164] | "Thirty-two, right-handed, university students ... For 18 of the subjects the switches on the solenoids were set to primarily affect the left hemisphere while the other 18 subjects received the stimulation primarily over the right hemisphere." | image |
| Cook 1997 Exp. I: sequence | no pulse 3 min / 3.3 Hz sine 2.5 min / no pulse / LTP pulse / no pulse / 1.6 Hz sine / no pulse / burst-firing; twice; ISI 4 s; 3-ms points | helmet; bilateral n=4, right n=3, left n=3 | Cook 1997 | p.4 [686] | "These were no pulse, 3.3-Hz sine-wave, no pulse, long-term potentiating pulse (Richards, et al., 1996), no pulse, 1.6-Hz sine wave, no pulse, and the burst-firing pattern (Richards, et al., 1992). The duration of the no-pulse interval was 3 min. while the field intervals were 2.5 min." | image |
| Cook 1997 Exp. II/III: Thomas pulse | 849 points at 1 ms, four 5-min presentations with 3 min off between, 3, 33, 330, 3000 ms between envelopes | containers on temporoparietal scalp (Exp. II) | Cook 1997 | pp.4-5 [686-687] | "was presented four times, 5 min. each, with a 3-min. period of no field between each presentation. The duration of each pixel of the 849 sequential points ... was 1 msec. and the time between presentations of each envelope ... were 3 msec., 33 msec., 330 msec., and 3000 msec." | image |
| Cook 1997: count DISAGREE (same paper) | 9 of 15 (abstract) / 10 of 15 (text) |  | Cook 1997 | pp.1, 4 [683, 686] | "9 of the 15 volunteers ... / Ten of the 15 subjects reported a presence as defined by button presses." | image |
| Cook 1997: exceptional subject | Sean Harribance (footnote); button presses per min 12, 22, 8, 7 for 3.3 Hz, LTP, 1.6 Hz, burst | containers, 0.5-1.5 µT at upper cortex | Cook 1997 | pp.1, 4, 6 [683, 686, 688] | "Thanks to Dr. W. G. Roll and to Sean Harribance for their participation." | image (p.6 numbers: text) |
| Cook 2001: fields | Thomas pulse 3 ms primarily right 20 min; burst-firing 3 ms once every 4 s both sides 20 min; each subject both | 16 people, 8 high / 8 low CPES | Cook 2001 | p.1 [447] | "They were a frequency-modulated (Thomas pulse) pattern with pixel durations of 3 msec. primarily over the right hemisphere for 20 min. and a burst-firing magnetic field with 3-msec. pixel durations presented once every 4 sec. for 20 min. through both hemispheres" | image |
| Cook 2001: results | right Thomas: 75 % of high scorers, 0 % of low; bilateral burst: 60 % and 0 %, n.s. |  | Cook 2001 | p.2 [448] | "60% and 0% of these two groups, respectively, reported a presence after bilateral stimulation (χ² = 3.69, p > .05)" | image |
| De Sano 1987: field | sine at 1 or 4 Hz; 15 gauss at the skull, 2 gauss at temporal cortex, 500 mgauss at hippocampus level, 200 mgauss frontal | rod electromagnets, function generator; instrument not named | De 1987 | p.1 [968] | "the magnetic field intensity was about 15 gauss at the surface of the skull. The field strength at the distance of the temporal cortex was 2 gauss; the maximum field strength was 200 mgauss (factor 10 decrease) at the level of the frontal lobes. At the approximate level of the hippocampus, the field strength was 500 mgauss." | image |
| De Sano 1987: light and room | small green light 2 m away, 15° above horizontal, flashing at field frequency; sham = constant light; dimly lit room |  | De 1987 | p.1 [968] | "observing a small green light 2 m away from and about 15° above the horizontal visual field. The light was flashed at the same frequency as the applied electromagnetic field. Subjects received sham field (constant light), 1-Hz or 4-Hz conditions" | image |
| De Sano 1987: results | 4 Hz: lower heart rate F(2,18)=3.73; HIP sex x field F=4.90; vestibular references F=11.50; imaginings F=3.13 | 8 per group | De 1987 | p.2 [969] | "women showed much greater (8.4 ± 1.1) induction (≈ 3 units) if they had been exposed to the 1-Hz field while men showed much greater (8.0 ± 1.5) induction (≈ 3 units) if they had been exposed to the 4-Hz fields" | image |
| Gillis 1993: arms | continuous burst-firing 50 mG 20 min (n=4); same pattern 1 s every 4 s (n=4); control (n=4); three weekly nights | temporal plane, small solenoids; place of 50 mG not stated | Gillis 1993 | p.2 [169] | "Four subjects received 20 min. of continuous 50-mG (milligauss) magnetic fields that simulate the burst-firing of human amygdaloid neurons while another 4 received this pattern for 1 sec. every 4 sec. during the 20-min. period" | image |
| Gillis 1993: result | aggression change +3.3 control, +7.4 continuous, -0.1 pulsed; trust p between .05 and .10 |  | Gillis 1993 | p.2 [169] | "the means and standard deviations for the change in raw scores were +3.3 (2.3), +7.4 (3.5), and −0.1 (1.9) on aggression" | image |
| Persinger 1997: sequence | 23 blocks in 45 min; burst-firing 49 cycles at 1-ms points with 3000 ms between; LTP 60 cycles, 1 ms, 275 ms between | containers over frontal, temporal or occipital regions | Persinger 1997 | p.4 [530] | "Burst Firing Pattern 49 1 3000" | image |
| Persinger & Healey 2002: scores | presence .3 sham, 0 left, .6 right, .8 bilateral | 48 people | St-Pierre 2006 | p.9 [1087] | "sham (M = .3, SD = .5), left hemisphere exposure (0), right hemispheric exposure (M = .6, SD = .8) and bilateral stimulation (M = .8, SD = .6)" | image |
| Granqvist 2005: device | two head boxes of four solenoids from Koren, Complex 1.15 on a Pentium Pro under Windows 95 | 'just above and in front of the ears' | Granqvist 2005 | p.3 [3] | "A custom built TMS device [18] with associated controller software (Complex 1.15) was run on a PC compatible computer with a Pentium Pro processor, 64 Mb RAM and Windows 95" | image |
| Gendle 2012: blinding | not double-blind (device unplugged for sham); N = 37; outcome: ratings of 54 photographs | 8-coil Shakti amygdala signal, 30 min | Gendle 2012 | p.7 [223] | "The need to unplug the Shakti prevented a true double-blind design (as the experimenter knew when the device was to be disconnected)." | image |
| Collins 2014: Shiva 64-coil signal | 289 points, 3 ms, 4000 ms between cycles, 20 min, about 10 mG | 64-coil Shiva hat | Collins 2014 | p.40 [31] | "The point duration of each of the 289 points was 3 ms with 4000 ms (4 s) between each cycle. The duration of the total exposure was 20 min. The strength of the time-varying magnetic field within the volume occupied by the subjects' heads was about 10 mG (1 microTesla)." | image |
| Collins 2014: Shiva 4+4 cap | 8 telephone pickup solenoids, 4 per side, 5 cm vertical x 8 cm horizontal; right CCW, left CW; one L+R pair at a time; 1-2 µT at centre of cap | baseball cap | Collins 2014 | p.69 [60] | "Solenoids were affixed to a square sheet of Velcro so they were separated 5 cm in the vertical plane and 8 cm in the horizontal plane. ... At any given time only one pair of solenoids (one on the left and one on the right side of the head) was activated. The magnitude of magnetic fields as measured by a power meter ranged from 1 uT to 2 µT in the center of the cap." | image |
| Collins 2014: this family's 'classic' sequence | condition 4: 40 Hz Chirp Right, then Amygdaloid Bilaterally; 20 + 20 min; 3 participants per condition | Table 3 | Collins 2014 | pp.70-71 [61-62] | "Three participants were assigned to each of the eight field combinations." | image |
| Murphy: session | chirp over the right side, then amygdala signal on both; 60 min (30 + 30) or 40 min (20 + 20); phase 1 played 10 % louder; volume not above 82 % | Shiva God Helmet software | https://www.god-helmet.com/wp/god-helmet/god_helm_1_mod40c_r_2_bx_bi.htm | page body | "DO NOT SET YOUR VOLUME HIGHER THAN 82% FOR THIS SESSION." | web |
| Murphy: rotation | clockwise on the left, counter-clockwise on the right |  | https://www.god-helmet.com/wp/god-helmet/koren_session_list.htm | session list | "Over the left side, the direction is clockwise, and over the right, it's [counterclockwise: last word returned outside the quote by the fetch]" | web |
| Murphy: lab helmet coils | four coils per side; two top coils and a centre coil no longer used |  | https://www.god-helmet.com/wp/god-helmet/intro_to_god_helmet.htm | A FIRST LOOK AT THE GOD HELMET | "cycles the signals through four coils on each side of the head over the temporal lobes" | web |
| Murphy: 20 of 2000 | about 20 of about 2000 felt the presence of Christ | Persinger quoted | https://www.god-helmet.com/wp/god-helmet/intro_to_god_helmet.htm | A FIRST LOOK AT THE GOD HELMET | "about 20 or so people (out of approximately 2000) have reported feeling the presence of Christ" | web |
| Murphy: time of night | midnight to 4 am (vendor's account; lab paper says 18:00-22:00) |  | https://www.god-helmet.com/wp/god-helmet/koren_during_sessions.htm | How and When to do your God Helmet Sessions | "primarily conducted at night, when melatonin levels are at their highest, between midnight and 4:00 am." | web |
| Murphy: schedule | at most weekly; no mixing with Shiva/Shakti in the same weeks; 'six sessions', '21 days', 'consecutive' not on the page |  | https://www.god-helmet.com/wp/god-helmet/koren_schedule.htm | The God Helmet Session Schedule | "You shouldn’t do God Helmet sessions more often than once a week." | web |
| Murphy: chirp | falling-frequency chirp built from his modulated 40 Hz signal, Fibonacci-varied amplitude and gaps; 30 min before the amygdala signal |  | https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/mod40_chirp_consent.htm | TECHNICAL INFORMATION; body | "Each phase lasted 30 minutes for a total of one hour." | web |
| Murphy: 'does not change in tone' | said of the modulated 40 Hz signal |  | https://www.god-helmet.com/wp/shiva/shiva_demo/experiment_signals.htm | THE SESSION USED IN PUBLISHED PAPERS | "This signal does not change in tone" | web |

## Places on the head that a source states

No source gives 10-20 or 10-10 names, MNI or Talairach coordinates for the helmet's solenoids. What is given:

- Helmet array: ellipse 7.5 cm x 5 cm per side (H96 p.2 [202]); long axis 'at the level of the mid-temporal lobes' (R93 p.3 [73]); 'temporal plane' (P00 p.3 [661]); 'temporoparietal region' (P99 p.2 [164]).
- A pickup solenoid '5 cm behind the array (approximately P3)' on the helmet surface (R93 p.7 [77]): the only 10-20 name tied to the array; it puts the rear edge of the left array about 5 cm in front of P3.
- De Sano 1987 electromagnets: 'Just rostral to the upper half of the ear' (D87 p.1 [968]).
- Koren boxes: 'over the temporal lobes (just above the ears)' (TS04 p.5 [1017]); 'attached to each temporoparietal region of the scalp by velcro straps' (C97 p.4 [686]); 'placed either over the frontal, temporal, or occipital regions' (P97 p.2 [528]); 'on each side of the forehead (bilaterally above the nasion) at the level of the frontal lobes' (S13 p.4 [398]).
- Granqvist's boxes: 'placed bilaterally, horizontally to their temporal lobes, just above and in front of the ears' (GQ05 p.3 [3]).
- Shiva 4+4 cap: four solenoids per side on Velcro squares '5 cm in the vertical plane and 8 cm in the horizontal plane' on the sides of a baseball cap, position adjustable (COL p.69 [60]).
- Patent head set: eight pairs on a headband, each pair 'diametrically opposed', neighbours about 0.8 inch apart (PAT76 p.5 col.3).
- EEG sites named in these papers are recording sites, not coil sites: T3/T4, O1/O2, F7/F8 (R93 p.7; P00 p.3; SP06 p.5).
