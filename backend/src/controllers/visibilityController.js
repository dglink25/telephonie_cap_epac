// src/controllers/visibilityController.js
'use strict';

const { Op } = require('sequelize');
const { User, DepartmentVisibility } = require('../models');
const logger = require('../utils/logger');

// ── GET /api/visibility/departments ────────────────────────────
// Retourne la liste de tous les services existants
const getDepartments = async (req, res, next) => {
  try {
    const rows = await User.findAll({
      attributes: ['department'],
      where: { department: { [Op.ne]: null }, is_active: true },
      group: ['department'],
      raw: true,
    });
    const departments = rows
      .map((r) => r.department)
      .filter(Boolean)
      .sort();

    return res.json({ success: true, data: { departments } });
  } catch (err) { next(err); }
};

// ── GET /api/visibility/rules ───────────────────────────────────
// Retourne toutes les règles de visibilité
const getRules = async (req, res, next) => {
  try {
    const rules = await DepartmentVisibility.findAll({ raw: true });
    return res.json({ success: true, data: { rules } });
  } catch (err) { next(err); }
};

// ── GET /api/visibility/matrix ──────────────────────────────────
// Retourne la matrice complète (pour l'UI admin)
const getMatrix = async (req, res, next) => {
  try {
    // S'assurer que la table existe
    await DepartmentVisibility.sync({ alter: false }).catch(() => {});

    // Tous les services
    const rows = await User.findAll({
      attributes: ['department'],
      where: { department: { [Op.ne]: null }, is_active: true },
      group: ['department'],
      raw: true,
    });
    const departments = rows.map((r) => r.department).filter(Boolean).sort();

    // Toutes les règles existantes
    const rules = await DepartmentVisibility.findAll({ raw: true });

    // Construire la matrice : matrix[from][to] = true/false
    const matrix = {};
    departments.forEach((from) => {
      matrix[from] = {};
      departments.forEach((to) => {
        // Un service se voit toujours lui-même
        matrix[from][to] = from === to ? true :
          rules.some((r) => r.from_department === from && r.to_department === to);
      });
    });

    return res.json({ success: true, data: { departments, matrix } });
  } catch (err) { next(err); }
};

// ── PUT /api/visibility/rules ───────────────────────────────────
// Remplace toutes les règles d'un service (from_department)
const updateRules = async (req, res, next) => {
  try {
    const { from_department, visible_departments } = req.body;

    if (!from_department || !Array.isArray(visible_departments)) {
      return res.status(400).json({
        success: false,
        message: 'from_department (string) et visible_departments (array) requis',
      });
    }

    // Supprimer les anciennes règles pour ce service
    await DepartmentVisibility.destroy({ where: { from_department } });

    // Insérer les nouvelles (sauf le service lui-même — toujours visible)
    const toInsert = visible_departments
      .filter((d) => d !== from_department)
      .map((to_department) => ({ from_department, to_department }));

    if (toInsert.length > 0) {
      await DepartmentVisibility.bulkCreate(toInsert, {
        ignoreDuplicates: true,
      });
    }

    logger.info(`[Visibility] Règles mises à jour pour "${from_department}" par ${req.user.username}`);

    return res.json({
      success: true,
      message: `Visibilité du service "${from_department}" mise à jour`,
    });
  } catch (err) { next(err); }
};

// ── POST /api/visibility/matrix ─────────────────────────────────
// Remplace TOUTE la matrice d'un coup
const updateMatrix = async (req, res, next) => {
  try {
    const { rules } = req.body; // [{ from, to }]

    if (!Array.isArray(rules)) {
      return res.status(400).json({ success: false, message: 'rules (array) requis' });
    }

    // Supprimer toutes les règles
    await DepartmentVisibility.destroy({ where: {} });

    // Réinsérer
    if (rules.length > 0) {
      await DepartmentVisibility.bulkCreate(
        rules.map(({ from, to }) => ({ from_department: from, to_department: to })),
        { ignoreDuplicates: true }
      );
    }

    logger.info(`[Visibility] Matrice complète mise à jour par ${req.user.username} (${rules.length} règles)`);

    return res.json({ success: true, message: 'Matrice de visibilité mise à jour' });
  } catch (err) { next(err); }
};

// ── Helper exporté : filtrer les utilisateurs visibles ──────────
// Utilisé par getUsers, recherche, création de conversations
const getVisibleDepartments = async (userDepartment) => {
  if (!userDepartment) return null; // null = ne voit personne

  const rules = await DepartmentVisibility.findAll({
    where: { from_department: userDepartment },
    attributes: ['to_department'],
    raw: true,
  });

  const visible = [userDepartment, ...rules.map((r) => r.to_department)];
  return [...new Set(visible)];
};

module.exports = {
  getDepartments,
  getRules,
  getMatrix,
  updateRules,
  updateMatrix,
  getVisibleDepartments,
};
