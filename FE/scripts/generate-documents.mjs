#!/usr/bin/env node
/**
 * Sinh chứng từ mẫu 90 ngày cho demo Quản lý Kho: `pnpm seed:documents`.
 *
 * Đọc phần viết tay của src/mock/seed/demo-data.json (warehouses, suppliers, productGroups, products, recipients),
 * mô phỏng nhập, xuất, chuyển kho, kiểm kê theo thời gian, rồi ghi đè 4 mảng `receipts`, `issues`, `transfers`,
 * `stocktakes`. Hạt giống cố định: chạy lại ra đúng file cũ.
 *
 * Định dạng khóa gọn, cách nạp (replay) và số đối chiếu: docs/06-THIET-KE-CSDL.md §5. Hàm `replay()` cuối file là
 * thuật toán tham chiếu: FE mock (features/inventory) và BE DemoDataSeeder phải ra đúng các số script in ra.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../src/mock/seed/demo-data.json', import.meta.url)
const data = JSON.parse(readFileSync(FILE, 'utf8'))

// ───────────────────────────── Ngẫu nhiên xác định ─────────────────────────────
let seed = 20261015
function rand() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1))
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
function weightedPick(items, weightOf) {
  const total = items.reduce((s, x) => s + weightOf(x), 0)
  let r = rand() * total
  for (const x of items) {
    r -= weightOf(x)
    if (r <= 0) return x
  }
  return items[items.length - 1]
}
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ───────────────────────────── Quy tắc tính (07 §3) ─────────────────────────────
/** Làm tròn tới 1 ₫, từ 0,5 làm tròn lên (BR-09) */
const roundVnd = (x) => Math.floor(x + 0.5)

/** BR-08: phân bổ chi phí theo thành tiền; dòng cuối nhận phần còn lại; tổng thành tiền 0 thì theo số lượng quy đổi */
function allocateFreight(amounts, baseQtys, freight) {
  if (!freight) return amounts.map(() => 0)
  const useQty = amounts.reduce((s, a) => s + a, 0) === 0
  const weights = useQty ? baseQtys : amounts
  const total = weights.reduce((s, a) => s + a, 0)
  const out = []
  let used = 0
  weights.forEach((w, i) => {
    if (i === weights.length - 1) out.push(freight - used)
    else {
      const a = roundVnd((freight * w) / total)
      out.push(a)
      used += a
    }
  })
  return out
}

/** Sổ tồn theo (kho, hàng): q tồn thực, v giá trị tồn, c giá vốn bình quân */
class Book {
  constructor() {
    this.s = new Map()
  }
  get(w, p) {
    const k = w + '|' + p
    if (!this.s.has(k)) this.s.set(k, { q: 0, v: 0, c: 0, lastIssue: null, firstIn: null })
    return this.s.get(k)
  }
  /** Nhập (BR-09): giá vốn mới = (v + giá trị nhập) ÷ (q + số lượng) */
  in(w, p, q, value, at) {
    const st = this.get(w, p)
    st.c = roundVnd((st.v + value) / (st.q + q))
    st.q += q
    st.v += value
    if (st.firstIn === null) st.firstIn = at
    return { unitCost: st.c, value, balanceQ: st.q, balanceV: st.v, cost: st.c }
  }
  /** Xuất (BR-10): q × giá vốn; xuất hết thì bằng đúng giá trị còn lại */
  out(w, p, q, at, countsAsIssue) {
    const st = this.get(w, p)
    if (q > st.q) throw new Error(`Âm kho ${p} tại ${w}: cần ${q}, còn ${st.q}`)
    const value = q === st.q ? st.v : q * st.c
    st.q -= q
    st.v -= value
    if (countsAsIssue) st.lastIssue = at
    return { unitCost: st.c, value, balanceQ: st.q, balanceV: st.v, cost: st.c }
  }
  /** Điều chỉnh kiểm kê (BR-17): giữ giá vốn; về 0 thì giá trị về 0 */
  adjust(w, p, diff, bookCost) {
    const st = this.get(w, p)
    let value
    if (diff >= 0) value = diff * bookCost
    else value = st.q + diff === 0 ? st.v : -diff * bookCost
    if (diff >= 0) {
      st.q += diff
      st.v += value
    } else {
      st.q += diff
      st.v -= value
    }
    if (st.q < 0) throw new Error('Kiểm kê âm ' + p)
    return value
  }
}

// ───────────────────────────── Danh mục ─────────────────────────────
const products = new Map(data.products.map((p) => [p.code, p]))
const factors = (p) => [1, ...p.units.map((u) => u[1])]
const largest = (p) => (p.units.length ? p.units[p.units.length - 1][1] : 1)
const WH = ['KTONG', 'KTD', 'KBH']
const keeper = { KTONG: 'nhanvien', KTD: 'nhanvien', KBH: 'thukho.bh' }
const carried = (w) => data.products.filter((p) => p.stock[w]).map((p) => p.code)

/** Giá vốn đích của mặt hàng trong kịch bản kiểm thử (05 §1); mọi lần nhập dùng đúng giá này, không chi phí mua hàng */
const KEY = {
  'NTL-330': { KTONG: [2400, 7200], KTD: [90, 7300], KBH: [360, 7250] },
  'DAU-1L': { KTONG: [600, 52000], KTD: [240, 52000] },
  'NMAM-750': { KTD: [120, 33000] },
  'NGIAT-37': { KTONG: [200, 189000] },
  'NRC-36': { KBH: [48, 85000] },
}
const isKey = (code) => code in KEY

/** Ngưỡng dùng để mô phỏng đặt hàng; ô trống thì lấy mặc định theo thùng */
function simLevels(p, w) {
  const [mn, mx] = p.stock[w]
  const f = largest(p)
  return [mn ?? 3 * f, mx ?? 15 * f]
}

// Hàng chậm luân chuyển (BR-22): ngừng bán từ `stopAgo` ngày trước (Infinity = chưa từng bán)
const SLOW = {
  KTONG: {
    'SIRO-DAU-700': Infinity,
    'BO-200': Infinity,
    'DEN-LED-9W': 75,
    'NEN-100': 66,
    'TUIZIP-30': 52,
    'MUONG-100': 41,
    'SAPTHOM-200': 38,
    'BTT-120': 33,
  },
  KTD: { 'NK-350': 70, 'DCR-3': 44 },
  KBH: { 'NE-TAO-1L': Infinity, 'TDN-1L': 61, 'GLB-2': 35 },
}
const isSlow = (w, code, d) => {
  const s = SLOW[w][code]
  return s !== undefined && d <= s
}
// Hàng bán hết cuối kỳ (Hết hàng)
const SELL_OUT = { KTONG: ['MI-CHAY-65', 'BX-VANI-160'], KTD: ['PHO-GA-65'] }
// Hàng xuống dưới tối thiểu cuối kỳ: ngày 3 có đơn lớn kéo tồn về khoảng 60–90% mức tối thiểu
const LOW_END = {
  KTONG: ['TX-450', 'SUA-TT-180', 'BNGOT-454', 'DUONG-1KG', 'CANUC-155'],
  KTD: ['SDN-200', 'NRC-750', 'GVS-10'],
  KBH: ['NTUONG-500', 'BGIAT-3', 'KDR-180'],
}
// Hàng nhập dư cuối kỳ (Vượt tối đa)
const OVERSTOCK = {
  KTONG: ['NE-DAO-1L', 'KCUNG-400', 'TCHH-565', 'DXA-320', 'YMACH-500', 'NUI-400'],
  KBH: ['BQM-200'],
}
// Không có trong chứng từ chưa kết thúc (giữ số liệu test sạch)
const PENDING_EXCLUDE = new Set(Object.keys(KEY))

