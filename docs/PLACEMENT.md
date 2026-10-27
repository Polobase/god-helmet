# Coil placement

This page explains where the eight coils go, how to find each site on a real head, what lies underneath, and how much field reaches each target. The **Placement** tab shows the same layouts as diagrams and lists the programs that use each one. The **Brain** tab shows the estimated field of any program on a standard brain ([BRAIN_VIEW.md](BRAIN_VIEW.md)).

Placement decides where the field goes. It does not show that the field does anything there.
- A double-blind, sham-controlled test of God Helmet-type fields (N = 89) found no field effect; suggestibility predicted the reports ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/)).
- A randomized, placebo-controlled test of the 8 Coil Shakti amygdala signal over both temporal lobes (N = 37) found no effect on emotional responses ([Gendle & McGrath 2012](https://pubmed.ncbi.nlm.nih.gov/22582690/)).
- A small independent sham-controlled study with a cross-shaped helmet found no difference during the session but reported differences after it ([Tinoco & Ortiz 2014](https://jcer.com/index.php/jcj/article/view/361/386); single-lab; details in the 8 Coil Shakti section below).

[RESEARCH.md](RESEARCH.md) covers the evidence, [HISTORY.md](HISTORY.md) the devices, [SIGNALS.md](SIGNALS.md) the waveforms, and [EXPERIMENTS.md](EXPERIMENTS.md) how to run a blinded test yourself. Read [SAFETY.md](SAFETY.md) before you wear the helmet.

Evidence words used below: **established** (independent replication), **single-lab**, **claim** (author or vendor statement), **anecdote**, **unverified**. "Inference" marks a translation of vendor or paper wording into 10-5 site names; no source gives those names.

## At a glance

| Placement | Sites, CH1 → CH8 | Programs (approx.) | Basis |
|---|---|---|---|
| Layout A, circumcerebral ring | Fpz, F7, T7, P7, Oz, P8, T8, F8 | 4 use the layout; about 12 more list the same sites | Persinger-lab ring "above the ears" (single-lab); site names are the project's |
| Layout B, temporal 4 + 4 | FT7, T7, CP5, TP7, FT8, T8, CP6, TP8 | 6 use the layout; 2 more list the same sites | Persinger-lab "temporoparietal" fields (single-lab); site names are the project's |
| Shiva God Helmet / 8 Coil Shakti cross | FT7, C5, TP7, T9, FT8, C6, TP8, T10 | about 33 | Vendor cross chart (claim); sites are an inference |
| Shiva ring | Fp1, FT7, TP7, O1, O2, TP8, FT8, Fp2 | about 32 | Vendor placement rules (claim); sites are an inference |
| Koren-box pairs | T7, TP7, –, –, T8, TP8, –, – | about 20 | "4 solenoids" through the temporal lobes (single-lab); sites are an inference |
| Other program-specific sets | see "Program-specific placements" below | about 85 | Papers, vendor pages, clinical devices |

Most programs (184 of 194) list their own sites with `"layout": "custom"` ([PRESET_FORMAT.md](PRESET_FORMAT.md)). The Placement tab groups them under "Layout C" and the program page shows the same map. The app takes each coil's side from its site name: odd number = left, even number = right, `z` = midline. Midline coils take part in the `bilateral`, `rotate` and `single` modes, not in `left`, `right`, `cycle` or `alternate`.

## Preparing and mounting the coils

All eight coils mount on one 6–8 cm neoprene or elastic headband with Velcro, so they can move between placements.

- **Leads.** Inner lead = signal, outer lead = return ([WIRING.md](WIRING.md)). The inner lead leaves the top face next to the core; mark it. Scrape the enamel off the last 5 mm of both leads. The meter should read about 4.2 Ω across them. Add heat-shrink, then a drop of epoxy or hot glue as strain relief.
- **Winding.** Wrap the winding with one layer of Kapton tape so it cannot chafe.
- **Mount.** Use a **nylon M3 screw** into the core, through the 3D-printed clip (`hardware/coil_clip.scad`) with Velcro on the back. Steel screws change the core's magnetic behaviour.
- **Orientation.** The coil axis points to the centre of the head. The clean face (no leads) goes toward the scalp; the leads exit away from the head.
- **Distance.** The app's field model puts the coil face 3 mm off the scalp. Hair, a cap or a thick band add to that. At cortical range the field falls about 12 % per mm ([CALIBRATION.md](CALIBRATION.md)), so 2 mm of extra padding costs about 20 % (derived from the coil model in `webapp/src/engine/field.js`).
- **Polarity.** Mount all coils the same way round. In **Setup**, run the DC test on one channel and hold a compass in front of the coil face. Mark the face the compass's south end points to as N; that is the coil's north pole. Mount every coil N-face inward ([CALIBRATION.md](CALIBRATION.md)). Programs that need an opposite coil (the Shakti +/− pairs) reverse its current in software with a negative weight. Never flip a coil by hand.
- **Low sites.** T9/T10, the inion row (Iz, I1, I2) and the mastoid sites sit below the band line. Use a second strap or a cap, and check that the coil face lies flat.

## The 10-20, 10-10 and 10-5 systems

### Names

- The **10-20** system spaces sites at 10 % and 20 % of head measurements. **10-10** adds the sites in between, and the **10-5** "five percent" system halves the steps again ([Oostenveld & Praamstra 2001](https://doi.org/10.1016/s1388-2457(00)00527-7)).
- Of 329 10-5 positions, 241 can be set on a head without overlapping ([Jurcak 2007](https://pubmed.ncbi.nlm.nih.gov/17207640/)). The app knows 340 named positions.
- Letters give the region: Fp frontopolar, AF, F frontal, FC, C central, CP, P parietal, PO, O occipital, I inion row; FT, T temporal and TP along the side. Odd numbers are left, even numbers right, `z` the midline. Numbers grow away from the midline ([ACNS 2016](https://acns.org/UserFiles/file/EEGGuideline2Electrodenomenclature_final_v1.pdf)). Double-letter rows (FFT, TTP, PPO) and names with `h` (FTT7h, CPP6h) are 10-5 positions between the 10-10 ones ([Oostenveld & Praamstra 2001](https://doi.org/10.1016/s1388-2457(00)00527-7)).
- The American Clinical Neurophysiology Society renamed T3/T4 to T7/T8 and T5/T6 to P7/P8. The old names remain acceptable. ACNS and IFCN did not adopt the 10-5 system ([ACNS 2016](https://acns.org/UserFiles/file/EEGGuideline2Electrodenomenclature_final_v1.pdf)).
- Standard recordings "do not cover the anterior and basal temporal lobes". The IFCN array therefore adds a low chain F9/T9/P9 and F10/T10/P10 ([Seeck 2017](https://doi.org/10.1016/j.clinph.2017.06.254)). T9 and T10 sit on the pre-auricular points ([Jurcak 2007](http://web.archive.org/web/20200924145911/http://www.jichi.ac.jp/brainlab/download/TenFive.pdf)).

### Coordinate frames

A site name is a recipe for measuring a head. A coordinate is that recipe applied to one particular template head. Different templates give different coordinates for the same name.

| Frame | What it is | Where it is used |
|---|---|---|
| Colin27 / FieldTrip | `standard_1005.elc`: 346 positions in mm, fitted to FieldTrip's template head, GPL-3.0 ([FieldTrip standard_1005.elc](https://github.com/fieldtrip/fieldtrip/blob/release/template/electrode/standard_1005.elc)). MNE's `colin27_1005.elc` is byte-identical ([MNE montages](https://github.com/mne-tools/mne-python/tree/main/mne/channels/data/montages)). | Most published site tables; the site entries in the app's region list |
| fsaverage / MNE | `fsaverage_1005.tsv`, in metres, on FreeSurfer's average head. Central and posterior sites sit 10–13 mm behind Colin27: Cz (0, −22, 105) vs (0, −9, 100), Pz (2, −91, 73) vs (0, −81, 83) ([MNE montages](https://github.com/mne-tools/mne-python/tree/main/mne/channels/data/montages)). | The app's coil positions, after alignment (below) |
| MNI152 | The MNI152 template brain (FSL / TemplateFlow `MNI152NLin6Asym`) ([TemplateFlow MNI152NLin6Asym](https://templateflow.s3.amazonaws.com/tpl-MNI152NLin6Asym/template_description.json)). | The atlases: Brainnetome, Harvard-Oxford; the Brain tab's meshes and target centroids (its cerebellum and brainstem come from the 2009c template, a few millimetres off; [BRAIN_VIEW.md](BRAIN_VIEW.md)) |
| Talairach | An older frame. ICBM-152-fitted brains came out larger, more nose-down and slightly lower than Talairach-fitted ones, with differences above 1 cm in some anterior areas ([Lancaster 2007](https://doi.org/10.1002/hbm.20345)). | Koessler 2009 site table; convert before mixing |

Templates are also not real caps. In 20 people wearing MR-visible caps, the lateral chain sat higher than the Colin27 values: T7 by 10 mm, FT7 by 14 mm, F7 by 16 mm, AF7 and FT9 by 19 mm, AF3/AF4 by 21–23 mm. O1, O2, P3 and P7 agreed within 5 mm ([Scrivener & Reader 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8865144/)). These offsets are the research's own subtraction; part of them may come from the normalisation method, not from where caps sit.

### The aligned set used by the app

- The app's 10-5 positions are MNE's fsaverage set, translated by [0, −1, −5.5] mm onto the MNI152 brain. The shift was fitted so that scalp-to-brain distances match published values (34 sites, 1.6 mm RMS error; [BRAIN_VIEW.md](BRAIN_VIEW.md)).
- Against Colin27, frontal and lateral sites agree within 1–6 mm: FT7 (−81, 10, −7) vs (−81, 14, −11); T7 (−84, −20, −8) vs (−84, −16, −9). C5 and CP5 differ by 8–9 mm, O1/O2 by 17–18 mm. Oz is 20 mm lower in the app (3, −123, −6 vs 0, −115, 15), Iz 22 mm lower, Pz 15 mm lower and 11 mm further back, Cz 14 mm further back. (Comparison by the project research, fact-checked.)
- So the frame hardly matters for the temporal programs. It decides the result for occipital, cerebellar and septal programs.
- The site table in the Placement tab ("What lies under each site") takes its anatomy and depths from Colin27-based projections and cap studies. The Brain tab draws the coils at the aligned positions. Keep this in mind at Oz, Iz, Pz and Cz.

All coordinates on this page are in the app's aligned frame (MNI mm, x = right, y = front, z = up) unless stated.

## Finding the sites with a tape measure

### Landmarks

- **Nasion (Nz):** the dent at the top of the nose bridge.
- **Inion (Iz):** the external occipital protuberance, the bump at the back of the skull. It is often felt only as a patch a few millimetres across ([Jurcak 2007](http://web.archive.org/web/20200924145911/http://www.jichi.ac.jp/brainlab/download/TenFive.pdf)).
- **Pre-auricular points (LPA, RPA):** the front root of the tragus, the small flap in front of the ear canal.

Use the same ear landmark every session. Jurcak and colleagues compared four ear definitions. Temporal sites near the ears moved most; prefrontal, parietal and occipital sites hardly moved. Three definitions (the front root of the tragus, the peak of the tragus and the upper edge of the ear canal) gave almost identical results; the dent above the tragus shifted sites slightly upward ([Jurcak 2007](http://web.archive.org/web/20200924145911/http://www.jichi.ac.jp/brainlab/download/TenFive.pdf)). For a temporal-lobe helmet this is the landmark that matters most.

### Step by step

This follows the "UI 10/10" rules of [Jurcak 2007](http://web.archive.org/web/20200924145911/http://www.jichi.ac.jp/brainlab/download/TenFive.pdf). Use a soft tape and a skin-safe marker.

1. Mark Nz, Iz, LPA and RPA.
2. Put a tentative **Cz** halfway from Nz to Iz over the top of the head. Adjust it until it also lies halfway between LPA and RPA over the top.
3. Front to back through Cz, in 10 % steps of Nz–Iz: Fpz, AFz, Fz, FCz, Cz, CPz, Pz, POz, Oz.
4. Ear to ear through Cz, in 10 % steps of LPA–RPA: T7, C5, C3, C1, Cz, C2, C4, C6, T8.
5. Around each side on the **10 % line** through Fpz, T7 and Oz: fifths of Fpz–T7 give Fp1, AF7, F7, FT7; fifths of T7–Oz give TP7, P7, PO7, O1. Same on the right.
6. Rows between: along F7–Fz–F8, FT7–FCz–FT8, TP7–CPz–TP8 and P7–Pz–P8, divide each half in quarters (F5, F3, F1 …). The AF and PO rows are only halved (AF3, PO3).
7. The **0 % line** runs Nz – LPA (= T9) – Iz. Fifths of it give F9, FT9, TP9 and P9. These sites lie about 4 cm below the band line (T9 sits 39 mm below T7 in the app's frame).
8. 10-5 sites lie halfway between neighbouring 10-10 sites. On the 10 % line each 10-5 step is 2.5 % of the circumference, about 15 mm.

The band follows the 10 % line. At the front and back it crosses Fpz and Oz, 10 % of the nasion–inion distance above the nasion and the inion. At the sides it crosses T7 and T8, just above the ear tops.

### Shortcuts for single targets

- **Left DLPFC (F3).** The "5 cm in front of the motor hotspot" rule hit Brodmann area 9 in only 7 of 22 people ([Herwig 2001](https://doi.org/10.1016/s0006-3223(01)01153-2)). The BeamF3 method finds F3 from three head measurements ([Beam 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC2882797/)). In 100 MRIs it landed within 1.36 cm of an MRI-guided target in 95 % of heads ([Mir-Moghtadaei 2015](https://doi.org/10.1016/j.brs.2015.05.008)).
- **Auditory cortex.** A 10-20-based temporal site sat on average 10 mm above the scalp point nearest to primary auditory cortex, and above it in all 12 people. It also sat about 11 mm behind it on average, but with a large spread (behind in 8 of 12). Auditory cortex lay 34–40 mm below the scalp ([Theodoroff 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5999188/)).

### Realistic tolerance

| Source | What was measured | Spread |
|---|---|---|
| [Xiao 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5269592/) | 4 trained operators × 5 repeats, Jasper's manual 10-20 procedure on a head model | 6.4 ± 1.1 mm (2.9 mm with a navigation aid) |
| [Atcherson 2007](https://doi.org/10.1007/s10548-007-0036-z) | Caps without measuring, 10 people × 3 sessions | SD 3.0–12.7 mm by electrode |
| [Scrivener & Reader 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8865144/) | 64-channel MR cap, 20 people | SD 3.9 / 5.6 / 7.2 mm (x / y / z) |
| [Okamoto 2004](https://doi.org/10.1016/j.neuroimage.2003.08.026) | 10-20 sites projected to cortex, 17 people | average SD 8 mm |
| [Koessler 2009](https://pubmed.ncbi.nlm.nih.gov/19233295/) | 10-10 sites projected to cortex, 16 people (Talairach) | SD 4.6 / 7.1 / 7.8 mm |
| [Herwig 2003](https://doi.org/10.1023/b:brat.0000006333.93597.9d) | Neuronavigation, 21 people | about 10 % of placements over a neighbouring Brodmann area |

Expect about **5–10 mm** of error, occasionally up to 2 cm. Compare that with the size of the field spot. In the project's coil model the field falls to half within 14 mm of the axis at 15 mm from the face, 17 mm at 20 mm, 21 mm at 25 mm and 38 mm at 50 mm. A 1 cm error can change which gyrus gets the peak cortical field. It barely changes the field at deep structures.

In practice: mark the sites on the band once, check them against the landmarks every session, and photograph the set-up. Atcherson and colleagues recommend re-checking positions ([Atcherson 2007](https://doi.org/10.1007/s10548-007-0036-z)).

## Layout A: circumcerebral ring

Eight coils on the 10 % line, channels counter-clockwise seen from above. A counter-clockwise rotation moves front → back over the left side and back → front over the right.

```
            (nose)
              CH1
             Fpz
     CH2 F7       F8 CH8
  CH3 T7     ⊙      T8 CH7      ⊙ = top of head, seen from above
     CH4 P7       P8 CH6        left side of the drawing = your left
              Oz
              CH5
```

| Ch | Site | Where | App MNI (mm) | Cortex under the coil | Scalp → brain | Field under the coil |
|---|---|---|---|---|---|---|
| CH1 | Fpz | Forehead, midline | (1, 88, −1) | Medial frontal pole, BA10 (caps: frontal pole 100 %) | 15.8 mm | 1.2 × |
| CH2 | F7 | Left front | (−71, 39, −6) | Left inferior frontal gyrus, BA45/47 (caps: pars triangularis 83 %) | 14.6 mm | 1.3 × |
| CH3 | T7 | Above the left ear | (−84, −20, −8) | Left posterior superior/middle temporal gyrus, BA21/22 (caps: posterior STG 72 %) | 13.7 mm | 1.5 × |
| CH4 | P7 | Left back | (−73, −81, −9) | Left posterior inferior temporal gyrus and lateral occipital cortex, BA37/19 (caps: inferior LOC 75 %) | 14.6 mm | 1.3 × |
| CH5 | Oz | Back of the head, midline | (3, −123, −6) | Occipital pole, V1/V2 (caps: occipital pole 100 %) | 15.1 mm | 1.3 × |
| CH6 | P8 | Right back | (75, −77, −8) | Right posterior inferior temporal gyrus and LOC, near V5/MT+ (caps: inferior LOC 85 %) | 14.8 mm | 1.3 × |
| CH7 | T8 | Above the right ear | (85, −18, −8) | Right posterior STG/MTG (caps: posterior STG 53 %, posterior MTG 29 %) | 13.0 mm | 1.7 × |
| CH8 | F8 | Right front | (72, 40, −6) | Right inferior frontal gyrus, BA45/47 (caps: pars triangularis 67 %) | 14.9 mm | 1.3 × |

How to read the columns:
- "Cortex under the coil" combines template projections (Koessler, the Dan-lab 10/5 data, derived MNI152 values) with the Harvard-Oxford labels from real caps ([Scrivener & Reader 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8865144/)). Three independent datasets agree on this broad mapping (established).
- "Scalp → brain" is the distance from the site to the brain surface on the MNI152 template (derived in the project research).
- "Field under the coil" is the field at that depth on the coil axis, as a multiple of the program's µT value. It comes from the project's coil model, and the Brain tab shows the same numbers.

**Basis.** The Persinger lab described eight solenoids "arranged circumcerebrally (every 45 deg) at the level of the temporoorbital plane" ([Cook 1999](https://pubmed.ncbi.nlm.nih.gov/10400078/)), "equally spaced around the subject's head along a horizontal plane above the ears" ([Richards 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/)), and stepped counter-clockwise ([Tsang 2004](https://pubmed.ncbi.nlm.nih.gov/15370182/)). The Swann study used the plane "supported by a line between the midforehead and above the ears" ([Persinger 2002](https://pubmed.ncbi.nlm.nih.gov/12081299/)). The EEG effects these papers report are single-lab and unreplicated.

**Not evenly spaced.** Layout A uses the named 10-10 sites, which sit at 0, 15, 25, 35 and 50 % of the head circumference, counted from Fpz. The gaps between neighbouring coils are 60–87 mm. The lab's 45° steps (12.5 % each) would fall on AFF7 and PPO7, about 15 mm from F7 and P7 (project research, fact-checked). Programs that need an even ring use the offset rings described under "Shiva ring and the lab ring at 45 degrees" below.

**Programs.** `circumcerebral-gamma`, `circumcerebral-theta`, `remote-viewing` and `telepathy-sender` use the layout. About a dozen more list the same eight sites, for example `persinger-scott-2015-transatlantic`, `military-p06-persinger-swann-1998` and several `lowfield-*` programs. The Placement tab lists them all.

## Layout B: temporal 4 + 4

Four coils on each side of the head. Three sit along the band line: FT7 in front of the ear, T7 above it, TP7 behind it, about 31 mm apart. The fourth, CP5, sits about 37 mm above TP7.

```
   LEFT side, seen from the left               RIGHT side, seen from the right
   front ◄──────────────► back                 back ◄──────────────► front

                         CH3 CP5                CH7 CP6
   CH1 FT7    CH2 T7     CH4 TP7   ← band →     CH8 TP8    CH6 T8     CH5 FT8
              (ear)                                        (ear)
```

| Ch | Site | Where | App MNI (mm) | Cortex under the coil | Scalp → brain | Field under the coil |
|---|---|---|---|---|---|---|
| CH1 | FT7 | Left temple, in front of the ear top | (−81, 10, −7) | Templates: anterior STG/MTG near the temporal pole and frontal operculum. Caps: precentral gyrus 64 %, temporal pole 14 %, anterior STG 14 % | 17.8 mm | 0.9 × |
| CH2 | T7 | Above the left ear | (−84, −20, −8) | Posterior STG/MTG, BA21/22 (caps: posterior STG 72 %) | 13.7 mm | 1.5 × |
| CH3 | CP5 | Left, above and behind the ear | (−80, −55, 28) | Supramarginal gyrus, BA40, upper part of the left temporoparietal junction (caps: posterior SMG 61 %) | 14.1 mm | 1.4 × |
| CH4 | TP7 | Left, behind the ear top | (−82, −51, −8) | Temporo-occipital middle temporal gyrus, BA21/37 (caps: 74 %) | 13.6 mm | 1.5 × |
| CH5 | FT8 | Right temple | (82, 12, −7) | As FT7 (caps: precentral 63 %, anterior STG 25 %) | 17.5 mm | 0.9 × |
| CH6 | T8 | Above the right ear | (85, −18, −8) | Posterior STG/MTG (caps: posterior STG 53 %) | 13.0 mm | 1.7 × |
| CH7 | CP6 | Right, above and behind the ear | (80, −52, 29) | Right supramarginal/angular gyrus, BA40/39, right TPJ (caps: angular gyrus 53 %, posterior SMG 40 %) | 14.2 mm | 1.4 × |
| CH8 | TP8 | Right, behind the ear top | (84, −48, −8) | Posterior MTG, lower part of the right TPJ (caps: temporo-occipital MTG 75 %, angular gyrus 20 %) | 13.7 mm | 1.5 × |

Sources for the columns are the same as for Layout A.

Corrections to older descriptions of this layout:
- **FT7/FT8 are not "over the amygdala".** On real caps they sit mostly over the precentral gyrus and frontal operculum ([Scrivener & Reader 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8865144/)). The amygdala centroid lies 62 mm from FT7.
- **T7/T8 are not "over the hippocampus".** They sit over the posterior superior temporal gyrus. The hippocampal body lies 56 mm from T7.
- **It is not a 2 × 2 grid.** It is three coils on the band line plus one above the back coil. CP5/CP6 lie 50 mm from T7/T8, wider than the vendor's cross arms of about 3–4 cm (project research).

**Basis.** The lab's own descriptions are general: fields "applied across the temporoparietal region of the two hemispheres" ([St-Pierre & Persinger 2006](https://pubmed.ncbi.nlm.nih.gov/16861170/)), "primarily over the right temporoparietal region, primarily over the left temporoparietal region, or equally across both hemispheres" ([Persinger & Healey 2002](https://pubmed.ncbi.nlm.nih.gov/12193838/)). No coordinates for the original Koren helmet were ever published. A journalist who wore it described "solenoids on the sides, aimed directly at my temples" ([Hitt 1999](https://www.wired.com/1999/11/persinger/); anecdote). The site names are the project's choice.

**Programs.** `presence-left`, `presence-right`, `sham` and the three `guide-gateway-*` sessions use the layout ([GUIDES.md](GUIDES.md)). `thomas-pulse` and `lowfield-cnp-thomas-pulse` list the same sites.

## Program-specific placements

Each program in this section lists its own sites. Move the coils to those sites before starting; the Placement tab and the program page show the map. Unless a row says otherwise, the site names are an inference from the vendor's or paper's wording.

### Shiva God Helmet cross

| | Front | Top | Back | Bottom |
|---|---|---|---|---|
| Left cross | CH1 FT7 | CH2 C5 | CH3 TP7 | CH4 T9 |
| Right cross | CH5 FT8 | CH6 C6 | CH7 TP8 | CH8 T10 |

- **Source.** The vendor's 8 Coil Shakti chart puts a cross of four coils on each temporal lobe ([Getting started](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/getting_started_basic.htm)). The vendor calls it "the arrangement that is closest to the original laboratory setup for the God Helmet" ([8 Coil Shakti placement](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/8_coil_placement.htm)). That is a claim. The God Helmet sessions use the same cross.
- **Geometry.** The cross is centred on T7/T8. In the app's frame the front and back arms reach 31 mm from T7 and the top and bottom arms 39 mm. The vendor photos show arms of roughly 3–4 cm (interpretation of photos; no distance is stated).
- **Stepping.** The field steps from coil to coil, clockwise on the left and counter-clockwise on the right, as the vendor's text says. The programs step both crosses top, back, bottom, front, viewed from each side (the order is an inference). One image caption on the same page says the opposite ([God Helmet session list](https://www.god-helmet.com/wp/god-helmet/koren_session_list.htm)). Each program stores its order.
- **The bottom arm is weak.** T9/T10 sit over the temporalis muscle and the skull base. In the app's brain meshes the cortex lies about 24 mm below T9, against 13–14 mm below T7 (derived). The cortex under T9 gets about a third of the field the cortex under T7 gets.
- **Programs.** About 33, including `god-helmet-classic`, the `murphy-gh-*` sessions, the `murphy-shakti-60min-*` sessions, `shakti-alternate` and the `murphy-shakti-back-and-forth-*` sessions. Partial sets: `love-agape` uses only the left cross, `murphy-shakti-meditation-hippocampus-right` only the right, and the two-phase 8 Coil Shakti family uses six of the eight coils.

### 8 Coil Shakti stereo cross with +/− pairs

The 8 Coil Shakti uses the same cross, driven from the two channels of a stereo sound card.
- "Each side of the head gets two pairs", one pair from each stereo channel ([Getting started](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/getting_started_basic.htm)).
- "One pair is vertical, and the other is horizontal" ([8 Coil Shakti placement](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/8_coil_placement.htm)); one channel feeds the top and bottom coils, the other the front and back coils ([Rotating signals over the temporal lobes](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/rot_temporal.htm)).
- Each pair is one positive (+) and one negative (−) coil, and "the left and right markings on the coils do NOT refer to left and right sides of your head" ([Getting started](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/getting_started_basic.htm)).

The programs read the vendor's coil chart like this (an inference for the right side):

```
   LEFT cross (seen from the left)           RIGHT cross (seen from the right)
   front ◄──────────► back                   back ◄──────────► front

               C5 (−)                                    C6 (+)
   FT7 (−)    [T7]    TP7 (+)                TP8 (−)    [T8]    FT8 (+)
               T9 (+)                                    T10 (−)

   vertical pairs (C5/T9, C6/T10): one stereo channel
   horizontal pairs (FT7/TP7, FT8/TP8): the other channel
```

The − coils get a negative weight, which reverses their current as if the coil were turned over. All coils stay mounted N-face inward.

An independent build of a cross helmet used eight 500-turn solenoids with ferrite rods, "four over the temporal lobes on each side of the head". In the authors' words: "The position of the coils was cross-shaped, with their arms, one vertical and the other horizontal". The active coil changed every 250 ms, in a figure-eight of 1000 ms, at about 1 µT for 20 min, against a sham group ([Tinoco & Ortiz 2014](https://jcer.com/index.php/jcj/article/view/361/386)). The paper found no significant difference during the session but reported significant differences after it (single-lab). Its abstract states 0.0001 T, which conflicts with the 10 mG (1 µT) in its methods. `persinger-tinoco-ortiz-2014-replication` uses TP7h, T7h, TP9h, T9h and their mirrors (inference).

### Other temporal crosses and squares

| Program family | Sites (left; right mirrors) | Source of the geometry |
|---|---|---|
| `persinger-collins-gh-c1` … `c8` | C5, TP7, T9h, FFT7 | Shiva's 4 + 4 helmet as tested in the Persinger lab: coils 5 cm apart vertically and 8 cm horizontally, one left-right pair on at a time ([Collins 2014](https://laurentian.scholaris.ca/items/16d96136-680c-4afe-8044-f9137bd01afc)). The sites form a diamond of about 5.8 × 7.7 cm (inference). |
| `persinger-corradini-2014-ltp-*` | FT7, FC5h, CPP5h, TPP7 | The same square hardware ([Corradini 2014](https://laurentian.scholaris.ca/items/1455e1f3-2f1d-47b5-93cd-23713d69e651)); the sites are a fitted inference with the lower edge just above the ear |
| `persinger-harribance-*` | T7, C5, CP5, TP7 | Koren helmet with four left-right solenoid pairs ([Persinger & Murphy 2016](https://www.god-helmet.com/wp/god-helmet/god_helmet_debate_publication.htm)); the sites, a small ellipse over the temporoparietal region, are an inference |
| `murphy-shakti-helmet-stereo` | F7, T7, CP5 | Murphy's first stereo Shakti helmet: "one positive and two negative coils" per side ([Shakti Helmet emulation](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/shakti_helmet.htm)); sites follow the vendor's comparison page (inference) |
| `persinger-shakti-arm-tsang-2004` | F3, T7, P3 | The Shakti arm of [Tsang 2004](https://pubmed.ncbi.nlm.nih.gov/15527205/); frontal, temporal and parietal coils as on the vendor's comparison page ([Shakti & Koren Helmet](https://www.god-helmet.com/wp/winshakti/koren_shakti.htm)) (inference) |

### Shiva ring and the lab ring at 45 degrees

**Shiva ring: Fp1, FT7, TP7, O1, O2, TP8, FT8, Fp2.** The vendor's rules:
- "The eight pairs of coils are arranged so that there are no coils above the nose", "and none above the bony ridge at the back of the head" ([Shiva: where to put the coils](https://www.god-helmet.com/wp/shiva/shiva_demo/locations.htm)).
- "There are no coils directly above the ears", and "Place the coils evenly around your head" (same page).
- "Counterclockwise is usually the more pleasant direction, with the first coil in the series of eight over the left frontal area" ([Shiva safety](https://www.god-helmet.com/wp/shiva/shiva_demo/shiva_safety.htm)).

The comfort statement is a claim. As geometry, the rules plus left-right symmetry force a ring turned 22.5° away from Fpz, Oz, T7 and T8. On the 10-5 line the ideal positions fall exactly halfway between named sites: Fp1/AFp7, FFT7/FT7, TP7/TPP7 and POO7/O1. The app's ring uses the 10-10 site of each pair, about 7.7 mm from each ideal point (derived by the project research; the geometry is fact-checked, but it is unverified as a reading of the vendor).

Practical details:
- Wear the ring on the band line, like the lab's ring "along a horizontal plane above the ears" ([Richards 2002](https://pubmed.ncbi.nlm.nih.gov/12434867/)).
- The Shiva uses "8 pairs of coils, equally spaced around the head", and the vendor calls pair polarity "a matter of personal preference and experimentation" ([Shiva coil setup](https://www.god-helmet.com/wp/shiva/shiva_demo/shiva_coil_setup.htm)). With 8 channels the app uses one coil per position.
- Keep the Fp1/Fp2 coils off the eyebrows and the eyelids.

About 32 programs use this ring, including the `murphy-shiva-*` sessions, `persinger-cook-1999-time-ccw` / `-cw`, `persinger-booth-2008-cw-ccw` and `persinger-swann-2002-table1`.

**The lab's 45° ring: Fp1, FFT7, TP7, POO7, POO8, TP8, FFT8, Fp2.** The lab put solenoid 1 over the left frontal region and solenoid 8 over the right prefrontal region, counter-clockwise ([Persinger & Lavallee 2010](https://jcer.com/index.php/jcj/article/view/99)). On the 10-5 line these sites are 12.5 % (45°) apart along each side; the front gap (Fp1–Fp2) is 10 % and the back gap (POO7–POO8) 15 % (inference). Used by `persinger-octopus-plus20-ccw` / `-cw` and the `persinger-mood-rotated-*` programs.

**Direction.** The app always means clockwise or counter-clockwise seen from above. Sources mix viewpoints. The Shiva index page moves the signals "from back to front over the right side, and in the opposite direction over the left" ([Shiva](https://www.god-helmet.com/wp/shiva/index.htm)). The God Helmet session list describes each side on its own ([God Helmet session list](https://www.god-helmet.com/wp/god-helmet/koren_session_list.htm)). The lab claimed more left-hemisphere power with clockwise and more right-hemisphere power with counter-clockwise rotation ([Booth 2008](https://pubmed.ncbi.nlm.nih.gov/19037792/)); single-lab.

### Temporal pairs (Koren boxes)

- **T7, TP7 + T8, TP8** (about 20 programs, for example `persinger-koren-boxes-tsang-2004`, `persinger-healey-burst-right`, `persinger-saroka-2015-sensed-presence`). Source: "the set of 4 solenoids (Koren boxes) generating a burst-firing magnetic field through the temporal lobes" ([Tsang 2004](https://pubmed.ncbi.nlm.nih.gov/15527205/)). Two coils per side is an inference.
- **FT7, T7 + FT8, T8** (`persinger-granqvist-2005-replication`). Contemporary reporting of the Granqvist study described fields of 3–7 µT "aimed just above and in front of the ears" ([Nature news 2004](https://www.nature.com/news/2004/041206/full/news041206-10.html)).
- **T8, TP8, P8** (`persinger-sculthorpe-2003-*` and `persinger-7hz-point-duration-2003`): the lab's right parietotemporal region ([Sculthorpe & Persinger 2003](https://pubmed.ncbi.nlm.nih.gov/15002842/)); three coils is an inference.
- **T7 / T8 alone** (Shakti test sessions and `persinger-makarec-1987-4hz-cue`).

### Frontal

- **Vendor wording.** For the "stop unwanted effects" signal: "Set up the coils so that they have opposite polarities, and apply them with one or two coils over each eye" ([Shiva mono SDU](https://www.god-helmet.com/wp/shiva/shiva_demo/mono_sdu.htm)). The temporo-frontal page gives only a photo caption ([Shakti temporo-frontal](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/rot_temporo_frontal.htm)). Every frontal site name is therefore an inference.
- **Fp1, AF3 + Fp2, AF4.** `murphy-frontal-reset`, `murphy-paranormal-shakti-frontal` and the frontal lucid-dream step use these on CH1–2 and CH5–6. `frontal` and the one-phase frontal Feelgood put the same four coils on CH5–8, so the band can carry the temporal coils of `meditation-prep` (FT7, TP7, FT8, TP8 on CH1–4) at the same time.
- **Fp1, AF3, AF7, F3 + mirrors** (`murphy-shakti8-limbic-workout-frontal`); **F7, FT7, F8, FT8** (`murphy-shakti8-feelgood-1phase-temporofrontal`, one user's variant, not a vendor design).
- **Caution.** Fp sites lie over the frontalis muscle and the rims of the orbits. Keep the coil face off the eyelid and the brow. Real caps put AF3/AF4 21–23 mm higher than the template ([Scrivener & Reader 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8865144/)).
- **DLPFC sites.** `lowfield-itbs-pattern` uses F3, its cluster variant AF3, F3 and F5, and `lowfield-ctbs-pattern` F4. A common TMS target, MNI (−38, 44, 26), lies about 18 mm below the scalp. In the app's frame its nearest 10-5 sites are AFF5h, F5h and F3, 20–23 mm away (derived; target from [Fox 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC4120275/)).

### Parietal and septal

- **Parietal strip: CP1, CP3, CP5, P3 + mirrors** (`murphy-shakti-caudate-parietal-*`). The vendor describes a strip from about an inch behind the top of the head down to the top of the ears ([Shakti: both parietal lobes](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/bi_parietal.htm)); the site names are an inference.
- **Septal.** Vendor: the signal goes "over the tops of both parietal lobes", "where the somatosensory (sensation) representation for the genitals is located", "from an inch behind the very top of the head to two inches" ([Shakti septal page](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/septum_consent.htm)). The vendor also says the signal "has been tested with only a few human and no animal subjects", so any effect rests on anecdote. The programs use CP1/CP2 side by side (`murphy-shakti-septal-horizontal`, `-fast`) or Cz/CPz front to back (`murphy-shakti-septal-vertical`).
- **What the anatomy says.** One fMRI study (20 women, 3 T) mapped the genital field of the somatosensory cortex at MNI (−19.5, −38, 72) and (18.5, −38, 71.5) ([Knop 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8824509/)); single-lab. In the app's frame the nearest sites are CCP1h/CCP2h, about 24–25 mm away. CP1/CP2 are 29–30 mm away and about 21 mm behind the target. CPz (34–36 mm) is no closer than Cz (37 mm). In the Colin27 frame CP1/CP2 come out nearest. This is the frame problem in practice.

### Right temporoparietal (out-of-body programs)

- **Vendor wording.** "One coil in front of and below the right ear, and one coil over the angular gyrus on the right side" ([Shakti modulated 40 Hz](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/obe45_consent.htm)). `obe` uses FT10 and P6. The `murphy-shakti-obe-*` programs cover both spots with six coils: FT10, T10, TP8, CP6, P6, P8 (inference).
- **Anatomy anchors.** Electrical stimulation of the right angular gyrus produced out-of-body experiences in one patient; the report gives no coordinate ([Blanke 2002](https://pubmed.ncbi.nlm.nih.gov/12239558/)). The research therefore anchors the site on atlas values:
  - the Harvard-Oxford right angular gyrus centroid (51.9, −51.8, 32.4) is about 27 mm from CP6h and CPP6h and 29 mm from CP6 (derived; the fact-checkers reproduced the centroid and the distances);
  - the anterior right TPJ target of a TMS study is (54, −44, 18) ([Krall 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC6867405/));
  - on real caps CP6 lies over the angular gyrus in 53 % of people ([Scrivener & Reader 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8865144/)).

  CP6 is the practical right-TPJ site, and Layout B already holds it.

### Occipital

- **Vendor wording.** The occipital lobes lie "above the ridge on the back of your head" ([Shakti cerebellum page](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/cerebellum.htm)). `murphy-shakti-psi-rv-untested-occipital` uses O1, PO3, O2, PO4. `murphy-shakti-psi-rv-untested` uses Fp1, F3, Fp2, F4 first and the occipital four second. Both programs are rated unverified; their names mark the designs as untested.
- **Related peaks.** In a multimodal ganzfeld study (N = 19), network centrality rose at the left inferior parietal lobule (−38, −76, 30) and the precuneus (0, −70, 54) ([Schmidt 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7596232/)); single-lab. In the app's frame the nearest sites are P3 (25 mm) and Pz (25 mm). In Colin27 they are PPO5h and PPOz.
- **Frame.** Oz in the app's frame lies 20 mm lower than in Colin27, so occipital exposure depends on the frame.

### Cerebellar

- **Vendor wording.** "The occipital lobes are above the ridge on the back of your head, while the cerebellum is below it"; "The cerebellar vermis is the portion of the cerebellum closest to the bony ridge"; the vendor uses a one-coil headset ([Shakti cerebellum page](https://www.god-helmet.com/wp/winshakti/demo/shakti_demo/cerebellum.htm)). `murphy-shakti-cerebellum-erp` and its `-mod40` variant use Iz.
- **Mainstream practice.** Cerebellar TMS trials usually place the coil 1 cm below and 3 cm to the side of the inion ([Wang 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC11830664/)). Electric-field modelling chose a point 1.5 cm below the inion for the vermis ([Tani 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12320761/)). I1/I2 are the matching 10-5 names. O9/O10 do not exist in the app's 10-5 set.
- **Depth.** The nearest cerebellar tissue lies about 27–30 mm below Iz, I1 and I2 (Crus II) and 22–23 mm below P9/P10 (Crus I). Vermis VI is about 43 mm from the nearest site, the dentate nuclei about 50 mm. No 10-5 site is closer than about 64 mm to the brainstem. These are derived from the Diedrichsen atlas and the app's sites ([Diedrichsen cerebellar atlases](https://github.com/DiedrichsenLab/cerebellar_atlases)); a fact-checker reproduced them, but they are template values only.
- **Practical.** In the app's frame Iz lies at z = −45 mm, over the neck muscles. Below the ridge the coil face often cannot lie flat, so the real distance is larger than the template suggests. Hold the coil with a separate strap and check it is comfortable.

### Clinical and mainstream layouts

| Device or method | What the source says | Program and sites | Fit on 8 coils |
|---|---|---|---|
| Re5 T-PEMF | "seven scalp-mounted coils positioned over temporal, parietal and occipital regions": two serial pairs above the temporal lobes, one pair above the parietal lobe, one coil above the occipital lobe, driven in phase; 0.53 A peak; about 0.3 mT and 0.01 V/m at the cortex ([Tang 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13103953/)). Seven coils over the skull ([Martiny 2010](https://pubmed.ncbi.nlm.nih.gov/20385376/)); 3 ms bipolar pulses with 12 ms pauses ([Larsen 2020](https://doi.org/10.1192/j.eurpsy.2020.3)) | `lowfield-tpemf-re5-pattern`: T7, TP7, T8, TP8, P3, P4, Oz (approximation; the paper gives lobes only) | Sites yes. Strength no: 0.3 mT is roughly 20–40 times this helmet's maximum at the cortex (about 8–14 µT at the cap; derived) |
| NeoSync sTMS | Magnet 1 "just above the nasium, overlying the frontopolar region"; magnet 2 over the frontocentral region; magnet 3 over the central head region ([NCT03288714 protocol](https://cdn.clinicaltrials.gov/large-docs/14/NCT03288714/Prot_000.pdf)) | `lowfield-alpha-iaf-midline`: Fpz, Fz, Cz | Sites and frequency yes. A coil pulses along its axis; it cannot rotate the field like a spinning magnet |
| Cnp headset | Coils "beneath plastic ear coverings", worn "just above their ears"; 400 µT at contact, ±200 µT at the head surface, ±35 µT in the deep brain ([Thomas 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC2670735/)) | `lowfield-cnp-thomas-pulse`: the eight Layout B sites (a broader approximation of T7/T8) | Waveform yes; deep-brain strength no |
| LFMS | "Only the top of the patient's head (up to the eyebrows) was positioned inside the coil"; a near-uniform field ([Fava 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5729080/)) | `lowfield-lfms-pattern` on the ring sites | Waveform only; 8 local coils cannot make a uniform whole-head field |
| TMS-style single sites | F3 (left DLPFC), F4 (right DLPFC), C3 (left hand motor area), Oz | `lowfield-itbs-pattern`, `lowfield-ctbs-pattern`, `lowfield-ctbs-pattern-m1`, `lowfield-tsms-dc`, `lowfield-bhfs-pattern` | Timing only; TMS fields are about a million times stronger |

## What 8 coils can and cannot reproduce

- **One coil per position.** The 16-coil God Helmet uses two coils per channel with like polarities ([16-coil God Helmet](https://www.god-helmet.com/wp/god-helmet/16_coil_gh.htm)), and the Shiva uses eight pairs ([Shiva coil setup](https://www.god-helmet.com/wp/shiva/shiva_demo/shiva_coil_setup.htm)). The 8-channel helmet uses one coil per position.
- **64 coils.** A 64-coil Shiva headset appears in one out-of-body case, described in a press release ([PRLog 2012](https://www.prlog.org/11844110-god-helmet-inventor-induces-out-of-body-experience-in-under-six-minutes-using-quiet-magnetic-fields.html)). No coil map was published. `murphy-shiva64-obe-lab` approximates it with two interleaved rings: F7, P7, P8, F8 low and Fz, C3, Pz, C4 around the vertex.
- **Whole-head and rotating fields.** LFMS and rotating-magnet devices cannot be copied; see the table above.
- **Deep targets cannot be selected.** Across five temporal cross variants, the nearest coil stays 60–62 mm from the amygdala and 59–63 mm from the hippocampal head (project research, fact-checked). The cross variants differ in which cortex they reach, not in deep exposure. No arrangement of external sources can put a maximum of the induced electric field inside the brain ([Heller & van Hulsteyn 1992](https://pubmed.ncbi.nlm.nih.gov/1420862/)), and each coil's magnetic field only falls with distance.
- **Coils add as vectors.** Coils that are on together add their fields as vectors. Two opposite coils on a ring driven with the same polarity cancel at the centre.
- **Two areas at once.** Programs that combine temporal and frontal coils split the eight channels (for example `meditation-prep` on CH1–4 and `frontal` on CH5–8). Each area then gets fewer coils.

## Depth and field fall-off

All numbers here come from the project's coil model (`webapp/src/engine/field.js`, method in [BRAIN_VIEW.md](BRAIN_VIEW.md)). The model treats each 19 × 12 mm, 495-turn coil and its core as rings of current. The model gives 1.86 µT/mA on the axis at 20 mm; the firmware's default calibration factor is 1.8 ([CALIBRATION.md](CALIBRATION.md)). A program's µT value is the peak on the axis 20 mm in front of the coil face, which is about 17 mm below the scalp. These are physics estimates of exposure, not evidence of any effect.

### Along the coil axis

| From the coil face | Below the scalp | µT per mA | At the 4.54 mA cap | Relative to the program's µT |
|---|---|---|---|---|
| 0 mm | – | 105 | about 480 µT | 56 × |
| 5 mm | 2 mm | 25 | 114 µT | 13.5 × |
| 10 mm | 7 mm | 8.2 | 37 µT | 4.4 × |
| 15 mm | 12 mm | 3.6 | 16 µT | 1.9 × |
| 20 mm | 17 mm | 1.86 | 8.4 µT | 1 (calibration point) |
| 30 mm | 27 mm | 0.69 | 3.1 µT | 0.37 × |
| 40 mm | 37 mm | 0.33 | 1.5 µT | 0.18 × |
| 50 mm | 47 mm | 0.18 | 0.82 µT | 0.10 × |
| 60 mm | 57 mm | 0.11 | 0.50 µT | 0.06 × |
| 70 mm | 67 mm | 0.072 | 0.33 µT | 0.04 × |

- Beyond about 40 mm the coil acts as a point dipole. The field then falls with the cube of distance: double the distance, one eighth of the field.
- The core raises the field 2.4–2.6 times beyond 20 mm compared with the same winding without a core (0.73 µT/mA at 20 mm, [CALIBRATION.md](CALIBRATION.md)). Calibration absorbs this. Measure your own coils.
- Off the axis, at the same distance and 90° to the side, a dipole's field is half the on-axis value ([Magnetic dipole](https://en.wikipedia.org/wiki/Magnetic_dipole)).
- Distance matters as much for TMS: each extra millimetre between coil and cortex needed about 3 % more TMS output ([Stokes 2005](https://doi.org/10.1152/jn.00067.2005)).

### Spread with depth

The field spot widens with depth. In the model the field falls to half at a radius of 14 mm at 15 mm from the face, 17 mm at 20 mm, 21 mm at 25 mm and 38 mm at 50 mm. Deep exposure is therefore never focal, and it is always weaker than the cortex above it. TMS coils show the same trade-off between depth and focality in all 50 designs simulated ([Deng 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3568257/)). Even coils optimised for deep TMS reach at most about half of the cortical maximum in deep regions ([Gomez-Tames 2020](https://doi.org/10.1088/1361-6560/ab5e4a)).

### From scalp to each target

Under most 10-10 sites the brain surface lies 13–18 mm below the scalp. It is 19–22 mm under the vertex and 28–33 mm under the low chain (FT9, TP9) because of the temporalis muscle and skull base. On the Colin27 template the scalp is 6.9 ± 3.6 mm thick and the skull 6.0 ± 1.9 mm ([Strangman 2014](https://doi.org/10.1016/j.neuroimage.2013.04.090)).

| Target | Depth from the nearest placeable scalp | Best 10-10 coil site (distance) | One coil, per 1 µT program setting | At the hardware cap |
|---|---|---|---|---|
| Cortex under a typical 10-10 site | 13–18 mm | that site | 0.9–1.7 µT | 8–14 µT |
| Cortex under Cz or Pz | 21–22 mm | that site | 0.6 µT | 5 µT |
| Cortex under FT9/FT10, TP9/TP10 | 28–33 mm | that site | 0.2–0.4 µT | 2–3 µT |
| Left TPJ (−60, −54, 20) | 19 mm | CP5 (22 mm) | 0.60 µT | 5 µT |
| Posterior superior temporal gyrus | 22–24 mm | T7 (26 mm) | 0.42 µT | 3.5 µT |
| Right angular gyrus | 25 mm | CP6 (29 mm) | 0.33 µT | 2.8 µT |
| Left DLPFC TMS target (−38, 44, 26) | 18 mm | F3 (23 mm) | 0.56 µT | 4.7 µT |
| Primary visual cortex | 33 mm | O1 / Oz (41 mm) | 0.14 µT | 1.2 µT |
| Temporal pole | 36–37 mm | FT9 (44 mm; FT7 47 mm) | 0.11 µT (FT7: 0.10 µT) | 1.0 µT (FT7: 0.8 µT) |
| Primary auditory cortex (Heschl's gyrus) | 38 mm | T7 (41 mm) | 0.14 µT | 1.1 µT |
| Anterior insula | 39–40 mm | F7 (43 mm) | 0.12 µT | 1.0 µT |
| Precuneus | 45 mm | Pz (45 mm) | 0.11 µT | 0.9 µT |
| Cerebellar cortex, nearest surface | 22–30 mm | P9 (about 22 mm; Iz about 30 mm) | 0.6 µT (Iz: 0.3 µT) | 5 µT (Iz: 2.6 µT) |
| Amygdala | 56–57 mm | FT7 (62 mm) | 0.05 µT | 0.4 µT |
| Hippocampus, body | 55 mm | T7 (56 mm) | 0.06 µT | 0.5 µT |
| Entorhinal cortex | 56 mm | T9 (62 mm) | 0.05 µT | 0.4 µT |
| Caudate nucleus | 62 mm | F5 (63 mm) | 0.05 µT | 0.4 µT |
| Thalamus | 72 mm | T7 (75 mm) | 0.03 µT | 0.25 µT |
| Brainstem | 64 mm or more from any site | – | 0.04 µT at most | 0.3 µT |

Notes on the table:
- **Depths** are derived in the project research on the MNI152 template from open atlases (Harvard-Oxford, Brainnetome, Juelich). A fact-checker reproduced the centroid depths within about 1 mm. The closest edge of the amygdala and hippocampus lies 40–47 mm deep, depending on how the reachable scalp is defined (±5–8 mm). The derived 38 mm for auditory cortex matches the 34–40 mm measured on MRI ([Theodoroff 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5999188/)).
- **Hippocampus.** The head (front part, MNI y > −21, after [Poppenk 2013](https://doi.org/10.1016/j.tics.2013.03.005)) is nearest to FT7/T7, the body to T7, the tail to TPP7, between TP7 and P7.
- **Field values** are at the structure's centre, from the single best 10-10 coil site in the app's frame, normalised the way the firmware calibrates (derived from the coil model). "At the hardware cap" multiplies by the model's 8.4 µT at 20 mm. Most programs default to 1–5 µT.
- **Several coils.** If all four same-side coils of Layout B run in phase with the same polarity, their vectors add to about 2.5 times one coil at the amygdala (0.12 µT per µT setting). Programs in the `cycle` and `rotate` modes step one coil, or one left-right pair, at a time, so the single-coil values apply. Programs in the `bilateral`, `left` and `right` modes drive all coils of a side together, so the sum applies. The Brain tab computes the actual combination for each program.
- **The ratio holds everywhere.** The cortex under a coil always gets roughly 20–30 times more field than the amygdala or hippocampus.

### Induced electric field

Neurons respond to the electric field that a changing magnetic field induces, not to the magnetic field itself. ICNIRP's dosimetry gives at most 23–33 mV/m in the brain per mT of uniform 50 Hz field ([ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf)). For 5 µT that is 0.12–0.17 mV/m at 50 Hz and about 0.02–0.03 mV/m at 10 Hz (derived). For comparison:
- ICNIRP's general-public limit for the central nervous system is 10 mV/m at 10–25 Hz ([ICNIRP 2010](https://www.icnirp.org/cms/upload/publications/ICNIRPLFgdl.pdf)).
- In live rat cortex at least 1 V/m was needed to affect spiking ([Vöröslakos 2018](https://pubmed.ncbi.nlm.nih.gov/29396478/)).
- TMS at motor threshold produces 98–177 V/m in motor cortex ([Turi 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9309210/)).

[BRAIN_VIEW.md](BRAIN_VIEW.md) adds the brief spikes from the 2 kHz output steps, and [SAFETY.md](SAFETY.md) the exposure limits.

## What lies under each site group, and what stronger stimulation did there

This is context. It describes what happened when the same tissue was driven far harder:
- **Direct electrical stimulation (DES):** milliamp currents through electrodes on or in the brain, during epilepsy surgery work-ups.
- **TMS:** about 100 V/m at the cortex.

This helmet induces about a million times less than TMS. Nothing in this table is evidence that these coils produce any of these effects.

Most stimulated cortex produces nothing a patient reports. In 67 patients, 37.3 % of 1,537 stimulated sites gave any effect: 54.6 % in the somatomotor network, 20.8 % in the default network ([Fox 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7572705/)). A review of 93 reports tabulates the effects region by region ([Selimbeyoglu & Parvizi 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2889679/)).

| Site group | Cortex under the coils | Deeper, within reach | What DES or TMS of that tissue produced |
|---|---|---|---|
| Frontopolar: Fp1, Fpz, Fp2, AF7, AF8 | Frontal pole and orbitofrontal cortex, BA10/11 | vmPFC 44 mm, anterior cingulate 46 mm | Stimulating the most anterior prefrontal cortex "almost never affects conscious experience" ([Raccah 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8018764/)). Orbitofrontal sites responded at 17.4 % of 172 sites, mostly smell, taste and touch, almost all behind y = 40 mm ([Fox 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6202946/)). Pregenual cingulate sites gave emotional responses and laughter ([Caruana 2018](https://pubmed.ncbi.nlm.nih.gov/30107501/)). |
| Inferior frontal: F7, F8, F5, F6, FC5, FC6 | Inferior frontal gyrus, ventral premotor cortex | Anterior insula 39–40 mm, lateral orbitofrontal cortex 42 mm | rTMS over left fronto-temporal points stopped speech in all 6 patients; right-sided stimulation did not ([Pascual-Leone 1991](https://pubmed.ncbi.nlm.nih.gov/2027485/)). Insula DES gave somatosensory, visceral, taste and vestibular responses: 67 responsive stimulations across 128 sites in 25 patients ([Afif 2010](https://pubmed.ncbi.nlm.nih.gov/20946128/)). The dorsal anterior insula reproduced ecstatic auras at 1.5–2.1 mA in 3 patients ([Bartolomei 2019](https://pubmed.ncbi.nlm.nih.gov/31196836/)). |
| DLPFC: F3, F4 | Middle frontal gyrus, BA8/9/46 | – | Clinical rTMS for depression (10 Hz, 120 % of motor threshold, 3,000 pulses per session, 4–6 weeks) changes depression scores over weeks, not acute experience ([O'Reardon 2007](https://pubmed.ncbi.nlm.nih.gov/17573044/)). TMS at motor threshold gives 96–179 V/m here ([Turi 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9309210/)). |
| Midline frontal and central: Fz, Cz | Pre-SMA, SMA, paracentral lobule | Mid and posterior cingulate | Medial frontal stimulation below the afterdischarge threshold gave body-mapped movements and "a preliminary sensation of 'urge' to perform a movement" in 13 patients ([Fried 1991](https://pubmed.ncbi.nlm.nih.gov/1941101/)); laughter with mirth from the anterior SMA in one patient ([Fried 1998](https://pubmed.ncbi.nlm.nih.gov/9490408/)). |
| Lateral temporal: FT7, FT8, T7, T8, TP7, TP8 | Superior and middle temporal gyri; FT7/FT8 partly precentral | Temporal pole 36 mm, auditory cortex 38 mm, insula 40–43 mm, amygdala and hippocampus about 55 mm | Lateral temporal cortex gave sounds and voices ([Selimbeyoglu & Parvizi 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2889679/)), and spinning or tilting illusions from the vestibular cortex around the Sylvian fissure: 44 sites in 28 of 260 patients ([Kahane 2003](https://pubmed.ncbi.nlm.nih.gov/14595651/)). Experiential phenomena occurred in 18 of 29 patients, and only when stimulation or a seizure involved limbic structures ([Gloor 1982](https://pubmed.ncbi.nlm.nih.gov/7125603/)). Penfield's experiential responses came from about 7 % of temporal stimulations, by his own count as re-read by [Nitsch & Stahnisch 2018](https://academic.oup.com/cercor/article/28/9/3347/5049846) (claim; the research could not check the 1963 original directly). |
| Deep under the temples (reached weakly from FT7, T7, T9) | – | Amygdala, hippocampus, entorhinal cortex, 55–60 mm | Right amygdala gave negative emotions, especially fear and sadness; left gave pleasant or unpleasant ones ([Lanteaume 2007](https://pubmed.ncbi.nlm.nih.gov/16880223/)). At 0.5 mA, none of 14 patients felt anything or knew when the amygdala was stimulated ([Inman 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5776809/)). Déjà vu came mainly from the entorhinal cortex (24 patients, 280 stimulations; [Bartolomei 2004](https://pubmed.ncbi.nlm.nih.gov/15365137/)). 94.1 % of the stimulations that evoked reminiscences were temporal, and only hippocampal stimulation evoked episodic memories ([Curot 2017](https://pubmed.ncbi.nlm.nih.gov/28445741/)). |
| Supramarginal, angular gyrus, TPJ: C5, C6, CP5, CP6, P5, P6 | Supramarginal and angular gyri | Right TPJ 27 mm | One patient, right angular gyrus, 50 Hz trains of 2 s: vestibular sensations at 2–3 mA, an out-of-body experience at 3.5 mA, body-part illusions at 4–5 mA ([Blanke 2002](https://pubmed.ncbi.nlm.nih.gov/12239558/)). One other patient had an out-of-body experience from right posterior STG stimulation ([De Ridder 2007](https://pubmed.ncbi.nlm.nih.gov/17978291/)). One patient, left TPJ at 10–11 mA: a "shadow person" behind her ([Arzy 2006](https://pubmed.ncbi.nlm.nih.gov/16988702/)). TMS over the TPJ in healthy people impaired mental own-body transformation but caused no out-of-body experience ([Blanke 2005](https://pubmed.ncbi.nlm.nih.gov/15659590/)). Inferior parietal stimulation gave an intention to move ([Desmurget 2009](https://pubmed.ncbi.nlm.nih.gov/19423830/)). Each electrode finding on own-body experiences comes from a single patient (single-lab). |
| Temporo-occipital: P7, P8, PO7, PO8 | Inferior lateral occipital cortex, posterior inferior temporal gyrus | Fusiform gyrus 38 mm | Right fusiform face patches at 2–4 mA distorted perceived faces ([Parvizi 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3517886/)). Place-selective cortex near the collateral sulcus produced seen scenes ([Mégevand 2014](https://pubmed.ncbi.nlm.nih.gov/24741031/)). |
| Parietal midline and strip: Pz, CP1, CP2, P3, P4 | Superior parietal lobule, angular gyrus | Precuneus 45 mm, posterior cingulate 68 mm | Inside the posteromedial cortex, 885 stimulations in 25 patients produced no observable or reported effect ([Foster & Parvizi 2017](https://pubmed.ncbi.nlm.nih.gov/28100728/)). Older review tables list levitation and vertigo from dorsomedial parietal cortex ([Selimbeyoglu & Parvizi 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2889679/)). |
| Occipital: O1, Oz, O2, PO3, PO4 | Occipital pole, V1/V2 | – | Direct V1 stimulation produced phosphenes at 0.2–5 mA ([Winawer & Parvizi 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5182175/)). TMS over the inion evoked phosphenes in 10 of 10 people ([Kammer 1999](https://pubmed.ncbi.nlm.nih.gov/10080376/)). |
| Below and behind the ear, inion row: TP9, TP10, P9, P10, Iz, I1, I2 | Inferior temporal gyrus; cerebellum (Crus I/II) 22–30 mm down | Vermis about 43 mm, dentate about 50 mm, brainstem 64 mm or more | Cerebellar TMS suppressed motor-cortex responses 5–7 ms later, with no reported sensation ([Ugawa 1995](https://pubmed.ncbi.nlm.nih.gov/7778843/)). In 12 volunteers, 20 min of 1 Hz cerebellar rTMS raised negative mood only after an emotion-regulation task ([Schutter & van Honk 2009](https://pubmed.ncbi.nlm.nih.gov/18855096/)). The research found no human DES study of Crus I/II experiences. |
| Out of reach: thalamus, basal ganglia, brainstem | – | 53–84 mm | Stimulating the dorsal midbrain and periaqueductal grey gave somatosensory, ocular, emotional and vasomotor responses ([Iacono & Nashold 1982](https://pubmed.ncbi.nlm.nih.gov/7185797/)). These structures get about 0.06 µT or less per µT of program setting (putamen about 0.06, caudate 0.05, thalamus 0.03; derived). |

Keep two lines of evidence apart:
- **Presence and out-of-body.** The mainstream evidence links the TPJ, insula and frontoparietal cortex to the feeling of a presence. It rests on lesions and a robot that caused sensorimotor conflict in healthy people ([Blanke 2014](https://pubmed.ncbi.nlm.nih.gov/25447995/)), not on weak magnetic fields.
- **Persinger-lab claims.** The lab claimed that specific patterns of "weak (<1 microT)" fields across the temporoparietal region reliably evoked a sensed presence ([St-Pierre & Persinger 2006](https://pubmed.ncbi.nlm.nih.gov/16861170/)). Independent tests did not confirm a field effect ([Granqvist 2005](https://pubmed.ncbi.nlm.nih.gov/15849873/)).

## Seeing it in the app

- **Placement tab.** It holds:
  - the two layouts with diagrams and the programs that use them;
  - every program-specific set ("Layout C") with its site map;
  - the tape-measure steps and Murphy's scalp zones (claims);
  - the site table with depth, anatomy and function;
  - the table of what stimulating each area did;
  - the experience-to-region table.
- **Brain tab.** Pick a program to see:
  - its coils at their aligned 10-5 positions, face 3 mm off the scalp;
  - the peak and RMS field on a glass brain, the deep structures and the cerebellum;
  - the field at the cortex straight under each coil;
  - its targets ranked by estimated field.

  [BRAIN_VIEW.md](BRAIN_VIEW.md) explains the method and its limits.
- **Limits of the maps.**
  - They use one template head; real heads differ by 5–10 mm.
  - The under-coil value uses the site's published depth. The 43 sites in the app's region list have one; all others (for example T9, T10, Iz, I1, I2, AF3, CP1 and every 10-5 site) are assumed to be 15 mm deep, which overstates the field at the low sites (the cortex lies about 24 mm below T9).
  - All values assume the default calibration. Calibrate your coils ([CALIBRATION.md](CALIBRATION.md)).
