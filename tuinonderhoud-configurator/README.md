# Tuinonderhoud-configurator (Hoveniersbedrijf Zandbergen)

Klanten stellen online een onderhoudsabonnement samen: tuinmaat, pakket, extra's en
betaaltermijn. Twee routes:

- **Ik weet de maten**: vaste prijs, de klant sluit direct af.
- **Schat het voor mij**: indicatieprijs, de klant vraagt een gratis schouw aan.

Elke aanvraag gaat naar `api/aanvraag`, dat de prijs op de server opnieuw uitrekent en
de aanvraag mailt naar de hovenier.

## Prijzen aanpassen

Alle tarieven staan in **`src/config.ts`**: uurtarief, voorrijkosten, de prijsklassen per
tuinmaat (tijd op locatie, aantal personen, groenafval), de pakketten en de extra's.

Prijs per bezoek = voorrijkosten + tijd × personen × pakketfactor × uurtarief,
afgerond op hele euro's. Boven de grootste prijsklasse (750 m²) toont de configurator
geen prijs en vraagt de klant een schouw aan.

Na een wijziging: `npm test` om te controleren dat alles nog klopt.
Let op: de tests in `src/pricing.test.ts` controleren de huidige voorbeeldtarieven.
Pas de verwachte bedragen daar mee aan als je de tarieven verandert.

## Op Vercel zetten

1. Zet deze map in een (privé) GitHub-repository.
2. Ga naar vercel.com, kies **Add New → Project** en importeer de repository.
   Vercel herkent Vite automatisch; je hoeft niets in te stellen.
3. Klik op **Deploy**. Je krijgt een adres als `https://tuinonderhoud-xxx.vercel.app`.

Elke wijziging die je naar GitHub pusht, zet Vercel automatisch online.

### E-mail bij aanvragen (aanrader)

Zonder e-mailinstellingen werkt alles, maar staan aanvragen alleen in de logs
(Vercel → project → Logs). Zo krijg je ze per mail:

1. Maak een gratis account op resend.com en maak een API-key aan.
2. Vercel → project → **Settings → Environment Variables**:
   - `RESEND_API_KEY` = je API-key
   - `NOTIFY_EMAIL` = het adres van de hovenier
   - `FROM_EMAIL` = optioneel, bijvoorbeeld `Zandbergen <aanvragen@jouwdomein.nl>`
     (alleen als je dat domein bij Resend hebt geverifieerd)
3. Deploy opnieuw (Deployments → ⋯ → Redeploy).

Zonder eigen domein bij Resend kun je alleen mailen naar het adres waarmee je het
Resend-account hebt aangemaakt.

## Op de website van de hovenier plaatsen

Het eenvoudigst is een iframe op een pagina van de bestaande site (WordPress: blok
"Aangepaste HTML"):

```html
<iframe src="https://JOUW-ADRES.vercel.app" title="Tuinonderhoud-abonnement"
        style="width:100%;height:900px;border:0"></iframe>
```

Of link vanuit een knop ("Bereken je onderhoudsabonnement") naar het Vercel-adres,
eventueel op een eigen subdomein zoals `onderhoud.zandbergen.nl` (Vercel → Settings → Domains).

## Lokaal draaien

```bash
npm install
npm run dev        # alleen de configurator, zonder api
npx vercel dev     # configurator én api, zoals op Vercel
npm test           # tests voor prijsberekening en api
```

## Tuinschatting via PDOK

De route "Schat het voor mij" roept `api/tuinschatting` aan. Die gebruikt gratis open data
van PDOK (geen account of sleutel nodig):

1. **Locatieserver**: postcode + huisnummer → adrespunt.
2. **BRK Kadastrale kaart**: het perceel op dat punt → geregistreerde perceeloppervlakte.
3. **BAG**: alle panden op het perceel. Van elk pand telt alleen het deel dat op het perceel
   ligt (belangrijk bij rijtjeshuizen, waar één BAG-pand over meerdere percelen loopt).
   Gesloopte en nog niet gebouwde panden tellen niet mee.

Onbebouwd = perceel − bebouwd. Daarvan trekt de configurator een vast percentage af voor
terras, paden en oprit (`schatting.verhardingAandeel` in `src/config.ts`, standaard 30%) en
rondt af op 10 m². De klant kan het resultaat altijd aanpassen. De haag staat niet op de
kaart; die vult de klant zelf in. De kaartgegevens gaan mee in de mail naar de hovenier.

Goed om te weten:
- Bij appartementen en gedeelde percelen is de schatting onbetrouwbaar; de klant kan dan
  beter "Ik weet de maten" kiezen of een schouw aanvragen.
- Uitkomsten worden een dag gecachet door Vercel, zodat PDOK niet onnodig belast wordt.
- De PDOK-logica staat in `server/pdok.ts` en is getest met nagebootste PDOK-antwoorden
  (`tests/pdok.test.ts`). Test na de eerste deploy een paar echte adressen.

## Nog niet ingebouwd

- **Automatische incasso**: de klant krijgt nu per mail een machtigingslink van de
  hovenier. Volgende stap: Mollie-koppeling (eerste betaling via iDEAL → SEPA-machtiging).
- **Algemene voorwaarden**: de link in de laatste stap verwijst nog nergens naar.
  Vervang `#voorwaarden` in `src/Stappen.tsx` door de echte url.
