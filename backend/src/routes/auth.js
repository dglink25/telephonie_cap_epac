// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');
const {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  me,
  changePassword,
} = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Authentification
 *   description: Gestion des sessions et comptes utilisateurs
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Créer un nouveau compte
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password, display_name]
 *             properties:
 *               username: { type: string, minLength: 3 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               display_name: { type: string }
 *               department: { type: string }
 *     responses:
 *       201: { description: Compte créé }
 *       409: { description: Nom d'utilisateur ou email déjà pris }
 */
router.post('/register', validate(schemas.register), register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Connexion réussie, retourne accessToken }
 *       401: { description: Identifiants incorrects }
 *       403: { description: Compte verrouillé }
 */
router.post('/login', loginLimiter, validate(schemas.login), login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renouveler l'access token via refresh token (cookie)
 *     tags: [Authentification]
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Déconnexion (révoque le token courant)
 *     tags: [Authentification]
 *     security: [{bearerAuth: []}]
 */
router.post('/logout', authenticate, logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Déconnexion de toutes les sessions
 *     tags: [Authentification]
 *     security: [{bearerAuth: []}]
 */
router.post('/logout-all', authenticate, logoutAll);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Profil de l'utilisateur connecté
 *     tags: [Authentification]
 *     security: [{bearerAuth: []}]
 */
router.get('/me', authenticate, me);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Changer son mot de passe
 *     tags: [Authentification]
 *     security: [{bearerAuth: []}]
 */
router.post('/change-password', authenticate, validate(schemas.changePassword), changePassword);

module.exports = router;
