<template>
  <g>
    <path d="M 26 140 H 204" />
    <ArtKitBed :x="114" :y="124" :w="136" />
    <ArtKitPerson :x="124" :y="124" :s="1.35" pose="lie" />
    <ArtKitMoon :x="192" :y="42" :r="14" />
    <path class="art-pt" d="M 158 24 h 0.01 M 222 70 h 0.01 M 150 52 h 0.01" />
    <!-- slow waves -->
    <g class="art-a">
      <path class="art-dots art-march" style="--art-t: 2.4s" d="M 38 86 q 13 -14 26 0 t 26 0 t 26 0 t 26 0" />
      <path class="art-dots art-march" style="--art-t: 2.4s" d="M 52 64 q 13 -14 26 0 t 26 0 t 26 0" />
    </g>
  </g>
</template>
