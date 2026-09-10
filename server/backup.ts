import fs from 'fs';
import path from 'path';
import {
  getAllContactsRaw,
  getAllExistingAccountsRaw,
  getUsers,
  getAllBarangaysRaw,
  getSiteSettings,
  getAllActivitiesRaw,
  deletedContactsCache,
  deletedBarangaysCache,
  deletedExistingAccountsCache,
  deletedUsersCache,
  addActivity,
  applyRestoredData
} from './db.js';
import { getCPanelDbStatus } from './cpanel_db.js';

export interface TableBackupEntry {
  tableName: string;
  displayName: string;
  headers: string[];
  rowCount: number;
  rows: any[][];
  records: Record<string, any>[];
}

export interface BackupMetadata {
  title: string;
  timestamp: string;
  source: string;
  databaseName: string;
  exportedBy: string;
  totalTables: number;
  totalRecords: number;
  isLiveCPanelDb: boolean;
  tableSummaries: Array<{
    tableName: string;
    displayName: string;
    rowCount: number;
    columnCount: number;
  }>;
}

export interface BackupResult {
  metadata: BackupMetadata;
  tables: TableBackupEntry[];
  rawTables: Record<string, any[]>;
}

function escapeSqlValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val);
    return `'${jsonStr.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
  }
  const str = String(val);
  return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

function toSqlIdentifier(str: string): string {
  if (!str) return 'column_name';
  let cleaned = str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) cleaned = 'table_name';
  if (/^[0-9]/.test(cleaned)) cleaned = 't_' + cleaned;
  return cleaned;
}

let cachedBackupResult: BackupResult | null = null;
let lastBackupFetchTime = 0;
const BACKUP_CACHE_TTL_MS = 30 * 1000; // 30s cache

export async function getFullCPanelDbBackupData(
  requestedBy: string = 'admin',
  forceRefresh: boolean = false
): Promise<BackupResult> {
  const now = Date.now();
  if (!forceRefresh && cachedBackupResult && now - lastBackupFetchTime < BACKUP_CACHE_TTL_MS) {
    return cachedBackupResult;
  }

  const dbStatus = getCPanelDbStatus();
  const contacts = getAllContactsRaw();
  const existingAccounts = getAllExistingAccountsRaw();
  const users = getUsers();
  const barangays = getAllBarangaysRaw();
  const siteSettings = getSiteSettings();
  const activities = getAllActivitiesRaw();
  const deletedContacts = deletedContactsCache || [];
  const deletedBarangays = deletedBarangaysCache || [];
  const deletedExistingAccounts = deletedExistingAccountsCache || [];
  const deletedUsers = deletedUsersCache || [];

  const tables: TableBackupEntry[] = [];
  const rawTables: Record<string, any[]> = {};

  // 1. Contacts
  const contactHeaders = [
    'id', 'full_name', 'barangay', 'purok', 'contact_number',
    'created_at', 'updated_at', 'latitude', 'longitude', 'geotagged',
    'status', 'is_submitted', 'photo_url', 'pcu_file_url', 'pcu_uploaded_by', 'pcu_uploaded_at',
    'added_from_print_list', 'pin', 'facebook_link', 'category'
  ];
  const contactRows = contacts.map(c => [
    c.id, c.full_name, c.barangay, c.purok, c.contact_number,
    c.created_at, c.updated_at, c.latitude ?? '', c.longitude ?? '', c.geotagged ? 1 : 0,
    c.status || 'ACTIVE', c.isSubmitted ? 1 : 0, c.photo_url || '', c.pcu_file_url || '',
    c.pcu_uploaded_by || '', c.pcu_uploaded_at || '',
    c.added_from_print_list !== false ? 1 : 0, c.pin || '', c.facebookLink || '', c.category || 'pcu'
  ]);
  tables.push({
    tableName: 'contacts',
    displayName: 'Contacts (PCU Directory)',
    headers: contactHeaders,
    rowCount: contactRows.length,
    rows: contactRows,
    records: contacts
  });
  rawTables['contacts'] = contacts;

  // 2. Existing Accounts
  const existHeaders = [
    'id', 'full_name', 'barangay', 'purok', 'contact_number', 'created_at',
    'status', 'submitted_by', 'folder', 'remarks',
    'added_to_files', 'pin', 'facebook_link', 'latitude', 'longitude', 'geotagged',
    'existing_acc_verified', 'existing_acc_visited'
  ];
  const existRows = existingAccounts.map((e: any) => [
    e.id, e.full_name, e.barangay, e.purok, e.contact_number, e.created_at,
    e.status, e.submittedBy, e.folder || 'GENERAL', e.remarks || '',
    e.addedToFiles ? 1 : 0, e.pin || '', e.facebookLink || '', e.latitude ?? '', e.longitude ?? '', e.geotagged ? 1 : 0,
    e.existingAccVerified ? 1 : 0, e.existingAccVisited ? 1 : 0
  ]);
  tables.push({
    tableName: 'existing_accounts',
    displayName: 'Existing Accounts Matching',
    headers: existHeaders,
    rowCount: existRows.length,
    rows: existRows,
    records: existingAccounts
  });
  rawTables['existing_accounts'] = existingAccounts;

  // 3. Users / Admins
  const userHeaders = ['username', 'password_hash', 'role', 'full_name', 'email', 'status', 'barangay', 'created_at'];
  const userRows = users.map((u: any) => [
    u.username, u.passwordHash || u.passwordPlain || '', u.role, u.fullName || u.displayName || '', u.email || '', u.status || 'Active', u.barangay || '', u.createdAt || ''
  ]);
  tables.push({
    tableName: 'users',
    displayName: 'Administrators & Staff',
    headers: userHeaders,
    rowCount: userRows.length,
    rows: userRows,
    records: users
  });
  rawTables['users'] = users;

  // 4. Barangays
  const bgHeaders = ['name'];
  const bgRows = barangays.map(b => [b]);
  tables.push({
    tableName: 'barangays',
    displayName: 'Barangays Master List',
    headers: bgHeaders,
    rowCount: bgRows.length,
    rows: bgRows,
    records: barangays.map(b => ({ name: b }))
  });
  rawTables['barangays'] = barangays.map(b => ({ name: b }));

  // 5. Site Settings
  const settingsHeaders = ['setting_key', 'setting_value'];
  const settingsRows = Object.entries(siteSettings).map(([k, v]) => [
    k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')
  ]);
  tables.push({
    tableName: 'site_settings',
    displayName: 'Website Settings & Branding',
    headers: settingsHeaders,
    rowCount: settingsRows.length,
    rows: settingsRows,
    records: Object.entries(siteSettings).map(([k, v]) => ({ setting_key: k, setting_value: v }))
  });
  rawTables['site_settings'] = Object.entries(siteSettings).map(([k, v]) => ({ setting_key: k, setting_value: v }));

  // 6. Activities / Audit Logs
  const actHeaders = ['id', 'timestamp', 'username', 'action'];
  const actRows = activities.map(a => [a.id, a.timestamp, a.username, a.action]);
  tables.push({
    tableName: 'activities',
    displayName: 'Audit Logs',
    headers: actHeaders,
    rowCount: actRows.length,
    rows: actRows,
    records: activities
  });
  rawTables['activities'] = activities;

  // 7. Deleted Contacts
  const delContactHeaders = ['id', 'full_name', 'barangay', 'deleted_at'];
  const delContactRows = deletedContacts.map(d => [d.id || '', d.full_name, d.barangay, d.deletedAt]);
  tables.push({
    tableName: 'deleted_contacts',
    displayName: 'Trash: Deleted Contacts',
    headers: delContactHeaders,
    rowCount: delContactRows.length,
    rows: delContactRows,
    records: deletedContacts
  });
  rawTables['deleted_contacts'] = deletedContacts;

  // 8. Deleted Users
  const delUserHeaders = ['username', 'email', 'deleted_at'];
  const delUserRows = deletedUsers.map(u => [u.username, u.email || '', u.deletedAt]);
  tables.push({
    tableName: 'deleted_users',
    displayName: 'Trash: Deleted Users',
    headers: delUserHeaders,
    rowCount: delUserRows.length,
    rows: delUserRows,
    records: deletedUsers
  });
  rawTables['deleted_users'] = deletedUsers;

  const totalRecords = tables.reduce((sum, t) => sum + t.rowCount, 0);

  const metadata: BackupMetadata = {
    title: 'cPanel MySQL Database Full Backup',
    timestamp: new Date().toISOString(),
    source: dbStatus.connected ? `cPanel MySQL (${dbStatus.host}:${dbStatus.port}/${dbStatus.database})` : 'Local Storage Cache (cPanel Ready)',
    databaseName: dbStatus.database || 'sfc_directory',
    exportedBy: requestedBy,
    totalTables: tables.length,
    totalRecords,
    isLiveCPanelDb: dbStatus.connected,
    tableSummaries: tables.map(t => ({
      tableName: t.tableName,
      displayName: t.displayName,
      rowCount: t.rowCount,
      columnCount: t.headers.length
    }))
  };

  addActivity(requestedBy, `Exported cPanel MySQL database full backup (${tables.length} tables, ${totalRecords} total records)`);

  const result: BackupResult = {
    metadata,
    tables,
    rawTables
  };

  cachedBackupResult = result;
  lastBackupFetchTime = Date.now();

  return result;
}

export function formatBackupAsJson(backupData: BackupResult): string {
  return JSON.stringify(backupData, null, 2);
}

export function formatBackupAsSql(backupData: BackupResult): string {
  const meta = backupData.metadata;
  const lines: string[] = [];

  lines.push('-- =========================================================================');
  lines.push(`-- CPANEL MYSQL DATABASE BACKUP (SQL DUMP)`);
  lines.push(`-- Title:         ${meta.title}`);
  lines.push(`-- Exported At:   ${meta.timestamp}`);
  lines.push(`-- Exported By:   ${meta.exportedBy}`);
  lines.push(`-- Source:        ${meta.source}`);
  lines.push(`-- Database:      ${meta.databaseName}`);
  lines.push(`-- Total Tables:  ${meta.totalTables}`);
  lines.push(`-- Total Records: ${meta.totalRecords}`);
  lines.push(`-- Target Engine: MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+ (phpMyAdmin Ready)`);
  lines.push('-- =========================================================================\n');

  lines.push('SET FOREIGN_KEY_CHECKS = 0;');
  lines.push('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n');

  for (const table of backupData.tables) {
    const tableName = toSqlIdentifier(table.tableName);
    const headers = table.headers.map(h => `\`${toSqlIdentifier(h)}\``);
    const rowCount = table.rowCount;

    lines.push(`-- -------------------------------------------------------------------------`);
    lines.push(`-- Table: ${tableName} (${table.displayName})`);
    lines.push(`-- Total Records: ${rowCount}`);
    lines.push(`-- -------------------------------------------------------------------------`);
    lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);

    // DDL definition
    if (tableName === 'contacts') {
      lines.push(`CREATE TABLE \`contacts\` (
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
  INDEX \`idx_status\` (\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    } else if (tableName === 'users') {
      lines.push(`CREATE TABLE \`users\` (
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
  INDEX \`idx_role\` (\`role\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    } else if (tableName === 'existing_accounts') {
      lines.push(`CREATE TABLE \`existing_accounts\` (
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
  INDEX \`idx_exist_barangay\` (\`barangay\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    } else if (tableName === 'barangays') {
      lines.push(`CREATE TABLE \`barangays\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`name\` VARCHAR(255) UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    } else if (tableName === 'site_settings') {
      lines.push(`CREATE TABLE \`site_settings\` (
  \`setting_key\` VARCHAR(100) PRIMARY KEY,
  \`setting_value\` LONGTEXT,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    } else if (tableName === 'activities') {
      lines.push(`CREATE TABLE \`activities\` (
  \`id\` VARCHAR(100) PRIMARY KEY,
  \`timestamp\` VARCHAR(100) NOT NULL,
  \`username\` VARCHAR(100) NOT NULL,
  \`action\` TEXT NOT NULL,
  INDEX \`idx_timestamp\` (\`timestamp\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    } else {
      lines.push(`CREATE TABLE \`${tableName}\` (
  \`id\` VARCHAR(100) PRIMARY KEY,
  \`col1\` TEXT,
  \`col2\` TEXT,
  \`deleted_at\` VARCHAR(100) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    }

    if (rowCount > 0 && table.rows.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < table.rows.length; i += BATCH_SIZE) {
        const batch = table.rows.slice(i, i + BATCH_SIZE);
        lines.push(`INSERT INTO \`${tableName}\` (${headers.join(', ')}) VALUES`);
        const valueTuples = batch.map(row => {
          const escapedValues = row.map(val => escapeSqlValue(val));
          return `  (${escapedValues.join(', ')})`;
        });
        lines.push(valueTuples.join(',\n') + ';');
      }
    }

    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;');
  lines.push('-- =========================================================================');
  lines.push(`-- End of Backup Dump: ${meta.totalTables} tables exported successfully.`);
  lines.push('-- =========================================================================\n');

  return lines.join('\n');
}

