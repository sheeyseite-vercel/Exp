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

describe('findExpiryDate on messy label text', () => {
  it('reads the printed example from a bottle cap', () => {
    expect(findExpiryDate('F:28/10/26 08:49\nE:04/2029 LOT:282371')).toBe('2029-04-30');
    expect(findExpiryDate('F: 28/10/26 08:49 E: 04/2029 LOT:282371')).toBe('2029-04-30');
  });
  it('handles OCR letter/digit mix-ups and compact forms', () => {
    expect(findExpiryDate('EXP 3O/04/2029')).toBe('2029-04-30');
    expect(findExpiryDate('EXP 300429')).toBe('2029-04-30');
    expect(findExpiryDate('BB 2029/04')).toBe('2029-04-30');
    expect(findExpiryDate('A consommer avant le 15 JUIN 2028')).toBe('2028-06-15');
  });
  it('prefers the expiry over a production date', () => {
    expect(findExpiryDate('PROD 01/01/2026\nEXP 01/01/2027')).toBe('2027-01-01');
  });
});
