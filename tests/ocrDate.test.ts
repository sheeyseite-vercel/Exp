import { describe, expect, it } from 'vitest';
import { findExpiryDate } from '../src/lib/ocrDate';

describe('findExpiryDate', () => {
  it('reads dd/mm/yyyy', () => {
    expect(findExpiryDate('EXP 24/11/2026')).toBe('2026-11-24');
  });
  it('reads month/year as end of month', () => {
    expect(findExpiryDate('Best before 03/2027')).toBe('2027-03-31');
  });
  it('prefers the date next to an expiry keyword', () => {
    expect(findExpiryDate('PROD 01/06/2026\nEXP 01/12/2026')).toBe('2026-12-01');
  });
  it('takes the latest date when nothing is labelled', () => {
    expect(findExpiryDate('01.06.2026 15.12.2026')).toBe('2026-12-15');
  });
  it('reads month names', () => {
    expect(findExpiryDate('A consommer avant le 05 NOV 2026')).toBe('2026-11-05');
  });
  it('reads Arabic-Indic digits', () => {
    expect(findExpiryDate('ينتهي ٢٤/١١/٢٠٢٦')).toBe('2026-11-24');
  });
  it('returns null when there is no date', () => {
    expect(findExpiryDate('زبادي طبيعي 125 غ')).toBeNull();
  });
});
