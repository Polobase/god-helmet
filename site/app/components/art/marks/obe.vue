<template>
  <g>
    <path d="M 2 41 H 46" />
    <ArtKitPerson :x="18.6" :y="41" :s="0.58" pose="lie" flip eyes="none" />
    <g class="art-a">
      <path class="art-dots" d="M 18.6 30 V 20" />
      <ArtKitPerson :x="18.6" :y="19" :s="0.58" pose="lie" flip ghost eyes="none" />
    </g>
  </g>
</template>