// ───────────────────────────── Thời gian ─────────────────────────────
const usedPost = new Set()
const hhmm = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const tok = (d, m) => `${d}@${hhmm(m)}`
/** Phút ghi sổ chưa dùng trong ngày d (mọi thời điểm ghi sổ của toàn bộ dữ liệu khác nhau) */
function postSlot(d, from, to) {
  for (let i = 0; i < 400; i++) {
    const m = ri(from, to)
    if (!usedPost.has(d + ':' + m)) {
      usedPost.add(d + ':' + m)
      return m
    }
  }
  throw new Error('Hết phút trống ngày ' + d)
}

// ───────────────────────────── Kết quả ─────────────────────────────
const receipts = []
const issues = []
const transfers = []
const stocktakes = []
let rSeq = 0
let iSeq = 0
let tSeq = 0
let invNo = 3150
let orderNo = 10120

const book = new Book()
const tasks = [] // { d, m, kind, run }
const lastDelivery = new Map() // wh|ncc → d
const plannedDelivery = new Map() // wh|ncc → { d, codes:Set }
const plannedTransfer = new Map() // wh → { d, codes:Set }
const lastTransfer = new Map() // wh → d
const lastSold = new Map() // wh|code → d

const recipientsOf = (w) => data.recipients.filter((r) => r.warehouse === w).map((r) => r.name)
const drivers = [
  'Nguyễn Văn Tài',
  'Trần Minh Đức',
  'Lê Văn Hậu',
  'Phạm Quốc Bảo',
  'Huỳnh Tấn Phát',
  'Võ Văn Lâm',
  'Đặng Hữu Nghĩa',
]
const rejectReasons = [
  'Sai đơn giá so với hóa đơn, kiểm tra lại',
  'Đại lý đổi số lượng đặt hàng, sửa lại phiếu',
  'Thiếu số hóa đơn của nhà cung cấp',
  'Nhập nhầm đơn vị tính, sửa lại theo thùng',
]

/** Chọn đơn vị và số lượng cho số lượng quy đổi q: chia hết thùng lớn → thùng, chia hết đơn vị nhỏ → đơn vị đó, còn lại lẻ */
function asLine(p, q) {
  const fs = factors(p)
  for (let i = fs.length - 1; i >= 1; i--) if (q % fs[i] === 0) return [i, q / fs[i]]
  return [0, q]
}

/** Giá nhập một đơn vị cơ bản: giá tham chiếu dao động theo nhà cung cấp và thời gian; hàng kịch bản dùng giá đích */
function baseCost(p, w, d) {
  if (KEY[p.code]?.[w]) return KEY[p.code][w][1]
  const wave = Math.sin((d + p.code.length * 7) / 13) * 0.025
  return p.refCost * (1 + wave)
}
function unitPriceFor(p, w, d, unitIdx) {
  const f = factors(p)[unitIdx]
  if (KEY[p.code]?.[w]) return KEY[p.code][w][1] * f
  return Math.round((baseCost(p, w, d) * f) / 100) * 100
}

// Duyệt: quản lý duyệt phiếu của thủ kho; phiếu do quản lý lập thì quản trị viên duyệt (BR-06)
const approverFor = (by) => (by === 'quanly' ? 'admin' : 'quanly')

function lifecycle(d, apMin, by, rejectChance = 0.02) {
  const doc = { by }
  const lead = ri(15, 70)
  const sb = Math.max(7 * 60 + 30, apMin - lead)
  doc.cr = tok(d, Math.max(7 * 60, sb - ri(5, 45)))
  if (rand() < rejectChance && sb - 200 > 7 * 60 + 40) {
    const first = sb - 200
    doc.cr = tok(d, first - ri(5, 30))
    doc.sb = tok(d, first)
    doc.rj = [tok(d, first + ri(20, 60)), approverFor(by), pick(rejectReasons)]
    doc.sb2 = tok(d, sb)
  } else doc.sb = tok(d, sb)
  doc.ap = [tok(d, apMin), approverFor(by)]
  return doc
}

// ───────────────────────────── Tạo chứng từ ghi sổ ─────────────────────────────
function makeReceipt(d, m, w, type, opts) {
  const lines = opts.lines // [code, unitIdx, qty, price]
  const at = d * 10000 - m
  const doc = { id: 'R' + String(++rSeq).padStart(3, '0'), w, t: type }
  if (opts.s) doc.s = opts.s
  if (type === 'MuaHang') {
    doc.inv = [String(invNo++).padStart(7, '0'), d + (rand() < 0.3 ? 1 : 0)]
    doc.dl = pick(drivers)
  }
  if (opts.dl) doc.dl = opts.dl
  const hasKey = lines.some((l) => isKey(l[0]))
  const freight = hasKey ? 0 : (opts.f ?? 0)
  if (freight) doc.f = freight
  if (opts.nt) doc.nt = opts.nt
  if (opts.rv) doc.rv = opts.rv
  Object.assign(doc, lifecycle(d, m, opts.by ?? keeper[w], opts.noReject ? 0 : 0.025))
  doc.ln = lines
  // ghi sổ
  const amounts = lines.map(([, , qty, price]) => qty * price)
  const baseQ = lines.map(([c, u, qty]) => qty * factors(products.get(c))[u])
  const alloc = allocateFreight(amounts, baseQ, freight)
  lines.forEach(([c], i) => book.in(w, c, baseQ[i], amounts[i] + alloc[i], at))
  receipts.push(doc)
  return doc
}

function makeIssue(d, m, w, type, opts) {
  const at = d * 10000 - m
  const doc = { id: 'I' + String(++iSeq).padStart(3, '0'), w, t: type }
  if (opts.rc) doc.rc = opts.rc
  if (opts.s) doc.s = opts.s
  if (opts.or) doc.or = opts.or
  if (opts.why) doc.why = opts.why
  if (opts.rv) doc.rv = opts.rv
  Object.assign(doc, lifecycle(d, m, opts.by ?? keeper[w], opts.noReject ? 0 : 0.02))
  doc.ln = opts.lines // [code, unitIdx, qty]
  const counts = type === 'XuatBan' || type === 'DungNoiBo'
  const costs = []
  for (const [c, u, qty] of doc.ln) {
    const r = book.out(w, c, qty * factors(products.get(c))[u], at, counts)
    costs.push(r.unitCost)
  }
  issues.push(doc)
  return { doc, costs }
}

function makeTransfer(d, m, fw, tw, lines, opts = {}) {
  const at = d * 10000 - m
  const doc = { id: 'T' + String(++tSeq).padStart(3, '0'), fw, tw }
  Object.assign(doc, lifecycle(d, m, opts.by ?? keeper[fw], 0.02))
  doc.ln = lines
  const sent = []
  for (const [c, u, qty] of lines) {
    const q = qty * factors(products.get(c))[u]
    const r = book.out(fw, c, q, at, true)
    sent.push({ c, q, cost: r.unitCost })
  }
  transfers.push(doc)
  return { doc, sent }
}

function receiveTransfer(doc, sent, d, m, shortages = []) {
  const at = d * 10000 - m
  doc.re = [tok(d, m), keeper[doc.tw]]
  if (shortages.length) doc.re.push(shortages)
  sent.forEach((s, i) => {
    const short = shortages.find((x) => x[0] === i)
    const got = s.q - (short ? short[1] : 0)
    if (got > 0) book.in(doc.tw, s.c, got, got * s.cost, at)
  })
}

// ───────────────────────────── Kế hoạch theo ngày ─────────────────────────────
function schedule(d, m, run) {
  tasks.push({ d, m, run })
}

