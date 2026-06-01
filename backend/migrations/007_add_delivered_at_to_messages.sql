-- Migration: Ajouter delivered_at aux messages pour tracking de délivrance
-- Date: 2026-05-30

ALTER TABLE messages 
ADD COLUMN delivered_at DATETIME NULL AFTER created_at,
ADD INDEX idx_delivered_at (delivered_at);
