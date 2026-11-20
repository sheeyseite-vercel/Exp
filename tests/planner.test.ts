import { describe, expect, it } from 'vitest';
import { notificationBody, parseTime, planNotifications } from '../src/lib/planner';
import { DEFAULT_SETTINGS, type Product, type Settings } from '../src/lib/types';

const now = new Date(2026, 10, 17, 8, 0);

function product(over: Partial<Product>): Product {
  return {
    id: 'p1',
    user_id: 'u',
    name: 'حليب',
    category: 'dairy',
    expiry_date: '2026-11-24',
    quantity: 1,
    photo_path: null,
    barcode: null,
    remind_days: null,
    consumed_at: null,
    created_at: '2026-11-10T10:00:00Z',
    updated_at: '2026-11-10T10:00:00Z',
    ...over,
  };
}

describe('planner', () => {
  it('schedules one notification per rule at the chosen time', () => {
    const plan = planNotifications([product({})], DEFAULT_SETTINGS, now);
    expect(plan).toHaveLength(3);
    expect(plan.map((p) => p.at.getDate())).toEqual([17, 23, 24]);
    expect(plan.every((p) => p.at.getHours() === 9 && p.at.getMinutes() === 0)).toBe(true);
    expect(plan.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('skips reminders whose time has passed', () => {
    const late = new Date(2026, 10, 23, 12, 0);
    const plan = planNotifications([product({})], DEFAULT_SETTINGS, late);
    expect(plan).toHaveLength(1);
    expect(plan[0].at.getDate()).toBe(24);
  });

  it('returns nothing when notifications are off', () => {
    const off: Settings = { ...DEFAULT_SETTINGS, notifications_enabled: false };
    expect(planNotifications([product({})], off, now)).toEqual([]);
  });

  it('skips consumed products', () => {
    expect(planNotifications([product({ consumed_at: '2026-11-16T10:00:00Z' })], DEFAULT_SETTINGS, now)).toEqual([]);
  });

  it('prefers the per-product rules over the defaults', () => {
    const plan = planNotifications([product({ remind_days: [1] })], DEFAULT_SETTINGS, now);
    expect(plan).toHaveLength(1);
    expect(plan[0].at.getDate()).toBe(23);
  });

  it('respects the notify time and sorts across products', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, notify_time: '18:45:00', default_remind_days: [0] };
    const plan = planNotifications(
      [product({ id: 'b', expiry_date: '2026-11-30' }), product({ id: 'a', expiry_date: '2026-11-20' })],
      settings,
      now,
    );
    expect(plan.map((p) => p.productId)).toEqual(['a', 'b']);
    expect(plan[0].at.getHours()).toBe(18);
    expect(plan[0].at.getMinutes()).toBe(45);
  });

  it('caps the number of notifications', () => {
    const many = Array.from({ length: 400 }, (_, i) => product({ id: `p${i}`, expiry_date: '2027-01-15' }));
    expect(planNotifications(many, DEFAULT_SETTINGS, now)).toHaveLength(300);
  });

  it('writes the body and parses times', () => {
    expect(notificationBody('حليب', 0, '2026-11-24')).toContain('اليوم');
    expect(notificationBody('حليب', 1, '2026-11-24')).toContain('غدًا');
    expect(notificationBody('حليب', 3, '2026-11-24')).toContain('3 أيام');
    expect(parseTime('07:30:00')).toEqual({ hours: 7, minutes: 30 });
    expect(parseTime('x')).toEqual({ hours: 9, minutes: 0 });
  });

  it('adds the quantity to the message when there are several', () => {
    expect(notificationBody('زبادي', 0, '2026-11-24', 48)).toContain('×48');
    expect(notificationBody('زبادي', 0, '2026-11-24', 1)).not.toContain('×');
  });

  it('plans each batch of the same product on its own date', () => {
    const batches = [
      product({ id: 'x1', expiry_date: '2026-11-20', quantity: 6 }),
      product({ id: 'x2', expiry_date: '2026-11-21', quantity: 48 }),
    ];
    const settings: Settings = { ...DEFAULT_SETTINGS, default_remind_days: [0] };
    const plan = planNotifications(batches, settings, now);
    expect(plan.map((p) => [p.productId, p.at.getDate()])).toEqual([
      ['x1', 20],
      ['x2', 21],
    ]);
    expect(plan[1].body).toContain('×48');
  });
});
