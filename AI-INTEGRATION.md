# AI-forslag fra Bilde – Implementering

Denne dokumentasjonen beskriver hvordan AI-forslagsfeaturee fungerer og hvordan du integrerer den.

## Oversikt

- **Frontend**: PWA-applikasjonen (app.js/index.html)
- **Backend**: Node.js Express-server med Google Cloud Vision API
- **Kommunikasjon**: REST API på `/api/ai/avvik-forslag`

## Arkitektur

```
┌─────────────────────────────────────────────────────────┐
│ Befarings-PWA (Frontend)                                │
│ ┌────────────────────────────────────────────────────┐  │
│ │ [Velg bilde] → [🤖 Foreslå tekst fra bilde (AI)]  │  │
│ │                                                    │  │
│ │ Tittel: [auto-fylt]                               │  │
│ │ Beskrivelse: [auto-fylt]                          │  │
│ │ Alvorlighet: [auto-fylt]                          │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
            │
            │ POST /api/ai/avvik-forslag
            │ { imageData: "base64..." }
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│ Backend (Node.js/Express)                               │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 1. Validering                                      │  │
│ │ 2. Komprimering (Sharp)                           │  │
│ │ 3. Google Cloud Vision API                        │  │
│ │    - Label detection                              │  │
│ │    - Object localization                          │  │
│ │    - Text detection                               │  │
│ │ 4. Generering av forslag                          │  │
│ │ 5. Logging & Rate limiting                        │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
            │
            │ Response JSON
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│ Frontend – Fyller inn forslag                           │
│ {                                                        │
│   "titleSuggestion": "Sprekker i vegg",               │
│   "descriptionSuggestion": "Observert: ...",          │
│   "categorySuggestion": "Vegg",                       │
│   "severitySuggestion": "Høy",                        │
│   "confidence": 0.85                                  │
│ }                                                        │
└──────────────────────────────────────────────────────────┘
```

## Frontend-Implementering

### HTML (index.html)

Lagt til knapp og status-display i avvik/anbefaling-seksjonen:

```html
<label>Bilder</label>
<input id="findingPhotos" type="file" accept="image/*" multiple>

<div class="inline">
  <button class="btn" id="btnAiSuggest" style="display:none;">
    🤖 Foreslå tekst fra bilde (AI)
  </button>
</div>

<div id="aiSuggestStatus" style="display:none;">
  <div id="aiSuggestMessage" class="muted"></div>
</div>
```

### JavaScript (app.js)

**Event Listeners:**
- `onFindingPhotosSelected()` – Viser/skjuler AI-knappen når bilder velges
- `suggestFromImage()` – Kaller backend og fyller inn forslag

**Funksjonalitet:**
1. Konverterer bildet til base64
2. Sender til `/api/ai/avvik-forslag`
3. Fyller automatisk inn:
   - `#findingTitle` (tittel)
   - `#findingDesc` (beskrivelse)
   - `#findingSeverity` (alvorlighet)
4. Viser sikkerhetsscore og status

## Backend-Implementering

### Setup

```bash
cd backend
npm install
```

### Miljøvariabeler (.env)

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Google Cloud Vision API Setup

1. **Opprett Google Cloud-prosjekt**
   - https://console.cloud.google.com

2. **Aktiver Vision API**
   - Søk "Cloud Vision API"
   - Klikk "Aktiver"

3. **Opprett Service Account**
   - IAM & Admin → Service Accounts
   - Klikk "Opprett service account"
   - Navn: `befaring-ai-backend`
   - Klikk "Opprett og fortsett"

4. **Gi tilgang**
   - Rolle: `Rollen Editor` (eller `Cloud Vision API User`)
   - Klikk "Fortsett"
   - Klikk "Ferdig"

5. **Opprett JSON Key**
   - Klikk på service account-en du opprettet
   - "Keys" tab
   - "Legg til nøkkel" → "Opprett ny nøkkel"
   - Velg "JSON"
   - Lagre JSON-filen: `backend/service-account-key.json`
   - Legg den i .gitignore!

6. **Sett miljøvariabel**
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/backend/service-account-key.json
   # eller sett i .env
   GOOGLE_APPLICATION_CREDENTIALS=/full/path/to/service-account-key.json
   ```

### Kjør Backend

```bash
cd backend
npm start
# eller
npm run dev  # med nodemon
```

Server kjører på `http://localhost:3000`

## API Referanse

### POST /api/ai/avvik-forslag

**Request:**
```bash
curl -X POST http://localhost:3000/api/ai/avvik-forslag \
  -H "Content-Type: application/json" \
  -d '{
    "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }'
```

**Response (200 OK):**
```json
{
  "titleSuggestion": "Sprekker i vegg",
  "descriptionSuggestion": "Observert: sprekker...\n\nBeskrivelse av observasjonen...",
  "categorySuggestion": "Vegg",
  "severitySuggestion": "Høy",
  "confidence": 0.85
}
```

