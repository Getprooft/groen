import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/aanvraag';

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

const geldig = {
  route: 'weet',
  adres: { postcode: '7551 AB', huisnummer: '12' },
  tuin: { m2: 216, haagMeter: 15 },
  pakket: 'comfort',
  extras: { afval: true, onkruid: false, blad: false },
  termijn: 'maand',
  contact: { naam: 'Jan Jansen', email: 'jan@example.nl', telefoon: '' },
  akkoordVoorwaarden: true,
  startBinnenBedenktijd: true,
  website: '',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api/aanvraag', () => {
  it('weigert andere methodes dan POST', async () => {
    const res = nepRes();
    await handler({ method: 'GET' }, res);
    expect(res.code).toBe(405);
  });

  it('accepteert een geldige aanvraag en logt hem zonder mailinstellingen', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = nepRes();
    await handler({ method: 'POST', body: geldig }, res);
    expect(res.code).toBe(200);
    expect(res.body).toEqual({ ok: true, gemaild: false });
    // Bedragen gebruiken een vaste spatie (U+00A0) na het euroteken.
    const tekst = String(log.mock.calls[0][0]).replace(/ /g, ' ');
    expect(tekst).toContain('Nieuw abonnement: Jan Jansen');
    expect(tekst).toContain('Jaartotaal: € 1.119,00');
    expect(tekst).toContain('€ 93,25 per maand');
  });

  it('weigert een ongeldige postcode', async () => {
    const res = nepRes();
    await handler({ method: 'POST', body: { ...geldig, adres: { postcode: '12345', huisnummer: '1' } } }, res);
    expect(res.code).toBe(400);
  });

  it('weigert afsluiten zonder akkoord op de voorwaarden', async () => {
    const res = nepRes();
    await handler({ method: 'POST', body: { ...geldig, akkoordVoorwaarden: false } }, res);
    expect(res.code).toBe(400);
  });

  it('een schouwaanvraag heeft geen akkoord nodig', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = nepRes();
    await handler({ method: 'POST', body: { ...geldig, route: 'schat', akkoordVoorwaarden: false } }, res);
    expect(res.code).toBe(200);
  });

  it('verstuurt niets als het honeypot-veld is ingevuld', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = nepRes();
    await handler({ method: 'POST', body: { ...geldig, website: 'spam' } }, res);
    expect(res.code).toBe(200);
    expect(log).not.toHaveBeenCalled();
  });

  it('mailt via Resend als de sleutel is ingesteld', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-sleutel');
    vi.stubEnv('NOTIFY_EMAIL', 'info@voorbeeld.nl');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    const res = nepRes();
    await handler({ method: 'POST', body: geldig }, res);
    expect(res.body).toEqual({ ok: true, gemaild: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const verzonden = JSON.parse(init.body);
    expect(verzonden.to).toEqual(['info@voorbeeld.nl']);
    expect(verzonden.reply_to).toBe('jan@example.nl');
  });
});
