// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes         = require('./auth');
const userRoutes         = require('./users');
const conversationRoutes = require('./conversations');
const callRoutes         = require('./calls');
const groupRoutes        = require('./groups');
const notificationRoutes = require('./notifications');
const webhookRoutes      = require('./webhook');
const meetingRoutes      = require('./meetings');

router.use('/auth',          authRoutes);
router.use('/users',         userRoutes);
router.use('/conversations', conversationRoutes);
router.use('/calls',         callRoutes);
router.use('/groups',        groupRoutes);
router.use('/notifications', notificationRoutes);
router.use('/webhook',       webhookRoutes);
router.use('/meetings',      meetingRoutes);

module.exports = router;
