import type { Ref } from 'vue'

/**
 * Calls `frame(t, dt)` on every animation frame while `el` is on screen.
 * Never runs for people who asked for less motion: `still()` is called once
 * instead, to draw a resting picture.
 */
export function useFrameLoop(el: Ref<HTMLElement | undefined | null>, frame: (tMs: number, dtMs: number) => void, still?: () => void) {
  let raf = 0
  let last = 0
  let visible = false
  const tick = (t: number) => {
    raf = 0
    if (!visible) return
    frame(t, last ? Math.min(100, t - last) : 16)
    last = t
    raf = requestAnimationFrame(tick)
  }
  onMounted(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // No animation: one resting picture, drawn again when the size changes.
      still?.()
      const ro = new ResizeObserver(() => still?.())
      if (el.value) ro.observe(el.value)
      onBeforeUnmount(() => ro.disconnect())
      return
    }
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting
      last = 0
      if (visible && !raf) raf = requestAnimationFrame(tick)
    })
    if (el.value) io.observe(el.value)
    onBeforeUnmount(() => {
      io.disconnect()
      cancelAnimationFrame(raf)
    })
  })
}

/** The accent colour as the canvas should use it, kept up to date with the theme. */
export function useCanvasTheme(el: Ref<HTMLElement | undefined | null>) {
  const theme = reactive({ accent: '#58d1bd', line: '#333', muted: '#888', text: '#fff', light: false })
  const read = () => {
    if (!el.value) return
    const css = getComputedStyle(el.value)
    theme.accent = css.getPropertyValue('--ui-primary').trim() || theme.accent
    theme.line = css.getPropertyValue('--ui-border').trim() || theme.line
    theme.muted = css.getPropertyValue('--ui-text-muted').trim() || theme.muted
    theme.text = css.getPropertyValue('--ui-text-highlighted').trim() || theme.text
    const cls = document.documentElement.classList
    theme.light = !cls.contains('dark') && !cls.contains('night')
  }
  onMounted(() => {
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    onBeforeUnmount(() => mo.disconnect())
  })
  return theme
}
