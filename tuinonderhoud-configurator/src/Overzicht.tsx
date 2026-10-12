import { config } from './config';
import { IconInfo } from './icons';
import { euro, termijnen, type Offerte } from './pricing';
import type { Route } from './aanvraag';
import type { Termijn } from './config';

interface Props {
  offerte: Offerte | null;
  route: Route;
  termijn: Termijn;
  m2: number;
  haagMeter: number;
  /** "zijkolom" op desktop, "kaart" in de laatste stap op mobiel. */
  variant: 'zijkolom' | 'kaart';
}

export function Overzicht({ offerte, route, termijn, m2, haagMeter, variant }: Props) {
  const vast = route === 'weet';
  const klasse = variant === 'kaart' ? 'overzicht overzicht--kaart mob' : 'overzicht desk';

  if (!offerte) {
    return (
      <aside className={klasse} aria-label="Jouw abonnement">
        <div className="overzicht__kop">
          <span className="overzicht__label">Jouw abonnement</span>
        </div>
        <p className="overzicht__leeg">
          {m2 > 0
            ? 'Voor deze tuin komen we graag eerst kijken. Je prijs volgt na een gratis schouw.'
            : 'Vul je tuin in, dan rekenen we je prijs direct uit.'}
        </p>
      </aside>
    );
  }

  const t = termijnen[termijn];
  return (
    <aside className={klasse} aria-label="Jouw abonnement">
      <div className="overzicht__kop">
        <span className="overzicht__label">Jouw abonnement</span>
        <span className="badge badge--licht">{vast ? 'Vaste prijs' : 'Indicatie'}</span>
      </div>
      <div>
        <div className="overzicht__pakket">{offerte.pakket.naam}</div>
        <div className="overzicht__sub">
          Tuin {m2} m² · prijsklasse {offerte.klasse.label}
          {haagMeter > 0 ? ` · haag ${haagMeter} m` : ''}
        </div>
      </div>
      <div className="overzicht__regels">
        {offerte.regels.map((r) => (
          <div className="overzicht__regel" key={r.label}>
            <span>{r.label}</span>
            <span>{euro(r.bedrag)}</span>
          </div>
        ))}
        {offerte.korting > 0 && (
          <div className="overzicht__regel">
            <span>Korting jaarbetaling</span>
            <span>− {euro(offerte.korting)}</span>
          </div>
        )}
      </div>
      <div>
        <div className="overzicht__bedrag">{euro(offerte.termijnBedrag)}</div>
        <div className="overzicht__termijn">{t.lang}</div>
        <div className="overzicht__sub overzicht__jaar">{euro(offerte.jaarNetto)} per jaar</div>
      </div>
      {variant === 'zijkolom' && (
        <div className="overzicht__noot">
          <IconInfo size={16} />
          <span>
            Incl. btw.{' '}
            {vast
              ? 'Gebaseerd op de maten die je opgaf.'
              : `Definitief nadat ${config.bedrijf.naam} je tuin heeft bekeken.`}
          </span>
        </div>
      )}
    </aside>
  );
}
