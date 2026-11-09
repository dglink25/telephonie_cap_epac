// src/models/DepartmentVisibility.js
// Table de visibilité inter-services
// Règle : les utilisateurs du service `from_department` peuvent voir
//         les utilisateurs du service `to_department`
// La relation est DIRECTIONNELLE (non symétrique)
'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DepartmentVisibility = sequelize.define(
  'DepartmentVisibility',
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    from_department: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Le service qui peut voir',
    },
    to_department: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Le service qui est visible',
    },
  },
  {
    tableName: 'department_visibility',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['from_department', 'to_department'],
        name: 'unique_dept_visibility',
      },
    ],
  }
);

module.exports = DepartmentVisibility;
