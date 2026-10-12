import type { ExtraId, PakketId, Termijn } from './config';

/** "weet" = klant kent de maten (vaste prijs, direct afsluiten); "schat" = indicatie + schouw. */
export type Route = 'weet' | 'schat';

export interface AanvraagPayload {
  route: Route;
  adres: { postcode: string; huisnummer: string };
  tuin: { m2: number; haagMeter: number };
  pakket: PakketId;
  extras: Record<ExtraId, boolean>;
  termijn: Termijn;
  contact: { naam: string; email: string; telefoon: string };
  akkoordVoorwaarden: boolean;
  startBinnenBedenktijd: boolean;
  /** Uitkomst van de PDOK-schatting, als de klant die heeft gebruikt. */
  schatting?: { perceelM2: number; bebouwdM2: number; onbebouwdM2: number } | null;
  /** Onzichtbaar veld tegen spambots: moet leeg blijven. */
  website?: string;
}

/** Antwoord van /api/tuinschatting, aangevuld met de geschatte tuin na aftrek van verharding. */
export interface TuinSchatting {
  adres: string;
  perceelM2: number;
  bebouwdM2: number;
  onbebouwdM2: number;
  tuinM2: number;
}

export const postcodeGeldig = (p: string) => /^\d{4}\s?[a-zA-Z]{2}$/.test(p.trim());
export const emailGeldig = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