function openingStock(d, w) {
  const bySupplier = new Map()
  for (const code of carried(w)) {
    const p = products.get(code)
    if (code === 'NRC-36') continue
    if (!bySupplier.has(p.supplier)) bySupplier.set(p.supplier, [])
    bySupplier.get(p.supplier).push(p)
  }
  for (const [ncc, ps] of bySupplier) {
    const m = postSlot(d, 8 * 60, 16 * 60 + 30)
    schedule(d, m, () => {
      const lines = ps.map((p) => {
        const [, mx] = simLevels(p, w)
        const f = largest(p)
        const q = Math.max(f, Math.floor((mx * (0.6 + rand() * 0.25)) / f) * f)
        const [u, qty] = asLine(p, q)
        return [p.code, u, qty, unitPriceFor(p, w, d, u)]
      })
      const amount = lines.reduce((s, l) => s + l[2] * l[3], 0)
      makeReceipt(d, m, w, 'MuaHang', {
        s: ncc,
        lines,
        f: rand() < 0.5 ? Math.round((amount * 0.006) / 10000) * 10000 : 0,
        noReject: true,
      })
      lastDelivery.set(w + '|' + ncc, d)
    })
  }
}

function salesIssue(d, w) {
  const m = postSlot(d, 8 * 60 + 30, 16 * 60 + 40)
  schedule(d, m, () => {
    const candidates = carried(w).filter((c) => {
      const p = products.get(c)
      return (
        c !== 'NRC-36' &&
        !isSlow(w, c, d) &&
        book.get(w, c).q > 0 &&
        !(SELL_OUT[w]?.includes(c) && d <= 3 && p)
      )
    })
    if (!candidates.length) return
    const n = Math.min(candidates.length, w === 'KTONG' ? ri(4, 10) : ri(3, 7))
    const chosen = new Set()
    // trọng số theo nhóm bán chạy, tăng dần theo số ngày chưa bán để hàng nào cũng có lúc ra kho
    const weight = (c) =>
      ({ A: 5, B: 3, C: 1.5 })[products.get(c).tier] *
      (1 + ((lastSold.get(w + '|' + c) ?? 99) - d) / 6)
    while (chosen.size < n)
      chosen.add(
        weightedPick(
          candidates.filter((c) => !chosen.has(c)),
          weight
        )
      )
    const lines = []
    for (const c of chosen) {
      const p = products.get(c)
      const st = book.get(w, c)
      const f = largest(p)
      const scale = w === 'KTONG' ? 1 : 0.6
      const cartons = Math.max(
        1,
        Math.round({ A: ri(1, 6), B: ri(1, 3), C: ri(1, 2) }[p.tier] * scale)
      )
      let q = rand() < 0.2 && f > 1 ? ri(1, f - 1) + (rand() < 0.5 ? f : 0) : cartons * f
      if (q > st.q) q = st.q
      if (q <= 0) continue
      const [u, qty] = asLine(p, q)
      lines.push([c, u, qty])
      lastSold.set(w + '|' + c, d)
    }
    if (!lines.length) return
    makeIssue(d, m, w, 'XuatBan', { rc: pick(recipientsOf(w)), or: 'DH' + orderNo++, lines })
  })
}

/** Cuối ngày: hàng chạm điểm đặt hàng → giao hàng NCC 1–2 ngày sau, hoặc chuyển từ kho tổng */
function planReplenishment(d) {
  for (const w of WH) {
    for (const code of carried(w)) {
      if (code === 'NRC-36' || isSlow(w, code, d)) continue
      if (d <= 9 && SELL_OUT[w]?.includes(code)) continue
      if (d <= (w === 'KTONG' ? 3 : 7)) continue // những ngày cuối không đặt thêm: có hàng dưới tối thiểu để demo
      const p = products.get(code)
      const st = book.get(w, code)
      const [mn, mx] = simLevels(p, w)
      if (st.q > mn + (mx - mn) * (w === 'KTONG' ? 0.3 : 0.4)) continue
      const viaTransfer =
        w !== 'KTONG' &&
        !isKey(code) &&
        book.get('KTONG', code).q - largest(p) >= simLevels(p, 'KTONG')[0]
      if (viaTransfer) {
        if (!plannedTransfer.has(w)) {
          const due = Math.min(d - 1, (lastTransfer.get(w) ?? 99) - 4)
          if (due < 1) continue
          plannedTransfer.set(w, { d: due, codes: new Set() })
        }
        plannedTransfer.get(w).codes.add(code)
      } else {
        const key = w + '|' + p.supplier
        const gap = w === 'KTONG' ? 4 : 6
        if (plannedDelivery.has(key)) {
          plannedDelivery.get(key).codes.add(code)
          continue
        }
        const last = lastDelivery.get(key) ?? 99
        const due = Math.min(d - ri(1, 2), last - gap)
        if (due < 1) continue
        plannedDelivery.set(key, { d: due, codes: new Set([code]) })
      }
    }
  }
}

function runPlanned(d) {
  for (const [key, plan] of [...plannedDelivery]) if (plan.d > d) plannedDelivery.delete(key)
  for (const [w, plan] of [...plannedTransfer]) if (plan.d > d) plannedTransfer.delete(w)
  for (const [key, plan] of [...plannedDelivery]) {
    if (plan.d !== d) continue
    plannedDelivery.delete(key)
    const [w, ncc] = key.split('|')
    const m = postSlot(d, 8 * 60 + 15, 15 * 60 + 30)
    schedule(d, m, () => {
      // gom thêm hàng cùng NCC đang thấp
      for (const code of carried(w)) {
        const p = products.get(code)
        if (p.supplier !== ncc || code === 'NRC-36' || isSlow(w, code, d)) continue
        if (d <= 9 && SELL_OUT[w]?.includes(code)) continue
        const [mn, mx] = simLevels(p, w)
        if (book.get(w, code).q <= mn + (mx - mn) * 0.45) plan.codes.add(code)
      }
      const lines = []
      for (const code of plan.codes) {
        const p = products.get(code)
        const [, mx] = simLevels(p, w)
        const f = largest(p)
        const q = Math.floor((mx - book.get(w, code).q) / f) * f
        if (q < f) continue
        const [u, qty] = asLine(p, q)
        lines.push([code, u, qty, unitPriceFor(p, w, d, u)])
      }
      if (!lines.length) return
      const amount = lines.reduce((s, l) => s + l[2] * l[3], 0)
      const f =
        rand() < 0.45
          ? Math.max(150000, Math.round((amount * (0.004 + rand() * 0.008)) / 10000) * 10000)
          : 0
      makeReceipt(d, m, w, 'MuaHang', { s: ncc, lines, f })
      lastDelivery.set(key, d)
    })
  }
  for (const [w, plan] of [...plannedTransfer]) {
    if (plan.d !== d) continue
    plannedTransfer.delete(w)
    lastTransfer.set(w, d)
    const m = postSlot(d, 9 * 60, 11 * 60)
    schedule(d, m, () => {
      const lines = []
      for (const code of plan.codes) {
        const p = products.get(code)
        const [, mx] = simLevels(p, w)
        const f = largest(p)
        let q = Math.floor((mx - book.get(w, code).q) / f) * f
        const spare = book.get('KTONG', code).q - simLevels(p, 'KTONG')[0]
        q = Math.min(q, Math.floor(spare / f) * f)
        if (q < f) continue
        const [u, qty] = asLine(p, q)
        lines.push([code, u, qty])
      }
      if (!lines.length) return
      const { doc, sent } = makeTransfer(d, m, 'KTONG', w, lines)
      const rm = postSlot(d, 14 * 60, 16 * 60 + 30)
      schedule(d, rm, () => {
        const short = rand() < 0.12 ? [[ri(0, sent.length - 1), 0]] : []
        if (short.length) short[0][1] = Math.min(sent[short[0][0]].q, ri(1, 3))
        receiveTransfer(doc, sent, d, rm, short)
      })
    })
  }
}

// ───────────────────────────── Chứng từ riêng theo ngày ─────────────────────────────
function linesOf(w, codes, d, fn) {
  return codes
    .filter((c) => products.get(c).stock[w])
    .map((c) => fn(products.get(c), book.get(w, c)))
    .filter(Boolean)
}

