// src/server.js
'use strict';

require('dotenv').config();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { Server } = require('socket.io');

const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./socket');
const routes = require('./routes');
const { publicLimiter, authLimiter, errorHandler, notFound } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();

// ── Sécurité ────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'wss:', 'ws:'],
        frameSrc: ["'none'"],
      },
    },
  })
);

app.set('trust proxy', 1);

// ── CORS ─────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('CORS non autorisé'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// ── Parsing ──────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Logging HTTP ─────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.path === '/health',
  })
);

// ── Dossier uploads statique ──────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Santé ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Téléphonie CAP-EPAC',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── Swagger Documentation ─────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Téléphonie CAP-EPAC — API REST',
      version: '1.0.0',
      description: 'API de signalisation, messagerie et gestion des utilisateurs LAN',
    },
    servers: [{ url: '/api', description: 'Serveur LAN' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: [path.join(__dirname, 'routes/*.js')],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { background-color: #16a34a; }',
  customSiteTitle: 'CAP-EPAC API Docs',
}));

// ── Routes API ────────────────────────────────────────────────────
app.use('/api', publicLimiter, routes);

// ── 404 & Erreurs ─────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Démarrage serveur ─────────────────────────────────────────────
const bootstrap = async () => {
  try {
    // Connexion BDD
    await connectDB();

    // Connexion Redis
    await connectRedis();

    // Créer les dossiers uploads
    const uploadDirs = ['uploads', 'uploads/avatars', 'uploads/files', 'logs'];
    uploadDirs.forEach((dir) => {
      const fullPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
    });

    // Choisir HTTP ou HTTPS selon env
    const PORT = parseInt(process.env.PORT) || 3000;
    let server;

    const sslKeyPath = path.join(__dirname, '../ssl/key.pem');
    const sslCertPath = path.join(__dirname, '../ssl/cert.pem');

    if (process.env.NODE_ENV === 'production' && fs.existsSync(sslKeyPath)) {
      server = https.createServer(
        {
          key: fs.readFileSync(sslKeyPath),
          cert: fs.readFileSync(sslCertPath),
        },
        app
      );
    } else {
      server = http.createServer(app);
    }

    // Socket.IO
    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 30000,
      pingInterval: 15000,
    });

    initSocket(io);
    app.set('io', io);

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`
╔══════════════════════════════════════════════════════╗
║         Téléphonie CAP-EPAC — Backend               ║
║  Serveur démarré sur le port ${PORT}                     ║
║  Env: ${process.env.NODE_ENV || 'development'}                              ║
║  Docs: http://localhost:${PORT}/api/docs               ║
╚══════════════════════════════════════════════════════╝
      `);
    });

    // Gestion des signaux d'arrêt
    const gracefulShutdown = (signal) => {
      logger.info(`Signal ${signal} reçu — arrêt gracieux...`);
      server.close(() => {
        logger.info('Serveur HTTP fermé');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Promesse rejetée non gérée:', reason);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Exception non capturée:', err);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Erreur au démarrage:', err);
    process.exit(1);
  }
};

bootstrap();
