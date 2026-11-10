<template>
  <g>
    <path d="M 44 140 H 204" />
    <ArtKitChair :x="150.5" :y="107.45" :s="1.55" />
    <ArtKitPerson :x="150" :y="107.45" :s="1.55" helmet />
    <!-- the field at the right temple -->
    <g class="art-a">
      <path class="art-dots art-march" d="M 168.2 38.8 A 21 21 0 0 1 168.2 59.8" />
      <path class="art-dots art-march" d="M 174.25 35.3 A 28 28 0 0 1 174.25 63.3" />
    </g>
    <!-- the presence: beside and a little behind, there and not there -->
    <g class="art-drift" style="--art-dx: -3px; --art-dy: 0px; --art-t: 14s">
      <g class="art-breathe" style="--art-lo: 0.08">
        <ArtKitPerson :x="86" :y="140" :s="1.55" pose="stand" ghost eyes="none" />
      </g>
    </g>
  </g>
</template>
