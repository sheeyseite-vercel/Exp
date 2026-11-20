import { describe, expect, it } from 'vitest';
import { addDays, chipLabel, daysPhrase, daysUntil, formatDay, isValidISO, shelfProgress, statusOf } from '../src/lib/dates';

const today = new Date(2026, 10, 17, 15, 30);

describe('dates', () => {
  it('counts whole calendar days regardless of the time of day', () => {
    expect(daysUntil('2026-11-17', today)).toBe(0);
    expect(daysUntil('2026-11-20', today)).toBe(3);
    expect(daysUntil('2026-11-16', today)).toBe(-1);
    expect(daysUntil('2026-11-20', new Date(2026, 10, 17, 0, 0))).toBe(3);
    expect(daysUntil('2026-11-20', new Date(2026, 10, 17, 23, 59))).toBe(3);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('validates ISO dates', () => {
    expect(isValidISO('2026-02-28')).toBe(true);
    expect(isValidISO('2026-02-30')).toBe(false);
    expect(isValidISO('')).toBe(false);
    expect(isValidISO('21/11/2026')).toBe(false);
  });

  it('classifies status', () => {
    expect(statusOf(-1)).toBe('expired');
    expect(statusOf(0)).toBe('urgent');
    expect(statusOf(2)).toBe('urgent');
    expect(statusOf(3)).toBe('soon');
    expect(statusOf(7)).toBe('soon');
    expect(statusOf(8)).toBe('fresh');
  });

  it('writes Arabic labels', () => {
    expect(chipLabel(-3)).toBe('منتهٍ');
    expect(chipLabel(1)).toBe('غدًا');
    expect(daysPhrase(1)).toBe('يوم واحد');
    expect(daysPhrase(2)).toBe('يومين');
    expect(daysPhrase(5)).toBe('5 أيام');
    expect(daysPhrase(14)).toBe('14 يومًا');
    expect(formatDay('2026-01-05')).toBe('5 جانفي');
    expect(formatDay('2026-06-21')).toBe('21 جوان');
  });

  it('keeps shelf progress between 0 and 100', () => {
    expect(shelfProgress('2026-11-10', '2026-11-24', new Date(2026, 10, 17))).toBe(50);
    expect(shelfProgress('2026-11-10', '2026-11-24', new Date(2026, 11, 30))).toBe(100);
    expect(shelfProgress('2026-11-10', '2026-11-24', new Date(2026, 10, 1))).toBe(0);
  });
});
