import { describe, expect, it } from 'vitest';
import { extractExpiry, parseGs1Date, parseScan } from '../src/lib/qr';

describe('qr parsing', () => {
  it('reads GS1 dates', () => {
    expect(parseGs1Date('261121')).toBe('2026-11-21');
    expect(parseGs1Date('260200')).toBe('2026-02-28');
    expect(parseGs1Date('261321')).toBeUndefined();
    expect(parseGs1Date('abc')).toBeUndefined();
  });

  it('finds an expiry date in different formats', () => {
    expect(extractExpiry('(01)06111234567890(17)261121(10)AB12')).toBe('2026-11-21');
    expect(extractExpiry('https://id.example/01/06111234567890?17=261121')).toBe('2026-11-21');
    expect(extractExpiry('EXP 21/11/2026')).toBe('2026-11-21');
    expect(extractExpiry('Best before: 2026-11-21')).toBe('2026-11-21');
    expect(extractExpiry('تاريخ الانتهاء 21.11.2026')).toBe('2026-11-21');
    expect(extractExpiry('hello world')).toBeUndefined();
  });

  it('extracts the barcode from a plain EAN', () => {
    expect(parseScan('6111234567890')).toEqual({ barcode: '6111234567890' });
  });

  it('extracts barcode and expiry from a GS1 string', () => {
    const info = parseScan('(01)06111234567890(17)261121');
    expect(info.barcode).toBe('06111234567890');
    expect(info.expiry).toBe('2026-11-21');
    expect(info.name).toBeUndefined();
  });

  it('uses plain text as the product name', () => {
    const info = parseScan('حليب كامل الدسم\nEXP 21/11/2026');
    expect(info.name).toBe('حليب كامل الدسم');
    expect(info.expiry).toBe('2026-11-21');
  });

  it('does not treat a URL as a name', () => {
    expect(parseScan('https://example.com/p/123').name).toBeUndefined();
  });

  it('handles empty input', () => {
    expect(parseScan('   ')).toEqual({});
  });
});
