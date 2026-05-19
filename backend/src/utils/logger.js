// src/utils/logger.js
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, json, colorize, printf } = winston.format;

const logDir = path.join(__dirname, '../../logs');

const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}] ${message}${metaStr}`;
});

const fileTransport = new winston.transports.DailyRotateFile({
  dirname: logDir,
  filename: 'cap-epac-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: combine(timestamp(), json()),
});

const errorFileTransport = new winston.transports.DailyRotateFile({
  dirname: logDir,
  filename: 'cap-epac-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: combine(timestamp(), json()),
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      ),
    }),
    fileTransport,
    errorFileTransport,
  ],
});

module.exports = logger;
