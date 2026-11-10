// Where each Markdown file of the repository appears on the site.
// The files themselves stay untouched (no frontmatter): they still read well
// on GitHub and in the old app. Everything the site needs to know is here.

export type Section = 'articles' | 'docs'

export interface DocMeta {
  /** Repository path of the source file. */
  file: string
  section: Section
  /** URL slug: /articles/<slug> or /docs/<slug>. */
  slug: string
  /** Short name for navigation. */
  label: string
  /** One or two plain sentences for cards, search results and meta tags. */
  description: string
  /** Articles: the kind of piece. Docs: the sidebar group. */
  group: string
  /** ISO date of the last substantial revision, where the file states one. */
  updated?: string
  /**
   * Not published on the site: the file stays in the repository, gets no page,
   * and links to it are shown as plain text. Set while what it describes has
   * not been checked (the hardware build, until a complete helmet is tested).
   */
  hidden?: boolean
}

export const DOC_GROUPS = ['Start here', 'Build it', 'Use it', 'Reference'] as const

const ALL_DOCS: DocMeta[] = [
  // ---- articles
  {
    file: 'docs/EFFECT_SENSED_PRESENCE.md',
    section: 'articles',
    slug: 'sensed-presence',
    label: 'Sensed presence',
    group: 'Effect',
    description: 'The feeling that someone is there: what people report, what Persinger’s lab claimed, what the one rigorous replication found, and where the experience turns up without any helmet.',
  },
  {
    file: 'docs/EFFECT_OUT_OF_BODY.md',
    section: 'articles',
    slug: 'out-of-body',
    label: 'Out-of-body experiences',
    group: 'Effect',
    description: 'What is reported, what the brain does when the body image comes apart, and what a weak-field helmet can and cannot test.',
  },
  {
    file: 'docs/EFFECT_REMOTE_VIEWING.md',
    section: 'articles',
    slug: 'remote-viewing',
    label: 'Remote viewing',
    group: 'Effect',
    description: 'What remote viewing is, why it is tied to the God Helmet, and how to test it with committed targets and blind judging.',
  },
  // Claims that go beyond a reported experience: one research article each.
  {
    file: 'docs/EFFECT_TELEPATHY.md',
    section: 'articles',
    slug: 'telepathy',
    label: 'Telepathy',
    group: 'Claim',
    description: 'What telepathy research found from crisis apparitions to the ganzfeld, what Persinger’s partner and sibling studies report against what Murphy says of them, and how two people can run a committed, blinded trial.',
  },
  {
    file: 'docs/EFFECT_RING.md',
    section: 'articles',
    slug: 'the-ring',
    label: 'The ring, or “Octopus”',
    group: 'Claim',
    description: 'The eight-coil ring that steps a field around the head: the device, the 40 Hz “binding” idea behind it, every published study, and a stopwatch test anyone can run blind.',
  },
  {
    file: 'docs/EFFECT_LINKED_BRAINS.md',
    section: 'articles',
    slug: 'linked-brains',
    label: 'Linked brains',
    group: 'Claim',
    description: 'The claim that two people in the same rotating field become linked: the lab’s record, what entanglement can and cannot do, the older EEG studies, and what a fair test would need.',
  },
  {
    file: 'docs/EFFECT_REMOTE_INFLUENCE.md',
    section: 'articles',
    slug: 'influence-at-a-distance',
    label: 'Influence at a distance',
    group: 'Claim',
    description: 'The claim that intention or a device can change someone from afar: the laboratory and prayer-trial record, MKULTRA and microwave hearing in the documents, and why a helmet’s field does not reach beyond the head it sits on.',
  },
  {
    file: 'docs/EFFECT_GEOMAGNETIC.md',
    section: 'articles',
    slug: 'geomagnetic-activity',
    label: 'Geomagnetic activity',
    group: 'Claim',
    description: 'Quiet days for telepathy, stormy days for apparitions, and a peak at 13.5 h sidereal time: what Persinger, Murphy and Spottiswoode claimed, what Kp and ap measure, what later data showed, and how many sessions a fair test needs.',
  },
  {
    file: 'docs/EFFECT_MICRO_PK.md',
    section: 'articles',
    slug: 'random-numbers',
    label: 'Mind over random numbers',
    group: 'Claim',
    description: 'Can intention shift a random number generator? The record from Schmidt and PEAR to the pre-registered nulls, the Laurentian field studies, how the helmet’s hardware generator works, and why the claimed effect is too small for one person to test.',
  },
  {
    file: 'docs/RESEARCH.md',
    section: 'articles',
    slug: 'research',
    label: 'The evidence',
    group: 'Review',
    updated: '2026-10-27',
    description: 'The evidence review: the Persinger lab, independent tests, vendor claims, mainstream low-field science, and which brain regions go with which reported states.',
  },
  {
    file: 'docs/HISTORY.md',
    section: 'articles',
    slug: 'history',
    label: 'History',
    group: 'History',
    description: 'Military, intelligence and health-agency history: ELF research, the remote-viewing programmes, Gateway, the replication controversy, and what WHO, IARC and ICNIRP concluded.',
  },

  // ---- docs
  {
    file: 'README.md',
    section: 'docs',
    slug: 'overview',
    label: 'Overview',
    group: 'Start here',
    description: 'What the project is, what is in the repository, quick start and current status.',
  },
  {
    file: 'docs/SAFETY.md',
    section: 'docs',
    slug: 'safety',
    label: 'Safety',
    group: 'Start here',
    description: 'Who must not use the helmet, the rules for every session, and the safeguards built into the firmware.',
  },
  {
    file: 'hardware/BOM.md',
    hidden: true,
    section: 'docs',
    slug: 'parts',
    label: 'Parts list',
    group: 'Build it',
    description: 'Every part of the helmet with quantities and notes.',
  },
  {
    file: 'docs/WIRING.md',
    hidden: true,
    section: 'docs',
    slug: 'wiring',
    label: 'Wiring',
    group: 'Build it',
    description: 'Schematic, coil leads, pin tables for each supported board, the arming switch and cable pair mapping.',
  },
  {
    file: 'docs/CALIBRATION.md',
    hidden: true,
    section: 'docs',
    slug: 'calibration',
    label: 'Calibration',
    group: 'Build it',
    description: 'Bench test of the module, wiring checks, and measuring µT per mA with a phone.',
  },
  {
    file: 'docs/STANDALONE.md',
    hidden: true,
    section: 'docs',
    slug: 'standalone',
    label: 'Touchscreen board',
    group: 'Build it',
    description: 'Running the helmet from the 2.8" display board without phone or computer: flashing, the SD-card program pack, clock and screens.',
  },
  {
    file: 'docs/PLACEMENT.md',
    section: 'docs',
    slug: 'placement',
    label: 'Coil placement',
    group: 'Use it',
    description: 'The 10-10 system, finding sites with a tape measure, the standard and program-specific layouts, depth and field per target.',
  },
  {
    file: 'docs/EXPERIMENTS.md',
    section: 'docs',
    slug: 'experiments',
    label: 'Experiments',
    group: 'Use it',
    description: 'Blinded real and sham sessions, remote-viewing and telepathy protocols, and the statistics behind the results table.',
  },
  {
    file: 'docs/GUIDES.md',
    section: 'docs',
    slug: 'guides',
    label: 'Guided sessions',
    group: 'Use it',
    description: 'The guided-session format, the audio engine and how guides arm the helmet.',
  },
  {
    file: 'docs/QUESTIONNAIRES.md',
    section: 'docs',
    slug: 'questionnaires',
    label: 'Questionnaires',
    group: 'Use it',
    description: 'The questionnaires used in guides, their sources, licences and scoring.',
  },
  {
    file: 'docs/SIGNALS.md',
    section: 'docs',
    slug: 'signals',
    label: 'Signals',
    group: 'Reference',
    description: 'What the coils play: coil physics and exposure limits, the Persinger-lab signals rebuilt from primary sources, vendor signal families and clinical timings.',
  },
  {
    file: 'docs/PRESET_FORMAT.md',
    section: 'docs',
    slug: 'preset-format',
    label: 'Program file format',
    group: 'Reference',
    description: 'The program file format, every signal and coil mode, the pulse-table generators and the preset checker.',
  },
  {
    file: 'docs/BRAIN_VIEW.md',
    section: 'docs',
    slug: 'brain-view',
    label: 'Brain view',
    group: 'Reference',
    description: 'How the field map on the brain is computed, how accurate it is, and the data and licences behind it.',
  },
  {
    file: 'docs/BLE_PROTOCOL.md',
    section: 'docs',
    slug: 'protocol',
    label: 'Device protocol',
    group: 'Reference',
    description: 'The Bluetooth service, packet framing, the USB line protocol, every operation, session JSON and the trial commitment.',
  },
]

