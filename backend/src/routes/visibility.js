// src/routes/visibility.js
'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getDepartments, getRules, getMatrix, updateRules, updateMatrix,
} = require('../controllers/visibilityController');

// Lecture (admin seulement pour la matrice complète)
router.get('/departments', authenticate, getDepartments);
router.get('/rules',       authenticate, requireAdmin, getRules);
router.get('/matrix',      authenticate, requireAdmin, getMatrix);

// Écriture (admin seulement)
router.put('/rules',   authenticate, requireAdmin, updateRules);
router.post('/matrix', authenticate, requireAdmin, updateMatrix);

module.exports = router;
