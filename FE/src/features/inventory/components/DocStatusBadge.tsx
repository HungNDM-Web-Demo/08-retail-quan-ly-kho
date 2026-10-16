import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  docStatusBadge,
  docStatusLabels,
  lateTransferLabel,
  stocktakeStatusBadge,
  stocktakeStatusLabels,
  transferStatusBadge,
  transferStatusLabels,
} from '@/config/inventory-labels'
import type { DocStatus, StocktakeStatus, TransferStatus } from '@/types/inventory'

type Props =
  | { kind: 'doc'; status: DocStatus; className?: string }
  | { kind: 'transfer'; status: TransferStatus; isLate?: boolean; className?: string }
  | { kind: 'stocktake'; status: StocktakeStatus; className?: string }

/** Nhãn trạng thái phiếu (SRS §5.2); phiếu chuyển trễ thêm nhãn "Trễ" (BR-13) */
export function DocStatusBadge(props: Props) {
  if (props.kind === 'transfer') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={transferStatusBadge[props.status]} className={props.className}>
          {transferStatusLabels[props.status]}
        </StatusBadge>
        {props.isLate && props.status === 'DangChuyen' && <StatusBadge tone="warning">{lateTransferLabel}</StatusBadge>}
      </span>
    )
  }
  if (props.kind === 'stocktake') {
    return (
      <StatusBadge tone={stocktakeStatusBadge[props.status]} className={props.className}>
        {stocktakeStatusLabels[props.status]}
      </StatusBadge>
    )
  }
  return (
    <StatusBadge tone={docStatusBadge[props.status]} className={props.className}>
      {docStatusLabels[props.status]}
    </StatusBadge>
  )
}
