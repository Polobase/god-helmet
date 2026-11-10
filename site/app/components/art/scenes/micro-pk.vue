<template>
  <g>
    <path d="M 12 140 H 70" />
    <ArtKitChair :x="38.5" :y="115.85" :s="1.15" />
    <ArtKitPerson :x="38" :y="115.85" :s="1.15" :gaze="[1.6, 0]" />
    <!-- the chip and what it puts out: random, so half above the line and half below -->
    <rect x="80" y="61" width="26" height="26" rx="4" />
    <rect x="87.5" y="68.5" width="11" height="11" rx="2" />
    <path d="M 86 61 v -4 M 93 61 v -4 M 100 61 v -4 M 86 87 v 4 M 93 87 v 4 M 100 87 v 4 M 80 67 h -4 M 80 74 h -4 M 80 81 h -4 M 106 67 h 4 M 106 81 h 4" />
    <path d="M 106 74 H 228" />
    <path class="art-pt" d="M 122 78 h 0.01 M 130 69 h 0.01 M 138 80 h 0.01 M 146 71 h 0.01 M 153 65 h 0.01 M 161 78 h 0.01 M 169 66 h 0.01 M 177 72 h 0.01 M 184 61 h 0.01 M 192 76 h 0.01 M 200 66 h 0.01 M 207 58 h 0.01 M 215 69 h 0.01 M 222 59 h 0.01" />
    <g class="art-a">
      <!-- attending to it -->
      <path class="art-dots art-march" d="M 49 60 C 58 36 84 38 90 54" />
      <!-- the claim: the stream leans -->
      <path class="art-dash art-pk-lean" d="M 116 74 L 228 62" />
    </g>
  </g>
</template>

<style>
@media (prefers-reduced-motion: no-preference) {
  .art[data-art] .art-pk-lean { transform-origin: 116px 74px; animation: art-pk-lean 8s ease-in-out infinite; }
}
@keyframes art-pk-lean { 0%, 100% { transform: rotate(6.1deg); } 45%, 70% { transform: rotate(0deg); } }
</style>
