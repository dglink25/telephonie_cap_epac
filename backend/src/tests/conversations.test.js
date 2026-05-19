// backend/src/tests/conversations.test.js
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock des dépendances
jest.mock('../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    transaction: jest.fn().mockResolvedValue({
      commit: jest.fn().mockResolvedValue(true),
      rollback: jest.fn().mockResolvedValue(true),
    }),
  },
  connectDB: jest.fn().mockResolvedValue(true),
}));

jest.mock('../config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(true),
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
  setUserPresence: jest.fn(),
  getUserPresence: jest.fn().mockResolvedValue({ status: 'online' }),
}));

const mockUser1 = {
  id: 'user-1',
  username: 'alice',
  display_name: 'Alice',
  role: 'user',
  is_active: true,
  locked_until: null,
};

const mockUser2 = {
  id: 'user-2',
  username: 'bob',
  display_name: 'Bob',
  role: 'user',
  is_active: true,
};

const mockConv = {
  id: 'conv-1',
  type: 'direct',
  name: null,
  created_by: 'user-1',
  members: [mockUser1, mockUser2],
  toJSON: () => ({ id: 'conv-1', type: 'direct' }),
};

const mockMessage = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  sender_id: 'user-1',
  content: 'Bonjour !',
  type: 'text',
  is_deleted: false,
  created_at: new Date(),
  toJSON: () => ({
    id: 'msg-1',
    content: 'Bonjour !',
    sender_id: 'user-1',
  }),
};

jest.mock('../models', () => ({
  User: {
    findByPk: jest.fn().mockResolvedValue(mockUser1),
    findOne: jest.fn(),
    update: jest.fn(),
  },
  Conversation: {
    findAll: jest.fn().mockResolvedValue([mockConv]),
    findOne: jest.fn().mockResolvedValue(mockConv),
    findByPk: jest.fn().mockResolvedValue(mockConv),
    create: jest.fn().mockResolvedValue(mockConv),
    update: jest.fn(),
  },
  ConversationMember: {
    findAll: jest.fn().mockResolvedValue([{ conversation_id: 'conv-1' }]),
    findOne: jest.fn().mockResolvedValue({ conversation_id: 'conv-1', user_id: 'user-1', last_read_at: null, save: jest.fn() }),
    bulkCreate: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
  },
  Message: {
    findAll: jest.fn().mockResolvedValue([mockMessage]),
    findOne: jest.fn().mockResolvedValue(mockMessage),
    findByPk: jest.fn().mockResolvedValue(mockMessage),
    create: jest.fn().mockResolvedValue(mockMessage),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
  },
  MessageReaction: {
    findOrCreate: jest.fn().mockResolvedValue([{ toJSON: () => ({}) }, true]),
    destroy: jest.fn(),
  },
  MessageReadStatus: {},
  RefreshToken: { findAll: jest.fn().mockResolvedValue([]), create: jest.fn(), destroy: jest.fn() },
  sequelize: { transaction: jest.fn().mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() }) },
}));

const express = require('express');
const cookieParser = require('cookie-parser');
const convRoutes = require('../routes/conversations');
const { errorHandler } = require('../middleware/rateLimiter');

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/conversations', convRoutes);
  app.use(errorHandler);
  return app;
};

// Générer un token valide pour les tests
const generateToken = (userId = 'user-1', role = 'user') => {
  return jwt.sign(
    { sub: userId, username: 'alice', role, jti: 'test-jti' },
    process.env.JWT_SECRET || 'test-jwt-secret-for-tests',
    { expiresIn: '1h' }
  );
};

describe('Conversations & Messages API', () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-tests';
    app = createTestApp();
    app.set('io', { to: () => ({ emit: jest.fn() }) });
  });

  beforeEach(() => jest.clearAllMocks());

  // ── GET /api/conversations ─────────────────────────────────
  describe('GET /api/conversations', () => {
    it('devrait retourner la liste des conversations', async () => {
      const token = generateToken();
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.conversations)).toBe(true);
    });

    it('devrait retourner 401 sans token', async () => {
      const res = await request(app).get('/api/conversations');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/conversations ────────────────────────────────
  describe('POST /api/conversations', () => {
    it('devrait créer une conversation directe', async () => {
      const token = generateToken();
      const { ConversationMember } = require('../models');
      ConversationMember.findAll.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'direct', member_ids: ['user-2'] });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('devrait créer une conversation de groupe', async () => {
      const token = generateToken();
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'group', name: 'Équipe Dev', member_ids: ['user-2', 'user-3'] });

      expect([200, 201]).toContain(res.status);
    });

    it('devrait rejeter sans member_ids', async () => {
      const token = generateToken();
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'direct' });

      expect(res.status).toBe(422);
    });
  });

  // ── GET /api/conversations/:id/messages ───────────────────
  describe('GET /api/conversations/:id/messages', () => {
    it('devrait retourner les messages', async () => {
      const token = generateToken();
      const res = await request(app)
        .get('/api/conversations/conv-1/messages')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.messages)).toBe(true);
    });

    it('devrait retourner 403 si non membre', async () => {
      const { ConversationMember } = require('../models');
      ConversationMember.findOne.mockResolvedValueOnce(null);
      const token = generateToken('user-99');
      const res = await request(app)
        .get('/api/conversations/conv-1/messages')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/conversations/:id/messages ──────────────────
  describe('POST /api/conversations/:id/messages', () => {
    it('devrait envoyer un message texte', async () => {
      const token = generateToken();
      const res = await request(app)
        .post('/api/conversations/conv-1/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Bonjour tout le monde !', type: 'text' });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('devrait refuser un message vide sans fichier', async () => {
      const token = generateToken();
      const res = await request(app)
        .post('/api/conversations/conv-1/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '', type: 'text' });

      // Selon la logique métier, un message vide sans fichier est invalide
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  // ── Réactions ──────────────────────────────────────────────
  describe('POST /api/conversations/:convId/messages/:msgId/reactions', () => {
    it('devrait ajouter une réaction emoji', async () => {
      const token = generateToken();
      const res = await request(app)
        .post('/api/conversations/conv-1/messages/msg-1/reactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ emoji: '👍' });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });
  });
});
