// The text of every article and doc, by section, for the site search.
// Prerendered to a static file and fetched when the search is first opened,
// so pages don't ship a database to the browser.
import { queryCollectionSearchSections } from '@nuxt/content/server'

export default defineEventHandler((event) => queryCollectionSearchSections(event, 'pages'))
