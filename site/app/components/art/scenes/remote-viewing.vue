<template>
  <g>
    <!-- two rooms: ceiling, floor and the wall between them -->
    <path d="M 14 16 H 226 M 14 140 H 226 M 134 16 V 140" />
    <!-- the viewer, at a table with a sketch pad -->
    <ArtKitChair :x="40.5" :y="115.85" :s="1.15" />
    <ArtKitPerson :x="40" :y="115.85" :s="1.15" helmet :gaze="[1.4, 0]" />
    <ArtKitTable :x="92" :y="112" :w="48" />
    <ArtKitCard :x="91" :y="97.5" :w="26" :h="28" :turn="-4">
      <g class="art-a art-breathe" style="--art-lo: 0.1; --art-t: 9s">
        <ArtKitMotif :s="1.15" rough class="art-dash" />
      </g>
    </ArtKitCard>
    <path d="M 103.5 92 L 110 112" />
    <!-- behind the wall: the target picture, sealed in an envelope -->
    <ArtKitTable :x="184" :y="112" :w="52" />
    <ArtKitEnvelope :x="184" :y="97" :w="42" :h="30" :tip="-0.12">
      <ArtKitMotif :y="6.5" :s="1.05" class="art-faint" />
    </ArtKitEnvelope>
    <path class="art-a art-dots art-march" d="M 50 62 C 78 22 164 22 182 78" />
  </g>
</template>
