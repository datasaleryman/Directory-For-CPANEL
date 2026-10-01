-- =============================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL DATABASE UPDATE SCRIPT
-- Purpose: Schema Update for "Returned" Page, Submitter Account ID Tracking,
--          Daily Barangay Counts & Submitted Existing Accounts
-- Compatible with: cPanel MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- How to apply:
--   1. Log into your cPanel dashboard
--   2. Open phpMyAdmin
--   3. Select your clinic database (e.g., yourcpanel_clinicdb)
--   4. Click on the "SQL" tab at the top
--   5. Paste this entire script and click "Go"
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+08:00"; -- Asia/Manila (UTC+8)

-- -----------------------------------------------------------------------------
-- 1. Ensure `pcu_submissions` Table Exists & Has Return & Submitter Columns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pcu_submissions` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `contact_id` VARCHAR(100) DEFAULT '',
  `submitter_id` VARCHAR(100) DEFAULT '',
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
  `status` VARCHAR(50) DEFAULT 'FILES',
  `verified_at` VARCHAR(100) NULL,
  `verified_by` VARCHAR(255) NULL,
  `pending_at` VARCHAR(100) NULL,
  `pending_by` VARCHAR(255) NULL,
  `updated_status_at` VARCHAR(100) NULL,
  `updated_status_by` VARCHAR(255) NULL,
  `returned_at` VARCHAR(100) NULL,
  `returned_by` VARCHAR(255) NULL,
  `returned_by_id` VARCHAR(100) NULL,
  `return_reason` TEXT NULL,
  `credit_added` TINYINT(1) DEFAULT 0,
  `verified_credit_added` TINYINT(1) DEFAULT 0,
  `pending_credit_added` TINYINT(1) DEFAULT 0,
  `notes` TEXT NULL,
  INDEX `idx_pcu_barangay` (`barangay`),
  INDEX `idx_pcu_full_name` (`full_name`),
  INDEX `idx_pcu_status` (`status`),
  INDEX `idx_pcu_submitter` (`submitter_id`),
  INDEX `idx_pcu_uploaded_by` (`uploaded_by`),
  INDEX `idx_pcu_uploaded_at` (`uploaded_at`),
  INDEX `idx_pcu_returned_at` (`returned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safely add `submitter_id` column to `pcu_submissions` if table already exists
SET @dbname = DATABASE();
SET @tablename = "pcu_submissions";
SET @columnname = "submitter_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `pcu_submissions` ADD COLUMN `submitter_id` VARCHAR(100) DEFAULT '' AFTER `contact_id`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Safely add `returned_at` column to `pcu_submissions`
SET @columnname = "returned_at";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `pcu_submissions` ADD COLUMN `returned_at` VARCHAR(100) NULL AFTER `updated_status_by`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Safely add `returned_by` column to `pcu_submissions`
SET @columnname = "returned_by";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `pcu_submissions` ADD COLUMN `returned_by` VARCHAR(255) NULL AFTER `returned_at`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Safely add `returned_by_id` column to `pcu_submissions`
SET @columnname = "returned_by_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `pcu_submissions` ADD COLUMN `returned_by_id` VARCHAR(100) NULL AFTER `returned_by`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Safely add `return_reason` column to `pcu_submissions`
SET @columnname = "return_reason";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `pcu_submissions` ADD COLUMN `return_reason` TEXT NULL AFTER `returned_by_id`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Backfill submitter_id with uploaded_by where missing
UPDATE `pcu_submissions`
SET `submitter_id` = `uploaded_by`
WHERE (`submitter_id` IS NULL OR `submitter_id` = '') AND `uploaded_by` IS NOT NULL AND `uploaded_by` != '';

