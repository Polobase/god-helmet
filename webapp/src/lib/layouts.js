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
      { site: 'Fpz', where: 'Forehead, midline', region: 'Frontal pole' },
      { site: 'F7', where: 'Left front', region: 'Left inferior frontal' },
      { site: 'T7', where: 'Above the left ear', region: 'Left mid-temporal' },
      { site: 'P7', where: 'Left back', region: 'Left posterior temporal / parietal' },
      { site: 'Oz', where: 'Back of the head, midline', region: 'Occipital' },
      { site: 'P8', where: 'Right back', region: 'Right posterior temporal / parietal' },
      { site: 'T8', where: 'Above the right ear', region: 'Right mid-temporal' },
      { site: 'F8', where: 'Right front', region: 'Right inferior frontal' },
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
      { site: 'FT7', where: 'Left temple, in front of the ear top', region: 'Anterior temporal → amygdala (~5 cm deep)' },
      { site: 'T7', where: '2 cm above the left ear', region: 'Mid temporal → hippocampus (~4–5 cm deep)' },
      { site: 'CP5', where: 'Left, above and behind the ear', region: 'Temporoparietal junction (supramarginal/angular gyrus)' },
      { site: 'TP7', where: 'Left, behind the ear top', region: 'Posterior temporal lobe' },
      { site: 'FT8', where: 'Right temple, in front of the ear top', region: 'Anterior temporal → amygdala (~5 cm deep)' },
      { site: 'T8', where: '2 cm above the right ear', region: 'Mid temporal → hippocampus (~4–5 cm deep)' },
      { site: 'CP6', where: 'Right, above and behind the ear', region: 'Temporoparietal junction: OBE (Blanke 2002), presence' },
      { site: 'TP8', where: 'Right, behind the ear top', region: 'Posterior temporal lobe' },
    ],
  },
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
