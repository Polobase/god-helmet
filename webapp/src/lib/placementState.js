// Placement-tab state that should outlive a detour to another tab (the view
// remounts on every tab change): coil ticks per placement and the map view.
import { reactive } from 'vue'

export const placementState = reactive({ placed: {}, view: null })
