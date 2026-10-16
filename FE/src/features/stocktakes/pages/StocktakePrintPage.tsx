'use client'

import { varianceReasonLabels } from '@/config/inventory-labels'
import { NumCell, PrintTable } from '@/features/inventory/components/print/PrintTable'
import { PrintHeader } from '@/features/inventory/components/print/PrintHeader'
import { PrintPage } from '@/features/inventory/components/print/PrintPage'
import { PrintSignatures } from '@/features/inventory/components/print/PrintSignatures'
import { useStoreProfile } from '@/features/inventory/hooks/use-inventory'
import { vnParts } from '@/features/inventory/lib/vn-time'
import { formatNumber } from '@/lib/format'
import { useStocktake } from '../hooks/use-stocktakes'

const n = (v?: number | null) => (v == null ? '' : formatNumber(v, 0))

/**
 * Biên bản kiểm kê theo bố cục 05-VT khi Chờ duyệt / Đã cân bằng; phiếu Đang kiểm in "Danh sách đếm" không có cột
 * sổ sách (07 §2.11, FR-31).
 */
export function StocktakePrintPage({ id }: { id: string }) {
  const q = useStocktake(id)
  const store = useStoreProfile()
  const doc = q.data
  const countSheet = doc?.status === 'DangKiem' || doc?.status === 'DaHuy'
  const see = !!doc?.canViewValues
  const p = doc ? vnParts(doc.snapshotAt) : null
  const lines = doc ? [...doc.lines] : []
  const sum = (f: (l: (typeof lines)[number]) => number) => lines.reduce((s, l) => s + f(l), 0)
  return (
    <PrintPage
      title={`${countSheet ? 'Danh sách đếm' : 'Biên bản kiểm kê'} ${doc?.code ?? ''}`}
      ready={!!doc && !!store.data}
      error={q.error ?? store.error}
      draft={!!doc && doc.status !== 'DaCanBang'}
    >
      {doc && p && (
        <>
          <PrintHeader
            store={store.data}
            formCode={countSheet ? undefined : 'Mẫu số 05 - VT'}
            title={countSheet ? 'Danh sách đếm kiểm kê' : 'Biên bản kiểm kê vật tư, công cụ, sản phẩm, hàng hóa'}
            hideDate
            code={doc.code}
          />
          <div className="mb-3 space-y-0.5">
            <p>
              - Thời điểm kiểm kê: {String(p.hour).padStart(2, '0')} giờ {String(p.minute).padStart(2, '0')} ngày{' '}
              {String(p.day).padStart(2, '0')} tháng {String(p.month).padStart(2, '0')} năm {p.year}
            </p>
            <p>- Ban kiểm kê gồm:</p>
            <p className="pl-6">Ông/Bà: {doc.createdByName} – Trưởng ban</p>
            <p className="pl-6">Ông/Bà: {doc.counterName} – Ủy viên</p>
            <p>- Đã kiểm kê kho {doc.warehouseName} có những mặt hàng dưới đây:</p>
          </div>
          {countSheet ? (
            <PrintTable>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Tên hàng hóa</th>
                  <th>Mã số</th>
                  <th>ĐVT</th>
                  <th>Số đếm</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id}>
                    <td className="text-center">{i + 1}</td>
                    <td>{l.productName}</td>
                    <td>{l.productCode}</td>
                    <td>{l.baseUnit}</td>
                    <NumCell>{n(l.countedQuantity)}</NumCell>
                    <td className="w-40" />
                  </tr>
                ))}
              </tbody>
            </PrintTable>
          ) : (
            <PrintTable className="text-[9pt]">
              <thead>
                <tr>
                  <th rowSpan={2}>STT</th>
                  <th rowSpan={2}>Tên hàng hóa</th>
                  <th rowSpan={2}>Mã số</th>
                  <th rowSpan={2}>ĐVT</th>
                  <th rowSpan={2}>Đơn giá</th>
                  <th colSpan={2}>Theo sổ sách</th>
                  <th colSpan={2}>Theo kiểm kê</th>
                  <th colSpan={2}>Thừa</th>
                  <th colSpan={2}>Thiếu</th>
                  <th rowSpan={2}>Nguyên nhân</th>
                </tr>
                <tr>
                  {['SL', 'Thành tiền', 'SL', 'Thành tiền', 'SL', 'Thành tiền', 'SL', 'Thành tiền'].map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const d = l.difference ?? 0
                  const cost = l.bookCost
                  return (
                    <tr key={l.id}>
                      <td className="text-center">{i + 1}</td>
                      <td>{l.productName}</td>
                      <td>{l.productCode}</td>
                      <td>{l.baseUnit}</td>
                      <NumCell>{see ? n(cost) : ''}</NumCell>
                      <NumCell>{n(l.bookQuantity)}</NumCell>
                      <NumCell>{see && cost != null ? n((l.bookQuantity ?? 0) * cost) : ''}</NumCell>
                      <NumCell>{n(l.countedQuantity)}</NumCell>
                      <NumCell>{see && cost != null ? n((l.bookQuantity ?? 0) * cost + (l.differenceValue ?? 0)) : ''}</NumCell>
                      <NumCell>{d > 0 ? n(d) : ''}</NumCell>
                      <NumCell>{see && d > 0 ? n(l.differenceValue) : ''}</NumCell>
                      <NumCell>{d < 0 ? n(-d) : ''}</NumCell>
                      <NumCell>{see && d < 0 ? n(-(l.differenceValue ?? 0)) : ''}</NumCell>
                      <td>{l.reason ? varianceReasonLabels[l.reason] : ''}</td>
                    </tr>
                  )
                })}
                <tr className="font-semibold">
                  <td />
                  <td>Cộng</td>
                  <td colSpan={8} />
                  <NumCell>{see ? n(sum((l) => Math.max(l.differenceValue ?? 0, 0))) : ''}</NumCell>
                  <td />
                  <NumCell>{see ? n(sum((l) => Math.max(-(l.differenceValue ?? 0), 0))) : ''}</NumCell>
                  <td />
                </tr>
              </tbody>
            </PrintTable>
          )}
          <PrintSignatures
            slots={[
              { title: 'Giám đốc', note: '(Ý kiến giải quyết số chênh lệch)', name: store.data?.directorName },
              { title: 'Kế toán trưởng', name: store.data?.chiefAccountantName },
              { title: 'Thủ kho', name: doc.counterName },
              { title: 'Trưởng ban kiểm kê', name: doc.createdByName },
            ]}
          />
        </>
      )}
    </PrintPage>
  )
}
