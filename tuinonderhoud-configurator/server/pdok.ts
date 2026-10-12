// Schat de tuinoppervlakte van een adres met open data van PDOK:
//   1. Locatieserver: adres → adrespunt (RD-coördinaten)
//   2. BRK Kadastrale kaart: het perceel op dat punt → perceeloppervlak
//   3. BAG: panden op dat perceel → bebouwd oppervlak (alleen het deel binnen het perceel)
// Alles in RD New (EPSG:28992), zodat oppervlaktes direct in m² zijn.

import * as pcNamespace from 'polygon-clipping';
import type { MultiPolygon, Polygon, Ring } from 'polygon-clipping';

// polygon-clipping exporteert in ESM alleen een default-object en in CommonJS het object zelf.
// Afhankelijk van de bundler zit de functie dus op een ander niveau; zoek hem op.
function snijding(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  const ns = pcNamespace as unknown as Record<string, unknown> & { default?: Record<string, unknown> & { default?: Record<string, unknown> } };
  for (const kandidaat of [ns, ns.default, ns.default?.default]) {
    const fn = kandidaat?.intersection;
    if (typeof fn === 'function') return (fn as typeof pcNamespace.intersection)(a, b);
  }
  throw new Error('polygon-clipping niet geladen');
}

const LOCATIESERVER = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const PERCELEN = 'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items';
const PANDEN = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';
const RD = 'http://www.opengis.net/def/crs/EPSG/0/28992';
const TIMEOUT_MS = 8000;

export type FoutCode = 'adres_niet_gevonden' | 'perceel_niet_gevonden' | 'pdok_onbereikbaar';

export class SchattingFout extends Error {
  constructor(
    public code: FoutCode,
    bericht: string,
  ) {
    super(bericht);
  }
}

export interface PdokSchatting {
  adres: string;
  perceelCode: string | null;
  perceelM2: number;
  bebouwdM2: number;
  onbebouwdM2: number;
}

type Fetcher = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

interface GeoFeature {
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown } | null;
}

/* ---------- Geometrie ---------- */

function ringOppervlak(ring: Ring): number {
  let som = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    som += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(som / 2);
}

export function oppervlak(mp: MultiPolygon): number {
  return mp.reduce((totaal, poly) => {
    const [buiten, ...gaten] = poly;
    if (!buiten) return totaal;
    return totaal + ringOppervlak(buiten) - gaten.reduce((s, g) => s + ringOppervlak(g), 0);
  }, 0);
}

function puntInRing(x: number, y: number, ring: Ring): boolean {
  let binnen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) binnen = !binnen;
  }
  return binnen;
}

export function puntInMultiPolygon(x: number, y: number, mp: MultiPolygon): boolean {
  return mp.some(([buiten, ...gaten]) => buiten && puntInRing(x, y, buiten) && !gaten.some((g) => puntInRing(x, y, g)));
}

export function naarMultiPolygon(geom: GeoFeature['geometry']): MultiPolygon | null {
  if (!geom) return null;
  if (geom.type === 'Polygon') return [geom.coordinates as Polygon];
  if (geom.type === 'MultiPolygon') return geom.coordinates as MultiPolygon;
  return null;
}

function omhullende(mp: MultiPolygon): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of mp) for (const ring of poly) for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/* ---------- Adres ---------- */

const normaliseer = (s: string) => s.toUpperCase().replace(/[\s\-_/]/g, '');

