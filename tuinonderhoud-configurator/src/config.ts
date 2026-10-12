// Alle tarieven en teksten die de hovenier wil aanpassen staan in dit bestand.
// Bedragen zijn inclusief btw. Wijzig een getal, sla op en Vercel bouwt de site opnieuw.

export type PakketId = 'basis' | 'comfort' | 'premium';
export type ExtraId = 'afval' | 'onkruid' | 'blad';
export type Termijn = 'maand' | 'kwartaal' | 'jaar';

export interface Prijsklasse {
  /** Tekst zoals de klant hem ziet, bijvoorbeeld "101–200 m²". */
  label: string;
  /** Bovengrens van de klasse in m² (tot en met). */
  maxM2: number;
  /** Tijd op locatie per bezoek in minuten (voor het Comfort-pakket). */
  minuten: number;
  /** Met hoeveel mensen er gewerkt wordt. */
  personen: 1 | 2;
  /** Prijs voor het afvoeren van groenafval per bezoek, in euro. */
  afvalPerBezoek: number;
}

export interface Pakket {
  id: PakketId;
  naam: string;
  tagline: string;
  bezoekenPerJaar: number;
  /** Tijdfactor ten opzichte van Comfort: minder taken = minder tijd. */
  factor: number;
  haagBeurtenPerJaar: number;
  taken: string[];
  populair?: boolean;
}

export const config = {
  bedrijf: {
    naam: 'Hoveniersbedrijf Zandbergen',
    logo: '/logo-zandbergen.png',
    tagline: 'Vraag eenvoudig een onderhoudspakket aan voor je tuin',
  },

  /** Uurtarief per manuur. */
  uurtarief: 45,
  /** Vaste kosten per bezoek (aanrijden, opstarten). */
  voorrijkosten: 7.5,

  /** Prijsklassen, van klein naar groot. Boven de laatste klasse: altijd een schouw. */
  prijsklassen: [
    { label: 't/m 100 m²', maxM2: 100, minuten: 35, personen: 1, afvalPerBezoek: 5 },
    { label: '101–200 m²', maxM2: 200, minuten: 55, personen: 1, afvalPerBezoek: 8 },
    { label: '201–350 m²', maxM2: 350, minuten: 45, personen: 2, afvalPerBezoek: 12 },
    { label: '351–500 m²', maxM2: 500, minuten: 70, personen: 2, afvalPerBezoek: 16 },
    { label: '501–750 m²', maxM2: 750, minuten: 100, personen: 2, afvalPerBezoek: 20 },
  ] satisfies Prijsklasse[] as Prijsklasse[],

  pakketten: [
    {
      id: 'basis',
      naam: 'Basis',
      tagline: 'De tuin netjes houden',
      bezoekenPerJaar: 6,
      factor: 0.8,
      haagBeurtenPerJaar: 1,
      taken: ['Gras maaien', 'Onkruid wieden in borders', 'Haag 1× per jaar snoeien'],
    },
    {
      id: 'comfort',
      naam: 'Comfort',
      tagline: 'Elke maand een verzorgde tuin',
      bezoekenPerJaar: 12,
      factor: 1.0,
      haagBeurtenPerJaar: 2,
      taken: ['Alles uit Basis', 'Graskanten steken', 'Borders bijhouden', 'Haag 2× per jaar snoeien'],
      populair: true,
    },
    {
      id: 'premium',
      naam: 'Premium',
      tagline: 'Zorgeloos, het hele seizoen',
      bezoekenPerJaar: 20,
      factor: 1.3,
      haagBeurtenPerJaar: 2,
      taken: [
        'Alles uit Comfort',
        'Heesters en vaste planten snoeien',
        'Gazon bemesten in het voorjaar',
        'Gazon 1× verticuteren',
      ],
    },
  ] satisfies Pakket[] as Pakket[],

  /** Haag snoeien: prijs per strekkende meter per snoeibeurt. */
  haagPerMeterPerBeurt: 2.5,
  /** Onkruid op terras en paden: prijs per bezoek. */
  onkruidPerBezoek: 8,
  /** Bladruimen in het najaar: vaste prijs per jaar. */
  bladruimenPerJaar: 95,
  /** Korting bij jaarlijks vooruitbetalen (0.03 = 3%). */
  kortingJaarbetaling: 0.03,

  /**
   * Tuinschatting via PDOK (route "Schat het voor mij"): perceel min bebouwing geeft het
   * onbebouwde deel. Daarvan rekenen we dit aandeel als verharding (terras, paden, oprit).
   * 0.3 = 30%. Zet op 0 om niets af te trekken.
   */
  schatting: { verhardingAandeel: 0.3 },
};

export type Config = typeof config;
