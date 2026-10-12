import { describe, expect, it } from 'vitest';
import { kiesAdres, oppervlak, parsePunt, schatTuinViaPdok, SchattingFout } from '../server/pdok';

// Rechthoek als GeoJSON-polygoon (gesloten ring).
const rect = (x1: number, y1: number, x2: number, y2: number) => ({
  type: 'Polygon',
  coordinates: [[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]],
});

const adressen = {
  response: {
    docs: [
      { weergavenaam: 'Teststraat 12A, 7551AB Hengelo', huis_nlt: '12A', huisletter: 'A', centroide_rd: 'POINT(500 500)' },
      { weergavenaam: 'Teststraat 12, 7551AB Hengelo', huis_nlt: '12', centroide_rd: 'POINT(100 100)', gekoppeld_perceel: ['HGL01-A-1'] },
    ],
  },
};

const percelen = {
  features: [
    // Buurperceel (bevat het adrespunt niet)
    { properties: { kadastrale_grootte_waarde: 300 }, geometry: rect(110, 90, 130, 105) },
    // Eigen perceel: 20 × 15 = 300 m²
    {
      properties: { kadastrale_grootte_waarde: 300, akr_kadastrale_gemeente_code_waarde: 'HGL01', sectie: 'A', perceelnummer: 1 },
      geometry: rect(90, 90, 110, 105),
    },
  ],
};

const panden = {
  features: [
    // Woning, volledig op het perceel: 10 × 10 = 100 m²
    { properties: { status: 'Pand in gebruik' }, geometry: rect(95, 92, 105, 102) },
    // Rij-pand dat doorloopt naar de buren: alleen 5 × 8 = 40 m² ligt op dit perceel
    { properties: { status: 'Pand in gebruik' }, geometry: rect(105, 92, 125, 100) },
    // Gesloopte schuur telt niet mee
    { properties: { status: 'Pand gesloopt' }, geometry: rect(92, 103, 94, 104) },
  ],
};

function nepFetch(overrides: Partial<Record<'adres' | 'perceel' | 'pand', unknown>> = {}) {
  const urls: string[] = [];
  const f = async (url: string) => {
    urls.push(url);
    const body = url.includes('locatieserver')
      ? (overrides.adres ?? adressen)
      : url.includes('/perceel/items')
        ? (overrides.perceel ?? percelen)
        : (overrides.pand ?? panden);
    return { ok: true, status: 200, json: async () => body };
  };
  return { f, urls };
}

describe('hulpfuncties', () => {
  it('leest een WKT-punt', () => {
    expect(parsePunt('POINT(135782.745 452910.011)')).toEqual([135782.745, 452910.011]);
    expect(parsePunt('onzin')).toBeNull();
  });

  it('berekent oppervlak, ook met een gat', () => {
    expect(oppervlak([[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]])).toBe(100);
    expect(
      oppervlak([[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]]]),
    ).toBe(96);
  });

  it('kiest het juiste adres bij huisletters', () => {
    const docs = adressen.response.docs;
    expect(kiesAdres(docs, '12')?.huis_nlt).toBe('12');
    expect(kiesAdres(docs, '12a')?.huis_nlt).toBe('12A');
    expect(kiesAdres(docs, '12 A')?.huis_nlt).toBe('12A');
  });
});

describe('schatTuinViaPdok', () => {
  it('rekent perceel min het bebouwde deel binnen het perceel', async () => {
    const { f, urls } = nepFetch();
    const s = await schatTuinViaPdok('7551 ab', '12', f);
    expect(s).toEqual({
      adres: 'Teststraat 12, 7551AB Hengelo',
      perceelCode: 'HGL01-A-1',
      perceelM2: 300,
      bebouwdM2: 140,
      onbebouwdM2: 160,
    });
    expect(urls[0]).toContain('postcode%3A7551AB');
    expect(urls[1]).toContain('bbox-crs=');
    expect(urls[1]).toContain('EPSG%2F0%2F28992');
  });

  it('meldt een onbekend adres', async () => {
    const { f } = nepFetch({ adres: { response: { docs: [] } } });
    await expect(schatTuinViaPdok('7551AB', '999', f)).rejects.toMatchObject({ code: 'adres_niet_gevonden' });
  });

  it('meldt een ontbrekend perceel', async () => {
    const { f } = nepFetch({ perceel: { features: [] } });
    await expect(schatTuinViaPdok('7551AB', '12', f)).rejects.toMatchObject({ code: 'perceel_niet_gevonden' });
  });

  it('meldt als PDOK niet bereikbaar is', async () => {
    const f = async () => {
      throw new Error('netwerk');
    };
    const fout = await schatTuinViaPdok('7551AB', '12', f).catch((e) => e);
    expect(fout).toBeInstanceOf(SchattingFout);
    expect(fout.code).toBe('pdok_onbereikbaar');
  });

  it('meldt een foutstatus van PDOK', async () => {
    const f = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await expect(schatTuinViaPdok('7551AB', '12', f)).rejects.toMatchObject({ code: 'pdok_onbereikbaar' });
  });
});