export function parsePunt(wkt: unknown): [number, number] | null {
  if (typeof wkt !== 'string') return null;
  const m = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

interface AdresDoc {
  weergavenaam?: string;
  huis_nlt?: string;
  huisletter?: string;
  huisnummertoevoeging?: string;
  centroide_rd?: string;
  gekoppeld_perceel?: string[];
}

/** Kiest het juiste adres als er meerdere zijn (bijv. 12, 12A, 12-2). */
export function kiesAdres(docs: AdresDoc[], huisnummerInvoer: string): AdresDoc | null {
  const gezocht = normaliseer(huisnummerInvoer);
  return (
    docs.find((d) => d.huis_nlt && normaliseer(d.huis_nlt) === gezocht) ??
    docs.find((d) => !d.huisletter && !d.huisnummertoevoeging) ??
    docs[0] ??
    null
  );
}

/* ---------- PDOK-aanroepen ---------- */

async function haalJson(f: Fetcher, url: string): Promise<unknown> {
  let res;
  try {
    res = await f(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
  } catch {
    throw new SchattingFout('pdok_onbereikbaar', 'PDOK reageert niet');
  }
  if (!res.ok) throw new SchattingFout('pdok_onbereikbaar', `PDOK gaf status ${res.status}`);
  return res.json();
}

function featureUrl(basis: string, bbox: [number, number, number, number], limit: number) {
  const p = new URLSearchParams({
    bbox: bbox.map((n) => n.toFixed(2)).join(','),
    'bbox-crs': RD,
    crs: RD,
    limit: String(limit),
    f: 'json',
  });
  return `${basis}?${p.toString()}`;
}

// BAG-statussen van panden die (nog) niet of niet meer op het perceel staan.
const GEEN_BESTAAND_PAND = /gesloopt|niet gerealiseerd|ten onrechte|bouwvergunning verleend/i;

export async function schatTuinViaPdok(postcode: string, huisnummer: string, f: Fetcher = fetch as unknown as Fetcher): Promise<PdokSchatting> {
  const pc = postcode.replace(/\s/g, '').toUpperCase();
  const nummer = huisnummer.match(/\d+/)?.[0];
  if (!nummer) throw new SchattingFout('adres_niet_gevonden', 'Geen huisnummer');

  // 1. Adres → punt
  const adresUrl = `${LOCATIESERVER}?${new URLSearchParams({
    q: `postcode:${pc} and huisnummer:${nummer}`,
    fq: 'type:adres',
    fl: '*',
    rows: '20',
  }).toString()}`;
  const adresJson = (await haalJson(f, adresUrl)) as { response?: { docs?: AdresDoc[] } };
  const adres = kiesAdres(adresJson.response?.docs ?? [], huisnummer);
  const punt = parsePunt(adres?.centroide_rd);
  if (!adres || !punt) throw new SchattingFout('adres_niet_gevonden', 'Adres niet gevonden');
  const [x, y] = punt;

  // 2. Perceel op het adrespunt
  const perceelJson = (await haalJson(f, featureUrl(PERCELEN, [x - 0.5, y - 0.5, x + 0.5, y + 0.5], 10))) as {
    features?: GeoFeature[];
  };
  const kandidaten = (perceelJson.features ?? [])
    .map((ft) => ({ ft, mp: naarMultiPolygon(ft.geometry) }))
    .filter((k): k is { ft: GeoFeature; mp: MultiPolygon } => k.mp !== null);
  const perceel = kandidaten.find((k) => puntInMultiPolygon(x, y, k.mp)) ?? kandidaten[0];
  if (!perceel) throw new SchattingFout('perceel_niet_gevonden', 'Geen perceel op dit adres');

  const props = perceel.ft.properties ?? {};
  const geregistreerd = Number(props.kadastrale_grootte_waarde);
  const perceelM2 = Number.isFinite(geregistreerd) && geregistreerd > 0 ? geregistreerd : oppervlak(perceel.mp);
  const perceelCode =
    props.akr_kadastrale_gemeente_code_waarde && props.sectie && props.perceelnummer
      ? `${props.akr_kadastrale_gemeente_code_waarde}-${props.sectie}-${props.perceelnummer}`
      : (adres.gekoppeld_perceel?.[0] ?? null);

  // 3. Panden op het perceel; alleen het deel dat binnen het perceel valt telt mee
  const pandJson = (await haalJson(f, featureUrl(PANDEN, omhullende(perceel.mp), 100))) as { features?: GeoFeature[] };
  let bebouwdM2 = 0;
  for (const pand of pandJson.features ?? []) {
    const status = String(pand.properties?.status ?? '');
    if (GEEN_BESTAAND_PAND.test(status)) continue;
    const mp = naarMultiPolygon(pand.geometry);
    if (!mp) continue;
    try {
      bebouwdM2 += oppervlak(snijding(mp, perceel.mp));
    } catch (e) {
      if (e instanceof Error && e.message === 'polygon-clipping niet geladen') throw e;
      // Ongeldige geometrie: dit pand overslaan.
    }
  }

  const bebouwd = Math.min(Math.round(bebouwdM2), Math.round(perceelM2));
  return {
    adres: adres.weergavenaam ?? `${pc} ${huisnummer}`,
    perceelCode,
    perceelM2: Math.round(perceelM2),
    bebouwdM2: bebouwd,
    onbebouwdM2: Math.max(0, Math.round(perceelM2) - bebouwd),
  };
}
