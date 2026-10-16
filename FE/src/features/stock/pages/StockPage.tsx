'use client'

import { Suspense, useEffect } from 'react'
import { Boxes } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { WarehouseSelect } from '@/features/inventory/components/WarehouseSelect'
import { useMyWarehouses, useProductGroups } from '@/features/inventory/hooks/use-inventory'
import { canSeeAllWarehouses } from '@/features/inventory/lib/scope'
import { usePermissions } from '@/hooks/use-permissions'
import type { StockStatus } from '@/types/inventory'
import { StockAlertsTab } from '../components/StockAlertsTab'
import { StockLevelsTab } from '../components/StockLevelsTab'
import { useUrlParams } from '../hooks/use-url-params'

const STATUSES: StockStatus[] = ['BinhThuong', 'HetHang', 'DuoiToiThieu', 'VuotToiDa']
const asStatus = (v?: string) => (STATUSES.includes(v as StockStatus) ? (v as StockStatus) : undefined)

/**
 * SCR-12 Tồn kho: tab Tồn kho (UC-08) và Cảnh báo (UC-10). Bộ lọc lưu trên URL (`?warehouseId&groupId&status&tab`).
 * Mặc định Tất cả kho với người thấy mọi kho, kho đầu tiên với thủ kho; `warehouseId` ngoài phạm vi bị xóa khỏi URL
 * (UC-08 E1, TC-06).
 */
export function StockPage() {
  return (
    <PermissionGuard permission={permissions.stockLevels.view} redirect>
      <Suspense>
        <StockView />
      </Suspense>
    </PermissionGuard>
  )
}

function StockView() {
  const { can } = usePermissions()
  const url = useUrlParams()
  const my = useMyWarehouses()
  const groups = useProductGroups()
  const canAll = canSeeAllWarehouses(can)
  const warehouses = my.data ?? []

  const tab = url.get('tab') === 'alerts' ? 'alerts' : 'stock'
  const param = url.get('warehouseId')
  const valid = !!param && warehouses.some((w) => w.id === param)
  const warehouseId = valid ? param : canAll ? undefined : warehouses[0]?.id
  const groupId = url.get('groupId')
  const status = asStatus(url.get('status'))
  const inStockOnly = url.get('inStockOnly') === '1'

  // Kho ngoài phạm vi trên URL: bỏ bộ lọc (UC-08 E1)
  const { set } = url
  useEffect(() => {
    if (my.data && param && !valid) set({ warehouseId: undefined })
  }, [my.data, param, valid, set])

  const warehouseSelect = (
    <WarehouseSelect
      value={warehouseId ?? ''}
      onChange={(id) => url.set({ warehouseId: id || undefined })}
      allLabel={canAll ? 'Tất cả kho' : undefined}
      className="lg:w-64"
    />
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tồn kho"
        icon={Boxes}
        description="Tồn thực, số đang chờ xuất, tồn khả dụng theo kho; bấm một mặt hàng để xem thẻ kho."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => url.set({ tab: v === 'alerts' ? 'alerts' : undefined, status: undefined })}
        className="gap-4"
      >
        <TabsList className="group-data-horizontal/tabs:h-11">
          <TabsTrigger value="stock" className="min-h-9 px-4">
            Tồn kho
          </TabsTrigger>
          <TabsTrigger value="alerts" className="min-h-9 px-4">
            Cảnh báo
          </TabsTrigger>
        </TabsList>
        {!my.data ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <>
            <TabsContent value="stock">
              {tab === 'stock' && (
                <StockLevelsTab
                  filters={{ warehouseId, groupId, status, inStockOnly }}
                  onFiltersChange={(patch) =>
                    url.set({
                      ...('groupId' in patch ? { groupId: patch.groupId } : {}),
                      ...('status' in patch ? { status: patch.status } : {}),
                      ...('inStockOnly' in patch ? { inStockOnly: patch.inStockOnly ? 1 : undefined } : {}),
                    })
                  }
                  warehouses={warehouses}
                  groups={groups.data}
                  warehouseSelect={warehouseSelect}
                />
              )}
            </TabsContent>
            <TabsContent value="alerts">
              {tab === 'alerts' && (
                <StockAlertsTab
                  warehouseId={warehouseId}
                  status={status === 'BinhThuong' ? undefined : status}
                  groupId={groupId}
                  onFiltersChange={(patch) =>
                    url.set({
                      ...('status' in patch ? { status: patch.status } : {}),
                      ...('groupId' in patch ? { groupId: patch.groupId } : {}),
                    })
                  }
                  groups={groups.data}
                  warehouseSelect={warehouseSelect}
                />
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
