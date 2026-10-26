// Minimal promise wrapper around IndexedDB (no dependency).
const DB_NAME = 'god-helmet'
const DB_VERSION = 1
let dbPromise = null

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('sets')) db.createObjectStore('sets', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('responses')) db.createObjectStore('responses', { keyPath: 'trialId' })
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
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
