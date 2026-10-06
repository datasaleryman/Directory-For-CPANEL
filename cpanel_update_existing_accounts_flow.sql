-- =============================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL DATABASE REPAIR & UPDATE SCRIPT
-- Purpose: Fix Existing Account, Exist. Acc. Files, and Submitted Exist. Acc. Tables
--          - Converts existing_accounts.id from BIGINT/AUTO_INCREMENT to VARCHAR(100)
--          - Adds all required columns (pin, telemetry, files, is_submitted, etc.)
--          - Creates submitted_exist_acc, settlements, and history tables
--          - Prevents data loss when adding 100+ bulk entries
-- Compatible with: cPanel MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Execution: Paste in cPanel > phpMyAdmin > SQL tab and click "Go"
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+08:00"; -- Asia/Manila (UTC+8)

-- -----------------------------------------------------------------------------
-- 1. Ensure Table `existing_accounts` Exists
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `existing_accounts` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) DEFAULT '',
  `purok` VARCHAR(255) DEFAULT '',
  `contact_number` VARCHAR(100) DEFAULT '',
  `pin` VARCHAR(100) DEFAULT '',
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `geotagged` TINYINT(1) DEFAULT 0,
  `facebook_link` TEXT NULL,
  `uploaded_files` LONGTEXT NULL,
  `is_submitted` TINYINT(1) DEFAULT 0,
  `submitted_at` VARCHAR(100) NULL,
  `existing_acc_verified` TINYINT(1) DEFAULT 1,
  `existing_acc_visited` TINYINT(1) DEFAULT 1,
  `created_at` VARCHAR(100) DEFAULT '',
  `status` VARCHAR(50) DEFAULT 'PENDING',
  `submitted_by` VARCHAR(255) DEFAULT '',
  `folder` VARCHAR(255) DEFAULT 'GENERAL',
  `remarks` TEXT,
  `deleted_at` VARCHAR(100) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Safely Modify `id` Column in `existing_accounts` to VARCHAR(100)
-- (Drops AUTO_INCREMENT first to prevent MySQL Error 1063)
-- -----------------------------------------------------------------------------
SET @exist_id_type = (
  SELECT DATA_TYPE 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'existing_accounts' 
    AND COLUMN_NAME = 'id'
  LIMIT 1
);

SET @exist_id_extra = (
  SELECT EXTRA 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'existing_accounts' 
    AND COLUMN_NAME = 'id'
  LIMIT 1
);

-- Step 2a: If AUTO_INCREMENT is active, remove auto_increment
SET @sql_drop_ai = IF(
  @exist_id_extra LIKE '%auto_increment%',
  'ALTER TABLE `existing_accounts` MODIFY COLUMN `id` BIGINT NOT NULL',
  'SELECT 1'
);
PREPARE stmt_drop_ai FROM @sql_drop_ai;
EXECUTE stmt_drop_ai;
DEALLOCATE PREPARE stmt_drop_ai;

-- Step 2b: Modify column to VARCHAR(100)
SET @sql_mod_id = IF(
  @exist_id_type NOT LIKE '%varchar%' AND @exist_id_type NOT LIKE '%char%',
  'ALTER TABLE `existing_accounts` MODIFY COLUMN `id` VARCHAR(100) NOT NULL',
  'SELECT 1'
);
PREPARE stmt_mod_id FROM @sql_mod_id;
EXECUTE stmt_mod_id;
DEALLOCATE PREPARE stmt_mod_id;

-- -----------------------------------------------------------------------------
-- 3. Dynamically Add All Missing Columns to `existing_accounts`
-- -----------------------------------------------------------------------------
-- pin
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'pin') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `pin` VARCHAR(100) DEFAULT \'\'',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- latitude
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'latitude') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `latitude` DECIMAL(10, 7) NULL',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- longitude
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'longitude') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `longitude` DECIMAL(10, 7) NULL',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- geotagged
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'geotagged') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `geotagged` TINYINT(1) DEFAULT 0',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_link
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'facebook_link') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `facebook_link` TEXT NULL',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- uploaded_files
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'uploaded_files') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `uploaded_files` LONGTEXT NULL',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- is_submitted
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'is_submitted') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `is_submitted` TINYINT(1) DEFAULT 0',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- submitted_at
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'submitted_at') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `submitted_at` VARCHAR(100) NULL',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- existing_acc_verified
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'existing_acc_verified') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `existing_acc_verified` TINYINT(1) DEFAULT 1',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- existing_acc_visited
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'existing_acc_visited') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `existing_acc_visited` TINYINT(1) DEFAULT 1',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- folder
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'folder') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `folder` VARCHAR(255) DEFAULT \'GENERAL\'',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- remarks
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'remarks') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `remarks` TEXT NULL',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- deleted_at
SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'existing_accounts' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE `existing_accounts` ADD COLUMN `deleted_at` VARCHAR(100) NULL',
  'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 4. Create / Verify `submitted_exist_acc` Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `submitted_exist_acc` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `exist_account_id` VARCHAR(100) NOT NULL,
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
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sea_barangay` (`barangay`),
  INDEX `idx_sea_full_name` (`full_name`),
  INDEX `idx_sea_status` (`status`),
  INDEX `idx_sea_uploaded_by` (`uploaded_by`),
  INDEX `idx_sea_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Create / Verify `submitted_exist_acc_settlements` Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `submitted_exist_acc_settlements` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `submitter` VARCHAR(255) NOT NULL,
  `total_submissions` INT DEFAULT 0,
  `base_rate` DECIMAL(10,2) DEFAULT 0.00,
  `total_salary` DECIMAL(12,2) DEFAULT 0.00,
  `amount_paid` DECIMAL(12,2) DEFAULT 0.00,
  `payment_status` VARCHAR(50) DEFAULT 'SETTLED',
  `payment_method` VARCHAR(100) DEFAULT 'CASH',
  `reference_notes` TEXT,
  `settled_by` VARCHAR(100) DEFAULT 'Master Admin',
  `settled_at` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sea_settle_submitter` (`submitter`),
  INDEX `idx_sea_settle_status` (`payment_status`),
  INDEX `idx_sea_settle_at` (`settled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Create / Verify `submitted_exist_acc_history` Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `submitted_exist_acc_history` (
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
  INDEX `idx_sea_hist_time` (`timestamp`),
  INDEX `idx_sea_hist_patient` (`patient_name`),
  INDEX `idx_sea_hist_action` (`action`),
  INDEX `idx_sea_hist_submitter` (`submitter`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 7. Verification Results
-- -----------------------------------------------------------------------------
SELECT 'cPanel MySQL Database updated successfully for Existing Accounts flow!' AS `status_message`;
DESCRIBE `existing_accounts`;
DESCRIBE `submitted_exist_acc`;
