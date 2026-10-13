import { toast } from 'sonner'
import { appConfig } from '@/config/app.config'
import { readJson, removeKey, storageKey, writeJson } from '@/lib/storage'
import { mockBlobs } from './mock-blobs'

/**
 * Kho dữ liệu mẫu trong trình duyệt (KIEN-TRUC-HE-THONG §6.2 quy tắc 4, 6, 7).
 *
 * - Toàn bộ dữ liệu nằm trong một khóa localStorage `retail-quan-ly-kho:db`, nên thao tác của
 *   người xem còn nguyên khi tải lại trang và mọi tab thấy cùng dữ liệu.
 * - Mỗi collection đăng ký kèm hàm seed; lần đầu truy cập (hoặc sau khi đặt lại) mới gọi seed,
 *   nên ngày tháng tương đối luôn tính theo hôm nay.
 * - `scope: 'business'` (mặc định) bị xóa khi "Đặt lại dữ liệu"; `scope: 'system'`
 *   (tài khoản, vai trò, cài đặt, nhật ký) được giữ nguyên theo BR-SYS-09.
 * - Thay đổi được phát qua BroadcastChannel để tab khác làm mới (mô phỏng realtime).
 *
 * Cách dùng: xem ZDOCS/04-QUY-CHUAN-CODE/FE-CAU-TRUC-THU-MUC.md §3.
 */

export type CollectionScope = 'business' | 'system'

export type Entity = { id: string }

type StoredCollection = { scope: CollectionScope; items: unknown[] }

type Snapshot = {
  version: number
  /** Dấu vân tay từng file seed lúc lưu (tên → hash); seed nào đổi thì bỏ dữ liệu cũ */
  seeds: Record<string, string>
  collections: Record<string, StoredCollection>
}

/** FNV-1a 32 bit, đủ để nhận ra seed đã đổi (không dùng cho bảo mật). */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export type ChangeEvent = {
  /** Tên các collection vừa đổi; rỗng khi đặt lại toàn bộ */
  collections: string[]
  /** true khi thay đổi đến từ tab khác */
  remote: boolean
  reset?: boolean
}

type ChannelMessage = { tabId: string; collections: string[]; reset?: boolean }

const DB_KEY = storageKey('db')
const CHANNEL_NAME = storageKey('db')
const TAB_ID = Math.random().toString(36).slice(2)

const clone = <T>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))

export interface Collection<T extends Entity> {
  readonly name: string
  readonly scope: CollectionScope
  /** Mọi bản ghi (bản sao, sửa trực tiếp không có tác dụng — dùng update) */
  all(): T[]
  get(id: string): T | undefined
  find(predicate: (item: T) => boolean): T | undefined
  filter(predicate: (item: T) => boolean): T[]
  some(predicate: (item: T) => boolean): boolean
  count(predicate?: (item: T) => boolean): number
  insert(item: T): T
  insertMany(items: T[]): T[]
  /** Sửa một phần hoặc truyền hàm nhận bản cũ trả bản mới. Không thấy id thì trả undefined */
  update(id: string, patch: Partial<T> | ((current: T) => T)): T | undefined
  remove(id: string): boolean
  removeWhere(predicate: (item: T) => boolean): number
  replaceAll(items: T[]): void
  /** Bỏ dữ liệu hiện tại, lần truy cập sau nạp lại seed */
  reseed(): void
}

type Registration = { seed: () => unknown[]; scope: CollectionScope }

class MockDb {
  private snapshot: Snapshot | null = null
  private registry = new Map<string, Registration>()
  private seeds = new Map<string, string>()
  private listeners = new Set<(event: ChangeEvent) => void>()
  private resetHandlers = new Set<() => void | Promise<void>>()
  private channel: BroadcastChannel | null = null
  private batchDepth = 0
  private pendingChanges = new Set<string>()
  private warnedQuota = false

  // ───────────────────────── Đăng ký collection ─────────────────────────

  /**
   * Khai báo một file seed (system.json + project.json, demo-data.json…). Phiên bản dữ liệu lưu trong
   * localStorage gồm dấu vân tay của mọi seed đã khai báo: sửa seed là trình duyệt tự nạp lại, không còn
   * giữ dữ liệu cũ (vd tên, số điện thoại đã đổi). Gọi ở cấp module, trước khi tạo collection.
   */
  registerSeed(name: string, seed: unknown): void {
    const hash = fingerprint(JSON.stringify(seed))
    if (this.seeds.get(name) === hash) return
    this.seeds.set(name, hash)
    if (!this.snapshot) return
    // Snapshot đã nạp trước khi seed này được khai báo (trang trước không dùng tới seed này):
    // chỉ so với bản đã lưu nếu có, chưa có thì ghi thêm chứ không coi là đổi
    const stored = this.snapshot.seeds[name]
    if (stored === undefined) {
      this.snapshot.seeds[name] = hash
      this.save()
    } else if (stored !== hash) {
      this.discard()
    }
  }

