// Two small directives for the public pages.
//   v-spotlight  a soft light on the element that follows the pointer (.spot in main.css)
//   v-reveal     the element (or its [data-reveal-item] children, one after the
//                other) appears once when it scrolls into view
// Both do nothing on the server, and v-reveal leaves alone what is already on
// screen when the page loads, so nothing flashes.
import type { Directive } from 'vue'

export default defineNuxtPlugin((nuxtApp) => {
  const spotlight: Directive<HTMLElement> = {
    mounted(el) {
      el.classList.add('spot')
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      }, { passive: true })
    },
    getSSRProps: () => ({}),
  }

  let io: IntersectionObserver | null = null
  const reveal: Directive<HTMLElement> = {
    mounted(el) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      if (el.getBoundingClientRect().top < innerHeight * 0.92) return
      el.querySelectorAll<HTMLElement>('[data-reveal-item]').forEach((c, i) => c.style.setProperty('--reveal-i', String(i)))
      el.classList.add('reveal-ready')
      io ??= new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('reveal-in')
          io!.unobserve(e.target)
        }
      }, { rootMargin: '0px 0px -12% 0px' })
      io.observe(el)
    },
    unmounted: (el) => io?.unobserve(el),
    getSSRProps: () => ({}),
  }

  nuxtApp.vueApp.directive('spotlight', spotlight)
  nuxtApp.vueApp.directive('reveal', reveal)
})
