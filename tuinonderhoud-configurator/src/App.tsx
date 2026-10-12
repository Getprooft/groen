import { useEffect, useRef, useState } from 'react';
import { config, type ExtraId, type PakketId, type Termijn } from './config';
import { IconTerug } from './icons';
import { Overzicht } from './Overzicht';
import { berekenOfferte, euro, maxOnlineM2, termijnen, type Keuzes } from './pricing';
import { Klaar, StapAfronden, StapBetaling, StapExtras, StapPakket, StapTuin } from './Stappen';
import { emailGeldig, postcodeGeldig, type AanvraagPayload, type Route, type TuinSchatting } from './aanvraag';

function schatFoutTekst(code?: string): string {
  switch (code) {
    case 'adres_niet_gevonden':
      return 'We vonden dit adres niet. Controleer je postcode en huisnummer.';
    case 'perceel_niet_gevonden':
      return 'We vonden geen perceel bij dit adres. Kies "Ik weet de maten" of vraag een schouw aan.';
    case 'ongeldige_invoer':
      return 'Controleer je postcode en huisnummer.';
    default:
      return 'De kaartgegevens zijn nu niet bereikbaar. Probeer het zo opnieuw, of kies "Ik weet de maten".';
  }
}

const STAPPEN = ['Je tuin', 'Pakket', 'Extra’s', 'Betaling', 'Afronden'];
const LAATSTE = STAPPEN.length - 1;