// Backward-compatible alias
export const getFullGoogleSheetsBackupData = getFullCPanelDbBackupData;

/**
 * Invalidates the in-memory cached backup data to force re-fetch
 */
export function invalidateBackupCache() {
  cachedBackupResult = null;
  lastBackupFetchTime = 0;
}

export interface TableDisplayInfo {
  displayName: string;
  destination: string;
  category: string;
  icon: string;
}

export function getTableDisplayInfo(key: string): TableDisplayInfo {
  switch (key) {
    case 'contacts':
      return {
        displayName: 'Contacts (PCU Directory)',
        destination: 'Directory, Map, Print List & Dashboard',
        category: 'Core Directory Records',
        icon: 'contacts'
      };
    case 'existing_accounts':
      return {
        displayName: 'Existing Accounts',
        destination: 'Existing Account & Exist. Acc. Files',
        category: 'Member Accounts',
        icon: 'accounts'
      };
    case 'users':
      return {
        displayName: 'Administrators & Staff',
        destination: 'Admin Credentials (/accounts) & Website Settings',
        category: 'Access & Authentication',
        icon: 'users'
      };
    case 'barangays':
      return {
        displayName: 'Barangays Master List',
        destination: 'Barangay Filters, Analytics & Master Lists',
        category: 'Geographic Master Data',
        icon: 'barangays'
      };
    case 'site_settings':
      return {
        displayName: 'Website Settings & Branding',
        destination: 'Site Branding, Nav Labels & Role Permissions',
        category: 'System Configuration',
        icon: 'settings'
      };
    case 'activities':
      return {
        displayName: 'Activity Logs',
        destination: 'Dashboard Recent Activities & Audit Trail',
        category: 'System Logs',
        icon: 'activities'
      };
    case 'pcu_updates':
      return {
        displayName: 'PCU Uploaded Documents',
        destination: 'Recent Uploads (/recent-upload)',
        category: 'Uploaded Patient Files',
        icon: 'contacts'
      };
    case 'inbox_messages':
    case 'messages':
      return {
        displayName: 'Internal Inbox Messages',
        destination: 'Internal Inbox (/inbox)',
        category: 'Communications',
        icon: 'activities'
      };
    case 'deleted_contacts':
      return {
        displayName: 'Deleted Contacts',
        destination: 'Recycle Bin & Deleted Archives',
        category: 'Archive',
        icon: 'deleted'
      };
    case 'deleted_existing_accounts':
      return {
        displayName: 'Deleted Existing Accounts',
        destination: 'Recycle Bin & Deleted Archives',
        category: 'Archive',
        icon: 'deleted'
      };
    case 'deleted_users':
      return {
        displayName: 'Deleted Users',
        destination: 'Recycle Bin & Deleted Archives',
        category: 'Archive',
        icon: 'deleted'
      };
    case 'deleted_barangays':
      return {
        displayName: 'Deleted Barangays',
        destination: 'Recycle Bin & Deleted Archives',
        category: 'Archive',
        icon: 'deleted'
      };
    default:
      return {
        displayName: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        destination: 'Database Table Storage',
        category: 'Data Table',
        icon: 'table'
      };
  }
}

