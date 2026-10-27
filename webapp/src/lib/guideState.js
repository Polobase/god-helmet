// Whether a guide is running, for the tab bar (GuidesView itself loads on demand).
import { reactive } from 'vue'

export const guideState = reactive({ phase: 'idle', paused: false })
