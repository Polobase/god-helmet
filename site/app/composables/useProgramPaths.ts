/** A program's page; `sub` is one of '', 'placement', 'brain', 'sources'. */
export const programPath = (id: string, sub = '') => `/app/programs/${encodeURIComponent(id)}${sub ? `/${sub}` : ''}`

export const PROGRAM_SUBS = ['placement', 'brain', 'sources'] as const

/** The sub-page a program route shows ('' = Overview). */
export const programSub = (path: string) => {
  const sub = path.split('/')[4] ?? ''
  return (PROGRAM_SUBS as readonly string[]).includes(sub) ? sub : ''
}
