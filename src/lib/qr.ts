import { isValidISO } from './dates';

export interface ScanInfo {
  /** Product name found in the code, if it is plain text. */
  name?: string;
  /** Expiry date (yyyy-mm-dd) found in the code. */
  expiry?: string;
  /** Numeric product barcode (EAN/UPC/GTIN). */
  barcode?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** GS1 dates are YYMMDD; day 00 means "end of the month". */
export function parseGs1Date(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const year = 2000 + Number(yymmdd.slice(0, 2));
  const month = Number(yymmdd.slice(2, 4));
  let day = Number(yymmdd.slice(4, 6));
  if (month < 1 || month > 12) return undefined;
  if (day === 0) day = new Date(year, month, 0).getDate();
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isValidISO(iso) ? iso : undefined;
}

function toIsoFromParts(a: number, b: number, c: number): string | undefined {
  // a-b-c either yyyy-mm-dd or dd-mm-yyyy
  let y: number;
  let m: number;
  let d: number;
  if (a > 31) {
    y = a;
    m = b;
    d = c;
  } else {
    d = a;
    m = b;
    y = c;
  }
  if (y < 100) y += 2000;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return isValidISO(iso) ? iso : undefined;
}

const KEYWORDS = String.raw`(?:exp(?:iry)?(?:\s*date)?|best\s*before|use\s*by|bbe|صلاحية|ينتهي|انتهاء|تاريخ\s*الانتهاء)`;
const DATE_PART = String.raw`(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})`;

export function extractExpiry(text: string): string | undefined {
  // GS1 element strings: (17)YYMMDD expiry, (15)YYMMDD best before
  const gs1 = text.match(/\((?:17|15)\)\s*(\d{6})/);
  if (gs1) {
    const parsed = parseGs1Date(gs1[1]);
    if (parsed) return parsed;
  }
  // GS1 digital link query: ?17=YYMMDD
  const link = text.match(/[?&](?:17|15)=(\d{6})\b/);
  if (link) {
    const parsed = parseGs1Date(link[1]);
    if (parsed) return parsed;
  }
  // GS1 plain element string: 01 + GTIN-14 + 17 + YYMMDD
  const plain = text.match(/^01\d{14}(?:17|15)(\d{6})/);
  if (plain) {
    const parsed = parseGs1Date(plain[1]);
    if (parsed) return parsed;
  }
  // "EXP 2026-11-21", "Best before: 21/11/2026", "تاريخ الانتهاء 21.11.2026"
  const keyed = new RegExp(`${KEYWORDS}\\s*[:=\\-]?\\s*${DATE_PART}`, 'i').exec(text);
  if (keyed) {
    const iso = toIsoFromParts(Number(keyed[1]), Number(keyed[2]), Number(keyed[3]));
    if (iso) return iso;
  }
  return undefined;
}

/** Reads whatever useful information a scanned code carries. */
export function parseScan(raw: string): ScanInfo {
  const text = raw.trim();
  const info: ScanInfo = {};
  if (!text) return info;

  const expiry = extractExpiry(text);
  if (expiry) info.expiry = expiry;

  if (/^\d{8,14}$/.test(text)) {
    info.barcode = text;
    return info;
  }

  const gtin = text.match(/^\(?01\)?(\d{14})/) ?? text.match(/\/01\/(\d{14})/);
  if (gtin) info.barcode = gtin[1];

  const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  const looksStructured = /\(\d{2}\)/.test(text) || /^01\d{14}/.test(text);
  if (!isUrl && !looksStructured && /\p{L}/u.test(text)) {
    const firstLine = text.split(/\r?\n/)[0].trim();
    if (firstLine.length > 0 && firstLine.length <= 120) info.name = firstLine;
  }
  return info;
}
