// The illustrations: which drawings exist, and which one stands for what.
// A scene is a large drawing that explains one effect (app/components/art/scenes);
// a mark is a small one that says "this kind of thing" in the app
// (app/components/art/marks). Plain data: the unit test reads it without Vue.
import type { InjectionKey, Ref } from 'vue'

/** Provided where drawings must not move for a while (the app, while the helmet runs a session). */
export const ART_QUIET: InjectionKey<Ref<boolean>> = Symbol('art-quiet')

export const SCENES = [
  'presence', 'obe', 'remote-viewing', 'telepathy', 'ring', 'linked', 'geomagnetic',
  'blind', 'micro-pk', 'sleep', 'meditation', 'ganzfeld', 'history', 'helmet', 'reach',
] as const
export type SceneId = (typeof SCENES)[number]

export const MARKS = [
  // what a program or a guide is about
  'helmet', 'presence', 'obe', 'psi', 'remote-viewing', 'telepathy', 'meditation', 'mood', 'sleep', 'body',
  'signal', 'course', 'pulse', 'ring', 'replication', 'research', 'sham',
  'gateway', 'cards', 'self-test', 'questionnaire',
  // nothing here yet
  'notebook', 'envelope', 'photos', 'unplugged',
] as const
export type MarkId = (typeof MARKS)[number]

/** Program categories (presets/*.json, `category`). */
export const PROGRAM_MARKS: Record<string, MarkId> = {
  spiritual: 'helmet',
  presence: 'presence',
  obe: 'obe',
  psi: 'psi',
  meditation: 'meditation',
  mood: 'mood',
  dreams: 'sleep',
  body: 'body',
  signals: 'signal',
  courses: 'course',
  lowfield: 'pulse',
  persinger: 'ring',
  replication: 'replication',
  research: 'research',
  control: 'sham',
}

/** Guide categories (guides/*.json, `category`). */
export const GUIDE_MARKS: Record<string, MarkId> = {
  gateway: 'gateway',
  'remote-viewing': 'remote-viewing',
  'esp-training': 'cards',
  'self-test': 'self-test',
  questionnaire: 'questionnaire',
  sleep: 'sleep',
}

/** The two kinds of trial (lib/trials.ts, `mode`). */
export const TRIAL_MARKS: Record<string, MarkId> = { rv: 'remote-viewing', telepathy: 'telepathy' }

/** Programs whose mark says more than their category's does (the Experience list). */
const PROGRAM_OWN_MARKS: Record<string, MarkId> = {
  'remote-viewing': 'remote-viewing',
  'telepathy-sender': 'telepathy',
  frontal: 'mood',
  'love-agape': 'body',
}

export const programMark = (category?: string, id?: string): MarkId | null =>
  (id && PROGRAM_OWN_MARKS[id]) || (category && PROGRAM_MARKS[category]) || null
export const guideMark = (category?: string): MarkId | null => (category && GUIDE_MARKS[category]) || null

/** Articles and docs pages that open with a scene, by site path. */
export const PAGE_SCENES: Record<string, SceneId> = {
  '/articles/sensed-presence': 'presence',
  '/articles/out-of-body': 'obe',
  '/articles/remote-viewing': 'remote-viewing',
  '/articles/telepathy': 'telepathy',
  '/articles/the-ring': 'ring',
  '/articles/linked-brains': 'linked',
  '/articles/influence-at-a-distance': 'reach',
  '/articles/geomagnetic-activity': 'geomagnetic',
  '/articles/random-numbers': 'micro-pk',
  '/articles/research': 'helmet',
  '/articles/history': 'history',
  '/docs/overview': 'helmet',
  '/docs/experiments': 'blind',
  '/docs/placement': 'ring',
  '/docs/guides': 'meditation',
}
export const pageScene = (path?: string): SceneId | null => (path && PAGE_SCENES[path]) || null

/**
 * Guides that have a scene of their own (guides/*.json, `id`), and the scene
 * for the rest of a category. A guide without either shows its category's mark only.
 */
