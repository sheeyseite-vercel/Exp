/** Exact calculator: every number is a fraction of two big integers, so 0.1 + 0.2 is exactly 0.3. */

interface Frac {
  n: bigint;
  d: bigint;
}

const abs = (x: bigint) => (x < 0n ? -x : x);
function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) [x, y] = [y, x % y];
  return x === 0n ? 1n : x;
}
function frac(n: bigint, d: bigint): Frac {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
function div(a: Frac, b: Frac): Frac {
  if (b.n === 0n) throw new Error('division by zero');
  return frac(a.n * b.d, a.d * b.n);
}

function parseNumber(text: string): Frac {
  const [whole, part = ''] = text.split('.');
  const digits = `${whole || '0'}${part}`;
  return frac(BigInt(digits), 10n ** BigInt(part.length));
}

/** Evaluates "12.5×4+3%" style text. Returns null when the text is not a complete expression. */
export function evaluate(text: string): Frac | null {
  const src = text.replace(/\s+/g, '');
  let i = 0;
  const peek = () => src[i];

  function number(): Frac {
    let sign = 1n;
    if (peek() === '−' || peek() === '-') {
      sign = -1n;
      i += 1;
    }
    const start = i;
    while (i < src.length && /[0-9.]/.test(src[i])) i += 1;
    const raw = src.slice(start, i);
    if (raw === '' || raw === '.' || (raw.match(/\./g) ?? []).length > 1) throw new Error('number expected');
    let value = parseNumber(raw.startsWith('.') ? `0${raw}` : raw.endsWith('.') ? `${raw}0` : raw);
    while (peek() === '%') {
      value = div(value, frac(100n, 1n));
      i += 1;
    }
    return frac(value.n * sign, value.d);
  }

  function term(): Frac {
    let value = number();
    while (peek() === '×' || peek() === '÷' || peek() === '*' || peek() === '/') {
      const op = src[i];
      i += 1;
      const right = number();
      value = op === '×' || op === '*' ? mul(value, right) : div(value, right);
    }
    return value;
  }

  try {
    let value = term();
    while (peek() === '+' || peek() === '−' || peek() === '-') {
      const op = src[i];
      i += 1;
      const right = term();
      value = op === '+' ? add(value, right) : sub(value, right);
    }
    return i === src.length ? value : null;
  } catch {
    return null;
  }
}

/** Decimal text with at most `places` decimals (half away from zero), trailing zeros removed. */
export function toDecimal(value: Frac, places = 6, keepZeros = false): string {
  const scale = 10n ** BigInt(places);
  const scaled = abs(value.n) * scale;
  let q = scaled / value.d;
  if ((scaled % value.d) * 2n >= value.d) q += 1n;
  const negative = value.n < 0n && q !== 0n;
  const s = q.toString().padStart(places + 1, '0');
  const whole = s.slice(0, s.length - places);
  let part = s.slice(s.length - places);
  if (!keepZeros) part = part.replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${part ? `.${part}` : ''}`;
}

/** The result as money with exactly two decimals, e.g. "14.45". */
export function toMoney(value: Frac): string {
  return toDecimal(value, 2, true);
}
