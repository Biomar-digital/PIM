// Minimal IndexedDB key/value wrapper. Two stores: 'kv' (JSON state) and 'blobs' (uploaded files).
const DB_NAME = 'biomar-pim'
const STORES = ['kv', 'blobs'] as const
type StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => STORES.forEach((s) => req.result.objectStoreNames.contains(s) || req.result.createObjectStore(s))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store))
        req.onsuccess = () => resolve(req.result as T)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const idb = {
  get: <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key)),
  set: (store: StoreName, key: string, value: unknown) => run<void>(store, 'readwrite', (s) => s.put(value, key)),
  del: (store: StoreName, key: string) => run<void>(store, 'readwrite', (s) => s.delete(key)),
  clear: (store: StoreName) => run<void>(store, 'readwrite', (s) => s.clear()),
  async entries<T>(store: StoreName): Promise<[string, T][]> {
    const keys = await run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys())
    const vals = await run<T[]>(store, 'readonly', (s) => s.getAll())
    return keys.map((k, i) => [String(k), vals[i]])
  },
}
