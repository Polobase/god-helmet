<template>
  <g>
    <ArtKitPerson :x="10.5" :y="45" :s="0.7" pose="bust" eyes="none" />
    <ArtKitPerson :x="37.5" :y="45" :s="0.7" pose="bust" helmet :coils="3" eyes="none" />
    <path d="M 24 12 V 45" />
    <path class="art-a art-dots art-march" d="M 12 17 Q 24 2 36 17" />
  </g>
</template>
