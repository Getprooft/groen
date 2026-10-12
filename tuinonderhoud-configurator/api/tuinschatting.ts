// Vercel Function: GET /api/tuinschatting?postcode=7551AB&huisnummer=12
// Schat perceel, bebouwd en onbebouwd oppervlak via PDOK (Kadaster en BAG).

import { postcodeGeldig } from '../src/aanvraag';
import { SchattingFout, schatTuinViaPdok } from '../server/pdok';

interface Req {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const eerste = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, fout: 'Alleen GET is toegestaan' });
  }

  const postcode = eerste(req.query?.postcode).trim();
  const huisnummer = eerste(req.query?.huisnummer).trim();
  if (!postcodeGeldig(postcode) || !/^\d{1,5}/.test(huisnummer) || huisnummer.length > 10) {
    return res.status(400).json({ ok: false, code: 'ongeldige_invoer', fout: 'Controleer postcode en huisnummer' });
  }

  try {
    const schatting = await schatTuinViaPdok(postcode, huisnummer);
    // Kaartgegevens veranderen zelden: een dag cachen op Vercel scheelt aanroepen naar PDOK.
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ ok: true, ...schatting });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    if (e instanceof SchattingFout) {
      const status = e.code === 'pdok_onbereikbaar' ? 502 : 404;
      console.warn(`[tuinschatting] ${postcode} ${huisnummer}: ${e.code} (${e.message})`);
      return res.status(status).json({ ok: false, code: e.code, fout: e.message });
    }
    console.error('[tuinschatting] Onverwachte fout', e);
    return res.status(500).json({ ok: false, code: 'pdok_onbereikbaar', fout: 'Onverwachte fout' });
  }
}
