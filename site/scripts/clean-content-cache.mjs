// The parsed documents are cached by their text. What modules/repo-docs.ts
// does to them after parsing is not part of that key, so a change there would
// not show until the cache is gone. A build starts without it.
import { rmSync } from 'node:fs'

for (const dir of ['.data/content', 'node_modules/.cache/content']) rmSync(new URL(`../${dir}`, import.meta.url), { recursive: true, force: true })
