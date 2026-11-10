<template>
  <g>
    <!-- a head and its EEG -->
    <ArtKitHeadTop :x="24" :y="16" :r="10" :coils="false" />
    <rect x="5" y="31" width="38" height="13" rx="3" />
    <path d="M 9 38 q 1.5 -3 3 0 t 3 0 t 3 0 M 30 38 q 1.5 3 3 0 t 3 0 t 3 0" />
    <path class="art-a art-dash" d="M 19 38 L 21.5 33.5 L 25 41.5 L 27.5 38 L 30 38" />
  </g>
</template>