/** Every Markdown file the site knows, published or not. */
export const KNOWN_DOCS: readonly DocMeta[] = ALL_DOCS
/** The pages the site publishes. */
export const DOCS: DocMeta[] = ALL_DOCS.filter((d) => !d.hidden)
/** Figures that belong to unpublished pages: not shown anywhere, not put in the bundle. */
export const HIDDEN_FIGURES: readonly string[] = ['schematic.svg', 'coil-leads.svg']

/** The program reference is generated from presets/*.json, not from a Markdown file. */
export const PROGRAM_REFERENCE = {
  section: 'docs' as const,
  slug: 'programs',
  label: 'Program reference',
  group: 'Reference',
  description: 'Every program the helmet can run, generated from the same files the helmet runs: phases, signals, coils, evidence level and sources.',
}

export const pathFor = (m: { section: Section, slug: string }) => `/${m.section}/${m.slug}`

const stem = (file: string) => file.split('/').pop()!.replace(/\.md$/i, '').toLowerCase()

const byFile = new Map(KNOWN_DOCS.map((m) => [m.file.toLowerCase(), m]))
// The old app's Docs tab named pages by lowercased file name: #docs/effect_sensed_presence.
const byOldSlug = new Map(DOCS.map((m) => [stem(m.file), m]))

export const docByFile = (file: string) => byFile.get(file.toLowerCase())

/** Site path for one of the old app's `#docs/<slug>` pages. */
export function pathForOldSlug(slug: string): string | null {
  const s = slug.toLowerCase()
  if (s === 'programs') return pathFor(PROGRAM_REFERENCE)
  const m = byOldSlug.get(s)
  return m ? pathFor(m) : null
}
