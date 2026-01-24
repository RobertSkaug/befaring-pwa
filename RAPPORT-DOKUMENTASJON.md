# Rapportgenerering – Dokumentasjon

## Oversikt

Befarings-PWAen kan nå generere profesjonelle HTML-baserte rapporter som kan eksporteres til PDF eller Word-format.

## Arkitektur

### 1. HTML-rapport som "master"

- Én `buildReportHtml()`-funksjon genererer komplett HTML-rapport
- Samme HTML brukes for både PDF og Word
- Inline CSS sikrer konsistent formatering
- Ingen eksterne avhengigheter

### 2. Rapportstruktur

Rapporten inneholder følgende kapitler:

#### Header
- Tittel: "Befaringsrapport – Risikogjennomgang"
- Dato for befaring
- Kundenavn og org.nr
- Deltakere (KLP og kunde)

#### Kapittel 1: Formålet med befaringen
- Fast tekst som forklarer bakgrunn
- Liste over befarte objekter

#### Kapittel 2: Innholdet i befaringsrapporten
- Forklaring av rapportens innhold

#### Kapittel 3: Beskrivelse av bygg
- Detaljert info per bygg:
  - Byggbeskrivelse (overskrift)
  - Adresse
  - Bygningsnummer
  - Virksomhet
  - Areal (total + fordeling)
  - Bygningsbeskrivelse
  - Sikkerhetsforhold
  - Generell risiko

#### Kapittel 4: Avvik ved risikoforhold
- Nummererte avvik (2.1, 2.2, ...)
- Format: "Avvik 2.X – [Byggbeskrivelse]"
- Beskrivelse av hvert avvik

#### Kapittel 5: Anbefalinger
- Nummererte anbefalinger (3.1, 3.2, ...)
- Format: "Anbefaling 3.X – [Byggbeskrivelse]"
- Beskrivelse av hver anbefaling

#### Kapittel 6: Dokumenterte bilder
- Bilder gruppert per avvik/anbefaling
- Overskrift: "Avvik/Anbefaling X.Y – [Byggbeskrivelse]"
- Bildene vises med kommentarer

#### Kapittel 7-8: Forsikringsinfo
- Fast juridisk tekst om forsikringsavtale
- Sikkerhetsforskrifter

## Eksportfunksjoner

### PDF-eksport (`exportToPDF()`)

```javascript
// Åpner HTML i nytt vindu og trigger print-dialog
const html = buildReportHtml();
const w = window.open("", "_blank");
w.document.write(html);
w.print();
```

**Fordeler:**
- Ingen eksterne biblioteker
- 100% CSS-kontroll
- Fungerer på alle enheter
- iOS/Android: "Del" → Mail → PDF

### Word-eksport (`exportToWord()`)

```javascript
// Lager .doc-fil (HTML-kompatibel)
const blob = new Blob([html], {
  type: "application/msword"
});
```

**Fordeler:**
- Redigerbar i Microsoft Word
- Enkel implementasjon
- Fungerer på mobile enheter

**Begrensninger:**
- Enkel CSS-støtte (men tilstrekkelig)

### E-post-deling (`exportAndEmail()`)

```javascript
// Bruker Web Share API
await navigator.share({
  title: "Befaringsrapport – Risikogjennomgang",
  text: "Vedlagt befaringsrapport...",
  files: [file]
});
```

**Fungerer på:**
- iOS/iPadOS → åpner Mail-app med vedlegg
- Android → åpner delingsmeny
- Desktop → fallback til nedlasting

## UI-knapper

Tre knapper i "Avvik/anbefaling"-seksjonen:

1. **📄 Åpne som PDF** – Åpner print-dialog
2. **📧 Send på e-post** – Åpner e-postklient (mobil)
3. **📝 Last ned Word** – Laster ned .doc-fil

## Designvalg

✅ **Bilder samlet i eget kapittel**
- Ikke blandet inn i avvikslisten
- Sortert per avvik/anbefaling
- Lettere å navigere

✅ **Automatisk nummerering**
- Avvik: 2.1, 2.2, 2.3...
- Anbefalinger: 3.1, 3.2, 3.3...
- Konsistent med kapittelstruktur

✅ **Byggbeskrivelse som overskrift**
- Gjenkjennelig for bruker
- Tydelig kobling mellom bygg og avvik

✅ **Fast juridisk tekst**
- Kapittel 5-6 låst
- Sikrer korrekt informasjon

## Tekniske detaljer

### Datahåndtering

Rapporten henter data fra global `state`:

```javascript
state = {
  inspectionDate: "2026-01-23",
  customer: { orgnr, name, orgForm, industry },
  attendees: { klp: [], customer: [] },
  locations: [
    {
      id, address, objectName,
      buildings: [
        { id, label, buildingNo, description, safety, risk, ... }
      ]
    }
  ],
  findings: [
    { id, locationId, type, severity, title, desc, photos: [] }
  ]
}
```

### Sikkerhet

- HTML-escaping via `esc()`-funksjon
- Bilder som base64 data-URLs
- Ingen eksterne ressurser i rapporten

### Styling

- Inline CSS i `<style>`-tag
- Print-optimert med `@media print`
- Page-break-kontroll for kapitler
- Profesjonelt KLP-fargepalett

## Testing

Test på følgende enheter:

1. **iOS (Safari)**
   - PDF: ✓ Print → Del → Mail
   - Word: ✓ Åpnes i Word-app
   - E-post: ✓ Åpner Mail direkte

2. **Android (Chrome)**
   - PDF: ✓ Print → Del
   - Word: ✓ Åpnes i Word/Google Docs
   - E-post: ✓ Delingsmeny

3. **Desktop (Chrome/Edge/Firefox)**
   - PDF: ✓ Print-dialog
   - Word: ✓ Nedlasting
   - E-post: ⚠️ Nedlasting (ingen Web Share API)

## Fremtidige forbedringer

### Kort sikt
- [ ] Lagre rapport-ID i localStorage
- [ ] Versjonering av rapporter
- [ ] Forhåndsvisning før eksport

### Mellomlang sikt
- [ ] Signatur-funksjon
- [ ] QR-kode med rapport-ID
- [ ] Automatisk bildeoptimalisering

### Lang sikt
- [ ] docx.js for avansert Word-eksport
- [ ] PDF-generering med jsPDF
- [ ] Cloud-sync av rapporter

## Support

Ved problemer:
1. Sjekk konsoll for feilmeldinger
2. Verifiser at bilder er base64-kodet
3. Test Web Share API-støtte: `navigator.share`
4. Sjekk popup-blokkering for PDF-eksport
