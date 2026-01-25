# 🎯 Quick Reference – AI Avvik-Forslag

## Files Changed

### ✨ Frontend (index.html)
```html
<!-- Ny knapp ved bilder -->
<button class="btn" id="btnAiSuggest" style="display:none;">
  🤖 Foreslå tekst fra bilde (AI)
</button>
<div id="aiSuggestStatus" style="display:none;">
  <div id="aiSuggestMessage"></div>
</div>
```

### ✨ Frontend (app.js)
```javascript
// Ny event listener
$("findingPhotos").addEventListener("change", onFindingPhotosSelected);
$("btnAiSuggest").addEventListener("click", suggestFromImage);

// Nye funksjoner
function onFindingPhotosSelected() { ... }
async function suggestFromImage() { ... }
```

## 🆕 Backend Files

```
backend/
├── server.js                  # Express + logging + rate limiting
├── routes/ai.js               # POST /api/ai/avvik-forslag
├── package.json               # Avhengigheter
├── .env.example               # Environment template
├── .gitignore                 # Ignore node_modules, .env
└── README.md                  # Backend-guide
```

## 🆕 Documentation

- **AI-INTEGRATION.md** – Full setup guide (Google Cloud, Docker, testing, troubleshooting)
- **IMPLEMENTATION.md** – Dette dokumentet
- **README.md** – Oppdatert (ny teknologi-oversikt)
- **backend/README.md** – Backend-spesifikk

## ⚡ Quick Start

### Backend Setup (5 min)

```bash
cd backend

# 1. Installer dependencies
npm install

# 2. Generer .env fra eksempel
cp .env.example .env

# 3. Sett Google Cloud credentials
# – Se AI-INTEGRATION.md for detaljer
# – Legg JSON-fil på disk
# – Oppdater GOOGLE_APPLICATION_CREDENTIALS i .env

# 4. Start
npm start
# → Serveren kjører på http://localhost:3000
```

### Google Cloud Setup (10 min)

1. https://console.cloud.google.com
2. Opprett nytt prosjekt
3. Aktiver "Cloud Vision API"
4. IAM & Admin → Service Accounts → Opprett
5. Legg til rolle: "Cloud Vision API User"
6. Opprett JSON-key, lagre som `service-account-key.json`
7. Sett i `.env`: `GOOGLE_APPLICATION_CREDENTIALS=/sti/til/key.json`

**Eller:** Les detaljert guide i [AI-INTEGRATION.md#google-cloud-vision-api-setup](./AI-INTEGRATION.md#google-cloud-vision-api-setup)

### Frontend (Already Ready ✅)
Koden er integrert. Start PWAen som normalt:
```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## 🧪 Test

```bash
# Health check
curl http://localhost:3000/health

# Test rate limiting
for i in {1..35}; do curl -s http://localhost:3000/api/ai/avvik-forslag \
  -H "Content-Type: application/json" \
  -d '{"imageData":"base64..."}' | jq '.error // .severity'; done
# → Requests 1-30: OK, Request 31+: HTTP 429

# Monitor logs
tail -f backend/combined.log
```

## 📋 Feature Checklist

- [x] Frontend: AI-knapp i avvik-form
- [x] Frontend: Fylling av tittel/beskrivelse/alvorlighet
- [x] Backend: Express server
- [x] Backend: Google Cloud Vision integration
- [x] Backend: Bildekomprimering (Sharp)
- [x] Backend: Rate limiting (30/15min)
- [x] Backend: Logging (Winston)
- [x] Error handling og graceful fallback
- [x] Documentation (3 guides + this quick ref)

## 🔑 Key Functions

### Frontend: `suggestFromImage()`
- Leser første valgte bilde
- Konverterer til base64
- Poster til `/api/ai/avvik-forslag`
- Fyller inn forslag i form
- Viser sikkerhetsscore

### Backend: `/api/ai/avvik-forslag`
- Validerer request
- Komprimerer bilde (Sharp)
- Analyser med Google Cloud Vision
- Mapper labels til norske kategorier
- Returnerer JSON med forslag

### Backend: Rate Limiter
- 30 requests per 15 minutter per IP
- HTTP 429 hvis overskrevet
- Loggfører overskridelser

## 🚀 Deploy

### Option 1: Docker (Recommended)
```bash
cd backend
docker build -t befaring-ai .
docker run -p 3000:3000 \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/key.json \
  -v $(pwd)/service-account-key.json:/app/key.json:ro \
  befaring-ai
```

### Option 2: Heroku
```bash
heroku create my-app-name
heroku config:set GOOGLE_APPLICATION_CREDENTIALS=/app/key.json
git push heroku main
```

### Option 3: Google Cloud Run
```bash
gcloud run deploy befaring-ai \
  --source . \
  --set-env-vars=GOOGLE_APPLICATION_CREDENTIALS=/app/key.json
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Vision API not configured" | Set `GOOGLE_APPLICATION_CREDENTIALS` env var |
| "PERMISSION_DENIED" | Add "Cloud Vision API User" role to service account |
| Rate limit (429) | Requests exceeded 30/15min. Check logs. |
| Bilder analyseres dårlig | Bruk bilder med høy oppløsning, god belysning |
| Backend won't start | Check `npm install`, Node.js version, env vars |
| No logs appearing | Check `LOG_LEVEL` env var, read `combined.log` file |

**See [AI-INTEGRATION.md#troubleshooting](./AI-INTEGRATION.md#troubleshooting) for full troubleshooting guide.**

## 📞 Support Resources

1. **AI-INTEGRATION.md** – Full documentation
2. **backend/README.md** – Backend specifics
3. **backend/combined.log** – Server logs
4. Browser console – Frontend errors
5. Google Cloud Console – Vision API quota/errors

## 🎓 Architecture Overview

```
Frontend (PWA)
    ↓ /api/ai/avvik-forslag (POST)
Backend (Node.js/Express)
    ↓ Compress (Sharp)
    ↓ Send to Google Cloud Vision API
Google Cloud Vision
    ↓ Analysis (labels, objects, text)
Backend
    ↓ Map to suggestions
    ↓ Return JSON
Frontend
    ↓ Auto-fill form
    ↓ User can edit & save
```

---

**Need help?** → Read AI-INTEGRATION.md or backend/README.md
