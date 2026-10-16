export type SignatureSlot = { title: string; note?: string; name?: string | null }

/** Hàng chữ ký cuối chứng từ: tiêu đề, "(Ký, họ tên)", khoảng ký, họ tên in sẵn nếu có */
export function PrintSignatures({ slots, date }: { slots: SignatureSlot[]; date?: string }) {
  return (
    <section className="mt-6 break-inside-avoid">
      {date && <p className="mb-2 text-right italic">{date}</p>}
      <div className="grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}>
        {slots.map((s) => (
          <div key={s.title} className="flex flex-col items-center">
            <p className="font-semibold">{s.title}</p>
            <p className="text-[10pt] italic">{s.note ?? '(Ký, họ tên)'}</p>
            <div className="h-20" />
            <p className="font-medium">{s.name ?? ''}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
