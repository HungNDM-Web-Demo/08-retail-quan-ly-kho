'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PrintHeader, vnLongDate } from '@/features/inventory/components/print/PrintHeader'
import { PrintPage } from '@/features/inventory/components/print/PrintPage'
import { PrintSignatures } from '@/features/inventory/components/print/PrintSignatures'
import { NumCell, PrintTable } from '@/features/inventory/components/print/PrintTable'
import { useMyWarehouses, useStoreProfile } from '@/features/inventory/hooks/use-inventory'
import { vnDdMmYyyy } from '@/features/inventory/lib/vn-time'
import { displayDateKey, presetRange, rangeFromParams } from '@/features/reports/lib/date-range'
import { formatNumber } from '@/lib/format'
import { useStockCard } from '../hooks/use-stock'

/**
 * Bản in thẻ kho `/print/stock-card/[productId]?warehouseId&from&to` (07 §2.11, UC-09 4a): tên mặt hàng, mã, ĐVT,
 * kho (hoặc "Mọi kho"), kỳ; bảng STT, Ngày ghi sổ, Số phiếu (Nhập, Xuất), Diễn giải, Số lượng (Nhập, Xuất, Tồn),
 * Ký xác nhận của kế toán; tồn đầu kỳ, cộng phát sinh, tồn cuối kỳ. Không in giá trị.
 */
export function StockCardPrintPage({ productId }: { productId: string }) {
  return (
    <Suspense>
      <StockCardPrint productId={productId} />
    </Suspense>
  )
}

function StockCardPrint({ productId }: { productId: string }) {
  const search = useSearchParams()
  const my = useMyWarehouses()
  const store = useStoreProfile()
  const param = search.get('warehouseId')
  const warehouse = param ? my.data?.find((w) => w.id === param) : undefined
  const range = rangeFromParams(search.get('from'), search.get('to')) ?? presetRange('30d')
  const card = useStockCard(my.data ? { productId, warehouseId: warehouse?.id, from: range.from, to: range.to } : null)
  const data = card.data
  const q = (n: number) => formatNumber(n, 0)
  const all = !data?.warehouseId

  return (
    <PrintPage
      title={data ? `Thẻ kho ${data.product.code}` : 'Thẻ kho'}
      ready={!!data && !!store.data}
      error={card.error ?? store.error}
    >
      {data && (
        <>
          <PrintHeader
            store={store.data}
            title="Thẻ kho"
            hideDate
            extra={<p className="italic">Ngày lập thẻ: {vnLongDate(new Date().toISOString()).replace(/^Ngày /, '')}</p>}
          />
          <section className="mb-3 grid grid-cols-2 gap-x-6 gap-y-0.5">
            <p className="col-span-2">
              <span className="font-semibold">Tên mặt hàng:</span> {data.product.name}
            </p>
            <p>
              <span className="font-semibold">Mã số:</span> {data.product.code}
            </p>
            <p>
              <span className="font-semibold">Đơn vị tính:</span> {data.product.baseUnit}
              {data.product.units.length > 0 && ` (${data.product.units.map((u) => u.name).join(', ')})`}
            </p>
            <p>
              <span className="font-semibold">Kho:</span>{' '}
              {warehouse ? `${warehouse.code} – ${warehouse.name}` : 'Mọi kho'}
            </p>
            <p>
              <span className="font-semibold">Kỳ:</span> từ {displayDateKey(data.from)} đến {displayDateKey(data.to)}
            </p>
          </section>
          <PrintTable className="table-fixed">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '4%' }}>
                  STT
                </th>
                <th rowSpan={2} style={{ width: '10%' }}>
                  Ngày ghi sổ
                </th>
                <th colSpan={2}>Số phiếu</th>
                <th rowSpan={2}>Diễn giải</th>
                <th colSpan={3}>Số lượng</th>
                <th rowSpan={2} style={{ width: '9%' }}>
                  Ký xác nhận của kế toán
                </th>
              </tr>
              <tr>
                <th style={{ width: '11%' }}>Nhập</th>
                <th style={{ width: '11%' }}>Xuất</th>
                <th style={{ width: '7%' }}>Nhập</th>
                <th style={{ width: '7%' }}>Xuất</th>
                <th style={{ width: '8%' }}>Tồn</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-semibold">
                <td />
                <td />
                <td />
                <td />
                <td>Tồn đầu kỳ</td>
                <td />
                <td />
                <NumCell>{q(data.opening.quantity)}</NumCell>
                <td />
              </tr>
              {data.lines.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center italic">
                    Không có phát sinh trong kỳ
                  </td>
                </tr>
              )}
              {data.lines.map((l, i) => {
                const isIn = l.inQuantity > 0
                return (
                  <tr key={l.id}>
                    <td className="text-center">{i + 1}</td>
                    <td className="whitespace-nowrap">{vnDdMmYyyy(l.postedAt)}</td>
                    <td className="text-[9.5pt]">{isIn ? l.docCode : ''}</td>
                    <td className="text-[9.5pt]">{isIn ? '' : l.docCode}</td>
                    <td>
                      {all && <span className="font-semibold">[{l.warehouseCode}] </span>}
                      {l.description}
                    </td>
                    <NumCell>{l.inQuantity ? q(l.inQuantity) : ''}</NumCell>
                    <NumCell>{l.outQuantity ? q(l.outQuantity) : ''}</NumCell>
                    <NumCell>{q(l.balanceQuantity)}</NumCell>
                    <td />
                  </tr>
                )
              })}
              <tr className="font-semibold">
                <td />
                <td />
                <td />
                <td />
                <td>Cộng phát sinh</td>
                <NumCell>{q(data.totals.inQuantity)}</NumCell>
                <NumCell>{q(data.totals.outQuantity)}</NumCell>
                <td />
                <td />
              </tr>
              <tr className="font-semibold">
                <td />
                <td />
                <td />
                <td />
                <td>Tồn cuối kỳ</td>
                <td />
                <td />
                <NumCell>{q(data.closing.quantity)}</NumCell>
                <td />
              </tr>
            </tbody>
          </PrintTable>
          <PrintSignatures
            date={vnLongDate(new Date().toISOString())}
            slots={[
              { title: 'Thủ kho' },
              { title: 'Kế toán trưởng', name: store.data?.chiefAccountantName },
              { title: 'Giám đốc', note: '(Ký, họ tên, đóng dấu)', name: store.data?.directorName },
            ]}
          />
        </>
      )}
    </PrintPage>
  )
}
