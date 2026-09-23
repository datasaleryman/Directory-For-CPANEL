-- =========================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL DATABASE SCHEMA
-- Compatible with cPanel MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Ready for phpMyAdmin / cPanel MySQL Databases Import
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- -------------------------------------------------------------------------
-- 1. Table: contacts (PCU Directory Master Records)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) NOT NULL DEFAULT '',
  `purok` VARCHAR(255) DEFAULT '',
  `contact_number` VARCHAR(100) DEFAULT '',
  `created_at` VARCHAR(100) DEFAULT '',
  `updated_at` VARCHAR(100) DEFAULT '',
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `geotagged` TINYINT(1) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'ACTIVE',
  `is_submitted` TINYINT(1) DEFAULT 0,
  `added_from_print_list` TINYINT(1) DEFAULT 1,
  `photo_url` LONGTEXT,
  `pcu_file_url` LONGTEXT,
  `pcu_uploaded_by` VARCHAR(255) DEFAULT '',
  `pcu_uploaded_at` VARCHAR(100) DEFAULT '',
  `deleted_at` VARCHAR(100) NULL,
  `maintenance` VARCHAR(50) DEFAULT 'None',
  `maintenance_medicine` TEXT NULL,
  INDEX `idx_barangay` (`barangay`),
  INDEX `idx_status` (`status`),
  INDEX `idx_full_name` (`full_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional Upgrade for existing contacts table:
-- ALTER TABLE `contacts` ADD COLUMN `added_from_print_list` TINYINT(1) DEFAULT 1;
-- ALTER TABLE `contacts` ADD COLUMN `maintenance` VARCHAR(50) DEFAULT 'None';
-- ALTER TABLE `contacts` ADD COLUMN `maintenance_medicine` TEXT NULL;

-- -------------------------------------------------------------------------
-- 2. Table: users (Administrators & Staff Accounts)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `username` VARCHAR(100) PRIMARY KEY,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'STAFF',
  `full_name` VARCHAR(255) DEFAULT '',
  `email` VARCHAR(255) DEFAULT '',
  `status` VARCHAR(50) DEFAULT 'Active',
  `barangay` VARCHAR(255) DEFAULT '',
  `created_at` VARCHAR(100) DEFAULT '',
  `avatar_data_url` LONGTEXT,
  `permissions` TEXT,
  `password_plain` VARCHAR(255) DEFAULT '',
  `display_name` VARCHAR(255) DEFAULT '',
  `updated_at` VARCHAR(100) DEFAULT '',
  INDEX `idx_role` (`role`),
  INDEX `idx_email` (`email`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional Upgrade for existing users table:
-- ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password_plain` VARCHAR(255) DEFAULT '';
-- ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `display_name` VARCHAR(255) DEFAULT '';
-- ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `updated_at` VARCHAR(100) DEFAULT '';

-- Default Master Admin (Username: admin, Password: 2026)
INSERT INTO `users` (`username`, `password_hash`, `role`, `full_name`, `email`, `status`, `created_at`)
VALUES ('admin', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', 'MASTER ADMIN', 'Master Administrator', 'admin@clinic.local', 'Active', NOW())
ON DUPLICATE KEY UPDATE `role` = 'MASTER ADMIN';

-- -------------------------------------------------------------------------
-- 3. Table: existing_accounts (External Matching Records)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `existing_accounts` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) DEFAULT '',
  `purok` VARCHAR(255) DEFAULT '',
  `contact_number` VARCHAR(100) DEFAULT '',
  `created_at` VARCHAR(100) DEFAULT '',
  `status` VARCHAR(50) DEFAULT 'PENDING',
  `submitted_by` VARCHAR(255) DEFAULT '',
  `folder` VARCHAR(255) DEFAULT 'GENERAL',
  `remarks` TEXT,
  `deleted_at` VARCHAR(100) NULL,
  INDEX `idx_exist_barangay` (`barangay`),
  INDEX `idx_exist_folder` (`folder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 4. Table: barangays (Barangay Master List)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `barangays` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 5. Table: activities (Audit Log / Security Trail)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activities` (
  `id` VARCHAR(100) PRIMARY KEY,
  `timestamp` VARCHAR(100) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `action` TEXT NOT NULL,
  INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 6. Table: site_settings (Branding, App Name, Custom Labels, Roles)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` LONGTEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 7. Table: inbox_messages (Internal Messaging)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inbox_messages` (
  `id` VARCHAR(100) PRIMARY KEY,
  `sender` VARCHAR(100) NOT NULL,
  `recipient` VARCHAR(100) NOT NULL,
  `subject` VARCHAR(255) DEFAULT '',
  `message` LONGTEXT NOT NULL,
  `created_at` VARCHAR(100) NOT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  INDEX `idx_recipient` (`recipient`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 8. Table: deleted_records (Soft Deletions Trash Bin)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `deleted_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `table_name` VARCHAR(100) NOT NULL,
  `record_id` VARCHAR(100) DEFAULT '',
  `record_data` LONGTEXT NOT NULL,
  `deleted_at` VARCHAR(100) NOT NULL,
  `deleted_by` VARCHAR(100) DEFAULT '',
  INDEX `idx_table_name` (`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 9. Table: pcu_submissions (Submit PCU Page Submissions & Files)
-- -------------------------------------------------------------------------
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

-- -------------------------------------------------------------------------
-- 10. Table: pcu_deletion_audit (Master Admin Permanent Deletion Log)
-- -------------------------------------------------------------------------
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

SET FOREIGN_KEY_CHECKS = 1;
