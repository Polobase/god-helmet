export default defineAppConfig({
  ui: {
    colors: {
      primary: 'patina',
      neutral: 'soot',
      success: 'green',
      info: 'sky',
      warning: 'amber',
      error: 'rose',
    },
    button: {
      // The one main action on a screen: lit, with the field's glow (main.css).
      compoundVariants: [{ color: 'primary', variant: 'solid', class: 'btn-live' }],
      defaultVariants: { color: 'neutral', variant: 'outline' },
    },
    badge: {
      defaultVariants: { color: 'neutral', variant: 'subtle' },
    },
  },
})
