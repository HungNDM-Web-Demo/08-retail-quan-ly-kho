/**
 * Số tiền bằng chữ (07 §3.13, NFR-06): đọc theo nhóm 3 chữ số với "nghìn", "triệu", "tỷ" (lặp "nghìn tỷ"…);
 * "mươi" từ 20, "mười" cho 10–19; 1 sau "mươi" đọc "mốt", 5 sau "mươi"/"mười" đọc "lăm", 4 sau "mươi" đọc "tư";
 * hàng chục 0 mà đơn vị khác 0 đọc "linh"; nhóm sau nhóm đầu có trăm 0 đọc "không trăm"; nhóm 000 bỏ qua;
 * viết hoa chữ đầu, thêm " đồng"; 0 → "Không đồng".
 * Ví dụ: 22.680.000 → "Hai mươi hai triệu sáu trăm tám mươi nghìn đồng".
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const SCALES = ['', 'nghìn', 'triệu', 'tỷ']

/** Đọc một nhóm 0–999; `full` = không phải nhóm đầu tiên (đọc "không trăm", "linh") */
function readGroup(n: number, full: boolean): string {
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const units = n % 10
  const words: string[] = []

  if (hundreds > 0 || full) words.push(DIGITS[hundreds], 'trăm')

  if (tens === 0) {
    if (units > 0 && (hundreds > 0 || full)) words.push('linh')
  } else if (tens === 1) {
    words.push('mười')
  } else {
    words.push(DIGITS[tens], 'mươi')
  }

  if (units > 0) {
    if (units === 1 && tens >= 2) words.push('mốt')
    else if (units === 5 && tens >= 1) words.push('lăm')
    else if (units === 4 && tens >= 2) words.push('tư')
    else words.push(DIGITS[units])
  }
  return words.join(' ')
}

/** Tên bậc của nhóm thứ i (0 = đơn vị): nghìn, triệu, tỷ, nghìn tỷ, triệu tỷ, tỷ tỷ… */
function scaleName(i: number): string {
  if (i === 0) return ''
  const tyCount = Math.floor((i - 1) / 3)
  const head = SCALES[((i - 1) % 3) + 1]
  return [head, ...Array.from({ length: tyCount }, () => 'tỷ')].join(' ')
}

export function amountInWords(value: number): string {
  let n = Math.round(Math.abs(value))
  if (n === 0) return 'Không đồng'
  const groups: number[] = []
  while (n > 0) {
    groups.push(n % 1000)
    n = Math.floor(n / 1000)
  }
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    if (g === 0) continue
    const isFirst = i === groups.length - 1
    const text = readGroup(g, !isFirst)
    const scale = scaleName(i)
    parts.push(scale ? `${text} ${scale}` : text)
  }
  const sentence = (value < 0 ? 'âm ' : '') + parts.join(' ')
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} đồng`
}
