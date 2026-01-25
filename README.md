# Befarings-PWA – AI Avvik-Forslag

En fullstack Progressive Web App for befaringer (inspeksjoner) med AI-drevet automatisk tekstforslag fra bilder.

## Nye Features 🚀

✨ **AI-Forslag fra Bilde**
- Ta bilde av defekt
- AI analyserer bildet
- Automatisk forslag til tittel, beskrivelse og alvorlighet
- Bruk Google Cloud Vision API

## Teknologi

### Frontend (PWA)
- HTML5 + Vanilla JavaScript
- Local Storage for offline-drift
- Service Worker
- Responsive design

### Backend
- Node.js + Express
- Google Cloud Vision API
- Sharp for bildekomprimering
- Winston logger
- Express Rate Limiting

## Rask Start

### Frontend

```bash
# Ingen build nødvendig – kjør direktelig
# Enten lokalt med en enkel HTTP server:
python3 -m http.server 8000

# eller push til gh-pages:
git push origin gh-pages
```

### Backend

```bash
cd backend

# 1. Installer
npm install

# 2. Sett opp Google Cloud Vision API (se AI-INTEGRATION.md)
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# 3. Kjør
npm start
```

Server: `http://localhost:3000`

## Struktur

```
befaring-pwa/
├── index.html                 # Hovedside
├── app.js                     # Frontendlogikk
├── styles.css                 # Styling
├── manifest.webmanifest       # PWA manifest
├── sw.js                      # Service Worker
├── icons/                     # App icons
│
├── backend/                   # Node.js backend
│   ├── server.js              # Express server
│   ├── routes/ai.js           # AI endpoint
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── AI-INTEGRATION.md          # Setup og dokumentasjon
└── RAPPORT-DOKUMENTASJON.md   # Rapport-funksjonalitet
```

## Funksjonalitet

### Befaringer
- ✅ Lokaliteter og bygg
- ✅ Avvik og anbefalinger
- ✅ Bilder per avvik
- ✅ Rapport-generering (PDF/Word)
- ✅ E-post deling
- **🆕** AI-forslag fra bilder

### Rapport
- HTML-rapport med kapitler
- PDF-eksport via print
- Word-eksport (.doc)
- E-post deling (Web Share API)

## Dokumentasjon

- [AI-INTEGRATION.md](./AI-INTEGRATION.md) – Detaljert setup og API
- [RAPPORT-DOKUMENTASJON.md](./RAPPORT-DOKUMENTASJON.md) – Rapport-feature
- [backend/README.md](./backend/README.md) – Backend setup
- [AI-Endpoint API](#api)

## API

### POST /api/ai/avvik-forslag

Analyser bilde og få AI-forslag.

**Request:**
```json
{
  "imageData": "data:image/jpeg;base64,..."
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

## Sette Opp

Se [AI-INTEGRATION.md](./AI-INTEGRATION.md) for:
- ✅ Google Cloud Vision API setup
- ✅ Environment variabeler
- ✅ Docker deployment
- ✅ Testing og troubleshooting

## Development

```bash
# Frontend: Enkel HTTP server
python3 -m http.server 8000

# Backend: Med hot reload
cd backend && npm run dev
```

## Environment Variabler (Backend)

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

## Produksjon

### Frontend
- Distribuér via GitHub Pages (gh-pages branch)
- Eller på egen webserver

### Backend
- Docker container
- Heroku, Google Cloud Run, eller AWS
- Se [AI-INTEGRATION.md](./AI-INTEGRATION.md#deployment)

## Rate Limiting

Backend implementerer rate limiting:
- **30 requests per 15 minutter per IP**
- Returns HTTP 429 hvis overskrevet

## Logging

Backend logger alt til:
- `error.log` – Feil
- `combined.log` – Alt
- `console` – Live output (dev)

## License

MIT

## Support

For spørsmål eller issues:
1. Sjekk [AI-INTEGRATION.md](./AI-INTEGRATION.md#troubleshooting)
2. Se server logs: `tail -f backend/combined.log`
3. Sjekk browser console for frontend-feil
