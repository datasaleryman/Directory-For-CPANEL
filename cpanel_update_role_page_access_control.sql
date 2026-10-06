-- =========================================================================
-- cPanel MySQL Database Update Script
-- Role Page Access Control Permanent Synchronization
-- =========================================================================
-- This script ensures that site_settings table exists and role_permissions
-- are permanently stored with full schema support.
-- Safe, idempotent, non-destructive: will never overwrite existing custom permissions.
-- =========================================================================

-- 1. Ensure site_settings table exists
CREATE TABLE IF NOT EXISTS `site_settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` LONGTEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed default role permissions if not already present
INSERT INTO `site_settings` (`setting_key`, `setting_value`)
VALUES 
  ('role_permissions', '{"MASTER ADMIN":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","accounts","bulk","print","existing-account","admins","settings"],"IT":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","accounts","bulk","print","existing-account","admins","settings"],"ADMIN":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","accounts","bulk","print","existing-account","admins","settings"],"Administrator":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","accounts","bulk","print","existing-account","admins","settings"],"LEADER":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","existing-account","bulk","print"],"CO-LEADER":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","existing-account","bulk","print"],"ENCODER":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","existing-account"],"STAFF":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","existing-account"]}'),
  ('rolePermissions', '{"MASTER ADMIN":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","accounts","bulk","print","existing-account","admins","settings"],"IT":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","accounts","bulk","print","existing-account","admins","settings"],"ADMIN":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","accounts","bulk","print","existing-account","admins","settings"],"Administrator":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","accounts","bulk","print","existing-account","admins","settings"],"LEADER":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","existing-account","bulk","print"],"CO-LEADER":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","existing-account","bulk","print"],"ENCODER":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","existing-account"],"STAFF":["dashboard","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","member-verification","verification-entry","existing-account"]}')
ON DUPLICATE KEY UPDATE 
  `setting_value` = `setting_value`;

SELECT 'cPanel MySQL role page access control synchronized successfully!' AS status;
