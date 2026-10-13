'use client'

import { useCallback, useMemo, useState } from 'react'
import type { PaginationQuery, SortDir } from '@/types/api'

export type TableQuery<TFilters extends object> = Required<Pick<PaginationQuery, 'page' | 'pageSize'>> &
  Pick<PaginationQuery, 'search' | 'sortBy' | 'sortDir'> &
  Partial<TFilters>

/**
 * Quản lý trạng thái bảng danh sách: trang, số dòng, tìm kiếm, sắp xếp, bộ lọc.
 * Đổi tìm kiếm hoặc bộ lọc thì tự về trang 1.
 *
 *   const table = useTableQuery<{ isActive: boolean }>({ pageSize: 10 })
 *   const { data } = useUsers(table.query)
 */
export function useTableQuery<TFilters extends object = Record<string, never>>(
  initial: Partial<TableQuery<TFilters>> = {}
) {
  const [state, setState] = useState<TableQuery<TFilters>>({
    page: 1,
    pageSize: 10,
    ...initial,
  } as TableQuery<TFilters>)

  const setPage = useCallback((page: number) => setState((s) => ({ ...s, page })), [])
  const setPageSize = useCallback(
    (pageSize: number) => setState((s) => ({ ...s, pageSize, page: 1 })),
    []
  )
  const setSearch = useCallback(
    (search: string) => setState((s) => ({ ...s, search: search || undefined, page: 1 })),
    []
  )
  const setSort = useCallback(
    (sortBy?: string, sortDir?: SortDir) => setState((s) => ({ ...s, sortBy, sortDir, page: 1 })),
    []
  )
  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K] | undefined) =>
      setState((s) => ({ ...s, [key]: value, page: 1 })),
    []
  )
  const resetFilters = useCallback(
    () =>
      setState((s) => ({ page: 1, pageSize: s.pageSize, sortBy: s.sortBy, sortDir: s.sortDir }) as TableQuery<TFilters>),
    []
  )

  /** Query đã bỏ các trường rỗng, dùng làm queryKey và tham số API */
  const query = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(state).filter(([, v]) => v !== undefined && v !== '' && v !== null)
      ) as TableQuery<TFilters>,
    [state]
  )

  return { state, query, setPage, setPageSize, setSearch, setSort, setFilter, resetFilters }
}