const specials = {
  80: () =>
    internalUse(
      'KTONG',
      ['NS-500', 'KGR-180', 'CF-3IN1-18'],
      'Dùng cho văn phòng và công nhân bốc xếp kho tổng'
    ),
  58: () => internalUse('KTD', ['NS-500', 'KGR-180'], 'Nước uống, khăn giấy cho tổ bốc xếp'),
  36: () => internalUse('KTONG', ['NS-15', 'GVS-10', 'NRC-750'], 'Dùng cho văn phòng kho tổng'),
  14: () => internalUse('KBH', ['NS-500', 'KGAN-100'], 'Nước uống cho tài xế giao hàng'),
  72: () => scrap('KTONG', ['BGAO-180', 'SN-TOM-40'], 'Hàng móp méo, rách bao bì khi bốc xếp'),
  51: () => scrap('KTD', ['SCU-85', 'SUA-DAU-180'], 'Hư hỏng do thùng bị ướt'),
  30: () =>
    scrap('KTONG', ['XXTT-5', 'CHABONG-100'], 'Cận hạn sử dụng, không giao được cho đại lý'),
  19: () => scrap('KBH', ['MI-TOM-75', 'KDEO-100'], 'Bao bì rách do chuột cắn'),
  8: () => scrap('KTONG', ['SUA-TT-180', 'BBL-360'], 'Móp hộp, rỉ nước khi xe giao hàng thắng gấp'),
  66: () =>
    returnToSupplier(
      'KTONG',
      'NCC009',
      ['NXV-16', 'NLS-1L'],
      'Trả hàng lỗi vòi chai theo biên bản với nhà cung cấp'
    ),
  44: () =>
    returnToSupplier(
      'KTONG',
      'NCC005',
      ['BX-VANI-160'],
      'Bánh bị ỉu, trả theo chính sách đổi trả của nhà cung cấp'
    ),
  12: () => returnToSupplier('KBH', 'NCC010', ['STAM-900'], 'Vỏ chai nứt, trả lại nhà cung cấp'),
  77: () => salesReturn('KTONG', ['MI-BO-75', 'TX-450'], 'Đại lý trả lại hàng giao dư'),
  49: () => salesReturn('KTD', ['SUA-TT-180'], 'Cửa hàng trả lại do đặt nhầm loại có đường'),
  27: () => salesReturn('KBH', ['BGIAT-800', 'NGIAT-23'], 'Đại lý trả lại hàng giao dư'),
  9: () => salesReturn('KTONG', ['BSCL-12'], 'Siêu thị mini trả lại do giao trễ hạn trưng bày'),
  60: () =>
    freeGoods(
      'KTONG',
      'NCC003',
      ['NS-500', 'NN-SODA-330'],
      'Hàng tặng kèm chương trình khuyến mãi của nhà cung cấp'
    ),
  22: () => freeGoods('KTD', 'NCC004', ['SUA-TE-110'], 'Hàng tặng kèm theo đơn mua sữa tháng này'),
  40: () => reversalOfIssue(),
  25: () => reversalOfReceipt(),
}

function internalUse(w, codes, why) {
  const m = postSlot(dNow, 9 * 60, 16 * 60)
  schedule(dNow, m, () => {
    const lines = linesOf(w, codes, dNow, (p, st) =>
      st.q >= 6 ? [p.code, 0, Math.min(st.q, ri(2, 6))] : null
    )
    if (lines.length) makeIssue(dNow, m, w, 'DungNoiBo', { lines, why, noReject: true })
  })
}
function scrap(w, codes, why) {
  const m = postSlot(dNow, 9 * 60, 16 * 60)
  schedule(dNow, m, () => {
    const lines = linesOf(w, codes, dNow, (p, st) =>
      st.q >= 4 ? [p.code, 0, Math.min(st.q, ri(2, 8))] : null
    )
    if (lines.length) makeIssue(dNow, m, w, 'XuatHuy', { lines, why })
  })
}
function returnToSupplier(w, ncc, codes, why) {
  const m = postSlot(dNow, 9 * 60, 16 * 60)
  schedule(dNow, m, () => {
    const lines = linesOf(w, codes, dNow, (p, st) =>
      st.q >= 4 ? [p.code, 0, Math.min(st.q, ri(2, 6))] : null
    )
    if (lines.length) makeIssue(dNow, m, w, 'TraNhaCungCap', { s: ncc, lines, why, noReject: true })
  })
}
function salesReturn(w, codes, note) {
  const m = postSlot(dNow, 9 * 60, 16 * 60)
  schedule(dNow, m, () => {
    const lines = linesOf(w, codes, dNow, (p, st) =>
      st.q > 0 ? [p.code, 0, ri(2, 10), st.c] : null
    )
    if (lines.length)
      makeReceipt(dNow, m, w, 'HangBanTraLai', {
        lines,
        dl: pick(recipientsOf(w)),
        nt: note,
        noReject: true,
      })
  })
}
function freeGoods(w, ncc, codes, note) {
  const m = postSlot(dNow, 9 * 60, 16 * 60)
  schedule(dNow, m, () => {
    const lines = linesOf(w, codes, dNow, (p) => [p.code, 1, ri(1, 3), 0])
    if (lines.length)
      makeReceipt(dNow, m, w, 'NhapKhac', { s: ncc, lines, nt: note, noReject: true })
  })
}
function reversalOfIssue() {
  // Phiếu xuất bán ở KTONG ngày 40 lập nhầm đại lý: quản lý tạo phiếu ngược (Nhập điều chỉnh), quản trị viên duyệt
  const d = dNow
  const m1 = postSlot(d, 9 * 60, 9 * 60 + 40)
  schedule(d, m1, () => {
    const lines = linesOf('KTONG', ['NN-COLA-330', 'MI-GA-75'], d, (p, st) =>
      st.q >= 48 ? [p.code, 2 <= p.units.length ? 2 : 1, 1] : null
    )
    const { doc, costs } = makeIssue(d, m1, 'KTONG', 'XuatBan', {
      rc: 'Tạp hóa Minh Châu',
      or: 'DH' + orderNo++,
      lines,
      noReject: true,
    })
    const m2 = postSlot(d, 14 * 60, 15 * 60)
    schedule(d, m2, () => {
      const rl = doc.ln.map(([c, u, qty], i) => [c, 0, qty * factors(products.get(c))[u], costs[i]])
      makeReceipt(d, m2, 'KTONG', 'NhapDieuChinh', {
        lines: rl,
        by: 'quanly',
        rv: doc.id,
        nt: 'Lập nhầm đại lý, hàng chưa rời kho',
        noReject: true,
      })
    })
  })
}
function reversalOfReceipt() {
  // Phiếu nhập KTD ngày 25 nhập trùng hóa đơn: quản lý tạo phiếu ngược (Xuất điều chỉnh)
  const d = dNow
  const m1 = postSlot(d, 8 * 60 + 30, 9 * 60 + 30)
  schedule(d, m1, () => {
    const lines = ['KDR-180', 'BCDR-2'].map((c) => {
      const p = products.get(c)
      return [c, 1, 2, unitPriceFor(p, 'KTD', d, 1)]
    })
    const doc = makeReceipt(d, m1, 'KTD', 'MuaHang', { s: 'NCC010', lines, noReject: true })
    const m2 = postSlot(d, 13 * 60 + 30, 14 * 60 + 30)
    schedule(d, m2, () => {
      const il = doc.ln.map(([c, u, qty]) => [c, 0, qty * factors(products.get(c))[u]])
      makeIssue(d, m2, 'KTD', 'XuatDieuChinh', {
        lines: il,
        by: 'quanly',
        rv: doc.id,
        why: 'Nhập trùng hóa đơn đã nhập ngày trước',
        noReject: true,
      })
    })
  })
}

