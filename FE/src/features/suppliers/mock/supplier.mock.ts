import { permissions } from '@/config/permissions'
import { liveSuppliers, suppliersDb } from '@/features/inventory/mock/catalog.store'
import { allReceipts } from '@/features/inventory/mock/documents.store'
import type { SupplierRecord } from '@/features/inventory/mock/records'
import { catalogUsage, conflictError, domainError } from '@/features/stock/mock/inventory-queries'
import { mockDelay } from '@/lib/data-source'
import { cleanPhone, isValidPhone, PHONE_MESSAGE } from '@/lib/validators'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { notFound, validation } from '@/mock/mock-errors'
import { emptyToNull, listQuery, newId } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type { SaveSupplierRequest, SetActiveRequest, SupplierDto, SupplierOption, SupplierQuery } from '@/types/inventory'
import {
  SUPPLIER_CODE_MESSAGE,
  SUPPLIER_CODE_PATTERN,
  SUPPLIER_NAME_MESSAGE,
  TAX_CODE_MESSAGE,
  TAX_CODE_PATTERN,
} from '../schemas/supplier.schema'

/** Handler mock nhà cung cấp (07 §2.2), đọc ghi collection `suppliers` của lõi. */

type ReceiptStat = { count: number; last?: string }

function receiptStats(): Map<string, ReceiptStat> {
  const map = new Map<string, ReceiptStat>()
  for (const r of allReceipts()) {
    if (r.status !== 'DaDuyet' || !r.supplierId || !r.approvedAt) continue
    const s = map.get(r.supplierId) ?? { count: 0 }
    s.count += 1
    if (!s.last || r.approvedAt > s.last) s.last = r.approvedAt
    map.set(r.supplierId, s)
  }
  return map
}

function toDto(s: SupplierRecord, stats: Map<string, ReceiptStat>, used: Set<string>): SupplierDto {
  const st = stats.get(s.id)
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    taxCode: s.taxCode,
    phone: s.phone,
    address: s.address,
    contactName: s.contactName,
    isActive: s.isActive,
    receiptCount: st?.count ?? 0,
    lastReceiptAt: st?.last,
    hasDocuments: used.has(s.id),
  }
}

const oneDto = (s: SupplierRecord) => toDto(s, receiptStats(), catalogUsage().supplierIds)

function findOr404(id: string): SupplierRecord {
  const s = suppliersDb.get(id)
  if (!s || s.isDeleted) throw notFound('Không tìm thấy nhà cung cấp.')
  return s
}

/** Kiểm định dạng → trùng mã (07 §2.2) */
function validate(input: SaveSupplierRequest, selfId?: string): SaveSupplierRequest {
  const code = input.code?.trim().toUpperCase() || undefined
  const errors: Record<string, string> = {}
  if (code && !SUPPLIER_CODE_PATTERN.test(code)) errors.code = SUPPLIER_CODE_MESSAGE
  if (!input.name?.trim()) errors.name = SUPPLIER_NAME_MESSAGE
  if (input.taxCode?.trim() && !TAX_CODE_PATTERN.test(input.taxCode.trim())) errors.taxCode = TAX_CODE_MESSAGE
  if (input.phone?.trim() && !isValidPhone(input.phone)) errors.phone = PHONE_MESSAGE
  if (Object.keys(errors).length) throw validation(errors)
  if (code && liveSuppliers().some((s) => s.code === code && s.id !== selfId)) {
    throw conflictError('Mã nhà cung cấp đã tồn tại', { code: 'Mã nhà cung cấp đã tồn tại' })
  }
  return {
    code,
    name: input.name.trim(),
    taxCode: emptyToNull(input.taxCode) ?? undefined,
    phone: cleanPhone(emptyToNull(input.phone)) ?? undefined,
    address: emptyToNull(input.address) ?? undefined,
    contactName: emptyToNull(input.contactName) ?? undefined,
  }
}

/** NCC + số lớn nhất + 1 (SRS §5.3) */
function nextSupplierCode(): string {
  const max = suppliersDb.all().reduce((m, s) => {
    const n = SUPPLIER_CODE_PATTERN.test(s.code) ? Number(s.code.slice(3)) : 0
    return n > m ? n : m
  }, 0)
  return `NCC${String(max + 1).padStart(3, '0')}`
}

export const supplierMock = {
  async getList(query: SupplierQuery): Promise<PaginatedResult<SupplierDto>> {
    await mockDelay()
    requirePermission(permissions.suppliers.view)
    const stats = receiptStats()
    const used = catalogUsage().supplierIds
    const rows = liveSuppliers()
      .filter((s) => query.isActive === undefined || String(s.isActive) === String(query.isActive))
      .map((s) => toDto(s, stats, used))
    return listQuery(rows, query, {
      searchFields: ['code', 'name', 'taxCode', 'phone', 'contactName'],
      defaultSortBy: 'code',
      defaultSortDir: 'asc',
    })
  },

  async getOptions(): Promise<SupplierOption[]> {
    await mockDelay(80, 160)
    requirePermission(permissions.suppliers.view, permissions.goodsReceipts.create, permissions.goodsIssues.create)
    return liveSuppliers()
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((s) => ({ id: s.id, code: s.code, name: s.name, isActive: s.isActive }))
  },

  async getById(id: string): Promise<SupplierDto> {
    await mockDelay()
    requirePermission(permissions.suppliers.view)
    return oneDto(findOr404(id))
  },

  async create(input: SaveSupplierRequest): Promise<SupplierDto> {
    await mockDelay()
    requirePermission(permissions.suppliers.create)
    const v = validate(input)
    const record: SupplierRecord = {
      id: newId(),
      code: v.code ?? nextSupplierCode(),
      name: v.name,
      taxCode: v.taxCode,
      phone: v.phone,
      address: v.address,
      contactName: v.contactName,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
    suppliersDb.insert(record)
    auditCreate('Supplier', record)
    return oneDto(record)
  },

  async update(id: string, input: SaveSupplierRequest): Promise<SupplierDto> {
    await mockDelay()
    requirePermission(permissions.suppliers.update)
    const before = findOr404(id)
    const v = validate(input, id)
    const after = suppliersDb.update(id, {
      code: v.code ?? before.code,
      name: v.name,
      taxCode: v.taxCode,
      phone: v.phone,
      address: v.address,
      contactName: v.contactName,
    })!
    auditUpdate('Supplier', before, after)
    return oneDto(after)
  },

  async setStatus(id: string, input: SetActiveRequest): Promise<SupplierDto> {
    await mockDelay()
    requirePermission(permissions.suppliers.update)
    const before = findOr404(id)
    const after = suppliersDb.update(id, { isActive: !!input.isActive })!
    auditUpdate('Supplier', before, after)
    return oneDto(after)
  },

  async remove(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.suppliers.delete)
    const s = findOr404(id)
    if (catalogUsage().supplierIds.has(id)) {
      throw domainError('DaCoChungTu', 'Nhà cung cấp đã có chứng từ, không xóa được. Hãy dùng Ngừng')
    }
    suppliersDb.update(id, { isDeleted: true })
    auditDelete('Supplier', s)
  },
}
