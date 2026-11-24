/** Reads a photographed purchase invoice (Algerian and French/Arabic/English layouts) into invoice lines. */

export interface Box {
  text: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ParsedLine {
  name: string;
  barcode: string | null;
  qtyMilli: number;
  unitCents: number;
  /** true when the numbers did not add up and the unit price was derived from the line total. */
  guessed: boolean;
}

export interface ParsedInvoice {
  lines: ParsedLine[];
  printedCents: number | null;
  supplier: string;
  date: string | null;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function latinDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/٫/g, ',')
    .replace(/٬/g, ' ');
}

const LETTER = /[\p{L}]/gu;
const letters = (s: string) => (s.match(LETTER) ?? []).length;

const HEADER =
  /d[ée]signation|libell[ée]|article|produit|qt[ée]|quantit|prix|p\.?u\.?\b|montant|unit[ée]|r[ée]f|code|n°|الكمية|السعر|الوحدة|البيان|الصنف|المنتج|السلعة|المبلغ|رقم|مرجع|designation|description|qty|price|amount/i;
const TOTAL_WORDS =
  /\btotal\b|net\s*[àa]\s*payer|montant\s*(ttc|ht|total)|total\s*(ttc|ht|g[ée]n)|المجموع|الإجمالي|الاجمالي|الصافي|المبلغ\s*الإجمالي|المبلغ\s*الاجمالي|المبلغ\s*الكلي|الكلي/i;
const SKIP =
  /\btva\b|timbre|remise|rendu|esp[èe]ces?|ch[èe]que|r[èe]glement|rendu|arr[êe]t[ée]e?|signature|cachet|الضريبة|الطابع|تخفيض|خصم|نقدا|نقداً|الدفع|التوقيع|الختم|\btel\b|t[ée]l|fax|\bnif\b|\bnis\b|\brc\b|\bai\b|n\.?i\.?f|registre|adresse|facture|bon\s*de|\bbl\b|client|date|هاتف|فاتورة|وصل|العنوان|السجل|التاريخ|الزبون|الزبون/i;

/** All numbers in a row, from separate cells and from spaces inside one cell. */
function numberTokens(text: string): { value: number; raw: string }[] {
  const out: { value: number; raw: string }[] = [];
  const re = /(?<![\p{L}\d.,])\d+(?:[.,]\d+)?(?![\p{L}\d]|[.,]\d)/gu;
  for (const m of latinDigits(text).matchAll(re)) {
    out.push({ value: Number(m[0].replace(',', '.')), raw: m[0] });
  }
  return out;
}

/** The same row read with "1 250,00" style thousand groups glued together. */
function glued(text: string): { value: number; raw: string }[] {
  const t = latinDigits(text).replace(/(\d)[  ](\d{3})(?=\D|$)/g, '$1$2');
  return numberTokens(t);
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 0.006);
}

interface Assign {
  qty: number;
  unit: number;
  total: number;
  exact: boolean;
}

/** Finds which numbers are quantity, unit price and line total. */
function assign(nums: number[]): Assign | null {
  const v = nums.filter((n) => n > 0);
  if (v.length === 0) return null;
  let best: Assign | null = null;
  if (v.length >= 3) {
    for (let i = 0; i < v.length; i += 1) {
      for (let j = 0; j < v.length; j += 1) {
        if (j === i) continue;
        for (let k = 0; k < v.length; k += 1) {
          if (k === i || k === j) continue;
          const q = v[i];
          const u = v[j];
          const t = v[k];
          if (q > 99999 || q < 0.001) continue;
          if (near(q * u, t) && (q >= 1 || q * 1000 === Math.round(q * 1000)) && t >= u) {
            // prefer whole quantities, then the biggest line total
            const score = (c: Assign) => (Number.isInteger(c.qty) ? 1e9 : 0) + c.total;
            const cand = { qty: q, unit: u, total: t, exact: true };
            if (!best || score(cand) > score(best)) best = cand;
          }
        }
      }
    }
    if (best) return best;
  }
  if (v.length >= 2) {
    const total = v[v.length - 1];
    const small = v.find((n) => Number.isInteger(n) && n >= 1 && n <= 999 && n <= total);
    if (v.length === 2) {
      const [a, b] = v;
      const q = Number.isInteger(a) && a <= 999 && a <= b ? a : Number.isInteger(b) && b <= 999 && b <= a ? b : 1;
      const t = q === a ? b : q === b ? a : Math.max(a, b);
      return { qty: q, unit: t / q, total: t, exact: false };
    }
    const q = small ?? 1;
    const t = Math.max(...v.slice(-2));
    return { qty: q, unit: t / q, total: t, exact: false };
  }
  return { qty: 1, unit: v[0], total: v[0], exact: false };
}

