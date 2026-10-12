// Vercel Function: ontvangt een aanvraag uit de configurator.
// - controleert de invoer
// - rekent de prijs opnieuw uit op de server (de prijs uit de browser wordt niet vertrouwd)
// - mailt de aanvraag naar de hovenier via Resend, als RESEND_API_KEY en NOTIFY_EMAIL zijn ingesteld
//   (zonder die instellingen komt de aanvraag alleen in de logs van Vercel).

import { config, type ExtraId, type PakketId, type Termijn } from '../src/config';
import { berekenOfferte, euro, termijnen } from '../src/pricing';
import { emailGeldig, postcodeGeldig, type AanvraagPayload } from '../src/aanvraag';

interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const PAKKETTEN: PakketId[] = ['basis', 'comfort', 'premium'];
const TERMIJNEN: Termijn[] = ['maand', 'kwartaal', 'jaar'];
const EXTRA_NAMEN: Record<ExtraId, string> = {
  afval: 'Groenafval afvoeren',
  onkruid: 'Onkruid terras en paden',
  blad: 'Bladruimen najaar',
};

const isTekst = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isGetal = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;

function valideer(b: unknown): AanvraagPayload | string {
  if (!b || typeof b !== 'object') return 'Ongeldige aanvraag';
  const p = b as Partial<AanvraagPayload>;
  if (p.route !== 'weet' && p.route !== 'schat') return 'Ongeldige route';
  if (!p.adres || !isTekst(p.adres.postcode, 7) || !postcodeGeldig(p.adres.postcode)) return 'Ongeldige postcode';
  if (!isTekst(p.adres.huisnummer, 10) || !p.adres.huisnummer.trim()) return 'Ongeldig huisnummer';
  if (!p.tuin || !isGetal(p.tuin.m2, 100000) || !isGetal(p.tuin.haagMeter, 10000)) return 'Ongeldige tuinmaten';
  if (!p.pakket || !PAKKETTEN.includes(p.pakket)) return 'Ongeldig pakket';
  if (!p.termijn || !TERMIJNEN.includes(p.termijn)) return 'Ongeldige termijn';
  if (!p.extras || typeof p.extras !== 'object') return "Ongeldige extra's";
  const extras = {
    afval: p.extras.afval === true,
    onkruid: p.extras.onkruid === true,
    blad: p.extras.blad === true,
  };
  if (!p.contact || !isTekst(p.contact.naam, 100) || !p.contact.naam.trim()) return 'Naam ontbreekt';
  if (!isTekst(p.contact.email, 200) || !emailGeldig(p.contact.email)) return 'Ongeldig e-mailadres';
  const telefoon = isTekst(p.contact.telefoon, 30) ? p.contact.telefoon : '';
  const s = p.schatting;
  const schatting =
    s && typeof s === 'object' && isGetal(s.perceelM2, 1e7) && isGetal(s.bebouwdM2, 1e7) && isGetal(s.onbebouwdM2, 1e7)
      ? { perceelM2: Math.round(s.perceelM2), bebouwdM2: Math.round(s.bebouwdM2), onbebouwdM2: Math.round(s.onbebouwdM2) }
      : null;
  return {
    route: p.route,
    adres: { postcode: p.adres.postcode.trim().toUpperCase(), huisnummer: p.adres.huisnummer.trim() },
    tuin: { m2: Math.round(p.tuin.m2), haagMeter: Math.round(p.tuin.haagMeter) },
    pakket: p.pakket,
    extras,
    termijn: p.termijn,
    contact: { naam: p.contact.naam.trim(), email: p.contact.email.trim(), telefoon: telefoon.trim() },
    akkoordVoorwaarden: p.akkoordVoorwaarden === true,
    startBinnenBedenktijd: p.startBinnenBedenktijd === true,
    schatting,
    website: typeof p.website === 'string' ? p.website : '',
  };
}

