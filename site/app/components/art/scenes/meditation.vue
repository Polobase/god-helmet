<template>
  <g>
    <path d="M 66 134 H 174" />
    <ArtKitPerson :x="120" :y="134" :s="1.5" pose="cross" helmet />
    <g class="art-a">
      <g class="art-still">
        <path class="art-dash" d="M 76 104 A 46 46 0 1 1 164 104" />
        <path class="art-dash" opacity="0.6" d="M 65 112 A 60 60 0 1 1 175 112" />
        <path class="art-dash" opacity="0.3" d="M 53.3 120 A 74 74 0 1 1 186.7 120" />
      </g>
      <g class="art-live">
        <path v-for="i in 3" :key="i" class="art-dash art-med-ring" :style="{ animationDelay: `${(i - 1) * -2.4}s` }" d="M 76 104 A 46 46 0 1 1 164 104" />
      </g>
    </g>
  </g>
</template>

<style>
@media (prefers-reduced-motion: no-preference) {
  .art[data-art] .art-med-ring { transform-origin: 120px 90px; animation: art-med-ring 7.2s linear infinite; }
}
@keyframes art-med-ring { 0% { transform: scale(0.92); opacity: 0; } 14% { opacity: 1; } 100% { transform: scale(1.68); opacity: 0; } }
</style>
