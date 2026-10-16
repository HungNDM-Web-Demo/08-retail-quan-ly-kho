'use client'

import { issueTypeLabels } from '@/config/inventory-labels'
import { NumCell, PrintTable } from '@/features/inventory/components/print/PrintTable'
import { PrintHeader, vnLongDate } from '@/features/inventory/components/print/PrintHeader'
import { PrintPage } from '@/features/inventory/components/print/PrintPage'
import { PrintSignatures } from '@/features/inventory/components/print/PrintSignatures'
import { useStoreProfile } from '@/features/inventory/hooks/use-inventory'
import { amountInWords } from '@/features/inventory/lib/amount-in-words'
import { vnHhmmDate } from '@/features/inventory/lib/vn-time'
import { useWarehouses } from '@/features/warehouses/hooks/use-warehouses'
import { formatNumber } from '@/lib/format'
import { useGoodsIssue } from '../hooks/use-goods-issues'

const money = (v?: number | null) => (v == null ? '' : formatNumber(v, 0))

/** Bản in phiếu xuất kho theo bố cục 02-VT (07 §2.11, TC-20) */
export function GoodsIssuePrintPage({ id }: { id: string }) {
  const q = useGoodsIssue(id)
  const store = useStoreProfile()
  const warehouses = useWarehouses()
  const doc = q.data
  const wh = warehouses.data?.find((w) => w.id === doc?.warehouseId)
  const see = !!doc?.canViewValues && doc?.status === 'DaDuyet'
  const reason = doc ? [issueTypeLabels[doc.type], doc.reason, doc.orderRef && `Đơn hàng ${doc.orderRef}`].filter(Boolean).join(' – ') : ''
  return (
    <PrintPage
      title={`Phiếu xuất kho ${doc?.code ?? ''}`}
      ready={!!doc && !!store.data}
      error={q.error ?? store.error}
      draft={!!doc && doc.status !== 'DaDuyet'}
    >
      {doc && (
        <>
          <PrintHeader
            store={store.data}
            formCode="Mẫu số 02 - VT"
            title="Phiếu xuất kho"
            date={doc.approvedAt ?? doc.createdAt}
            code={doc.code ?? null}
            extra={<p>Nợ: ……………… Có: ………………</p>}
          />
          <div className="mb-3 space-y-0.5">
            <p>- Họ và tên người nhận hàng: {doc.recipientName ?? doc.supplierName ?? '……………………………………'}</p>
            <p>- Lý do xuất kho: {reason}</p>
            <p>
              - Xuất tại kho: {doc.warehouseName} – Địa điểm: {wh?.address ?? '……………………'}
            </p>
          </div>
          <PrintTable>
            <thead>
              <tr>
                <th rowSpan={2}>STT</th>
                <th rowSpan={2}>Tên, nhãn hiệu, quy cách hàng hóa</th>
                <th rowSpan={2}>Mã số</th>
                <th rowSpan={2}>Đơn vị tính</th>
                <th colSpan={2}>Số lượng</th>
                <th rowSpan={2}>Đơn giá</th>
                <th rowSpan={2}>Thành tiền</th>
              </tr>
              <tr>
                <th>Yêu cầu</th>
                <th>Thực xuất</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="text-center">{i + 1}</td>
                  <td>{l.productName}</td>
                  <td>{l.productCode}</td>
                  <td>{l.unitName}</td>
                  <NumCell>{formatNumber(l.quantity, 0)}</NumCell>
                  <NumCell>{formatNumber(l.quantity, 0)}</NumCell>
                  <NumCell>{see && l.unitCost != null ? money(l.unitCost * l.factor) : ''}</NumCell>
                  <NumCell>{see ? money(l.value) : ''}</NumCell>
                </tr>
              ))}
              <tr className="font-semibold">
                <td />
                <td>Cộng</td>
                <td colSpan={5} />
                <NumCell>{see ? money(doc.totalValue) : ''}</NumCell>
              </tr>
            </tbody>
          </PrintTable>
          <div className="mt-3 space-y-0.5">
            {see && (
              <p>
                - Tổng số tiền (viết bằng chữ): <span className="font-semibold italic">{amountInWords(doc.totalValue ?? 0)}</span>
              </p>
            )}
            <p>- Số chứng từ gốc kèm theo: ……</p>
          </div>
          <PrintSignatures
            date={vnLongDate(doc.approvedAt ?? doc.createdAt)}
            slots={[
              { title: 'Người lập phiếu', name: doc.createdByName },
              { title: 'Người nhận hàng', name: doc.recipientName },
              { title: 'Thủ kho' },
              { title: 'Kế toán trưởng', name: store.data?.chiefAccountantName },
              { title: 'Giám đốc', note: '(Ký, họ tên, đóng dấu)', name: store.data?.directorName },
            ]}
          />
          {doc.approvedAt && (
            <p className="mt-4 text-[10pt]">
              Duyệt bởi {doc.approvedByName} lúc {vnHhmmDate(doc.approvedAt)}
            </p>
          )}
        </>
      )}
    </PrintPage>
  )
}
