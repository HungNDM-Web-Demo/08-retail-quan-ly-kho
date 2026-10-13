import { create } from 'zustand'
import { routePath } from '@/config/route-path'
import { readJson, removeKey, storageKey, writeJson } from '@/lib/storage'
import type { AuthResponse, CurrentUser } from '@/features/auth/types/auth.types'

/**
 * Phiên đăng nhập (KIEN-TRUC-HE-THONG §6.2 quy tắc 6, §7.1).
 * - Đăng nhập thường: lưu localStorage, mở tab mới vẫn đăng nhập sẵn.
 * - Đổi vai trò nhanh (thanh công cụ demo): chỉ ghi sessionStorage của tab đó
 *   và được ưu tiên đọc trước, nhờ vậy hai tab demo được hai vai trò song song.
 */

export type SessionKind = 'local' | 'session'

const SESSION_KEY = storageKey('session')

type AuthState = {
  /** Đã đọc phiên từ bộ nhớ trình duyệt (luôn false khi render phía máy chủ) */
  hydrated: boolean
  session: AuthResponse | null
  /** Phiên đang nằm ở localStorage hay sessionStorage của tab */
  kind: SessionKind | null
  /**
   * Vừa đổi vai trò nhanh: nếu trang đang xem không còn quyền thì về trang chủ thay vì /forbidden
   * (UC-SYS-09 bước 2). AuthGuard tự xóa cờ khi trang hiện tại hợp lệ.
   */
  roleSwitched: boolean

  hydrate: () => void
  /** Lưu phiên mới. kind mặc định: 'local' (đăng nhập thường) */
  setSession: (session: AuthResponse, kind?: SessionKind) => void
  /** Đổi vai trò nhanh: phiên chỉ ghi vào sessionStorage của tab này */
  switchSession: (session: AuthResponse) => void
  clearRoleSwitched: () => void
  /** Cập nhật token sau khi gia hạn, giữ nguyên nơi lưu */
  updateTokens: (session: AuthResponse) => void
  /** Cập nhật thông tin người dùng (sau GET /api/auth/me) */
  setUser: (user: CurrentUser) => void
  /** Xóa phiên ở cả hai nơi lưu */
  clear: () => void
}

function readSession(): { session: AuthResponse | null; kind: SessionKind | null } {
  const tabSession = readJson<AuthResponse>('session', SESSION_KEY)
  if (tabSession?.accessToken) return { session: tabSession, kind: 'session' }
  const localSession = readJson<AuthResponse>('local', SESSION_KEY)
  if (localSession?.accessToken) return { session: localSession, kind: 'local' }
  return { session: null, kind: null }
}

function persist(session: AuthResponse, kind: SessionKind) {
  writeJson(kind, SESSION_KEY, session)
}

let listening = false

export const useAuthStore = create<AuthState>()((set, get) => ({
  hydrated: false,
  session: null,
  kind: null,
  roleSwitched: false,

  hydrate: () => {
    if (typeof window === 'undefined') return
    set({ ...readSession(), hydrated: true })

    if (!listening) {
      listening = true
      // Tab khác đăng nhập/đăng xuất/gia hạn token: đồng bộ nếu tab này dùng phiên chung
      window.addEventListener('storage', (event) => {
        if (event.key !== SESSION_KEY && event.key !== null) return
        if (get().kind === 'session') return
        set(readSession())
      })
    }
  },

  setSession: (session, kind = 'local') => {
    if (kind === 'local') removeKey('session', SESSION_KEY)
    persist(session, kind)
    set({ session, kind, hydrated: true, roleSwitched: false })
  },

  switchSession: (session) => {
    persist(session, 'session')
    set({ session, kind: 'session', hydrated: true, roleSwitched: true })
  },

  clearRoleSwitched: () => {
    if (get().roleSwitched) set({ roleSwitched: false })
  },

  updateTokens: (session) => {
    const kind = get().kind ?? 'local'
    persist(session, kind)
    set({ session, kind })
  },

  setUser: (user) => {
    const { session, kind } = get()
    if (!session || !kind) return
    const next = { ...session, user }
    persist(next, kind)
    set({ session: next })
  },

  clear: () => {
    removeKey('session', SESSION_KEY)
    removeKey('local', SESSION_KEY)
    set({ session: null, kind: null, hydrated: true })
  },
}))

/** Đọc token mới nhất (dùng ngoài React: axios, mock). */
export const getSession = (): AuthResponse | null => {
  const state = useAuthStore.getState()
  if (!state.hydrated) state.hydrate()
  return useAuthStore.getState().session
}

export const getAccessToken = () => getSession()?.accessToken ?? null
export const getRefreshToken = () => getSession()?.refreshToken ?? null

/**
 * Hết phiên (refresh token hết hạn, bị thu hồi, tài khoản bị khóa):
 * xóa phiên rồi về trang đăng nhập, nhớ trang đang xem để quay lại.
 */
export function expireSession() {
  useAuthStore.getState().clear()
  if (typeof window === 'undefined') return
  const { pathname, search } = window.location
  if (pathname.startsWith(routePath.login)) return
  const redirect = encodeURIComponent(`${pathname}${search}`)
  window.location.replace(`${routePath.login}?redirect=${redirect}&expired=1`)
}