function maakMail(a: AanvraagPayload) {
  const offerte = berekenOfferte({ m2: a.tuin.m2, haagMeter: a.tuin.haagMeter, pakket: a.pakket, extras: a.extras, termijn: a.termijn });
  const afsluiting = a.route === 'weet' && offerte !== null;
  const soort = afsluiting ? 'Afsluiting (vaste prijs)' : 'Schouwaanvraag (indicatie)';
  const gekozenExtras = (Object.keys(EXTRA_NAMEN) as ExtraId[]).filter((id) => a.extras[id]).map((id) => EXTRA_NAMEN[id]);

  const regels = [
    `Nieuwe aanvraag via de website: ${soort}`,
    '',
    'KLANT',
    `Naam: ${a.contact.naam}`,
    `E-mail: ${a.contact.email}`,
    `Telefoon: ${a.contact.telefoon || '-'}`,
    `Adres: ${a.adres.postcode} ${a.adres.huisnummer}`,
    '',
    'TUIN',
    `Tuin: ${a.tuin.m2} m²${offerte ? ` (prijsklasse ${offerte.klasse.label})` : ' (te groot voor online prijs)'}`,
    `Haag: ${a.tuin.haagMeter} m`,
    `Maat opgegeven door: ${a.route === 'weet' ? 'klant zelf' : 'schatting, door klant bevestigd of aangepast'}`,
    ...(a.schatting
      ? [
          `Kaartgegevens (PDOK): perceel ${a.schatting.perceelM2} m², bebouwd ${a.schatting.bebouwdM2} m², onbebouwd ${a.schatting.onbebouwdM2} m²`,
        ]
      : []),
    '',
  ];

  if (offerte) {
    regels.push(
      'ABONNEMENT',
      `Pakket: ${offerte.pakket.naam} (${offerte.pakket.bezoekenPerJaar} bezoeken per jaar, ${euro(offerte.prijsPerBezoek, 0)} per bezoek)`,
      `Extra's: ${gekozenExtras.length ? gekozenExtras.join(', ') : 'geen'}`,
      `Betaling: ${termijnen[a.termijn].label}`,
      '',
      'PRIJS (incl. btw)',
      ...offerte.regels.map((r) => `- ${r.label}: ${euro(r.bedrag)}`),
      ...(offerte.korting > 0 ? [`- Korting jaarbetaling: −${euro(offerte.korting)}`] : []),
      `Jaartotaal: ${euro(offerte.jaarNetto)}`,
      `Termijnbedrag: ${euro(offerte.termijnBedrag)} ${termijnen[a.termijn].lang}`,
      '',
    );
  }

  if (afsluiting) {
    regels.push(
      'AFSPRAKEN',
      `Akkoord algemene voorwaarden: ${a.akkoordVoorwaarden ? 'ja' : 'nee'}`,
      `Start binnen bedenktijd gewenst: ${a.startBinnenBedenktijd ? 'ja' : 'nee'}`,
      '',
      'Volgende stap: stuur het contract en een machtigingslink (iDEAL) naar de klant.',
    );
  } else {
    regels.push('Volgende stap: plan een schouw in en stuur daarna de definitieve prijs.');
  }

  const onderwerp = `${afsluiting ? 'Nieuw abonnement' : 'Schouwaanvraag'}: ${a.contact.naam} (${a.adres.postcode})`.replace(/[\r\n]+/g, ' ');
  return { onderwerp, tekst: regels.join('\n'), afsluiting };
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, fout: 'Alleen POST is toegestaan' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const aanvraag = valideer(body);
  if (typeof aanvraag === 'string') return res.status(400).json({ ok: false, fout: aanvraag });

  // Honeypot ingevuld: waarschijnlijk een bot. Doe alsof het gelukt is, maar verstuur niets.
  if (aanvraag.website) return res.status(200).json({ ok: true });

  const { onderwerp, tekst, afsluiting } = maakMail(aanvraag);
  if (afsluiting && !aanvraag.akkoordVoorwaarden) {
    return res.status(400).json({ ok: false, fout: 'Akkoord met de voorwaarden ontbreekt' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const naar = process.env.NOTIFY_EMAIL;
  const van = process.env.FROM_EMAIL || `${config.bedrijf.naam} <onboarding@resend.dev>`;

  if (!apiKey || !naar) {
    console.log(`[aanvraag] ${onderwerp}\n${tekst}`);
    return res.status(200).json({ ok: true, gemaild: false });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: van,
        to: naar.split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: aanvraag.contact.email,
        subject: onderwerp,
        text: tekst,
      }),
    });
    if (!r.ok) {
      console.error('[aanvraag] Resend gaf een fout', r.status, await r.text());
      console.log(`[aanvraag] ${onderwerp}\n${tekst}`);
      return res.status(502).json({ ok: false, fout: 'Versturen van de e-mail mislukte' });
    }
    return res.status(200).json({ ok: true, gemaild: true });
  } catch (e) {
    console.error('[aanvraag] Fout bij versturen', e);
    console.log(`[aanvraag] ${onderwerp}\n${tekst}`);
    return res.status(502).json({ ok: false, fout: 'Versturen van de e-mail mislukte' });
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
