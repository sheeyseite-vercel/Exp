/** Finds the most likely expiry date inside text read from a product label. */

const MONTH_WORDS: Record<string, number> = {
  jan: 1, janv: 1, january: 1, janvier: 1,
  feb: 2, fev: 2, fév: 2, févr: 2, february: 2, fevrier: 2, février: 2,
  mar: 3, mars: 3, march: 3,
  apr: 4, avr: 4, april: 4, avril: 4,
  may: 5, mai: 5,
  jun: 6, juin: 6, june: 6,
  jul: 7, juil: 7, july: 7, juillet: 7,
  aug: 8, aou: 8, aoû: 8, août: 8, aout: 8, august: 8,
  sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, déc: 12, december: 12, decembre: 12, décembre: 12,
};

function daysIn(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function iso(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysIn(year, month)) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function fullYear(raw: string): number {
  const n = Number(raw);
  return raw.length === 2 ? 2000 + n : n;
}

// Words printed next to the expiry date (E:, EXP, BBE, DLC, ينتهي …) and next to the production date (F:, MFG, PROD, FAB …).
const EXPIRY = /(?:^|[^a-z])(?:exp|exd|ed|e|bbe|bb|bbd|dlc|dluo|ddm|dluo|use\s*by|best\s*before|consommer|a\s*consommer|à\s*consommer|jusqu|avant)(?![a-z])|limite|ينتهي|انتهاء|الانتهاء|الصلاحية|صلاحية|صالح|يستهلك/i;
const PRODUCTION = /(?:^|[^a-z])(?:mfg|mfd|prod|pd|p|f|fab|fabr|fabriqu[ée]?|pack|packed|cond|lot)(?![a-z])|الإنتاج|الانتاج|التصنيع/i;

/** Fixes the usual OCR mix-ups (O for 0, l for 1) around digits and separators. */
function clean(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/(?<=[\d./\-:\s])[Oo](?=[\d./\-:])|(?<=\d)[Oo](?=[\s./\-:]|$)|(?<![A-Za-z])[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[lI|](?=[\d./\-])|(?<=[./\-])[lI|](?=\d)/g, '1')
    .replace(/[,;]/g, '.');
}

interface Hit {
  date: string;
  keyed: boolean;
  production: boolean;
}

export function findExpiryDate(text: string): string | null {
  const lines = clean(text).split(/\r?\n/);
  const found: Hit[] = [];

  let carry = false;
  for (const line of lines) {
    const here = EXPIRY.test(line);
    const keyed = here || carry;
    const before = found.length;
    const production = !keyed && PRODUCTION.test(line);
    const add = (date: string | null) => date && found.push({ date, keyed, production });

    // 2029-04-30, 2029/04/30
    for (const m of line.matchAll(/(?<!\d)(20\d{2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*(\d{1,2})(?!\d)/g)) add(iso(+m[1], +m[2], +m[3]));
    // 30/04/2029, 30.04.29, 30-04-2029, 30 04 2029 (day first, as printed in Algeria and France)
    for (const m of line.matchAll(/(?<![\d./\-])(\d{1,2})\s*[./\-\s]\s*(\d{1,2})\s*[./\-\s]\s*(\d{4}|\d{2})(?![\d/])/g)) {
      add(iso(fullYear(m[3]), +m[2], +m[1]));
    }
    // 04/2029, 04.2029 → end of that month
    for (const m of line.matchAll(/(?<![\d./\-])(\d{1,2})\s*[./\-]\s*(20\d{2})(?!\d)/g)) add(iso(+m[2], +m[1], daysIn(+m[2], +m[1])));
    // 2029/04
    for (const m of line.matchAll(/(?<![\d./\-])(20\d{2})\s*[./\-]\s*(\d{1,2})(?![\d./\-])/g)) add(iso(+m[1], +m[2], daysIn(+m[1], +m[2])));
    if (keyed) {
      // 04/29 right after an expiry word
      for (const m of line.matchAll(/(?<![\d./\-])(\d{1,2})\s*[./\-]\s*(\d{2})(?![\d./\-])/g)) {
        const month = +m[1];
        if (month >= 1 && month <= 12) add(iso(2000 + +m[2], month, daysIn(2000 + +m[2], month)));
      }
      for (const m of line.matchAll(/(?<![\d./\-])(\d{1,2})\s+(20\d{2})(?!\d)/g)) add(iso(+m[2], +m[1], daysIn(+m[2], +m[1])));
      // compact: 300429 (ddmmyy), 20290430 (yyyymmdd), 042029 (mmyyyy)
      for (const m of line.matchAll(/(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/g)) add(iso(2000 + +m[3], +m[2], +m[1]));
      for (const m of line.matchAll(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/g)) add(iso(+m[1], +m[2], +m[3]));
      for (const m of line.matchAll(/(?<!\d)(\d{2})(20\d{2})(?!\d)/g)) add(iso(+m[2], +m[1], daysIn(+m[2], +m[1])));
    }
    // 30 AVR 2029, AVR 2029, 04 APR.29
    for (const m of line.matchAll(/(?<!\d)(\d{1,2})?\s*([a-zA-Zéèûôàç]{3,9})\.?\s*[-/.]?\s*(\d{4}|\d{2})(?!\d)/g)) {
      const month = MONTH_WORDS[m[2].toLowerCase()];
      if (!month) continue;
      const year = fullYear(m[3]);
      add(iso(year, month, m[1] ? +m[1] : daysIn(year, month)));
    }
    // "EXP" or "تاريخ انتهاء الصلاحية" alone on a line: the date is on the next line.
    carry = here && found.length === before;
  }

  if (found.length === 0) return null;
  const keyed = found.filter((f) => f.keyed);
  const notProduction = found.filter((f) => !f.production);
  // Only production dates were read: better to say nothing than to fill in the wrong one.
  if (!keyed.length && !notProduction.length) return null;
  const pool = keyed.length ? keyed : notProduction;
  return pool.map((f) => f.date).sort().at(-1) ?? null;
}
