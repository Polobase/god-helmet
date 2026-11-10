<template>
  <g>
    <path d="M 24 150 H 216" />
    <!-- a ruler along the floor: the distance is what matters here -->
    <path d="M 86 150 v -4 M 98 150 v -4 M 110 150 v -4 M 122 150 v -4 M 134 150 v -4 M 146 150 v -4 M 158 150 v -4 M 170 150 v -4" />
    <ArtKitPerson :x="62" :y="150" :s="1.3" pose="stand" helmet />
    <!-- the other person across the room: nothing arrives -->
    <ArtKitPerson :x="186" :y="150" :s="1.3" pose="stand" eyes="open" />
    <!-- the field: strong at the coils, a thousand times weaker ten times farther out -->
    <g class="art-a">
      <path class="art-dots art-march" style="opacity: 1" d="M 73.08 45.42 A 18 18 0 0 1 73.08 73.78 M 50.92 45.42 A 18 18 0 0 0 50.92 73.78" />
      <path class="art-dots art-march" style="opacity: 0.55" d="M 78.62 38.32 A 27 27 0 0 1 78.62 80.88 M 45.38 38.32 A 27 27 0 0 0 45.38 80.88" />
      <path class="art-dots art-march" style="opacity: 0.28" d="M 84.78 30.44 A 37 37 0 0 1 84.78 88.76 M 39.22 30.44 A 37 37 0 0 0 39.22 88.76" />
      <path class="art-dots art-march" style="opacity: 0.12" d="M 91.55 21.78 A 48 48 0 0 1 91.55 97.42 M 32.45 21.78 A 48 48 0 0 0 32.45 97.42" />
    </g>
  </g>
</template>
