<template>
  <g>
    <!-- two rooms seen from above, far apart -->
    <rect x="18" y="14" width="86" height="132" rx="9" />
    <rect x="136" y="14" width="86" height="132" rx="9" />
    <!-- a light flashes in front of one person -->
    <circle cx="61" cy="44" r="5.5" />
    <path d="M 51.5 38.5 L 47.6 36.2 M 55.5 34.5 L 53.2 30.6 M 61 33 V 28.5 M 66.5 34.5 L 68.8 30.6 M 70.5 38.5 L 74.4 36.2" />
    <ArtKitHeadTop :x="61" :y="104" :r="23" />
    <!-- the other person's EEG -->
    <rect x="151" y="30" width="56" height="27" rx="3.5" />
    <path d="M 156 45.5 q 1.5 -3 3 0 t 3 0 t 3 0 t 3 0 M 188 45.5 q 1.5 3 3 0 t 3 0 t 3 0 t 3 0 t 2 0" />
    <ArtKitHeadTop :x="179" :y="104" :r="23" />
    <g class="art-a">
      <path class="art-dots art-march" style="--art-t: 0.9s" d="M 86 104 H 154" />
      <path class="art-dash art-breathe" style="--art-lo: 0.06; --art-t: 4.5s" d="M 168 45.5 L 172 45.5 L 176 34.5 L 181 51.5 L 184.5 45.5 L 188 45.5" />
    </g>
  </g>
</template>
