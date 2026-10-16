'use client'

/**
 * Âm báo quét mã bằng Web Audio, không tệp âm thanh (07 §4.3). Trình duyệt chỉ phát sau khi người dùng đã
 * tương tác (gõ, bấm), mà quét mã luôn đi sau một lần gõ nên không cần nút bật riêng.
 */

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  if (context.state === 'suspended') void context.resume().catch(() => undefined)
  return context
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, gain = 0.15) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = frequency
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

/** "ok": bíp ngắn khi thêm dòng; "error": hai nốt trầm khi không tìm thấy mã, hàng ngừng */
export function scanBeep(kind: 'ok' | 'error') {
  try {
    const ctx = getContext()
    if (!ctx) return
    const t = ctx.currentTime
    if (kind === 'ok') tone(ctx, 1760, t, 0.07, 0.08)
    else {
      tone(ctx, 330, t, 0.14)
      tone(ctx, 247, t + 0.15, 0.2)
    }
  } catch {
    // trình duyệt chặn âm thanh: bỏ qua
  }
}
