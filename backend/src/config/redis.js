// src/config/redis.js
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      const delay = Math.min(times * 500, 5000);
      return delay;
    },
  });

  redisClient.on('connect', () => logger.info('✅ Connexion Redis établie'));
  redisClient.on('error', (err) => logger.error('❌ Erreur Redis:', err.message));
  redisClient.on('reconnecting', () => logger.warn('⚠️  Redis: reconnexion en cours...'));

  await redisClient.connect();
  return redisClient;
};

const getRedis = () => {
  if (!redisClient) throw new Error('Redis non initialisé');
  return redisClient;
};

// Helpers pour la présence
const setUserPresence = async (userId, status, socketId = null) => {
  const redis = getRedis();
  const key = `presence:${userId}`;
  await redis.hset(key, {
    status,
    socketId: socketId || '',
    updatedAt: new Date().toISOString(),
  });
  await redis.expire(key, 3600); // TTL 1h
};

const getUserPresence = async (userId) => {
  const redis = getRedis();
  return redis.hgetall(`presence:${userId}`);
};

const removeUserPresence = async (userId) => {
  const redis = getRedis();
  await redis.del(`presence:${userId}`);
};

// Helpers pour blacklist de tokens
const blacklistToken = async (jti, expiresInSeconds) => {
  const redis = getRedis();
  await redis.set(`blacklist:${jti}`, '1', 'EX', expiresInSeconds);
};

const isTokenBlacklisted = async (jti) => {
  const redis = getRedis();
  const exists = await redis.exists(`blacklist:${jti}`);
  return exists === 1;
};

// Helper pour rate limiting
const incrementLoginAttempts = async (identifier) => {
  const redis = getRedis();
  const key = `login_attempts:${identifier}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 1800); // 30 minutes
  return count;
};

const resetLoginAttempts = async (identifier) => {
  const redis = getRedis();
  await redis.del(`login_attempts:${identifier}`);
};

module.exports = {
  connectRedis,
  getRedis,
  setUserPresence,
  getUserPresence,
  removeUserPresence,
  blacklistToken,
  isTokenBlacklisted,
  incrementLoginAttempts,
  resetLoginAttempts,
};
