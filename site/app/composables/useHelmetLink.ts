// The link to the helmet for the views: whether it is up, the line about it,
// and the status to show. While the status is not live (the link is down, or
// the helmet has gone quiet) it moves on by the clock, once a second.
import { device, linkLost, linkNote, estimateStatus } from '~/lib/device'

const clock = ref(Date.now())
let ticking = false

export function useHelmetLink() {
  if (import.meta.client && !ticking) {
    ticking = true
    setInterval(() => (clock.value = Date.now()), 1000)
  }
  /** The link is up. */
  const online = computed(() => device.link === 'connected')
  /** The link dropped; the helmet and its session stay on screen. */
  const lost = computed(() => linkLost())
  /** The status to show: live, or estimated from the last one known. */
  const st = computed(() => (device.stale && device.status ? estimateStatus(device.status, clock.value - device.statusAt) : device.status))
  const note = computed(() => (lost.value ? linkNote(clock.value) : linkNote()))
  return { online, lost, st, note }
}