  /** Seed đổi: bỏ dữ liệu cũ và ảnh đã tải lên, lần truy cập sau nạp lại từ seed. */
  private discard() {
    this.snapshot = null
    removeKey('local', DB_KEY)
    void mockBlobs.clear([])
  }

  private seedsChanged(stored: Snapshot): boolean {
    return [...this.seeds].some(([name, hash]) => {
      const saved = stored.seeds?.[name]
      return saved !== undefined && saved !== hash
    })
  }

  /**
   * Đăng ký (hoặc lấy lại) một collection.
   * @param name  tên duy nhất, kebab-case, vd 'menu-items'. Nền dùng tiền tố 'system.'
   * @param seed  hàm trả dữ liệu gốc (gọi lười, mỗi lần nạp lại seed)
   */
  collection<T extends Entity>(
    name: string,
    seed: () => T[],
    options: { scope?: CollectionScope } = {}
  ): Collection<T> {
    const scope = options.scope ?? 'business'
    this.registry.set(name, { seed, scope })
    return this.createCollection<T>(name, scope)
  }

  /** Chạy nhiều thao tác ghi, chỉ lưu và phát sự kiện một lần ở cuối. */
  batch<R>(fn: () => R): R {
    this.batchDepth++
    try {
      return fn()
    } finally {
      this.batchDepth--
      if (this.batchDepth === 0 && this.pendingChanges.size > 0) {
        const names = [...this.pendingChanges]
        this.pendingChanges.clear()
        this.flush(names)
      }
    }
  }

  // ───────────────────────── Đặt lại dữ liệu ─────────────────────────

  /**
   * Đặt lại dữ liệu demo (UC-SYS-10, BR-SYS-09): xóa mọi collection nghiệp vụ và ảnh không còn
   * được dữ liệu hệ thống tham chiếu; giữ tài khoản, vai trò, cài đặt.
   * `includeSystem: true` xóa sạch cả dữ liệu hệ thống (chỉ dùng khi phát triển).
   */
  async reset(options: { includeSystem?: boolean } = {}): Promise<void> {
    const current = this.load()
    const kept: Record<string, StoredCollection> = {}
    if (!options.includeSystem) {
      for (const [name, stored] of Object.entries(current.collections)) {
        if (stored.scope === 'system') kept[name] = stored
      }
    }
    this.snapshot = {
      version: appConfig.mockDataVersion,
      seeds: Object.fromEntries(this.seeds),
      collections: kept,
    }
    this.save()

    await mockBlobs.clear(collectIdbIds(kept))
    for (const handler of this.resetHandlers) await handler()

    this.post({ tabId: TAB_ID, collections: [], reset: true })
    this.emit({ collections: [], remote: false, reset: true })
  }

  /** Việc cần làm thêm khi đặt lại (vd xóa bộ đếm riêng của dự án). */
  onReset(handler: () => void | Promise<void>): () => void {
    this.resetHandlers.add(handler)
    return () => this.resetHandlers.delete(handler)
  }

  // ───────────────────────── Theo dõi thay đổi ─────────────────────────

