import { storageKey } from '@/lib/storage'

/**
 * Kho ảnh tải lên ở chế độ mock (KIEN-TRUC-HE-THONG §6.2 quy tắc 7).
 * localStorage chỉ khoảng 5 MB nên ảnh lưu trong IndexedDB; dữ liệu JSON trỏ tới ảnh
 * bằng chuỗi `idb://{id}`. Hiển thị ảnh: `useAssetUrl(url)` trong lib/asset-url.ts.
 * Trình duyệt không có IndexedDB thì trả về data URL (đủ cho logo nhỏ).
 */

const DB_NAME = storageKey('blobs')
const STORE = 'blobs'
const PREFIX = 'idb://'

export type StoredBlob = {
  id: string
  blob: Blob
  name: string
  type: string
  size: number
  createdAt: string
}

export type PutResult = { id: string; url: string; size: number; type: string }

let dbPromise: Promise<IDBDatabase> | null = null
const objectUrls = new Map<string, string>()

const hasIndexedDb = () => typeof window !== 'undefined' && typeof indexedDB !== 'undefined'

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        dbPromise = null
        reject(request.error)
      }
    })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = action(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(request.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
  )
}

function newBlobId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export const mockBlobs = {
  isIdbUrl(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith(PREFIX)
  },

  toUrl(id: string) {
    return `${PREFIX}${id}`
  },

  idFromUrl(url: string) {
    return url.startsWith(PREFIX) ? url.slice(PREFIX.length) : url
  },

  /** Lưu ảnh, trả về `idb://{id}` để ghi vào dữ liệu JSON. */
  async put(blob: Blob, name = 'file'): Promise<PutResult> {
    if (!hasIndexedDb()) {
      return { id: '', url: await blobToDataUrl(blob), size: blob.size, type: blob.type }
    }
    const record: StoredBlob = {
      id: newBlobId(),
      blob,
      name,
      type: blob.type,
      size: blob.size,
      createdAt: new Date().toISOString(),
    }
    await run('readwrite', (store) => store.put(record))
    return { id: record.id, url: this.toUrl(record.id), size: record.size, type: record.type }
  },

  async get(urlOrId: string): Promise<StoredBlob | undefined> {
    if (!hasIndexedDb()) return undefined
    return run<StoredBlob | undefined>('readonly', (store) => store.get(this.idFromUrl(urlOrId)))
  },

  /** Object URL để gán vào <img src>. Lưu đệm theo id, không cần tự thu hồi. */
  async getObjectUrl(urlOrId: string): Promise<string | null> {
    const id = this.idFromUrl(urlOrId)
    const cached = objectUrls.get(id)
    if (cached) return cached
    const record = await this.get(id).catch(() => undefined)
    if (!record) return null
    const url = URL.createObjectURL(record.blob)
    objectUrls.set(id, url)
    return url
  },

  async remove(urlOrId: string): Promise<void> {
    if (!hasIndexedDb()) return
    const id = this.idFromUrl(urlOrId)
    await run('readwrite', (store) => store.delete(id))
    const cached = objectUrls.get(id)
    if (cached) URL.revokeObjectURL(cached)
    objectUrls.delete(id)
  },

  /** Xóa mọi ảnh, trừ các id trong keepIds (ảnh dữ liệu hệ thống còn dùng, vd logo). */
  async clear(keepIds: string[] = []): Promise<void> {
    if (!hasIndexedDb()) return
    const keep = new Set(keepIds)
    try {
      const keys = await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
      for (const key of keys) {
        if (!keep.has(String(key))) await this.remove(String(key))
      }
    } catch (error) {
      console.error('[mock-blobs] Không xóa được kho ảnh:', error)
    }
  },
}

/** Đọc kích thước ảnh (SVG không đọc được thì trả 0). */
export async function readImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof window === 'undefined') return { width: 0, height: 0 }
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({ width: 0, height: 0 })
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