export const GUIDE_SCENES: Record<string, SceneId> = {
  'rng-pk': 'micro-pk',
  'psi-trial-flow': 'ganzfeld',
  'obe-target-check': 'obe',
  'obe-target-record': 'obe',
  'shapes-colors': 'telepathy',
  'outbound-beacon': 'telepathy',
  'helmet-factorial': 'blind',
  'helmet-session-flow': 'blind',
}
const GUIDE_CATEGORY_SCENES: Record<string, SceneId> = { gateway: 'meditation', 'remote-viewing': 'remote-viewing', sleep: 'sleep' }
export const guideScene = (id?: string, category?: string): SceneId | null =>
  (id && GUIDE_SCENES[id]) || (category && GUIDE_CATEGORY_SCENES[category]) || null

/**
 * Programs with a scene of their own (presets/*.json, `id`), and the scene for
 * the rest of a category where every program in it is about the same effect.
 * `ring`: the program steps its field around all eight coils.
 */
export const PROGRAM_SCENES: Record<string, SceneId> = {
  'remote-viewing': 'remote-viewing',
  'persinger-swann-2002-table1': 'remote-viewing',
  'military-p06-persinger-swann-1998': 'remote-viewing',
  'murphy-shakti-psi-rv-untested-occipital': 'remote-viewing',
  'telepathy-sender': 'telepathy',
  'persinger-shared-memory-2002': 'telepathy',
  'persinger-siblings-2003-stimulus': 'linked',
  'persinger-strangers-2008': 'linked',
  'persinger-strangers-2008-reversed': 'linked',
  'persinger-yoked-2010-microstate': 'linked',
  'persinger-dotta-2011-shared-photon': 'linked',
  'persinger-burke-2013-halo': 'linked',
  'persinger-burke-2013-halo-field-first': 'linked',
  'persinger-scott-2015-transatlantic': 'linked',
  'lowfield-geomagnetic-rotation-probe': 'geomagnetic',
}
const PROGRAM_CATEGORY_SCENES: Record<string, SceneId> = { presence: 'presence', obe: 'obe', meditation: 'meditation', dreams: 'sleep', replication: 'blind', control: 'blind' }
export const programScene = (category?: string, id?: string, ring = false): SceneId | null =>
  (id && PROGRAM_SCENES[id]) || (category && PROGRAM_CATEGORY_SCENES[category]) || (ring ? 'ring' : null)

/** What each scene shows, for screen readers where the drawing carries meaning. */
export const SCENE_LABELS: Record<SceneId, string> = {
  presence: 'A seated person wearing the coil band; beside them a second figure drawn in dashes, the presence they feel',
  obe: 'A person lying on a bed; a dashed double floats above and looks down at a card on top of a cupboard',
  'remote-viewing': 'A person with the coil band sketches at a table; behind a wall a sealed envelope holds a picture, and a rough copy of it appears on the sketch',
  telepathy: 'Two rooms: in one a person looks at a picture card; in the other a person with the coil band sits with eyes closed, and the card’s shape appears beside them in dashes',
  ring: 'A head seen from above with eight coils around it; the field steps from coil to coil counter-clockwise, each step a little shorter than the last',
  linked: 'Two people seen from above, far apart, each in a ring of eight coils; a light flashes at one, and a dashed blip appears on the other’s EEG trace',
  geomagnetic: 'The earth with its field lines, smooth on one side and disturbed on the other, and a small sleeping figure below',
  blind: 'Two identical heads with coil bands, one with field lines and one without; a sealed envelope between them holds which was which',
  'micro-pk': 'A seated person attends to a chip that sends out a stream of random dots; a dashed line shows the stream leaning slightly one way',
  sleep: 'A sleeping person under a crescent moon, with slow waves drawn in dots above',
  meditation: 'A person sitting cross-legged with eyes closed; dashed rings widen around them',
  ganzfeld: 'A reclined person with half-spheres over the eyes and headphones on, surrounded by soft noise',
  history: 'A filing folder with papers in it and an emblem of eight coils in a ring on its cover',
  helmet: 'The helmet: a band with eight coils and a cable to a small control board',
  reach: 'A person wearing the coil band; the dotted field around the head fades within a hand’s width and does not reach a second person across the room',
}

/**
 * Where coil `i` (0 to 7) sits on a head of radius `r` seen from above, nose up.
 * Coil 0 is over the left frontal region and the count runs counter-clockwise,
 * ending over the right frontal region: the order the lab's ring was driven in.
 */
export function ringPoint(i: number, r: number): [number, number] {
  const a = (-(22.5 + 45 * i) * Math.PI) / 180
  return [Math.round(r * Math.sin(a) * 100) / 100, Math.round(-r * Math.cos(a) * 100) / 100]
}
