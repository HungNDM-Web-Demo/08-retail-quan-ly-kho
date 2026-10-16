// Sinh ảnh kiểu hàng hóa (minh họa phẳng, 256×256, nền trong suốt, WebP ≤ 15 KB) cho các kiểu bao bì
// trong `imageKinds` của src/mock/seed/demo-data.json, ghi vào public/seed/products/{key}.webp.
// Mỗi mặt hàng trỏ tới một kiểu qua `products[].image`, nhiều mặt hàng dùng chung một ảnh.
// Mỗi kiểu vẽ bằng SVG hình học (chai, lon, hộp, gói, túi, hũ, can, tuýp, vỉ…), nhãn trơn không chữ,
// không nhãn hiệu thật, đổ bóng nhẹ dưới chân. Xác định: không ngẫu nhiên, chạy lại cho cùng byte.
// Không ghi gì vào file JSON.
//
// Chạy:      pnpm seed:images
// Tùy chọn:  --only <chuỗi>       chỉ vẽ kiểu có key chứa chuỗi
//            --preview <thư mục>  xuất thêm PNG từng ảnh và lưới _grid.png để xem nhanh
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'src', 'mock', 'seed', 'demo-data.json')
const OUT_DIR = join(ROOT, 'public', 'seed', 'products')
const S = 256
const MAX_BYTES = 15 * 1000
const GROUND = 224

const args = process.argv.slice(2)
const argVal = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const ONLY = argVal('--only')
const PREVIEW = argVal('--preview')

// ============================================================ Tiện ích SVG
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const r2 = (n) => Math.round(n * 100) / 100
function attrs(o) {
  let out = ''
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === false) continue
    out += ` ${k}="${typeof v === 'number' ? r2(v) : esc(v)}"`
  }
  return out
}
const el = (tag, o = {}, body = '') =>
  body ? `<${tag}${attrs(o)}>${body}</${tag}>` : `<${tag}${attrs(o)}/>`
const rect = (x, y, w, h, o = {}) => el('rect', { x, y, width: w, height: h, ...o })
const circle = (cx, cy, r, o = {}) => el('circle', { cx, cy, r, ...o })
const ellipse = (cx, cy, rx, ry, o = {}) => el('ellipse', { cx, cy, rx, ry, ...o })
const path = (d, o = {}) => el('path', { d, ...o })
const g = (o, body) => el('g', o, body)
const stroke = (color, width, extra = {}) => ({
  fill: 'none',
  stroke: color,
  'stroke-width': width,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  ...extra,
})
const poly = (pts) => 'M' + pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z'

const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16))
const rgbToHex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()
const mix = (a, b, t) => {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t))
}
const tint = (c, t) => mix(c, '#FFFFFF', t)
const shade = (c, t) => mix(c, '#000000', t)
const range = (n) => Array.from({ length: n }, (_, i) => i)

