// Minimal promise wrapper around IndexedDB (no dependency).
const DB_NAME = 'god-helmet'
const DB_VERSION = 2
let dbPromise = null

function open() {
  if (!dbPromise) {
    let settled = false
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      const fail = (err) => {
        settled = true
        dbPromise = null // the next call tries again
        reject(err)
      }
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('sets')) db.createObjectStore('sets', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('responses')) db.createObjectStore('responses', { keyPath: 'trialId' })
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
        if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' }) // v2: guide runs
      }
      // An older version of the app in another tab holds the database open.
      req.onblocked = () => fail(new Error('The app is open in another tab with an older version. Close the other tabs and try again.'))
      req.onsuccess = () => {
        const db = req.result
        if (settled) return db.close() // opened after it was reported blocked; the next call reopens
        // Let a newer version in another tab upgrade; the next call reopens.
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        settled = true
        resolve(db)
      }
      req.onerror = () => fail(req.error)
    })
  }
  return dbPromise
}

async function run(store, mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const result = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(result?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const idb = {
  get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
  getAll: (store) => run(store, 'readonly', (s) => s.getAll()),
  put: (store, value, key) => run(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
  delete: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
}
