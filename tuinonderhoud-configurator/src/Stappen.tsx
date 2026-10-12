import type { ReactNode } from 'react';
import { config, type ExtraId, type PakketId, type Termijn } from './config';
import { IconCheck, IconInfo, IconPin } from './icons';
import { berekenOfferte, euro, maxOnlineM2, termijnen, vindKlasse, type Keuzes, type Offerte } from './pricing';
import type { Route, TuinSchatting } from './aanvraag';

function Titel({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  return (
    <div className="titel">
      <h1 id="stap-titel" tabIndex={-1}>
        {children}
      </h1>
      {intro && <p>{intro}</p>}
    </div>
  );
}

const alleenCijfers = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 5);

/* ---------- Stap 1: je tuin ---------- */

interface TuinProps {
  route: Route;
  setRoute: (r: Route) => void;
  postcode: string;
  setPostcode: (v: string) => void;
  huisnummer: string;
  setHuisnummer: (v: string) => void;
  m2Tekst: string;
  setM2Tekst: (v: string) => void;
  haagTekst: string;
  setHaagTekst: (v: string) => void;
  schatting: TuinSchatting | null;
  schatFout: string | null;
  bezigMetSchatten: boolean;
  onSchat: () => void;
  teGroot: boolean;
  onSchouwVoorGroteTuin: () => void;
}

