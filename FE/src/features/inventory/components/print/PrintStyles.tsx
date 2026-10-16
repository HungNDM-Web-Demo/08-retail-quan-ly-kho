/** CSS in A4 dọc dùng chung cho mọi bản in (07 §2.11). Màn hình: tờ giấy giữa trang, thanh công cụ phía trên. */
const css = `
@page { size: A4 portrait; margin: 12mm; }
.print-sheet { font-size: 11pt; line-height: 1.4; }
.print-sheet table { width: 100%; border-collapse: collapse; }
.print-sheet thead { display: table-header-group; }
.print-sheet tr { break-inside: avoid; }
.print-sheet th, .print-sheet td { border: 1px solid currentColor; padding: 3px 5px; vertical-align: top; }
@media screen {
  .print-sheet { width: 210mm; max-width: calc(100vw - 16px); min-height: 297mm; padding: 12mm; margin: 0 auto 24px; }
}
@media print {
  html, body { background: #fff !important; }
  .print-sheet { color: #000 !important; background: #fff !important; box-shadow: none !important; border: 0 !important; padding: 0 !important; width: auto; max-width: none; min-height: 0; margin: 0; }
  .no-print, [data-sonner-toaster] { display: none !important; }
}
`

export function PrintStyles() {
  return <style>{css}</style>
}
