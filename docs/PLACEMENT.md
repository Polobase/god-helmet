# Coil placement

All 8 coils mount on one **6–8 cm neoprene/elastic headband with Velcro**, so they can be moved between the two layouts. The firmware knows both layouts as channel maps; each preset says which one it expects.

## Preparing the coils

- Solder the thin enamelled leads to stranded wire (or straight to the Cat5 pair): **inner lead = signal, outer lead = return** (docs/WIRING.md). Scrape the enamel first. Add heat-shrink, then a drop of epoxy or hot glue as strain relief.
- Leads exit away from the head; the clean bottom face goes toward the scalp.
- Wrap the windings with one layer of Kapton tape so they can't chafe.
- Mount each coil with a **nylon M3 screw** into its ferrite core, through a 3D-printed clip (`hardware/coil_clip.scad`) with Velcro on the back. Steel screws change the core's magnetic behaviour.
- The coil axis points to the centre of the head; the face sits 1–3 mm from the scalp (hair/cap in between is fine).
- **Same polarity for all coils.** Start a DC test (+2 mA) for one channel and hold a compass at its face. Note which compass end is attracted and mark that face "N". Mount every coil with its N face toward the head.

## Finding the positions

Use the international 10-20 EEG system:
- **Nasion**: the dip between the eyes, at the top of the nose.
- **Inion**: the bump at the back of the skull.
- **Pre-auricular points**: just in front of each ear.

Measure the head circumference along a line about **10 % of the nasion–inion distance above nasion and inion**. That is roughly 2 cm above the eyebrows and just above the ear tops, the line the headband follows.

## Layout A: circumcerebral ring ("Octopus", Persinger 2002–2010)

Eight coils evenly spaced around the head, every 1/8 of the circumference (about 7 cm on a 56 cm head), in a horizontal ring about 1–2 cm above the ear tops. Channels run **counter-clockwise viewed from above**, so a CCW rotation moves front→back over the left side and back→front over the right side, as in the Shiva/Octopus description.

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

| Channel | Site | Over |
|---|---|---|
| CH1 | Fpz | Frontal pole (midline) |
| CH2 | F7 | Left inferior frontal |
| CH3 | T7 | Left mid-temporal (above the ear) |
| CH4 | P7 | Left posterior temporal / parietal |
| CH5 | Oz | Occipital (midline) |
| CH6 | P8 | Right posterior temporal / parietal |
| CH7 | T8 | Right mid-temporal |
| CH8 | F8 | Right inferior frontal |

Presets using this layout:
- `remote-viewing`, `telepathy-sender`, `circumcerebral-theta`, `circumcerebral-gamma`;
- `frontal`, which drives only CH1/CH2/CH8.

## Layout B: temporal 4 + 4 (Koren helmet / 8-coil Shakti)

A 2×2 grid over each temporal lobe, centred about 2 cm above the ear top, coils about 3.5 cm apart (centre to centre). Each position sits over a region the presets target:

```
   LEFT side of the head (you look at the left ear)        RIGHT side (mirror image)

        front ◄──────────────► back                         back ◄──────────────► front
              CH2 T7      CH3 CP5   (upper row)                    CH7 CP6     CH6 T8
        CH1 FT7      ear      CH4 TP7 (lower row)             CH8 TP8     ear      CH5 FT8
```

| Channel (L / R) | Site (L / R) | Position | What lies underneath |
|---|---|---|---|
| CH1 / CH5 | FT7 / FT8 | Temple, in front of the ear top | Anterior temporal lobe (amygdala ~5 cm deep below) |
| CH2 / CH6 | T7 / T8 | About 2 cm straight above the ear | Mid temporal lobe (hippocampus ~4–5 cm deep) |
| CH3 / CH7 | CP5 / CP6 | Above and behind the ear, upper row | **Temporoparietal junction**: supramarginal/angular gyrus (OBE, presence) |
| CH4 / CH8 | TP7 / TP8 | Behind the ear top, lower row | Posterior temporal lobe |

Presets using this layout:
- `god-helmet-classic`, `presence-right/left`, `obe`, `meditation-prep`, `love-agape`, `shakti-alternate`, `thomas-pulse`, `sham`.

Phase 1 of the classic God Helmet cycles through the right coils in CCW order: TP8 → CP6 → T8 → FT8 (back to front).

## Depth reality check

With the field values in docs/RESEARCH.md §4:
- the cortex directly under a coil (15–20 mm) gets the "1 µT" the presets talk about;
- the hippocampus and amygdala (40–60 mm deep) get 10–20× less.

The layouts aim the coils at the regions named in the literature. Whether µT fields there do anything is exactly what the blinded modes test.
