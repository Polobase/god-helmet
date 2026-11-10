<script setup lang="ts">
// The figure in every drawing: a round head over a rounded body. No limbs and
// no face beyond the eyes. (x, y) is where it rests: the seat, the floor, the
// bed (for a lying figure, the middle of its underside).
type Pose = 'sit' | 'stand' | 'lie' | 'cross' | 'bust'

const props = withDefaults(defineProps<{
  x?: number
  y?: number
  s?: number
  pose?: Pose
  /** Wears the coil band. */
  helmet?: boolean
  /** How many of the band's coils show: fewer on a small figure. */
  coils?: 3 | 4
  eyes?: 'closed' | 'open' | 'none'
  /** Where the face is turned: moves the eyes on the head. */
  gaze?: [number, number]
  /** Lying: the head at the right end. */
  flip?: boolean
  /** Drawn in the second voice: a felt or imagined figure. */
  ghost?: boolean
}>(), { x: 0, y: 0, s: 1, pose: 'sit', coils: 4, eyes: 'closed', gaze: () => [0, 0] })

// An upright body: 26 wide, round shoulders, `h` tall; open at the foot or closed with small corners.
const arch = (h: number, closed: boolean) =>
  `M -13 ${closed ? -3 : 0} V ${11 - h} A 11 11 0 0 1 -2 ${-h} H 2 A 11 11 0 0 1 13 ${11 - h} V ${closed ? -3 : 0}${closed ? ' A 3 3 0 0 1 10 0 H -10 A 3 3 0 0 1 -13 -3 Z' : ''}`
const BODY: Record<Pose, string> = {
  sit: arch(26, true),
  stand: arch(58, true),
  bust: arch(15, false),
  cross: 'M -12 -11 V -20 A 11 11 0 0 1 -1 -31 H 1 A 11 11 0 0 1 12 -20 V -11',
  lie: 'M -19 -18 H 19 A 9 9 0 0 1 19 0 H -19 A 9 9 0 0 1 -19 -18 Z',
}
const HEAD_Y: Record<Pose, number> = { sit: -37.5, stand: -69.5, bust: -26.5, cross: -42.5, lie: -9 }

const head = computed<[number, number]>(() => (props.pose === 'lie' ? [props.flip ? 39.5 : -39.5, -9] : [0, HEAD_Y[props.pose]]))
const ex = computed(() => props.gaze[0])
const ey = computed(() => props.gaze[1] + (props.helmet ? 3 : 1.2))
// A ghost's outline is the second voice; what it wears (the band) is still ink.
const line = computed(() => (props.ghost ? 'art-a art-dash' : undefined))
const mark = computed(() => (props.ghost ? 'art-a' : undefined))
</script>

<template>
  <g :transform="`translate(${x} ${y}) scale(${s})`">
    <path :d="BODY[pose]" :class="line" />
    <!-- crossed legs: one wide rounded shape under the body -->
    <rect v-if="pose === 'cross'" x="-22" y="-11" width="44" height="11" rx="5.5" :class="line" />
    <g :transform="`translate(${head[0]} ${head[1]})`">
      <circle r="9" :class="line" />
      <template v-if="helmet">
        <path d="M -8.6 -2.6 Q 0 0.8 8.6 -2.6" />
        <path v-if="coils === 4" class="art-pt" d="M -8.6 -2.6 h 0.01 M -3.5 -1.2 h 0.01 M 3.5 -1.2 h 0.01 M 8.6 -2.6 h 0.01" />
        <path v-else class="art-pt" d="M -8.6 -2.6 h 0.01 M 0 -0.9 h 0.01 M 8.6 -2.6 h 0.01" />
      </template>
      <path v-if="eyes === 'closed'" :class="mark" :d="`M ${ex - 5.3} ${ey} q 1.8 1.7 3.6 0 M ${ex + 1.7} ${ey} q 1.8 1.7 3.6 0`" />
      <path v-else-if="eyes === 'open'" :class="['art-pt', mark]" :d="`M ${ex - 3.4} ${ey + 0.4} h 0.01 M ${ex + 3.4} ${ey + 0.4} h 0.01`" />
      <!-- what else is on the head (headphones, eye covers), in the head's own measure: radius 9 -->
      <slot />
    </g>
  </g>
</template>