export interface ParsedBackupPreview {
  format: 'sql' | 'json';
  fileName: string;
  totalTables: number;
  totalRecords: number;
  tableCounts: Record<string, number>;
  tableSummaries: Array<{
    tableName: string;
    displayName: string;
    destination: string;
    category: string;
    count: number;
    sampleKeys: string[];
    sample: any[];
  }>;
}

export interface ParsedBackupData extends ParsedBackupPreview {
  data: {
    contacts: any[];
    existingAccounts: any[];
    users: any[];
    barangays: any[];
    settings: any;
    activities: any[];
    pcuUpdates?: any[];
    messages?: any[];
    deletedContacts: any[];
    deletedUsers: any[];
    deletedExistingAccounts: any[];
    deletedBarangays: any[];
  };
}

function normalizeTableKey(key: string): string {
  const k = (key || '').toLowerCase().replace(/[`"'\s-]/g, '_');
  if (k.includes('pcu_update') || k.includes('recent_upload') || (k.includes('update') && !k.includes('updated_at'))) return 'pcu_updates';
  if (k.includes('message') || k.includes('inbox')) return 'inbox_messages';
  if (k.includes('deleted_record') || k === 'deleted_records') return 'deleted_records';
  if (k.includes('deleted') && (k.includes('contact') || k.includes('pcu'))) return 'deleted_contacts';
  if (k.includes('deleted') && (k.includes('user') || k.includes('admin') || k.includes('staff'))) return 'deleted_users';
  if (k.includes('deleted') && (k.includes('account') || k.includes('exist'))) return 'deleted_existing_accounts';
  if (k.includes('deleted') && (k.includes('barangay') || k.includes('brgy'))) return 'deleted_barangays';
  if (k.includes('contact') && !k.includes('deleted')) return 'contacts';
  if (k.includes('pcu') && !k.includes('deleted')) return 'contacts';
  if (k.includes('account') && !k.includes('deleted')) return 'existing_accounts';
  if (k.includes('exist') && !k.includes('deleted')) return 'existing_accounts';
  if (k.includes('user') && !k.includes('deleted')) return 'users';
  if (k.includes('admin') && !k.includes('deleted')) return 'users';
  if (k.includes('staff') && !k.includes('deleted')) return 'users';
  if (k.includes('barangay') && !k.includes('deleted')) return 'barangays';
  if (k.includes('brgy') && !k.includes('deleted')) return 'barangays';
  if (k.includes('setting')) return 'site_settings';
  if (k.includes('config')) return 'site_settings';
  if (k.includes('activit') || k.includes('audit') || (k.includes('log') && !k.includes('logo'))) return 'activities';
  return k;
}

function getTableDisplayName(key: string): string {
  return getTableDisplayInfo(key).displayName;
}

function cleanSqlValueToken(raw: string): any {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toUpperCase() === 'NULL') return null;
  if (/^now\(\)$/i.test(trimmed)) return new Date().toISOString();
  if (/^current_timestamp(?:\(\))?$/i.test(trimmed)) return new Date().toISOString();
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;
  if (/^-?\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return isNaN(n) ? trimmed : n;
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    const f = parseFloat(trimmed);
    return isNaN(f) ? trimmed : f;
  }
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    let unquoted = trimmed.slice(1, -1);
    unquoted = unquoted
      .replace(/\\'/g, "'")
      .replace(/''/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
    return unquoted;
  }
  return trimmed;
}

function parseSqlDump(sql: string): Record<string, any[]> {
  const result: Record<string, any[]> = {
    contacts: [],
    existing_accounts: [],
    users: [],
    barangays: [],
    site_settings: [],
    activities: [],
    pcu_updates: [],
    inbox_messages: [],
    deleted_contacts: [],
    deleted_users: [],
    deleted_existing_accounts: [],
    deleted_barangays: []
  };

  const insertPattern = /INSERT\s+(?:IGNORE\s+)?INTO\s+([^\s(]+)\s*(?:\(([^)]+)\))?\s*VALUES\s*/gi;
  let match: RegExpExecArray | null;

  while ((match = insertPattern.exec(sql)) !== null) {
    const rawTable = match[1].trim();
    const cleanTable = rawTable.split('.').pop()!.replace(/[`"']/g, '').trim().toLowerCase();
    const tableKey = normalizeTableKey(cleanTable);

    let columns: string[] = [];
    if (match[2]) {
      columns = match[2].split(',').map(c => c.replace(/[`"']/g, '').trim().toLowerCase());
    } else {
      if (tableKey === 'contacts') {
        columns = ['id', 'full_name', 'barangay', 'purok', 'contact_number', 'created_at', 'updated_at', 'latitude', 'longitude', 'geotagged', 'status', 'is_submitted', 'photo_url', 'pcu_file_url', 'pcu_uploaded_by', 'pcu_uploaded_at', 'added_from_print_list', 'pin', 'facebook_link', 'category', 'deleted_at'];
      } else if (tableKey === 'existing_accounts') {
        columns = ['id', 'full_name', 'barangay', 'purok', 'contact_number', 'created_at', 'status', 'submitted_by', 'folder', 'remarks', 'added_to_files', 'pin', 'facebook_link', 'latitude', 'longitude', 'geotagged', 'existing_acc_verified', 'existing_acc_visited', 'deleted_at'];
      } else if (tableKey === 'users') {
        columns = ['username', 'password_hash', 'role', 'full_name', 'email', 'status', 'barangay', 'created_at', 'avatar_data_url', 'permissions'];
      } else if (tableKey === 'barangays') {
        columns = ['name'];
      } else if (tableKey === 'site_settings') {
        columns = ['setting_key', 'setting_value', 'updated_at'];
      } else if (tableKey === 'activities') {
        columns = ['id', 'timestamp', 'username', 'action'];
      } else if (tableKey === 'pcu_updates') {
        columns = ['id', 'contact_id', 'full_name', 'barangay', 'purok', 'file_name', 'file_data', 'uploaded_at', 'uploaded_by'];
      } else if (tableKey === 'inbox_messages') {
        columns = ['id', 'sender', 'recipient', 'subject', 'message', 'created_at', 'is_read'];
      } else if (tableKey === 'deleted_records') {
        columns = ['id', 'table_name', 'record_id', 'record_data', 'deleted_at', 'deleted_by'];
      }
    }

    let pos = match.index + match[0].length;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inEscape = false;
    let inTuple = false;
    let currentVal = '';
    let currentTuple: any[] = [];
    const tuples: any[][] = [];

    while (pos < sql.length) {
      const ch = sql[pos];
      const nextCh = pos + 1 < sql.length ? sql[pos + 1] : '';

      if (inEscape) {
        currentVal += ch;
        inEscape = false;
        pos++;
        continue;
      }

      if (ch === '\\' && (inSingleQuote || inDoubleQuote)) {
        inEscape = true;
        pos++;
        continue;
      }

      if (ch === "'" && !inDoubleQuote) {
        if (inSingleQuote && nextCh === "'") {
          currentVal += "'";
          pos += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
        pos++;
        continue;
      }

      if (ch === '"' && !inSingleQuote) {
        if (inDoubleQuote && nextCh === '"') {
          currentVal += '"';
          pos += 2;
          continue;
        }
        inDoubleQuote = !inDoubleQuote;
        pos++;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote) {
        if (ch === '(' && !inTuple) {
          inTuple = true;
          currentTuple = [];
          currentVal = '';
          pos++;
          continue;
        } else if (ch === ')' && inTuple) {
          currentTuple.push(cleanSqlValueToken(currentVal));
          tuples.push(currentTuple);
          currentTuple = [];
          currentVal = '';
          inTuple = false;
          pos++;
          continue;
        } else if (ch === ',' && inTuple) {
          currentTuple.push(cleanSqlValueToken(currentVal));
          currentVal = '';
          pos++;
          continue;
        } else if (ch === ';') {
          pos++;
          break;
        } else if (!inTuple && sql.slice(pos, pos + 12).toUpperCase() === 'ON DUPLICATE') {
          while (pos < sql.length && sql[pos] !== ';') pos++;
          if (pos < sql.length && sql[pos] === ';') pos++;
          break;
        } else if (ch === '-' && nextCh === '-') {
          while (pos < sql.length && sql[pos] !== '\n') pos++;
          continue;
        }
      }

      if (inTuple) {
        currentVal += ch;
      }
      pos++;
    }

    insertPattern.lastIndex = pos;

    if (tableKey === 'deleted_records') {
      for (const tuple of tuples) {
        const rowObj: Record<string, any> = {};
        for (let i = 0; i < columns.length; i++) {
          rowObj[columns[i]] = i < tuple.length ? tuple[i] : null;
        }
        const targetTable = (rowObj.table_name || '').toLowerCase();
        let data = rowObj.record_data;
        try {
          if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
            data = JSON.parse(data);
          }
        } catch {}
        if (data) {
          if (targetTable.includes('contact') || targetTable.includes('pcu')) result.deleted_contacts.push(data);
          else if (targetTable.includes('user') || targetTable.includes('admin') || targetTable.includes('staff')) result.deleted_users.push(data);
          else if (targetTable.includes('account') || targetTable.includes('exist')) result.deleted_existing_accounts.push(data);
          else if (targetTable.includes('barangay') || targetTable.includes('brgy')) result.deleted_barangays.push(data);
        }
      }
      continue;
    }

    if (!result[tableKey]) {
      result[tableKey] = [];
    }

    for (const tuple of tuples) {
      const rowObj: Record<string, any> = {};
      let colsToUse = columns;
      if (colsToUse.length === 0 || colsToUse.length !== tuple.length) {
        if (tableKey === 'barangays') {
          colsToUse = tuple.length === 1 ? ['name'] : ['id', 'name'];
        } else if (columns.length === 0) {
          colsToUse = tuple.map((_, i) => `col_${i}`);
        }
      }
      for (let i = 0; i < colsToUse.length; i++) {
        const col = colsToUse[i];
        rowObj[col] = i < tuple.length ? tuple[i] : null;
      }
      result[tableKey].push(rowObj);
    }
  }

  return result;
}

function parseJsonBackup(content: any): Record<string, any[]> {
  let parsed: any;
  if (typeof content === 'object' && content !== null) {
    parsed = content;
  } else {
    let raw = String(content || '').trim();
    if (raw.charCodeAt(0) === 0xFEFF) {
      raw = raw.slice(1).trim();
    }
    try {
      parsed = JSON.parse(raw);
    } catch (e1: any) {
      if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        try {
          parsed = JSON.parse(JSON.parse(raw));
        } catch {
          throw new Error(`${e1.message} (Raw snippet: ${raw.slice(0, 60)})`);
        }
      } else {
        throw new Error(`${e1.message} (Raw snippet: ${raw.slice(0, 60)})`);
      }
    }
  }
  const result: Record<string, any[]> = {
    contacts: [],
    existing_accounts: [],
    users: [],
    barangays: [],
    site_settings: [],
    activities: [],
    deleted_contacts: [],
    deleted_users: [],
    deleted_existing_accounts: [],
    deleted_barangays: []
  };

  // Case 1: App's own export format with rawTables
  if (parsed.rawTables && typeof parsed.rawTables === 'object') {
    for (const [key, val] of Object.entries(parsed.rawTables)) {
      if (Array.isArray(val)) {
        const normKey = normalizeTableKey(key);
        result[normKey] = val;
      }
    }
    return result;
  }

  // Case 2: App's export format with tables array
  if (Array.isArray(parsed.tables)) {
    for (const tbl of parsed.tables) {
      const normKey = normalizeTableKey(tbl.tableName || tbl.displayName || '');
      if (Array.isArray(tbl.records) && tbl.records.length > 0) {
        result[normKey] = tbl.records;
      } else if (Array.isArray(tbl.rows) && Array.isArray(tbl.headers)) {
        result[normKey] = tbl.rows.map((row: any[]) => {
          const obj: Record<string, any> = {};
          tbl.headers.forEach((h: string, i: number) => {
            obj[h] = i < row.length ? row[i] : null;
          });
          return obj;
        });
      }
    }
    return result;
  }

  // Case 3: Direct key mapping
  for (const [key, val] of Object.entries(parsed)) {
    const normKey = normalizeTableKey(key);
    if (Array.isArray(val)) {
      result[normKey] = val;
    } else if (key.includes('setting') && typeof val === 'object' && val !== null) {
      result.site_settings = Object.entries(val).map(([k, v]) => ({
        setting_key: k,
        setting_value: typeof v === 'object' ? JSON.stringify(v) : v
      }));
    }
  }

  // Case 4: Top-level array of objects or strings (e.g. single table backup uploaded directly)
  if (Array.isArray(parsed) && parsed.length > 0) {
    const fName = (fileName || '').toLowerCase();
    if (fName.includes('exist') || fName.includes('account')) {
      result.existing_accounts = parsed;
      return result;
    }
    if (fName.includes('user') || fName.includes('admin') || fName.includes('staff')) {
      result.users = parsed;
      return result;
    }
    if (fName.includes('brgy') || fName.includes('barangay')) {
      result.barangays = parsed;
      return result;
    }
    if (fName.includes('pcu_update') || fName.includes('recent_upload') || fName.includes('update')) {
      result.pcu_updates = parsed;
      return result;
    }
    if (fName.includes('message') || fName.includes('inbox')) {
      result.inbox_messages = parsed;
      return result;
    }
    if (fName.includes('activit') || fName.includes('audit') || fName.includes('log')) {
      result.activities = parsed;
      return result;
    }

    // Inspect items to accurately place records where they belong
    const contacts: any[] = [];
    const existingAccounts: any[] = [];
    const users: any[] = [];
    const barangays: any[] = [];
    const activities: any[] = [];
    const pcuUpdates: any[] = [];
    const messages: any[] = [];

    for (const item of parsed) {
      if (!item) continue;
      if (typeof item === 'string') {
        barangays.push(item);
        continue;
      }
      if (item.tableName) {
        const normKey = normalizeTableKey(item.tableName);
        if (Array.isArray(item.records)) result[normKey] = item.records;
        continue;
      }
      if (item.username && (item.passwordHash || item.password || item.role || item.passwordPlain)) {
        users.push(item);
        continue;
      }
      if (item.action && (item.timestamp || item.username)) {
        activities.push(item);
        continue;
      }
      if (item.fileData && (item.contactId || item.fileName || item.fullName)) {
        pcuUpdates.push(item);
        continue;
      }
      if (item.recipient && item.message) {
        messages.push(item);
        continue;
      }

      // Check if it's an existing account vs a directory contact
      const isExistAccount =
        item.existingAcc === true ||
        item.existingAcc === 'true' ||
        item.existingAccVerified !== undefined ||
        item.addedToFiles !== undefined ||
        item.category === 'existing_account' ||
        item.isExistingAccount === true ||
        (item.folder && item.folder.toUpperCase() !== 'GENERAL' && item.folder.trim() !== '') ||
        Boolean(item.submittedBy);

      if (isExistAccount) {
        existingAccounts.push(item);
      } else if (item.full_name || item.fullName || item.name || item.barangay || item.contact_number) {
        contacts.push(item);
      }
    }

    if (contacts.length > 0) result.contacts = contacts;
    if (existingAccounts.length > 0) result.existing_accounts = existingAccounts;
    if (users.length > 0) result.users = users;
    if (barangays.length > 0) result.barangays = barangays;
    if (activities.length > 0) result.activities = activities;
    if (pcuUpdates.length > 0) result.pcu_updates = pcuUpdates;
    if (messages.length > 0) result.inbox_messages = messages;
  }

  return result;
}

/**
 * Parses raw uploaded file content (SQL or JSON) and returns a structured preview and dataset
 */
export function parseBackupContent(content: string, fileName: string = 'backup'): ParsedBackupData {
  let trimmed = (content || '').trim();
  if (!trimmed) {
    throw new Error('The backup file is empty.');
  }

  // Fallback: If payload was HTML-escaped by middleware, restore original characters
  if (trimmed.includes('&quot;') || trimmed.includes('&#x27;') || trimmed.includes('&amp;') || trimmed.includes('&#x2F;')) {
    trimmed = trimmed
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  const isExplicitSql = fileName.toLowerCase().endsWith('.sql');
  const isExplicitJson = fileName.toLowerCase().endsWith('.json');

  let format: 'sql' | 'json';
  let rawExtracted: Record<string, any[]>;

  if (isExplicitJson || (!isExplicitSql && (trimmed.startsWith('{') || trimmed.startsWith('[')))) {
    format = 'json';
    try {
      rawExtracted = parseJsonBackup(trimmed, fileName);
    } catch (err: any) {
      if (isExplicitJson) {
        throw new Error(`Failed to parse JSON backup file: ${err.message || err}`);
      }
      // If auto-detection failed, try SQL fallback
      format = 'sql';
      rawExtracted = parseSqlDump(trimmed);
    }
  } else {
    format = 'sql';
    try {
      rawExtracted = parseSqlDump(trimmed);
    } catch (err: any) {
      throw new Error(`Failed to parse SQL backup file: ${err.message || err}`);
    }
  }

  const tableCounts: Record<string, number> = {};
  const tableSummaries: ParsedBackupPreview['tableSummaries'] = [];
  let totalRecords = 0;

  // Preferred order for displaying tables
  const tableOrder = ['contacts', 'existing_accounts', 'users', 'barangays', 'site_settings', 'activities', 'pcu_updates', 'inbox_messages', 'deleted_contacts', 'deleted_existing_accounts', 'deleted_users', 'deleted_barangays'];
  const sortedKeys = Object.keys(rawExtracted).sort((a, b) => {
    const idxA = tableOrder.indexOf(a);
    const idxB = tableOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const tKey of sortedKeys) {
    const list = rawExtracted[tKey];
    if (Array.isArray(list) && list.length > 0) {
      tableCounts[tKey] = list.length;
      totalRecords += list.length;
      const sampleItem = list[0] || {};
      const sampleKeys = typeof sampleItem === 'object' && sampleItem !== null ? Object.keys(sampleItem) : [];
      const info = getTableDisplayInfo(tKey);
      tableSummaries.push({
        tableName: tKey,
        displayName: info.displayName,
        destination: info.destination,
        category: info.category,
        count: list.length,
        sampleKeys,
        sample: list.slice(0, 5)
      });
    }
  }

  if (totalRecords === 0) {
    throw new Error(
      `No compatible database records could be recognized in ${fileName}. Supported formats: SQL dumps with INSERT statements or JSON backup files.`
    );
  }

  return {
    format,
    fileName,
    totalTables: tableSummaries.length,
    totalRecords,
    tableCounts,
    tableSummaries,
    data: {
      contacts: rawExtracted.contacts || [],
      existingAccounts: rawExtracted.existing_accounts || [],
      users: rawExtracted.users || [],
      barangays: rawExtracted.barangays || [],
      settings: rawExtracted.site_settings || [],
      activities: rawExtracted.activities || [],
      pcuUpdates: rawExtracted.pcu_updates || [],
      messages: rawExtracted.inbox_messages || [],
      deletedContacts: rawExtracted.deleted_contacts || [],
      deletedUsers: rawExtracted.deleted_users || [],
      deletedExistingAccounts: rawExtracted.deleted_existing_accounts || [],
      deletedBarangays: rawExtracted.deleted_barangays || []
    }
  };
}

/**
 * Restores parsed backup content into the database and invalidates the export cache
 */
export async function restoreBackupFromContent(
  content: string,
  fileName: string = 'backup',
  mode: 'merge' | 'replace' = 'merge',
  username: string = 'admin'
) {
  const parsed = parseBackupContent(content, fileName);
  const result = await applyRestoredData(parsed.data, mode, username);
  invalidateBackupCache();
  return {
    ...result,
    format: parsed.format,
    fileName: parsed.fileName,
    detectedTables: parsed.totalTables
  };
}