function cleanName(raw: string): string {
  let s = latinDigits(raw)
    .replace(/\b\d{8,14}\b/g, ' ')
    .replace(/[|_=~•·]+/g, ' ')
    .replace(/^[\s\d.\-:)/]+/, '')
    .replace(/[\s\d.,:;\-/]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // names may keep digits inside ("Lait 1L"), but never a trailing money-like number
  s = s.replace(/\s+\d+[.,]\d+$/, '').trim();
  return s;
}

function toISO(text: string): string | null {
  const m = latinDigits(text).match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Groups recognised text boxes into table rows, left to right. */
export function toRows(boxes: Box[]): string[] {
  const items = boxes.filter((b) => b.text.trim()).map((b) => ({ ...b, cy: (b.top + b.bottom) / 2, h: Math.max(1, b.bottom - b.top) }));
  if (items.length === 0) return [];
  const heights = items.map((b) => b.h).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)];
  items.sort((a, b) => a.cy - b.cy);
  const rows: (typeof items)[] = [];
  for (const it of items) {
    const row = rows[rows.length - 1];
    if (row) {
      const mean = row.reduce((s, r) => s + r.cy, 0) / row.length;
      if (Math.abs(it.cy - mean) <= median * 0.6) {
        row.push(it);
        continue;
      }
    }
    rows.push([it]);
  }
  return rows.map((r) => {
    const sorted = [...r].sort((a, b) => a.left - b.left);
    const arabic = sorted.reduce((s, c) => s + (c.text.match(/[؀-ۿ]/g) ?? []).length, 0);
    const latin = sorted.reduce((s, c) => s + (c.text.match(/[A-Za-z]/g) ?? []).length, 0);
    // an Arabic invoice reads right to left, so the name cell sits at the right
    return (arabic > latin ? sorted.reverse() : sorted).map((c) => c.text.trim()).join('   ');
  });
}

/** Turns the rows of an invoice into lines, the printed total, a supplier guess and the date. */
export function parseRows(rows: string[]): ParsedInvoice {
  const lines: ParsedLine[] = [];
  let printed: number | null = null;
  let supplier = '';
  let date: string | null = null;
  let pending = '';
  let seenHeader = false;

  for (const rawRow of rows) {
    const row = latinDigits(rawRow).trim();
    if (!row) continue;
    date = date ?? toISO(row);
    const nl = letters(row);
    const split = numberTokens(row);

    if (!supplier && nl >= 3 && split.length === 0 && !HEADER.test(row) && !SKIP.test(row) && lines.length === 0) {
      supplier = cleanName(row);
      continue;
    }
    if (TOTAL_WORDS.test(row) && !/tva|ضريبة/i.test(row)) {
      const vals = glued(row).map((n) => n.value);
      const max = vals.length ? Math.max(...vals) : 0;
      if (max > 0 && (printed === null || max >= printed)) printed = max;
      continue;
    }
    if (HEADER.test(row) && split.length <= 2 && nl >= 4) {
      seenHeader = true;
      continue;
    }
    if (SKIP.test(row)) continue;

    // barcode: a long digit string in the row
    const code = row.match(/\b\d{8,14}\b/)?.[0] ?? null;
    const body = code ? row.replace(code, ' ') : row;
    const name = cleanName(body);

    const variants = [numberTokens(body), glued(body)];
    let pick: Assign | null = null;
    for (const nums of variants) {
      const a = assign(nums.map((n) => n.value));
      if (a && (!pick || (a.exact && !pick.exact))) pick = a;
    }

    if (!pick) {
      if (nl >= 3) pending = name;
      continue;
    }
    const finalName = letters(name) >= 2 ? name : pending;
    pending = '';
    // a row whose numbers multiply out exactly is a product even when its name could not be read (Arabic print)
    if (letters(finalName) < 2 && !pick.exact) continue;
    if (!seenHeader && !pick.exact && split.length < 2) continue; // stray line of text with one number
    lines.push({
      name: letters(finalName) < 2 ? '' : finalName.slice(0, 120),
      barcode: code,
      qtyMilli: Math.round(pick.qty * 1000),
      unitCents: Math.round(pick.unit * 100),
      guessed: !pick.exact,
    });
  }

  return { lines, printedCents: printed === null ? null : Math.round(printed * 100), supplier: supplier.slice(0, 60), date };
}

export function parseInvoice(boxes: Box[]): ParsedInvoice {
  return parseRows(toRows(boxes));
}
