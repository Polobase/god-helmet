<template>
  <g>
    <ArtKitPerson :x="52" :y="140" :s="2.1" pose="bust" helmet />
    <ArtKitPerson :x="188" :y="140" :s="2.1" pose="bust" helmet />
    <!-- which one had the field is in the envelope until the session is rated -->
    <ArtKitEnvelope :x="120" :y="96" :w="44" :h="30" />
    <g class="art-a">
      <g class="art-blind-a">
        <path class="art-dots art-march" d="M 76.25 70.85 A 28 28 0 0 1 76.25 97.85 M 83.2 66.35 A 36 36 0 0 1 83.2 102.35" />
        <path class="art-dots art-march" d="M 27.75 70.85 A 28 28 0 0 0 27.75 97.85 M 20.8 66.35 A 36 36 0 0 0 20.8 102.35" />
      </g>
      <g class="art-blind-b">
        <path class="art-dots art-march" d="M 212.25 70.85 A 28 28 0 0 1 212.25 97.85 M 219.2 66.35 A 36 36 0 0 1 219.2 102.35" />
        <path class="art-dots art-march" d="M 163.75 70.85 A 28 28 0 0 0 163.75 97.85 M 156.8 66.35 A 36 36 0 0 0 156.8 102.35" />
      </g>
    </g>
  </g>
</template>

<style>
/* Still: the field is at one of the two. Moving: now here, now there; from outside you cannot tell. */
.art .art-blind-b { opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .art[data-art] .art-blind-a { animation: art-blind 9s ease-in-out infinite; }
  .art[data-art] .art-blind-b { animation: art-blind 9s ease-in-out -4.5s infinite; }
}
@keyframes art-blind { 0%, 38% { opacity: 1; } 50%, 88% { opacity: 0; } 100% { opacity: 1; } }
</style>
