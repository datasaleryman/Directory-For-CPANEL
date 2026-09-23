-- =============================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL DATABASE UPDATE SCRIPT
-- Purpose: Schema Update for Master Admin PCU Permanent Deletion & Audit Logging
-- Compatible with: cPanel MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Execution: Run in cPanel > phpMyAdmin > SQL Tab OR via MySQL CLI
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- -----------------------------------------------------------------------------
-- 1. Create or Verify `pcu_submissions` Table for Submit PCU Page
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
  INDEX `idx_pcu_contact_id` (`contact_id`),
  INDEX `idx_pcu_barangay` (`barangay`),
  INDEX `idx_pcu_full_name` (`full_name`),
  INDEX `idx_pcu_uploaded_at` (`uploaded_at`),
  INDEX `idx_pcu_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Create `pcu_deletion_audit` Table for Master Admin Deletion Trail
-- Logs permanent deletions of PCU records and individual files
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pcu_deletion_audit` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `submission_id` VARCHAR(100) DEFAULT '',
  `patient_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) DEFAULT '',
  `file_name` VARCHAR(255) DEFAULT '',
  `action_type` VARCHAR(50) NOT NULL DEFAULT 'SUBMISSION_DELETED',
  `deleted_by` VARCHAR(255) NOT NULL DEFAULT 'Master Admin',
  `deleted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `ip_address` VARCHAR(100) DEFAULT '',
  `details` TEXT NULL,
  INDEX `idx_pcu_del_patient` (`patient_name`),
  INDEX `idx_pcu_del_action` (`action_type`),
  INDEX `idx_pcu_del_by` (`deleted_by`),
  INDEX `idx_pcu_del_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Ensure `contacts` Table Supports PCU File URL & Metadata Columns
-- -----------------------------------------------------------------------------
SET @dbname = DATABASE();
SET @tablename = "contacts";

-- Add `pcu_file_url` if not present
SET @columnname = "pcu_file_url";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
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
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
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
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
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
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `contacts` ADD COLUMN `is_submitted` TINYINT(1) DEFAULT 0 AFTER `status`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- -----------------------------------------------------------------------------
-- 4. Ensure Master Administrator Role in `users` Table
-- Ensures the master admin account has MASTER ADMIN role for delete access
-- -----------------------------------------------------------------------------
UPDATE `users` 
SET `role` = 'MASTER ADMIN', `status` = 'Active' 
WHERE LOWER(TRIM(`username`)) = 'admin';

-- -----------------------------------------------------------------------------
-- 5. Verification & Diagnostics Queries
-- -----------------------------------------------------------------------------
SELECT 'pcu_submissions table status:' AS check_item, COUNT(*) AS record_count FROM `pcu_submissions`;
SELECT 'pcu_deletion_audit table status:' AS check_item, COUNT(*) AS log_count FROM `pcu_deletion_audit`;
SELECT username, role, status FROM `users` WHERE LOWER(TRIM(username)) = 'admin';

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- UPDATE COMPLETE: cPanel MySQL database is updated for Master Admin Deletion
-- =============================================================================
