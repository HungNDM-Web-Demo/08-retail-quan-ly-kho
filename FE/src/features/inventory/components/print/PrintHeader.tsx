import type { StoreProfile } from '@/types/inventory'
import { vnParts } from '../../lib/vn-time'

/** "Ngày 15 tháng 10 năm 2026" theo giờ Việt Nam */
export function vnLongDate(iso: string | null | undefined): string {
  if (!iso) return 'Ngày …… tháng …… năm ……'
  const p = vnParts(iso)
  return `Ngày ${String(p.day).padStart(2, '0')} tháng ${String(p.month).padStart(2, '0')} năm ${p.year}`
}

/**
 * Đầu chứng từ theo bố cục mẫu (01-VT, 02-VT, 05-VT; quyết định 33): góc trái đơn vị, địa chỉ; góc phải mẫu số;
 * tiêu đề giữa, ngày, số phiếu, dòng phụ.
 */
export function PrintHeader({
  store,
  formCode,
  title,
  date,
  code,
  extra,
  hideDate,
}: {
  store: StoreProfile | undefined
  /** "Mẫu số 01 - VT" */
  formCode?: string
  title: string
  /** Ngày chứng từ (ISO) */
  date?: string | null
  code?: string | null
  /** Dòng dưới số phiếu ("Nợ: …… Có: ……") */
  extra?: React.ReactNode
  hideDate?: boolean
}) {
  return (
    <header className="mb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-3">
          {store?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt="" className="size-12 shrink-0 object-contain" />
          )}
          <div className="min-w-0">
            <p>
              <span className="font-semibold">Đơn vị:</span> {store?.name}
            </p>
            <p>
              <span className="font-semibold">Địa chỉ:</span> {store?.address}
            </p>
          </div>
        </div>
        {formCode && <p className="shrink-0 text-center font-semibold">{formCode}</p>}
      </div>
      <div className="mt-5 text-center">
        <h1 className="text-[15pt] font-bold tracking-wide uppercase">{title}</h1>
        {!hideDate && <p className="italic">{vnLongDate(date)}</p>}
        {code !== undefined && <p>Số: {code || '(chưa cấp)'}</p>}
        {extra}
      </div>
    </header>
  )
}
