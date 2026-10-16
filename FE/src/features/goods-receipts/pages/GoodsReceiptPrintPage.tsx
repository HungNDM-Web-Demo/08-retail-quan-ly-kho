'use client'

import { NumCell, PrintTable } from '@/features/inventory/components/print/PrintTable'
import { PrintHeader, vnLongDate } from '@/features/inventory/components/print/PrintHeader'
import { PrintPage } from '@/features/inventory/components/print/PrintPage'
import { PrintSignatures } from '@/features/inventory/components/print/PrintSignatures'
import { useStoreProfile } from '@/features/inventory/hooks/use-inventory'
import { amountInWords } from '@/features/inventory/lib/amount-in-words'
import { vnDdMmYyyy, vnHhmmDate } from '@/features/inventory/lib/vn-time'
import { useWarehouses } from '@/features/warehouses/hooks/use-warehouses'
import { formatNumber } from '@/lib/format'
import { useGoodsReceipt } from '../hooks/use-goods-receipts'

const money = (v?: number) => (v == null ? '' : formatNumber(v, 0))

/** Bản in phiếu nhập kho theo bố cục 01-VT (07 §2.11) */
export function GoodsReceiptPrintPage({ id }: { id: string }) {
  const q = useGoodsReceipt(id)
  const store = useStoreProfile()
  const warehouses = useWarehouses()
  const doc = q.data
  const wh = warehouses.data?.find((w) => w.id === doc?.warehouseId)
  const see = !!doc?.canViewValues
  return (
    <PrintPage
      title={`Phiếu nhập kho ${doc?.code ?? ''}`}
      ready={!!doc && !!store.data}
      error={q.error ?? store.error}
      draft={!!doc && doc.status !== 'DaDuyet'}
    >
      {doc && (
        <>
          <PrintHeader
            store={store.data}
            formCode="Mẫu số 01 - VT"
            title="Phiếu nhập kho"
            date={doc.approvedAt ?? doc.createdAt}
            code={doc.code ?? null}
            extra={<p>Nợ: ……………… Có: ………………</p>}
          />
          <div className="mb-3 space-y-0.5">
            <p>- Họ và tên người giao: {doc.delivererName ?? '……………………………………'}</p>
            <p>
              - Theo {doc.sourceDocNo ? `số ${doc.sourceDocNo}` : '……………'}{' '}
              {doc.sourceDocDate ? `ngày ${vnDdMmYyyy(`${doc.sourceDocDate}T05:00:00Z`)}` : ''} của {doc.supplierName ?? '……………………'}
            </p>
            <p>
              - Nhập tại kho: {doc.warehouseName} – Địa điểm: {wh?.address ?? '……………………'}
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
                <th>Theo chứng từ</th>
                <th>Thực nhập</th>
              </tr>
              <tr className="text-[9pt]">
                {['A', 'B', 'C', 'D', '1', '2', '3', '4'].map((c) => (
                  <th key={c}>{c}</th>
                ))}
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
                  <NumCell>{see ? money(l.landedUnitPrice) : ''}</NumCell>
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
          {see && (doc.freightCost ?? 0) > 0 && (
            <p className="mt-1 text-[10pt] italic">Đã gồm chi phí mua hàng {money(doc.freightCost)} ₫ phân bổ theo giá trị.</p>
          )}
          <div className="mt-3 space-y-0.5">
            {see && (
              <p>
                - Tổng số tiền (viết bằng chữ): <span className="font-semibold italic">{amountInWords(doc.totalValue ?? 0)}</span>
              </p>
            )}
            <p>- Số chứng từ gốc kèm theo: {doc.sourceDocNo ? '01' : '……'}</p>
          </div>
          <PrintSignatures
            date={vnLongDate(doc.approvedAt ?? doc.createdAt)}
            slots={[
              { title: 'Người lập phiếu', name: doc.createdByName },
              { title: 'Người giao hàng', name: doc.delivererName },
              { title: 'Thủ kho' },
              { title: 'Kế toán trưởng', note: '(Hoặc bộ phận có nhu cầu nhập)', name: store.data?.chiefAccountantName },
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
