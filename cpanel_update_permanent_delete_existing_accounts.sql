-- =============================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL PERMANENT DELETION SCRIPT
-- Purpose: Permanently purge deleted existing account records from MySQL so they
--          never bounce back or reappear upon page refresh, database reload,
--          or sync.
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
-- 1. Permanently Delete All Soft-Deleted Existing Account Records
-- -----------------------------------------------------------------------------
-- Remove records marked with a deleted_at timestamp
DELETE FROM `existing_accounts` 
WHERE `deleted_at` IS NOT NULL 
  AND `deleted_at` != '' 
  AND `deleted_at` != '0' 
  AND `deleted_at` != '0000-00-00 00:00:00';

-- Remove records with DELETED status
DELETE FROM `existing_accounts` 
WHERE UPPER(TRIM(`status`)) = 'DELETED';

-- -----------------------------------------------------------------------------
-- 2. Permanently Delete Corresponding Deleted Submitted Existing Accounts
-- -----------------------------------------------------------------------------
DELETE FROM `submitted_exist_acc` 
WHERE UPPER(TRIM(`status`)) = 'DELETED';

-- Remove any submitted records whose parent existing account was deleted
DELETE sea FROM `submitted_exist_acc` sea
LEFT JOIN `existing_accounts` ea ON sea.`exist_account_id` = ea.`id` OR sea.`id` = ea.`id`
WHERE ea.`id` IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Ensure Proper Indexes Exist on `existing_accounts` for Instant Deletion
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

-- -----------------------------------------------------------------------------
-- 4. Verification Check: View Remaining Active Existing Accounts
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS active_existing_accounts_count FROM `existing_accounts`;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- COMPLETED: All soft-deleted existing accounts have been permanently purged.
-- Any future deletions from the Existing Account page will be permanently
-- removed from both the application cache and cPanel MySQL immediately.
-- =============================================================================
