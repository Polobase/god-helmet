<template>
  <g>
    <path d="M 22 140 H 222" />
    <ArtKitBed :x="98" :y="124" :w="118" />
    <ArtKitPerson :x="92" :y="124" :s="1.2" pose="lie" flip />
    <!-- the tall cupboard, and on top of it the card that can only be seen from above -->
    <rect x="178" y="70" width="36" height="70" rx="3" />
    <path d="M 196 74 V 136" />
    <path class="art-pt" d="M 192.4 104 h 0.01 M 199.6 104 h 0.01" />
    <rect x="185" y="65.4" width="22" height="3.4" rx="1.4" />
    <g class="art-a">
      <path class="art-dots art-obe-cord" d="M 88 102 C 79 88 98 70 89 52" />
      <path class="art-dots art-obe-sight" d="M 151 43 L 190 62" />
      <g class="art-drift" style="--art-dy: -6px; --art-t: 9s">
        <ArtKitPerson :x="92" :y="50" :s="1.2" pose="lie" flip ghost eyes="open" :gaze="[2.6, 2.4]" />
      </g>
    </g>
  </g>
</template>

<style>
@media (prefers-reduced-motion: no-preference) {
  /* The line to the body stretches as the double rises; the line of sight stays on the card. */
  .art[data-art] .art-obe-cord { transform-origin: 88px 102px; animation: art-obe-cord 9s ease-in-out infinite; }
  .art[data-art] .art-obe-sight { transform-origin: 190px 62px; animation: art-obe-sight 9s ease-in-out infinite; }
}
@keyframes art-obe-cord { 50% { transform: scaleY(1.12); } }
@keyframes art-obe-sight { 50% { transform: rotate(7.5deg); } }
</style>
