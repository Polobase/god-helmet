// Theme: auto (follows the system), dark, light, and night (red on black, to
// keep your eyes dark-adapted during a session).
export const THEMES = [
  { value: 'system', label: 'Auto', icon: 'i-lucide-sun-moon', hint: 'Follows your device' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon', hint: '' },
  { value: 'light', label: 'Light', icon: 'i-lucide-sun', hint: '' },
  { value: 'night', label: 'Night', icon: 'i-lucide-circle-dot', hint: 'Red on black, for a dark room' },
] as const

export type ThemeValue = (typeof THEMES)[number]['value']

export function useTheme() {
  const colorMode = useColorMode()
  const theme = computed<ThemeValue>({
    get: () => (THEMES.some((t) => t.value === colorMode.preference) ? (colorMode.preference as ThemeValue) : 'system'),
    set: (v) => (colorMode.preference = v),
  })
  const current = computed(() => THEMES.find((t) => t.value === theme.value)!)
  const next = () => (theme.value = THEMES[(THEMES.findIndex((t) => t.value === theme.value) + 1) % THEMES.length]!.value)
  return { theme, current, next, THEMES }
}
