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
  `id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `name`        VARCHAR(100) DEFAULT NULL,
  `description` TEXT         DEFAULT NULL,
  `type`        ENUM('direct','group') NOT NULL DEFAULT 'direct',
  `avatar_url`  TEXT         DEFAULT NULL,
  `created_by`  CHAR(36)     NOT NULL,
  `is_muted`    TINYINT(1)   NOT NULL DEFAULT 0,
  `is_general`  TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_conv_type` (`type`),
  INDEX `idx_conv_is_general` (`is_general`),
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
  `type`            ENUM('text','image','file','system','audio','video') NOT NULL DEFAULT 'text',
  `reply_to_id`     CHAR(36)  DEFAULT NULL,
  `file_url`        TEXT      DEFAULT NULL,
  `file_name`       VARCHAR(255) DEFAULT NULL,
  `file_size`       BIGINT    DEFAULT NULL,
  `file_mime`       VARCHAR(100) DEFAULT NULL,
  `is_edited`       TINYINT(1) NOT NULL DEFAULT 0,
  `is_deleted`      TINYINT(1) NOT NULL DEFAULT 0,
  `is_pinned`       TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delivered_at`    DATETIME  DEFAULT NULL,
  `updated_at`      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_msg_conv` (`conversation_id`),
  INDEX `idx_msg_sender` (`sender_id`),
  INDEX `idx_msg_created` (`created_at`),
  INDEX `idx_delivered_at` (`delivered_at`),
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
  `created_at`       DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_call_caller` (`caller_id`),
  INDEX `idx_call_callee` (`callee_id`),
  INDEX `idx_call_status` (`status`),
  CONSTRAINT `fk_call_caller` FOREIGN KEY (`caller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_call_callee` FOREIGN KEY (`callee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table notifications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `user_id`    CHAR(36)     NOT NULL,
  `type`       ENUM('message','mention','call_missed','call_incoming','group_added','group_removed','user_status','system') NOT NULL,
  `title`      VARCHAR(255) NOT NULL,
  `message`    TEXT         DEFAULT NULL,
  `data`       JSON         DEFAULT NULL,
  `is_read`    TINYINT(1)   NOT NULL DEFAULT 0,
  `read_at`    DATETIME     DEFAULT NULL,
  `action_url` VARCHAR(500) DEFAULT NULL,
  `priority`   ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `expires_at` DATETIME     DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notif_user_id` (`user_id`),
  INDEX `idx_notif_is_read` (`is_read`),
  INDEX `idx_notif_type` (`type`),
  INDEX `idx_notif_created` (`created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Table refresh_tokens ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `refresh_tokens_v2` (
  `id`         CHAR(36)  NOT NULL DEFAULT (UUID()),
  `user_id`    CHAR(36)  NOT NULL,
  `token_hash` TEXT      NOT NULL,
  `device_info` VARCHAR(255) DEFAULT NULL,
  `expires_at` DATETIME  NOT NULL,
  `created_at` DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Admin par défaut ─────────────────────────────────────────────
-- Mot de passe : Admin@CapEpac2025
INSERT IGNORE INTO `users` (
  `id`, `username`, `email`, `password_hash`, `display_name`, `role`, `presence_status`, `department`
) VALUES (
  UUID(),
  'admin',
  'admin@cap-epac.local',
  '$2b$12$cWVazL3y6VAfP8FF9X.hKu9YlUaPwR0dFMeE0.n0HIOY80GEtiYUO',
  'Administrateur CAP-EPAC',
  'admin',
  'offline',
  'Administration'
);

-- ── Groupe Général (créé automatiquement) ────────────────────────
-- Sera géré par le backend au démarrage