-- -----------------------------------------------------------------------------
-- 2. Ensure `submitted_exist_acc` Table Has Submitter ID & is_submitted Flag
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `submitted_exist_acc` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `exist_account_id` VARCHAR(100) NOT NULL,
  `submitter_id` VARCHAR(100) DEFAULT '',
  `full_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) NOT NULL DEFAULT 'General / Unassigned',
  `purok` VARCHAR(255) DEFAULT '',
  `contact_number` VARCHAR(100) DEFAULT '',
  `pin` VARCHAR(100) DEFAULT '',
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `geotagged` TINYINT(1) DEFAULT 0,
  `facebook_link` VARCHAR(255) DEFAULT '',
  `uploaded_files` LONGTEXT NULL,
  `files_count` INT DEFAULT 0,
  `uploaded_by` VARCHAR(255) DEFAULT 'Admin',
  `uploaded_at` VARCHAR(100) DEFAULT '',
  `status` VARCHAR(50) DEFAULT 'FILES',
  `verified_at` VARCHAR(100) NULL,
  `verified_by` VARCHAR(255) NULL,
  `pending_at` VARCHAR(100) NULL,
  `pending_by` VARCHAR(255) NULL,
  `updated_status_at` VARCHAR(100) NULL,
  `updated_status_by` VARCHAR(255) NULL,
  `verified_credit_added` TINYINT(1) DEFAULT 0,
  `pending_credit_added` TINYINT(1) DEFAULT 0,
  `remarks` TEXT NULL,
  `is_submitted` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sea_barangay` (`barangay`),
  INDEX `idx_sea_full_name` (`full_name`),
  INDEX `idx_sea_status` (`status`),
  INDEX `idx_sea_submitter` (`submitter_id`),
  INDEX `idx_sea_uploaded_by` (`uploaded_by`),
  INDEX `idx_sea_is_submitted` (`is_submitted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safely add `submitter_id` to `submitted_exist_acc`
SET @tablename = "submitted_exist_acc";
SET @columnname = "submitter_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `submitted_exist_acc` ADD COLUMN `submitter_id` VARCHAR(100) DEFAULT '' AFTER `exist_account_id`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Safely add `is_submitted` to `submitted_exist_acc`
SET @columnname = "is_submitted";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `submitted_exist_acc` ADD COLUMN `is_submitted` TINYINT(1) DEFAULT 1 AFTER `remarks`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- -----------------------------------------------------------------------------
-- 3. Ensure `existing_accounts` Table Tracks Submitter & Submission State
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `existing_accounts` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) NOT NULL DEFAULT '',
  `purok` VARCHAR(255) DEFAULT '',
  `contact_number` VARCHAR(100) DEFAULT '',
  `pin` VARCHAR(100) DEFAULT '',
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `geotagged` TINYINT(1) DEFAULT 0,
  `facebook_link` VARCHAR(255) DEFAULT '',
  `uploaded_files` LONGTEXT NULL,
  `status` VARCHAR(50) DEFAULT 'ACTIVE',
  `submitted_by` VARCHAR(255) DEFAULT '',
  `submitter_id` VARCHAR(100) DEFAULT '',
  `is_submitted` TINYINT(1) DEFAULT 0,
  `submitted_at` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ext_barangay` (`barangay`),
  INDEX `idx_ext_full_name` (`full_name`),
  INDEX `idx_ext_is_submitted` (`is_submitted`),
  INDEX `idx_ext_submitted_by` (`submitted_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safely add `is_submitted` to `existing_accounts`
SET @tablename = "existing_accounts";
SET @columnname = "is_submitted";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `existing_accounts` ADD COLUMN `is_submitted` TINYINT(1) DEFAULT 0 AFTER `status`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Safely add `submitted_by` to `existing_accounts`
SET @columnname = "submitted_by";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `existing_accounts` ADD COLUMN `submitted_by` VARCHAR(255) DEFAULT '' AFTER `status`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Safely add `submitter_id` to `existing_accounts`
SET @columnname = "submitter_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `existing_accounts` ADD COLUMN `submitter_id` VARCHAR(100) DEFAULT '' AFTER `submitted_by`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Safely add `submitted_at` to `existing_accounts`
SET @columnname = "submitted_at";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `existing_accounts` ADD COLUMN `submitted_at` VARCHAR(100) NULL AFTER `is_submitted`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- -----------------------------------------------------------------------------
-- 4. Audit & History Table (`pcu_history`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pcu_history` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `action` VARCHAR(100) NOT NULL,
  `record_id` VARCHAR(100) DEFAULT '',
  `patient_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) DEFAULT '',
  `submitter` VARCHAR(255) DEFAULT '',
  `performed_by` VARCHAR(255) NOT NULL,
  `previous_status` VARCHAR(100) DEFAULT '',
  `new_status` VARCHAR(100) DEFAULT '',
  `timestamp` VARCHAR(100) NOT NULL,
  `details` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_pcuhist_timestamp` (`timestamp`),
  INDEX `idx_pcuhist_patient` (`patient_name`),
  INDEX `idx_pcuhist_action` (`action`),
  INDEX `idx_pcuhist_submitter` (`submitter`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Verification & Query Optimizations
-- -----------------------------------------------------------------------------
-- Helpful query: Test Today's Barangay Submission Count (Asia/Manila UTC+8)
-- Includes Verified, Pending, Returned, Updated, and Files (all statuses count!)
-- Automatically resets at 12:00 midnight without deleting historical rows:
--
-- SELECT barangay, COUNT(DISTINCT LOWER(TRIM(full_name))) AS today_submissions
-- FROM pcu_submissions
-- WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+08:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '+08:00'))
--    OR (uploaded_at IS NOT NULL AND uploaded_at != '' AND DATE(CONVERT_TZ(uploaded_at, '+00:00', '+08:00')) = DATE(CONVERT_TZ(NOW(), '+00:00', '+08:00')))
-- GROUP BY barangay;
--
-- Helpful query: Test User-Specific Returned Files for a logged-in user:
--
-- SELECT * FROM pcu_submissions
-- WHERE UPPER(status) = 'RETURNED'
--   AND (LOWER(TRIM(submitter_id)) = 'username_here' OR LOWER(TRIM(uploaded_by)) = 'username_here')
-- ORDER BY returned_at DESC, uploaded_at DESC;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- UPDATE COMPLETE: All tables and columns for Returned files, Daily Barangay Counts,
-- and Submitted Existing Accounts have been provisioned successfully!
-- =============================================================================