function overstock(d) {
  for (const [w, codes] of Object.entries(OVERSTOCK)) {
    for (const code of codes) {
      if (d !== 9 - (codes.indexOf(code) % 5)) continue
      const m = postSlot(d, 9 * 60, 15 * 60)
      schedule(d, m, () => {
        const p = products.get(code)
        const [, mx] = simLevels(p, w)
        const f = largest(p)
        const q = Math.ceil((mx * 1.4 - book.get(w, code).q) / f) * f
        if (q < f) return
        const [u, qty] = asLine(p, q)
        makeReceipt(d, m, w, 'MuaHang', {
          s: p.supplier,
          lines: [[code, u, qty, unitPriceFor(p, w, d, u)]],
          nt: 'Nhập thêm theo chương trình chiết khấu của nhà cung cấp',
        })
      })
    }
  }
}

function lowEnd(d) {
  if (d !== 3) return
  for (const [w, codes] of Object.entries(LOW_END)) {
    const m = postSlot(d, 9 * 60, 11 * 60)
    schedule(d, m, () => {
      const lines = []
      for (const c of codes) {
        const p = products.get(c)
        const f = factors(p)[1] ?? 1
        const [mn] = simLevels(p, w)
        const keep = Math.max(f, Math.floor((mn * (0.6 + rand() * 0.3)) / f) * f)
        const q = book.get(w, c).q - keep
        if (q <= 0) continue
        const [u, qty] = asLine(p, q)
        lines.push([c, u, qty])
        lastSold.set(w + '|' + c, d)
      }
      if (lines.length)
        makeIssue(d, m, w, 'XuatBan', {
          rc: pick(recipientsOf(w)),
          or: 'DH' + orderNo++,
          lines,
          noReject: true,
        })
    })
  }
}

function sellOut(d) {
  if (d !== 2) return
  for (const [w, codes] of Object.entries(SELL_OUT)) {
    const m = postSlot(d, 10 * 60, 15 * 60)
    schedule(d, m, () => {
      const lines = codes
        .filter((c) => book.get(w, c).q > 0)
        .map((c) => {
          const [u, qty] = asLine(products.get(c), book.get(w, c).q)
          return [c, u, qty]
        })
      if (lines.length)
        makeIssue(d, m, w, 'XuatBan', {
          rc: pick(recipientsOf(w)),
          or: 'DH' + orderNo++,
          lines,
          noReject: true,
        })
    })
  }
}

/** Nước rửa chén can 3,6kg ở KBH: nhập 96 can, xuất lần cuối cách đây 75 ngày, còn 48 (TC-35) */
function sunlight(d) {
  const w = 'KBH'
  const p = products.get('NRC-36')
  if (d === 89) {
    const m = postSlot(d, 8 * 60, 9 * 60)
    schedule(d, m, () =>
      makeReceipt(d, m, w, 'MuaHang', {
        s: 'NCC009',
        lines: [['NRC-36', 1, 24, unitPriceFor(p, w, d, 1)]],
        noReject: true,
      })
    )
  }
  const plan = { 86: 20, 81: 16, 75: 12 }
  if (plan[d]) {
    const m = postSlot(d, 9 * 60, 15 * 60)
    schedule(d, m, () =>
      makeIssue(d, m, w, 'XuatBan', {
        rc: pick(recipientsOf(w)),
        or: 'DH' + orderNo++,
        lines: [['NRC-36', 1, plan[d] / 4]],
        noReject: true,
      })
    )
  }
}

/** Ngày 1, 16:00–16:55: đưa tồn hàng kịch bản về đúng số đích */
function landKeys(d) {
  if (d !== 1) return
  for (const [code, per] of Object.entries(KEY)) {
    for (const [w, [target]] of Object.entries(per)) {
      if (code === 'NRC-36') continue
      const m = postSlot(d, 16 * 60, 16 * 60 + 55)
      schedule(d, m, () => {
        const p = products.get(code)
        const cur = book.get(w, code).q
        if (cur > target) {
          const [u, qty] = asLine(p, cur - target)
          makeIssue(d, m, w, 'XuatBan', {
            rc: pick(recipientsOf(w)),
            or: 'DH' + orderNo++,
            lines: [[code, u, qty]],
            noReject: true,
          })
        } else if (cur < target) {
          const [u, qty] = asLine(p, target - cur)
          makeReceipt(d, m, w, 'MuaHang', {
            s: p.supplier,
            lines: [[code, u, qty, unitPriceFor(p, w, d, u)]],
            noReject: true,
          })
        }
      })
    }
  }
}

/** Phiếu chuyển đang đi đường: KTD → KBH duyệt 4 ngày trước (Trễ), KTONG → KBH duyệt hôm qua */
const inTransitPlan = {
  4: ['KTD', 10 * 60 + 20, ['NN-CAM-330', 'SDN-200', 'BGIAT-800']],
  1: ['KTONG', 9 * 60 + 40, ['KDR-180', 'NRC-750', 'MI-BO-75', 'KGR-180']],
}
function inTransit(d) {
  const plan = inTransitPlan[d]
  if (!plan) return
  const [fw, m0, codes] = plan
  const m = postSlot(d, m0, m0 + 10)
  schedule(d, m, () => {
    const lines = codes
      .filter((c) => products.get(c).stock.KBH && book.get(fw, c).q >= largest(products.get(c)) * 3)
      .map((c) => [c, products.get(c).units.length, 2])
    if (!lines.length) throw new Error('Phiếu đang chuyển ngày ' + d + ' rỗng')
    makeTransfer(d, m, fw, 'KBH', lines)
  })
}

/** Phiếu kiểm kê đã cân bằng: chốt 17:30, gửi duyệt, duyệt trước 19:30 (sau giờ ghi sổ trong ngày, BR-14) */
const stocktakePlan = {
  62: ['KBH', 'all', 'thukho.bh'],
  33: ['KTONG', ['HMP', 'CANHAN'], 'nhanvien'],
  6: ['KTD', 'all', 'nhanvien'],
}
let kSeq = 0
const stocktakeLineCount = new Map()
function stocktake(d) {
  const plan = stocktakePlan[d]
  if (!plan) return
  const [w, sc, counter] = plan
  schedule(d, 17 * 60 + 30, () => {
    const inScope = (c) => sc === 'all' || sc.includes(products.get(c).group)
    const lines = [...book.s.entries()]
      .filter(([k, st]) => k.startsWith(w + '|') && st.q !== 0 && inScope(k.split('|')[1]))
      .map(([k]) => k.split('|')[1])
    const df = []
    for (const c of shuffle(lines.filter((x) => !isKey(x))).slice(0, ri(5, 8))) {
      const st = book.get(w, c)
      const big = rand() < 0.3
      let diff = big
        ? -Math.min(st.q, Math.max(2, Math.round(st.q * 0.08)))
        : pick([-3, -2, -1, -1, 1, 2])
      if (st.q + diff < 0) diff = -st.q
      if (diff === 0) continue
      const value = Math.abs(diff * st.c)
      const required = value >= 1000000 || Math.abs(diff) >= st.q * 0.05
      const row = [c, diff]
      if (required) {
        const reason =
          diff < 0
            ? pick(['HuHong', 'MatMat', 'NhapXuatChuaLapPhieu'])
            : pick(['NhapXuatChuaLapPhieu', 'NhamMaHang'])
        row.push(reason)
        if (reason === 'HuHong') row.push('Bao bì rách, móp do kệ sập góc, đã lập biên bản')
      }
      df.push(row)
    }
    const apMin = 19 * 60 + ri(0, 25)
    usedPost.add(d + ':' + apMin)
    const doc = {
      id: 'K' + ++kSeq,
      w,
      sc,
      by: 'quanly',
      ct: counter,
      cr: tok(d, 17 * 60 + 30),
      sb: tok(d, 18 * 60 + ri(40, 59)),
      ap: [tok(d, apMin), 'quanly'],
      df,
    }
    stocktakeLineCount.set(doc.id, lines.length)
    for (const [c, diff] of df) book.adjust(w, c, diff, book.get(w, c).c)
    stocktakes.push(doc)
  })
}

