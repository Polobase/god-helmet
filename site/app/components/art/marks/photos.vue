<template>
  <g>
    <!-- more to add, behind the first -->
    <g class="art-a">
      <path class="art-dash" d="M 11 14 V 12.4 a 2.4 2.4 0 0 1 2.4 -2.4 H 37.6 a 2.4 2.4 0 0 1 2.4 2.4 V 31.6 a 2.4 2.4 0 0 1 -2.4 2.4 H 36" />
      <path class="art-dash" d="M 16 10 V 7.4 a 2.4 2.4 0 0 1 2.4 -2.4 H 42.6 a 2.4 2.4 0 0 1 2.4 2.4 V 26.6 a 2.4 2.4 0 0 1 -2.4 2.4 H 40" />
    </g>
    <ArtKitCard :x="20" :y="27" :w="30" :h="24">
      <ArtKitMotif :y="1" :s="1.2" />
    </ArtKitCard>
  </g>
</template>
