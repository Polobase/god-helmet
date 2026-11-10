<template>
  <g>
    <!-- one card is shown, the next is to be guessed -->
    <ArtKitCard :x="15" :y="25" :w="16" :h="23" :turn="-8">
      <ArtKitMotif kind="circle" :s="0.72" />
    </ArtKitCard>
    <ArtKitCard :x="33" :y="24" :w="16" :h="23" :turn="7" class="art-a art-dash" />
  </g>
</template>
