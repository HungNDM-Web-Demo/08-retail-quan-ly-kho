'use client'

import { Suspense, useState } from 'react'
import { ChartColumn } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { WarehouseSelect } from '@/features/inventory/components/WarehouseSelect'
import { useMyWarehouses } from '@/features/inventory/hooks/use-inventory'
import { useUrlParams } from '@/features/stock/hooks/use-url-params'
import {
  IssueTypesTab,
  SlowMovingTab,
  StocktakeVariancesTab,
  SupplierReceiptsTab,
  TransferLossesTab,
} from '../components/AnalysisTabs'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { MovementTab } from '../components/MovementTab'
import { DEFAULT_PRESET, presetRange, type DateRange, type RangePreset } from '../lib/date-range'

const TABS = [
  { value: 'movement', label: 'Xuất nhập tồn' },
  { value: 'slow-moving', label: 'Chậm luân chuyển' },
  { value: 'suppliers', label: 'Nhập theo nhà cung cấp' },
  { value: 'issue-types', label: 'Xuất theo loại' },
  { value: 'stocktakes', label: 'Chênh lệch kiểm kê' },
  { value: 'transfer-losses', label: 'Hao hụt vận chuyển' },
] as const
type TabValue = (typeof TABS)[number]['value']
const isTab = (v: string | undefined): v is TabValue => TABS.some((t) => t.value === v)

/**
 * SCR-16 Báo cáo (UC-13, UC-14; FR-32…FR-36): mặc định Xuất nhập tồn, Tháng này, Tất cả kho; chặn khoảng > 366 ngày
 * trước khi gọi API; mỗi tab xuất Excel đúng bảng đang xem.
 */
export function ReportsPage() {
  return (
    <PermissionGuard permission={permissions.reports.view} redirect>
      <Suspense>
        <ReportsView />
      </Suspense>
    </PermissionGuard>
  )
}

function ReportsView() {
  const url = useUrlParams()
  const tabParam = url.get('tab')
  const tab: TabValue = isTab(tabParam) ? tabParam : 'movement'
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET)
  const [range, setRange] = useState<DateRange>(() => presetRange(DEFAULT_PRESET))
  const [warehouseId, setWarehouseId] = useState('')
  const my = useMyWarehouses()
  const w = my.data?.find((x) => x.id === warehouseId)
  const scopeText = w ? `Kho ${w.code} – ${w.name}` : 'Tất cả kho'
  const common = { range, warehouseId: warehouseId || undefined, scopeText }
  const periodless = tab === 'slow-moving'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Báo cáo"
        icon={ChartColumn}
        description="Số liệu theo thời điểm ghi sổ (lúc duyệt, lúc nhận hàng chuyển). Giá trị theo giá vốn bình quân từng kho."
      />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        {tab !== 'transfer-losses' && (
          <WarehouseSelect value={warehouseId} onChange={setWarehouseId} allLabel="Tất cả kho" className="h-11 xl:w-72" />
        )}
        {!periodless && (
          <div className="min-w-0 flex-1">
            <DateRangeFilter
              preset={preset}
              value={range}
              onChange={(p, r) => {
                setPreset(p)
                setRange(r)
              }}
            />
          </div>
        )}
      </div>
      <Tabs value={tab} onValueChange={(v) => url.set({ tab: v === 'movement' ? undefined : v })} className="gap-4">
        <div className="overflow-x-auto overflow-y-hidden">
          <TabsList className="w-max group-data-horizontal/tabs:h-11">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="min-h-9 px-4">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="movement">
          <MovementTab {...common} enabled={tab === 'movement'} />
        </TabsContent>
        <TabsContent value="slow-moving">
          <SlowMovingTab warehouseId={common.warehouseId} scopeText={scopeText} enabled={tab === 'slow-moving'} />
        </TabsContent>
        <TabsContent value="suppliers">
          <SupplierReceiptsTab {...common} enabled={tab === 'suppliers'} />
        </TabsContent>
        <TabsContent value="issue-types">
          <IssueTypesTab {...common} enabled={tab === 'issue-types'} />
        </TabsContent>
        <TabsContent value="stocktakes">
          <StocktakeVariancesTab {...common} enabled={tab === 'stocktakes'} />
        </TabsContent>
        <TabsContent value="transfer-losses">
          <TransferLossesTab range={range} scopeText="Mọi tuyến kho" enabled={tab === 'transfer-losses'} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
