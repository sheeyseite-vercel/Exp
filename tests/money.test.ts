import { describe, expect, it } from 'vitest';
import {
  centsToInput,
  formatMoney,
  formatQty,
  invoiceTotal,
  lineTotal,
  margin,
  parseMoney,
  parseQty,
  reconcile,
} from '../src/lib/money';

describe('money parsing', () => {
  it('parses prices exactly', () => {
    expect(parseMoney('125.5')).toBe(12550);
    expect(parseMoney('125,50')).toBe(12550);
    expect(parseMoney('0.1')).toBe(10);
    expect(parseMoney('١٢٫٥')).toBe(1250);
    expect(parseMoney('7')).toBe(700);
  });
  it('rejects invalid prices', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('-3')).toBeNull();
  });
  it('parses quantities in thousandths', () => {
    expect(parseQty('12')).toBe(12000);
    expect(parseQty('0.25')).toBe(250);
    expect(parseQty('1.0005')).toBeNull();
  });
});

describe('totals', () => {
  it('does not drift like floats', () => {
    // 0.1 + 0.2 style trap: 3 x 0.10 + 3 x 0.20
    expect(invoiceTotal([{ qtyMilli: 3000, unitCents: 10 }, { qtyMilli: 3000, unitCents: 20 }])).toBe(90);
  });
  it('rounds half up per line', () => {
    expect(lineTotal(500, 5)).toBe(3); // 0.5 x 0.05 = 0.025 -> 0.03
    expect(lineTotal(1500, 1999)).toBe(2999); // 1.5 x 19.99 = 29.985 -> 29.99
  });
  it('formats', () => {
    expect(formatMoney(123456789)).toBe('1 234 567.89');
    expect(formatMoney(5)).toBe('0.05');
    expect(formatMoney(-250)).toBe('-2.50');
    expect(formatQty(2500)).toBe('2.5');
    expect(formatQty(3000)).toBe('3');
    expect(centsToInput(12550)).toBe('125.5');
    expect(centsToInput(1200)).toBe('12');
  });
});

describe('reconcile and margin', () => {
  it('reports match, over and short', () => {
    expect(reconcile(1000, 1000)).toEqual({ state: 'match', diff: 0 });
    expect(reconcile(1050, 1000)).toEqual({ state: 'over', diff: 50 });
    expect(reconcile(950, 1000)).toEqual({ state: 'short', diff: -50 });
  });
  it('computes margin', () => {
    expect(margin(10000, 12500)).toEqual({ profit: 2500, percentTenths: 250 });
    expect(margin(0, 500)).toEqual({ profit: 500, percentTenths: null });
  });
});
