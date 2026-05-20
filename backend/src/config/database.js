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
    // Silencer les warnings de configuration en mode production
    logging: process.env.NODE_ENV === 'development'
      ? (msg) => logger.debug(msg)
      : false,
    pool: {
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      // ⚠️ NE PAS mettre charset/collate ici — ce sont des options invalides pour mysql2
      // Elles sont définies au niveau de la BDD directement (init.sql)
      supportBigNumbers: true,
      bigNumberStrings: true,
      decimalNumbers: true,
    },
    define: {
      // charset/collate retirés du define aussi (invalides dans Sequelize v6 + mysql2)
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: false,
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
      logger.warn(`⚠️  MySQL non disponible — tentatives restantes: ${retries}. Attente 5s...`);
      if (!retries) throw err;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
};

module.exports = { sequelize, connectDB };