// ============================================================ Định nghĩa dùng chung trong một ảnh
let defs = []
let uid = 0
const newId = (p) => `${p}${++uid}`
function linGrad(stops, dir = 'h') {
  const id = newId('lg')
  const [x2, y2] = dir === 'v' ? [0, 1] : [1, 0]
  defs.push(
    el(
      'linearGradient',
      { id, x1: 0, y1: 0, x2, y2 },
      stops
        .map(([o, c, op]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': op }))
        .join('')
    )
  )
  return `url(#${id})`
}
// Mặt cong (trụ): ánh sáng từ trái, mép phải tối dần
const cyl = (c, k = 0.16) =>
  linGrad([
    [0, tint(c, k * 1.4)],
    [0.3, tint(c, k * 0.4)],
    [0.7, c],
    [1, shade(c, k * 1.2)],
  ])
const vGrad = (top, bottom) =>
  linGrad(
    [
      [0, top],
      [1, bottom],
    ],
    'v'
  )
// Màu trắng có khối (giấy, nhựa trắng) để vẫn nổi trên nền trắng
const WHITE = '#F8FAFC'
const whiteCyl = () =>
  linGrad([
    [0, '#FFFFFF'],
    [0.55, '#F1F5F9'],
    [1, '#CBD5E1'],
  ])
function clipOf(inner) {
  const id = newId('cp')
  defs.push(el('clipPath', { id }, inner))
  return `url(#${id})`
}
const clipped = (shape, body) => g({ 'clip-path': clipOf(shape) }, body)
function blurFilter(std) {
  const id = newId('bl')
  defs.push(
    el(
      'filter',
      { id, x: '-50%', y: '-50%', width: '200%', height: '200%' },
      el('feGaussianBlur', { stdDeviation: std })
    )
  )
  return `url(#${id})`
}
// Bóng đổ mềm dưới chân vật
const shadow = (cx, rx, y = GROUND - 2, ry = 7, op = 0.24) =>
  ellipse(cx, y, rx, ry, { fill: '#1E1B4B', 'fill-opacity': op, filter: blurFilter(4) })
// Vệt bóng sáng dọc
const shine = (x, y, w, h, op = 0.5) =>
  rect(x, y, w, h, { rx: w / 2, fill: '#FFFFFF', 'fill-opacity': op })
// Vệt tối mép phải
const edge = (x, y, w, h, op = 0.12) => rect(x, y, w, h, { fill: '#000000', 'fill-opacity': op })

// Thân chai: cổ (neckW) từ top xuống neckY, vai cong tới bodyW ở shoulderY, đáy bo r ở bottom
function bottleD(cx, top, neckW, neckY, shoulderY, bodyW, bottom, r = 12) {
  const n = neckW / 2
  const b = bodyW / 2
  const k = shoulderY - neckY
  return (
    `M${cx - n} ${top}L${cx - n} ${neckY}` +
    `C${cx - n} ${neckY + k * 0.45} ${cx - b} ${neckY + k * 0.35} ${cx - b} ${shoulderY}` +
    `L${cx - b} ${bottom - r}Q${cx - b} ${bottom} ${cx - b + r} ${bottom}` +
    `L${cx + b - r} ${bottom}Q${cx + b} ${bottom} ${cx + b} ${bottom - r}` +
    `L${cx + b} ${shoulderY}` +
    `C${cx + b} ${neckY + k * 0.35} ${cx + n} ${neckY + k * 0.45} ${cx + n} ${neckY}` +
    `L${cx + n} ${top}Z`
  )
}
// Nắp vặn có khía
function screwCap(x, y, w, h, c, k = 0.16) {
  let out = rect(x, y, w, h, { rx: 3, fill: cyl(c, k) })
  for (let i = 1; i < w / 4; i++)
    out += rect(x + i * 4 - 0.6, y + 3, 1.2, h - 6, { fill: shade(c, 0.25), 'fill-opacity': 0.5 })
  out += rect(x, y, w, 3, { rx: 1.5, fill: tint(c, 0.3) })
  return out
}
// Hộp vuông góc nhìn chéo: mặt trước (x, y, w, h), chiều sâu lệch (dx, dy)
function box(x, y, w, h, dx, dy, c, o = {}) {
  const front = rect(x, y, w, h, { fill: o.front ?? vGrad(tint(c, 0.06), shade(c, 0.06)) })
  const side = path(
    poly([
      [x + w, y],
      [x + w + dx, y + dy],
      [x + w + dx, y + h + dy],
      [x + w, y + h],
    ]),
    { fill: o.side ?? shade(c, 0.2) }
  )
  const top = path(
    poly([
      [x, y],
      [x + dx, y + dy],
      [x + w + dx, y + dy],
      [x + w, y],
    ]),
    { fill: o.top ?? tint(c, 0.28) }
  )
  return side + top + front
}

// ============================================================ Các kiểu hàng (toạ độ 256×256, chân đặt ở GROUND)
const KINDS = {
  // Chai nhựa trong, nước màu hổ phách, nhãn xanh, nắp vặn
  'chai-nhua': () => {
    const cx = 128
    const d = bottleD(cx, 46, 28, 60, 100, 70, GROUND, 14)
    const liquid = '#F59E0B'
    const label = '#10B981'
    let body = rect(0, 0, S, S, { fill: '#E0F2FE' })
    body += rect(0, 76, S, S, { fill: cyl(liquid, 0.12) })
    body += rect(0, 126, S, 54, { fill: cyl(label) })
    body += rect(0, 140, S, 6, { fill: '#FFFFFF', 'fill-opacity': 0.85 })
    body += path(
      `M${cx - 20} 166q10 -10 20 0t20 0`,
      stroke('#FFFFFF', 3, { 'stroke-opacity': 0.7 })
    )
    for (const y of [110, 118, 196, 204])
      body += rect(0, y, S, 2, { fill: shade(liquid, 0.25), 'fill-opacity': 0.35 })
    body += shine(cx - 28, 70, 7, 140, 0.55) + edge(cx + 26, 40, 12, 200, 0.08)
    return (
      shadow(cx, 40) +
      clipped(path(d), body) +
      rect(cx - 18, 52, 36, 6, { rx: 2, fill: shade(label, 0.1) }) +
      screwCap(cx - 15, 30, 30, 22, label)
    )
  },

  // Lon nhôm: thân đỏ, đai bạc trên dưới
  lon: () => {
    const cx = 128
    const c = '#DC2626'
    const silver = '#CBD5E1'
    const d = `M${cx - 32} 50L${cx + 32} 50L${cx + 37} 64L${cx + 37} 208L${cx + 31} ${GROUND - 3}Q${cx} ${GROUND + 2} ${cx - 31} ${GROUND - 3}L${cx - 37} 208L${cx - 37} 64Z`
    let body = rect(0, 0, S, S, { fill: cyl(silver, 0.2) })
    body += rect(0, 66, S, 140, { fill: cyl(c) })
    body += path(
      `M0 150C40 130 70 176 128 156S210 136 256 150L256 172C210 160 170 186 128 178S50 150 0 172Z`,
      { fill: '#FFFFFF', 'fill-opacity': 0.92 }
    )
    body += circle(cx, 104, 16, { fill: '#FFFFFF', 'fill-opacity': 0.25 })
    body += shine(cx - 30, 58, 7, 150, 0.45) + edge(cx + 26, 40, 14, 200, 0.1)
    const top =
      ellipse(cx, 51, 32, 7, { fill: '#E2E8F0' }) +
      ellipse(cx, 52, 26, 5, { fill: '#94A3B8' }) +
      ellipse(cx, 51.4, 25, 4.4, { fill: '#CBD5E1' }) +
      rect(cx - 9, 47.5, 18, 6, { rx: 3, fill: '#94A3B8' }) +
      rect(cx - 4, 49, 8, 3, { rx: 1.5, fill: '#E2E8F0' })
    return shadow(cx, 40) + clipped(path(d), body) + top
  },

  // Chai thủy tinh xanh lá cổ dài, nắp thiếc vàng, nhãn kem
  'chai-thuy-tinh': () => {
    const cx = 128
    const c = '#15803D'
    const d = bottleD(cx, 40, 24, 92, 132, 62, GROUND, 12)
    let body = rect(0, 0, S, S, { fill: cyl(c, 0.2) })
    body += rect(0, 60, S, 24, { fill: cyl('#D97706', 0.18) })
    body += rect(0, 150, S, 52, { fill: cyl('#FEF3C7', 0.08) })
    body += rect(0, 155, S, 3, { fill: '#D97706' }) + rect(0, 194, S, 3, { fill: '#D97706' })
    body += circle(cx, 176, 9, { fill: c, 'fill-opacity': 0.85 })
    body += shine(cx - 24, 138, 6, 76, 0.4) + shine(cx - 9, 46, 4, 40, 0.4)
    body += edge(cx + 22, 40, 12, 200, 0.12)
    let cap = rect(cx - 15, 32, 30, 12, { rx: 2, fill: cyl('#F59E0B', 0.2) })
    for (const i of range(6)) cap += rect(cx - 13 + i * 5, 40, 3, 5, { rx: 1, fill: '#B45309' })
    return (
      shadow(cx, 36) +
      clipped(path(d), body) +
      rect(cx - 14, 40, 28, 8, { rx: 3, fill: shade(c, 0.1) }) +
      cap
    )
  },

  // Bình nước 19 lít: nhựa xanh nhạt trong, nắp và quai xanh đậm
  'binh-nuoc': () => {
    const cx = 128
    const d = bottleD(cx, 44, 40, 62, 110, 128, GROUND, 22)
    const c = '#7DD3FC'
    const cap = '#1D4ED8'
    let body = rect(0, 0, S, S, { fill: cyl(c, 0.2) })
    body += rect(0, 0, S, 92, { fill: '#FFFFFF', 'fill-opacity': 0.35 })
    for (const y of [138, 178]) {
      body += path(`M0 ${y}Q128 ${y + 10} 256 ${y}`, stroke(shade(c, 0.22), 4))
      body += path(
        `M0 ${y + 5}Q128 ${y + 15} 256 ${y + 5}`,
        stroke('#FFFFFF', 2, { 'stroke-opacity': 0.6 })
      )
    }
    body += shine(cx - 54, 112, 8, 96, 0.55) + shine(cx - 40, 120, 4, 20, 0.5)
    body += edge(cx + 50, 60, 20, 200, 0.08)
    const handle = path(`M${cx + 20} 66C${cx + 46} 60 ${cx + 54} 96 ${cx + 40} 104`, stroke(cap, 7))
    return (
      shadow(cx, 62) +
      clipped(path(d), body) +
      handle +
      rect(cx - 24, 58, 48, 8, { rx: 3, fill: shade(cap, 0.1) }) +
      rect(cx - 21, 30, 42, 30, { rx: 8, fill: cyl(cap) }) +
      rect(cx - 21, 30, 42, 6, { rx: 3, fill: tint(cap, 0.3) })
    )
  },

  // Hộp giấy đứng (nước ép 1 lít): cam, dải trắng có quả cam, nắp vặn trên mặt trên
  'hop-giay': () => {
    const c = '#F97316'
    const [x, y, w, h, dx, dy] = [76, 70, 78, GROUND - 70, 30, -18]
    let out = shadow(128, 58)
    out += box(x, y, w, h, dx, dy, c)
    out += rect(x, y + 50, w, 52, { fill: '#FFFFFF' })
    out += path(
      poly([
        [x + w, y + 50],
        [x + w + dx, y + 50 + dy],
        [x + w + dx, y + 102 + dy],
        [x + w, y + 102],
      ]),
      {
        fill: '#E2E8F0',
      }
    )
    out += circle(x + w / 2, y + 76, 17, { fill: c })
    out += circle(x + w / 2 - 5, y + 71, 5, { fill: '#FFFFFF', 'fill-opacity': 0.4 })
    out += path(`M${x + w / 2} ${y + 59}q8 -12 18 -8q-6 10 -18 8Z`, { fill: '#16A34A' })
    out += rect(x, y + h - 14, w, 6, { fill: shade(c, 0.12) })
    // Nắp vặn trên mặt trên
    const cxTop = x + 22 + dx / 2
    const cyTop = y + dy / 2
    out += rect(cxTop - 9, cyTop - 10, 18, 10, { fill: cyl(WHITE, 0.2) })
    out += ellipse(cxTop, cyTop, 9, 3.5, { fill: '#CBD5E1' })
    out += ellipse(cxTop, cyTop - 10, 9, 3.5, { fill: '#FFFFFF' })
    return out
  },

  // Lốc 4 hộp sữa giấy nhỏ có ống hút
  'hop-sua': () => {
    const c = '#0EA5E9'
    const [w, h, dx, dy] = [50, 110, 22, -14]
    const one = (x, y, straw) => {
      let o = box(x, y, w, h, dx, dy, WHITE, {
        front: vGrad('#FFFFFF', '#E2E8F0'),
        side: '#CBD5E1',
        top: '#F1F5F9',
      })
      const b = 50
      o += rect(x, y + b, w, h - b, { fill: vGrad(c, shade(c, 0.1)) })
      o += path(
        poly([
          [x + w, y + b],
          [x + w + dx, y + b + dy],
          [x + w + dx, y + h + dy],
          [x + w, y + h],
        ]),
        {
          fill: shade(c, 0.25),
        }
      )
      o += path(`M${x} ${y + b + 4}q12.5 -8 25 0t25 0`, stroke('#FFFFFF', 3))
      o +=
        circle(x + 25, y + 30, 10, { fill: '#FACC15' }) +
        circle(x + 22, y + 27, 3, { fill: '#FFFFFF', 'fill-opacity': 0.6 })
      // Viền mép để tách các hộp trong lốc
      o += path(
        `M${x} ${y + h}L${x} ${y}L${x + dx} ${y + dy}L${x + w + dx} ${y + dy}L${x + w + dx} ${y + h + dy}L${x + w} ${y + h}ZM${x} ${y}L${x + w} ${y}L${x + w + dx} ${y + dy}M${x + w} ${y}L${x + w} ${y + h}`,
        stroke('#94A3B8', 1.4)
      )
      if (straw) {
        const sx = x + w / 2 + dx / 2 + 6
        const sy = y + dy / 2
        o +=
          ellipse(sx, sy, 4.5, 2, { fill: '#94A3B8' }) +
          path(`M${sx} ${sy}L${sx + 4} ${sy - 40}L${sx + 14} ${sy - 50}`, stroke('#F43F5E', 4.5))
      }
      return o
    }
    let out = shadow(134, 72)
    const x0 = 128 - w - dx
    out += one(x0 + dx, GROUND - h + dy, false) + one(x0 + dx + w, GROUND - h + dy, false)
    out += one(x0, GROUND - h, false) + one(x0 + w, GROUND - h, true)
    return out
  },

  // Hũ nhựa tròn nắp vặn lớn (hạt, kẹo)
  'hu-nhua': () => {
    const cx = 128
    const c = '#0D9488'
    const d = `M${cx - 54} 100Q${cx - 56} 104 ${cx - 56} 112L${cx - 56} ${GROUND - 16}Q${cx - 56} ${GROUND} ${cx - 40} ${GROUND}L${cx + 40} ${GROUND}Q${cx + 56} ${GROUND} ${cx + 56} ${GROUND - 16}L${cx + 56} 112Q${cx + 56} 104 ${cx + 54} 100Z`
    let body = rect(0, 0, S, S, { fill: whiteCyl() })
    body += rect(0, 128, S, 68, { fill: cyl(tint(c, 0.15)) })
    body += circle(cx, 162, 24, { fill: '#FFFFFF' })
    for (const [x, y, a] of [
      [-9, -6, -30],
      [8, -4, 25],
      [-1, 9, 5],
    ])
      body += ellipse(cx + x, 162 + y, 8, 5, {
        fill: '#C08457',
        transform: `rotate(${a} ${cx + x} ${162 + y})`,
      })
    body += shine(cx - 46, 110, 7, 96, 0.6) + edge(cx + 40, 90, 20, 160, 0.06)
    let lid = rect(cx - 60, 72, 120, 32, { rx: 6, fill: cyl(c) })
    for (const i of range(14))
      lid += rect(cx - 55 + i * 8, 80, 2, 20, { fill: shade(c, 0.25), 'fill-opacity': 0.5 })
    lid += ellipse(cx, 73, 58, 6, { fill: tint(c, 0.3) })
    return shadow(cx, 60) + clipped(path(d), body) + lid
  },

  // Gói bánh snack căng phồng, hai đầu hàn răng cưa
  'goi-banh': () => {
    const cx = 128
    const c = '#7C3AED'
    const L = 72
    const R = 184
    const zig = (y, up) =>
      range(14)
        .map((i) => `L${r2(L + (i + 0.5) * 8)} ${y + (up ? -5 : 5)}L${L + (i + 1) * 8} ${y}`)
        .join('')
    const d =
      `M${L} 34${zig(34, true)}L${R} 50C${R + 14} 100 ${R + 14} 160 ${R} 204L${R} 214` +
      range(14)
        .map((i) => `L${r2(R - (i + 0.5) * 8)} 219L${R - (i + 1) * 8} 214`)
        .join('') +
      `L${L} 204C${L - 14} 160 ${L - 14} 100 ${L} 50Z`
    let body = rect(0, 0, S, S, { fill: cyl(c, 0.22) })
    body +=
      rect(0, 0, S, 50, { fill: shade(c, 0.18) }) + rect(0, 202, S, 30, { fill: shade(c, 0.18) })
    for (const i of range(14)) {
      body += rect(L + i * 8 + 3, 36, 1.5, 12, { fill: '#000000', 'fill-opacity': 0.15 })
      body += rect(L + i * 8 + 3, 204, 1.5, 10, { fill: '#000000', 'fill-opacity': 0.15 })
    }
    // Ngôi sao nổ vàng và vài miếng snack
    const star = range(24).map((i) => {
      const a = (i / 24) * Math.PI * 2
      const r = i % 2 ? 26 : 34
      return [cx + Math.cos(a) * r, 112 + Math.sin(a) * r]
    })
    body += path(poly(star), { fill: '#FACC15' })
    body += circle(cx, 112, 20, { fill: '#FDE047' })
    for (const [x, y, a] of [
      [-18, 62, -20],
      [14, 70, 30],
      [-2, 52, 10],
    ]) {
      body += ellipse(cx + x, 112 + y, 15, 10, {
        fill: '#F59E0B',
        transform: `rotate(${a} ${cx + x} ${112 + y})`,
      })
      body += ellipse(cx + x - 3, 112 + y - 3, 5, 2.5, {
        fill: '#FDE68A',
        transform: `rotate(${a} ${cx + x} ${112 + y})`,
      })
    }
    body += shine(L + 6, 60, 8, 130, 0.35) + edge(R - 8, 40, 30, 180, 0.08)
    return shadow(cx, 56) + clipped(path(d), body)
  },

  // Hộp bánh thiếc vuông, ruy băng vàng và nơ
  'hop-banh': () => {
    const c = '#1D4ED8'
    const gold = '#F59E0B'
    const [x, y, w, h, dx, dy] = [44, 150, 130, GROUND - 150, 38, -30]
    let out = shadow(140, 86)
    out += box(x, y, w, h, dx, dy, c)
    // Nắp: viền trên mặt trước và mặt bên
    out += rect(x, y, w, 16, { fill: shade(c, 0.12) })
    out += path(
      poly([
        [x + w, y],
        [x + w + dx, y + dy],
        [x + w + dx, y + dy + 16],
        [x + w, y + 16],
      ]),
      {
        fill: shade(c, 0.32),
      }
    )
    // Ruy băng: dọc mặt trước, ngang mặt bên, chéo chữ thập trên mặt trên
    const mx = x + w / 2
    out += rect(mx - 7, y, 14, h, { fill: gold })
    const sy = (t) => [x + w + dx * t, y + dy * t]
    const [s1x, s1y] = sy(0.5)
    out += path(
      poly([
        [s1x - 4, s1y],
        [s1x + 4, s1y - 6],
        [s1x + 4, s1y - 6 + h],
        [s1x - 4, s1y + h],
      ]),
      {
        fill: shade(gold, 0.2),
      }
    )
    const tp = (u, v) => [x + u * w + v * dx, y + v * dy]
    out += path(
      poly([tp(0.5 - 0.054, 0), tp(0.5 - 0.054, 1), tp(0.5 + 0.054, 1), tp(0.5 + 0.054, 0)]),
      {
        fill: tint(gold, 0.15),
      }
    )
    out += path(poly([tp(0, 0.4), tp(1, 0.4), tp(1, 0.6), tp(0, 0.6)]), { fill: tint(gold, 0.15) })
    // Nơ
    const [bx, by] = tp(0.5, 0.5)
    out += path(`M${bx} ${by}C${bx - 30} ${by - 34} ${bx - 44} ${by - 4} ${bx} ${by}Z`, {
      fill: gold,
    })
    out += path(`M${bx} ${by}C${bx + 30} ${by - 34} ${bx + 44} ${by - 4} ${bx} ${by}Z`, {
      fill: shade(gold, 0.1),
    })
    out += path(`M${bx} ${by}l-14 22l8 -2l4 8Z`, { fill: shade(gold, 0.15) })
    out += path(`M${bx} ${by}l14 22l-8 -2l-4 8Z`, { fill: shade(gold, 0.22) })
    out += ellipse(bx, by - 2, 7, 6, { fill: tint(gold, 0.2) })
    // Họa tiết chấm trên mặt trước
    for (const i of range(5))
      out += circle(x + 14 + i * 26 + (i > 1 ? 10 : 0), y + 40, 3.5, {
        fill: '#FFFFFF',
        'fill-opacity': 0.5,
      })
    return out
  },

  // Gói mì dẹt chữ nhật, hai mép hàn răng cưa, hình tô mì
  'goi-mi': () => {
    const c = '#F59E0B'
    const [L, R, T, B] = [26, 230, 70, 196]
    const teeth = (x, dir) =>
      range(16)
        .map(
          (i) =>
            `L${x + dir * 5} ${r2(T + (i + 0.5) * ((B - T) / 16))}L${x} ${r2(T + (i + 1) * ((B - T) / 16))}`
        )
        .join('')
    // Mép trái đi từ dưới lên
    const left = range(16)
      .map(
        (i) =>
          `L${L - 5} ${r2(B - (i + 0.5) * ((B - T) / 16))}L${L} ${r2(B - (i + 1) * ((B - T) / 16))}`
      )
      .join('')
    const shape = `M${L} ${T}Q128 ${T - 8} ${R} ${T}${teeth(R, 1)}Q128 ${B + 8} ${L} ${B}${left}Z`
    let body = rect(0, 0, S, S, { fill: vGrad(tint(c, 0.12), shade(c, 0.08)) })
    body +=
      rect(0, 0, 44, S, { fill: shade(c, 0.15) }) + rect(212, 0, 44, S, { fill: shade(c, 0.15) })
    body += path(`M0 158C60 146 120 172 256 150L256 256L0 256Z`, { fill: '#DC2626' })
    body += path(`M0 166C60 154 120 180 256 158`, stroke('#FFFFFF', 3, { 'stroke-opacity': 0.8 }))
    // Tô mì
    const bx = 150
    const by = 128
    body += path(`M${bx - 44} ${by}A44 36 0 0 0 ${bx + 44} ${by}Z`, { fill: '#FFFFFF' })
    body += rect(bx - 44, by - 2, 88, 6, { rx: 3, fill: '#F1F5F9' })
    body += path(`M${bx - 30} ${by + 14}q10 6 20 0`, stroke('#DC2626', 3))
    for (const i of range(4))
      body += path(
        `M${bx - 34 + i * 4} ${by - 2}q6 -10 12 0t12 0t12 0t12 0t12 0`,
        stroke('#FDE68A', 3.4)
      )
    body +=
      circle(bx - 12, by - 10, 6, { fill: '#F87171' }) +
      circle(bx + 12, by - 12, 5, { fill: '#22C55E' })
    body += path(
      `M${bx + 30} ${by - 4}L${bx + 46} ${by - 40}M${bx + 36} ${by - 4}L${bx + 54} ${by - 36}`,
      stroke('#92400E', 3)
    )
    body += circle(78, 112, 20, { fill: '#DC2626' }) + circle(78, 112, 13, { fill: '#FDE68A' })
    body += rect(48, 82, 150, 6, { rx: 3, fill: '#FFFFFF', 'fill-opacity': 0.35 })
    return shadow(128, 100, 204, 7) + clipped(path(shape), body)
  },

  // Ly mì giấy có nắp, dải màu cam đỏ
  'ly-mi': () => {
    const cx = 128
    const c = '#EA580C'
    const d = `M${cx - 58} 82L${cx + 58} 82L${cx + 40} ${GROUND - 4}Q${cx} ${GROUND + 2} ${cx - 40} ${GROUND - 4}Z`
    let body = rect(0, 0, S, S, { fill: whiteCyl() })
    body += path(`M0 118C50 110 90 130 256 112L256 176C150 190 90 166 0 180Z`, { fill: cyl(c) })
    for (const i of range(3))
      body += path(`M${cx - 30} ${136 + i * 9}q7.5 -8 15 0t15 0t15 0t15 0`, stroke('#FDE68A', 3))
    body += rect(0, 196, S, 6, { fill: c })
    body += shine(cx - 46, 100, 8, 100, 0.7) + edge(cx + 32, 60, 30, 180, 0.06)
    const lid =
      ellipse(cx, 82, 60, 12, { fill: '#E2E8F0' }) +
      ellipse(cx, 80, 58, 10.5, { fill: '#F8FAFC' }) +
      ellipse(cx, 80, 30, 5, { fill: c, 'fill-opacity': 0.9 }) +
      path(`M${cx - 48} 74L${cx - 70} 58Q${cx - 80} 60 ${cx - 76} 72L${cx - 54} 86Z`, {
        fill: '#FFFFFF',
        stroke: '#CBD5E1',
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
      })
    return (
      shadow(cx, 46) +
      clipped(path(d), body) +
      rect(cx - 60, 80, 120, 7, { rx: 3.5, fill: '#E2E8F0' }) +
      lid
    )
  },

  // Chai dầu ăn vàng trong, quai cầm khoét, nắp xanh
  'chai-dau-an': () => {
    const cx = 124
    const c = '#FACC15'
    const cap = '#15803D'
    const outer = bottleD(cx, 44, 30, 58, 98, 86, GROUND, 16)
    const hole = `M${cx + 22} 112Q${cx + 22} 104 ${cx + 30} 104Q${cx + 36} 104 ${cx + 36} 112L${cx + 36} 146Q${cx + 36} 154 ${cx + 29} 154Q${cx + 22} 154 ${cx + 22} 146Z`
    const d = outer + hole
    let body = rect(0, 0, S, S, { fill: '#FEF9C3' })
    body += rect(0, 72, S, S, { fill: cyl(c, 0.2) })
    body += rect(0, 162, S, 44, { fill: cyl(cap) })
    body += path(`M${cx - 12} 192q-2 -22 22 -24q2 22 -22 24Z`, { fill: '#BBF7D0' })
    body += path(`M${cx - 12} 192l14 -16`, stroke(cap, 1.6))
    body += shine(cx - 37, 100, 7, 110, 0.55) + edge(cx + 34, 60, 12, 200, 0.12)
    const ring = path(hole, stroke(shade(c, 0.3), 2))
    return (
      shadow(cx + 4, 50) +
      clipped(path(d, { 'clip-rule': 'evenodd' }), body) +
      ring +
      rect(cx - 19, 52, 38, 7, { rx: 3, fill: shade(cap, 0.1) }) +
      screwCap(cx - 16, 30, 32, 24, cap)
    )
  },

  // Chai gia vị cổ cao (nước mắm, nước tương): nước nâu, nắp đỏ cao
  'chai-gia-vi': () => {
    const cx = 128
    const c = '#92400E'
    const capC = '#DC2626'
    const d = bottleD(cx, 52, 24, 92, 128, 58, GROUND, 10)
    let body = rect(0, 0, S, S, { fill: '#FFEDD5' })
    body += rect(0, 72, S, S, { fill: cyl(c, 0.2) })
    body += rect(0, 148, S, 54, { fill: cyl('#FFF7ED', 0.08) })
    body += rect(0, 148, S, 10, { fill: capC }) + rect(0, 192, S, 10, { fill: capC })
    body += path(`M${cx - 8} 175l8 -10l8 10l-8 10Z`, { fill: capC })
    body += shine(cx - 23, 134, 6, 76, 0.4) + shine(cx - 9, 76, 4, 30, 0.35)
    body += edge(cx + 20, 40, 12, 200, 0.12)
    const cap =
      rect(cx - 15, 28, 30, 30, { rx: 4, fill: cyl(capC) }) +
      rect(cx - 15, 28, 30, 7, { rx: 3, fill: tint(capC, 0.25) }) +
      rect(cx - 15, 37, 30, 2, { fill: shade(capC, 0.3) }) +
      rect(cx - 17, 52, 34, 7, { rx: 3, fill: shade(capC, 0.12) })
    return shadow(cx, 34) + clipped(path(d), body) + cap
  },

  // Lọ thủy tinh nắp thiếc vàng, đựng dưa chuột ngâm
  'hu-gia-vi': () => {
    const cx = 128
    const d = `M${cx - 40} 96L${cx + 40} 96Q${cx + 50} 106 ${cx + 50} 122L${cx + 50} ${GROUND - 20}Q${cx + 50} ${GROUND} ${cx + 30} ${GROUND}L${cx - 30} ${GROUND}Q${cx - 50} ${GROUND} ${cx - 50} ${GROUND - 20}L${cx - 50} 122Q${cx - 50} 106 ${cx - 40} 96Z`
    const brine = '#D9F99D'
    let body = rect(0, 0, S, S, { fill: '#F0FDF4' })
    body += rect(0, 112, S, S, { fill: cyl(brine, 0.12) })
    const slices = [
      [-26, 192],
      [2, 198],
      [28, 190],
      [-14, 168],
      [16, 164],
      [-30, 140],
      [-2, 140],
      [26, 136],
    ]
    for (const [x, y] of slices) {
      body += circle(cx + x, y, 14, { fill: '#4D7C0F' })
      body += circle(cx + x, y, 11, { fill: '#BEF264' })
      for (const a of [0, 120, 240]) {
        const rad = (a * Math.PI) / 180
        body += ellipse(cx + x + Math.cos(rad) * 4.5, y + Math.sin(rad) * 4.5, 2.4, 1.4, {
          fill: '#F7FEE7',
        })
      }
    }
    body += path(`M${cx - 36} 124q10 -14 22 -4M${cx + 8} 122q12 -12 24 0`, stroke('#4D7C0F', 2.5))
    body += shine(cx - 42, 120, 7, 86, 0.7) + edge(cx + 36, 90, 20, 150, 0.06)
    let lid = rect(cx - 44, 70, 88, 28, { rx: 5, fill: cyl('#F59E0B', 0.22) })
    for (const i of range(10))
      lid += rect(cx - 40 + i * 9, 76, 2, 18, { fill: '#B45309', 'fill-opacity': 0.45 })
    lid += rect(cx - 44, 70, 88, 5, { rx: 2.5, fill: '#FCD34D' })
    return shadow(cx, 54) + clipped(path(d), body) + lid
  },

  // Túi đứng đựng bột, đường: nền hồng, cửa sổ thấy hạt trắng
  'goi-bot': () => {
    const cx = 128
    const c = '#F43F5E'
    const d = `M76 36L180 36L182 56C190 120 192 180 186 ${GROUND - 8}Q128 ${GROUND + 4} 70 ${GROUND - 8}C64 180 66 120 74 56Z`
    let body = rect(0, 0, S, S, { fill: cyl(c, 0.18) })
    body += rect(0, 36, S, 16, { fill: shade(c, 0.15) })
    body += rect(0, 60, S, 3, { fill: shade(c, 0.3) })
    for (const i of range(12))
      body += rect(78 + i * 9, 38, 2, 12, { fill: '#000000', 'fill-opacity': 0.12 })
    body += rect(cx - 32, 96, 64, 76, { rx: 14, fill: '#FFFFFF' })
    for (const i of range(7))
      for (const j of range(8)) {
        const x = cx - 26 + j * 7.5 + (i % 2) * 3.5
        const y = 140 + i * 4.5
        if (y < 168) body += circle(x, y, 1.8, { fill: '#CBD5E1' })
      }
    body += path(`M${cx - 32} 134q16 -8 32 0t32 0`, stroke('#E2E8F0', 2))
    body += path(
      `M70 ${GROUND - 26}Q128 ${GROUND - 14} 186 ${GROUND - 26}`,
      stroke(shade(c, 0.25), 2.5)
    )
    body += shine(82, 70, 7, 120, 0.4) + edge(172, 40, 20, 200, 0.1)
    return shadow(cx, 58) + clipped(path(d), body)
  },

  // Túi gạo 5 kg có lỗ quai xách, cửa sổ thấy gạo, bông lúa
  'bao-gao': () => {
    const cx = 128
    const c = '#15803D'
    const outer = `M64 32L192 32L194 60C202 120 202 190 196 ${GROUND - 8}Q128 ${GROUND + 4} 60 ${GROUND - 8}C54 190 54 120 62 60Z`
    const hole = `M108 44L148 44Q154 44 154 50Q154 56 148 56L108 56Q102 56 102 50Q102 44 108 44Z`
    let body = rect(0, 0, S, S, { fill: whiteCyl() })
    body += rect(0, 32, S, 36, { fill: cyl(c) })
    body += path(`M0 176C80 160 160 190 256 168L256 256L0 256Z`, { fill: cyl(c) })
    body += path(`M0 168C80 152 160 182 256 160`, stroke('#FACC15', 4))
    // Cửa sổ gạo
    body += ellipse(cx, 120, 46, 30, { fill: '#F5F5F4', stroke: '#D6D3D1', 'stroke-width': 2 })
    for (const i of range(5))
      for (const j of range(9)) {
        const x = cx - 36 + j * 9 + (i % 2) * 4
        const y = 104 + i * 8
        if (((x - cx) / 42) ** 2 + ((y - 120) / 26) ** 2 < 1)
          body += ellipse(x, y, 3.6, 1.8, {
            fill: '#FFFFFF',
            stroke: '#E7E5E4',
            'stroke-width': 0.8,
            transform: `rotate(${(i * 37 + j * 23) % 180} ${x} ${y})`,
          })
      }
    // Bông lúa
    body += path(`M170 160Q176 120 160 92`, stroke('#CA8A04', 2.5))
    for (const i of range(6)) {
      const y = 98 + i * 10
      const x = 160 + i * 2.6
      body += ellipse(x + 6, y, 5, 2.6, { fill: '#EAB308', transform: `rotate(-30 ${x + 6} ${y})` })
      body += ellipse(x - 4, y + 4, 5, 2.6, {
        fill: '#FACC15',
        transform: `rotate(30 ${x - 4} ${y + 4})`,
      })
    }
    body += shine(68, 76, 7, 110, 0.5) + edge(184, 40, 20, 200, 0.08)
    return (
      shadow(cx, 70) +
      clipped(path(outer + hole, { 'clip-rule': 'evenodd' }), body) +
      path(hole, stroke(shade(c, 0.3), 2))
    )
  },

  // Lon thiếc thấp có khoen mở (cá hộp, thịt hộp)
  'lon-do-hop': () => {
    const cx = 128
    const c = '#D97706'
    const top = 112
    const bot = GROUND - 8
    const d = `M${cx - 62} ${top}L${cx + 62} ${top}L${cx + 62} ${bot}A62 8 0 0 1 ${cx - 62} ${bot}Z`
    let body = rect(0, 0, S, S, { fill: cyl('#CBD5E1', 0.25) })
    body += rect(0, top + 12, S, bot - top - 20, { fill: cyl(c) })
    for (const y of [top + 6, bot - 2]) body += rect(0, y, S, 2, { fill: '#94A3B8' })
    body += path(
      `M0 178C40 166 80 190 128 176S210 162 256 176L256 188C210 176 170 200 128 190S40 178 0 190Z`,
      {
        fill: '#FFFFFF',
      }
    )
    // Hình con cá đơn giản
    body += path(`M${cx - 18} 150Q${cx} 134 ${cx + 18} 150Q${cx} 166 ${cx - 18} 150Z`, {
      fill: '#FFFFFF',
    })
    body += path(`M${cx + 16} 150l12 -9l0 18Z`, { fill: '#FFFFFF' })
    body += circle(cx - 9, 148, 2, { fill: c })
    body += shine(cx - 56, top + 10, 7, 76, 0.45) + edge(cx + 46, top, 20, 120, 0.1)
    const lid =
      ellipse(cx, top, 62, 14, { fill: '#E2E8F0' }) +
      ellipse(cx, top + 1, 54, 11, { fill: '#94A3B8' }) +
      ellipse(cx, top + 0.5, 53, 10.4, { fill: '#CBD5E1' }) +
      ellipse(cx, top, 40, 7, stroke('#B6C2D1', 1.5)) +
      ellipse(cx - 20, top + 1, 14, 5, stroke('#64748B', 4)) +
      rect(cx - 10, top - 3, 14, 6, { rx: 3, fill: '#64748B' }) +
      circle(cx, top, 3, { fill: '#94A3B8' })
    return shadow(cx, 66) + clipped(path(d), body) + lid
  },

  // Túi nước giặt đứng có vòi ở góc
  'tui-nuoc-giat': () => {
    const cx = 128
    const c = '#4F46E5'
    const d = `M70 40L146 40L188 82L190 100C196 150 196 190 192 ${GROUND - 8}Q128 ${GROUND + 4} 64 ${GROUND - 8}C60 190 60 150 66 100Z`
    let body = rect(0, 0, S, S, { fill: cyl(c, 0.2) })
    body += path(`M0 168C60 150 120 186 256 160L256 256L0 256Z`, {
      fill: '#22D3EE',
      'fill-opacity': 0.9,
    })
    body += path(`M0 178C60 160 120 196 256 170L256 256L0 256Z`, { fill: '#06B6D4' })
    for (const [x, y, r] of [
      [100, 112, 16],
      [134, 96, 10],
      [150, 128, 13],
      [116, 144, 8],
      [86, 152, 6],
      [168, 106, 6],
    ]) {
      body += circle(x, y, r, { fill: '#FFFFFF', 'fill-opacity': 0.85 })
      body += circle(x - r * 0.35, y - r * 0.35, r * 0.25, { fill: '#FFFFFF' })
      body += circle(x, y, r, stroke('#C7D2FE', 1.2))
    }
    body += rect(0, 40, S, 12, { fill: shade(c, 0.15) })
    body += path(`M64 ${GROUND - 26}Q128 ${GROUND - 14} 192 ${GROUND - 26}`, stroke('#0E7490', 2.5))
    body += shine(74, 66, 7, 110, 0.4) + edge(178, 60, 20, 180, 0.1)
    // Vòi và nắp ở góc vát
    const spout = g(
      { transform: 'translate(167 61) rotate(45)' },
      rect(-9, -16, 18, 24, { fill: '#94A3B8' }) +
        rect(-12, -16, 24, 4, { rx: 2, fill: '#64748B' }) +
        rect(-14, -32, 28, 20, { rx: 4, fill: vGrad('#FFFFFF', '#CBD5E1') }) +
        rect(-14, -32, 28, 5, { rx: 2.5, fill: '#22D3EE' })
    )
    return shadow(cx, 66) + clipped(path(d), body) + spout
  },

  // Can nhựa có tay cầm, nắp ở góc
  'can-nhua': () => {
    const c = '#65A30D'
    const body0 = `M64 86Q64 70 80 70L176 70Q192 70 192 86L192 ${GROUND - 12}Q192 ${GROUND} 180 ${GROUND}L76 ${GROUND}Q64 ${GROUND} 64 ${GROUND - 12}Z`
    const handle = `M80 74L80 54Q80 36 98 36L136 36Q154 36 154 54L154 74ZM96 66L138 66L138 56Q138 50 132 50L102 50Q96 50 96 56Z`
    let fill = rect(0, 0, S, S, { fill: cyl(c, 0.2) })
    fill += rect(82, 108, 92, 92, { rx: 12, fill: tint(c, 0.25) })
    fill += rect(82, 108, 92, 92, { rx: 12, ...stroke(shade(c, 0.15), 2) })
    fill += path(`M128 128C142 148 146 158 146 166A18 18 0 0 1 110 166C110 158 114 148 128 128Z`, {
      fill: '#FFFFFF',
    })
    fill += ellipse(121, 165, 3, 6, { fill: tint(c, 0.4) })
    fill += shine(70, 90, 7, 110, 0.45) + edge(182, 60, 12, 200, 0.12)
    const handleShape = path(handle, { fill: cyl(c, 0.2), 'fill-rule': 'evenodd' })
    return (
      shadow(128, 68) +
      handleShape +
      clipped(path(body0), fill) +
      screwCap(160, 46, 26, 26, '#E2E8F0', 0.25)
    )
  },

  // Chai tẩy rửa có vòi xịt bóp cò
  'chai-tay-rua': () => {
    const cx = 132
    const c = '#06B6D4'
    const d = `M${cx - 18} 92L${cx + 18} 92L${cx + 20} 104C${cx + 40} 110 ${cx + 40} 128 ${cx + 36} 146C${cx + 32} 162 ${cx + 40} 176 ${cx + 40} 196L${cx + 40} ${GROUND - 10}Q${cx + 40} ${GROUND} ${cx + 28} ${GROUND}L${cx - 28} ${GROUND}Q${cx - 40} ${GROUND} ${cx - 40} ${GROUND - 10}L${cx - 40} 196C${cx - 40} 176 ${cx - 32} 162 ${cx - 36} 146C${cx - 40} 128 ${cx - 40} 110 ${cx - 20} 104Z`
    let body = rect(0, 0, S, S, { fill: '#CFFAFE' })
    body += rect(0, 112, S, S, { fill: cyl(c, 0.18) })
    body += path(
      `M${cx + 4} 96L${cx + 4} ${GROUND - 4}`,
      stroke('#FFFFFF', 2, { 'stroke-opacity': 0.6 })
    )
    body += rect(cx - 30, 170, 60, 40, { rx: 8, fill: '#FFFFFF', 'fill-opacity': 0.9 })
    const spark = (x, y, r) =>
      path(
        `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`,
        {
          fill: c,
        }
      )
    body += spark(cx - 6, 192, 12) + spark(cx + 12, 182, 6) + spark(cx + 14, 199, 4)
    body += shine(cx - 33, 116, 6, 40, 0.6) + shine(cx - 35, 180, 6, 30, 0.6)
    body += edge(cx + 28, 90, 16, 160, 0.1)
    const head = '#F1F5F9'
    const trigger =
      path(
        `M${cx - 20} 62Q${cx - 26} 84 ${cx - 36} 98Q${cx - 32} 104 ${cx - 26} 98Q${cx - 14} 84 ${cx - 10} 66Z`,
        {
          fill: '#CBD5E1',
        }
      ) +
      path(
        `M${cx - 28} 34L${cx + 26} 34Q${cx + 34} 34 ${cx + 34} 44L${cx + 30} 70L${cx + 16} 84L${cx - 16} 84L${cx - 20} 56L${cx - 42} 56Q${cx - 50} 56 ${cx - 50} 48L${cx - 50} 44Q${cx - 50} 34 ${cx - 40} 34Z`,
        {
          fill: vGrad('#FFFFFF', '#CBD5E1'),
        }
      ) +
      rect(cx - 58, 39, 10, 12, { rx: 3, fill: c }) +
      rect(cx - 20, 82, 40, 12, { rx: 3, fill: vGrad(head, '#94A3B8') })
    return shadow(cx, 44) + clipped(path(d), body) + trigger
  },

  // Chai dầu gội, sữa tắm có vòi nhấn
  'chai-dau-goi': () => {
    const cx = 124
    const c = '#EC4899'
    const d = `M${cx - 20} 96L${cx + 20} 96Q${cx + 46} 100 ${cx + 46} 128L${cx + 46} ${GROUND - 18}Q${cx + 46} ${GROUND} ${cx + 28} ${GROUND}L${cx - 28} ${GROUND}Q${cx - 46} ${GROUND} ${cx - 46} ${GROUND - 18}L${cx - 46} 128Q${cx - 46} 100 ${cx - 20} 96Z`
    let body = rect(0, 0, S, S, { fill: cyl(c, 0.2) })
    body += rect(cx - 30, 134, 60, 64, { rx: 12, fill: '#FFFFFF', 'fill-opacity': 0.92 })
    for (const [x, y, r] of [
      [-8, 160, 9],
      [8, 166, 7],
      [0, 176, 6],
    ])
      body += circle(cx + x, y, r, { fill: tint(c, 0.35) })
    body += path(`M${cx - 6} 186q6 -12 0 -24`, stroke('#16A34A', 2))
    body += shine(cx - 38, 112, 7, 90, 0.45) + edge(cx + 34, 90, 16, 150, 0.12)
    const pump =
      rect(cx - 5, 50, 10, 34, { fill: vGrad('#F1F5F9', '#CBD5E1') }) +
      path(
        `M${cx - 20} 40L${cx + 16} 40L${cx + 52} 44Q${cx + 58} 46 ${cx + 56} 52L${cx + 16} 54L${cx - 20} 54Q${cx - 24} 54 ${cx - 24} 50L${cx - 24} 44Q${cx - 24} 40 ${cx - 20} 40Z`,
        {
          fill: vGrad('#FFFFFF', '#CBD5E1'),
        }
      ) +
      rect(cx - 22, 80, 44, 20, { rx: 5, fill: cyl('#F8FAFC', 0.25) }) +
      rect(cx - 22, 88, 44, 2, { fill: '#CBD5E1' })
    return shadow(cx, 52) + clipped(path(d), body) + pump
  },

  // Tuýp kem nằm ngang: đuôi hàn phẳng bên trái, nắp bên phải
  'tuyp-kem': () => {
    const c = '#2563EB'
    const mid = 136
    const d = `M28 ${mid - 40}L46 ${mid - 40}C110 ${mid - 38} 160 ${mid - 28} 194 ${mid - 18}L194 ${mid + 18}C160 ${mid + 28} 110 ${mid + 38} 46 ${mid + 40}L28 ${mid + 40}Z`
    let body = rect(0, 0, S, S, { fill: vGrad('#FFFFFF', '#CBD5E1') })
    body += path(`M0 ${mid + 4}C70 ${mid - 20} 140 ${mid + 14} 256 ${mid - 8}L256 256L0 256Z`, {
      fill: vGrad(c, shade(c, 0.2)),
    })
    body += path(
      `M0 ${mid - 4}C70 ${mid - 28} 140 ${mid + 6} 256 ${mid - 16}`,
      stroke('#EF4444', 5)
    )
    body +=
      circle(96, mid - 14, 12, { fill: '#7DD3FC' }) + circle(92, mid - 18, 4, { fill: '#FFFFFF' })
    body += rect(28, 0, 18, S, { fill: '#E2E8F0' })
    for (const i of range(9))
      body += rect(30 + i * 2, 0, 0.8, S, { fill: '#94A3B8', 'fill-opacity': 0.6 })
    body += rect(50, mid - 32, 130, 6, { rx: 3, fill: '#FFFFFF', 'fill-opacity': 0.8 })
    const cap =
      rect(194, mid - 22, 10, 44, { rx: 2, fill: vGrad(tint(c, 0.15), shade(c, 0.2)) }) +
      rect(204, mid - 18, 26, 36, { rx: 4, fill: vGrad(tint(c, 0.2), shade(c, 0.25)) }) +
      range(5)
        .map((i) =>
          rect(208 + i * 5, mid - 16, 1.4, 32, { fill: shade(c, 0.35), 'fill-opacity': 0.5 })
        )
        .join('')
    return shadow(128, 104, mid + 48, 8, 0.22) + clipped(path(d), body) + cap
  },

  // Lốc 6 cuộn giấy bọc màng, dải màng xanh
  'cuon-giay': () => {
    const rw = 24
    const rh = 92
    const roll = (cx, bot) => {
      const t = bot - rh
      let o = rect(cx - rw, t, rw * 2, rh, { fill: whiteCyl() })
      o += ellipse(cx, bot, rw, 8, { fill: '#CBD5E1' })
      o += rect(cx - rw, t, rw * 2, rh, { fill: 'none' })
      o += ellipse(cx, t, rw, 8, { fill: '#FFFFFF', stroke: '#CBD5E1', 'stroke-width': 1.5 })
      o +=
        ellipse(cx, t, 8, 3.2, { fill: '#D6B48A' }) +
        ellipse(cx, t + 0.6, 5.5, 2, { fill: '#A8835A' })
      return o
    }
    const band = (cx, bot) =>
      rect(cx - rw, bot - 58, rw * 2, 30, { fill: cyl('#38BDF8', 0.2) }) +
      path(`M${cx - 14} ${bot - 43}q7 -7 14 0t14 0`, stroke('#FFFFFF', 2.5))
    let out = shadow(132, 84)
    for (const x of [94, 142, 190]) out += roll(x, GROUND - 22)
    for (const x of [74, 122, 170]) out += roll(x, GROUND - 6) + band(x, GROUND - 6)
    // Màng co
    out += path(
      `M50 ${GROUND - 70}L194 ${GROUND - 70}`,
      stroke('#FFFFFF', 2, { 'stroke-opacity': 0.8 })
    )
    return out
  },

  // Hộp khăn giấy rút: hộp nằm, khăn bung lên khỏi miệng
  'goi-khan-giay': () => {
    const c = '#A78BFA'
    const [x, y, w, h, dx, dy] = [46, 140, 128, GROUND - 140, 36, -28]
    let out = shadow(140, 84)
    out += box(x, y, w, h, dx, dy, c)
    // Miệng hộp trên mặt trên
    const m = `matrix(1 0 ${dx / 1} ${dy / 1} ${x} ${y})`
    out += g({ transform: m }, ellipse(w / 2, 0.5, 36, 0.2, { fill: shade(c, 0.45) }))
    // Khăn giấy
    const [ox, oy] = [x + w / 2 + dx / 2, y + dy / 2]
    out += path(
      `M${ox - 30} ${oy + 2}C${ox - 26} ${oy - 30} ${ox - 18} ${oy - 52} ${ox - 6} ${oy - 70}C${ox + 6} ${oy - 56} ${ox + 18} ${oy - 64} ${ox + 22} ${oy - 50}C${ox + 22} ${oy - 30} ${ox + 32} ${oy - 18} ${ox + 34} ${oy - 2}Z`,
      {
        fill: vGrad('#FFFFFF', '#E2E8F0'),
        stroke: '#CBD5E1',
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
      }
    )
    out += path(
      `M${ox - 6} ${oy - 70}C${ox - 4} ${oy - 44} ${ox + 2} ${oy - 24} ${ox + 6} ${oy - 4}`,
      stroke('#E2E8F0', 2)
    )
    // Họa tiết trên mặt trước
    for (const [px, py, r] of [
      [x + 26, y + 30, 12],
      [x + 52, y + 50, 8],
      [x + 96, y + 34, 10],
    ]) {
      for (const a of range(5)) {
        const rad = (a * 72 * Math.PI) / 180
        out += circle(px + Math.cos(rad) * r * 0.6, py + Math.sin(rad) * r * 0.6, r * 0.5, {
          fill: '#FFFFFF',
          'fill-opacity': 0.7,
        })
      }
      out += circle(px, py, r * 0.3, { fill: '#FDE68A' })
    }
    out += rect(x, y + h - 10, w, 4, { fill: shade(c, 0.15) })
    return out
  },

  // Vỉ treo bìa cứng có màng, đựng pin
  'vi-do-dung': () => {
    const c = '#2563EB'
    const card = `M74 28L182 28Q192 28 192 38L192 ${GROUND - 10}Q192 ${GROUND} 182 ${GROUND}L74 ${GROUND}Q64 ${GROUND} 64 ${GROUND - 10}L64 38Q64 28 74 28Z`
    const hole = `M116 38L140 38Q146 38 146 44Q146 50 140 50L116 50Q110 50 110 44Q110 38 116 38Z`
    let out = shadow(128, 64)
    out += path(card + hole, { fill: vGrad(tint(c, 0.08), shade(c, 0.12)), 'fill-rule': 'evenodd' })
    out += path(
      `M64 ${GROUND - 34}L192 ${GROUND - 50}L192 ${GROUND - 10}Q192 ${GROUND} 182 ${GROUND}L74 ${GROUND}Q64 ${GROUND} 64 ${GROUND - 10}Z`,
      {
        fill: '#FACC15',
      }
    )
    // Pin bên trong
    for (const i of range(4)) {
      const bx = 84 + i * 23
      out += rect(bx + 6, 72, 6, 5, { rx: 1.5, fill: '#CBD5E1' })
      out += rect(bx, 76, 18, 120, { rx: 3, fill: cyl('#1F2937', 0.3) })
      out += rect(bx, 76, 18, 40, { rx: 3, fill: cyl('#D97706', 0.25) })
      out += rect(bx, 112, 18, 4, { fill: '#1F2937' })
      out += rect(bx + 3, 80, 3, 110, { rx: 1.5, fill: '#FFFFFF', 'fill-opacity': 0.35 })
    }
    // Màng nhựa vỉ
    out += rect(78, 64, 100, 140, {
      rx: 14,
      fill: '#FFFFFF',
      'fill-opacity': 0.18,
      stroke: '#FFFFFF',
      'stroke-width': 2.5,
      'stroke-opacity': 0.85,
    })
    out += path(`M88 74L88 120`, stroke('#FFFFFF', 4, { 'stroke-opacity': 0.75 }))
    out += path(`M88 130L88 140`, stroke('#FFFFFF', 4, { 'stroke-opacity': 0.75 }))
    return out
  },
}

// ============================================================ Dựng và xuất
function renderKind(key) {
  defs = []
  uid = 0
  const body = KINDS[key]()
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${defs.join('')}</defs>${body}</svg>`
}

async function encodeWebp(svg) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  for (let q = 90; q >= 50; q -= 5) {
    const buf = await sharp(png)
      .webp({ quality: q, alphaQuality: 90, effort: 6, smartSubsample: true })
      .toBuffer()
    if (buf.length <= MAX_BYTES) return { buf, q, png }
  }
  throw new Error('Ảnh vượt 15 KB ở mọi mức chất lượng')
}

// Lưới xem nhanh: mỗi ô có tên kiểu, nền xám nhạt để thấy bóng và mép trắng
async function writeGrid(items) {
  const cols = 5
  const cell = 280
  const rows = Math.ceil(items.length / cols)
  const layers = []
  items.forEach(({ key, png }, i) => {
    const x = (i % cols) * cell
    const y = Math.floor(i / cols) * cell
    layers.push({ input: png, left: x + 12, top: y + 4 })
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="22"><text x="${cell / 2}" y="16" font-family="Segoe UI, Arial" font-size="14" text-anchor="middle" fill="#334155">${esc(key)}</text></svg>`
    layers.push({ input: Buffer.from(label), left: x, top: y + 256 })
  })
  await sharp({
    create: { width: cols * cell, height: rows * cell, channels: 4, background: '#F1F5F9' },
  })
    .composite(layers)
    .png()
    .toFile(join(PREVIEW, '_grid.png'))
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  const kinds = data.imageKinds ?? []
  const missing = kinds.filter((k) => !KINDS[k.key]).map((k) => k.key)
  if (missing.length) throw new Error(`Chưa có khuôn vẽ cho kiểu: ${missing.join(', ')}`)
  const keys = new Set(kinds.map((k) => k.key))
  const orphan = [...new Set((data.products ?? []).map((p) => p.image))].filter(
    (k) => k && !keys.has(k)
  )
  if (orphan.length)
    throw new Error(`Mặt hàng trỏ tới kiểu ảnh không có trong imageKinds: ${orphan.join(', ')}`)
  mkdirSync(OUT_DIR, { recursive: true })
  if (PREVIEW) mkdirSync(PREVIEW, { recursive: true })
  const sizes = []
  const previews = []
  for (const kind of kinds) {
    if (ONLY && !kind.key.includes(ONLY)) continue
    const { buf, q, png } = await encodeWebp(renderKind(kind.key))
    writeFileSync(join(OUT_DIR, `${kind.key}.webp`), buf)
    if (PREVIEW) {
      writeFileSync(join(PREVIEW, `${kind.key}.png`), png)
      previews.push({ key: kind.key, png })
    }
    sizes.push(buf.length)
    console.log(
      `${(kind.key + '.webp').padEnd(22)} ${kind.name.padEnd(18)} ${(buf.length / 1024).toFixed(1).padStart(5)} KB  q${q}`
    )
  }
  if (PREVIEW && previews.length) await writeGrid(previews)
  const max = Math.max(...sizes) / 1024
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024
  console.log(
    `Đã tạo ${sizes.length} ảnh · lớn nhất ${max.toFixed(1)} KB · trung bình ${avg.toFixed(1)} KB`
  )
}

await main()
