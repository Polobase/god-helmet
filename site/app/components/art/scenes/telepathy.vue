<template>
  <g>
    <!-- two rooms: ceiling, floor and the wall between them -->
    <path d="M 14 16 H 226 M 14 140 H 226 M 122 16 V 140" />
    <!-- the sender looks at a picture card, with the light on -->
    <path d="M 62 16 V 28 M 52 37 Q 52 28 62 28 Q 72 28 72 37 Z M 55 42 L 52.5 47 M 62 43 V 49 M 69 42 L 71.5 47" />
    <ArtKitChair :x="36.5" :y="115.85" :s="1.15" />
    <ArtKitPerson :x="36" :y="115.85" :s="1.15" eyes="open" :gaze="[1.8, 0.4]" />
    <ArtKitTable :x="88" :y="112" :w="40" />
    <ArtKitCard :x="88" :y="97.5" :w="23" :h="29">
      <ArtKitMotif kind="star" :s="1.15" />
    </ArtKitCard>
    <!-- the receiver wears the band, in the dark -->
    <path d="M 204 16 V 28 M 194 37 Q 194 28 204 28 Q 214 28 214 37 Z" />
    <ArtKitChair :x="186.5" :y="115.85" :s="1.15" flip />
    <ArtKitPerson :x="187" :y="115.85" :s="1.15" helmet />
    <g class="art-a">
      <path class="art-dots art-march" d="M 92 80 C 100 44 128 40 144 54" />
      <g class="art-breathe" style="--art-lo: 0.1; --art-t: 8s">
        <ArtKitMotif kind="star" :x="154" :y="62" :s="1.5" rough class="art-dash" />
      </g>
    </g>
  </g>
</template>