  /**
   * Nghe thay đổi dữ liệu (cả tab này và tab khác). Dùng để invalidateQueries,
   * mô phỏng realtime giữa hai tab (vd tab Phục vụ gọi món, tab Bếp nhận món).
   */
  subscribe(listener: (event: ChangeEvent) => void): () => void {
    this.connect()
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ───────────────────────── Nội bộ ─────────────────────────

  private createCollection<T extends Entity>(name: string, scope: CollectionScope): Collection<T> {
    const read = (): T[] => this.items<T>(name)
    const write = (items: T[]) => this.write(name, items)

    return {
      name,
      scope,
      all: () => clone(read()),
      get: (id) => {
        const found = read().find((x) => x.id === id)
        return found ? clone(found) : undefined
      },
      find: (predicate) => {
        const found = read().find(predicate)
        return found ? clone(found) : undefined
      },
      filter: (predicate) => clone(read().filter(predicate)),
      some: (predicate) => read().some(predicate),
      count: (predicate) => (predicate ? read().filter(predicate).length : read().length),
      insert: (item) => {
        write([...read(), clone(item)])
        return clone(item)
      },
      insertMany: (items) => {
        write([...read(), ...clone(items)])
        return clone(items)
      },
      update: (id, patch) => {
        const items = read()
        const index = items.findIndex((x) => x.id === id)
        if (index < 0) return undefined
        const current = items[index]
        const next =
          typeof patch === 'function' ? patch(clone(current)) : { ...current, ...patch, id }
        const copy = [...items]
        copy[index] = clone(next)
        write(copy)
        return clone(next)
      },
      remove: (id) => {
        const items = read()
        const next = items.filter((x) => x.id !== id)
        if (next.length === items.length) return false
        write(next)
        return true
      },
      removeWhere: (predicate) => {
        const items = read()
        const next = items.filter((x) => !predicate(x))
        const removed = items.length - next.length
        if (removed > 0) write(next)
        return removed
      },
      replaceAll: (items) => write(clone(items)),
      reseed: () => {
        const snapshot = this.load()
        delete snapshot.collections[name]
        this.changed(name)
      },
    }
  }

  /** Mảng gốc trong bộ nhớ (không sao chép) — chỉ dùng nội bộ. */
  private items<T>(name: string): T[] {
    const snapshot = this.load()
    let stored = snapshot.collections[name]
    if (!stored) {
      const registration = this.registry.get(name)
      if (!registration) {
        throw new Error(`[mock-db] Collection "${name}" chưa được đăng ký bằng mockDb.collection().`)
      }
      stored = { scope: registration.scope, items: clone(registration.seed()) }
      snapshot.collections[name] = stored
      this.changed(name, { silent: true })
    }
    return stored.items as T[]
  }

  private write(name: string, items: unknown[]) {
    const snapshot = this.load()
    const scope = this.registry.get(name)?.scope ?? snapshot.collections[name]?.scope ?? 'business'
    snapshot.collections[name] = { scope, items }
    this.changed(name)
  }

  private changed(name: string, options: { silent?: boolean } = {}) {
    if (this.batchDepth > 0) {
      this.pendingChanges.add(name)
      return
    }
    if (options.silent) {
      // Nạp seed lần đầu: chỉ lưu, không phát sự kiện (tránh vòng lặp làm mới)
      this.save()
      return
    }
    this.flush([name])
  }

  private flush(names: string[]) {
    this.save()
    this.post({ tabId: TAB_ID, collections: names })
    this.emit({ collections: names, remote: false })
  }

  private load(): Snapshot {
    if (this.snapshot) return this.snapshot
    const stored = readJson<Snapshot>('local', DB_KEY)
    if (
      stored &&
      stored.version === appConfig.mockDataVersion &&
      stored.collections &&
      !this.seedsChanged(stored)
    ) {
      // Seed khai báo thêm sau lần lưu trước thì ghi nhận dấu vân tay để lần sau so được
      stored.seeds = { ...Object.fromEntries(this.seeds), ...(stored.seeds ?? {}) }
      this.snapshot = stored
    } else {
      if (stored) {
        // Đổi phiên bản hoặc sửa seed: bỏ toàn bộ dữ liệu cũ và ảnh đã tải lên
        removeKey('local', DB_KEY)
        void mockBlobs.clear([])
      }
      this.snapshot = {
        version: appConfig.mockDataVersion,
        seeds: Object.fromEntries(this.seeds),
        collections: {},
      }
    }
    this.connect()
    return this.snapshot
  }

  private save() {
    if (!this.snapshot || typeof window === 'undefined') return
    const ok = writeJson('local', DB_KEY, this.snapshot)
    if (!ok && !this.warnedQuota) {
      this.warnedQuota = true
      toast.error('Bộ nhớ trình duyệt đã đầy, thay đổi mới có thể mất khi tải lại trang.', {
        description: 'Bấm "Đặt lại dữ liệu" trên thanh công cụ demo để giải phóng.',
      })
    }
  }

  private connect() {
    if (this.channel || typeof window === 'undefined') return
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME)
      this.channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
        if (event.data?.tabId === TAB_ID) return
        this.onRemote(event.data.collections, event.data.reset)
      }
    } else {
      // Trình duyệt cũ: dựa vào sự kiện storage
      window.addEventListener('storage', (event) => {
        if (event.key === DB_KEY) this.onRemote([], false)
      })
    }
  }

  private onRemote(collections: string[], reset?: boolean) {
    this.snapshot = null // đọc lại từ localStorage ở lần truy cập sau
    this.emit({ collections, remote: true, reset })
  }

  private post(message: ChannelMessage) {
    try {
      this.channel?.postMessage(message)
    } catch {
      // bỏ qua
    }
  }

  private emit(event: ChangeEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error('[mock-db] Lỗi trong listener:', error)
      }
    })
  }
}

/** Gom mọi id ảnh `idb://{id}` mà dữ liệu được giữ lại còn tham chiếu. */
function collectIdbIds(collections: Record<string, StoredCollection>): string[] {
  const text = JSON.stringify(collections)
  const ids = new Set<string>()
  for (const match of text.matchAll(/idb:\/\/([A-Za-z0-9_-]+)/g)) ids.add(match[1])
  return [...ids]
}

export const mockDb = new MockDb()
