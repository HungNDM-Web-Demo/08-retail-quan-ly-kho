'use client'

import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Package } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { ProductGroupsTab } from '../components/ProductGroupsTab'
import { ProductsTab } from '../components/ProductsTab'
import { useProductGroupList } from '../hooks/use-products'

/** SCR-02 Hàng hóa: tab Mặt hàng, Nhóm hàng (UC-01). Thủ kho chỉ xem. */
export function ProductsPage() {
  return (
    <PermissionGuard permission={permissions.products.view} redirect>
      <Suspense>
        <ProductsView />
      </Suspense>
    </PermissionGuard>
  )
}

function ProductsView() {
  const { can } = usePermissions()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tab = params.get('tab') === 'groups' ? 'groups' : 'items'
  const groups = useProductGroupList()
  const readOnly = !can(permissions.products.create) && !can(permissions.products.update)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hàng hóa"
        icon={Package}
        description={
          readOnly
            ? 'Danh mục mặt hàng, đơn vị quy đổi và tồn từng kho bạn phụ trách. Bấm một dòng để xem chi tiết.'
            : 'Mặt hàng, đơn vị quy đổi, mã vạch, ngưỡng tồn tối thiểu và tối đa theo kho.'
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(v === 'groups' ? `${pathname}?tab=groups` : pathname, { scroll: false })}
        className="gap-4"
      >
        <TabsList className="group-data-horizontal/tabs:h-11">
          <TabsTrigger value="items" className="min-h-9 px-4">
            Mặt hàng
          </TabsTrigger>
          <TabsTrigger value="groups" className="min-h-9 px-4">
            Nhóm hàng
            {groups.data && <span className="text-muted-foreground ml-1 tabular-nums">({groups.data.length})</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          <ProductsTab groups={groups.data} />
        </TabsContent>
        <TabsContent value="groups">
          <ProductGroupsTab
            groups={groups.data}
            isLoading={groups.isLoading}
            error={groups.error}
            onRetry={() => void groups.refetch()}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
