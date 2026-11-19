# Library notes: the lab's signals and protocols

These are reading notes. They were taken in November 2026 while every program of the library was checked against its sources ([PRESET_AUDIT.md](PRESET_AUDIT.md)), and they are published as they were taken: one row per statement, with the page and, where it is short, the passage. Pages are PDF page numbers with the printed page in brackets, for example `p.3 [661]`. The last column says how a statement was read: `image` on the page image, `text` in the text layer only (scans confuse µT with mT and drop minus signs, so no decision rests on such a value alone), `web` on a web page. Statements about the vendor's products come from the vendor's own pages and are claims. Nothing here was measured on a helmet.

## Sources read

- **Page**: PDF page index , journal page in brackets.
- **`verified`: **image**: the number was read on the page image; **text** = text layer only (the reason is given: born-digital PDF, or no number at stake); **web** = fetched page.
- **Helmet figures used for conversions (calculated with this project's coil model, not measured): 44 µT/mA at the scalp (3 mm), 8.2 at 10 mm, 1.86 at 20 mm, 0.33 at 40 mm; so `uT: 1`**: 23.7 µT at the scalp, 4.4 µT at 10 mm, 0.18 µT at 40 mm; one DAC step = about 4 nT at 20 mm.

## Apparatus and protocol facts

| claim | value | where measured / context | source (library path or URL) | page | quote | verified |
|---|---|---|---|---|---|---|
| Helmet coils | 2 sets of 4 solenoids: 250-ohm relay coils with a steel nail as core | each set on an ellipsoid on one side of a motorcycle helmet, long axis at mid-temporal level | Richards 1993| p.3 [73] | "two sets of four solenoids (250 ohm coils from 5 V DC relays, with the reed removed and replaced with a small steel finishing nail). Each set was embedded along an ellipsoid on each side of a medium size motorcycle helmet." | image |
| Commutator | 0.5 s per position, 2 s per rotation | standard setting of the helmet | Richards 1993| p.3 [73] | "the commutator shifted the field sequentially to each solenoid every .5 sec, the focus of the magnetic field rotated spatially around the ellipsoid once every 2 seconds" | image |
| One left-right pair at a time | pair = one left + one right solenoid, 0.5 s | helmet, 2000 case | Persinger 2000| p.3 [661] | "for any given 0.5-sec. interval only one pair (one left, one right) of solenoids was activated so that the flux lines could penetrate through the horizontal axis of the cerebrum" | image |
| Pair wiring | each pair in series with poles aligned (S-N … S-N); 4-channel sequencer "(0.5 seconds) 12341234..."; 8-bit DAC | Fig. 1 schematic | Persinger 2000| p.4 [662] | "Example Channel 1 … 4 Channel Sequencer (0.5 seconds) 12341234... Digital to Analogue Converter (8 bit)" | image |
| Slower commutation, LTP studies | 10 s per pair, 40 s per sweep | 1994 pleasantness and 1996 memory study | Persinger 1994; Pauline 1996| p.2 [192]; p.3 [143] | "Each homologous pair of solenoids was activated for 10 sec through a commutator such that a complete sweep of the brain region occurred once every 40 sec." | image |
| Slower commutation, Tiller 2002 | 5 s per pair, 20 s per rotation | eight 5-min blocks | Tiller 2002| p.2 [27] | "Each pair of the four pairs of solenoids generated the fields for 5 sec. It took 20 sec. for a complete rotation." | image |
| Field of the helmet, 1993 Exp. I | 20-30 mG; 2-10 mG; 1-3 mG | external edge of the skull; approximate midline of brain between the solenoid pairs; frontal and occipital positions | Richards 1993| p.3-4 [73-74] | "the field strength along the external edge of the skull was 20 to 30 milligauss (mG); within the space between (approximate midline of brain) the four pairs of solenoids the magnetic field strength … varied between 2 mG to 10 mG" | image |
| Field of the helmet, 1993 Exp. II | 20-40 mG; 8-11 mG (0.8-1.1 µT) | edge of the skull; midline of brain | Richards 1993| p.7 [77] | "Along the edge of the skull the field strengths were 20 mG to 40 mG. Within the space between the sets of solenoids (midline of brain), the values varied between 8 mG and 11 mG (.8 to 1.1 microT)." | image |
| Field of the helmet, 1999 | 1-5 µT; 200 nT-1 µT; side ratio 10 | level of the scalp over the stimulated hemisphere; air measurement at the depth of the deep cortical layers | Persinger 1999| p.2 [164] | "The maximum field strength over the stimulated hemisphere ranged between 1 and 5 µT (10 and 50 mG) at the level of the scalp. Air measurements at the approximate distance of the deep layers of the cerebral cortices ranged between 200 nT and 1 µT." | image |
| Field, 2000 case, Thomas phase | 5 µT right, 1 µT left | level of the scalp | Persinger 2000| p.3 [661] | "the magnetic field strength at the level of the scalp averaged 5 microTesla over the right temporal region and 1 microTesla over the left homologous region" | image |
| Field, 2000 case, burst phase | 2 µT peak, both sides equal | level of the scalp | Persinger 2000| p.5 [663] | "applied with equal strength (peak of 2 microTesla at the level of the scalp) through both sides of the helmet" | image |
| Field, Tiller 1994 | 10 mG (1 µT) stimulated side, 1 mG other side, ±10% | estimated volume of the temporal cortices | Tiller 1994| p.2-3 [158-159] | "approximately 10 mG (1 microT) within the estimated volume of temporal cortices and a field strength of approximately 1 mG (0.1 microT) within the homologous region of the left side" | image |
| Field, Richards 1996 | 10 mG (1 µT); other side 1 mG | "the distance that would have been within the skull" | Pauline 1996| p.3 [143] | "the strength of the field at the distance that would have been within the skull along both temporal regions was 10 mG (1 microT) when the field was applied symmetrically" | image |
| Field, Healey 1996 | 10-50 mG (1-5 µT); other side about 1/10 | "over the activated hemisphere" (plane not named) | Healey 1996| p.3 [203] | "The field strength over the activated hemisphere was 10 to 50 mG (1 to 5 microT) while the strength over the non-stimulated side was about 1/10 this value." | image |
| Field, Persinger & Healey 2002 | 1 µT; 100 nT; activated side 2-3 times the other | inside of the helmet; midpoint between its sides; bilateral condition | Persinger 2002| p.3 [535] | "the strengths ranged between 100 nT near the midpoint between the sides of the helmet and 1 µT along the inside of the helmet during bilateral stimulation … the strength of the field on the activated side was about two to three times the value on the nonactivated side" | image |
| Field, Tiller 2002 | about 1 µT (10 mG), an average | over the scalp | Tiller 2002| p.2 [27] | "The average intensity over the scalp from these fields was approximately 1 microTesla (10 milligauss)." | image |
| Field, Persinger 2009 | about 1 µT | inside edge of the lateral sides of the helmet | Persinger 2009| p.3 [376] | "The strength of the field was about 1 microTesla along the inside edge of the lateral sides of the helmet" | image |
| Field, Saroka & Persinger 2013 | 1-5 µT; side switch attenuates about 10% | volume of the helmet occupied by the head | Saroka 2013| p.4 [398] | "The rapidly changing magnetic field strengths within the volume of the helmet occupied by the subject's head ranged between 1 and 5 µT (or between 10 and 50 mG). A small switch on the left and on the right side of the helmet allowed attenuation (by about 10%)" | image |
| Field, Meli 2009 | right 2 µT higher than left; no absolute value | "along the left-right hemispheric plane" | Meli 2009| p.3 [70] | "The intensity along the left-right hemispheric plane was 2 uT higher over the right hemisphere compared to the left." | image |
| Field, Booth 2005 | 1-2 µT (root mean square) | inside of the helmet between the solenoid axes | Booth 2005| p.4 | "The strengths (root mean square) of the magnetic fields along the inside of the helmet between the axes produced by the sets of solenoids were about 1 to 2 microTesla." | text (born-digital PDF) |
| Field, Granqvist 2005 (independent test) | 3-10 µT | distance from the solenoids "estimated to correspond to the intracranial distance" | Granqvist 2005| p.3 [3] | "fields were between 3 and 10 µT at distances from the solenoids that were estimated to correspond to the intracranial distance" | image |
| Field, Persinger & Makarec 1987 | 4 Hz: 180 mG and 5 mG; 1 Hz: 30 and 1 mG; 7 Hz: 300 and 8 mG | within 1 cm of the nearest solenoid inside the helmet; 4 cm inside the helmet ("approximate depth of hippocampus") | Persinger 1987| p.2 [445] | "within 1 cm of the nearest solenoid inside of the helmet was 180 mgauss and 5 mgauss at 4 cm within the helmet (approximate depth of hippocampus) for the 4-Hz field. These values for the 1-Hz field were 30 mgauss and 1 mgauss, respectively; they were 300 mgauss and 8 mgauss for the 7-Hz field." | image |
| Field, Michaud 1985 | at most 1 gauss | commercial Relaxit devices, place not stated | Michaud 1985| p.2 [417] | "The 5-Hz and 20-Hz devices generated magnetic fields (≤ 1 gauss) whose characteristics have been reported elsewhere (5)." | image |
| Field, Lehman 2016 (ring of 8 solenoids, not the helmet) | 1-5 µT, average 1-2 µT | along the inside of each solenoid | Lehman 2016| p.66 [57] | "along the inside of each solenoid was 1 to 5 μT with the average within the cross-sectional area of approximately 1 to 2 μT" | text (born-digital thesis) |
| Meaning of "once every N s" | N s = pause between presentations | burst-firing, 230 points at 3 ms | Persinger 1999| p.3 [165] | "The resulting burst pattern occurred for approximately 700 ms. The time between the presentation of the pattern was 4000 ms (4 s). There were 380 presentations of the pattern during the 30-min period." | image |
| Same convention, 2000 case | the "3,000 msec" are the pause: discharges are sorted into four bins (during the burst; first, second and third second after it; chi-square with 3 df) | burst phase | Persinger 2000| p.10 [668] | "were either concurrent with one of the 600-msec. burst patterns (n = 4) or followed the termination of one of the bursts within the first second (n = 2). They did not occur during the second and third second after the cessation of the field" | image |
| Same convention, defined | interstimulus time = time between whole patterns | rat study, both patterns | Persinger 1999| p.4 [489] | "The interstimulus time was the time between the presentation of the whole pattern while the pixel duration was the time the voltage value (between 0 and 255) or a pixel was generated" | image |
| Same convention, theses | 3 ms (Thomas), 3000 ms (burst) between patterns | Helmholtz coil, planarians | Murugan 2013| p.45 [45] | "The time between the patterns was 3 ms for the Thomas pulse and 3000 ms for the burst-firing pattern" | image |
| Persinger 1994: design | 40 people, 4 arms of 10; double blind; goggles; acoustic chamber | pleasantness study | Persinger 1994| p.1-3 [191-193] | "A total of 40 normal men and women were exposed under double blind conditions for 20 min to either sham-conditions or to 1 microT (10 mG) electromagnetic fields" | image |
| Persinger 1994: on/off schedule | 5 min on, 5 min off; 15 min of field; 30 min in all; abstract and Table 1 say 20 min | same | Persinger 1994| p.2 [192] | "The computer was on and off for successive periods of 5 min for a total of 15 min of exposure to the magnetic field patterns. … At the end of the 30 minutes of exposure" | image |
| Persinger 1994: result | sham +0.9, both +0.8, left +0.1, right +1.2 (SD 0.6-0.9) | pleasantness -2…+2 | Persinger 1994| p.3 [193] | "There was no significant difference for pleasantness scores between the bilateral field application and sham-field condition." | image |
| Richards 1996: schedule | LTP pulse once every 4 s; 5 min off / 5 min on, 15 min of field, 30 min in chamber | after a 5-min story | Pauline 1996| p.3 [143] | "the person was exposed to the LTP pulse once every 4 s for a total of 15 min (successive sequences of 5 min off and 5 min on; total time in chamber 30 min)" | image |
| Persinger & Makarec 1987: cue | 4-Hz sine wave, two pairs of solenoids, caudal part of the matrix | conditioning sessions | Persinger 1987| p.1-2 [444-445] | "a 4-Hz sine-wave field distributed along the caudal portion of the solenoid matrix was used as the cue … a 4-Hz field was generated simultaneously at two pairs of solenoids" | image |
| Persinger & Makarec 1987: timing | field 30 s per target (15 s blank + 15 s slide); 40 trials; 4-8 targets (stars); guess about 10 s into the blank; 17 sessions | one subject | Persinger 1987| p.2 [445] | "The total single presentation of either the conditioning or control fields was 30 sec. (15 sec. during blank period; 15 sec. during symbol presentation). Each session consisted of 40 trials during which there were between four and eight star stimuli presented." | image |
| Meli 2009: burst | 239 points, 3 ms, once every 4 s, about 380 presentations in 30 min | Koren helmet, eyes open | Meli 2009| p.3 [70] | "A burst-firing magnetic field, composed of 239 points, with point durations equal to 3 msec, was delivered once every 4 sec for 30 min (about 380 presentations)." | image |
| Meli 2009: design and result | 30 people, 6 cells of 5; presence score in white light 1.8 (field) against 5.0 (sham); red light 6.6 against 1.4; green 1.5 against 2.6 | two 40-W bulbs with gels, about 1 m to the side | Meli 2009| p.3-4 [70-71] | "decreased scores for the sensed presence in white light when the burst-firing magnetic field was present (M = 1.8, SD = 1.5) compared to sham field conditions (M = 5.0, SD = 3.5)" | image (p.3); text (p.4) |
| Michaud 1985: design | 32 students, 24 exposed, 8 sham; Relaxit on the left or right side; 60 s in minute 1, 2 or 3 | 3-min story | Michaud 1985| p.1-2 [416-417] | "helmet to which a Relaxit (5) was attached (on either the left or right side at the level of the temporal lobe)" | image |
| Michaud 1985: result | inferences 10.4 (5 Hz), 6.5 (20 Hz), 6.1 (sham) | pooled over minutes | Michaud 1985| p.2 [417] | "the numbers of inferences for each condition were: 5-Hz (10.4 ± 3.7), 20-Hz (6.5 ± 3.0), and reference (6.1 ± 3.5)" | image |
| Sensed-presence protocol | Thomas 849 points, 3 ms, 30 min, 10% stronger on the right; about 5 min questionnaire; Burst-X 289 points, 3 ms, once every 3000 ms, 30 min | helmet, 0.5 s per pair | Saroka 2013| p.4-5 [398-399] | "was presented with a slight 10% increase over the right hemisphere compared with the left. The blindfold was removed, and the exit questionnaire was given (about 5 min were required)." | image |
| Sensed-presence protocol and this helmet | 30 + about 5 + 30 min is longer than this helmet's 60-min session | - | Saroka 2013| p.5 [399] | "The blindfold was removed, and the exit questionnaire was given (about 5 min were required)." | image |
| Sensed-presence protocol: sample | 31 television visitors over 15 years, aware of the purpose; no sham in experiment 1 | experiment 1 | Saroka 2013| p.4 [398] | "a total of 31 participants who visited the laboratory over a 15-year period in order to document the experience for television programs" | image |
| Saroka thesis sentence | 30 min FM (Thomas) "bilateral temporo-parietal", then 30 min BurstX; elsewhere "50 minutes once per week" for the depression studies | summary of the above | Saroka 2015| p.45-46 [28-29] | "The sensed presence protocol consists of a 30-minute bilateral temporo-parietal application of a frequency-modulated pattern (also called the Thomas pattern), followed by a 30-minute application of the BurstX pattern." | text (born-digital thesis) |
| Sculthorpe 2003: point duration | 3 ms for all fields | 5 Hz, 40 Hz, modulated 40 Hz | Sculthorpe 2003| p.3 [1033] | "In the experiment all point durations were 3 msec." | image |
| Sculthorpe 2003: design and result | 24 people, 6 per arm, 30 min; pleasantness sham 1.2, 5 Hz 0.5, 40 Hz 1.8, modulated 0.8; change in HIP -0.8, -0.3, -0.2, 1.0 | blindfolded, dark acoustic chamber; EEG F7/F8, T3/T4, O1/O2 | Sculthorpe 2003| p.3 [1033], p.5 [1035] | "There were three men and three women per treatment." | image |
| Persinger 2009: session | patient seated, blindfolded; 5 min without field; 440 s of field analysed; burst 690 ms, 3-ms points, once every 3 s; 4 pairs, 0.5 s each | laboratory session, one patient | Persinger 2009| p.3 [376] | "For the first five minutes the activity was monitored without the application of the treatment. … The duration of each pulse was 690 ms and the duration of each point that composed the pulse was 3 ms." | image |
| Persinger 2000: schedule | 20 min Thomas (mainly right), questionnaire with blindfold off, 20 min burst (both sides) | one man, EEG at F7, F8, T3, T4, O1, O2; red light; told he "might or might not" receive a field | Persinger 2000| p.3-5 [661-663] | "During the first 20 min. the Thomas pattern … During the second 20 min. a burst-firing pattern (Fig. 2) was applied" | image |
| Persinger 2000: EEG timing | unremarkable until about 12 min; then 16 paroxysmal patterns in 8 min | Thomas phase | Persinger 2000| p.6 [664], p.7 | "until about 12 min. after the beginning of the exposure" | image (p.6); text (p.7) |
| Baker-Price 1996 | 4 patients; 30 min once a week, 5 weeks; boxes 10 cm × 7 cm with four solenoids; once every 4 s | temporoparietal, adhesive strips | Baker-Price 1996| p.4 [494] | "through pairs of four solenoids embedded in small, 10-cm by 7-cm containers attached over the scalp by adhesive strips. The field was delivered once every 4 sec. by a computer." | image |
| Baker-Price 2003 | 14 patients, 7 per arm; 3 left-frontal drop-outs; once every 3 s; "259 values" at 3 ms; 0.5 s per pair | two canisters of four solenoids, Velcro, temporal lobes or left frontal region | Baker-Price 2003| p.3-4 [967-968] | "three of the subjects who had been receiving the left prefrontal treatment did not return for the last two or three sessions" | image |
| Tiller 1994: schedule | 15 min per side, exit questionnaire and HIP after each; 36 people | ping-pong-ball goggles, red light | Tiller 1994| p.2-3 [158-159] | "Each subject received 15 min of stimulation to the left and to the right temporal lobes." | image |
| Tiller 2002: blocks | 8 blocks of 5 min in one fixed order: MCS 1 ms, MCS 3 ms, 10-Hz sine 1 ms, Thomas 1 ms, Thomas 3 ms, reversed Thomas 3 ms, LTP 1 ms, LTP 3 ms; 12 people (9 with any presence) | button presses for side of presence | Tiller 2002| p.2 [27] | "the multiple complexly sequenced pattern (Persinger, St-Pierre, & Koren, 2001) for 1 msec. and then 3 msec.; 10-Hz sine-wave 1 msec; frequency-modulated (Thomas), 1 msec. and then 3 msec.; the reverse frequency-modulated pattern 3 msec.; and the long-term potentiation 1 msec. and then 3 msec." | image |
| Persinger & Healey 2002: pattern and result | Richards-1993 pattern, 3-ms points, 4-s interstimulus, 20 min; presence: sham .3, left 0, right .6, bilateral .8 (12 per arm) | goggles, acoustic chamber, HIP given first | Persinger 2002| p.3-4 [535-536] | "a complex magnetic field (Richards et al., 1993) with 3-msec point durations and 4-second interstimulus presentations" | image |
| Granqvist 2005: protocol | 15 min Thomas (3-ms pixel, 3-ms cycle interval) right, then 15 min burst (3-ms pixel, 3000-ms cycle interval) both sides; 0.5 s per solenoid; 43 field, 46 sham; no effect | Koren's hardware and software on Windows 95 | Granqvist 2005| p.3 [3] | "15 min "Thomas waves" (specific program parameters were 3 ms pixel duration and 3 ms cycle interval) over the right side immediately followed by 15 min of "burst waves" (3 ms pixel duration, 3000 ms cycle interval) bilaterally" | image |
| Persinger's reply to Granqvist | blames Windows timing and the 15-min exposure | letter | Persinger 2005| p.1 | "Faster computers and WINDOWS in particular distort the timing of the point durations … Exposure for 15 min to a particular pattern was suggested for this context, not for a phenomenological or experiential study." | text (born-digital PDF) |
| Gendle & McGrath 2012 | 37 people, 30 min of the 8-coil Shakti "amygdala signal" or sham; no effect on emotional ratings of photographs | commercial device, not the helmet | Gendle 2012| p.1 [217], p.3 [219] | "exposure to magnetic fields did not affect these responses, nor significantly interact with image emotional valence" | text (born-digital PDF) |
| French 2009 | 79 people, 50 min; burst pattern rebuilt from the graph in Persinger 2000; under 50,000 nT; reports unrelated to condition | two wall coils (100 turns of 1200 mm, 200 turns of 800 mm) | French 2009| p.2, p.11 | "The Persinger burst pattern was generated by constructing a table of values from the graph of the waveform used and then converting these numeric values into a 16-bit .wav file using Goldwave (software) at a sample rate of 1000Hz" | text (born-digital manuscript) |
| Fitzpatrick 2004 | rats, 30 min weekly; half the open-arm time after two treatments | elevated plus maze | Fitzpatrick 2004| p.1 | "After two treatments, the rats exposed to the burst-firing fields spent about half the amount of time in the open arms compared to the sham-field exposed rats." | text (short abstract, no setting at stake) |
| Arzy 2006 | one epilepsy patient; left temporoparietal junction; 10.0-11.0 mA | implanted electrodes | Arzy 2006| p.1 [287] | "focal electrical stimulation of the left temporoparietal junction … current amplitude, 10.0 mA" | text (born-digital PDF) |
| Murphy on the first phase | expects it to be unpleasant for some | Shiva "God Helmet" session 2 (chirp right, then amygdala both) | https://www.god-helmet.com/wp/god-helmet/koren_session_list.htm | heading "2)" | "The first phase of this session is expected to be unpleasant for some people." | web |
| Murphy on the sensed presence at home | "less frequent"; reason given: laboratory conditions; no mention of silence | note after the testimonials | https://www.god-helmet.com/wp/god-helmet/index.htm | note after "Testimonials" | "The 'Sensed Presence' experience, common with this technology in experiments by Dr. Michael Persinger, is less frequent with the Shiva System… This may have to do with the rigorous conditions for the laboratory experiments, compared to the way people use it at home." | web (page summarised by the fetch tool; the two sentences were returned as quotes) |

## Published waveforms

### Thomas pattern / Cnp table

| item | what is published | source | page | quote | verified |
|---|---|---|---|---|---|
| Point values | **Published as numbers.** Table 1 of US 6,234,953: 18 columns of 50 = 900 signed 8-bit values (-128…127), read column by column. Values 1-849 are 18 pulses; values 850-900 are zeros. | US patent 6,234,953 | p.48 (cols 27-28); p.37 (col. 6) | "Table 1 represents the 8-bit digital analog values of the specific points used in the construction of FIG. 1 (Cnp used to induce analgesia). The columns are contiguous, that is, they are essentially one long column" | image (table, rendered at 300 dpi and read in four enlarged crops); text (the sentence on p.37) |
| Structure in the table | 18 identical pulses of 28 points; pauses between them of 0, 0, 0, 0, 12, 12, 12, 12, 25, 26, 26, 26, 38, 39, 39, 39, 39 points | computed from the table | - | - | computed |
| Number of points, lab | 849 | Persinger 2000| p.3 [661] | "The pattern contains 849 values between 0 and 255 which are converted to voltages to generate the fields." | image |
| Point duration and repeat interval, lab | 3 ms per point; 3 ms between passes; one pass 2.56 s | same | p.3 [661] | "The pixel duration … was 3 msec. and the time between the generation of each pattern, whose duration was 2.56 sec. (3 msec. multiplied by 849 points + port time), was 3 msec." | image |
| Where "25 Hz to 6 Hz" comes from | counted in the time course at 3 ms per point | same | p.3-4 [661-662] | "the averaged frequency of the Thomas pattern was 25 Hz during the first 200 msec. of each presentation and gradually decreased to about 6 Hz during the last 500 msec. … The delay between successive pairs of peaks was 55 msec. during the first 200 msec. and 156 msec. during the last 500 msec." | image |
| Same pattern, later description | 849 points, 3 ms, 2.55 s; 18 doublet peaks; 2-10 µT | Buckner 2015| p.2 | "Thomas-EMF is a digital file composed of 849 points each programmed for 3 msec (each cycle lasts 2.55 s) (Fig 2). It is composed of 18 doublet peaks (each singlet is 6 ms) with gradually increasing intervals; a 3 ms interval for the first 5 repeats (25Hz) to a 120 ms interval (6 Hz) for the last 5 repeats." | image |
| Point duration, patent | Not stated in the text. FIG. 1: pulse train from 0 to about 850 ms on an axis in milliseconds, amplitude axis ±100 µT, then "4 - Refractory Period"; FIG. 2 is titled "Thomas Pulse (Cnp), Pulse Segment Detail"; FIG. 9: next train at about 3000 ms | US patent 6,234,953| p.2, p.3, p.10; p.36 (col. 3) | "Peak Cnp exposure is set at 100 µT vertical" | image |
| Published as a picture | pixel value against point 0-900 | Persinger 2000Fig. 2; Martin 2004Fig. 1b; Murugan 2013Figure 1 | p.5 [663]; p.3 [219]; p.45 [45] | "Fig. 1. Temporal structure of the two patterns of magnetic fields employed in this study … The duration of each number or point was 3 ms. (a) Burst-firing pattern, (b) frequency-modulated pattern." | image |

Where the sources disagree on the Thomas pattern:

| source | points | point duration | between passes | page | verified |
|---|---|---|---|---|---|
| US 6,234,953 Table 1 | 900 printed (849 + 51 zeros) | not stated (about 1 ms from FIG. 1) | refractory period of "several seconds" (FIG. 9) | p.48, p.2, p.10, p.36 | image |
| Persinger & Belanger-Chellew 1999 | "890 pixel sequences" | 1, 2 or 3 ms | 10 settings from 3 to 3,000 ms | p.4 [489] | image |
| Persinger, Tiller & Koren 2000 | 849 | 3 ms | 3 ms | p.3 [661] | image |
| Dixon & Persinger 2001 (rats) | 837 | 1 ms | once every 4 s | p.1 [87] | image |
| Tiller & Persinger 2002 | not given | 1 ms and 3 ms blocks | not given | p.2 [27] | image |
| Martin, Koren & Persinger 2004 | 849 | 3 ms | 3 ms ("effectively a continuous presentation") | p.3 [219] | image |
| Granqvist 2005 | not given | 3 ms | 3 ms "cycle interval" | p.3 [3] | image |
| Saroka & Persinger 2013 | 849 | 3 ms | not given | p.4 [398] | image |
| Murugan 2013 | 849 (p.44); 859 (p.118) | 3 ms | 3 ms | p.44-45, p.118 | image (p.45); text (others, born-digital) |
| Buckner 2015 | 849 | 3 ms | not given (cycle 2.55 s) | p.2 | image |
| Karbowski 2015 (as LED flashes) | 839 | 3 ms | not given | p.2 [128] | text (born-digital) |
| Carniello 2020 | 859 | 3 ms (3.25 ms in one study) | 3 ms; cycle "approximately 2.58 s" | p.105 [89], p.147, p.186 [170] | text (born-digital) |

### Burst-firing ("Burst-X", "burstx", amygdaloid pattern)

| item | what is published | source | page | quote | verified |
|---|---|---|---|---|---|
| Point values | **Not published as numbers anywhere in the library, but published as a graph four times.** The clearest is pixel value (0-255) against point (0-230). | Persinger 2000Fig. 2 | p.5 [663] | "FIG. 2. Pictorial presentation of the two patterns applied transcerebrally" | image (also rendered at 300 dpi) |
| Same pattern in volts | output voltage about -6…+5.5 V against time 0-280 ms at 1 ms per point | Richards 1993Fig. 1C | p.8 [78] | "FIGURE 1C The burst-firing pattern that was generated by converting a series of preprogrammed successive numbers by computer software to voltage (Y-axis) approximately every 1 millisec." | image |
| Same pattern in volts, 3-ms points | DAC voltage against time 0-700 ms | Martin 2004Fig. 1a | p.3 [219] | "The duration of each number or point was 3 ms. (a) Burst-firing pattern" | image |
| Same pattern, no axes | line drawing | Corradini 2014Figure 2; Murugan 2013Figure 1 | p.20 [9]; p.45 [45] | "Figure 2. Burst-firing magnetic field pattern" | image |
| A table has been made from the graph before | by an independent group | French 2009| p.11 | "The Persinger burst pattern was generated by constructing a table of values from the graph of the waveform used" | text (born-digital manuscript) |
| Origin and first description | values 0-255, 127 = zero; "250" points as printed; 1 ms + 190 µs each; cycle 275 ms; 3.7 repetitions per second; 11 "transits" per cycle | Richards 1993| p.7 [77] | "The duration of each of the 250 successive temporal points that constituted the wave were programmable. We selected 1 msec; this meant that each voltage option lasted for 1 msec + 190 microsec … one cycle of the program required 275 millisec, resulting in 3.7 repetitions per second." | image |
| First schedule | continuous for 10 min, or 250 ms (text) / 1 s (figure caption) every 4 s for 10 min: the paper contradicts itself | Richards 1993| p.8 [78] | "it was presented for only 250 msec once every 4 seconds during the 10 minute period" and "presented continuously for 10 min or for 1 sec every 4 sec for 10 min" | image |
| Standard human timing | 230 points, 3 ms, 690 ms, once every 3,000 ms; 16 peaks per second on average | Persinger 2000| p.5-6 [663-664] | "The pixel duration for each of the 230 points was 3 msec.; this resulted in a duration of 690 msec. This pattern was presented once every 3,000 msec. (3 sec.). Whereas the average frequency was 16 peaks per sec., the interpulse times ranged between the equivalents of 10 Hz and 110 Hz" | image |

What the graph shows (my reading of Persinger 2000 Fig. 2 from the 300-dpi page render; an estimate, about ±1 point and ±3 levels on the flat parts, ±15 levels on the slopes; these are **not** published numbers):

- points 0-10: 148 · 11-20: 138 · 21-30: 128 · 31-33: falling (about 90, 60, 40) · 34: 0 · 35-36: 255 · 37-39: falling (about 235, 185, 152)
- 40-50: 128 · 51-59: 148 · 60-69: 188 · 70-73: falling (160, 100, 55, 20) · 74: 0 · 75-76: 255 · 77-83: falling (220, 175, 142, 110, 80, 52, 24) · 84: 0 · 85-86: 255 · 87-90: falling (220, 170, 150, 125)
- 91-99: 108 · 100-108: 88 · 109-118: 68 · 119-122: falling to 0 · 123: rising · 124-125: 255 · 126-132: falling (243, 208, 167, 124, 90, 53, 17) · 133: 0 · 134-136: 255 · 137-142: falling (210, 170, 135, 105, 75, 43) · 143: 0 · 144: rising · 145-146: 255 · 147-149: falling (240, 204, 160)
- 150-159: 128 · 160-168: 100 · 169-172: falling (95, 72, 40, 16) · 173: 0 · 174: rising · 175-177: 255 · 178: falling · 179-181: 0 · 182: rising · 183-185: 255 · 186-190: falling (232, 200, 165, 115, 30) · 191-192: 0 · 193: rising · 194-196: 255 · 197-200: falling (242, 206, …)
- 201-208: 128 · 209-212: falling (113, 85, 51, 28) · 213: 0 · 214: rising · 215-218: 255 · 219: falling · 220-222: 0 · 223: rising · 224-229: 255

So: 11 spikes from 0 to 255 in groups of 1, 2, 3, 3, 2 (points about 35, 75, 85, 124, 134, 145, 175, 183, 194, 215, 224), each followed by a decay, between flat steps at 148, 138, 128, 188, 108, 88, 68, 100. This agrees with "11 transits per cycle" (Richards 1993 p.7) and "16 peaks per sec." (11 / 0.69 s). The built-in `burst` generator is a smooth sine that sweeps from 6 to 30 Hz over the same 690 ms (about 12 cycles): the same number of peaks, a different shape and spacing.

Where the sources disagree on the burst pattern:

| source | points | point duration | repeat | page | verified |
|---|---|---|---|---|---|
| Richards, Persinger & Koren 1993 | "250" (275 ms at 1.19 ms implies about 231) | 1 ms + 190 µs | continuous, or 250 ms / 1 s every 4 s | p.7-8 [77-78] | image |
| Healey, Persinger & Koren 1996 | 230 | 3 ms | "1 sec every 4 sec" | p.3 [203] | image |
| Persinger 1999 (alpha) | 230 | 3 ms (about 700 ms) | 4000 ms between; 380 presentations in 30 min | p.2-3 [164-165] | image |
| Persinger & Belanger-Chellew 1999 | "290 pixel sequences" | 1, 2 or 3 ms | 10 settings | p.4 [489] | image |
| Persinger, Tiller & Koren 2000 | 230 | 3 ms (690 ms) | once every 3,000 ms | p.5-6 [663-664] | image |
| Ryczko & Persinger 2002 (rats) | 230 | 4 ms | once every 3000 ms | p.2 [593] | text (scan; not checked on image) |
| Persinger & Healey 2002 | not given | 3 ms | "4-second interstimulus presentations" | p.3 [535] | image |
| Baker-Price & Persinger 1996 / 2003 | not given / "259 values" | not given / 3 ms | once every 4 s / once every 3 s | p.4 [494] / p.4 [968] | image |
| Martin, Koren & Persinger 2004 | about 230 (690 ms in Fig. 1a) | 3 ms | ISI 4 s | p.3 [219] | image |
| Martin & Persinger 2004 (30-min) | 230 | not read | once every 4 s | p.2 | text (born-digital) |
| Granqvist 2005 | not given | 3 ms | 3000 ms "cycle interval" | p.3 [3] | image |
| Meli & Persinger 2009 | 239 | 3 ms | once every 4 s, about 380 presentations in 30 min | p.3 [70] | image |
| Persinger, Hoang & Baker-Price 2009 | not given (690 ms) | 3 ms | once every 3 s | p.3 [376] | image |
| Saroka & Persinger 2013 | 289 | 3 ms | once every 3000 ms | p.5 [399] | image |
| Murugan 2013 | 248 | 3 ms | 3000 ms between patterns | p.44-45 | image (p.45); text (p.44) |
| Collins 2014 (Murphy's "amygdaloid signal, normal speed") | 289 | 3 ms | 4000 ms between each cycle | p.40 [31] | text (born-digital) |
| Carniello 2020 | 230 | 3 ms | ISI 3 ms or 3,000 ms | p.101 [85], p.188 [172] | text (born-digital) |

### LTP / primed burst

| item | what is published | source | page | quote | verified |
|---|---|---|---|---|---|
| Timing in the human studies | a 2-ms primer; 150 ms later four 2-ms pulses "separated by 10 msec"; number of points not given | Persinger 1994; Pauline 1996| p.2 [192]; p.3 [143] | "The pattern involved a 2 msec pulse (a primer) followed 150 msec later by four successive 2 msec pulses with each pulse separated by 10 msec." | image |
| Repeat interval, human | once every 4 s (1996); not stated in 1994 | Pauline 1996| p.3 [143] | "exposed to the LTP pulse once every 4 s" | image |
| Point duration | 1 ms and 3 ms versions were used | Tiller 2002| p.2 [27] | "the long-term potentiation 1 msec. and then 3 msec." | image |
| Later verbal description | single pulse, about 170 ms, 4 pulses at 100-200 Hz | Persinger 2010 | p.6 [449] | "a single pulse followed about 170 msec later by 4 pulses in rapid succession with a functional frequency of between 100 and 200 Hz" | text (born-digital) |
| Rat "theta-burst" version | primer, delay, four pulses at about 60 Hz, the whole at 4.5 Hz, repeated 5 times, then an interval of 1 ms, 5 s or 10 s; 0.20-1.71 µT | Delparte 2007| p.2-3 [296-297] | "The pattern was composed of an initial priming pulse followed by a delay (theta) and four pulses at about 60 Hz, resulting in a 4.5 Hz (theta) presentation. This pattern was repeated 5 times and followed by an interstimulus interval (ISI)." | text (born-digital) |
| Rat version, other paper | "100 Hz bursts embedded in a theta (7 Hz) rhythm"; 200-500 nT; 4000-ms interval improved maze memory | McKay 2005| p.1-2 [625-626] | "Application of the theta-burst stimulus with a 4000 ms ISI significantly improved the rats' memory" | text (born-digital) |
| Point values | Not published. One picture without axis numbers: a primer and four pulses, each several points wide, positive only | Corradini 2014Figure 3 and Figure 2 | p.20 [9]; p.103 [92] | "The x axis represents time in 1 ms intervals while the amplitude indicates values between 127 and 256 … The time between the primer pulse and subsequent 4 pulses was 150 ms." | image |

### 7 Hz sine

| item | what is published | source | page | quote | verified |
|---|---|---|---|---|---|
| Construction | six columns of numbers (0-255), each giving a 7.0-Hz sine at a point duration of 1, 3, 5, 7, 10 or 20 ms; 1 µT; 5 min each; six subjects; right hemisphere | Booth 2003| p.1 [951] | "we generated six different columns of numbers whose point durations would produce 7-Hz sine-waves when generated through special software if the duration of each point was either 1 msec., 3 msec., 5 msec., 7 msec., 10 msec., or 20 msec." | image |
| As a control field in 1987 | 7-Hz sine, 300 mG near the solenoid, 8 mG at 4 cm | Persinger 1987| p.2 [445] | "The control fields were either a 1-Hz or 7-Hz sine wave field" | image |
| Point values, number of points | Not published (a sine; the number of points per cycle follows from the point duration: about 143, 48, 29, 20, 14 and 7) | - | - | - | computed |

### 40 Hz and 5 Hz sines

| item | what is published | source | page | quote | verified |
|---|---|---|---|---|---|
| Construction | columns of numbers 0-255, every point held 3 ms; 30 min; 1 µT; right parietotemporal | Sculthorpe 2003| p.3 [1033] | "The shapes of the magnetic fields were created by converting a column of numbers, each between 0 and 255, to voltage. … In the experiment all point durations were 3 msec." | image |
| Point values, number of points | Not published. At 3 ms a 40-Hz wave has 8.3 points (8 points give 41.7 Hz); the paper does not say how this was handled | - | - | - | computed |

### Phase-modulated 40 Hz

| item | what is published | source | page | quote | verified |
|---|---|---|---|---|---|
| Construction | the trough of each successive wave lengthened by 3 ms, four times, then shortened again; five such cycles per second; 3-ms points | Sculthorpe 2003| p.3 [1033] | "The phase-modulated field was created by increasing the trough time for each successive wave by 3 msec. for four successive point durations and then reducing these values to the original value for five complete cycles per sec., without substantially changing the area (energy) under each curve or its shape." | image |
| "Modulated 40 Hz" in Murphy's software | named only | Collins 2014| p.70 [61] | "These two target fields were preceded by "primer" fields, which were '40 Hz Modulated' and '40 Hz Modulated Chirp'. They were variants of a 40 Hz wave frequency" | text (born-digital) |

### Frequency-modulated "chirp"

"Chirp" is not a name the laboratory uses for a waveform in any source of this family. Its "frequency-modulated" pattern is the Thomas pattern (above). The word occurs twice: Murugan 2013 p.44 says the Thomas pulse was "based upon theoretical and chirp-features of communication systems" (text), and Collins 2014 p.70 [61] names Murphy's Shiva primer '40 Hz Modulated Chirp' (text). Murphy's site uses "the 'chirp' signal" for the first phase of his God Helmet sessions (https://www.god-helmet.com/wp/god-helmet/koren_session_list.htm, web). No number of points, point duration, repeat interval or point values are published for a "chirp" in the library, other than the Thomas table itself.

### Other patterns named in these sources

| pattern | what is published | source | page | verified |
|---|---|---|---|---|
| Escalating sine ("4 Hz complex wave") | Fig. 1B: about ten sine cycles of growing amplitude in 240 ms; Tiller 1994 used "a series of sinuosoidal oscillations (equivalent to about 10-12 Hz) whose amplitudes successively increased … for 0.6 sec. once every four sec." | Richards 1993Fig. 1B; Tiller 1994| p.5 [75]; p.2 [158] | image |
| Filtered square-wave pulse ("4 Hz simple spike-wave") | Fig. 1A: one pulse of about 1.4 ms | Richards 1993| p.4 [74] | image |
| "Multiple complexly sequenced" pattern | named only (Persinger, St-Pierre & Koren 2001, not in this family's list) | Tiller 2002| p.2 [27] | image |
| 10-Hz sine | 1-ms points, one 5-min block | Tiller 2002| p.2 [27] | image |
| "Dopamine burst" pattern | 4 spikes of 1 ms with decreasing amplitude, 70 ms apart (Fig. 1); frontal boxes; 1-5 µT; 30 min | Saroka 2013| p.5 [399] | image |

## Places on the head that a source states

No source of this family gives a 10-20 or 10-10 name, an MNI or Talairach coordinate for a coil. What they give:

- **Helmet array**: four solenoids per side "embedded along an ellipsoid … The long axis of the ellipsoid was at the level of the mid-temporal lobes of the average subject" (Richards 1993 p.3 [73], image); "in an elliptical pattern (major axis: 7.5 cm; minor axis: 5 cm) such that the magnetic field maximally penetrated through the temporoparietal regions" (Healey 1996 p.2 [202], image); "four solenoids on each side at the level of the temporal plane" (Persinger 2000 p.3 [661], image).
- **A point relative to the array**: a pick-up solenoid was put "on the surface of the helmet, 5 cm behind the array (approximately P3)" (Richards 1993 p.7 [77], image). So the rear edge of the left array lay about 5 cm in front of P3.
- **1987 matrix**: 5 pairs in a plus; "In the horizontal arrangement the solenoids were spaced every 4 cm (total of 8 cm) along the temporal plane roughly at the level of the midtemporal lobes. In the vertical arrangement, the solenoids were separated by 1.5 cm (5 cm) and were arranged along the level of the dorsal to ventral width of the temporal lobes midway between their rostral-caudal boundaries"; the 4-Hz cue sat "over the posterior portion of the temporal lobes" (Persinger & Makarec 1987 p.1-2 [444-445], image). Solenoids 2 cm long with a 3.5-cm nail of 0.16 cm.
- **Boxes**: "10-cm by 7-cm containers attached over the scalp by adhesive strips", "along and through the temporoparietal regions" (Baker-Price 1996 p.4 [494], image); "over the temporal lobes (just above the ears)" (Tsang 2004 p.5 [1017], text); frontal use: "One container was placed on each side of the forehead (bilaterally above the nasion) at the level of the frontal lobes" (Saroka & Persinger 2013 p.4 [398], image); left-frontal arm of 2003: "over … the left frontal region", no more (Baker-Price 2003 p.3 [967], image).
- **Independent replication**: "two magnetic field blocks placed bilaterally, horizontally to their temporal lobes, just above and in front of the ears" (Granqvist 2005 p.3 [3], image).
- **Murphy's cap in the lab**: 4 solenoids per side on a Velcro square, "separated 5 cm in the vertical plane and 8 cm in the horizontal plane" (Collins 2014 p.69 [60], text).
- **Relaxit, 1985**: on the helmet "on either the left or right side at the level of the temporal lobe" (Michaud 1985 p.2 [417], image).
- **LED device, 2015**: "just behind the right ear at the level of the temporal lobe" (Karbowski 2015 p.2 [128], text).
- **Recording sites only** (not coils): F7, F8, T3, T4, O1, O2 (Persinger 2000 p.3 [661]; Sculthorpe 2003 p.3 [1033]; Persinger 2009 p.3 [376]; Baker-Price 2003 p.3 [967]).

## What could not be checked

- https://web.archive.org/web/2011/http://www.laurentian.ca/Laurentian/Home/Departments/Behavioural+Neuroscience/Correspondence/Email+2.htm (cited by `persinger-synthetic-ghost-2000`): the fetch tool refuses web.archive.org and the page is not in the library.
- Not in the library: Thomas, Kavaliers, Prato & Ossenkopp 1997 (first print of the Thomas pattern); Mantle & Persinger 1983 (the Relaxit devices); Rose, Diamond, Pang & Dunwiddie 1988 (primed burst); Persinger 2003 ("for diagrams"); Persinger, Koren, Makarec, Richards & Youlton 1991 (the escalating-sine software).
- This helmet-side conversions (24 µT at the scalp per 1 µT at 20 mm, and the `uT` values proposed from them) rest on the calculated coil model given in the audit instructions.
