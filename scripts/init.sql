-- ═══════════════════════════════════════════════════════════════
-- Téléphonie CAP-EPAC — Initialisation Base MySQL
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Table users ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`              CHAR(36)     NOT NULL DEFAULT (UUID()),
  `username`        VARCHAR(50)  NOT NULL,
  `email`           VARCHAR(100) NOT NULL,
  `password_hash`   VARCHAR(255) NOT NULL,
  `display_name`    VARCHAR(100) NOT NULL,
  `avatar_url`      TEXT         DEFAULT NULL,
  `role`            ENUM('admin','user') NOT NULL DEFAULT 'user',
  `presence_status` ENUM('online','away','dnd','offline') NOT NULL DEFAULT 'offline',
  `department`      VARCHAR(100) DEFAULT NULL,
  `phone_extension` VARCHAR(20)  DEFAULT NULL,
  `is_active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `login_attempts`  INT          NOT NULL DEFAULT 0,
  `locked_until`    DATETIME     DEFAULT NULL,
  `last_seen_at`    DATETIME     DEFAULT NULL,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  INDEX `idx_users_presence` (`presence_status`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_department` (`department`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table refresh_tokens ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`         CHAR(36)  NOT NULL DEFAULT (UUID()),
  `user_id`    CHAR(36)  NOT NULL,
  `token_hash` TEXT      NOT NULL,
  `device_info` VARCHAR(255) DEFAULT NULL,
  `expires_at` DATETIME  NOT NULL,
  `created_at` DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_rt_user_id` (`user_id`),
  CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table token_blacklist ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `token_blacklist` (
  `id`         CHAR(36)  NOT NULL DEFAULT (UUID()),
  `token_jti`  VARCHAR(255) NOT NULL,
  `expires_at` DATETIME  NOT NULL,
  `created_at` DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token_jti` (`token_jti`),
  INDEX `idx_token_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table conversations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `conversations` (
  `id`         CHAR(36)     NOT NULL DEFAULT (UUID()),
  `name`       VARCHAR(100) DEFAULT NULL,
  `type`       ENUM('direct','group') NOT NULL DEFAULT 'direct',
  `avatar_url` TEXT         DEFAULT NULL,
  `created_by` CHAR(36)     NOT NULL,
  `is_muted`   TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_conv_type` (`type`),
  INDEX `idx_conv_created_by` (`created_by`),
  CONSTRAINT `fk_conv_creator` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table conversation_members ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `conversation_members` (
  `id`              CHAR(36) NOT NULL DEFAULT (UUID()),
  `conversation_id` CHAR(36) NOT NULL,
  `user_id`         CHAR(36) NOT NULL,
  `role`            ENUM('admin','member') NOT NULL DEFAULT 'member',
  `last_read_at`    DATETIME DEFAULT NULL,
  `is_muted`        TINYINT(1) NOT NULL DEFAULT 0,
  `joined_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conv_member` (`conversation_id`, `user_id`),
  INDEX `idx_cm_user_id` (`user_id`),
  CONSTRAINT `fk_cm_conv` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cm_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table messages ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `messages` (
  `id`              CHAR(36)  NOT NULL DEFAULT (UUID()),
  `conversation_id` CHAR(36)  NOT NULL,
  `sender_id`       CHAR(36)  NOT NULL,
  `content`         TEXT      DEFAULT NULL,
  `type`            ENUM('text','image','file','system','audio') NOT NULL DEFAULT 'text',
  `reply_to_id`     CHAR(36)  DEFAULT NULL,
  `file_url`        TEXT      DEFAULT NULL,
  `file_name`       VARCHAR(255) DEFAULT NULL,
  `file_size`       BIGINT    DEFAULT NULL,
  `file_mime`       VARCHAR(100) DEFAULT NULL,
  `is_edited`       TINYINT(1) NOT NULL DEFAULT 0,
  `is_deleted`      TINYINT(1) NOT NULL DEFAULT 0,
  `is_pinned`       TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_msg_conv` (`conversation_id`),
  INDEX `idx_msg_sender` (`sender_id`),
  INDEX `idx_msg_created` (`created_at`),
  FULLTEXT INDEX `ft_msg_content` (`content`),
  CONSTRAINT `fk_msg_conv` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_msg_sender` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_msg_reply` FOREIGN KEY (`reply_to_id`) REFERENCES `messages`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table message_reactions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `message_reactions` (
  `id`         CHAR(36)    NOT NULL DEFAULT (UUID()),
  `message_id` CHAR(36)    NOT NULL,
  `user_id`    CHAR(36)    NOT NULL,
  `emoji`      VARCHAR(10) NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reaction` (`message_id`, `user_id`, `emoji`),
  CONSTRAINT `fk_react_msg` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_react_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table message_read_status ───────────────────────────────────
CREATE TABLE IF NOT EXISTS `message_read_status` (
  `id`         CHAR(36) NOT NULL DEFAULT (UUID()),
  `message_id` CHAR(36) NOT NULL,
  `user_id`    CHAR(36) NOT NULL,
  `read_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_read_status` (`message_id`, `user_id`),
  CONSTRAINT `fk_rs_msg` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table call_logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `call_logs` (
  `id`               CHAR(36)  NOT NULL DEFAULT (UUID()),
  `caller_id`        CHAR(36)  NOT NULL,
  `callee_id`        CHAR(36)  NOT NULL,
  `conversation_id`  CHAR(36)  DEFAULT NULL,
  `type`             ENUM('audio','video','group_audio','group_video') NOT NULL DEFAULT 'audio',
  `status`           ENUM('completed','missed','rejected','failed','ongoing') NOT NULL DEFAULT 'ongoing',
  `started_at`       DATETIME  DEFAULT NULL,
  `ended_at`         DATETIME  DEFAULT NULL,
  `duration_seconds` INT       DEFAULT 0,
  `recording_path`   TEXT      DEFAULT NULL,
  `sdp_offer`        TEXT      DEFAULT NULL,
  `sdp_answer`       TEXT      DEFAULT NULL,
  `created_at`       DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_call_caller` (`caller_id`),
  INDEX `idx_call_callee` (`callee_id`),
  INDEX `idx_call_status` (`status`),
  INDEX `idx_call_created` (`created_at`),
  CONSTRAINT `fk_call_caller` FOREIGN KEY (`caller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_call_callee` FOREIGN KEY (`callee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table call_participants ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `call_participants` (
  `id`         CHAR(36) NOT NULL DEFAULT (UUID()),
  `call_id`    CHAR(36) NOT NULL,
  `user_id`    CHAR(36) NOT NULL,
  `joined_at`  DATETIME DEFAULT NULL,
  `left_at`    DATETIME DEFAULT NULL,
  `is_muted`   TINYINT(1) NOT NULL DEFAULT 0,
  `video_on`   TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_cp_call` (`call_id`),
  CONSTRAINT `fk_cp_call` FOREIGN KEY (`call_id`) REFERENCES `call_logs`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cp_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table contacts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `contacts` (
  `id`         CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id`    CHAR(36) NOT NULL,
  `contact_id` CHAR(36) NOT NULL,
  `is_blocked` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contact` (`user_id`, `contact_id`),
  CONSTRAINT `fk_ct_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ct_contact` FOREIGN KEY (`contact_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table audit_logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`         CHAR(36)     NOT NULL DEFAULT (UUID()),
  `user_id`    CHAR(36)     DEFAULT NULL,
  `action`     VARCHAR(100) NOT NULL,
  `resource`   VARCHAR(100) DEFAULT NULL,
  `ip_address` VARCHAR(45)  DEFAULT NULL,
  `details`    JSON         DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Données initiales : Compte administrateur ───────────────────
-- Mot de passe par défaut : Admin@CapEpac2025  (bcrypt hash)
INSERT IGNORE INTO `users` (
  `id`, `username`, `email`, `password_hash`, `display_name`, `role`, `presence_status`, `department`
) VALUES (
  UUID(),
  'admin',
  'admin@cap-epac.local',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.5g5O',
  'Administrateur CAP-EPAC',
  'admin',
  'offline',
  'Administration'
);
