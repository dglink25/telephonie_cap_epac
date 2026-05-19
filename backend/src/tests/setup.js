// backend/src/tests/setup.js
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-tests-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-tests-only';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'cap_epac_test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PASSWORD = 'test';
process.env.LOG_LEVEL = 'error'; // Silence les logs pendant les tests
