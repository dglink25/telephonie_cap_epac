// src/server.js
'use strict';

require('dotenv').config();
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const morgan      = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');
const { Server }   = require('socket.io');

const { connectDB }  = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initSocket }   = require('./socket');
const routes           = require('./routes');
const { publicLimiter, errorHandler, notFound } = require('./middleware/rateLimiter');
const { syncAllUsersToGeneralGroup } = require('./services/generalGroupService');
const logger = require('./utils/logger');

const app = express();

// ── Sécurité ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'","'unsafe-inline'"],
      imgSrc:     ["'self'",'data:','blob:'],
      mediaSrc:   ["'self'",'blob:'],
      connectSrc: ["'self'",'wss:','ws:'],
      frameSrc:   ["'none'"],
    },
  },
}));
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS non autorisé'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
}));

// ── Parsing & Compression ─────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/health',
}));

// ── Fichiers statiques ────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Santé ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok', service: 'Téléphonie CAP-EPAC', version: '1.0.0',
  timestamp: new Date().toISOString(), uptime: process.uptime(),
}));

// ── Swagger ───────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Téléphonie CAP-EPAC API', version: '1.0.0' },
    servers: [{ url: '/api' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  },
  apis: [path.join(__dirname, 'routes/*.js')],
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { background-color: #16a34a; }',
}));

// ── Routes API ────────────────────────────────────────────────────
app.use('/api', publicLimiter, routes);

// ── 404 & Erreurs ─────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Démarrage ─────────────────────────────────────────────────────
const bootstrap = async () => {
  try {
    await connectDB();
    await connectRedis();

    // Créer les dossiers uploads
    ['uploads','uploads/avatars','uploads/images','uploads/videos','uploads/audios','uploads/documents','logs'].forEach((dir) => {
      const full = path.join(__dirname, '..', dir);
      if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
    });

    const PORT = parseInt(process.env.PORT) || 3000;
    let server;
    const sslKey  = path.join(__dirname, '../ssl/key.pem');
    const sslCert = path.join(__dirname, '../ssl/cert.pem');

    if (process.env.NODE_ENV === 'production' && fs.existsSync(sslKey)) {
      server = https.createServer({ key: fs.readFileSync(sslKey), cert: fs.readFileSync(sslCert) }, app);
    } else {
      server = http.createServer(app);
    }

    // Socket.IO
    const io = new Server(server, {
      cors: { origin: allowedOrigins, methods: ['GET','POST'], credentials: true },
      transports: ['websocket','polling'],
      pingTimeout: 30000,
      pingInterval: 15000,
    });
    initSocket(io);
    app.set('io', io);

    server.listen(PORT, '0.0.0.0', async () => {
      logger.info(`
╔══════════════════════════════════════════════════════╗
║         Téléphonie CAP-EPAC — Backend               ║
║  Serveur démarré sur le port ${PORT}                     ║
║  Env: ${process.env.NODE_ENV || 'development'}                              ║
╚══════════════════════════════════════════════════════╝`);

      // ✅ Synchroniser le Groupe Général après démarrage
      setTimeout(async () => {
        try {
          await syncAllUsersToGeneralGroup();
          logger.info('[Bootstrap] Groupe Général synchronisé');
        } catch (err) {
          logger.error('[Bootstrap] Erreur sync Groupe Général:', err.message);
        }
      }, 3000);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`Signal ${signal} — arrêt...`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000);
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
    process.on('unhandledRejection', (r) => logger.error('Promesse rejetée:', r));
    process.on('uncaughtException',  (e) => { logger.error('Exception:', e); process.exit(1); });

  } catch (err) {
    logger.error('Erreur démarrage:', err);
    process.exit(1);
  }
};

bootstrap();