// ───────────────────────────── Chạy mô phỏng ─────────────────────────────
let dNow = 90
for (let d = 90; d >= 1; d--) {
  dNow = d
  tasks.length = 0
  if (d === 90) openingStock(d, 'KTONG')
  if (d === 89) {
    openingStock(d, 'KTD')
    openingStock(d, 'KBH')
  }
  sunlight(d)
  if (d <= 88) {
    runPlanned(d)
    const counts = {
      KTONG: rand() < 0.6 ? 2 : 1,
      KTD: rand() < 0.35 ? 2 : 1,
      KBH: rand() < 0.25 ? 2 : 1,
    }
    for (const w of WH) for (let i = 0; i < counts[w]; i++) salesIssue(d, w)
    specials[d]?.()
    overstock(d)
    sellOut(d)
    lowEnd(d)
    inTransit(d)
    landKeys(d)
  }
  stocktake(d)
  // chạy theo phút ghi sổ; việc sinh thêm trong ngày (nhận hàng chuyển) được chèn và sắp lại
  const done = new Set()
  for (;;) {
    const next = tasks.filter((t) => !done.has(t)).sort((a, b) => a.m - b.m)[0]
    if (!next) break
    done.add(next)
    next.run()
  }
  if (d < 90) planReplenishment(d)
}

// ───────────────────────────── Chứng từ chưa kết thúc, hủy (không ghi sổ) ─────────────────────────────
const finalBook = book
const reserved = new Map()
const avail = (w, c) => finalBook.get(w, c).q - (reserved.get(w + '|' + c) ?? 0)
const reserve = (w, c, q) => reserved.set(w + '|' + c, (reserved.get(w + '|' + c) ?? 0) + q)
function pendingLines(w, codes, cartons, withPrice, draft = false) {
  return codes
    .filter((c) => !PENDING_EXCLUDE.has(c) && products.get(c).stock[w])
    .map((c) => {
      const p = products.get(c)
      const u = p.units.length
      const f = factors(p)[u]
      if (withPrice) return [c, u, cartons, unitPriceFor(p, w, 0, u)]
      const n = Math.min(cartons, Math.floor(avail(w, c) / f))
      if (n < 1) return null
      if (!draft) reserve(w, c, n * f)
      return [c, u, n]
    })
    .filter(Boolean)
}
const pendingReceipts = [
  {
    id: 'R' + String(++rSeq).padStart(3, '0'),
    w: 'KTONG',
    t: 'MuaHang',
    s: 'NCC012',
    inv: ['0004127', 0],
    dl: 'Đỗ Văn Hiếu',
    by: 'nhanvien',
    cr: -140,
    sb: -95,
    ln: pendingLines('KTONG', ['TUIRAC-1KG', 'MRC-5', 'PIN-AA-4', 'GTCS-M'], 5, true),
  },
  {
    id: 'R' + String(++rSeq).padStart(3, '0'),
    w: 'KTD',
    t: 'MuaHang',
    s: 'NCC004',
    inv: ['0004098', 1],
    dl: 'Nguyễn Hữu Thắng',
    by: 'quanly',
    cr: '1@15:50',
    sb: '1@16:40',
    ln: pendingLines('KTD', ['SUA-KD-180', 'SUA-SCL-180', 'SCA-100'], 10, true),
  },
  {
    id: 'R' + String(++rSeq).padStart(3, '0'),
    w: 'KBH',
    t: 'MuaHang',
    s: 'NCC009',
    inv: ['0004131', 0],
    dl: 'Trần Văn Lộc',
    f: 350000,
    by: 'thukho.bh',
    cr: -70,
    sb: -40,
    ln: pendingLines('KBH', ['NGIAT-23', 'BGIAT-3', 'NLS-1L', 'TBC-900'], 6, true),
  },
  {
    id: 'R' + String(++rSeq).padStart(3, '0'),
    w: 'KTONG',
    t: 'MuaHang',
    s: 'NCC005',
    by: 'nhanvien',
    cr: -20,
    ln: pendingLines('KTONG', ['BQ-SCL-150', 'KSUA-350'], 8, true),
  },
]
const pendingIssues = [
  {
    id: 'I' + String(++iSeq).padStart(3, '0'),
    w: 'KTONG',
    t: 'XuatBan',
    rc: 'Siêu thị mini Hoàng Yến',
    or: 'DH' + orderNo++,
    by: 'nhanvien',
    cr: -50,
    sb: -30,
    ln: pendingLines('KTONG', ['NN-COLA-330', 'MI-TOM-75', 'SUA-TT-180', 'KGR-180', 'HNEM-400'], 3),
  },
  {
    id: 'I' + String(++iSeq).padStart(3, '0'),
    w: 'KBH',
    t: 'XuatBan',
    rc: 'Đại lý Thành Đạt Biên Hòa',
    or: 'DH' + orderNo++,
    by: 'thukho.bh',
    cr: -25,
    sb: -15,
    ln: pendingLines('KBH', ['MI-BO-75', 'TOT-250', 'NTUONG-500'], 2),
  },
  {
    id: 'I' + String(++iSeq).padStart(3, '0'),
    w: 'KBH',
    t: 'XuatBan',
    rc: 'Tạp hóa Út Hiền',
    by: 'thukho.bh',
    cr: '1@16:10',
    ln: pendingLines('KBH', ['SN-TOM-40', 'KDEO-100'], 1, false, true),
  },
  {
    id: 'I' + String(++iSeq).padStart(3, '0'),
    w: 'KTD',
    t: 'XuatBan',
    rc: 'Đại lý Phúc Lộc Dĩ An',
    or: 'DH' + orderNo++,
    by: 'nhanvien',
    cr: '1@13:50',
    sb: '1@14:05',
    rj: ['1@15:20', 'quanly', 'Đại lý đổi ngày nhận hàng, lập lại phiếu sau khi chốt đơn'],
    ln: [],
  },
]
// phiếu bị từ chối không giữ chỗ: tính dòng sau cùng, không trừ vào khả dụng
{
  const x = pendingIssues[3]
  x.ln = ['SUA-TT-180', 'MI-GA-75', 'KUOT-80']
    .filter((c) => products.get(c).stock.KTD)
    .map((c) => [
      c,
      products.get(c).units.length,
      Math.max(1, Math.min(2, Math.floor(finalBook.get('KTD', c).q / largest(products.get(c))))),
    ])
}
const pendingTransfers = [
  {
    id: 'T' + String(++tSeq).padStart(3, '0'),
    fw: 'KTONG',
    tw: 'KBH',
    by: 'nhanvien',
    cr: -80,
    sb: -60,
    ln: pendingLines('KTONG', ['NN-CHANH-330', 'SDN-200', 'MI-TOM-75'], 4),
  },
]
// Hủy trong lịch sử: nháp bỏ, bị từ chối rồi hủy
const cancelled = [
  {
    kind: 'R',
    d: 70,
    w: 'KTONG',
    t: 'MuaHang',
    s: 'NCC006',
    codes: ['MI-TOM-75', 'PHO-BO-65'],
    by: 'nhanvien',
    rejected: false,
  },
  {
    kind: 'I',
    d: 47,
    w: 'KTD',
    t: 'XuatBan',
    rc: 'Tạp hóa Bà Sáu',
    codes: ['SUA-TT-180'],
    by: 'nhanvien',
    rejected: true,
  },
  {
    kind: 'I',
    d: 31,
    w: 'KBH',
    t: 'XuatBan',
    rc: 'Quán cơm Hai Lúa',
    codes: ['GAO-THOM-5', 'DUONG-1KG'],
    by: 'thukho.bh',
    rejected: false,
  },
  {
    kind: 'R',
    d: 16,
    w: 'KTD',
    t: 'MuaHang',
    s: 'NCC003',
    codes: ['NS-500'],
    by: 'nhanvien',
    rejected: true,
  },
  {
    kind: 'I',
    d: 5,
    w: 'KTONG',
    t: 'DungNoiBo',
    why: 'Dùng cho văn phòng',
    codes: ['CF-3IN1-18'],
    by: 'nhanvien',
    rejected: false,
  },
]
for (const c of cancelled) {
  const doc = {
    id: (c.kind === 'R' ? 'R' + String(++rSeq) : 'I' + String(++iSeq)).replace(/(\d+)$/, (x) =>
      x.padStart(3, '0')
    ),
    w: c.w,
    t: c.t,
  }
  if (c.s) doc.s = c.s
  if (c.rc) doc.rc = c.rc
  if (c.why) doc.why = c.why
  doc.by = c.by
  doc.cr = tok(c.d, 9 * 60 + 10)
  if (c.rejected) {
    doc.sb = tok(c.d, 9 * 60 + 25)
    doc.rj = [
      tok(c.d, 10 * 60 + 5),
      'quanly',
      c.kind === 'R' ? 'Hàng chưa về đủ, chờ nhà cung cấp giao bù' : 'Đại lý hủy đơn hàng',
    ]
    doc.cx = [tok(c.d, 10 * 60 + 40), c.by]
  } else doc.cx = [tok(c.d, 11 * 60), c.by]
  doc.ln = c.codes.map((code) => {
    const p = products.get(code)
    const u = p.units.length
    return c.kind === 'R' ? [code, u, 5, unitPriceFor(p, c.w, c.d, u)] : [code, u, 1]
  })
  ;(c.kind === 'R' ? receipts : issues).push(doc)
}
receipts.push(...pendingReceipts)
issues.push(...pendingIssues)
transfers.push(...pendingTransfers)

