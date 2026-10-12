import { describe, expect, it } from 'vitest';
import { berekenOfferte, prijsPerBezoek, vindKlasse, type Keuzes } from './pricing';

const geenExtras = { afval: false, onkruid: false, blad: false };

describe('prijsklassen', () => {
  it('kiest de juiste klasse, grenzen inbegrepen', () => {
    expect(vindKlasse(100)?.label).toBe('t/m 100 m²');
    expect(vindKlasse(101)?.label).toBe('101–200 m²');
    expect(vindKlasse(350)?.label).toBe('201–350 m²');
    expect(vindKlasse(750)?.label).toBe('501–750 m²');
  });

  it('geeft geen online prijs boven 750 m² of bij 0 m²', () => {
    expect(vindKlasse(751)).toBeNull();
    expect(vindKlasse(0)).toBeNull();
  });

  it('berekent de prijs per bezoek uit tijd, personen en uurtarief', () => {
    // 45 min × 2 personen = 1,5 manuur × € 45 + € 7,50 = € 75
    expect(prijsPerBezoek(vindKlasse(216)!, 1.0)).toBe(75);
    // 35 min × 0,8 = 28 min × € 45/u + € 7,50 = € 28,50 → € 29
    expect(prijsPerBezoek(vindKlasse(80)!, 0.8)).toBe(29);
    expect(prijsPerBezoek(vindKlasse(180)!, 1.0)).toBe(49);
    expect(prijsPerBezoek(vindKlasse(400)!, 1.3)).toBe(144);
  });
});

describe('offerte', () => {
  it('216 m², haag 15 m, Comfort, groenafval, per maand', () => {
    const k: Keuzes = { m2: 216, haagMeter: 15, pakket: 'comfort', extras: { ...geenExtras, afval: true }, termijn: 'maand' };
    const o = berekenOfferte(k)!;
    expect(o.jaarBruto).toBe(1119); // 900 + 75 + 144
    expect(o.termijnBedrag).toBe(93.25);
  });

  it('180 m², haag 12 m, Comfort, groenafval, per jaar met korting', () => {
    const k: Keuzes = { m2: 180, haagMeter: 12, pakket: 'comfort', extras: { ...geenExtras, afval: true }, termijn: 'jaar' };
    const o = berekenOfferte(k)!;
    expect(o.jaarBruto).toBe(744); // 588 + 60 + 96
    expect(o.korting).toBe(22.32);
    expect(o.termijnBedrag).toBe(721.68);
  });

  it('80 m², Basis, geen haag of extra’s, per kwartaal', () => {
    const k: Keuzes = { m2: 80, haagMeter: 0, pakket: 'basis', extras: geenExtras, termijn: 'kwartaal' };
    const o = berekenOfferte(k)!;
    expect(o.jaarBruto).toBe(174);
    expect(o.termijnBedrag).toBe(43.5);
    expect(o.regels).toHaveLength(1);
  });

  it('alle extra’s bij Premium', () => {
    const k: Keuzes = { m2: 300, haagMeter: 20, pakket: 'premium', extras: { afval: true, onkruid: true, blad: true }, termijn: 'maand' };
    const o = berekenOfferte(k)!;
    // 95 × 20 = 1900, haag 20 × 2,5 × 2 = 100, afval 12 × 20 = 240, onkruid 8 × 20 = 160, blad 95
    expect(o.jaarBruto).toBe(2495);
  });

  it('geeft null voor te grote tuinen', () => {
    expect(berekenOfferte({ m2: 900, haagMeter: 0, pakket: 'comfort', extras: geenExtras, termijn: 'maand' })).toBeNull();
  });
});
