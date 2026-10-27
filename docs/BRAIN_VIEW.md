# Brain view: how the field map is made

The **Brain** tab of the app shows, for any program, how strong the coils' magnetic field is across a standard brain, which target regions get how much, and what each region is known (or claimed) to do. It answers "where does the field go?". It does not answer "what does the field do?": no study has shown that fields of a few microtesla switch any of these regions on.

## What you see

- **Glass or solid brain** coloured by field strength in µT on a logarithmic scale from 0.05 µT (dark) to 10 µT (bright). Peak = the largest field during the phase; RMS = the root-mean-square over time, which counts how long a coil is on.
- **Deep structures** (amygdala, hippocampus, basal ganglia, thalamus) as separate surfaces inside the glass brain.
- **Coils** at their 10-05 sites, face 3 mm off the scalp, axis toward the centre of the head. Coils not used in the selected phase are dimmed.
- **Live**: runs the program in the browser (real time, 10× or 50× slower) and shows the instantaneous field and coil drive.
- **What this program aims at**: the program's `targets`, with the estimated field at each.
- **Targets ranked by estimated field**: every curated region with its depth, mainstream function, and the Persinger-lab or Murphy claims about it.
- Tap any point on the brain for its value and the nearest named region.

## Method

1. **Coil model.** Each 19 × 12 mm, 495-turn coil (winding radius 4.1–9.5 mm, 11 mm long) is split into 4 × 4 current loops, and its ferrite/iron core (4 mm radius, 12 mm, flush with the face) is a uniformly magnetised cylinder represented by 8 loops of its surface current (about 1630 ampere-turns per ampere; demagnetisation limits the apparent susceptibility to about 5, so the core material hardly matters). Each loop's field is exact (complete elliptic integrals); beyond 40 mm a point dipole is used (they agree within 1 %). On the axis this gives about 1.8 µT/mA at 20 mm and 105 µT/mA at the face, 2.4× the air-core winding; the air-core version reproduces `tools/coil_field.py` within 2 %. The inductance this model implies (4.1–4.6 mH) matches the seller's 4.1 mH.
2. **Calibration.** Fields are scaled the way the firmware sets intensity: the program's µT value is the peak on the coil axis 20 mm in front of the face ([CALIBRATION.md](CALIBRATION.md)). The ferrite core changes the coil's strength, which calibration absorbs, but hardly the shape of the field at these distances.
3. **Program.** For every phase the engine's own spatial gains (rotation, cycling, alternation, weights) are sampled for 12 s at 1 ms. Coils that are on together add as vectors. The waveform's peak and RMS scale the result; with two tracks the peaks add (an upper bound) and the RMS values add in quadrature.
4. **Brain.** The surfaces are built from the Brainnetome atlas (maximum-probability map, 1 mm, MNI152 space): surface nets on a 2-mm grid, holes filled, Taubin-smoothed. Brainnetome has no cerebellum or brainstem; those come from the CerebrA atlas (MNI ICBM 2009c symmetric space, so a few millimetres off the rest).
5. **Sites.** 10-05 positions from MNE-Python's fsaverage montage, shifted by a translation fitted so that scalp-to-brain distances match published values (34 sites, 1.6 mm RMS error after the fit).
6. **Regions.** About 40 targets (cortical areas, deep nuclei, cerebellum and brainstem) with MNI centres, depths, functions and claims from the project research ([RESEARCH.md](RESEARCH.md)), plus anatomy under 43 scalp sites.
7. **What stimulation did.** For each region, a short note on what direct electrical stimulation (epilepsy surgery, milliamps) or TMS (about 100 V/m) produced, with sources, and neutral Neurosynth meta-analysis terms. This is context for what a region *can* do when driven that hard, not a prediction for this helmet. Most stimulated cortical sites produce nothing reportable ([Fox 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7572705/)).

## Accuracy

- Template head: real heads and brains differ from MNI152 by 5–10 mm; MNI templates are also somewhat larger than average brains.
- Placement by tape is repeatable to about 5–10 mm, comparable to the radius of the field spot a coil makes on the cortex.
- Absolute values depend on calibration; the map is exact only for the stated µT at 20 mm.
- Tissue does not change a low-frequency magnetic field, so the µT values need no head model.
- The induced electric field depends on dB/dt. Smooth signals give only microvolts per metre (a 7 Hz sine at 8 µT: about 2 µV/m at 20 mm). The steps of the 2 kHz output add brief spikes: about 0.6 mV/m for a 1-ms staircase, and at most about 11 mV/m at 20 mm for a full-swing edge lasting a few microseconds. Compare 0.1–1 V/m for the brain's own fields, about 1 V/m to affect spiking in animals, and about 100 V/m for TMS.

## Data and licences

| Data | Source | Licence |
|---|---|---|
| Brain and deep-structure surfaces | Brainnetome atlas, BNA-maxprob-thr25-1mm (Fan et al. 2016, *Cerebral Cortex* 26:3508), NeuroVault collection 1625 | CC0 |
| Cerebellum and brainstem surfaces | CerebrA atlas (Manera et al. 2020, *Scientific Data* 7:237), G-Node | CC0 |
| 10-05 positions | MNE-Python `fsaverage_1005.tsv` (Oostenveld & Praamstra 2001 10-5 system) | BSD-3-Clause |
| Region list | Project research: centroids from Harvard-Oxford, Brainnetome, Juelich and Neurosynth maps; depths derived on MNI152 | – |

## Rebuilding the assets

```sh
# download the two inputs into an empty folder, then:
node tools/brain_assets.mjs --bna BNA-maxprob-thr25-1mm.nii.gz --sites fsaverage_1005.tsv \
  --cerebra CerebrA.nii --regions regions-with-depths.json --out webapp/src/assets/brain
```

`--regions` is optional; it only enables the site-alignment fit. `--grid 3` gives a coarser mesh at 40 % of the size.

The code: `webapp/src/engine/field.js` (coil model and exposure), `webapp/src/lib/brain.js` (assets, caching, colours), `webapp/src/components/BrainScene.vue` (three.js scene), `webapp/src/views/BrainView.vue`.