**Feil-Response (400/500):**
```json
{
  "error": "Beskrivelse av feil"
}
```

## Rate Limiting

- **Maks 30 requests per 15 minutter per IP**
- Returner `HTTP 429` hvis overskrevet
- Headers:
  ```
  RateLimit-Limit: 30
  RateLimit-Remaining: 15
  RateLimit-Reset: 1234567890
  ```

## Logging

### Log Files

- `error.log` – Feil
- `combined.log` – Alt

### Log Format

```json
{
  "timestamp": "2025-01-24T12:30:45.123Z",
  "level": "info",
  "message": "Processing image for AI suggestion",
  "service": "befaring-ai",
  "meta": { ... }
}
```

### Console Output (Utvikling)

```
info: GET /health {"service":"befaring-ai"}
info: Processing image for AI suggestion {"service":"befaring-ai"}
debug: Vision API response received labels: 5, objects: 2 {"service":"befaring-ai"}
info: AI suggestion generated confidence: 0.85 {"service":"befaring-ai"}
```

## Testing

### Test 1: Health Check

```bash
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

### Test 2: AI Suggestion med eksempel-bilde

1. Ta et bilde av noen som ser ut som en "defekt" (crack, water damage, etc.)
2. Konverter til base64:
   ```bash
   base64 -w 0 image.jpg
   ```
3. Send til API:
   ```bash
   curl -X POST http://localhost:3000/api/ai/avvik-forslag \
     -H "Content-Type: application/json" \
     -d '{"imageData":"data:image/jpeg;base64,'$(base64 -w 0 image.jpg)'"}'
   ```

### Test 3: Rate Limiting

Send 31+ requests raskt etter hverandre. Forventet:
- Request 1-30: HTTP 200
- Request 31+: HTTP 429

```bash
for i in {1..35}; do
  echo "Request $i:"
  curl -s http://localhost:3000/api/ai/avvik-forslag \
    -H "Content-Type: application/json" \
    -d '{"imageData":"..."}' | jq '.error // .confidence'
done
```

## Deployment

### Docker (Anbefalt)

Lag `backend/Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

Build og kjør:
```bash
docker build -t befaring-ai-backend .
docker run -p 3000:3000 \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/key.json \
  -v $(pwd)/service-account-key.json:/app/key.json:ro \
  befaring-ai-backend
```

### Heroku

```bash
heroku create befaring-ai-backend
heroku config:set NODE_ENV=production
heroku config:set GOOGLE_APPLICATION_CREDENTIALS=/app/key.json
git push heroku main
```

### Cloud Run (Google Cloud)

```bash
gcloud run deploy befaring-ai-backend \
  --source . \
  --platform managed \
  --region europe-west1 \
  --set-env-vars=GOOGLE_APPLICATION_CREDENTIALS=/app/key.json
```

## Produksjon-Checklist

- [ ] Sikker Google Cloud service account (minst tilgjengelige permissions)
- [ ] CORS konfigurert hvis frontend på annen domene
- [ ] Environment secrets (.env) ikke committet
- [ ] Logging konfigurert og monitert
- [ ] Rate limiting testet
- [ ] Error handling og logging for alle feiltilfeller
- [ ] HTTPS brukt i produksjon
- [ ] Backup av database/logs

## Troubleshooting

### "Vision API ikke konfigurert"

**Årsak:** `GOOGLE_APPLICATION_CREDENTIALS` ikke satt eller ugyldig sti.

**Løsning:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
# Verifiser:
echo $GOOGLE_APPLICATION_CREDENTIALS
ls -la $GOOGLE_APPLICATION_CREDENTIALS
```

### "PERMISSION_DENIED" fra Google Cloud

**Årsak:** Service account mangler `cloudvision.imageAnnotator` rolle.

**Løsning:** I Google Cloud Console:
1. IAM & Admin → Service Accounts
2. Klikk på service account-en
3. "Roller" tab
4. Legg til rolle: `Cloud Vision API User`

### Rate limit (429) for ofte

**Løsning:** Justere i `server.js`:
```javascript
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Øk fra 30 til 50
});
```

### Bilder ikke tolket riktig

**Tips:**
- Bruk bilder med god oppløsning (500px+)
- Unngå mørke/uskarpe bilder
- Google Cloud har bedre resultater med:
  - Skader/defekter som er klart synlige
  - Tekst på bildet
  - Strukturelle elementer (vegg, tak, dør)

## Referanser

- [Google Cloud Vision API Docs](https://cloud.google.com/vision/docs)
- [Express Rate Limiting](https://github.com/nfriedly/express-rate-limit)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
- [Winston Logger](https://github.com/winstonjs/winston)

