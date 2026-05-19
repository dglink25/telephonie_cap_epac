// src/controllers/callController.js
const { Op } = require('sequelize');
const { CallLog, User } = require('../models');
const logger = require('../utils/logger');

/**
 * GET /api/calls — Journal des appels de l'utilisateur
 */
const getCallLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, type, status } = req.query;
    const userId = req.user.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      [Op.or]: [{ caller_id: userId }, { callee_id: userId }],
    };
    if (type) where.type = type;
    if (status) where.status = status;

    const { count, rows } = await CallLog.findAndCountAll({
      where,
      include: [
        { model: User, as: 'caller', attributes: ['id', 'display_name', 'avatar_url'] },
        { model: User, as: 'callee', attributes: ['id', 'display_name', 'avatar_url'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return res.json({
      success: true,
      data: {
        calls: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/calls/stats — Statistiques des appels (admin)
 */
const getCallStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const total = await CallLog.count({ where });
    const byStatus = await CallLog.findAll({
      where,
      attributes: ['status', [require('sequelize').fn('COUNT', '*'), 'count']],
      group: ['status'],
      raw: true,
    });
    const byType = await CallLog.findAll({
      where,
      attributes: ['type', [require('sequelize').fn('COUNT', '*'), 'count']],
      group: ['type'],
      raw: true,
    });

    return res.json({
      success: true,
      data: { total, byStatus, byType },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/calls/:id — Détail d'un appel
 */
const getCallById = async (req, res, next) => {
  try {
    const call = await CallLog.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [{ caller_id: req.user.id }, { callee_id: req.user.id }],
      },
      include: [
        { model: User, as: 'caller', attributes: ['id', 'display_name', 'avatar_url'] },
        { model: User, as: 'callee', attributes: ['id', 'display_name', 'avatar_url'] },
      ],
    });

    if (!call) return res.status(404).json({ success: false, message: 'Appel introuvable' });

    return res.json({ success: true, data: { call } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/calls — Créer une entrée de journal d'appel
 */
const createCallLog = async (req, res, next) => {
  try {
    const { callee_id, type = 'audio' } = req.body;
    const callLog = await CallLog.create({
      caller_id: req.user.id,
      callee_id,
      type,
      status: 'ongoing',
    });

    return res.status(201).json({ success: true, data: { call: callLog } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/calls/:id — Mettre à jour le statut d'un appel
 */
const updateCallLog = async (req, res, next) => {
  try {
    const { status, started_at, ended_at } = req.body;
    const call = await CallLog.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [{ caller_id: req.user.id }, { callee_id: req.user.id }],
      },
    });

    if (!call) return res.status(404).json({ success: false, message: 'Appel introuvable' });

    if (status) call.status = status;
    if (started_at) call.started_at = started_at;
    if (ended_at) {
      call.ended_at = ended_at;
      if (call.started_at) {
        call.duration_seconds = Math.floor(
          (new Date(ended_at) - new Date(call.started_at)) / 1000
        );
      }
    }

    await call.save();

    return res.json({ success: true, data: { call } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCallLogs,
  getCallStats,
  getCallById,
  createCallLog,
  updateCallLog,
};
