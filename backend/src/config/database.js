// src/config/database.js
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'cap_epac_telephonie',
  process.env.DB_USER || 'cap_epac_user',
  process.env.DB_PASSWORD || 'CapEpac@2025',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    timezone: '+00:00',
    logging: (msg) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(msg);
      }
    },
    pool: {
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      supportBigNumbers: true,
      bigNumberStrings: true,
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      underscored: false,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

const connectDB = async () => {
  let retries = 10;
  while (retries) {
    try {
      await sequelize.authenticate();
      logger.info('✅ Connexion MySQL établie avec succès');
      return sequelize;
    } catch (err) {
      retries -= 1;
      logger.warn(`⚠️  MySQL non disponible — tentative restantes: ${retries}. Attente 5s...`);
      if (!retries) throw err;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
};

module.exports = { sequelize, connectDB };
