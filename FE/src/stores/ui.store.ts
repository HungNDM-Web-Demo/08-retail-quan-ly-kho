import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storageKey } from '@/lib/storage'

/** Trạng thái giao diện lưu theo trình duyệt (không phải dữ liệu nghiệp vụ). */
type UiState = {
  /** Sidebar desktop đang mở rộng hay thu gọn còn icon */
  sidebarOpen: boolean
  /** Màu thử nhanh từ thanh công cụ demo; null là dùng màu đã lưu trong cài đặt */
  brandPreviewColor: string | null
  setSidebarOpen: (open: boolean) => void
  setBrandPreviewColor: (color: string | null) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      brandPreviewColor: null,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setBrandPreviewColor: (brandPreviewColor) => set({ brandPreviewColor }),
    }),
    {
      name: storageKey('ui'),
      storage: createJSONStorage(() => localStorage),
    }
  )
)
