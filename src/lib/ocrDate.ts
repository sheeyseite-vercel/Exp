/** Finds the most likely expiry date inside text read from a product label. */

const MONTH_WORDS: Record<string, number> = {
  jan: 1, janv: 1, january: 1, janvier: 1,
  feb: 2, fev: 2, fév: 2, févr: 2, february: 2, fevrier: 2, février: 2,
  mar: 3, mars: 3, march: 3,
  apr: 4, avr: 4, april: 4, avril: 4,
  may: 5, mai: 5,
  jun: 6, juin: 6, june: 6,
  jul: 7, juil: 7, july: 7, juillet: 7,
  aug: 8, aou: 8, aoû: 8, août: 8, august: 8,
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

const KEYWORD = /(exp|bbe|bb|dlc|ddm|dluo|best before|use by|consommer|ينتهي|الانتهاء)/i;

export function findExpiryDate(text: string): string | null {
  const flat = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)); // Arabic-Indic digits
  const lines = flat.split(/\r?\n/);
  const found: { date: string; keyed: boolean }[] = [];

  for (const line of lines) {
    const keyed = KEYWORD.test(line);
    const add = (date: string | null) => date && found.push({ date, keyed });

    for (const m of line.matchAll(/\b(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})\b/g)) add(iso(+m[1], +m[2], +m[3]));
    for (const m of line.matchAll(/\b(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4}|\d{2})\b/g)) {
      add(iso(fullYear(m[3]), +m[2], +m[1]));
    }
    for (const m of line.matchAll(/(?<![\d./\-])(\d{1,2})[./\-](\d{4})\b/g)) add(iso(+m[2], +m[1], daysIn(+m[2], +m[1])));
    if (keyed) {
      for (const m of line.matchAll(/\b(\d{1,2})[./\-\s](\d{2})\b/g)) {
        const month = +m[1];
        if (month >= 1 && month <= 12) add(iso(2000 + +m[2], month, daysIn(2000 + +m[2], month)));
      }
    }
    for (const m of line.matchAll(/\b(\d{1,2})?\s*([a-zA-Zéèûôàç]{3,9})\.?\s*[-/]?\s*(\d{4}|\d{2})\b/g)) {
      const month = MONTH_WORDS[m[2].toLowerCase()];
      if (!month) continue;
      const year = fullYear(m[3]);
      add(iso(year, month, m[1] ? +m[1] : daysIn(year, month)));
    }
  }

  if (found.length === 0) return null;
  const pool = found.some((f) => f.keyed) ? found.filter((f) => f.keyed) : found;
  return pool.map((f) => f.date).sort().at(-1) ?? null;
}
