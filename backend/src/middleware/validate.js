// src/middleware/validate.js
const { z } = require('zod');

/**
 * Usine de middleware de validation Zod
 * @param {z.ZodSchema} schema
 * @param {'body'|'query'|'params'} target
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    try {
      const data = schema.parse(req[target]);
      req[target] = data; // remplace les données nettoyées
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(422).json({
          success: false,
          message: 'Données invalides',
          errors: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };
};

// ── Schémas de validation ────────────────────────────────────────

const schemas = {
  // Auth
  register: z.object({
    username: z
      .string()
      .min(3, 'Minimum 3 caractères')
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, 'Caractères alphanumériques, points, tirets uniquement'),
    // email composé automatiquement côté serveur — ne pas exiger ici
    password: z
      .string()
      .min(8, 'Minimum 8 caractères')
      .regex(/[A-Z]/, 'Au moins une majuscule')
      .regex(/[0-9]/, 'Au moins un chiffre'),
    display_name: z.string().min(2).max(100),
    department: z.enum(
      ['Direction', 'Responsable Division', 'Secrétariat', 'Soutien Informatique'],
      { errorMap: () => ({ message: 'Service invalide ou manquant.' }) }
    ),
  }),

  login: z.object({
    username: z.string().min(1, 'Identifiant requis'),
    password: z.string().min(1, 'Mot de passe requis'),
  }),

  changePassword: z.object({
    current_password: z.string().min(1),
    new_password: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[0-9]/),
  }),

  // Utilisateurs
  updateProfile: z.object({
    display_name: z.string().min(2).max(100).optional(),
    department: z.string().max(100).optional(),
    phone_extension: z.string().max(20).optional(),
  }),

  updatePresence: z.object({
    status: z.enum(['online', 'away', 'dnd', 'offline']),
  }),

  // Conversations
  createConversation: z.object({
    type: z.enum(['direct', 'group']),
    name: z.string().min(1).max(100).optional(),
    member_ids: z.array(z.string().uuid()).min(1).max(50),
  }),

  // Messages
  sendMessage: z.object({
    content: z.string().min(1).max(10000).optional(),
    type: z.enum(['text', 'image', 'file', 'audio']).default('text'),
    reply_to_id: z.string().uuid().optional(),
  }),

  editMessage: z.object({
    content: z.string().min(1).max(10000),
  }),

  // Réactions
  addReaction: z.object({
    emoji: z.string().min(1).max(10),
  }),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    search: z.string().max(200).optional(),
  }),
};

module.exports = { validate, schemas };