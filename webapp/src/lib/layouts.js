// Coil placement metadata (docs/PLACEMENT.md). Index 0..7 = CH1..CH8.

export const LAYOUTS = {
  ring: {
    key: 'ring',
    name: 'Ring',
    letter: 'A',
    title: 'Circumcerebral ring ("Octopus")',
    summary:
      'Eight coils evenly spaced around the head in a horizontal ring 1–2 cm above the ear tops, every 1/8 of the head circumference. Channels run counter-clockwise seen from above, so a CCW rotation moves front→back over the left side and back→front over the right.',
    source: 'Richards, Koren & Persinger 2002; Murphy, Psychic Skills lecture',
    channels: [
      { site: 'Fpz', where: 'Forehead, midline', region: 'Frontal pole (BA10)' },
      { site: 'F7', where: 'Left front', region: 'Left inferior frontal gyrus (BA45/47)' },
      { site: 'T7', where: 'Above the left ear', region: 'Left posterior superior/middle temporal gyrus (BA21/22)' },
      { site: 'P7', where: 'Left back', region: 'Left inferior temporal / lateral occipital (BA37/19)' },
      { site: 'Oz', where: 'Back of the head, midline', region: 'Occipital pole (V1/V2)' },
      { site: 'P8', where: 'Right back', region: 'Right inferior temporal / lateral occipital (BA37/19), near V5/MT' },
      { site: 'T8', where: 'Above the right ear', region: 'Right posterior superior/middle temporal gyrus (BA21/22)' },
      { site: 'F8', where: 'Right front', region: 'Right inferior frontal gyrus (BA45/47)' },
    ],
  },
  temporal: {
    key: 'temporal',
    name: 'Temporal 4+4',
    letter: 'B',
    title: 'Temporal 4+4 (Koren helmet / 8-coil Shakti)',
    summary:
      'A 2×2 grid over each temporal lobe, centred about 2 cm above the ear top, coils about 3.5 cm apart. Each position sits over a region the presets target.',
    source: 'Persinger/Koren helmet; Murphy–Balbin interview; god-helmet.com',
    channels: [
      { site: 'FT7', where: 'Left temple, in front of the ear top', region: 'Anterior temporal gyri near the temporal pole; nearest site to the amygdala (~6 cm deeper)' },
      { site: 'T7', where: '2 cm above the left ear', region: 'Posterior superior/middle temporal gyrus; nearest site to the hippocampus (~5.7 cm deeper)' },
      { site: 'CP5', where: 'Left, above and behind the ear', region: 'Supramarginal gyrus (BA40), upper part of the left TPJ' },
      { site: 'TP7', where: 'Left, behind the ear top', region: 'Temporo-occipital middle temporal gyrus (BA21/37)' },
      { site: 'FT8', where: 'Right temple, in front of the ear top', region: 'Anterior temporal gyri near the temporal pole; nearest site to the amygdala (~6 cm deeper)' },
      { site: 'T8', where: '2 cm above the right ear', region: 'Posterior superior/middle temporal gyrus; nearest site to the hippocampus (~5.7 cm deeper)' },
      { site: 'CP6', where: 'Right, above and behind the ear', region: 'Right supramarginal/angular gyrus (BA40/39), right TPJ: OBE site of Blanke 2002' },
      { site: 'TP8', where: 'Right, behind the ear top', region: 'Posterior middle temporal gyrus, lower part of the right TPJ' },
    ],
  },
}

// Display names for a session layout, including program-specific placements.
export function layoutInfo(layout) {
  return LAYOUTS[layout] ?? { key: 'custom', name: 'Custom', letter: 'C', title: 'Program-specific placement (10-10 sites)' }
}

// States -> brain region -> preset (docs/RESEARCH.md §5). "claim" = Persinger/Murphy.
export const STATE_MAP = [
  { state: 'God Helmet classic (presence → bliss)', region: 'Right hemisphere, then both amygdalae (claim)', preset: 'god-helmet-classic' },
  { state: 'Sensed presence', region: 'Right/bilateral temporoparietal (Persinger & Healey 2002); left TPJ "shadow person" with electrodes (Arzy 2006)', preset: 'presence-right' },
  { state: 'Out-of-body', region: 'Right angular gyrus / TPJ (Blanke 2002, electrode stimulation)', preset: 'obe' },
  { state: 'Remote viewing', region: 'Right hemisphere; Swann\'s accuracy tracked occipital 7 Hz (Persinger 2002)', preset: 'remote-viewing' },
  { state: 'Telepathy (sender)', region: 'Shared circumcerebral field (Persinger, Koren & Tsang 2003)', preset: 'telepathy-sender' },
  { state: 'Meditation prep', region: 'Temporal lobes (Murphy)', preset: 'meditation-prep' },
  { state: 'Mood lift / lucid dreams', region: 'Temporal sessions, then frontal (Murphy)', preset: 'frontal' },
  { state: 'Love / agape', region: 'Left amygdala and caudate (Murphy, anecdotal)', preset: 'love-agape' },
]
