import { describe, expect, it } from 'vitest';
import { parseRows } from '../src/lib/ocrInvoice';

describe('invoice reading', () => {
  it('reads French rows, derives unit prices and the printed total', () => {
    const r = parseRows([
      'SARL EL BARAKA DISTRIBUTION',
      'Facture N° 123  Date: 12/11/2026',
      'Désignation   Qté   P.U   Montant',
      'Lait Candia 1L   12   150,00   1 800,00',
      '6191234567890 Yaourt Danone   24   45,50   1 092,00',
      'Eau Ifri 1.5L   6   900,00',
      'Net à payer   3 792,00',
    ]);
    expect(r.supplier).toBe('SARL EL BARAKA DISTRIBUTION');
    expect(r.date).toBe('2026-11-12');
    expect(r.lines.map((l) => [l.name, l.qtyMilli, l.unitCents])).toEqual([
      ['Lait Candia 1L', 12000, 15000],
      ['Yaourt Danone', 24000, 4550],
      ['Eau Ifri 1.5L', 6000, 15000],
    ]);
    expect(r.lines[1].barcode).toBe('6191234567890');
    expect(r.printedCents).toBe(379200);
  });

  it('reads Arabic-Indic digits', () => {
    const r = parseRows(['كوكاكولا 33cl   ٢٤   ٣٥   ٨٤٠', 'المجموع   ٨٤٠']);
    expect(r.lines[0].unitCents).toBe(3500);
    expect(r.printedCents).toBe(84000);
  });
});
