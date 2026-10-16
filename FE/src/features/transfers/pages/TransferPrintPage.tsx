'use client'

import { NumCell, PrintTable } from '@/features/inventory/components/print/PrintTable'
import { PrintHeader } from '@/features/inventory/components/print/PrintHeader'
import { PrintPage } from '@/features/inventory/components/print/PrintPage'
import { PrintSignatures } from '@/features/inventory/components/print/PrintSignatures'
import { useStoreProfile } from '@/features/inventory/hooks/use-inventory'
import { vnHhmmDate } from '@/features/inventory/lib/vn-time'
import { formatNumber } from '@/lib/format'
import { useTransfer } from '../hooks/use-transfers'

const money = (v?: number | null) => (v == null ? '' : formatNumber(v, 0))

/** Bản in phiếu chuyển kho nội bộ (07 §2.11) */
export function TransferPrintPage({ id }: { id: string }) {
  const q = useTransfer(id)
  const store = useStoreProfile()
  const doc = q.data
  const see = !!doc?.canViewValues && !!doc?.approvedAt
  const received = doc?.status === 'DaNhan'
  return (
    <PrintPage
      title={`Phiếu chuyển kho ${doc?.code ?? ''}`}
      ready={!!doc && !!store.data}
      error={q.error ?? store.error}
      draft={!!doc && doc.status !== 'DangChuyen' && doc.status !== 'DaNhan'}
    >
      {doc && (
        <>
          <PrintHeader store={store.data} title="Phiếu chuyển kho nội bộ" date={doc.approvedAt ?? doc.createdAt} code={doc.code ?? null} />
          <div className="mb-3 space-y-0.5">
            <p>
              - Từ kho: {doc.fromWarehouseCode} – {doc.fromWarehouseName}
            </p>
            <p>
              - Tới kho: {doc.toWarehouseCode} – {doc.toWarehouseName}
            </p>
            <p>
              - Ngày duyệt: {doc.approvedAt ? vnHhmmDate(doc.approvedAt) : '……'} · Ngày nhận: {doc.receivedAt ? vnHhmmDate(doc.receivedAt) : '……'}
            </p>
            {doc.note && <p>- Ghi chú: {doc.note}</p>}
          </div>
          <PrintTable>
            <thead>
              <tr>
                <th>STT</th>
                <th>Tên hàng hóa</th>
                <th>Mã số</th>
                <th>ĐVT</th>
                <th>Số lượng chuyển</th>
                <th>Thực nhận</th>
                <th>Thiếu</th>
                <th>Giá vốn chuyển</th>
                <th>Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="text-center">{i + 1}</td>
                  <td>{l.productName}</td>
                  <td>{l.productCode}</td>
                  <td>{l.baseUnit}</td>
                  <NumCell>{formatNumber(l.baseQuantity, 0)}</NumCell>
                  <NumCell>{received ? formatNumber(l.receivedBaseQuantity, 0) : ''}</NumCell>
                  <NumCell>{received && (l.shortageQuantity ?? 0) > 0 ? formatNumber(l.shortageQuantity, 0) : ''}</NumCell>
                  <NumCell>{see ? money(l.unitCost) : ''}</NumCell>
                  <NumCell>{see ? money(l.value) : ''}</NumCell>
                </tr>
              ))}
              <tr className="font-semibold">
                <td />
                <td>Cộng</td>
                <td colSpan={6} />
                <NumCell>{see ? money(doc.totalValue) : ''}</NumCell>
              </tr>
            </tbody>
          </PrintTable>
          {received && see && <p className="mt-2">- Hao hụt vận chuyển: {money(doc.shortageValue ?? 0)} ₫</p>}
          <PrintSignatures
            slots={[
              { title: 'Người lập phiếu', name: doc.createdByName },
              { title: 'Thủ kho xuất' },
              { title: 'Người vận chuyển' },
              { title: 'Thủ kho nhập', name: doc.receivedByName },
            ]}
          />
        </>
      )}
    </PrintPage>
  )
}
