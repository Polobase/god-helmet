# Library notes: clinical and laboratory low-field methods

These are reading notes. They were taken in November 2026 while every program of the library was checked against its sources ([PRESET_AUDIT.md](PRESET_AUDIT.md)), and they are published as they were taken: one row per statement, with the page and, where it is short, the passage. Pages are PDF page numbers with the printed page in brackets, for example `p.3 [661]`. The last column says how a statement was read: `image` on the page image, `text` in the text layer only (scans confuse µT with mT and drop minus signs, so no decision rests on such a value alone), `web` on a web page. Statements about the vendor's products come from the vendor's own pages and are claims. Nothing here was measured on a helmet.

Helmet figures used for comparison are calculated with this project's coil model, not measured: 105 / 44 / 8.2 / 1.86 / 0.33 / 0.11 µT per mA at the coil face / 3 mm / 10 mm / 20 mm / 40 mm / 60 mm. At the current limit of 4.54 mA: 477 µT / 200 µT / 37 µT / 8.4 µT / 1.5 µT / 0.50 µT.

## What the sources state

| claim | value | where measured / context | source | page | quote | verified |
|---|---|---|---|---|---|---|
| Cnp point spacing | 1 ms | digital representation | US patent 6,234,953| p.41 (col. 14) | "the digital representation of the Cnp at a separation of 1 ms" | text (two-column page; the sentence refers to the FIG. 5 vestibular Cnp) |
| Cnp refractory period in humans | 1200 ms | design rule | US patent 6,234,953| p.38 (col. 7) | "the awareness anticipation time is exceeded (e.g. 1200 ms)" | image |
| Cnp burst and cycle (Camera) | burst 838 ms; refractory 110, 220, 330, 1200 ms; cycle 5212 ms | modelling paper, signal "as taken from the patent" | Camera 2015 | p.2 | "four bursts followed by four different refractory periods lasting in order 110, 220, 330, and 1200 ms; so overall the CNP lasts 5212 ms" | image |
| Cnp burst content (Camera) | 16 couples of biphasic waveforms | Fig. 1 caption | Camera 2015| p.3 | "composed by a sequence of 16 couples of biphasic waveform" | image |
| Cnp segment (Cook, the lab's own EEG papers) | 853 ms segment with 18 pulses; refractory 110, 220, 330, 1200 ms; 15 min | field waveform used on people | Cook 2004 | p.3 [198] | "combined in an 853 ms segment which includes 18 pulses" | image |
| Cnp dB/dt (Cook) | 0.4 T/s maximum, rise time 1 ms | uniform field | Cook 2004| p.3 [198] | "maximum rise time of 1 ms resulting in a maximum time changing MF of 0.4 T/s" | image |
| Cook 2004 field and coils | ±200 µT peak; three orthogonal square Helmholtz-like coils with 2, 1.75 and 1.5 m sides, only the vertical pair powered | whole body, subject seated inside | Cook 2004| p.2 [197] | "Only the vertical coil pair was powered during exposure" | image |
| Cook 2004 session | 2.5 min eyes open + 2.5 min eyes closed, 15 min field or sham, 5 min sampling, 2.5 min eyes closed + 2.5 min eyes open | Table 1 | Cook 2004| p.2 [197] | "MF/sham condition was applied continuously for 15 min" | image |
| Cook 2004 sham and design | amplifiers on, no signal; 20 subjects, field and sham sessions about 1 week apart, counterbalanced | sham ambient 14.7 µT horizontal, 43.3 µT vertical | Cook 2004| p.2-3 [197-198] | "The amplifiers were on but there was no signal during sham exposure" | image |
| Cook 2005 sequence | fourth refractory period 5000 ms (others 110, 220, 330 ms), 853 ms segments, 15 min | EEG read in the 5000 ms pauses | Cook 2005 | p.3 [369] | "followed by a longer fourth refractory period of 5000 ms" | image |
| Cook 2009 two sequences | SEQ1 = 1200 ms (Cook 2004), SEQ2 = 5000 ms (Cook 2005); n = 32 | same coils | Cook 2009 | p.2 [10] | "either 1200 ms for SEQ1 or 5000 ms for SEQ2" | image |
| Cook 2009 cycle count | 170 of the 1200 ms pauses in 15 min (900 s / 170 = 5.29 s per cycle, i.e. 4 × 853 + 660 + 1200 = 5272 ms) | SEQ1 | Cook 2009| p.4 | "SEQ1 had 170 of the 1200 ms refractory periods during the 15 min SEQ1 exposure" | text (clean text layer; corroborates the 853 ms read on image in Cook 2004 and 2005) |
| Thomas 2007 headset field | 400 µT, 1000 Hz or less, 800 mT/s | at the contact point of the headset | Thomas 2007 | p.3 [251] | "(400 µT, 1000 Hz or less, 800 mT/sec) at the contact point of the headset" | image |
| Thomas 2007 field in the head | ±200 µT head surface, ±35 µT deep brain | general statement on the modality (refs 44, 45), not a measurement of this headset | Thomas 2007| p.2 [250] | "(±200 µT head surface to ±35 µT deep brain)" | image |
| Thomas 2007 session | 40 min twice a day, at least 4 h apart, 7 days; headset "just above their ears"; sham headset identical and silent | home use | Thomas 2007| p.3 [251] | "exposure duration of 40 min, and to ensure that there were at least 4 h between successive treatments" | image |
| Thomas 2007 result | fibromyalgia subgroup P = 0.06 (n = 17); "essentially was a negative study" | 32 completers | Thomas 2007| p.1, p.8 | "ours essentially was a negative study" | text (abstract and discussion; not a dose value) |
| Shupak 2006 headset | coils under plastic ear coverings, earpieces over the temples; max 400 µT at the headset, max 200 µT "to the deep brain"; below 1 kHz; pulse design per US 6,234,953; 30 min; sham = zero-amplitude pattern | 13 RA and 18 FM patients | Shupak 2006 | p.2 [86] | "a maximum of 200 µT (2 Gauss) to the deep brain and a maximum of 400 µT (4 Gauss) at the headset" | image |
| Shupak 2004 coils and field | three nested orthogonal Helmholtz-like pairs (2 m square × 1 m apart; 1.751 m × 0.875 m; 1.5 m × 0.75 m); ±200 µT peak, vertical; 0-500 Hz; 30 min | uniform exposure area, subject seated | Shupak 2004 | p.2 [158] | "a magnitude of ±200 µT peak in the vertical direction" | image (text layer prints mT) |
| LFMS waveform (device paper) | alternating trapezoids, ramp 256 µs, dwell 768 µs; 0.5 s bursts every 2 s for 20 min | field waveform | Rohan 2014 | p.3 | "trapezoids with ramp times of 256 microseconds and peak dwell times of 768 microseconds" | image |
| LFMS field and induced E (device paper) | G = 0.95 G/cm; E0 = 0.72 V/m; dG/dt = 74.2 T/m/s; under 20 G in the device; Fig. 1: about ±7.5 G at a point on the head surface | tabletop coil; target field at the end of the device, not its centre | Rohan 2014| p.3 | "Magnetic fields in the LFMS device are less than 20G" | image |
| LFMS coil model and sham | coil modelled as a current distribution on a 35 cm cylinder; sham reproduces the coil sound without field | | Rohan 2014| p.3-4 | "The coil sound is readily duplicated during sham treatment but no electromagnetic fields are produced" | image |
| LFMS original (EP-MRSI) | 512 trapezoids of 1.024 ms per train, every 2 s, 128 trains (4 min) per scan, four scans; gradient 0.3 G/cm, under 10 G in the brain; E about 0.7 V/m, uniform to 5%, right to left, 0.25 ms pulses at 1 kHz | readout gradient of an MRI scanner, whole head | Rohan 2004 | p.3 [95] | "a ramp of 0.3 gauss/cm (G/cm) that reaches a maximum of less than 10 G in the brain" | image |
| LFMS in the multisite trial | 1 ms trapezoids, 256 µs ramps, 500 Hz peak to peak; 0.5 s train every 2 s for 20 min; under 50 G; peak E about 0.5 V/m; head in the coil up to the eyebrows; coil sound replicated by audio | Tal Medical device; 84 patients; null result | Fava 2018| l.160-162, l.74 | "LFMS utilizes low magnetic field strength (< 50 Gauss) with a peak induced electric field estimated to be 0.5 V/m" | text (file is .txt) |
| LFMS dosing study | three 20 min sessions 48 h apart; effect only after the third; n = 30; E ≤ 1 V/m, 1 kHz; superior orbital ridge at the bore opening | single site | Dubin 2019| l.67-71, l.81, l.161 | "There were no differences between sham and LFMS following the initial or second session" | text (file is .txt) |
| LFMS meta-analysis | nine RCTs, 571 patients, SMD −0.61 (95% CI −0.91 to −0.30); certainty low | | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=41911470 (the cited pubmed.ncbi.nlm.nih.gov page returned only a cookie notice) | abstract | "Certainty of evidence on GRADE was 'low' for the primary outcome." | web |
| LFMS home trial (Wu 2026) | twice daily for 2 weeks (28 sessions), home, sham by chip card; clinician-rated outcome not better than sham | 60 randomised | same efetch URL, id=42203049 | abstract | "delivered twice daily for 2 weeks (28 sessions)" | web (session length not in the abstract) |
| Re5 pulse (as driven) | bipolar square pulses, 3 ms each, 12 ms pause, 18 ms sequence, 55 Hz; generator output ±50 V | voltage applied to the coils | Martiny 2010 | p.2 [164] | "The pulses provided by the generator to the coils in the helmet alternate between +50 and −50 V" | image |
| Re5 coil positions | two coils in the anterior and posterior temporal region on each side, one in the upper parietal region on each side, one in the centre of the lower occipital region; seven coils "connected in parallel" | inner side of a plastic helmet | Martiny 2010| p.2 [164] | "one coil in the center of the lower occipital region" | image |
| Re5 field and induced E | 19 G (1.9 mT) calculated maximum 0.5 cm from the coil; 2.2 mV/cm at 0.5 cm; 30 µV/cm at 10 cm; spectrum below 333 Hz | per coil | Martiny 2010| p.2 [164] | "a calculated maximum of 19 G (corresponding to 1.9 milliTesla) .5 cm from the coil" | image |
| Re5 sham and schedule (Martiny) | generator internally disconnected; sessions on all weekdays for 5 weeks; faint hum | sample size not checked | Martiny 2010| p.2-3 [164-165] | "In the sham condition, the generator was internally disconnected" | image (p.2); text (p.3 schedule) |
| Re5 description (Larsen) | seven coils; E "near 0.0004 V/m"; 3 ms pulses, 12 ms pause, 18 ms, 55 Hz; 30 min a day for 8 weeks; no sham arm | single-arm cohort | Larsen et al 2020 | p.3 [2], p.5 | "T-PEMF induces low electric fields near 0.0004 V/m" | image (p.3); text (p.5) |
| Re5 field model | about 4.5 ms biphasic magnetic pulses at 50 Hz; two series pairs over the temporal lobes, one series pair over the parietal lobe, one occipital coil; R = 72.5 Ω, L = 110 mH, dI/dt = 937 A/s, Ipeak = 0.53 A; mean cortical E 0.01 V/m, mean cortical B 0.3 mT; all coils in phase | 16 head models | Tang 2026| l.55, l.59, l.63, l.69 | "the average magnetic field over the entire cortex is 0.3 mT" | text (file is .txt) |
| van Belkum 2021 device | not Re5: an EEG cap with 19 iron-core electromagnets (reed relays with a steel bolt) at 10/20 positions; ±2 V square pulses, 3 ms + 3 ms + 12 ms pause; 100 µT maximum at 1 cm from the coil; 30 min every weekday for 5 weeks; sham = zeros | 55 patients, no difference from sham | van 2021 | p.2 [680] | "The induced magnetic field had a maximum strength of 100 uT at a distance of 1 cm from the coil" | image |
| Straasø 2014 | 30 min per session, once versus twice daily for 8 weeks; remission 73.5% versus 67.7%; no sham arm | 65 patients | Straasø 2014 | p.1 | "A sham (placebo) Transcranial Pulsating ElectroMagnetic Fields arm was not included" | text (abstract; not a dose value) |
| tSMS magnet (Oliviero) | NdFeB cylinder 45 mm × 30 mm, 360 g, S-45-30-N, 45 MGOe, 765 N; scalp to cortex about 20 mm; no field given in tesla | over the TMS hot spot of the left FDI | Oliviero 2011 | p.2 [4950] | "The distance between the scalp and the motor cortex was about 20 mm." | image |
| tSMS duration and sham (Oliviero) | 10 min; sham = non-magnetic metal cylinder of the same size, weight and look; effect "up to 25%" | 1, 5, 10 min compared | Oliviero 2011| p.3 [4951], p.1 | "tSMS duration was always 10 min" | image (p.3); text (p.1 abstract, 25%) |
| tSMS field (Kirimoto) | magnet 50 mm × 30 mm, nominal 534 mT at the surface; measured 512 mT at the surface, 110-190 mT at 2-3 cm from the centre, 80-140 mT at 2-3 cm from the edge | gaussmeter, with and without skull | Kirimoto 2016 | p.3, p.5 | "the strength 2–3 cm from the surface of the center of the magnet ranged between 110 and 190 mT" | image |
| tSMS session (Kirimoto) | 15 min over M1 or SMA; sham stainless steel cylinder; 14 subjects; N33 at C3′ reduced to 82% of baseline | double-blind by two investigators | Kirimoto 2016| p.5; p.2 | "non-magnetic stainless steel cylinder of the same size, weight, and appearance was used for sham stimulation" | image (p.5); text (p.2, 82%) |
| tSMS replication failure (Lorenz) | N45 S-45-30-N, 20 min, neuronavigated, sham steel cylinder; 39 recruited, 37 kept, 19 datasets per hemisphere analysed; no effect on MEP, SICI or ICF | Ulm | Lorenz 2026 | p.1-3 | "No significant differences in MEP amplitudes were observed between tSMS and sham stimulation." | text (clean text layer; not used for a dose) |
| sTMS magnets | three diametrically magnetised cylindrical NdFeB magnets, 1 inch in diameter and length, 0.64 T at the surface, on a motor | in the sagittal line, close to the head, "evenly spaced between the forehead and crown of the head" | Leuchter 2015 | p.3 | "with a surface field of 0.64 T" | image |
| sTMS session and sham | rotation at the IAF for 30 min; supine; daily, five days a week for six weeks (30 sessions); sham = non-magnetic rotating shaft plus small fixed magnets | 17 sites | Leuchter 2015| p.3 | "The device rotated the magnets at each individual's IAF for 30 min per treatment" | image |
| sTMS result | ITT n = 202: no difference; per protocol (59 active, 60 sham): −9.00 versus −6.56, P = 0.033; sponsor NeoSync, two NeoSync authors | | Leuchter 2015| p.1-2 | "There was no difference in efficacy between active and sham in the ITT sample." | image |
| sTMS device (trial protocol) | 6,400 gauss (0.64 T) at the surface; magnets rotate about a transverse axis; #1 just above the nasion (frontopolar), #2 frontocentral over the superior frontal gyrus, #3 central region; 30 min; 10 h lockout; eyes closed, awake | Figure 2 draws magnet #2 with poles reversed relative to #1 and #3 | NCT03288714 protocol | p.24-25 | "a 10-hour lockout of the device occurs after a therapy session has ended or is cancelled" | image (image-only PDF; the pole labels in the figure are small) |
| TBS definition | bursts of 3 pulses at 50 Hz every 200 ms; iTBS 2 s trains every 10 s, 190 s, 600 pulses; cTBS 40 s, 600 pulses; imTBS 5 s trains every 15 s, 110 s; cTBS300 = 20 s; 80% of active motor threshold | motor cortex, 9 subjects | Huang 2005 | p.2 [202] | "3 pulses of stimulation are given at 50 Hz, repeated every 200 ms" | image |
| TBS coil (Huang) | hand-held figure-of-eight coil, 70 mm; Magstim Super Rapid | over the hand area, tangential | Huang 2005| p.5 [205] | "hand-held figure of eight coil (70 mm standard coil, Magstim Co." | text (clean text layer; no number used for dose) |
| TBS in Suppa 2008 | biphasic pulse about 300 µs; figure-of-eight coil, mean loop diameter 9 cm; hot spot of FDI; iTBS "20 trains of 2 s repeated every 10 s"; 18 subjects | M1 | Suppa 2008 | p.2 [4490] | "The magnetic stimulus had a biphasic waveform with a pulse width of ∼300 µs" | image |
| TMS field strength (general) | 0.5 to 2 T | rTMS pulses | Dufor 2019 | p.1 | "strong electromagnetic pulses [0.5 to 2 Tesla (T)]" | image |
| rTMS field and E in the head | up to 2 T in the cortex; more than 500 V/m under the coil, 1 V/m at 20 cm | comparison figure text | Rohan 2004| p.3 [95] | "rTMS magnetic fields have strengths up to 2 T (20,000 G)" | image |
| THREE-D iTBS | 120% of resting motor threshold; triplet 50 Hz bursts at 5 Hz, 2 s on and 8 s off, 600 pulses, 3 min 9 s; B70 coil; 414 randomised; target MNI152 (x −38, y +44, z +26) by neuronavigation | left DLPFC | Blumberger 2018 | p.3 [1685] | "MNI152 stereotaxic coordinate (x–38, y+44, z+26)" | image |
| Low-intensity TBS in rodent tissue | cTBS and 1 Hz did not differ from sham; iTBS and BHFS did; 4.5 mT failed where 10 mT worked | mouse cerebellar explants, 10 min a day for 14 days | Dufor 2019| p.2 | "1 Hz and cTBS did not induce more reinnervation than occurred in sham controls" | image |
| Low-intensity iTBS in slices | iTBS 190 s; 85.4 mT at 1 mm from the coil base; dB/dt 285 T/s | mouse cortex slices | Tang 2016 | p.4 | "be 85.4 mT and had a dB/dT of 285 T/s" | text (proof copy with line numbers; not used in a decision) |
| BHFS definition | 62.6 ms trains of 20 pulses at 6.55 Hz for 1 min, 9.75 Hz for 8 min, 6.15 Hz for 1 min; 300 µs trapezoid pulses; from patent PCT/AU2007/000454 | explants, 10 min a day for 14 days | Grehl 2016 | p.8 | "BHFS: 62.6 ms trains of 20 pulses, repeated at 6.55 Hz for 1 min, followed by 9.75 Hz for 8 min and then 6.15 Hz for 1 min" | image |
| BHFS pulse count and field | 108 840 pulses per session; 10 mT at the target, rise under 100 µs, pulse 300 µs | | Grehl 2016| p.10 (Table 2), p.5 | "magnetic field strength of 10 mT at the target tissue" | text (table and methods text; consistent with 5442 trains × 20) |
| LI-rTMS coil and field (mouse) | coil 8 mm outer diameter, 300 windings, 6 mm steel bolt; monophasic 300 µs pulse, 230 µs rise; 8-10 mT at the cerebellar cortex; ex vivo 10 mT and 0.05-0.075 V/m at 4 mm; 10 min a day for 14 days; sham = coil not activated | | Dufor 2019| p.10 | "generated a magnetic field intensity of 8 to 10 mT at the distance of the cerebellar cortex" | image |
| BHFS variant over mouse visual cortex | 59.9 ms trains of 20 pulses at 6.67 / 10.01 / 6.25 Hz; 12 mT at the coil base, about 8 mT at the visual cortex | 10 min a day | Makowiecki 2014 | p.2 [10781] | "59.9 ms trains of 20 pulses, with trains repeated at 6.67 Hz for 1 min, 10.01 Hz for 8 min, and 6.25 Hz for the final minute" | text (clean text layer; side reference) |
| LI-rTMS in rats (fMRI) | coil 462 turns, 8 mm inside diameter; about 13 mT at the cortex surface; 10 min once a week for 4 weeks | six rats | Seewoo 2018 | p.2-3 | "approximately 13 mT at the surface of the cortex" | text (side reference) |
| LI-rTMS intensity range | 1-150 mT | review table | Moretti 2022 | p.2 | "deliver magnetic fields between 1 and 150 mT" | text (side reference) |
| GENUS light | 40 Hz flicker, 12.5 ms on / 12.5 ms off, 1 h | mice | Iaccarino 2016| l.143 | "40 Hz, 80 Hz flicker (12.5 ms light on, 12.5 ms light off, 60 W) for 1h" | text (file is .txt) |
| GENUS sound | 1 ms, 10 kHz tones every 25 ms; with 12.5 ms light pulses; 1 h a day for 7 days | mice | Martorell 2019| l.95, l.123, l.177, l.307 | "All auditory pulses were 1 ms-long 10 kHz tones." | text (file is .txt) |
| GENUS non-replication | no native gamma entrainment, no reliable change in plaques | mice | Soula 2023| l.55 | "did not engage native gamma oscillations in these regions" | text (file is .txt) |
| GENUS in patients | daily 40 Hz light and sound for 3 months, n = 15 | pilot | Chan 2022 | p.2 | "chronic daily 40Hz sensory stimulation for 3 months" | text (abstract) |
| GENUS meta-analysis | 11 studies, 341 participants; no significant cognitive improvement; tinnitus risk RR 6.46 | | Ang 2025 | p.1 | "no significant improvements were observed in cognitive function" | text (abstract) |
| tACS field in cortex | 0.8 V/m at 2 mA | intracranial recordings | Huang 2017 | p.1 | "When stimulating at 2 mA, cortical electric fields reach 0.8 V/m" | text (abstract) |
| Zaehle 2010 tACS | electrodes PO9 and PO10; 10 min at the individual alpha frequency; 20 subjects (10 sham) | | Zaehle 2010 | p.2-3 | "parieto-occipital locations (PO9 and PO10)" | text |
| Helfrich 2014 tACS | 10 Hz for 20 min; electrodes over Cz and Oz; 14 participants | | Helfrich 2014 | p.1-2 | "positioned over Cz and Oz" | text |
| Kasten 2016 tACS | 20 min at the IAF below the sensation threshold; Cz (5 × 7 cm) and Oz (4 × 4 cm); difference from sham fades after 70 min | | Kasten 2016 | p.1, p.3 | "centered above Cz (5 × 7 cm), the other above Oz (4 × 4 cm)" | text |
| Bell coils | pair of coils, 130 cm diameter, 250 turns, 65 cm apart (Helmholtz); subject seated between them, sagittal plane perpendicular to the coil axis (field left to right) | wooden chair, dark room, eyes closed | Bell 1994 | p.1-2 [26-27] | "each 130 cm in diameter and consisting of 250 turns of copper wire" | image |
| Bell field uniformity | within 5% over head and upper chest (20% with thorax and pelvis) | | Bell 1994| p.2 [27] | "uniform to within 5% of its predetermined value" | image |
| Bell 1994 epoch timing | 2 s field, 5 s off; 50 trials at 0.2 gauss and 50 at 0.4 gauss (plus a 0.8 gauss rms block to measure pickup); control = the 2 s before each field epoch; block order varied between subjects | each subject one frequency: 10 Hz (subjects 1-10) or 1.5 Hz (11-19) | Bell 1994| p.3 [28], p.2 [27] | "A trial consisted of the presentation of the magnetic field for 2 sec, followed by an interstimulus period of 5 sec" | image |
| Bell 1994 EEG sites | C3, C4, P3, P4, O1, O2, linked ears | | Bell 1994| p.2 [27] | "placed at C3, C4, P3, P4, O1, and O2 (10-20 system)" | image |
| Bell after-effect exposure | 1 gauss (rms), 10 Hz, continuous for 10 min in the middle of a 32 min session; static field parallel to it 224 mG | same Helmholtz coils, dark sound-proofed room, eyes closed; 10 subjects | Bell 1994 | p.1 [510] | "A sinusoidal field of 1 gauss (rms), 10 Hz, was applied continuously to each subject during a 10 min interval in the middle of a 32 min test session" | image (image-only PDF) |
| Bell after-effect sampling | four 1 min EEG samples: T1 two minutes after the start, T2 ending 1 s before the field, T3 starting 1 s after the field, T4 ten minutes later; control = mean of T1, T2, T4; occipital P < 0.015 | 30 artifact-free 2 s epochs per sample | Bell 1994| p.2 [511] (Fig. 1, Fig. 2) | "compared with the mean from the three other values obtained during the test session" | image |
| Bell 1991 epochs | 2 s field, mean 8 s between stimuli (5-11 s, random); about 60 trials, first 50 artifact-free used; 14 volunteers | Helmholtz coils | Bell 1991 | p.1 [1521] | "with a mean period between stimuli of 8s (range 5-11 s, varied randomly)" | text (corroborates the 5 s read on image in Bell 1994) |
| Bell 1992 epochs | 2 s field, 5 s off; static and 60 Hz, 0.78 gauss; about 60 trials per condition; 20 subjects | same coils | Bell 1992 | p.1-2 | "followed by a 5 sec field-off interval" | text (corroborating) |
| False-negative rate of the Bell method | 0.8 G at 1.5 or 10 Hz: 58% (11/19) detected, so 42% false negatives; light stimulus: 61% | | Marino 1996 | p.1 [99] | "the false-negative rate was 42% when an EMF was used as the stimulus" | image |
| Ghione coils and field | two circular Helmholtz-like coils, 44 cm diameter, 50 turns each, around the head with the head at the centre; 50 Hz sine; 40 and 80 µT (peak) at the centre | seated, reading a magazine | Ghione 2005 | p.2 [113] | "Sham-controlled studies were done at 40 and 80 µT (peak) intensity, as measured at the centre of the coils" | image |
| Ghione design | two 90 min sessions (field and sham) 1-2 weeks apart; blind switch; 20 subjects per intensity | EEG at Oz before and after | Ghione 2005| p.2 [113] | "Each volunteer underwent two 90-min sessions at an interval of 1–2 weeks." | image |
| Ghione EEG result | 80 µT group: alpha 22.6 ± 9.2 to 39.9 ± 20.2 µV; recordings of 10 (40 µT) and 5 (80 µT) subjects discarded | peak-to-peak alpha amplitude at Oz | Ghione 2005| p.2 [113] (Table 1) | "10 and 5 subjects had to be discarded because of technical problems or bad signal quality" | image |
| Legros 2012 | 60 Hz, 1,800 µT, 1 h: tremor and postural changes, no EEG change | | Legros 2012 | p.1 | "without being detected in the cortical electrical" | text (abstract; side reference) |
| WHO on epilepsy | more susceptible to induced fields | | EHC 238 | p.29 | "People suffering from or predisposed to epilepsy are likely to be more sus-ceptible" | text (safety note only) |
| Schumann RCT device | "Enerkey Kingdom SR Sleep device", Taiwan patent TW M530656U; composite of 7.83 Hz, theta and delta "waves"; next to the bed facing the head, from one hour before bed until getting up, 4 weeks; no field strength given; placebo device outputs nothing | 20 + 20 insomnia patients | Huang 2022 | p.3-4 [1115-1116] | "place it next to the bed facing the subject's head, turn it on about one hour before going to bed every night" | image (p.4) |
| Schumann RCT result | no significant between-group difference; within the device group SOL P = 0.012, TST P = 0.037 | polysomnography | Huang 2022| p.5 [1117] | "there was no significant difference between the two groups before and after treatment via Mann–Whitney U-test" | image |
| Natural Schumann amplitude | order of 1 pT at 7.8 Hz | | 211014730 - arXiv 211014730 | p.1, p.3 | "order of 1 pT at the fundamental mode" | text (side reference) |
| Schumann modes | 7.8, 14.1, 20.3, 26.4, 32.5 Hz; first mode strongest; first mode 7.2-8.2 Hz over the day (east-west component) | Yunnan observatories | https://html.rhhz.net/Geophy_en/html/20130304.htm | Introduction; section 3.1.3 | "The observed frequencies of the lowest five SR modes are at about 7.8 Hz,14.1 Hz,20.3 Hz,26.4 Hz and 32.5 Hz" | web |
| Danho 2025 exposure | plasma-tube device (Spooky SC1000 with Phanotron tube); 7.83 Hz and harmonics 14.3, 20.8, 27.3 Hz; about 0.5-1 µT at 1 m, modelled, not measured; participants about 2 m from the antenna | school gymnasium | Danho 2025 | p.3 | "As field strength in Tesla is not directly measured" | image |
| Danho 2025 design | 10 + 10 boys aged 12-15, not randomised; 60 min once a week for 8 weeks, the first 20 min seated; control: device off, antenna concealed, single-blind | | Danho 2025| p.2 | "participants were unaware whether the device was active or inactive, resulting in a single-blind design" | image |
| Cherry 2002 | Schumann signal proposed as the mechanism for solar and geomagnetic activity effects, through melatonin | hypothesis paper | Cherry 2002 | p.1 | "The hypothesis promoted here" | text (abstract) |
| Wang 2019 coils | three orthogonal sets of square coils about 2 m on edge (Merritt four-coil design), double-wrapped; up to 100 µT in any direction; head in the uniform region; grounded aluminium Faraday cage | participant seated, facing north | Wang 2019 | p.3, p.9 | "can produce a magnetic vector of up to 100-µT intensity" | image (p.9); text (p.3) |
| Wang 2019 stimulus | direction rotated over 100 ms between two orientations, intensity held at about 35 µT; fixed trials without rotation; trials 2-3 s apart; runs of about 7 min, up to eight per 1 h session | eyes closed, total darkness | Wang 2019| p.5, p.9 | "started in one orientation then rotated smoothly over 100 ms to the other orientation" | image |
| Wang 2019 sequences | 127 trials (63 fixed, 64 sweeps) or 150 trials (50 per rotation, 50 fixed) | per run | Wang 2019| p.9 | "various 150-trial pseudorandom sequences with 50 trials of each rotation interspersed with 50 FIXED trials" | image |
| Wang 2019 sham and phantom | antiparallel currents in the paired windings; induction artifact of 10-40 µV measured on a cantaloupe | | Wang 2019| p.5, p.9 | "Sham runs are identical to active runs but are executed with the current direction switches set to anti-parallel." | image |
| Gateway method is audio | beat frequencies through stereo headphones | Army assessment | CIA-RDP96-00788R001700210016-5 - Analysis and Assessment of Gateway Process | p.8 | "brain coherence through entrainment to \"beat\" frequencies introduced via stereo headphones" | image |
| "Electromagnetic pulse" in the Gateway report | generated by the body in Bentov's model, not applied | | CIA-RDP96-00788R001700210016-5| p.9 | "An electromagnetic pulse is then generated which stimulates the brain" | image |
| Gateway training audio 1982 | surf sounds with tones mixed "to produce internal four hertz heterodyning"; 45 exercises of 50-60 min | soundproof booths, headsets | CIA-RDP96-00788R001700210017-4 - Trip report 1982 | p.1 | "mixed to produce internal four hertz heterodyning affect" | image (image-only PDF) |
| Focus 10 signal | delta signal first, then low beta mixed in; no Hz given | binaural beats | CIA-RDP96-00788R001700210004-8 - … Hemisync Process | p.13 | "introducing the delta cerebellum signal first and later mixing in the low beta cerebral cortex signal" | image (image-only PDF) |
| Other Gateway scans | no magnetic or electrical stimulation in any of them; only sound, EEG and "bio-monitoring" | workbook 1977, MIAS history, brochure, newsletter 2-84, Atwater 1983, ACSI 1978, INSCOM 1983 | CIA-RDP96-00788R0017002100{23-7,25-5,39-0,07-5,21-9},270006-0, …220013-7 | all pages | e.g. MIAS history p.1: "This immediately precluded any exotic approaches such as chemical, drug, or dietary stimulation." | image, read by a delegated reader (all 79 pages); I rechecked two of its quotes myself |
| Monroe patent and Atwater 1997 | stereo audio signals only | | US5213562A - Monroe 1993; soundhealingresearchfoundationorg … Atwater 1997 | whole text searched | no hit for magnet, coil or electrode as a stimulus | text (keyword search of the text layer) |
| Lane 1998 beats | beta 16 and 24 Hz; theta/delta 1.5 and 4 Hz; stereo headphones | 29 participants | Lane 1998 | p.1 | "the theta/delta range (1.5 and 4 Hz)" | text (abstract) |
| Wahbeh 2007 beat | 7 Hz, carriers 133 Hz left and 140 Hz right | | Wahbeh 2007 | p.1 | "at 7 Hz (carrier frequencies: 133 Hz L; 140Hz R)" | text (abstract) |
| Vendor advice on combining | do not combine in real time | god-helmet.com Shakti page | https://www.god-helmet.com/wp/winshakti/safety.htm | heading "Shakti Spiritual Technology and Safety", rule 2 | "Do not combine Shakti with other mind machines in real-time." | web |

## Source apparatus against this helmet

Each ratio is source divided by helmet, with this helmet at its cap of 4.54 mA unless stated. The plane is named each time.

### Cnp, headset version (Thomas 2007, Shupak 2006)
- Coil: coils under the plastic ear coverings of a headphone-style headset, one each side, over the temples to just above and behind the ear (Shupak 2006 p.2; Thomas 2007 p.3). Coil size and turns: not stated.
- Field: 400 µT at the contact point of the headset (Thomas 2007 p.3). In the head: Thomas 2007 p.2 quotes ±200 µT at the head surface and ±35 µT deep brain for the modality in general; Shupak 2006 p.2 says a maximum of 200 µT "to the deep brain". The two deep values disagree. Local field, not uniform.
- Waveform: Cnp of US 6,234,953 (Shupak 2006 p.2); frequency content below 1 kHz. Thomas 2007 does not give the burst timing.
- dB/dt: 800 mT/s at the contact point (Thomas 2007 p.3).
- Session: 40 min twice a day for 7 days (Thomas); one 30 min exposure (Shupak 2006).
- Sham: identical silent headset without field (Thomas); zero-amplitude pattern (Shupak 2006).
- Evidence: single lab; Thomas 2007 calls itself essentially negative (p.8).

### Cnp, whole-body version (Shupak 2004, Cook 2004/2005/2009)
- Coils: three nested orthogonal square Helmholtz-like pairs with 2, 1.75 and 1.5 m sides; only the vertical pair driven (Cook 2004 p.2; Shupak 2004 p.2).
- Field: ±200 µT peak, vertical, uniform over the seated person.
- Waveform: 853 ms segments of 18 pulses, pauses of 110, 220, 330 and 1200 ms (Cook 2004) or 5000 ms (Cook 2005); rise time 1 ms.
- dB/dt: 0.4 T/s maximum (Cook 2004 p.3).
- Session: 15 min (Cook), 30 min (Shupak 2004); one field and one sham session.
- Sham: amplifiers on, no signal.
- Evidence: single lab; direction of the alpha change differs between the 2004 and 2005 studies.
- Ratio at 20 mm (cortex): 200 µT / 8.4 µT = 24. At 60 mm: 200 / 0.50 = 400. dB/dt at 20 mm, assuming this helmet's 1 ms points: 0.4 T/s / (2 × 8.4 µT / 1 ms = 0.017 T/s) = 24. A uniform field cannot be made.

### LFMS (Rohan 2004, Rohan 2014, Fava 2018, Dubin 2019)
- Coil: an MRI-style transverse gradient head coil; modelled as a 35 cm cylinder (Rohan 2014 p.4); head inside up to the eyebrows (Fava l.162).
- Field: a gradient, zero in the middle, 0.95 G/cm; under 20 G in the device, about 7.5 G at a point on the head surface (Rohan 2014 p.3, Fig. 1); under 10 G in the brain (Rohan 2004 p.3); "< 50 Gauss" (Fava l.162). The magnetic field is not uniform, the induced electric field is (to 5%, Rohan 2004 p.3).
- Waveform: alternating trapezoids, 256 µs ramps, 768 µs dwell (1.024 ms per half-wave, about 488 Hz); 0.5 s train every 2 s; 20 min.
- Induced E: 0.72 V/m (Rohan 2014), about 0.7 V/m (Rohan 2004), 0.5 V/m (Fava), in 256 µs pulses.
- Sessions: one (Rohan 2014); three, 48 h apart (Dubin); four daily (Fava).
- Sham: coil sound reproduced, no field.
- Evidence: mixed across independent groups; the largest trial (Fava, 84 patients) was null; meta-analysis rates certainty low.
- Ratio, head surface: 0.75 mT / 0.20 mT = 3.8. In the brain: under 1 mT / 8.4 µT = under 120. Using the upper bounds: 2 mT / 0.20 mT = 10 and 5 mT / 0.20 mT = 25 at the surface. Induced E: 0.5-0.72 V/m against a few mV/m at this helmet's steps (say 1-5 mV/m) = 100-700, and those helmet peaks last microseconds against 256 µs; against this helmet's 1 µV/m for smooth signals = 5 × 10^5.

### T-PEMF, Re5 (Martiny 2010, Larsen 2020, Tang 2026)
- Coils: seven on the inside of a helmet: two each side over the anterior and posterior temporal region, one each side upper parietal, one lower occipital centre (Martiny p.2). Assembly R = 72.5 Ω, L = 110 mH (Tang l.59). Size and turns: not stated.
- Field: 1.9 mT calculated maximum at 0.5 cm from a coil (Martiny p.2); 0.3 mT averaged over the cortex in a model (Tang l.63). Local, multifocal.
- Waveform: the generator applies ±50 V square pulses, +3 ms, −3 ms, 12 ms pause (55 Hz). With L/R = 110 mH / 72.5 Ω = 1.5 ms the coil current, and so the field, is a rounded biphasic pulse, which Tang describes as about 4.5 ms long. Measured dI/dt 937 A/s, peak 0.53 A.
- Induced E: 2.2 mV/cm (0.22 V/m) at 0.5 cm, 30 µV/cm (3 mV/m) at 10 cm (Martiny); 0.01 V/m mean cortex (Tang); "near 0.0004 V/m" (Larsen). The three sources disagree by a factor of 25 to 500.
- Session: 30 min a day, weekdays for 5 weeks (Martiny), 8 weeks (Larsen, Straasø).
- Sham: generator disconnected inside (Martiny).
- Evidence: one positive sham-controlled trial from the originating group; two uncontrolled or sham-free studies. No independent test of the Re5 device is among the cited sources.
- Ratio near the coil: 1.9 mT at 5 mm against this helmet's 200 µT at 3 mm = 9.5 and 37 µT at 10 mm = 51; interpolating this helmet to 5 mm (about 100 µT) gives about 19. Cortex: 0.3 mT / 8.4 µT = 36 (60 at the 5 µT setting). Induced E: 0.01 V/m (Tang) against a few mV/m at this helmet's steps = 2-10, but for milliseconds against microseconds.
- The exposure closest to this helmet in the whole family is van Belkum 2021: small iron-core coils at 10/20 sites, the same 3 + 3 + 12 ms pulse, 100 µT at 1 cm. Ratio at 10 mm: 100 µT / 37 µT = 2.7 (4.5 at the 5 µT setting). That trial found no difference from sham (55 patients).

### tSMS (Oliviero 2011, Kirimoto 2016, Lorenz 2026)
- Magnet: one NdFeB cylinder held on the scalp over the motor hot spot: 45 × 30 mm, 360 g (Oliviero, Lorenz); 50 × 30 mm (Kirimoto).
- Field: 512 mT measured at the surface; 110-190 mT at 2-3 cm on the axis (Kirimoto p.3). Static, local.
- Waveform: none (static). dB/dt and E: zero.
- Session: 10 min (Oliviero), 15 min (Kirimoto), 20 min (Lorenz); single sessions.
- Sham: non-magnetic steel cylinder of the same size and weight.
- Evidence: positive reports from several labs, failed replications from Ulm including a neuronavigated one. Contested.
- Ratio, surface: 512 mT / 0.477 mT = 1,070. At 20 mm: 110-190 mT / 8.4 µT = 13,000-22,600 (22,000-38,000 at the 5 µT setting).

### sTMS (Leuchter 2015, NCT03288714 protocol)
- Magnets: three diametrically magnetised NdFeB cylinders, 1 inch × 1 inch, rotating about a transverse axis, in the sagittal line from just above the nasion to the central region (protocol p.24-25).
- Field: 0.64 T at the magnet surface. Field at the scalp or cortex: not stated in either source. Local; the field vector rotates.
- Waveform: sinusoidal at the individual alpha frequency (8-13 Hz). dB/dt and E: not stated.
- Session: 30 min, five days a week for six weeks; 10 h lockout.
- Sham: non-magnetic rotating shaft with small fixed magnets.
- Evidence: one sponsor-funded multisite trial, null by intention to treat (n = 202), positive per protocol (P = 0.033).

### Theta burst (Huang 2005, Suppa 2008, Blumberger 2018)
- Coil: figure-of-eight TMS coil, 70 mm (Huang) or 9 cm mean loop (Suppa), held on the scalp over the motor hot spot; B70 coil over the left DLPFC (Blumberger).
- Field: Huang and Suppa give only 80% of active motor threshold; Blumberger 120% of resting motor threshold. In general 0.5-2 T (Dufor 2019 p.1), up to 2 T in the cortex (Rohan 2004 p.3). Focal.
- Waveform: biphasic pulse of about 300 µs; triplets at 50 Hz every 200 ms; cTBS 40 s; iTBS 2 s every 10 s, 20 trains.
- Induced E: more than 500 V/m under the coil (Rohan 2004 p.3); 90 V/m (Larsen 2020 p.3).
- Session: one block (Huang, Suppa); once daily for 20-30 sessions (Blumberger).
- Sham: none in Huang (patterns compared); Blumberger compared against 10 Hz rTMS.
- Evidence: established at TMS strength.
- Ratio at 20 mm: 0.5-2 T / 8.4 µT = 60,000-240,000. Coil surface to coil face: 0.5-2 T / 0.477 mT = 1,000-4,200. Induced E: 90-500 V/m against a few mV/m = 2 × 10^4 to 5 × 10^5. In rodent tissue the same lab line found 4.5 mT too weak (Dufor 2019 p.2): that is 530 times this helmet's cap at 20 mm.

### 40 Hz (Iaccarino 2016, Martorell 2019)
- No coil or magnet: an LED flickering 12.5 ms on / 12.5 ms off and 1 ms tones every 25 ms, 1 h a day. No magnetic field, so no ratio. A magnetic 40 Hz program has no source.

### 10 Hz alpha (Zaehle 2010, Helfrich 2014, Kasten 2016)
- No coil: current through scalp electrodes (PO9/PO10, or Cz and Oz). Cortical E 0.8 V/m at 2 mA (Huang 2017 p.1).
- Ratio of induced E: 0.8 V/m / 1 µV/m = 8 × 10^5. A magnetic 10 Hz program has no source.

### Bell ELF epochs and after-effect (Bell 1991, 1992, 1994a, 1994b, Marino 1996)
- Coils: Helmholtz pair, 130 cm diameter, 250 turns, 65 cm apart; subject seated between them, field left to right through the head.
- Field: uniform within 5% over head and upper chest. Epochs: 0.2 and 0.4 gauss; after-effect: 1 gauss (rms). The epoch paper names its strongest block "0.8 gauss rms", so its values read as rms: 20, 40 and 80 µT rms = 28, 57 and 113 µT peak; 1 gauss rms = 141 µT peak.
- Waveform: sine at 1.5 or 10 Hz for 2 s, then 5 s off, 50 trials per level; or 10 Hz continuous for 10 min.
- dB/dt, E: not stated.
- Session: one; the after-effect session lasts 32 min with the field in the middle.
- Sham: the 2 s before each epoch (epochs); the session's other three EEG samples (after-effect). Subjects had no cue to the field.
- Evidence: single lab; its own method misses 42% of exposures (Marino 1996).
- Ratio at 20 mm, peak to peak value: epochs 28-57 µT / 8.4 µT = 3.4-6.7 (5.7-11 at the 5 µT setting); after-effect 141 / 8.4 = 17 (28 at the 5 µT setting). At 60 mm: epochs 57-113, after-effect 280. This helmet is in the source's decade only within about 2 cm of each coil.

### Ghione 50 Hz
- Coils: two circular Helmholtz-like coils, 44 cm diameter, 50 turns each, around the head, head at the centre.
- Field: 40 or 80 µT peak at the centre; near-uniform over the head.
- Waveform: 50 Hz sine, 90 min. dB/dt, E: not stated.
- Sessions: one field and one sham session, 1-2 weeks apart.
- Sham: coils in place, switch off, investigators blind.
- Evidence: single lab; the EEG result rests on 15 of 20 subjects.
- Ratio at 20 mm: 40-80 µT / 8.4 µT = 4.8-9.5 (8-16 at the 5 µT setting). At 60 mm: 80-160.

### Schumann 7.83 Hz (Huang 2022, Danho 2025)
- Huang 2022: a bedside box of unstated design, "facing the subject's head", composite 7.83 Hz + theta + delta; no field strength, no distance. Danho 2025: a plasma tube with a spiral antenna, about 0.5-1 µT at 1 m by a dipole model, participants at about 2 m; whole body.
- Waveform: 7.83 Hz (Danho: with harmonics at 14.3, 20.8, 27.3 Hz).
- Session: all night for 4 weeks (Huang); 60 min weekly for 8 weeks (Danho).
- Sham: placebo box (Huang); device off, antenna hidden (Danho).
- Evidence: claim. Huang's between-group test was not significant; Danho is a non-randomised pilot of 19.

### Geomagnetic rotation (Wang 2019)
- Coils: three nested orthogonal sets of square Merritt coils, about 2 m on edge, around the seated participant inside a Faraday cage.
- Field: about 35 µT, uniform over the head; only the direction changes, the strength is held constant.
- Waveform: a smooth rotation of the field vector over 100 ms, every 2-3 s. dB/dt: not given as a number.
- Session: runs of about 7 min, up to eight in an hour.
- Sham: the same currents in antiparallel windings.
- Evidence: single lab, no independent replication among the sources.
- Ratio at 20 mm: 35 µT / 8.4 µT = 4.2 (7 at the 5 µT setting). The ratio says little: this helmet switches a local field on and off, which is the intensity change Wang's design excluded.

### BHFS and low-intensity rTMS in rodents (Grehl 2016, Dufor 2019, Makowiecki 2014, Seewoo 2018)
- Coil: 8 mm, 300 turns with a steel bolt core, held on the mouse head (Dufor p.10); 10/26 mm, 199 turns, 4 mm under a culture well (ex vivo).
- Field: 8-10 mT at the mouse cerebellar cortex; 10 mT at the explant; 12 mT at the coil base and about 8 mT at the mouse visual cortex (Makowiecki); about 13 mT at the rat cortex (Seewoo).
- Waveform: monophasic 300 µs pulses, rise 100-230 µs; 62.6 ms trains of 20 pulses at 6.55 / 9.75 / 6.15 Hz.
- Induced E: 0.05-0.075 V/m at the explant (Dufor p.10).
- Session: 10 min a day for 14 days.
- Sham: coil not activated.
- Evidence: rodents and cultures only; the two labs publish together.
- Ratio at 20 mm: 8-13 mT / 8.4 µT = 950-1,550. Coil base to coil face: 12 mT / 0.477 mT = 25. Induced E: 0.05-0.075 V/m against a few mV/m = 10-75.

### Gateway and Hemi-Sync
- No coil, magnet or electrode in any source. Sound only: binaural beat tones under surf or pink noise through stereo headphones. One number ties to the training audio: a 4 Hz beat (trip report 1982 p.1). A coil program has no source; the only cited statement on the combination is the vendor's advice against it.

## Places on the head that a source states

- THREE-D iTBS target: left DLPFC at MNI152 (x −38, y +44, z +26), by neuronavigation (Blumberger 2018 p.3, image).
- Fox 2012 (.txt, l.92): Fitzgerald target (−46, 45, 38); average 5 cm target (−41, 16, 54); Herbsman responders (−46, 23, 49).
- TBS over motor cortex: TMS hot spot of the first dorsal interosseous, no 10-20 name (Huang 2005 p.5; Suppa 2008 p.2).
- tSMS: hot spot of the left FDI (Oliviero 2011 p.3); hot spot of the right abductor pollicis brevis, "approximately 2–3 cm anterior to C3"; SMA magnet centred 3 cm anterior to Cz; SEPs recorded at C3′ (2.5 cm posterior to C3) and F3 (Kirimoto 2016 p.5, image).
- sTMS: three magnets in the sagittal line: #1 just above the nasion, #2 frontocentral over the superior frontal gyrus, #3 central region; "evenly spaced between the forehead and crown of the head" (protocol p.25; Leuchter 2015 p.3). EEG for the alpha frequency at Fpz and Oz (Leuchter) or FpZ, Fp1 and OZ (protocol).
- Cnp headset: earpieces over the temples, "from above the temple to just above and behind the ear, on both sides" (Shupak 2006 p.2); "just above their ears" (Thomas 2007 p.3).
- Re5: anterior and posterior temporal region on both sides, upper parietal region on both sides, centre of the lower occipital region (Martiny 2010 p.2). No 10-20 names.
- van Belkum 2021: 19 coils at the international 10/20 EEG positions (p.2).
- LFMS: head inside the coil up to the eyebrows (Fava l.162); superior orbital ridge at the bore opening (Dubin l.161).
- tACS electrodes: PO9 and PO10 (Zaehle 2010 p.3); Cz and Oz (Helfrich 2014 p.2; Kasten 2016 p.3). Text layer only.
- Uniform-field studies give EEG sites only: C3, C4, P3, P4, O1, O2 (Bell); Oz (Ghione); F3, F4, Fz, C3, C4, Cz, P3, P4, Pz, Oz, O1, O2 (Cook 2004 p.3). Field direction: left to right (Bell), vertical (Cook, Shupak 2004).