export default function App() {
  const [stap, setStap] = useState(0);
  const [klaar, setKlaar] = useState(false);
  const [route, setRoute] = useState<Route>('weet');

  const [postcode, setPostcode] = useState('');
  const [huisnummer, setHuisnummer] = useState('');
  const [m2Tekst, setM2Tekst] = useState('');
  const [haagTekst, setHaagTekst] = useState('');
  const [schatting, setSchatting] = useState<TuinSchatting | null>(null);
  const [schatFout, setSchatFout] = useState<string | null>(null);
  const [bezigMetSchatten, setBezigMetSchatten] = useState(false);

  const [pakket, setPakket] = useState<PakketId>('comfort');
  const [extras, setExtras] = useState<Record<ExtraId, boolean>>({ afval: true, onkruid: false, blad: false });
  const [termijn, setTermijn] = useState<Termijn>('maand');

  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [telefoon, setTelefoon] = useState('');
  const [website, setWebsite] = useState('');
  const [akkoord, setAkkoord] = useState(false);
  const [directStart, setDirectStart] = useState(true);
  const [verzenden, setVerzenden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const m2 = Number(m2Tekst) || 0;
  const haagMeter = Number(haagTekst) || 0;
  const keuzes: Keuzes = { m2, haagMeter, pakket, extras, termijn };
  const offerte = berekenOfferte(keuzes);

  const teGroot = m2 > maxOnlineM2();
  const adresOk = postcodeGeldig(postcode) && huisnummer.trim().length > 0;
  const tuinOk = adresOk && !teGroot && (route === 'weet' ? m2 > 0 : schatting !== null && m2 > 0);
  const contactOk = naam.trim().length > 0 && emailGeldig(email);
  const afsluiten = route === 'weet' && offerte !== null;
  const kanVersturen = contactOk && (!afsluiten || akkoord) && !verzenden;

  // Bij elke stapwissel naar boven en de focus op de nieuwe titel (fijn voor schermlezers).
  const eersteRender = useRef(true);
  useEffect(() => {
    if (eersteRender.current) {
      eersteRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.getElementById('stap-titel')?.focus({ preventScroll: true });
  }, [stap, klaar]);

  function kiesRoute(r: Route) {
    setRoute(r);
    setSchatFout(null);
    if (r === 'schat') setSchatting(null);
  }

  // Een schatting hoort bij één adres: wijzigt het adres, dan vervalt de schatting.
  function wijzigPostcode(v: string) {
    setPostcode(v);
    setSchatting(null);
  }
  function wijzigHuisnummer(v: string) {
    setHuisnummer(v);
    setSchatting(null);
  }

  async function schatTuin() {
    if (!adresOk) {
      setSchatFout('Vul een geldige postcode (bijvoorbeeld 7551 AB) en je huisnummer in.');
      return;
    }
    setBezigMetSchatten(true);
    setSchatFout(null);
    setSchatting(null);
    try {
      const qs = new URLSearchParams({ postcode: postcode.trim(), huisnummer: huisnummer.trim() });
      const r = await fetch(`/api/tuinschatting?${qs.toString()}`);
      const data = (await r.json().catch(() => null)) as
        | { ok: true; adres: string; perceelM2: number; bebouwdM2: number; onbebouwdM2: number }
        | { ok: false; code?: string }
        | null;
      if (!r.ok || !data || !data.ok) {
        setSchatFout(schatFoutTekst(data && !data.ok ? data.code : undefined));
        return;
      }
      const ruw = data.onbebouwdM2 * (1 - config.schatting.verhardingAandeel);
      const tuinM2 = ruw >= 5 ? Math.max(10, Math.round(ruw / 10) * 10) : 0;
      setSchatting({ adres: data.adres, perceelM2: data.perceelM2, bebouwdM2: data.bebouwdM2, onbebouwdM2: data.onbebouwdM2, tuinM2 });
      setM2Tekst(tuinM2 > 0 ? String(tuinM2) : '');
    } catch {
      setSchatFout(schatFoutTekst());
    } finally {
      setBezigMetSchatten(false);
    }
  }

  function schouwVoorGroteTuin() {
    setRoute('schat');
    setStap(LAATSTE);
  }

  function vorige() {
    setFout(null);
    setStap((s) => (offerte === null ? 0 : Math.max(0, s - 1)));
  }

  async function verstuur() {
    if (!kanVersturen) return;
    setVerzenden(true);
    setFout(null);
    const payload: AanvraagPayload = {
      route: afsluiten ? 'weet' : 'schat',
      adres: { postcode: postcode.trim(), huisnummer: huisnummer.trim() },
      tuin: { m2, haagMeter },
      pakket,
      extras,
      termijn,
      contact: { naam: naam.trim(), email: email.trim(), telefoon: telefoon.trim() },
      akkoordVoorwaarden: akkoord,
      startBinnenBedenktijd: directStart,
      schatting:
        route === 'schat' && schatting
          ? { perceelM2: schatting.perceelM2, bebouwdM2: schatting.bebouwdM2, onbebouwdM2: schatting.onbebouwdM2 }
          : null,
      website,
    };
    try {
      const res = await fetch('/api/aanvraag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setKlaar(true);
    } catch {
      setFout('Versturen is niet gelukt. Probeer het zo nog eens, of neem telefonisch contact met ons op.');
    } finally {
      setVerzenden(false);
    }
  }

  function volgende() {
    if (stap === LAATSTE) {
      void verstuur();
      return;
    }
    setStap((s) => s + 1);
  }

  function opnieuw() {
    setKlaar(false);
    setStap(0);
    setSchatting(null);
    setSchatFout(null);
    setNaam('');
    setEmail('');
    setTelefoon('');
    setAkkoord(false);
  }

  const volgendeMag = stap === 0 ? tuinOk : stap === LAATSTE ? kanVersturen : offerte !== null;
  const knopTekst =
    stap < LAATSTE ? 'Volgende' : verzenden ? 'Versturen…' : afsluiten ? 'Afsluiten' : 'Schouw aanvragen';
  const toonPrijsBalk = offerte !== null && stap > 0;

  return (
    <div className="shell">
      <header className="kop">
        <div className="kop__rij">
          {stap > 0 && !klaar && (
            <button type="button" className="terug mob" aria-label="Vorige stap" onClick={vorige}>
              <IconTerug />
            </button>
          )}
          <div className="merk">
            <img src={config.bedrijf.logo} alt={config.bedrijf.naam} />
            <span className="merk__scheiding desk" />
            <span className="merk__tagline desk">{config.bedrijf.tagline}</span>
          </div>
          {!klaar && (
            <ol className="stappen desk" aria-label="Stappen">
              {STAPPEN.map((label, i) => (
                <li
                  key={label}
                  className={i === stap ? 'is-actief' : i < stap ? 'is-klaar' : undefined}
                  aria-current={i === stap ? 'step' : undefined}
                >
                  <span className="stappen__nr">{i + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          )}
          {!klaar && (
            <span className="kop__stap mob">
              Stap {stap + 1} van {STAPPEN.length} · {STAPPEN[stap]}
            </span>
          )}
        </div>
        {!klaar && (
          <div className="voortgang mob" aria-hidden="true">
            {STAPPEN.map((label, i) => (
              <span key={label} className={i <= stap ? 'is-aan' : undefined} />
            ))}
          </div>
        )}
      </header>

      <div className="lichaam">
        <main className="paneel">
          {klaar ? (
            <Klaar
              route={afsluiten ? 'weet' : 'schat'}
              heeftPrijs={offerte !== null}
              voornaam={naam.trim().split(' ')[0]}
              pakketNaam={offerte?.pakket.naam ?? ''}
              email={email.trim()}
              opnieuw={opnieuw}
            />
          ) : (
            <>
              {stap === 0 && (
                <StapTuin
                  route={route}
                  setRoute={kiesRoute}
                  postcode={postcode}
                  setPostcode={wijzigPostcode}
                  huisnummer={huisnummer}
                  setHuisnummer={wijzigHuisnummer}
                  m2Tekst={m2Tekst}
                  setM2Tekst={setM2Tekst}
                  haagTekst={haagTekst}
                  setHaagTekst={setHaagTekst}
                  schatting={schatting}
                  schatFout={schatFout}
                  bezigMetSchatten={bezigMetSchatten}
                  onSchat={schatTuin}
                  teGroot={teGroot}
                  onSchouwVoorGroteTuin={schouwVoorGroteTuin}
                />
              )}
              {stap === 1 && <StapPakket keuzes={keuzes} setPakket={setPakket} />}
              {stap === 2 && (
                <StapExtras
                  extras={extras}
                  toggle={(id) => setExtras((x) => ({ ...x, [id]: !x[id] }))}
                  offerte={offerte}
                />
              )}
              {stap === 3 && <StapBetaling keuzes={keuzes} setTermijn={setTermijn} />}
              {stap === LAATSTE && (
                <StapAfronden
                  route={route}
                  heeftPrijs={offerte !== null}
                  naam={naam}
                  setNaam={setNaam}
                  email={email}
                  setEmail={setEmail}
                  telefoon={telefoon}
                  setTelefoon={setTelefoon}
                  website={website}
                  setWebsite={setWebsite}
                  akkoord={akkoord}
                  setAkkoord={setAkkoord}
                  directStart={directStart}
                  setDirectStart={setDirectStart}
                  fout={fout}
                  overzicht={
                    <Overzicht
                      variant="kaart"
                      offerte={offerte}
                      route={route}
                      termijn={termijn}
                      m2={m2}
                      haagMeter={haagMeter}
                    />
                  }
                />
              )}

              <div className="nav desk">
                <div>
                  {stap > 0 && (
                    <button type="button" className="knop knop--rand" onClick={vorige}>
                      Vorige
                    </button>
                  )}
                </div>
                <button type="button" className="knop knop--primair" onClick={volgende} disabled={!volgendeMag}>
                  {knopTekst}
                </button>
              </div>
            </>
          )}
        </main>

        <Overzicht variant="zijkolom" offerte={offerte} route={route} termijn={termijn} m2={m2} haagMeter={haagMeter} />
      </div>

      {!klaar && (
        <div className="mobielbalk mob">
          <div className="mobielbalk__prijs">
            {toonPrijsBalk ? (
              <>
                <div className="mobielbalk__bedrag">
                  {euro(offerte!.termijnBedrag)}
                  <span> {termijnen[termijn].kort}</span>
                </div>
                <div className="hulp">
                  {offerte!.pakket.naam} · {route === 'weet' ? 'vaste prijs' : 'indicatie'} incl. btw
                </div>
              </>
            ) : (
              <div className="hulp">{stap === 0 ? 'Je prijs verschijnt na deze stap' : 'Prijs volgt na schouw'}</div>
            )}
          </div>
          <button type="button" className="knop knop--primair" onClick={volgende} disabled={!volgendeMag}>
            {knopTekst}
          </button>
        </div>
      )}
    </div>
  );
}
