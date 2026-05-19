// backend/src/tests/auth.test.js
const request = require('supertest');

// Mock des dépendances lourdes avant l'import du serveur
jest.mock('../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    define: jest.fn(),
    sync: jest.fn().mockResolvedValue(true),
  },
  connectDB: jest.fn().mockResolvedValue(true),
}));

jest.mock('../config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(true),
  getRedis: jest.fn(),
  setUserPresence: jest.fn().mockResolvedValue(true),
  removeUserPresence: jest.fn().mockResolvedValue(true),
  blacklistToken: jest.fn().mockResolvedValue(true),
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
  incrementLoginAttempts: jest.fn().mockResolvedValue(1),
  resetLoginAttempts: jest.fn().mockResolvedValue(true),
}));

jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    hashPassword: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
    update: jest.fn(),
  },
  RefreshToken: {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'rt-id', destroy: jest.fn() }),
    destroy: jest.fn(),
  },
  ConversationMember: { findAll: jest.fn().mockResolvedValue([]) },
  CallLog: { findByPk: jest.fn(), create: jest.fn() },
}));

const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('../routes/auth');
const { errorHandler } = require('../middleware/rateLimiter');

// Créer une app Express légère pour les tests
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
};

// ── Mock des modèles utilisateur ──────────────────────────────
const mockUser = {
  id: 'user-uuid-123',
  username: 'testuser',
  email: 'test@cap-epac.local',
  display_name: 'Test User',
  role: 'user',
  is_active: true,
  login_attempts: 0,
  locked_until: null,
  last_seen_at: null,
  presence_status: 'offline',
  password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCO...',
  verifyPassword: jest.fn(),
  save: jest.fn().mockResolvedValue(true),
  toPublic: jest.fn().mockReturnValue({
    id: 'user-uuid-123',
    username: 'testuser',
    display_name: 'Test User',
    email: 'test@cap-epac.local',
    role: 'user',
  }),
};

describe('Authentification API', () => {
  let app;
  const { User } = require('../models');

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-tests';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-tests';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/auth/register ────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('devrait créer un compte avec des données valides', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ ...mockUser, toPublic: mockUser.toPublic });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'nouveauuser',
          email: 'nouveau@cap-epac.local',
          password: 'Password123',
          display_name: 'Nouveau User',
          department: 'Informatique',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/créé/i);
    });

    it('devrait rejeter un nom d\'utilisateur déjà pris', async () => {
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'autre@cap-epac.local',
          password: 'Password123',
          display_name: 'Autre User',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('devrait rejeter un mot de passe faible', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user2',
          email: 'user2@cap-epac.local',
          password: '123',
          display_name: 'User2',
        });

      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    it('devrait rejeter un email invalide', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user3',
          email: 'email-invalide',
          password: 'Password123',
          display_name: 'User3',
        });

      expect(res.status).toBe(422);
    });

    it('devrait rejeter un nom d\'utilisateur avec caractères spéciaux', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user<script>',
          email: 'xss@cap-epac.local',
          password: 'Password123',
          display_name: 'XSS',
        });

      expect(res.status).toBe(422);
    });
  });

  // ── POST /api/auth/login ───────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('devrait connecter avec des identifiants valides', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.verifyPassword.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('devrait refuser un mot de passe incorrect', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.verifyPassword.mockResolvedValue(false);
      mockUser.login_attempts = 0;

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('devrait refuser si l\'utilisateur n\'existe pas', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'inexistant', password: 'Password123' });

      expect(res.status).toBe(401);
    });

    it('devrait refuser si le compte est verrouillé', async () => {
      const lockedUser = {
        ...mockUser,
        locked_until: new Date(Date.now() + 60 * 60 * 1000), // dans 1h
      };
      User.findOne.mockResolvedValue(lockedUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'Password123' });

      expect(res.status).toBe(403);
    });

    it('devrait retourner 422 si les champs sont vides', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: '' });

      expect(res.status).toBe(422);
    });
  });

  // ── GET /api/auth/me ───────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('devrait retourner 401 sans token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('devrait retourner 401 avec un token invalide', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token-invalide');
      expect(res.status).toBe(401);
    });
  });
});
