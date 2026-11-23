import { describe, expect, it } from 'vitest';
import { evaluate, toDecimal, toMoney } from '../src/lib/calc';

const calc = (text: string) => {
  const v = evaluate(text);
  return v ? toDecimal(v) : null;
};

describe('exact calculator', () => {
  it('adds decimals without float error', () => {
    expect(calc('0.1+0.2')).toBe('0.3');
    expect(calc('1.1×3')).toBe('3.3');
  });
  it('respects precedence and percent', () => {
    expect(calc('2+3×4')).toBe('14');
    expect(calc('200×10%')).toBe('20');
    expect(calc('100−20%')).toBe('99.8');
  });
  it('divides a total by units and rounds to cents', () => {
    expect(toMoney(evaluate('693.6÷48')!)).toBe('14.45');
    expect(toMoney(evaluate('100÷3')!)).toBe('33.33');
    expect(toMoney(evaluate('200÷3')!)).toBe('66.67');
  });
  it('rejects incomplete expressions and zero division', () => {
    expect(evaluate('5+')).toBeNull();
    expect(evaluate('5÷0')).toBeNull();
  });
});
