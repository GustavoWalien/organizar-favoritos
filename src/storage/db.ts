import { openDB, type IDBPDatabase } from 'idb'

export const DB_NAME = 'organizar-favoritos'

export function openDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const snapshots = db.createObjectStore('snapshots', { keyPath: 'id' })
        snapshots.createIndex('createdAt', 'createdAt')
        db.createObjectStore('journal', { keyPath: 'planId' })
      }
      if (oldVersion < 2) {
        db.createObjectStore('flags', { keyPath: 'id' })
      }
    },
  })
}

/** Abre o banco, roda `fn` e fecha a conexão. */
export async function withDb<T>(fn: (db: IDBPDatabase) => Promise<T>): Promise<T> {
  const db = await openDb()
  try {
    return await fn(db)
  } finally {
    db.close()
  }
}
