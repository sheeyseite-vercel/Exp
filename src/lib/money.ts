/**
 * Exact money and quantity arithmetic. Prices are whole hundredths ("cents") and quantities are
 * whole thousandths, so every total is computed with integers and never drifts like floats do.
 */
export const CURRENCY = 'DA';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalize(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[٫،]/g, '.')
    .replace(/\s+/g, '')
    .replace(',', '.');
}

function parseFixed(input: string, decimals: number, scale: number): number | null {
  const s = normalize(input);
  const match = new RegExp(`^(\\d{1,12})(?:\\.(\\d{0,${decimals}}))?$`).exec(s);
  if (!match) return null;
  const frac = (match[2] ?? '').padEnd(decimals, '0');
  return Number(match[1]) * scale + (frac ? Number(frac) : 0);
}

/** "125.5" -> 12550. Returns null when the text is not a valid price (more than 2 decimals, letters…). */
export function parseMoney(input: string): number | null {
  return parseFixed(input, 2, 100);
}

/** "2.5" -> 2500 (thousandths). Returns null when invalid. */
export function parseQty(input: string): number | null {
  return parseFixed(input, 3, 1000);
}

/** qty (thousandths) × unit price (cents), rounded half up to a whole cent. */
export function lineTotal(qtyMilli: number, unitCents: number): number {
  return Math.floor((qtyMilli * unitCents + 500) / 1000);
}

/** Wraps text in a left-to-right isolate so numbers never get re-ordered inside Arabic (right-to-left) text. */
export function ltr(text: string): string {
  return `\u2066${text}\u2069`;
}

function group(n: string): string {
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function rawMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${group(String(whole))}.${frac}`;
}

/** 1234567 -> "12 345.67" (kept in one left-to-right piece) */
export function formatMoney(cents: number): string {
  return ltr(rawMoney(cents));
}

export function formatMoneyCur(cents: number): string {
  return ltr(`${rawMoney(cents)} ${CURRENCY}`);
}

/** 2500 -> "2.5", 3000 -> "3" */
export function formatQty(milli: number): string {
  return ltr(qtyToInput(milli));
}

/** Quantity as editable text for an input: 2500 -> "2.5" (no direction marks). */
export function qtyToInput(milli: number): string {
  const sign = milli < 0 ? '-' : '';
  const abs = Math.abs(milli);
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, '0').replace(/0+$/, '');
  return `${sign}${whole}${frac ? `.${frac}` : ''}`;
}

/** Cents as an editable string for an input: 12550 -> "125.5". */
export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, '0').replace(/0+$/, '');
  return `${whole}${frac ? `.${frac}` : ''}`;
}

export interface DraftLine {
  qtyMilli: number;
  unitCents: number;
}

export function invoiceTotal(lines: DraftLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l.qtyMilli, l.unitCents), 0);
}

export interface Reconcile {
  state: 'match' | 'over' | 'short';
  /** computed - printed, in cents (positive: our lines add up to more than the printed total). */
  diff: number;
}

export function reconcile(computed: number, printed: number): Reconcile {
  const diff = computed - printed;
  return { state: diff === 0 ? 'match' : diff > 0 ? 'over' : 'short', diff };
}

/** Selling-price margin: profit in cents and percent of cost (one decimal), computed with integers. */
export function margin(costCents: number, sellCents: number): { profit: number; percentTenths: number | null } {
  const profit = sellCents - costCents;
  const percentTenths = costCents > 0 ? Math.round((profit * 1000) / costCents) : null;
  return { profit, percentTenths };
}

export function formatPercentTenths(tenths: number): string {
  const sign = tenths < 0 ? '-' : '';
  const abs = Math.abs(tenths);
  return ltr(`${sign}${Math.floor(abs / 10)}.${abs % 10}%`);
}
