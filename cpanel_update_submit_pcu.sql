-- =============================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL DATABASE UPDATE SCRIPT
-- Purpose: Schema Update for "Submit PCU" Page & Multi-Image Attachments
-- Compatible with: cPanel MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Execution: Run in cPanel > phpMyAdmin > SQL Tab OR via MySQL CLI
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- -----------------------------------------------------------------------------
-- 1. Create `pcu_submissions` Table for "Submit PCU" Page Records
-- Stores Patient Info, Multi-File Attachments, Base44 Sync Metadata, and Status
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pcu_submissions` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `contact_id` VARCHAR(100) DEFAULT '',
  `full_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) NOT NULL DEFAULT '',
  `purok` VARCHAR(255) DEFAULT '',
  `contact_number` VARCHAR(100) DEFAULT '',
  `file_name` VARCHAR(255) DEFAULT '',
  `file_url` LONGTEXT,
  `uploaded_files` LONGTEXT NULL,
  `uploaded_by` VARCHAR(255) DEFAULT 'Admin',
  `uploaded_at` VARCHAR(100) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(50) DEFAULT 'SUBMITTED',
  INDEX `idx_pcu_barangay` (`barangay`),
  INDEX `idx_pcu_full_name` (`full_name`),
  INDEX `idx_pcu_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Ensure `contacts` Table Supports PCU Multi-File Attachments & Metadata
-- -----------------------------------------------------------------------------
-- Add `pcu_file_url` if not present
SET @dbname = DATABASE();
SET @tablename = "contacts";
SET @columnname = "pcu_file_url";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `contacts` ADD COLUMN `pcu_file_url` LONGTEXT AFTER `photo_url`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add `pcu_uploaded_by` if not present
SET @columnname = "pcu_uploaded_by";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `contacts` ADD COLUMN `pcu_uploaded_by` VARCHAR(255) DEFAULT '' AFTER `pcu_file_url`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add `pcu_uploaded_at` if not present
SET @columnname = "pcu_uploaded_at";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `contacts` ADD COLUMN `pcu_uploaded_at` VARCHAR(100) DEFAULT '' AFTER `pcu_uploaded_by`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add `is_submitted` if not present
SET @columnname = "is_submitted";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `contacts` ADD COLUMN `is_submitted` TINYINT(1) DEFAULT 0 AFTER `status`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- UPDATE VERIFICATION QUERY
-- Run this check to verify the new table exists:
-- SHOW TABLES LIKE 'pcu_submissions';
-- DESCRIBE `pcu_submissions`;
-- =============================================================================
