import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

export interface CPanelDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
  enabled?: boolean;
}

export interface CPanelDbStatus {
  connected: boolean;
  isMainDatabase: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  tableCount: number;
  lastConnected: string | null;
  lastError: string | null;
  tables: Array<{ name: string; rowCount: number }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CPANEL_CONFIG_FILE = path.join(DATA_DIR, 'cpanel_db_config.json');

// Default configuration with environment variables priority
export function loadCPanelDbConfig(): CPanelDbConfig {
  let fileConfig: Partial<CPanelDbConfig> = {};
  try {
    if (fs.existsSync(CPANEL_CONFIG_FILE)) {
      const content = fs.readFileSync(CPANEL_CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(content);
    }
  } catch (err) {
    console.log('[cPanel DB] Could not read config file, using env/defaults:', err);
  }

  const envHost = process.env.DB_HOST || process.env.MYSQL_HOST;
  const envPort = process.env.DB_PORT || process.env.MYSQL_PORT;
  const envUser = process.env.DB_USER || process.env.MYSQL_USER;
  const envPass = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
  const envName = process.env.DB_NAME || process.env.MYSQL_DATABASE;
  const envSsl = process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true';

  return {
    host: fileConfig.host || envHost || 'localhost',
    port: fileConfig.port ? fileConfig.port : (envPort ? parseInt(envPort, 10) : 3306),
    user: fileConfig.user !== undefined ? fileConfig.user : (envUser || ''),
    password: fileConfig.password !== undefined ? fileConfig.password : (envPass !== undefined ? envPass : ''),
    database: fileConfig.database !== undefined ? fileConfig.database : (envName || ''),
    ssl: fileConfig.ssl !== undefined ? fileConfig.ssl : envSsl,
    enabled: fileConfig.enabled !== undefined ? fileConfig.enabled : Boolean(envName && envUser)
  };
}

export async function saveCPanelDbConfig(config: CPanelDbConfig): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  await fs.promises.writeFile(CPANEL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  // Reinitialize connection pool with new config
  await reinitializePool(config);
}

let pool: mysql.Pool | null = null;
let currentStatus: CPanelDbStatus = {
  connected: false,
  isMainDatabase: false,
  host: 'localhost',
  port: 3306,
  database: '',
  user: '',
  tableCount: 0,
  lastConnected: null,
  lastError: null,
  tables: []
};

export function getCPanelDbStatus(): CPanelDbStatus {
  return currentStatus;
}

export function isCPanelDbConnected(): boolean {
  return Boolean(pool && currentStatus.connected);
}

export function getPool(): mysql.Pool | null {
  return pool;
}

/**
 * Initializes tables in MySQL if they do not exist yet.
 */
export async function initCPanelTables(connectionPool: mysql.Pool): Promise<void> {
  const tableDefinitions = [
    // 1. Contacts Table
    `CREATE TABLE IF NOT EXISTS contacts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      barangay VARCHAR(255) NOT NULL DEFAULT '',
      purok VARCHAR(255) DEFAULT '',
      contact_number VARCHAR(100) DEFAULT '',
      created_at VARCHAR(100) DEFAULT '',
      updated_at VARCHAR(100) DEFAULT '',
      latitude DECIMAL(10, 7) NULL,
      longitude DECIMAL(10, 7) NULL,
      geotagged TINYINT(1) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      is_submitted TINYINT(1) DEFAULT 0,
      photo_url LONGTEXT,
      pcu_file_url LONGTEXT,
      pcu_uploaded_by VARCHAR(255) DEFAULT '',
      pcu_uploaded_at VARCHAR(100) DEFAULT '',
      deleted_at VARCHAR(100) NULL,
      INDEX idx_barangay (barangay),
      INDEX idx_status (status),
      INDEX idx_full_name (full_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 2. Administrators / Staff Users Table
    `CREATE TABLE IF NOT EXISTS users (
      username VARCHAR(100) PRIMARY KEY,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'STAFF',
      full_name VARCHAR(255) DEFAULT '',
      email VARCHAR(255) DEFAULT '',
      status VARCHAR(50) DEFAULT 'Active',
      barangay VARCHAR(255) DEFAULT '',
      created_at VARCHAR(100) DEFAULT '',
      avatar_data_url LONGTEXT,
      permissions TEXT,
      INDEX idx_role (role),
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 3. Existing Accounts Table
    `CREATE TABLE IF NOT EXISTS existing_accounts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      barangay VARCHAR(255) DEFAULT '',
      purok VARCHAR(255) DEFAULT '',
      contact_number VARCHAR(100) DEFAULT '',
      created_at VARCHAR(100) DEFAULT '',
      status VARCHAR(50) DEFAULT 'PENDING',
      submitted_by VARCHAR(255) DEFAULT '',
      folder VARCHAR(255) DEFAULT 'GENERAL',
      remarks TEXT,
      deleted_at VARCHAR(100) NULL,
      INDEX idx_exist_barangay (barangay),
      INDEX idx_exist_folder (folder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 4. Barangays Table
    `CREATE TABLE IF NOT EXISTS barangays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 5. System Audit / Activity Log Table
    `CREATE TABLE IF NOT EXISTS activities (
      id VARCHAR(100) PRIMARY KEY,
      timestamp VARCHAR(100) NOT NULL,
      username VARCHAR(100) NOT NULL,
      action TEXT NOT NULL,
      INDEX idx_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 6. Website / Site Settings Table
    `CREATE TABLE IF NOT EXISTS site_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value LONGTEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 7. Inbox / Messages Table
    `CREATE TABLE IF NOT EXISTS inbox_messages (
      id VARCHAR(100) PRIMARY KEY,
      sender VARCHAR(100) NOT NULL,
      recipient VARCHAR(100) NOT NULL,
      subject VARCHAR(255) DEFAULT '',
      message LONGTEXT NOT NULL,
      created_at VARCHAR(100) NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      INDEX idx_recipient (recipient)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 8. Soft-deleted Records Archive Table
    `CREATE TABLE IF NOT EXISTS deleted_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_name VARCHAR(100) NOT NULL,
      record_id VARCHAR(100) DEFAULT '',
      record_data LONGTEXT NOT NULL,
      deleted_at VARCHAR(100) NOT NULL,
      deleted_by VARCHAR(100) DEFAULT '',
      INDEX idx_table_name (table_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const sql of tableDefinitions) {
    try {
      await connectionPool.query(sql);
    } catch (err: any) {
      console.error('[cPanel DB] Error executing table init:', err.message);
    }
  }

  // Ensure default Master Admin exists in MySQL
  try {
    const [rows]: any = await connectionPool.query('SELECT username FROM users WHERE username = ?', ['admin']);
    if (!rows || rows.length === 0) {
      // crypto sha256 of '2026'
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update('2026').digest('hex');
      const now = new Date().toISOString();
      await connectionPool.query(
        `INSERT INTO users (username, password_hash, role, full_name, email, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['admin', hash, 'MASTER ADMIN', 'Master Administrator', 'admin@clinic.local', 'Active', now]
      );
      console.log('[cPanel DB] Master Administrator account seeded into MySQL users table.');
    }
  } catch (err: any) {
    console.warn('[cPanel DB] Notice checking default admin:', err.message);
  }
}

/**
 * Re-creates the connection pool with given or loaded config
 */
export async function reinitializePool(customConfig?: CPanelDbConfig): Promise<boolean> {
  const config = customConfig || loadCPanelDbConfig();

  if (pool) {
    try {
      await pool.end();
    } catch {}
    pool = null;
  }

  currentStatus = {
    connected: false,
    isMainDatabase: false,
    host: config.host || 'localhost',
    port: config.port || 3306,
    database: config.database || '',
    user: config.user || '',
    tableCount: 0,
    lastConnected: null,
    lastError: null,
    tables: []
  };

  if (!config.enabled || !config.database) {
    currentStatus.lastError = 'cPanel MySQL Database disabled or not configured. Running in Local Storage mode.';
    return false;
  }

  const isContainerEnv = Boolean(
    process.env.K_SERVICE || 
    process.env.APPLET_ID || 
    process.env.LAMBDA_TASK_ROOT || 
    process.env.NETLIFY
  );
  const isLocalhost = 
    config.host === 'localhost' || 
    config.host === '127.0.0.1' || 
    config.host === '::1';

  // In cloud preview / container environments, localhost MySQL is not hosted inside the container.
  // We avoid attempting an unfulfillable network connection that triggers ECONNREFUSED alarms.
  if (isContainerEnv && isLocalhost) {
    currentStatus.connected = false;
    currentStatus.isMainDatabase = false;
    currentStatus.lastError = 'Local MySQL is not running inside this Cloud Run preview container. Operating safely in Local Storage mode (data/*.json). For cPanel deployment, deploy to your cPanel hosting where localhost MySQL is available, or specify your remote cPanel server hostname/IP in Settings.';
    console.log('[cPanel DB] Notice: Local MySQL is not present in cloud preview container. Running in Local Storage mode.');
    return false;
  }

  let newPool: mysql.Pool | null = null;
  try {
    newPool = mysql.createPool({
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 8000
    });

    // Test ping
    const connection = await newPool.getConnection();
    await connection.ping();
    connection.release();

    pool = newPool;

    // Initialize tables
    await initCPanelTables(pool);

    // Read table statistics
    const [tableRows]: any = await pool.query(
      `SELECT table_name AS tableName, table_rows AS rowCount 
       FROM information_schema.tables 
       WHERE table_schema = ?`,
      [config.database]
    );

    const tables = (tableRows || []).map((t: any) => ({
      name: t.tableName,
      rowCount: Number(t.rowCount) || 0
    }));

    currentStatus = {
      connected: true,
      isMainDatabase: true,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      tableCount: tables.length,
      lastConnected: new Date().toISOString(),
      lastError: null,
      tables
    };

    console.log(`[cPanel DB] Successfully connected to MySQL database "${config.database}" on ${config.host}:${config.port}`);
    return true;
  } catch (err: any) {
    const errMsg = err.message || String(err);
    currentStatus.connected = false;
    currentStatus.isMainDatabase = false;
    currentStatus.lastError = errMsg;
    console.log(`[cPanel DB] Notice: Connection to MySQL (${config.host}:${config.port}/${config.database}) not established (${errMsg}). Running in Local Storage mode.`);
    if (newPool) {
      try {
        await newPool.end();
      } catch {}
    }
    return false;
  }
}

/**
 * Tests MySQL connection with arbitrary config parameters without saving
 */
export async function testCPanelDbConnection(config: CPanelDbConfig): Promise<{ success: boolean; message: string; tableCount?: number }> {
  const isContainerEnv = Boolean(
    process.env.K_SERVICE || 
    process.env.APPLET_ID || 
    process.env.LAMBDA_TASK_ROOT || 
    process.env.NETLIFY
  );
  const isLocalhost = 
    config.host === 'localhost' || 
    config.host === '127.0.0.1' || 
    config.host === '::1';

  if (isContainerEnv && isLocalhost) {
    return {
      success: false,
      message: 'Cannot connect to "localhost" MySQL inside this cloud preview environment. To test connection to your cPanel database from here, enter your remote cPanel server hostname or IP (and ensure Remote MySQL access is allowed in your cPanel dashboard).'
    };
  }

  let testPool: mysql.Pool | null = null;
  try {
    testPool = mysql.createPool({
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 1,
      connectTimeout: 6000
    });

    const conn = await testPool.getConnection();
    await conn.ping();
    
    // Check tables in target database
    const [rows]: any = await conn.query(
      `SELECT count(*) as count FROM information_schema.tables WHERE table_schema = ?`,
      [config.database]
    );
    conn.release();

    const count = rows?.[0]?.count || 0;
    return {
      success: true,
      message: `Successfully connected to MySQL database "${config.database}" on ${config.host}:${config.port}! Found ${count} existing tables.`,
      tableCount: Number(count)
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err.message || String(err)}`
    };
  } finally {
    if (testPool) {
      try {
        await testPool.end();
      } catch {}
    }
  }
}

/**
 * Generates the clean MySQL Schema DDL file content for direct phpMyAdmin import
 */
export function generateCPanelSchemaSql(): string {
  return `-- =========================================================================
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
CREATE TABLE IF NOT EXISTS \`contacts\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`full_name\` VARCHAR(255) NOT NULL,
  \`barangay\` VARCHAR(255) NOT NULL DEFAULT '',
  \`purok\` VARCHAR(255) DEFAULT '',
  \`contact_number\` VARCHAR(100) DEFAULT '',
  \`created_at\` VARCHAR(100) DEFAULT '',
  \`updated_at\` VARCHAR(100) DEFAULT '',
  \`latitude\` DECIMAL(10, 7) NULL,
  \`longitude\` DECIMAL(10, 7) NULL,
  \`geotagged\` TINYINT(1) DEFAULT 0,
  \`status\` VARCHAR(50) DEFAULT 'ACTIVE',
  \`is_submitted\` TINYINT(1) DEFAULT 0,
  \`photo_url\` LONGTEXT,
  \`pcu_file_url\` LONGTEXT,
  \`pcu_uploaded_by\` VARCHAR(255) DEFAULT '',
  \`pcu_uploaded_at\` VARCHAR(100) DEFAULT '',
  \`deleted_at\` VARCHAR(100) NULL,
  INDEX \`idx_barangay\` (\`barangay\`),
  INDEX \`idx_status\` (\`status\`),
  INDEX \`idx_full_name\` (\`full_name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 2. Table: users (Administrators & Staff Accounts)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`users\` (
  \`username\` VARCHAR(100) PRIMARY KEY,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`role\` VARCHAR(50) NOT NULL DEFAULT 'STAFF',
  \`full_name\` VARCHAR(255) DEFAULT '',
  \`email\` VARCHAR(255) DEFAULT '',
  \`status\` VARCHAR(50) DEFAULT 'Active',
  \`barangay\` VARCHAR(255) DEFAULT '',
  \`created_at\` VARCHAR(100) DEFAULT '',
  \`avatar_data_url\` LONGTEXT,
  \`permissions\` TEXT,
  INDEX \`idx_role\` (\`role\`),
  INDEX \`idx_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Master Admin (Username: admin, Password: 2026)
INSERT INTO \`users\` (\`username\`, \`password_hash\`, \`role\`, \`full_name\`, \`email\`, \`status\`, \`created_at\`)
VALUES ('admin', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', 'MASTER ADMIN', 'Master Administrator', 'admin@clinic.local', 'Active', NOW())
ON DUPLICATE KEY UPDATE \`role\` = 'MASTER ADMIN';

-- -------------------------------------------------------------------------
-- 3. Table: existing_accounts (External Matching Records)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`existing_accounts\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`full_name\` VARCHAR(255) NOT NULL,
  \`barangay\` VARCHAR(255) DEFAULT '',
  \`purok\` VARCHAR(255) DEFAULT '',
  \`contact_number\` VARCHAR(100) DEFAULT '',
  \`created_at\` VARCHAR(100) DEFAULT '',
  \`status\` VARCHAR(50) DEFAULT 'PENDING',
  \`submitted_by\` VARCHAR(255) DEFAULT '',
  \`folder\` VARCHAR(255) DEFAULT 'GENERAL',
  \`remarks\` TEXT,
  \`deleted_at\` VARCHAR(100) NULL,
  INDEX \`idx_exist_barangay\` (\`barangay\`),
  INDEX \`idx_exist_folder\` (\`folder\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 4. Table: barangays (Barangay Master List)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`barangays\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`name\` VARCHAR(255) UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 5. Table: activities (Audit Log / Security Trail)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`activities\` (
  \`id\` VARCHAR(100) PRIMARY KEY,
  \`timestamp\` VARCHAR(100) NOT NULL,
  \`username\` VARCHAR(100) NOT NULL,
  \`action\` TEXT NOT NULL,
  INDEX \`idx_timestamp\` (\`timestamp\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 6. Table: site_settings (Branding, App Name, Custom Labels, Roles)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`site_settings\` (
  \`setting_key\` VARCHAR(100) PRIMARY KEY,
  \`setting_value\` LONGTEXT,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 7. Table: inbox_messages (Internal Messaging)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`inbox_messages\` (
  \`id\` VARCHAR(100) PRIMARY KEY,
  \`sender\` VARCHAR(100) NOT NULL,
  \`recipient\` VARCHAR(100) NOT NULL,
  \`subject\` VARCHAR(255) DEFAULT '',
  \`message\` LONGTEXT NOT NULL,
  \`created_at\` VARCHAR(100) NOT NULL,
  \`is_read\` TINYINT(1) DEFAULT 0,
  INDEX \`idx_recipient\` (\`recipient\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 8. Table: deleted_records (Soft Deletions Trash Bin)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`deleted_records\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`table_name\` VARCHAR(100) NOT NULL,
  \`record_id\` VARCHAR(100) DEFAULT '',
  \`record_data\` LONGTEXT NOT NULL,
  \`deleted_at\` VARCHAR(100) NOT NULL,
  \`deleted_by\` VARCHAR(100) DEFAULT '',
  INDEX \`idx_table_name\` (\`table_name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================================
-- End of Schema Definition
-- =========================================================================
`;
}

/**
 * Migrates all local data into cPanel MySQL tables
 */
export async function migrateAllDataToCPanelDb(data: {
  contacts: any[];
  users: any[];
  existingAccounts: any[];
  barangays: string[];
  activities: any[];
  settings: Record<string, any>;
  inboxMessages?: any[];
}): Promise<{ success: boolean; counts: Record<string, number>; message: string }> {
  if (!pool || !currentStatus.connected) {
    throw new Error('Cannot migrate: cPanel MySQL Database is not connected.');
  }

  const counts: Record<string, number> = {
    contacts: 0,
    users: 0,
    existingAccounts: 0,
    barangays: 0,
    activities: 0,
    settings: 0,
    inboxMessages: 0
  };

  // 1. Migrate Contacts
  for (const c of data.contacts || []) {
    try {
      await pool.query(
        `INSERT INTO contacts (id, full_name, barangay, purok, contact_number, created_at, updated_at, latitude, longitude, geotagged, status, is_submitted, photo_url, pcu_file_url, pcu_uploaded_by, pcu_uploaded_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           barangay = VALUES(barangay),
           purok = VALUES(purok),
           contact_number = VALUES(contact_number),
           updated_at = VALUES(updated_at),
           latitude = VALUES(latitude),
           longitude = VALUES(longitude),
           geotagged = VALUES(geotagged),
           status = VALUES(status),
           is_submitted = VALUES(is_submitted),
           photo_url = VALUES(photo_url),
           pcu_file_url = VALUES(pcu_file_url),
           pcu_uploaded_by = VALUES(pcu_uploaded_by),
           pcu_uploaded_at = VALUES(pcu_uploaded_at),
           deleted_at = VALUES(deleted_at)`,
        [
          c.id,
          c.full_name || '',
          c.barangay || '',
          c.purok || '',
          c.contact_number || '',
          c.created_at || '',
          c.updated_at || '',
          c.latitude ?? null,
          c.longitude ?? null,
          c.geotagged ? 1 : 0,
          c.status || 'ACTIVE',
          c.isSubmitted ? 1 : 0,
          c.photo_url || null,
          c.pcu_file_url || null,
          c.pcu_uploaded_by || '',
          c.pcu_uploaded_at || '',
          c.deleted_at || null
        ]
      );
      counts.contacts++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Contact ${c.id} insert error:`, err.message);
    }
  }

  // 2. Migrate Users
  for (const u of data.users || []) {
    try {
      await pool.query(
        `INSERT INTO users (username, password_hash, role, full_name, email, status, barangay, created_at, avatar_data_url, permissions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           full_name = VALUES(full_name),
           email = VALUES(email),
           status = VALUES(status),
           barangay = VALUES(barangay),
           avatar_data_url = VALUES(avatar_data_url),
           permissions = VALUES(permissions)`,
        [
          u.username,
          u.passwordHash || '',
          u.role || 'STAFF',
          u.fullName || u.displayName || '',
          u.email || '',
          u.status || 'Active',
          u.barangay || '',
          u.createdAt || '',
          u.avatarDataUrl || null,
          u.permissions ? JSON.stringify(u.permissions) : null
        ]
      );
      counts.users++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] User ${u.username} insert error:`, err.message);
    }
  }

  // 3. Migrate Existing Accounts
  for (const e of data.existingAccounts || []) {
    try {
      await pool.query(
        `INSERT INTO existing_accounts (id, full_name, barangay, purok, contact_number, created_at, status, submitted_by, folder, remarks, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           barangay = VALUES(barangay),
           purok = VALUES(purok),
           contact_number = VALUES(contact_number),
           status = VALUES(status),
           submitted_by = VALUES(submitted_by),
           folder = VALUES(folder),
           remarks = VALUES(remarks),
           deleted_at = VALUES(deleted_at)`,
        [
          e.id,
          e.full_name || '',
          e.barangay || '',
          e.purok || '',
          e.contact_number || '',
          e.created_at || '',
          e.status || 'PENDING',
          e.submittedBy || '',
          e.folder || 'GENERAL',
          e.remarks || '',
          e.deleted_at || null
        ]
      );
      counts.existingAccounts++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Existing account ${e.id} insert error:`, err.message);
    }
  }

  // 4. Migrate Barangays
  for (const b of data.barangays || []) {
    try {
      await pool.query(
        `INSERT IGNORE INTO barangays (name) VALUES (?)`,
        [b]
      );
      counts.barangays++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Barangay ${b} insert error:`, err.message);
    }
  }

  // 5. Migrate Activities
  for (const a of data.activities || []) {
    try {
      await pool.query(
        `INSERT INTO activities (id, timestamp, username, action)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE action = VALUES(action)`,
        [a.id || String(Date.now()), a.timestamp || '', a.username || 'system', a.action || '']
      );
      counts.activities++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Activity ${a.id} insert error:`, err.message);
    }
  }

  // 6. Migrate Site Settings
  for (const [key, value] of Object.entries(data.settings || {})) {
    try {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      await pool.query(
        `INSERT INTO site_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, valStr]
      );
      counts.settings++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Setting ${key} insert error:`, err.message);
    }
  }

  // 7. Migrate Inbox Messages if present
  for (const m of data.inboxMessages || []) {
    try {
      await pool.query(
        `INSERT INTO inbox_messages (id, sender, recipient, subject, message, created_at, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE is_read = VALUES(is_read)`,
        [m.id || String(Date.now()), m.sender || '', m.recipient || '', m.subject || '', m.message || '', m.created_at || '', m.is_read ? 1 : 0]
      );
      counts.inboxMessages++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Inbox msg ${m.id} insert error:`, err.message);
    }
  }

  // Refresh status
  await reinitializePool();

  return {
    success: true,
    counts,
    message: `Migration completed: ${counts.contacts} contacts, ${counts.users} users, ${counts.existingAccounts} existing accounts, ${counts.barangays} barangays, ${counts.activities} logs, and ${counts.settings} settings saved to cPanel MySQL database.`
  };
}

/**
 * Fetch all records from cPanel MySQL database
 */
export async function fetchAllFromCPanelDb(): Promise<{
  contacts: any[];
  users: any[];
  existingAccounts: any[];
  barangays: string[];
  activities: any[];
  settings: Record<string, any>;
} | null> {
  if (!pool || !currentStatus.connected) return null;

  try {
    const [cRows]: any = await pool.query('SELECT * FROM contacts ORDER BY id ASC');
    const [uRows]: any = await pool.query('SELECT * FROM users ORDER BY username ASC');
    const [eRows]: any = await pool.query('SELECT * FROM existing_accounts ORDER BY id ASC');
    const [bRows]: any = await pool.query('SELECT name FROM barangays ORDER BY name ASC');
    const [aRows]: any = await pool.query('SELECT * FROM activities ORDER BY timestamp DESC LIMIT 200');
    const [sRows]: any = await pool.query('SELECT setting_key, setting_value FROM site_settings');

    const contacts = (cRows || []).map((r: any) => ({
      id: Number(r.id),
      full_name: r.full_name,
      barangay: r.barangay,
      purok: r.purok,
      contact_number: r.contact_number,
      created_at: r.created_at,
      updated_at: r.updated_at,
      latitude: r.latitude ? Number(r.latitude) : undefined,
      longitude: r.longitude ? Number(r.longitude) : undefined,
      geotagged: Boolean(r.geotagged),
      status: r.status,
      isSubmitted: Boolean(r.is_submitted),
      photo_url: r.photo_url || undefined,
      pcu_file_url: r.pcu_file_url || undefined,
      pcu_uploaded_by: r.pcu_uploaded_by || undefined,
      pcu_uploaded_at: r.pcu_uploaded_at || undefined,
      deleted_at: r.deleted_at || null
    }));

    const users = (uRows || []).map((r: any) => {
      let permissions = undefined;
      try {
        if (r.permissions) permissions = JSON.parse(r.permissions);
      } catch {}
      return {
        username: r.username,
        passwordHash: r.password_hash,
        role: r.role,
        fullName: r.full_name,
        displayName: r.full_name,
        email: r.email,
        status: r.status,
        barangay: r.barangay,
        createdAt: r.created_at,
        avatarDataUrl: r.avatar_data_url || undefined,
        permissions
      };
    });

    const existingAccounts = (eRows || []).map((r: any) => ({
      id: String(r.id),
      full_name: r.full_name,
      barangay: r.barangay,
      purok: r.purok,
      contact_number: r.contact_number,
      created_at: r.created_at,
      status: r.status,
      submittedBy: r.submitted_by,
      folder: r.folder,
      remarks: r.remarks,
      deleted_at: r.deleted_at || null
    }));

    const barangays = (bRows || []).map((r: any) => r.name);

    const activities = (aRows || []).map((r: any) => ({
      id: String(r.id),
      timestamp: r.timestamp,
      username: r.username,
      action: r.action
    }));

    const settings: Record<string, any> = {};
    (sRows || []).forEach((r: any) => {
      try {
        settings[r.setting_key] = JSON.parse(r.setting_value);
      } catch {
        settings[r.setting_key] = r.setting_value;
      }
    });

    return {
      contacts,
      users,
      existingAccounts,
      barangays,
      activities,
      settings
    };
  } catch (err: any) {
    console.error('[cPanel DB] Error fetching records from MySQL:', err.message);
    return null;
  }
}

export async function saveContactToCPanel(c: any): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query(
      `INSERT INTO contacts (id, full_name, barangay, purok, contact_number, created_at, updated_at, latitude, longitude, geotagged, status, is_submitted, photo_url, pcu_file_url, pcu_uploaded_by, pcu_uploaded_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         barangay = VALUES(barangay),
         purok = VALUES(purok),
         contact_number = VALUES(contact_number),
         updated_at = VALUES(updated_at),
         latitude = VALUES(latitude),
         longitude = VALUES(longitude),
         geotagged = VALUES(geotagged),
         status = VALUES(status),
         is_submitted = VALUES(is_submitted),
         photo_url = VALUES(photo_url),
         pcu_file_url = VALUES(pcu_file_url),
         pcu_uploaded_by = VALUES(pcu_uploaded_by),
         pcu_uploaded_at = VALUES(pcu_uploaded_at),
         deleted_at = VALUES(deleted_at)`,
      [
        c.id,
        c.full_name || '',
        c.barangay || '',
        c.purok || '',
        c.contact_number || '',
        c.created_at || '',
        c.updated_at || '',
        c.latitude ?? null,
        c.longitude ?? null,
        c.geotagged ? 1 : 0,
        c.status || 'ACTIVE',
        c.isSubmitted ? 1 : 0,
        c.photo_url || null,
        c.pcu_file_url || null,
        c.pcu_uploaded_by || '',
        c.pcu_uploaded_at || '',
        c.deleted_at || null
      ]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error saving contact to MySQL:', err.message);
  }
}

export async function deleteContactFromCPanel(id: number, deletedAt: string): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query('UPDATE contacts SET deleted_at = ?, status = "DELETED" WHERE id = ?', [deletedAt, id]);
  } catch (err: any) {
    console.warn('[cPanel DB] Error marking contact deleted in MySQL:', err.message);
  }
}

