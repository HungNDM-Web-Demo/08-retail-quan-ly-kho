import { issueTypeLabels, receiptTypeLabels } from '@/config/inventory-labels'
import { approvalPermissions, permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import type { ApprovalItem, ApprovalQuery } from '@/types/inventory'
import { groupById, warehouseById } from '@/features/inventory/mock/catalog.store'
import { inventoryContext } from '@/features/inventory/mock/context'
import { estimatedValue } from '@/features/inventory/mock/doc-mappers'
import { issuesDb, receiptsDb, stocktakesDb, transfersDb } from '@/features/inventory/mock/documents.store'

/**
 * GET /api/approvals (07 §2.7, UC-05 bước 1): mọi phiếu Chờ duyệt thuộc loại người gọi duyệt được, gửi trước lên
 * trước; `canApprove` khóa sẵn nút khi người gọi là người lập/người đếm (BR-06). Phiếu Chờ duyệt luôn ở mock-db.
 */
export const approvalMock = {
  async getList(query: ApprovalQuery = {}): Promise<ApprovalItem[]> {
    const ctx = inventoryContext(...approvalPermissions)
    await mockDelay()
    const items: ApprovalItem[] = []
    const code = (id: string) => warehouseById(id)?.code ?? ''
    const blocked = (by: string): Pick<ApprovalItem, 'canApprove' | 'blockedReason'> =>
      by === ctx.userId ? { canApprove: false, blockedReason: 'Người duyệt phải khác người lập' } : { canApprove: true }

    if (ctx.can(permissions.goodsReceipts.approve)) {
      for (const r of receiptsDb.filter((x) => x.status === 'ChoDuyet' && ctx.inScope(x.warehouseId))) {
        items.push({
          kind: 'GoodsReceipt',
          id: r.id,
          code: r.code,
          typeText: `Phiếu nhập · ${receiptTypeLabels[r.type]}`,
          warehouseCode: code(r.warehouseId),
          createdById: r.createdById,
          createdByName: r.createdByName,
          submittedAt: r.submittedAt ?? r.createdAt,
          lineCount: r.lines.length,
          totalValue: ctx.canViewValues ? r.totalValue : undefined,
          version: r.version,
          ...blocked(r.createdById),
        })
      }
    }
    if (ctx.can(permissions.goodsIssues.approve)) {
      for (const x of issuesDb.filter((d) => d.status === 'ChoDuyet' && ctx.inScope(d.warehouseId))) {
        items.push({
          kind: 'GoodsIssue',
          id: x.id,
          code: x.code,
          typeText: `Phiếu xuất · ${issueTypeLabels[x.type]}`,
          warehouseCode: code(x.warehouseId),
          createdById: x.createdById,
          createdByName: x.createdByName,
          submittedAt: x.submittedAt ?? x.createdAt,
          lineCount: x.lines.length,
          totalValue: ctx.canViewValues ? estimatedValue(x.warehouseId, x.lines) : undefined,
          version: x.version,
          ...blocked(x.createdById),
        })
      }
    }
    if (ctx.can(permissions.transfers.approve)) {
      for (const t of transfersDb.filter((d) => d.status === 'ChoDuyet' && ctx.inScope(d.fromWarehouseId))) {
        items.push({
          kind: 'Transfer',
          id: t.id,
          code: t.code,
          typeText: `Chuyển kho ${code(t.fromWarehouseId)} → ${code(t.toWarehouseId)}`,
          warehouseCode: code(t.fromWarehouseId),
          toWarehouseCode: code(t.toWarehouseId),
          createdById: t.createdById,
          createdByName: t.createdByName,
          submittedAt: t.submittedAt ?? t.createdAt,
          lineCount: t.lines.length,
          totalValue: ctx.canViewValues ? estimatedValue(t.fromWarehouseId, t.lines) : undefined,
          version: t.version,
          ...blocked(t.createdById),
        })
      }
    }
    if (ctx.can(permissions.stocktakes.approve)) {
      for (const s of stocktakesDb.filter((d) => d.status === 'ChoDuyet' && ctx.inScope(d.warehouseId))) {
        const isCounter = s.counterId === ctx.userId || s.counterIds.includes(ctx.userId)
        items.push({
          kind: 'Stocktake',
          id: s.id,
          code: s.code,
          typeText: s.scopeAll
            ? 'Kiểm kê · Toàn kho'
            : `Kiểm kê · ${s.groupIds.map((g) => groupById(g)?.name ?? '').join(', ')}`,
          warehouseCode: code(s.warehouseId),
          createdById: s.counterId,
          createdByName: s.counterName,
          submittedAt: s.submittedAt ?? s.createdAt,
          lineCount: s.lines.length,
          // Chênh lệch thuần (thừa − thiếu), 07 §5
          totalValue: ctx.canViewValues ? s.lines.reduce((sum, l) => sum + (l.differenceValue ?? 0), 0) : undefined,
          version: s.version,
          canApprove: !isCounter,
          blockedReason: isCounter ? 'Người duyệt phải khác người đếm' : undefined,
        })
      }
    }
    const filterWh = query.warehouseId ? warehouseById(query.warehouseId)?.code : undefined
    return items
      .filter(
        (i) =>
          (!query.kind || i.kind === query.kind) &&
          (!filterWh || i.warehouseCode === filterWh || i.toWarehouseCode === filterWh) &&
          (!query.createdById || i.createdById === query.createdById)
      )
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  },
}
