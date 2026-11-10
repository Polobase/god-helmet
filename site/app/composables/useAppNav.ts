// The app's tabs. A tab button brings you back to where you were in that tab;
// pressed while its tab is open, it goes to the tab's start.
export const APP_TABS = [
  { key: 'programs', label: 'Programs' },
  { key: 'guides', label: 'Guides' },
  { key: 'trials', label: 'Trials' },
  { key: 'log', label: 'Log' },
  { key: 'helmet', label: 'Helmet' },
] as const

export type AppTab = (typeof APP_TABS)[number]['key']

// Pages without a tab button of their own: the tab that lights up for them.
const HIDDEN: Record<string, AppTab> = { safety: 'helmet' }

/** Each tab's last route (filled by plugins/app-nav.client.ts). */
export const tabMemory: Partial<Record<AppTab, string>> = {}

export const appSegment = (path: string) => (path.startsWith('/app/') ? path.split('/')[2] ?? '' : '')
export const tabOfPath = (path: string) => {
  const seg = appSegment(path)
  return (HIDDEN[seg] ?? seg) as AppTab | ''
}

/** The last page of the app that was open in this visit, if any. */
export const lastAppPath = ref('')

export function rememberTab(fullPath: string) {
  if (fullPath.startsWith('/app/') && !fullPath.startsWith('/app/safety')) lastAppPath.value = fullPath
  const seg = appSegment(fullPath)
  if (APP_TABS.some((t) => t.key === seg)) tabMemory[seg as AppTab] = fullPath
}

export function useAppNav() {
  const route = useRoute()
  const tab = computed(() => tabOfPath(route.path))
  const tabTarget = (key: AppTab) => (key === tab.value || !tabMemory[key] ? `/app/${key}` : tabMemory[key]!)
  /** The safety page, with the way back to here. */
  const safetyPath = () => `/app/safety?back=${encodeURIComponent(route.fullPath)}`
  return { tab, tabTarget, safetyPath }
}

/** Where the safety page's Continue leads: only ever back into the app. */
export function safeBack(back: unknown): string {
  return typeof back === 'string' && /^\/app\/[a-z]/.test(back) && !back.startsWith('/app/safety') ? back : '/app/programs'
}
