const express = require('express');
const router = express.Router();
const vision = require('@google-cloud/vision');
const sharp = require('sharp');

// Initialiser Google Cloud Vision client
// Forvent GOOGLE_APPLICATION_CREDENTIALS miljøvariabel
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

/**
 * POST /api/ai/avvik-forslag
 * 
 * Request body:
 * {
 *   "imageData": "data:image/jpeg;base64,..." eller base64 string
 * }
 * 
 * Response:
 * {
 *   "titleSuggestion": "...",
 *   "descriptionSuggestion": "...",
 *   "categorySuggestion": "...",
 *   "severitySuggestion": "Høy|Middels|Lav",
 *   "confidence": 0.0-1.0
 * }
 */
router.post('/avvik-forslag', async (req, res) => {
  const logger = req.logger;

  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'imageData er påkrevd' });
    }

    logger.info('Processing image for AI suggestion');

    // Komprimer og konverter bilde
    const imageBuffer = await compressImage(imageData);

    // Kall Google Cloud Vision API
    const visionResult = await analyzeImageWithVision(imageBuffer, logger);

    // Generer forslag basert på analyse
    const suggestions = generateSuggestions(visionResult, logger);

    logger.info('AI suggestion generated', { confidence: suggestions.confidence });

    res.json(suggestions);

  } catch (err) {
    logger.error('Error in /avvik-forslag', { error: err.message, stack: err.stack });
    
    if (err.message.includes('PERMISSION_DENIED') || err.message.includes('authentication')) {
      return res.status(500).json({ 
        error: 'Vision API ikke konfigurert. Sjekk GOOGLE_APPLICATION_CREDENTIALS.' 
      });
    }

    res.status(500).json({ error: err.message });
  }
});

/**
 * Komprimer og konverter base64-bilde til buffer
 */
async function compressImage(imageData) {
  let base64String = imageData;

  // Fjern data URL prefix hvis tilstede
  if (imageData.startsWith('data:')) {
    base64String = imageData.split(',')[1];
  }

  const imageBuffer = Buffer.from(base64String, 'base64');

  // Komprimer med Sharp (maks 1200px, JPEG 80%)
  const compressed = await sharp(imageBuffer)
    .resize(1200, 1200, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  return compressed;
}

/**
 * Analyser bilde med Google Cloud Vision API
 */
async function analyzeImageWithVision(imageBuffer, logger) {
  const request = {
    image: { content: imageBuffer },
    features: [
      { type: 'LABEL_DETECTION' },
      { type: 'OBJECT_LOCALIZATION' },
      { type: 'TEXT_DETECTION' },
      { type: 'SAFE_SEARCH_DETECTION' }
    ]
  };

  const [response] = await client.annotateImage(request);

  logger.debug('Vision API response received', {
    labels: response.labelAnnotations?.length || 0,
    objects: response.localizedObjectAnnotations?.length || 0,
    text: !!response.textAnnotations?.length
  });

  return response;
}

/**
 * Generer AI-forslag basert på vision-analyse
 */
function generateSuggestions(visionResult, logger) {
  const labels = visionResult.labelAnnotations || [];
  const objects = visionResult.localizedObjectAnnotations || [];
  const textAnnotations = visionResult.textAnnotations || [];
  const safeSearch = visionResult.safeSearchAnnotation || {};

  // Hent tekst fra bilde om mulig
  const detectedText = textAnnotations.length > 1 
    ? textAnnotations[0].description 
    : '';

  // Mapper Google Cloud labels til norske avvik-kategorier
  const labelMap = {
    'wall': { category: 'Vegg', severity: 'Middels' },
    'ceiling': { category: 'Tak', severity: 'Middels' },
    'floor': { category: 'Gulv', severity: 'Lav' },
    'crack': { category: 'Sprekker', severity: 'Høy' },
    'water damage': { category: 'Vannlekkasje', severity: 'Høy' },
    'mold': { category: 'Mugg', severity: 'Høy' },
    'corrosion': { category: 'Korrosjon', severity: 'Middels' },
    'fire hazard': { category: 'Brannfare', severity: 'Høy' },
    'electrical hazard': { category: 'Elektrisk fare', severity: 'Høy' },
    'structural damage': { category: 'Strukturskade', severity: 'Høy' },
    'door': { category: 'Dør/adgang', severity: 'Lav' },
    'window': { category: 'Vindu', severity: 'Lav' },
    'sign': { category: 'Skilt', severity: 'Lav' }
  };

  // Find beste match fra labels
  let bestMatch = null;
  let highestScore = 0;

  for (const label of labels) {
    const lowerDesc = label.description.toLowerCase();
    for (const [key, mapping] of Object.entries(labelMap)) {
      if (lowerDesc.includes(key) && label.score > highestScore) {
        bestMatch = mapping;
        highestScore = label.score;
      }
    }
  }

  // Fallback hvis ingen match
  if (!bestMatch) {
    bestMatch = { category: 'Observasjon', severity: 'Middels' };
  }

  // Generer tittel
  let titleSuggestion = `${bestMatch.category}`;
  
  // Legge til spesifikke detaljer hvis tekst ble oppdaget
  if (detectedText && detectedText.length < 100) {
    titleSuggestion += ` - ${detectedText.substring(0, 50)}`;
  }

  // Generer beskrivelse
  let descriptionSuggestion = `Observert: ${bestMatch.category.toLowerCase()}\n`;
  
  if (objects.length > 0) {
    const objNames = objects
      .slice(0, 3)
      .map(o => o.name)
      .filter(n => n)
      .join(', ');
    if (objNames) {
      descriptionSuggestion += `Objekter identifisert: ${objNames}\n`;
    }
  }

  if (detectedText && detectedText.length > 0) {
    descriptionSuggestion += `Tekst på bildet: "${detectedText.substring(0, 150)}${detectedText.length > 150 ? '...' : ''}"\n`;
  }

  descriptionSuggestion += `\nBeskrivelse av observasjonen og anbefalt tiltak mangler - fyll inn manuelt.`;

  // Beregn sikkerhet basert på scoresumma
  const confidence = Math.min(
    (highestScore + labels.slice(0, 2).reduce((sum, l) => sum + l.score, 0)) / 2,
    1.0
  );

  return {
    titleSuggestion: titleSuggestion.substring(0, 200),
    descriptionSuggestion,
    categorySuggestion: bestMatch.category,
    severitySuggestion: bestMatch.severity,
    confidence: parseFloat(confidence.toFixed(2))
  };
}

module.exports = router;