export function StapTuin(p: TuinProps) {
  const m2 = Number(p.m2Tekst) || 0;
  const haag = Number(p.haagTekst) || 0;
  const s = p.schatting;
  const verhardingPct = Math.round(config.schatting.verhardingAandeel * 100);

  return (
    <div className="stap">
      <Titel intro="Weet je de maten? Dan krijg je meteen een vaste prijs. Anders schatten we je tuin en kom je een gratis schouw aanvragen.">
        Hoe groot is je tuin?
      </Titel>

      <div className="segment" role="group" aria-label="Hoe wil je de tuinmaat opgeven?">
        <button type="button" aria-pressed={p.route === 'weet'} onClick={() => p.setRoute('weet')}>
          Ik weet de maten
        </button>
        <button type="button" aria-pressed={p.route === 'schat'} onClick={() => p.setRoute('schat')}>
          Schat het voor mij
        </button>
      </div>

      <div className="rij-adres">
        <label className="veld">
          Postcode
          <input
            type="text"
            value={p.postcode}
            onChange={(e) => p.setPostcode(e.target.value.toUpperCase().slice(0, 7))}
            autoComplete="postal-code"
            placeholder="1234 AB"
          />
        </label>
        <label className="veld">
          Huisnummer
          <input
            type="text"
            value={p.huisnummer}
            onChange={(e) => p.setHuisnummer(e.target.value.slice(0, 10))}
            placeholder="12"
          />
        </label>
        {p.route === 'schat' && (
          <button type="button" className="knop knop--rand" onClick={p.onSchat} disabled={p.bezigMetSchatten}>
            {p.bezigMetSchatten ? 'Zoeken…' : 'Zoek mijn tuin'}
          </button>
        )}
      </div>

      {p.route === 'weet' && (
        <div className="raster-2">
          <div className="blok">
            <label className="veld">
              Tuin (gazon en borders)
              <span className="eenheid">
                <input
                  type="text"
                  inputMode="numeric"
                  value={p.m2Tekst}
                  onChange={(e) => p.setM2Tekst(alleenCijfers(e.target.value))}
                  placeholder="bijv. 180"
                />
                <span>m²</span>
              </span>
            </label>
            <p className="hulp">Verharding zoals terras en paden niet meetellen.</p>
          </div>
          <div className="blok">
            <label className="veld">
              Haag, totale lengte
              <span className="eenheid">
                <input
                  type="text"
                  inputMode="numeric"
                  value={p.haagTekst}
                  onChange={(e) => p.setHaagTekst(alleenCijfers(e.target.value))}
                  placeholder="0"
                />
                <span>meter</span>
              </span>
            </label>
            <p className="hulp">Voor- en achtertuin samen. Geen haag? Laat leeg.</p>
          </div>
        </div>
      )}

      {p.route === 'schat' && p.schatFout && (
        <div className="melding melding--fout" role="alert">
          {p.schatFout}
        </div>
      )}

      {p.route === 'schat' && s && (
        <>
          <div className="melding melding--groen" role="status">
            <IconPin />
            <div className="schatting">
              <strong>{s.adres}</strong>
              <span>
                Perceel {s.perceelM2} m² · bebouwd {s.bebouwdM2} m² · onbebouwd {s.onbebouwdM2} m²
              </span>
              {s.tuinM2 > 0 ? (
                <span>
                  {verhardingPct > 0 && <>Voor terras, paden en oprit rekenen we ongeveer {verhardingPct}% af. </>}
                  Geschatte tuin: <strong>{s.tuinM2} m²</strong>. Klopt het niet? Pas het hieronder aan.
                </span>
              ) : (
                <span>
                  Op dit perceel vinden we bijna geen onbebouwde grond. Vul hieronder in hoe groot je tuin is.
                </span>
              )}
              <span className="hulp">Bron: Kadaster en BAG via PDOK. De haag staat niet op de kaart; vul die zelf in.</span>
            </div>
          </div>
          <div className="raster-2">
            <Teller
              label="Tuin"
              waarde={`${m2} m²`}
              min={() => p.setM2Tekst(String(Math.max(10, m2 - 10)))}
              plus={() => p.setM2Tekst(String(m2 + 10))}
              minLabel="10 m² minder"
              plusLabel="10 m² meer"
            />
            <Teller
              label="Haag"
              waarde={`${haag} m`}
              min={() => p.setHaagTekst(String(Math.max(0, haag - 5)))}
              plus={() => p.setHaagTekst(String(haag + 5))}
              minLabel="5 meter haag minder"
              plusLabel="5 meter haag meer"
            />
          </div>
        </>
      )}

      {p.teGroot && (
        <div className="melding" role="status">
          <IconInfo />
          <div>
            <strong>Een flinke tuin!</strong> Boven de {maxOnlineM2()} m² komen we graag eerst kijken voordat we een prijs noemen.
            <div style={{ marginTop: 12 }}>
              <button type="button" className="knop knop--primair" onClick={p.onSchouwVoorGroteTuin}>
                Gratis schouw aanvragen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Teller(props: {
  label: string;
  waarde: string;
  min: () => void;
  plus: () => void;
  minLabel: string;
  plusLabel: string;
}) {
  return (
    <div className="blok">
      <div className="blok__label">{props.label}</div>
      <div className="teller">
        <button type="button" aria-label={props.minLabel} onClick={props.min}>
          −
        </button>
        <output className="teller__waarde" aria-live="polite">
          {props.waarde}
        </output>
        <button type="button" aria-label={props.plusLabel} onClick={props.plus}>
          +
        </button>
      </div>
    </div>
  );
}

/* ---------- Stap 2: pakket ---------- */

export function StapPakket({
  keuzes,
  setPakket,
}: {
  keuzes: Keuzes;
  setPakket: (id: PakketId) => void;
}) {
  const klasse = vindKlasse(keuzes.m2);
  return (
    <div className="stap">
      <Titel intro={`Prijzen voor jouw tuin van ${keuzes.m2} m² (prijsklasse ${klasse?.label ?? '–'}), inclusief je extra’s.`}>
        Kies je pakket
      </Titel>
      <div className="raster-3" role="group" aria-label="Pakketten">
        {config.pakketten.map((pk) => {
          const o = berekenOfferte({ ...keuzes, pakket: pk.id, termijn: 'maand' });
          const gekozen = keuzes.pakket === pk.id;
          return (
            <button
              type="button"
              key={pk.id}
              className={`keuzekaart${gekozen ? ' is-gekozen' : ''}`}
              aria-pressed={gekozen}
              onClick={() => setPakket(pk.id)}
            >
              <span className="keuzekaart__kop">
                <span className="keuzekaart__naam">{pk.naam}</span>
                {pk.populair && <span className="badge">Meest gekozen</span>}
              </span>
              <span className="keuzekaart__tag">{pk.tagline}</span>
              <span className="keuzekaart__sterk">{pk.bezoekenPerJaar} bezoeken per jaar</span>
              <span className="takenlijst">
                {pk.taken.map((t) => (
                  <span key={t}>
                    <IconCheck />
                    {t}
                  </span>
                ))}
              </span>
              <span className="keuzekaart__prijs">
                <span className="keuzekaart__bedrag">{o ? euro(o.termijnBedrag) : '–'}</span>
                <span className="hulp">per maand · {o ? euro(o.jaarBruto) : '–'} per jaar</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Stap 3: extra's ---------- */

export function StapExtras({
  extras,
  toggle,
  offerte,
}: {
  extras: Record<ExtraId, boolean>;
  toggle: (id: ExtraId) => void;
  offerte: Offerte | null;
}) {
  const items: { id: ExtraId; label: string; uitleg: string; prijs: string }[] = [
    {
      id: 'afval',
      label: 'Groenafval afvoeren',
      uitleg: 'Wij nemen al het snoei- en maaiafval mee.',
      prijs: `${euro(offerte?.klasse.afvalPerBezoek ?? 0, 0)} per bezoek`,
    },
    {
      id: 'onkruid',
      label: 'Onkruid op terras en paden',
      uitleg: 'Voegen en verharding onkruidvrij houden.',
      prijs: `${euro(config.onkruidPerBezoek, 0)} per bezoek`,
    },
    {
      id: 'blad',
      label: 'Bladruimen in het najaar',
      uitleg: 'Twee extra bezoeken in oktober en november.',
      prijs: `${euro(config.bladruimenPerJaar, 0)} per jaar`,
    },
  ];
  return (
    <div className="stap">
      <Titel intro="Optioneel. Je kunt dit later altijd aanpassen.">Nog iets extra’s?</Titel>
      <div className="lijst">
        {items.map((x) => (
          <button
            type="button"
            key={x.id}
            className={`optie${extras[x.id] ? ' is-aan' : ''}`}
            aria-pressed={extras[x.id]}
            onClick={() => toggle(x.id)}
          >
            <span className="optie__vink">{extras[x.id] && <IconCheck width={3} />}</span>
            <span className="optie__tekst">
              <span className="optie__label">{x.label}</span>
              <span className="hulp">{x.uitleg}</span>
            </span>
            <span className="optie__prijs">{x.prijs}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Stap 4: betaling ---------- */

export function StapBetaling({
  keuzes,
  setTermijn,
}: {
  keuzes: Keuzes;
  setTermijn: (t: Termijn) => void;
}) {
  const opties: { id: Termijn; sub: string; badge?: string }[] = [
    { id: 'maand', sub: '12 incasso’s per jaar' },
    { id: 'kwartaal', sub: '4 incasso’s per jaar' },
    { id: 'jaar', sub: 'Eén incasso, vooraf', badge: `${Math.round(config.kortingJaarbetaling * 100)}% korting` },
  ];
  return (
    <div className="stap">
      <Titel intro="Ook in de winter een vast bedrag: de jaarprijs wordt gelijk verdeeld. Betalen gaat automatisch via incasso.">
        Hoe wil je betalen?
      </Titel>
      <div className="raster-3" role="group" aria-label="Betaaltermijn">
        {opties.map((t) => {
          const o = berekenOfferte({ ...keuzes, termijn: t.id });
          const gekozen = keuzes.termijn === t.id;
          return (
            <button
              type="button"
              key={t.id}
              className={`keuzekaart keuzekaart--termijn${gekozen ? ' is-gekozen' : ''}`}
              aria-pressed={gekozen}
              onClick={() => setTermijn(t.id)}
            >
              <span className="keuzekaart__sterk">{termijnen[t.id].label}</span>
              <span className="keuzekaart__bedrag">{o ? euro(o.termijnBedrag) : '–'}</span>
              <span className="hulp">{t.sub}</span>
              {t.badge && <span className="badge">{t.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Stap 5: afronden ---------- */

interface AfrondenProps {
  route: Route;
  heeftPrijs: boolean;
  naam: string;
  setNaam: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  telefoon: string;
  setTelefoon: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  akkoord: boolean;
  setAkkoord: (v: boolean) => void;
  directStart: boolean;
  setDirectStart: (v: boolean) => void;
  overzicht: ReactNode;
  fout: string | null;
}

export function StapAfronden(p: AfrondenProps) {
  const afsluiten = p.route === 'weet' && p.heeftPrijs;
  return (
    <div className="stap">
      <Titel
        intro={
          afsluiten
            ? 'Nog een paar gegevens, dan is je tuin geregeld.'
            : `Je prijs is een indicatie. ${config.bedrijf.naam} komt gratis kijken en stuurt daarna de definitieve prijs. Pas na jouw akkoord start het abonnement.`
        }
      >
        {afsluiten ? 'Abonnement afsluiten' : 'Gratis schouw aanvragen'}
      </Titel>

      {p.overzicht}

      <div className="raster-2">
        <label className="veld">
          Naam
          <input type="text" value={p.naam} onChange={(e) => p.setNaam(e.target.value)} autoComplete="name" />
        </label>
        <label className="veld">
          E-mailadres
          <input type="email" value={p.email} onChange={(e) => p.setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="veld">
          <span>
            Telefoonnummer <span className="optioneel">(optioneel)</span>
          </span>
          <input type="tel" value={p.telefoon} onChange={(e) => p.setTelefoon(e.target.value)} autoComplete="tel" />
        </label>
      </div>

      {/* Honeypot tegen spambots: onzichtbaar voor mensen. */}
      <label className="honeypot" aria-hidden="true">
        Website
        <input type="text" tabIndex={-1} autoComplete="off" value={p.website} onChange={(e) => p.setWebsite(e.target.value)} />
      </label>

      {afsluiten ? (
        <>
          <div className="vinkjes">
            <label className="vinkje">
              <input type="checkbox" checked={p.akkoord} onChange={(e) => p.setAkkoord(e.target.checked)} />
              <span>
                Ik ga akkoord met de <a href="#voorwaarden">algemene voorwaarden</a> en de omschrijving van mijn pakket.
              </span>
            </label>
            <label className="vinkje">
              <input type="checkbox" checked={p.directStart} onChange={(e) => p.setDirectStart(e.target.checked)} />
              <span>
                Start het onderhoud al binnen de bedenktijd van 14 dagen. Zeg ik in die tijd op, dan betaal ik alleen voor
                bezoeken die al geweest zijn.
              </span>
            </label>
          </div>
          <div className="melding">
            <IconInfo />
            <span>
              Klopt de tuin bij het eerste bezoek niet met je opgave? Dan stemmen we de prijs eerst met je af. Ben je het niet
              eens, dan stop je kosteloos. Na het eerste jaar is je abonnement maandelijks en online opzegbaar.
            </span>
          </div>
        </>
      ) : (
        <div className="melding">
          <IconInfo />
          <span>
            We plannen binnen een week een gratis schouw. Daarna ontvang je de definitieve prijs en het contract per e-mail.
          </span>
        </div>
      )}

      {p.fout && (
        <div className="melding melding--fout" role="alert">
          {p.fout}
        </div>
      )}
    </div>
  );
}

/* ---------- Klaar ---------- */

export function Klaar({
  route,
  heeftPrijs,
  voornaam,
  pakketNaam,
  email,
  opnieuw,
}: {
  route: Route;
  heeftPrijs: boolean;
  voornaam: string;
  pakketNaam: string;
  email: string;
  opnieuw: () => void;
}) {
  const afgesloten = route === 'weet' && heeftPrijs;
  return (
    <div className="stap klaar">
      <div className="klaar__vink">
        <IconCheck size={32} />
      </div>
      <h1 id="stap-titel" tabIndex={-1}>
        {afgesloten ? `Geregeld, ${voornaam}!` : `Bedankt, ${voornaam}!`}
      </h1>
      <p>
        {afgesloten
          ? `Je aanmelding voor het pakket ${pakketNaam} is binnen. Binnen twee werkdagen ontvang je op ${email} het contract en een link om de incasso via iDEAL te machtigen. Daarna plannen we het eerste bezoek.`
          : `Je aanvraag is binnen. ${config.bedrijf.naam} neemt binnen twee werkdagen contact met je op via ${email} om de schouw in te plannen.`}
      </p>
      <button type="button" className="knop knop--rand" onClick={opnieuw}>
        Opnieuw beginnen
      </button>
    </div>
  );
}
