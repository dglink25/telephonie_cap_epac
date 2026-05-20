// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes         = require('./auth');
const userRoutes         = require('./users');
const conversationRoutes = require('./conversations');
const callRoutes         = require('./calls');
const groupRoutes        = require('./groups');

router.use('/auth',          authRoutes);
router.use('/users',         userRoutes);
router.use('/conversations', conversationRoutes);
router.use('/calls',         callRoutes);
router.use('/groups',        groupRoutes);

module.exports = router;
