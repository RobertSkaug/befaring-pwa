require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const aiRouter = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

// === LOGGER ===
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'befaring-ai' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// === MIDDLEWARE ===
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Legg logger på request
app.use((req, res, next) => {
  req.logger = logger;
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// === RATE LIMITER ===
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutter
  max: 30, // Maks 30 requests per 15 minutter per IP
  message: 'For mange forespørsler. Prøv igjen senere.',
  standardHeaders: true, // Returner rate limit info i RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Bruk IP eller session-ID hvis tilgjengelig
    return req.ip;
  },
  handler: (req, res, next, options) => {
    req.logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ error: options.message });
  }
});

// === RUTER ===
app.use('/api/ai', aiLimiter, aiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  req.logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
