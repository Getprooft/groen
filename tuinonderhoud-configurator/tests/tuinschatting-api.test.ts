import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/tuinschatting';
import aanvraagHandler from '../api/aanvraag';

function nepRes() {
  const r = {
    code: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(c: number) {
      r.code = c;
      return r;
    },
    json(b: unknown) {
      r.body = b;
    },
    setHeader(k: string, v: string) {
      r.headers[k] = v;
    },
  };
  return r;
}

const rect = (x1: number, y1: number, x2: number, y2: number) => ({
  type: 'Polygon',
  coordinates: [[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]],
});

function stubPdok(adresDocs: unknown[] = [{ weergavenaam: 'Teststraat 12, 7551AB Hengelo', huis_nlt: '12', centroide_rd: 'POINT(100 100)' }]) {
  vi.stubGlobal('fetch', async (url: string) => {
    const body = url.includes('locatieserver')
      ? { response: { docs: adresDocs } }
      : url.includes('/perceel/items')
        ? { features: [{ properties: { kadastrale_grootte_waarde: 300 }, geometry: rect(90, 90, 110, 105) }] }
        : { features: [{ properties: { status: 'Pand in gebruik' }, geometry: rect(95, 92, 105, 102) }] };
    return { ok: true, status: 200, json: async () => body };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api/tuinschatting', () => {
  it('geeft perceel, bebouwd en onbebouwd oppervlak terug', async () => {
    stubPdok();
    const res = nepRes();
    await handler({ method: 'GET', query: { postcode: '7551 AB', huisnummer: '12' } }, res);
    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({ ok: true, perceelM2: 300, bebouwdM2: 100, onbebouwdM2: 200 });
    expect(res.headers['Cache-Control']).toContain('s-maxage');
  });

  it('weigert ongeldige invoer zonder PDOK aan te roepen', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const res = nepRes();
    await handler({ method: 'GET', query: { postcode: 'abc', huisnummer: '12' } }, res);
    expect(res.code).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it('geeft 404 als het adres niet bestaat', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubPdok([]);
    const res = nepRes();
    await handler({ method: 'GET', query: { postcode: '7551AB', huisnummer: '999' } }, res);
    expect(res.code).toBe(404);
    expect(res.body).toMatchObject({ code: 'adres_niet_gevonden' });
  });

  it('geeft 502 als PDOK onbereikbaar is', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => {
      throw new Error('netwerk');
    });
    const res = nepRes();
    await handler({ method: 'GET', query: { postcode: '7551AB', huisnummer: '12' } }, res);
    expect(res.code).toBe(502);
  });
});

describe('api/aanvraag met schatting', () => {
  it('neemt de kaartgegevens op in de mail', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = nepRes();
    await aanvraagHandler(
      {
        method: 'POST',
        body: {
          route: 'schat',
          adres: { postcode: '7551 AB', huisnummer: '12' },
          tuin: { m2: 140, haagMeter: 0 },
          pakket: 'comfort',
          extras: { afval: false, onkruid: false, blad: false },
          termijn: 'maand',
          contact: { naam: 'Piet', email: 'piet@example.nl', telefoon: '' },
          akkoordVoorwaarden: false,
          startBinnenBedenktijd: false,
          schatting: { perceelM2: 300, bebouwdM2: 100, onbebouwdM2: 200 },
          website: '',
        },
      },
      res,
    );
    expect(res.code).toBe(200);
    expect(String(log.mock.calls[0][0])).toContain('Kaartgegevens (PDOK): perceel 300 m², bebouwd 100 m², onbebouwd 200 m²');
  });
});
