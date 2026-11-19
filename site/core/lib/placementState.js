// Placement state that should outlive a detour to another tab (views remount
// on every tab change): coil ticks per placement, the map view, and whether
// the coil list shows its details.
import { reactive } from 'vue'

export const placementState = reactive({ placed: {}, view: null, details: false })
