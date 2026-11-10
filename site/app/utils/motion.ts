/** 'smooth' for scrolling done by script, unless the person asked for less motion. */
export const smooth = (): ScrollBehavior =>
  import.meta.client && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