// ───────────────────────────── Ghi file ─────────────────────────────
const byTime = (x) => {
  const t = x.cr
  if (typeof t === 'number') return -t / 1440
  const [d, h] = t.split('@')
  const [hh, mm] = h.split(':').map(Number)
  return Number(d) - (hh * 60 + mm) / 1440
}
for (const arr of [receipts, issues, transfers, stocktakes])
  arr.sort((a, b) => byTime(b) - byTime(a))
data.receipts = receipts
data.issues = issues
data.transfers = transfers
data.stocktakes = stocktakes

function writeCompact(obj) {
  const lines = ['{']
  const keys = Object.keys(obj)
  keys.forEach((k, ki) => {
    const v = obj[k]
    const comma = ki < keys.length - 1 ? ',' : ''
    if (Array.isArray(v) && v.length) {
      lines.push(`  ${JSON.stringify(k)}: [`)
      v.forEach((item, i) =>
        lines.push(`    ${JSON.stringify(item)}${i < v.length - 1 ? ',' : ''}`)
      )
      lines.push(`  ]${comma}`)
    } else lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`)
  })
  lines.push('}')
  return lines.join('\n') + '\n'
}
const text = writeCompact(data)
JSON.parse(text)

// ───────────────────────────── Replay tham chiếu (FE mock, BE seeder làm giống hệt) ─────────────────────────────
/**
 * Nạp lại chỉ từ JSON: mọi sự kiện ghi sổ (duyệt phiếu nhập, xuất; duyệt chuyển = xuất kho đi; nhận chuyển = nhập
 * kho đến; duyệt kiểm kê) sắp theo thời điểm ghi sổ tăng dần (các thời điểm trong dữ liệu mẫu khác nhau từng phút),
 * áp dụng bằng đúng quy tắc BR-08…BR-10, BR-13, BR-17. Kiểm kê: dòng = hàng trong phạm vi có tồn ≠ 0 lúc chốt.
 */
function replay(json) {
  const P = new Map(json.products.map((p) => [p.code, p]))
  const fac = (code, u) => (u === 0 ? 1 : P.get(code).units[u - 1][1])
  const key = (t) => {
    const [d, h] = t.split('@')
    const [hh, mm] = h.split(':').map(Number)
    return -Number(d) * 1440 + hh * 60 + mm
  }
  const ev = []
  for (const r of json.receipts) if (r.ap) ev.push([key(r.ap[0]), 'R', r])
  for (const x of json.issues) if (x.ap) ev.push([key(x.ap[0]), 'I', x])
  for (const t of json.transfers) {
    if (t.ap) ev.push([key(t.ap[0]), 'TO', t])
    if (t.re) ev.push([key(t.re[0]), 'TI', t])
  }
  for (const k of json.stocktakes) if (k.ap) ev.push([key(k.ap[0]), 'K', k])
  ev.sort((a, b) => a[0] - b[0])
  const seen = new Set()
  for (const [k] of ev) {
    if (seen.has(k)) throw new Error('Trùng thời điểm ghi sổ ' + k)
    seen.add(k)
  }
  const b = new Book()
  const sentCost = new Map()
  const ledger = []
  const stats = { inValue: 0, outValue: 0, shortageValue: 0 }
  const moves = [] // { day, kind, type, w, c, q, value }
  const dayOf = (at) => Math.ceil(-at / 1440)
  for (const [at, kind, doc] of ev) {
    if (kind === 'R') {
      const amounts = doc.ln.map((l) => l[2] * l[3])
      const bq = doc.ln.map((l) => l[2] * fac(l[0], l[1]))
      const al = allocateFreight(amounts, bq, doc.f ?? 0)
      doc.ln.forEach((l, i) => {
        const r = b.in(doc.w, l[0], bq[i], amounts[i] + al[i], at)
        moves.push({
          day: dayOf(at),
          kind: 'R',
          type: doc.t,
          w: doc.w,
          c: l[0],
          q: bq[i],
          value: amounts[i] + al[i],
        })
        ledger.push({ at, w: doc.w, c: l[0], in: bq[i], out: 0, bal: r.balanceQ })
      })
    } else if (kind === 'I') {
      const counts = doc.t === 'XuatBan' || doc.t === 'DungNoiBo'
      doc.ln.forEach((l) => {
        const q = l[2] * fac(l[0], l[1])
        const r = b.out(doc.w, l[0], q, at, counts)
        moves.push({ day: dayOf(at), kind: 'I', type: doc.t, w: doc.w, c: l[0], q, value: r.value })
        ledger.push({ at, w: doc.w, c: l[0], in: 0, out: q, bal: r.balanceQ })
      })
    } else if (kind === 'TO') {
      const costs = doc.ln.map((l) => {
        const q = l[2] * fac(l[0], l[1])
        const r = b.out(doc.fw, l[0], q, at, true)
        ledger.push({ at, w: doc.fw, c: l[0], in: 0, out: q, bal: r.balanceQ })
        return { q, cost: r.unitCost, value: r.value }
      })
      sentCost.set(doc.id, costs)
    } else if (kind === 'TI') {
      const costs = sentCost.get(doc.id)
      const shorts = doc.re[2] ?? []
      doc.ln.forEach((l, i) => {
        const s = shorts.find((x) => x[0] === i)
        const got = costs[i].q - (s ? s[1] : 0)
        if (s) stats.shortageValue += s[1] * costs[i].cost
        if (got > 0) {
          const r = b.in(doc.tw, l[0], got, got * costs[i].cost, at)
          ledger.push({ at, w: doc.tw, c: l[0], in: got, out: 0, bal: r.balanceQ })
        }
      })
    } else if (kind === 'K') {
      for (const [c, diff] of doc.df) {
        const st = b.get(doc.w, c)
        b.adjust(doc.w, c, diff, st.c)
        ledger.push({ at, w: doc.w, c, in: Math.max(diff, 0), out: Math.max(-diff, 0), bal: st.q })
      }
    }
  }
  return { book: b, ledger, sentCost, stats, moves }
}

const rp = replay(JSON.parse(text))
// Đối chiếu với mô phỏng
for (const [k, st] of finalBook.s) {
  const r = rp.book.s.get(k)
  if (!r || r.q !== st.q || r.v !== st.v || (st.q > 0 && r.c !== st.c))
    throw new Error('Replay lệch ' + k)
}
// Hàng kịch bản
for (const [code, per] of Object.entries(KEY)) {
  for (const [w, [q, c]] of Object.entries(per)) {
    const st = rp.book.get(w, code)
    if (st.q !== q || st.c !== c || st.v !== q * c)
      throw new Error(`Hàng kịch bản sai ${code}@${w}: ${st.q} ${st.c} ${st.v}`)
  }
}
{
  const st = rp.book.get('KBH', 'NRC-36')
  const lastIssueDay = Math.ceil(-st.lastIssue / 1440)
  if (lastIssueDay !== 75)
    throw new Error('NRC-36 xuất gần nhất phải 75 ngày trước, đang ' + lastIssueDay)
}
// KTD nhóm GIAVI chỉ còn 2 mặt hàng
{
  const giavi = [...rp.book.s.entries()].filter(
    ([k, st]) => k.startsWith('KTD|') && st.q > 0 && products.get(k.split('|')[1]).group === 'GIAVI'
  )
  if (giavi.length !== 2) throw new Error('KTD nhóm GIAVI phải đúng 2 mặt hàng còn tồn')
}
// Không mặt hàng kịch bản nào trong phiếu chưa kết thúc
for (const doc of [...pendingReceipts, ...pendingIssues, ...pendingTransfers]) {
  if (doc.ln.some((l) => isKey(l[0])))
    throw new Error('Phiếu chưa kết thúc chứa hàng kịch bản ' + doc.id)
  if (!doc.ln.length) throw new Error('Phiếu chưa kết thúc rỗng ' + doc.id)
}
// Chuyển kho đang đi đường không tới KTONG, KTD
for (const t of transfers)
  if (t.ap && !t.re && t.tw !== 'KBH') throw new Error('Phiếu đang chuyển phải tới KBH')

writeFileSync(FILE, text)

// ───────────────────────────── Thống kê (ghi vào docs/06 §5.6) ─────────────────────────────
const fmt = (n) => n.toLocaleString('vi-VN')
const open = (x) => (x.rj && !x.sb2 ? 'TuChoi' : x.sb ? 'ChoDuyet' : 'Nhap')
const status = (x) =>
  x.cx
    ? 'DaHuy'
    : 'fw' in x
      ? x.re
        ? 'DaNhan'
        : x.ap
          ? 'DangChuyen'
          : open(x)
      : x.ap
        ? 'DaDuyet'
        : open(x)
const countBy = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {})
console.log(
  'Phiếu nhập',
  receipts.length,
  countBy(receipts, status),
  countBy(receipts, (x) => x.t)
)
console.log(
  'Phiếu xuất',
  issues.length,
  countBy(issues, status),
  countBy(issues, (x) => x.t)
)
console.log(
  'Phiếu chuyển',
  transfers.length,
  countBy(transfers, status),
  'thiếu khi nhận',
  transfers.filter((t) => t.re?.[2]).length
)
console.log(
  'Kiểm kê',
  stocktakes.length,
  stocktakes
    .map((k) => `${k.id} ${k.w} ${JSON.stringify(k.sc)} d${k.cr} df=${k.df.length}`)
    .join('; ')
)
console.log(
  'Từng bị từ chối rồi duyệt',
  [...receipts, ...issues, ...transfers].filter((x) => x.rj && x.ap).length
)
const lines = [...receipts, ...issues, ...transfers].reduce((s, x) => s + x.ln.length, 0)
console.log(
  'Dòng phiếu nhập',
  receipts.reduce((n, x) => n + x.ln.length, 0),
  'xuất',
  issues.reduce((n, x) => n + x.ln.length, 0),
  'chuyển',
  transfers.reduce((n, x) => n + x.ln.length, 0),
  'kiểm kê',
  [...stocktakeLineCount].map(([k, n]) => `${k}=${n}`).join(' '),
  'đơn vị quy đổi',
  data.products.reduce((n, p) => n + p.units.length, 0)
)
console.log('Dòng phiếu', lines, 'dòng thẻ kho', rp.ledger.length)
let grand = 0
for (const w of WH) {
  let v = 0
  let n = 0
  let q = 0
  for (const [k, st] of rp.book.s)
    if (k.startsWith(w + '|')) {
      v += st.v
      q += st.q
      if (st.q > 0) n++
    }
  grand += v
  console.log(`Kho ${w}: ${n} mặt hàng còn tồn, tổng số lượng ${fmt(q)}, giá trị tồn ${fmt(v)} ₫`)
}
console.log('Tổng giá trị tồn', fmt(grand), '₫')
// Đang chuyển
let transitV = 0
for (const t of transfers)
  if (t.ap && !t.re) for (const c of rp.sentCost.get(t.id)) transitV += c.value
console.log(
  'Hàng đang chuyển',
  fmt(transitV),
  '₫; hao hụt vận chuyển lịch sử',
  fmt(rp.stats.shortageValue),
  '₫'
)
// Trạng thái tồn có ngưỡng
const statusCount = { HetHang: [], DuoiToiThieu: [], VuotToiDa: [] }
for (const p of data.products)
  for (const [w, [mn, mx]] of Object.entries(p.stock)) {
    const st = rp.book.get(w, p.code)
    const a = st.q - (reserved.get(w + '|' + p.code) ?? 0)
    let s = 'BinhThuong'
    if (st.q === 0) s = 'HetHang'
    else if (mn !== null && a <= mn) s = 'DuoiToiThieu'
    else if (mx !== null && st.q > mx) s = 'VuotToiDa'
    if (s === 'BinhThuong') continue
    const hasThreshold = s === 'VuotToiDa' ? mx !== null : mn !== null || mx !== null
    if (hasThreshold) statusCount[s].push(`${p.code}@${w}`)
  }
for (const [s, l] of Object.entries(statusCount)) console.log(s, l.length, l.join(', '))
// Chậm luân chuyển
const slow = []
for (const [k, st] of rp.book.s) {
  if (st.q <= 0) continue
  const ref = st.lastIssue ?? st.firstIn
  const days = Math.ceil(-ref / 1440)
  if (days >= 30) slow.push(`${k}:${days}`)
}
console.log('Chậm luân chuyển (≥30 ngày)', slow.length, slow.join(', '))
{
  const buckets = { '30-59': 0, '60-89': 0, '>=90': 0 }
  for (const x of slow) {
    const n = Number(x.split(':')[1])
    buckets[n >= 90 ? '>=90' : n >= 60 ? '60-89' : '30-59']++
  }
  console.log('Nhóm chậm luân chuyển', buckets)
  const last30 = rp.moves.filter((m) => m.day <= 29)
  const sum = (arr) => arr.reduce((t, m) => t + m.value, 0)
  console.log(
    '30 ngày: giá trị nhập (phiếu nhập)',
    fmt(sum(last30.filter((m) => m.kind === 'R'))),
    '₫; giá trị xuất (phiếu xuất trừ Xuất điều chỉnh)',
    fmt(sum(last30.filter((m) => m.kind === 'I' && m.type !== 'XuatDieuChinh'))),
    '₫'
  )
  const top = new Map()
  for (const m of last30)
    if (m.kind === 'I' && m.type !== 'XuatDieuChinh') top.set(m.c, (top.get(m.c) ?? 0) + m.value)
  console.log(
    'Top 5 giá trị xuất 30 ngày',
    [...top]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c, v]) => `${c} ${fmt(v)}`)
      .join('; ')
  )
  for (const t of transfers)
    if (t.ap && !t.re)
      console.log(
        'Đang chuyển',
        t.id,
        t.fw,
        '→',
        t.tw,
        'duyệt',
        t.ap[0],
        fmt(rp.sentCost.get(t.id).reduce((a, c) => a + c.value, 0)),
        '₫'
      )
  const rows = data.products.reduce((n, p) => n + Object.keys(p.stock).length, 0)
  console.log('Dòng tồn kho (hàng × kho)', rows)
}
console.log('Kích thước file', fmt(Buffer.byteLength(text)), 'byte')