export async function saveUserToCPanel(u: any): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query(
      `INSERT INTO users (username, password_hash, role, full_name, email, status, barangay, created_at, avatar_data_url, permissions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         password_hash = VALUES(password_hash),
         role = VALUES(role),
         full_name = VALUES(full_name),
         email = VALUES(email),
         status = VALUES(status),
         barangay = VALUES(barangay),
         avatar_data_url = VALUES(avatar_data_url),
         permissions = VALUES(permissions)`,
      [
        u.username,
        u.passwordHash || '',
        u.role || 'STAFF',
        u.fullName || u.displayName || '',
        u.email || '',
        u.status || 'Active',
        u.barangay || '',
        u.createdAt || '',
        u.avatarDataUrl || null,
        u.permissions ? JSON.stringify(u.permissions) : null
      ]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error saving user to MySQL:', err.message);
  }
}

export async function deleteUserFromCPanel(username: string): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query('DELETE FROM users WHERE username = ?', [username]);
  } catch (err: any) {
    console.warn('[cPanel DB] Error deleting user from MySQL:', err.message);
  }
}

export async function saveActivityToCPanel(a: any): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query(
      `INSERT INTO activities (id, timestamp, username, action) VALUES (?, ?, ?, ?)`,
      [a.id || String(Date.now()), a.timestamp, a.username, a.action]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error logging activity to MySQL:', err.message);
  }
}

