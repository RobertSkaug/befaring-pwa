# Befaring AI Backend

Backend for AI-powered suggestions i Befarings-PWAen.

## Setup

### 1. Installer avhengigheter

```bash
cd backend
npm install
```

### 2. Konfigurer Google Cloud Vision API

Du trenger Google Cloud Vision API tilgang:

```bash
# Last ned service account JSON-key fra Google Cloud Console
# https://console.cloud.google.com/iam-admin/serviceaccounts

# Sett miljøvariabel
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Eller i .env-filen
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### 3. Start serveren

**Produksjon:**
```bash
npm start
```

**Utvikling:**
```bash
npm run dev
```

Serveren kjører på `http://localhost:3000` (eller `$PORT`).

## API Endpoints

### POST /api/ai/avvik-forslag

Analyser et bilde og få AI-forslag for avvik/anbefaling.

**Request:**
```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." 
}
```

**Response:**
```json
{
  "titleSuggestion": "Sprekker i vegg",
  "descriptionSuggestion": "Observert: sprekker i vegg...",
  "categorySuggestion": "Vegg",
  "severitySuggestion": "Høy",
  "confidence": 0.85
}
```

## Rate Limiting

- **Maks 30 requests per 15 minutter per IP**
- Returner HTTP 429 hvis overskrevet
- Loggfører overskridelser

## Logging

Logs skrives til:
- `error.log` - Feil og alvorlige hendelser
- `combined.log` - Alle hendelser
- `console` - Real-time output under utvikling

Sett `LOG_LEVEL` miljøvariabel for å endre niveau (debug, info, warn, error).

## Miljøvariabler

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

## Proxy Setup (Produksjon)

Hvis PWAen kjører på annen domene/port, legg til CORS-håndtering:

```javascript
const cors = require('cors');
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));
```

Eller bruk reverse proxy (Nginx/Apache) foran backend-serveren.
