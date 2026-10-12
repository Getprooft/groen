import { config, type ExtraId, type Pakket, type PakketId, type Prijsklasse, type Termijn } from './config';

export interface Keuzes {
  m2: number;
  haagMeter: number;
  pakket: PakketId;
  extras: Record<ExtraId, boolean>;
  termijn: Termijn;
}

export interface Regel {
  label: string;
  bedrag: number;
}

export interface Offerte {
  klasse: Prijsklasse;
  pakket: Pakket;
  prijsPerBezoek: number;
  regels: Regel[];
  jaarBruto: number;
  korting: number;
  jaarNetto: number;
  termijnBedrag: number;
  aantalTermijnen: number;
}

const rond2 = (n: number) => Math.round(n * 100 + 1e-7) / 100;

export const termijnen: Record<Termijn, { label: string; aantal: number; kort: string; lang: string }> = {
  maand: { label: 'Per maand', aantal: 12, kort: '/mnd', lang: 'per maand' },
  kwartaal: { label: 'Per kwartaal', aantal: 4, kort: '/kwartaal', lang: 'per kwartaal' },
  jaar: { label: 'Per jaar', aantal: 1, kort: '/jaar', lang: 'per jaar, vooraf' },
};

export function vindPakket(id: PakketId): Pakket {
  const p = config.pakketten.find((x) => x.id === id);
  if (!p) throw new Error(`Onbekend pakket: ${id}`);
  return p;
}

/** De prijsklasse voor een tuinmaat, of null als de tuin te groot is voor een online prijs. */
export function vindKlasse(m2: number): Prijsklasse | null {
  if (!(m2 > 0)) return null;
  return config.prijsklassen.find((k) => m2 <= k.maxM2) ?? null;
}

export function maxOnlineM2(): number {
  return config.prijsklassen[config.prijsklassen.length - 1].maxM2;
}

/** Prijs per bezoek: voorrijkosten + manuren × uurtarief, afgerond op hele euro's. */
export function prijsPerBezoek(klasse: Prijsklasse, factor: number): number {
  const manminuten = klasse.minuten * klasse.personen * factor;
  return Math.round(config.voorrijkosten + (manminuten / 60) * config.uurtarief + 1e-9);
}

export function berekenOfferte(k: Keuzes): Offerte | null {
  const klasse = vindKlasse(k.m2);
  if (!klasse) return null;
  const pakket = vindPakket(k.pakket);
  const perBezoek = prijsPerBezoek(klasse, pakket.factor);
  const bezoeken = pakket.bezoekenPerJaar;
  const haag = Math.max(0, k.haagMeter);

  const regels: Regel[] = [{ label: `Onderhoud ${bezoeken} × ${euro(perBezoek, 0)}`, bedrag: perBezoek * bezoeken }];
  if (haag > 0) {
    regels.push({
      label: `Haag ${haag} m, ${pakket.haagBeurtenPerJaar}× snoeien`,
      bedrag: rond2(haag * config.haagPerMeterPerBeurt * pakket.haagBeurtenPerJaar),
    });
  }
  if (k.extras.afval) regels.push({ label: 'Groenafval afvoeren', bedrag: klasse.afvalPerBezoek * bezoeken });
  if (k.extras.onkruid) regels.push({ label: 'Onkruid terras en paden', bedrag: config.onkruidPerBezoek * bezoeken });
  if (k.extras.blad) regels.push({ label: 'Bladruimen najaar', bedrag: config.bladruimenPerJaar });

  const jaarBruto = rond2(regels.reduce((som, r) => som + r.bedrag, 0));
  const korting = k.termijn === 'jaar' ? rond2(jaarBruto * config.kortingJaarbetaling) : 0;
  const jaarNetto = rond2(jaarBruto - korting);
  const aantalTermijnen = termijnen[k.termijn].aantal;

  return {
    klasse,
    pakket,
    prijsPerBezoek: perBezoek,
    regels,
    jaarBruto,
    korting,
    jaarNetto,
    termijnBedrag: rond2(jaarNetto / aantalTermijnen),
    aantalTermijnen,
  };
}

export function euro(n: number, decimalen: 0 | 2 = 2): string {
  return n.toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimalen,
    maximumFractionDigits: decimalen,
  });
}