export async function saveSettingToCPanel(key: string, val: any): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, valStr]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error saving setting to MySQL:', err.message);
  }
}

export async function saveExistingAccountToCPanel(account: any): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query(
      `INSERT INTO existing_accounts (id, full_name, barangay, purok, contact_number, created_at, status, submitted_by, folder, remarks, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         full_name = VALUES(full_name),
         barangay = VALUES(barangay),
         purok = VALUES(purok),
         contact_number = VALUES(contact_number),
         status = VALUES(status),
         submitted_by = VALUES(submitted_by),
         folder = VALUES(folder),
         remarks = VALUES(remarks),
         deleted_at = VALUES(deleted_at)`,
      [
        account.id,
        account.full_name || account.fullName || '',
        account.barangay || '',
        account.purok || '',
        account.contact_number || account.contact || '',
        account.created_at || account.createdAt || new Date().toISOString(),
        account.status || 'PENDING',
        account.submittedBy || account.submitted_by || '',
        account.folder || 'GENERAL',
        account.remarks || '',
        account.deleted_at || null
      ]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error saving existing account to MySQL:', err.message);
  }
}

export async function deleteExistingAccountFromCPanel(id: string | number, deletedAt: string): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query('UPDATE existing_accounts SET deleted_at = ?, status = "DELETED" WHERE id = ?', [deletedAt, id]);
  } catch (err: any) {
    console.warn('[cPanel DB] Error marking existing account deleted in MySQL:', err.message);
  }
}

export async function saveBarangayToCPanel(name: string): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    const cleanName = (name || '').trim();
    if (!cleanName) return;
    await pool.query(
      `INSERT INTO barangays (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [cleanName]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error saving barangay to MySQL:', err.message);
  }
}

export async function deleteBarangayFromCPanel(name: string): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query('DELETE FROM barangays WHERE name = ?', [name]);
  } catch (err: any) {
    console.warn('[cPanel DB] Error deleting barangay from MySQL:', err.message);
  }
}

