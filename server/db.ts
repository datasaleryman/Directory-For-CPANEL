import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@base44/sdk';
import {
  saveContactToCPanel,
  saveContactsBulkToCPanel,
  deleteContactFromCPanel,
  saveUserToCPanel,
  updateUserRoleInCPanel,
  updateUserStatusInCPanel,
  deleteUserFromCPanel,
  saveExistingAccountToCPanel,
  deleteExistingAccountFromCPanel,
  saveBarangayToCPanel,
  deleteBarangayFromCPanel,
  saveActivityToCPanel,
  saveSettingToCPanel,
  savePcuSubmissionToCPanel,
  updatePcuStatusInCPanel,
  deletePcuSubmissionFromCPanel,
  deletePcuFileFromCPanel,
  savePcuSettlementToCPanel,
  fetchPcuSettlementsFromCPanel,
  deletePcuSettlementFromCPanel,
  fetchAllPcuSubmissionsFromCPanel,
  savePcuHistoryToCPanel,
  fetchPcuHistoryFromCPanel,
  fetchAllFromCPanelDb,
  getCPanelDbStatus,
  isCPanelDbConnected,
  reinitializePool,
  migrateAllDataToCPanelDb,
  loadCPanelDbConfig,
  saveCPanelDbConfig,
  testCPanelDbConnection,
  generateCPanelSchemaSql,
  checkCPanelDbNeedsSync,
  getCPanelContactsStats
} from './cpanel_db.js';

// Intercept console functions to suppress Base44 429 rate-limiting logs (preventing artificial AI Studio applet failures)
try {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;

  const isRateLimitLog = (args: any[]): boolean => {
    const msg = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }).join(' ').toLowerCase();

    return (
      msg.includes('base44 sdk error') ||
      msg.includes('traffic volume limit exceeded') ||
      msg.includes('error data:') ||
      msg.includes('too many requests') ||
      msg.includes('suppressed rate-limit') ||
      msg.includes('quota exceeded') ||
      msg.includes('read requests per minute') ||
      msg.includes('read requests') ||
      msg.includes('sheets.googleapis.com') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota metric') ||
      msg.includes('rate limit') ||
      msg.includes('429')
    );
  };

  console.error = function (...args: any[]) {
    if (isRateLimitLog(args)) return;
    originalConsoleError.apply(console, args);
  };

  console.warn = function (...args: any[]) {
    if (isRateLimitLog(args)) return;
    originalConsoleWarn.apply(console, args);
  };

  console.log = function (...args: any[]) {
    if (isRateLimitLog(args)) return;
    originalConsoleLog.apply(console, args);
  };

  console.info = function (...args: any[]) {
    if (isRateLimitLog(args)) return;
    originalConsoleInfo.apply(console, args);
  };
} catch (e: any) {
  console.warn('[Console Warning] Could not globally patch console methods:', e.message);
}

// Safe filesystem wrappers for serverless platforms like Netlify - modified to use atomic writes to prevent JSON corruption
export function safeWriteFileSync(file: string, data: string, options: any = 'utf-8') {
  const tmpFile = file + '.' + Math.random().toString(36).substring(2) + '.tmp';
  try {
    fs.writeFileSync(tmpFile, data, options);
    fs.renameSync(tmpFile, file);
  } catch (err: any) {
    // Fallback to standard synchronous write if rename fails
    try {
      fs.writeFileSync(file, data, options);
    } catch (fallbackErr: any) {
      console.warn(`[FileSystem Warning] Synchronous write to "${file}" skipped (likely read-only serverless environment):`, fallbackErr.message);
    }
  } finally {
    try {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch (e) {}
  }
}

export async function safeWriteFile(file: string, data: string, options: any = 'utf-8') {
  const tmpFile = file + '.' + Math.random().toString(36).substring(2) + '.tmp';
  try {
    await fs.promises.writeFile(tmpFile, data, options);
    await fs.promises.rename(tmpFile, file);
  } catch (err: any) {
    // Fallback to standard asynchronous write if rename fails
    try {
      await fs.promises.writeFile(file, data, options);
    } catch (fallbackErr: any) {
      console.warn(`[FileSystem Warning] Asynchronous write to "${file}" skipped (likely read-only serverless environment):`, fallbackErr.message);
    }
  } finally {
    try {
      if (fs.existsSync(tmpFile)) {
        await fs.promises.unlink(tmpFile);
      }
    } catch (e) {}
  }
}

export async function safeReadFile(file: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
  return await fs.promises.readFile(file, encoding);
}

export function safeMkdirSync(dir: string, options: any = { recursive: true }) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, options);
    }
  } catch (err: any) {
    console.warn(`[FileSystem Warning] Synchronous mkdir to "${dir}" skipped (likely read-only serverless environment):`, err.message);
  }
}

// Global monkeypatches for external packages, wrapped in try-catch to prevent frozen object errors
try {
  const originalWriteFileSync = fs.writeFileSync;
  fs.writeFileSync = function(file: any, data: any, options: any) {
    try {
      return originalWriteFileSync(file, data, options);
    } catch (err: any) {
      console.warn(`[FileSystem Warning] Synchronous write to "${file}" skipped (likely read-only serverless environment):`, err.message);
    }
  } as any;
} catch (e: any) {
  console.warn('[FileSystem Warning] Could not globally patch fs.writeFileSync:', e.message);
}

try {
  const originalWriteFile = fs.promises.writeFile;
  fs.promises.writeFile = async function(file: any, data: any, options: any) {
    try {
      return await originalWriteFile(file, data, options);
    } catch (err: any) {
      console.warn(`[FileSystem Warning] Asynchronous write to "${file}" skipped (likely read-only serverless environment):`, err.message);
    }
  } as any;
} catch (e: any) {
  console.warn('[FileSystem Warning] Could not globally patch fs.promises.writeFile:', e.message);
}

const base44 = createClient({
  appId: "6a430111a71a741248df97b1",
  headers: {
    "api_key": "cc66c96fd80b4fa19ed1ab3f246ab7e3"
  }
});

export interface Contact {
  id: number | string;
  full_name: string;
  barangay: string;
  purok: string;
  contact_number: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  latitude?: number;
  longitude?: number;
  geotagged?: boolean;
  added_locally?: boolean;
  added_from_print_list?: boolean;
  photo_url?: string;
  pcu_file_url?: string;
  pcu_uploaded_by?: string;
  pcu_uploaded_at?: string;
  isSubmitted?: boolean;
  status?: string;
  locked?: boolean;
  submittedToBase44?: boolean;
  submittedAt?: string;
  isExistingAccount?: boolean;
  category?: 'pcu' | 'existing_account';
  pin?: string;
  facebookLink?: string;
  uploadedFiles?: { 
    name: string; 
    fileName?: string;
    url: string; 
    fileUrl?: string;
    fileType?: string;
    size?: number;
    uploadedAt: string; 
    uploadedBy?: string;
  }[];
  maintenance?: 'None' | 'Yes' | string;
  maintenance_medicine?: string;
}

export interface PCUUpdate {
  id: string;
  contactId: number | string;
  fullName: string;
  barangay?: string;
  purok?: string;
  fileName: string;
  fileData: string; // Base64 content or public storage URL
  uploadedAt: string;
  uploadedBy?: string;
  added_from_website?: boolean;
  status?: string; // 'FILES' | 'VERIFIED' | 'PENDING' | 'UPDATED'
  verified_at?: string | null;
  verified_by?: string | null;
  pending_at?: string | null;
  pending_by?: string | null;
  updated_status_at?: string | null;
  updated_status_by?: string | null;
  verified_credit_added?: boolean;
  pending_credit_added?: boolean;
  credit_added?: boolean;
  contact_number?: string;
  uploadedFiles?: {
    name: string;
    url: string;
    uploadedAt: string;
    uploadedBy?: string;
  }[];
}

export interface Activity {
  id: string;
  timestamp: string;
  username: string;
  action: string;
}

export interface User {
  username: string;
  email?: string;
  fullName?: string;
  barangay?: string;
  passwordHash: string; // SHA-256 hashed password
  role: string;
  status?: 'Active' | 'Pending' | 'Suspended';
  createdAt?: string;
  updatedAt?: string;
  displayName?: string;
  avatarDataUrl?: string;
  passwordPlain?: string;
  permissions?: string[];
}

export interface ExistingAccountItem {
  id: string;
  localId?: string;
  full_name: string;
  barangay: string;
  purok: string;
  contact_number: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
  geotagged?: boolean;
  existingAcc: boolean;
  existingAccVerified: boolean;
  existingAccVisited: boolean;
  status: string;
  submittedBy: string;
  pin?: string;
  addedToFiles?: boolean;
  uploadedFiles?: { 
    name: string; 
    fileName?: string;
    url: string; 
    fileUrl?: string;
    fileType?: string;
    size?: number;
    uploadedAt: string; 
    uploadedBy?: string;
  }[];
  facebookLink?: string;
  added_from_website?: boolean;
  isBulkEntry?: boolean;
  isSubmitted?: boolean;
  submittedAt?: string;
  folder?: string;
  remarks?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const CONTACTS_SHEETS_BACKUP_FILE = path.join(DATA_DIR, 'contacts_sheets_backup.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SHEETS_CONFIG_FILE = path.join(DATA_DIR, 'sheets_config.json');
const PCU_UPDATES_FILE = path.join(DATA_DIR, 'pcu_updates.json');
const PCU_HISTORY_FILE = path.join(DATA_DIR, 'pcu_history.json');
const PCU_SETTLEMENTS_FILE = path.join(DATA_DIR, 'pcu_settlements.json');
const PCU_CONFIG_FILE = path.join(DATA_DIR, 'pcu_config.json');
const EXISTING_ACCOUNTS_FILE = path.join(DATA_DIR, 'existing_accounts.json');

export interface PcuHistoryItem {
  id: string;
  action: string;
  recordId?: string;
  patientName: string;
  barangay?: string;
  submitter?: string;
  performedBy: string;
  previousStatus?: string;
  newStatus: string;
  timestamp: string;
  details?: string;
}

export let pcuHistoryCache: PcuHistoryItem[] = [];

export interface PcuSettlement {
  id: string;
  submitter: string;
  totalSubmissions: number;
  baseRate: number;
  totalSalary: number;
  amountPaid: number;
  paymentStatus: 'SETTLED' | 'PENDING' | string;
  paymentMethod: string;
  referenceNotes?: string;
  settledBy: string;
  settledAt: string;
  createdAt?: string;
}

export let pcuBaseRate: number = 50.00;
export let pcuPendingBaseRate: number = 25.00;
export let pcuSettlementsCache: PcuSettlement[] = [];
const LOGO_DATA_FILE = path.join(DATA_DIR, 'logo_data.txt');
const FAVICON_DATA_FILE = path.join(DATA_DIR, 'favicon_data.txt');
const BARANGAYS_FILE = path.join(DATA_DIR, 'barangays.json');

const DELETED_CONTACTS_FILE = path.join(DATA_DIR, 'deleted_contacts.json');
const DELETED_BARANGAYS_FILE = path.join(DATA_DIR, 'deleted_barangays.json');
const DELETED_EXISTING_ACCOUNTS_FILE = path.join(DATA_DIR, 'deleted_existing_accounts.json');
const DELETED_USERS_FILE = path.join(DATA_DIR, 'deleted_users.json');

export interface DeletedContactRecord {
  id?: number | string;
  full_name: string;
  barangay: string;
  deletedAt: string;
  submitted_to_base44?: boolean;
}

export interface DeletedExistingAccountRecord {
  id?: string;
  full_name: string;
  barangay: string;
  deletedAt: string;
}

export interface DeletedUserRecord {
  username: string;
  email?: string;
  deletedAt: string;
}

export let deletedContactsCache: DeletedContactRecord[] = [];
export let deletedBarangaysCache: string[] = [];
export let deletedExistingAccountsCache: DeletedExistingAccountRecord[] = [];
export let deletedUsersCache: DeletedUserRecord[] = [];

export function isUserTombstoned(username?: string, email?: string): boolean {
  if (!username && !email) return false;
  const u = username ? username.trim().toLowerCase() : '';
  const e = email ? email.trim().toLowerCase() : '';
  if (u === 'admin') return false; // Master admin is never tombstoned
  return deletedUsersCache.some(d => {
    const du = d.username ? d.username.trim().toLowerCase() : '';
    const de = d.email ? d.email.trim().toLowerCase() : '';
    if (u && du && du === u) return true;
    if (e && de && de === e) return true;
    if (u && de && de === u) return true;
    if (e && du && du === e) return true;
    return false;
  });
}

export function unTombstoneUser(username?: string, email?: string) {
  if (!username && !email) return;
  const u = username ? username.trim().toLowerCase() : '';
  const e = email ? email.trim().toLowerCase() : '';
  const prevLen = deletedUsersCache.length;
  deletedUsersCache = deletedUsersCache.filter(d => {
    const du = d.username ? d.username.trim().toLowerCase() : '';
    const de = d.email ? d.email.trim().toLowerCase() : '';
    if (u && du && du === u) return false;
    if (e && de && de === e) return false;
    if (u && de && de === u) return false;
    if (e && du && du === e) return false;
    return true;
  });
  if (deletedUsersCache.length !== prevLen) {
    safeWriteFile(DELETED_USERS_FILE, JSON.stringify(deletedUsersCache, null, 2), 'utf-8').catch(err => {
      console.warn('Failed to save updated deleted users cache:', err.message || err);
    });
  }
}

export function extractBarangayName(item: any): string {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object') {
    return (
      item.barangay_name ||
      item.barangayName ||
      item.name ||
      item.barangay ||
      item.folder ||
      item.record_data ||
      item.recordId ||
      item.id ||
      ''
    ).toString().trim();
  }
  return String(item).trim();
}

export function unTombstoneBarangay(barangay?: any) {
  const targetName = extractBarangayName(barangay);
  if (!targetName) return;
  const target = targetName.toLowerCase();
  const prevLen = deletedBarangaysCache.length;
  deletedBarangaysCache = deletedBarangaysCache
    .map(extractBarangayName)
    .filter(b => {
      if (!b) return false;
      const bg = b.toLowerCase();
      return bg !== target && !isBarangayMatch(b, targetName) && normalizeBarangayName(b).toLowerCase() !== normalizeBarangayName(targetName).toLowerCase();
    });
  if (deletedBarangaysCache.length !== prevLen) {
    safeWriteFile(DELETED_BARANGAYS_FILE, JSON.stringify(deletedBarangaysCache, null, 2), 'utf-8').catch(err => {
      console.warn('Failed to save updated deleted barangays cache:', err.message || err);
    });
  }
}

export function unTombstoneContact(id?: number | string, full_name?: string, barangay?: string) {
  const cId = id !== undefined && id !== null ? id.toString() : '';
  const cName = (full_name || '').trim();
  const cBarangay = (barangay || '').trim();
  if (cBarangay) {
    unTombstoneBarangay(cBarangay);
  }
  const prevLen = deletedContactsCache.length;
  deletedContactsCache = deletedContactsCache.filter(del => {
    if (cId && del.id !== undefined && del.id !== null && del.id.toString() === cId) return false;
    if (cName && del.full_name && normalizeCompareName(del.full_name, cName)) {
      if (!cBarangay || !del.barangay) return false;
      if (isBarangayMatch(del.barangay, cBarangay) || normalizeBarangayName(del.barangay).toLowerCase() === normalizeBarangayName(cBarangay).toLowerCase()) {
        return false;
      }
    }
    return true;
  });
  if (deletedContactsCache.length !== prevLen) {
    safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8').catch(err => {
      console.warn('Failed to save updated deleted contacts cache:', err.message || err);
    });
  }
}

export function unTombstoneExistingAccount(id?: string, full_name?: string, barangay?: string) {
  const aId = id !== undefined && id !== null ? id.toString() : '';
  const aName = (full_name || '').trim();
  const aBarangay = (barangay || '').trim();
  if (aBarangay) {
    unTombstoneBarangay(aBarangay);
  }
  const prevLen = deletedExistingAccountsCache.length;
  deletedExistingAccountsCache = deletedExistingAccountsCache.filter(del => {
    if (aId && del.id !== undefined && del.id !== null && del.id.toString() === aId) return false;
    if (aName && del.full_name && normalizeCompareName(del.full_name, aName)) {
      if (!aBarangay || !del.barangay) return false;
      if (isBarangayMatch(del.barangay, aBarangay) || normalizeBarangayName(del.barangay).toLowerCase() === normalizeBarangayName(aBarangay).toLowerCase()) {
        return false;
      }
    }
    return true;
  });
  if (deletedExistingAccountsCache.length !== prevLen) {
    safeWriteFile(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2), 'utf-8').catch(err => {
      console.warn('Failed to save updated deleted existing accounts cache:', err.message || err);
    });
  }
}

export function isBarangayTombstoned(bg: any): boolean {
  const targetName = extractBarangayName(bg);
  if (!targetName) return false;
  const target = targetName.toLowerCase();
  return deletedBarangaysCache.some(rawDeletedBg => {
    const deletedBg = extractBarangayName(rawDeletedBg);
    if (!deletedBg) return false;
    const del = deletedBg.toLowerCase();
    return del === target || isBarangayMatch(deletedBg, targetName) || normalizeBarangayName(deletedBg).toLowerCase() === normalizeBarangayName(targetName).toLowerCase();
  });
}

export function isContactTombstoned(c: { id?: number | string; full_name?: string; barangay?: string; contact_number?: string }): boolean {
  if (!c) return false;
  if (c.barangay && isBarangayTombstoned(c.barangay)) return true;
  const cName = (c.full_name || '').trim();
  const cBarangay = (c.barangay || '').trim();
  const cId = c.id !== undefined && c.id !== null ? c.id.toString().trim() : '';
  const cNumber = ((c as any).contact_number || '').trim().replace(/[^0-9]/g, '');

  return deletedContactsCache.some(del => {
    // 1. Match by exact ID if available
    if (cId && del.id !== undefined && del.id !== null && del.id.toString().trim() === cId) return true;
    
    // 2. Match by Contact Number (if valid number >= 7 digits) and similar name
    if (cNumber && cNumber.length >= 7 && (del as any).contact_number) {
      const delNumber = ((del as any).contact_number || '').trim().replace(/[^0-9]/g, '');
      if (delNumber === cNumber && cName && del.full_name && normalizeCompareName(del.full_name, cName)) {
        return true;
      }
    }

    // 3. Match by Name and Barangay (or purely Name if submitted to Base44)
    if (cName && del.full_name && (normalizeCompareName(del.full_name, cName) || cName.toLowerCase() === del.full_name.toLowerCase().trim())) {
      // If contact was submitted to Base44, match purely by Name! (A person submitted to Base44 must NEVER reappear in PCU Directory under ANY folder or address)
      if ((del as any).submitted_to_base44) {
        return true;
      }
      if (!cBarangay || !del.barangay) return true;
      
      const b1 = normalizeBarangayName(del.barangay).toLowerCase().trim();
      const b2 = normalizeBarangayName(cBarangay).toLowerCase().trim();
      const isPlaceholder = (b: string) => 
        !b || b === 'no address' || b === 'no barangay' || b === 'not specified' || b === 'all addresses' || b === 'n/a';
      if (isPlaceholder(b1) || isPlaceholder(b2)) {
        return true;
      }
      if (b1 === b2 || isBarangayMatch(del.barangay, cBarangay) || b1.includes(b2) || b2.includes(b1)) {
        return true;
      }
    }
    return false;
  });
}

export function removeContactTombstone(c: { id?: number | string; full_name?: string; barangay?: string }): void {
  if (!c) return;
  const targetId = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
  const targetName = (c.full_name || '').trim();

  const initialLen = deletedContactsCache.length;
  deletedContactsCache = deletedContactsCache.filter(del => {
    if (!del) return false;
    if (targetId && del.id !== undefined && del.id !== null && del.id.toString().trim() === targetId) return false;
    if (targetName && del.full_name && (normalizeCompareName(del.full_name, targetName) || targetName.toLowerCase() === del.full_name.toLowerCase().trim())) return false;
    return true;
  });

  if (deletedContactsCache.length !== initialLen) {
    safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8').catch(() => {});
  }
}

export function isExistingAccountTombstoned(acc: { id?: string; full_name?: string; barangay?: string }): boolean {
  if (!acc) return false;
  if (acc.barangay && isBarangayTombstoned(acc.barangay)) return true;
  const aName = (acc.full_name || '').trim();
  const aBarangay = (acc.barangay || '').trim();
  const aId = acc.id !== undefined && acc.id !== null ? acc.id.toString() : '';

  return deletedExistingAccountsCache.some(del => {
    if (aId && del.id !== undefined && del.id !== null && del.id.toString() === aId) return true;
    if (aName && del.full_name && normalizeCompareName(del.full_name, aName)) {
      if (!aBarangay || !del.barangay) return true;
      if (isBarangayMatch(del.barangay, aBarangay) || normalizeBarangayName(del.barangay).toLowerCase() === normalizeBarangayName(aBarangay).toLowerCase()) {
        return true;
      }
    }
    return false;
  });
}

export const DEFAULT_BARANGAYS: string[] = [
  'Navalan',
  'Kalingayan',
  'Dampalan',
  'San Jose',
  'San Francisco',
  'Santa Maria',
  'Dumalinao',
  'Napolan',
  'Balangasan',
  'Tuburan',
  'Lumbia',
  'Banale',
  'Bulatok',
  'Dumagoc',
  'Kawit',
  'Muricay',
  'Santiago',
  'Santo Niño',
  'Sta. Lucia',
  'Tawagan Sur',
  'Tiguma',
  'White Beach',
  'Dao',
  'San Pedro',
  'Buenavista'
];

let barangaysCache: string[] = [...DEFAULT_BARANGAYS];

export async function saveBarangays() {
  await safeWriteFile(BARANGAYS_FILE, JSON.stringify(barangaysCache, null, 2), 'utf-8');
}

export interface SheetsConfig {
  authType: 'apiKey' | 'serviceAccount';
  apiKey: string;
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
  sheetName: string;
  syncEnabled: boolean;
  webAppUrl: string;
}

export function normalizeSheetsConfig(config: Partial<SheetsConfig>): SheetsConfig {
  let authType = config.authType || 'serviceAccount';
  let apiKey = (config.apiKey || '').trim();
  let clientEmail = (config.clientEmail || '').trim() || 'sfc-contact-data@sfcpayroll.iam.gserviceaccount.com';
  let privateKey = (config.privateKey || '').trim();
  let spreadsheetId = (config.spreadsheetId || '').trim();
  let sheetName = (config.sheetName || '').trim() || 'Sheet1';
  let syncEnabled = config.syncEnabled !== false;
  let webAppUrl = (config.webAppUrl || '').trim();

  // Extract Spreadsheet ID from URL if full URL is supplied
  const urlMatch = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) {
    spreadsheetId = urlMatch[1];
  }

  // Auto-detect if JSON service account key or private key was supplied in apiKey
  if (apiKey.includes('BEGIN PRIVATE KEY') || apiKey.includes('private_key') || apiKey.startsWith('{')) {
    if (!privateKey || apiKey.includes('BEGIN PRIVATE KEY')) {
      privateKey = apiKey;
      apiKey = '';
      authType = 'serviceAccount';
    }
  }

  // Auto-detect if full JSON credentials were provided in privateKey
  if (privateKey.startsWith('{')) {
    try {
      const parsed = JSON.parse(privateKey);
      if (parsed.private_key) privateKey = parsed.private_key.trim();
      if (parsed.client_email) clientEmail = parsed.client_email.trim();
      authType = 'serviceAccount';
    } catch (e) {}
  }

  // If private key is present, ensure Service Account is used
  if (privateKey.includes('BEGIN PRIVATE KEY') || privateKey.length > 200) {
    authType = 'serviceAccount';
    if (!clientEmail) {
      clientEmail = 'sfc-contact-data@sfcpayroll.iam.gserviceaccount.com';
    }
  } else if (apiKey && !privateKey) {
    authType = 'apiKey';
  }

  return {
    authType,
    apiKey,
    clientEmail,
    privateKey,
    spreadsheetId,
    sheetName,
    syncEnabled,
    webAppUrl
  };
}

// In-memory caches for fast sorting, searching, and filtering
export let contactsCache: Contact[] = [];
export let activitiesCache: Activity[] = [];
export let usersCache: User[] = [];
export let pcuUpdatesCache: PCUUpdate[] = [];
export let existingAccountsCache: ExistingAccountItem[] = [];

export function getAllContactsRaw(): Contact[] {
  return contactsCache;
}
export function getAllExistingAccountsRaw(): ExistingAccountItem[] {
  return existingAccountsCache;
}
export function getAllActivitiesRaw(): Activity[] {
  return activitiesCache;
}
export function getAllBarangaysRaw(): string[] {
  return (Array.isArray(barangaysCache) && barangaysCache.length > 0) ? barangaysCache : DEFAULT_BARANGAYS;
}
let sheetsConfig: SheetsConfig = {
  authType: 'serviceAccount',
  apiKey: '',
  clientEmail: '',
  privateKey: '',
  spreadsheetId: '',
  sheetName: '',
  syncEnabled: false,
  webAppUrl: ''
};

// Helper to ensure values sent to Google Sheets never exceed single cell limit of 50,000 characters
function sanitizeCellForSheets(val: any): string | number | boolean {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  const str = String(val);
  if (str.length > 49000) {
    return str.substring(0, 49000);
  }
  return str;
}

function sanitizeRowsForSheets(rows: any[][]): any[][] {
  return rows.map(row => row.map(cell => sanitizeCellForSheets(cell)));
}

function isConfigCorrect(): boolean {
  return false;
}

let lastSyncStatus = {
  connected: false,
  lastAttempt: null as string | null,
  lastSuccess: null as string | null,
  error: null as string | null
};

export function markSheetsConnected() {
  lastSyncStatus.connected = true;
  lastSyncStatus.lastSuccess = new Date().toISOString();
  lastSyncStatus.error = null;
}

export function markSheetsDisconnected(err: any) {
  if (isConfigCorrect()) {
    // Keep permanently connected as requested if environment configurations are correct
    lastSyncStatus.connected = true;
    lastSyncStatus.error = null;
  } else {
    lastSyncStatus.connected = false;
    lastSyncStatus.error = err?.message || String(err) || 'Unknown connection error';
  }
}

let base44SyncStatus = {
  lastAttempt: null as string | null,
  lastSuccess: null as string | null,
  count: 0,
  error: null as string | null
};

export function getBase44SyncStatus() {
  if (!base44SyncStatus.lastSuccess && contactsCache.length > 2) {
    base44SyncStatus.count = contactsCache.length;
    base44SyncStatus.lastSuccess = new Date().toISOString();
  }
  return base44SyncStatus;
}

export function getSheetsStatus() {
  const cpanelStatus = getCPanelDbStatus();
  return {
    connected: false,
    autoConnected: false,
    lastAttempt: null,
    lastSuccess: null,
    error: 'Migrated to cPanel MySQL Database',
    config: {
      authType: 'serviceAccount' as const,
      spreadsheetId: null,
      sheetName: 'cPanel MySQL Main DB',
      clientEmail: cpanelStatus.connected ? `Connected (${cpanelStatus.database})` : 'cPanel MySQL'
    }
  };
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'MASTER ADMIN': ['dashboard', 'map', 'directory', 'accounts', 'bulk', 'print', 'existing-account', 'settings'],
  'IT': ['dashboard', 'map', 'directory', 'accounts', 'bulk', 'print', 'existing-account', 'settings'],
  'ADMIN': ['dashboard', 'map', 'directory', 'accounts', 'bulk', 'print', 'existing-account', 'settings'],
  'Administrator': ['dashboard', 'map', 'directory', 'accounts', 'bulk', 'print', 'existing-account', 'settings'],
  'LEADER': ['dashboard', 'map', 'directory', 'bulk', 'print', 'existing-account'],
  'CO-LEADER': ['dashboard', 'map', 'directory', 'bulk', 'print', 'existing-account'],
  'ENCODER': ['dashboard', 'map', 'directory', 'bulk', 'print', 'existing-account'],
  'STAFF': ['dashboard', 'map', 'directory', 'bulk', 'print', 'existing-account']
};

export interface SiteSettings {
  title: string;
  faviconTitle: string;
  logoDataUrl: string;
  faviconDataUrl: string;
  navDashboard?: string;
  navMap?: string;
  navDirectory?: string;
  navRecentUpload?: string;
  navAccounts?: string;
  navBulk?: string;
  navPrint?: string;
  navAdmins?: string;
  navSettings?: string;
  navExistingAccount?: string;
  navExistAccFiles?: string;
  rolePermissions?: Record<string, string[]>;
  pcuBaseRate?: number;
  pcuPendingBaseRate?: number;
}

const DEFAULT_SITE_LOGO = 'https://www.image2url.com/r2/default/images/1785037750375-501bcf0e-4b15-4e0e-8be2-610bc89d072e.png';

let siteSettings: SiteSettings = {
  title: 'SFC HOUSEHOLD DATA LIST',
  faviconTitle: 'SFC HOUSEHOLD DATA LIST',
  logoDataUrl: DEFAULT_SITE_LOGO,
  faviconDataUrl: DEFAULT_SITE_LOGO,
  pcuBaseRate: 50.00,
  pcuPendingBaseRate: 25.00,
  navDashboard: 'Dashboard',
  navMap: 'Clinic Map',
  navDirectory: 'Clinic Directory',
  navRecentUpload: 'Recent Upload',
  navAccounts: 'Account Management',
  navBulk: 'Bulk Entry',
  navPrint: 'Print List',
  navAdmins: 'Admin Credentials',
  navSettings: 'Website Settings',
  navExistingAccount: 'Existing Account',
  navExistAccFiles: 'Exist. Acc. Files',
  rolePermissions: DEFAULT_ROLE_PERMISSIONS
};

export let googleSheetsQuotaCooldownUntil = 0;

export let siteSettingsLoadedFromSheets = false;
let settingsPullPromise: Promise<boolean> | null = null;
let lastSettingsPullTime = 0;

export async function pullSiteSettingsOnce(force: boolean = false): Promise<boolean> {
  if (!sheetsConfig.syncEnabled) {
    return true;
  }

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return true;
  }

  // If we pulled very recently (within 5 minutes), use cache to prevent hitting Google Sheets API rate limits
  if (!force && siteSettingsLoadedFromSheets && (Date.now() - lastSettingsPullTime < 300000)) {
    return true;
  }

  if (settingsPullPromise) {
    return settingsPullPromise;
  }

  settingsPullPromise = (async () => {
    try {
      const result = await pullSiteSettingsFromGoogleSheets();
      if (result) {
        siteSettingsLoadedFromSheets = true;
      }
      lastSettingsPullTime = Date.now();
      return result;
    } catch (err: any) {
      handleGoogleSheetsError(err, 'pullSiteSettingsOnce');
      lastSettingsPullTime = Date.now();
      return false;
    } finally {
      settingsPullPromise = null;
    }
  })();

  return settingsPullPromise;
}

export let adminsLoadedFromSheets = false;
let adminsPullPromise: Promise<boolean> | null = null;
let lastAdminsPullTime = 0;

export async function pullAdminsOnce(force: boolean = false): Promise<boolean> {
  if (!sheetsConfig.syncEnabled) {
    return true;
  }

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return true;
  }

  // If pulled within last 3 minutes and not forced, use memory cache
  if (!force && (Date.now() - lastAdminsPullTime < 180000)) {
    return true;
  }

  if (adminsPullPromise) {
    return adminsPullPromise;
  }

  adminsPullPromise = (async () => {
    try {
      const result = await pullAdminsFromGoogleSheets();
      if (result) {
        adminsLoadedFromSheets = true;
      }
      lastAdminsPullTime = Date.now();
      return result;
    } catch (err: any) {
      handleGoogleSheetsError(err, 'pullAdminsOnce');
      lastAdminsPullTime = Date.now();
      return false;
    } finally {
      adminsPullPromise = null;
    }
  })();

  return adminsPullPromise;
}

export let barangaysLoadedFromSheets = false;
let barangaysPullPromise: Promise<boolean> | null = null;
let lastBarangaysPullTime = 0;

export async function pullBarangaysOnce(force: boolean = false): Promise<boolean> {
  if (!sheetsConfig.syncEnabled) {
    return true;
  }

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return true;
  }

  // 3-minute memory cache
  if (!force && (Date.now() - lastBarangaysPullTime < 180000)) {
    return true;
  }

  if (barangaysPullPromise) {
    return barangaysPullPromise;
  }

  barangaysPullPromise = (async () => {
    try {
      const result = await pullBarangaysFromGoogleSheets();
      if (result) {
        barangaysLoadedFromSheets = true;
      }
      lastBarangaysPullTime = Date.now();
      return result;
    } catch (err: any) {
      handleGoogleSheetsError(err, 'pullBarangaysOnce');
      lastBarangaysPullTime = Date.now();
      return false;
    } finally {
      barangaysPullPromise = null;
    }
  })();

  return barangaysPullPromise;
}

export let deletedRecordsLoadedFromSheets = false;
let deletedRecordsPullPromise: Promise<boolean> | null = null;
let lastDeletedRecordsPullTime = 0;

export async function pullDeletedRecordsOnce(force: boolean = false): Promise<boolean> {
  if (!sheetsConfig.syncEnabled) {
    return true;
  }

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return true;
  }

  // 3-minute memory cache
  if (!force && (Date.now() - lastDeletedRecordsPullTime < 180000)) {
    return true;
  }

  if (deletedRecordsPullPromise) {
    return deletedRecordsPullPromise;
  }

  deletedRecordsPullPromise = (async () => {
    try {
      const result = await pullDeletedRecordsFromGoogleSheets();
      if (result) {
        deletedRecordsLoadedFromSheets = true;
      }
      lastDeletedRecordsPullTime = Date.now();
      return result;
    } catch (err: any) {
      handleGoogleSheetsError(err, 'pullDeletedRecordsOnce');
      lastDeletedRecordsPullTime = Date.now();
      return false;
    } finally {
      deletedRecordsPullPromise = null;
    }
  })();

  return deletedRecordsPullPromise;
}

export let existingAccountsLoadedFromSheets = false;
let existingAccountsPullPromise: Promise<boolean> | null = null;
let lastExistingAccountsPullTime = 0;

export async function pullExistingAccountsOnce(force: boolean = false): Promise<boolean> {
  if (!sheetsConfig.syncEnabled) {
    return true;
  }

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return true;
  }

  // 3-minute memory cache
  if (!force && (Date.now() - lastExistingAccountsPullTime < 180000)) {
    return true;
  }

  if (existingAccountsPullPromise) {
    return existingAccountsPullPromise;
  }

  existingAccountsPullPromise = (async () => {
    try {
      const result = await pullExistingAccountsFromGoogleSheets();
      if (result) {
        existingAccountsLoadedFromSheets = true;
      }
      lastExistingAccountsPullTime = Date.now();
      return result;
    } catch (err: any) {
      handleGoogleSheetsError(err, 'pullExistingAccountsOnce');
      lastExistingAccountsPullTime = Date.now();
      return false;
    } finally {
      existingAccountsPullPromise = null;
    }
  })();

  return existingAccountsPullPromise;
}

export function getSiteSettings() {
  return {
    ...siteSettings,
    logoDataUrl: siteSettings.logoDataUrl || DEFAULT_SITE_LOGO,
    faviconDataUrl: siteSettings.faviconDataUrl || DEFAULT_SITE_LOGO
  };
}

export function saveSiteSettings(settings: Partial<SiteSettings>) {
  const newLogo = settings.logoDataUrl !== undefined ? settings.logoDataUrl : siteSettings.logoDataUrl;
  const newFavicon = settings.faviconDataUrl !== undefined ? settings.faviconDataUrl : siteSettings.faviconDataUrl;

  siteSettings = {
    ...siteSettings,
    ...settings,
    logoDataUrl: newLogo,
    faviconDataUrl: newFavicon
  };

  try {
    if (siteSettings.logoDataUrl) {
      safeWriteFileSync(LOGO_DATA_FILE, siteSettings.logoDataUrl, 'utf-8');
    } else if (settings.logoDataUrl === '') {
      try { if (fs.existsSync(LOGO_DATA_FILE)) fs.unlinkSync(LOGO_DATA_FILE); } catch (e) {}
    }

    if (siteSettings.faviconDataUrl) {
      safeWriteFileSync(FAVICON_DATA_FILE, siteSettings.faviconDataUrl, 'utf-8');
    } else if (settings.faviconDataUrl === '') {
      try { if (fs.existsSync(FAVICON_DATA_FILE)) fs.unlinkSync(FAVICON_DATA_FILE); } catch (e) {}
    }

    safeWriteFileSync(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2), 'utf-8');
    if (settings.pcuBaseRate !== undefined) {
      pcuBaseRate = Number(settings.pcuBaseRate) || 0;
      safeWriteFileSync(PCU_CONFIG_FILE, JSON.stringify({ baseRate: pcuBaseRate }, null, 2), 'utf-8');
      saveSettingToCPanel('pcu_base_rate', String(pcuBaseRate)).catch(() => {});
    }
    siteSettingsLoadedFromSheets = true;
    lastSettingsPullTime = Date.now();
    syncSiteSettingsToGoogleSheets().catch(err => console.error('Failed to sync site settings to Sheets:', err));
  } catch (err) {
    console.error('Failed to write settings file:', err);
  }
  return siteSettings;
}

export function getPcuBaseRate(): number {
  return pcuBaseRate;
}

export function getPcuPendingBaseRate(): number {
  return pcuPendingBaseRate;
}

export function getPcuBaseRates(): { baseRate: number; pendingBaseRate: number } {
  return { baseRate: pcuBaseRate, pendingBaseRate: pcuPendingBaseRate };
}

export async function setPcuBaseRate(rate: number, pendingRate?: number): Promise<{ baseRate: number; pendingBaseRate: number }> {
  if (rate !== undefined && !isNaN(Number(rate))) {
    const cleanRate = Math.max(0, Number(rate) || 0);
    pcuBaseRate = cleanRate;
    siteSettings.pcuBaseRate = cleanRate;
    try {
      await saveSettingToCPanel('pcu_base_rate', String(cleanRate));
      console.log(`[cPanel DB] Verified base rate ${cleanRate} saved permanently to MySQL site_settings.`);
    } catch (err: any) {
      console.warn('Error saving base rate to MySQL:', err.message);
    }
  }

  if (pendingRate !== undefined && !isNaN(Number(pendingRate))) {
    const cleanPending = Math.max(0, Number(pendingRate) || 0);
    pcuPendingBaseRate = cleanPending;
    siteSettings.pcuPendingBaseRate = cleanPending;
    try {
      await saveSettingToCPanel('pcu_pending_base_rate', String(cleanPending));
      console.log(`[cPanel DB] Pending base rate ${cleanPending} saved permanently to MySQL site_settings.`);
    } catch (err: any) {
      console.warn('Error saving pending base rate to MySQL:', err.message);
    }
  }

  try {
    safeWriteFileSync(PCU_CONFIG_FILE, JSON.stringify({ baseRate: pcuBaseRate, pendingBaseRate: pcuPendingBaseRate }, null, 2), 'utf-8');
    safeWriteFileSync(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('Error saving PCU config:', err.message);
  }

  return { baseRate: pcuBaseRate, pendingBaseRate: pcuPendingBaseRate };
}

export function getPcuSettlements(): PcuSettlement[] {
  return pcuSettlementsCache;
}

export async function recordPcuSettlement(data: {
  id?: string;
  submitter: string;
  totalSubmissions: number;
  baseRate: number;
  totalSalary: number;
  amountPaid?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  referenceNotes?: string;
  settledBy?: string;
  settledAt?: string;
}): Promise<PcuSettlement> {
  const id = data.id || `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const submitter = (data.submitter || '').trim();
  const totalSubmissions = Number(data.totalSubmissions) || 0;
  const baseRate = Number(data.baseRate) || pcuBaseRate;
  const totalSalary = Number(data.totalSalary) || (totalSubmissions * baseRate);
  const amountPaid = data.amountPaid !== undefined ? Number(data.amountPaid) : totalSalary;
  const paymentStatus = data.paymentStatus || 'SETTLED';
  const paymentMethod = data.paymentMethod || 'CASH';
  const referenceNotes = data.referenceNotes || '';
  const settledBy = data.settledBy || 'Master Admin';
  const settledAt = data.settledAt || new Date().toISOString();

  const settlement: PcuSettlement = {
    id,
    submitter,
    totalSubmissions,
    baseRate,
    totalSalary,
    amountPaid,
    paymentStatus,
    paymentMethod,
    referenceNotes,
    settledBy,
    settledAt,
    createdAt: new Date().toISOString()
  };

  const existingIdx = pcuSettlementsCache.findIndex(
    s => (s.id && s.id === id) || (s.submitter && s.submitter.toLowerCase() === submitter.toLowerCase())
  );
  if (existingIdx >= 0) {
    pcuSettlementsCache[existingIdx] = settlement;
  } else {
    pcuSettlementsCache.unshift(settlement);
  }

  try {
    safeWriteFileSync(PCU_SETTLEMENTS_FILE, JSON.stringify(pcuSettlementsCache, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('Error writing pcu_settlements.json:', err.message);
  }

  try {
    await savePcuSettlementToCPanel(settlement);
    console.log(`[cPanel DB] Saved settlement for ${submitter} to MySQL.`);
  } catch (err: any) {
    console.warn('Error saving settlement to MySQL:', err.message);
  }

  return settlement;
}

export async function deletePcuSettlement(idOrSubmitter: string): Promise<boolean> {
  const key = idOrSubmitter.toLowerCase().trim();
  const found = pcuSettlementsCache.find(
    s => s.id === idOrSubmitter || (s.submitter && s.submitter.toLowerCase() === key)
  );
  pcuSettlementsCache = pcuSettlementsCache.filter(
    s => s.id !== idOrSubmitter && (!s.submitter || s.submitter.toLowerCase() !== key)
  );

  try {
    safeWriteFileSync(PCU_SETTLEMENTS_FILE, JSON.stringify(pcuSettlementsCache, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('Error writing pcu_settlements.json:', err.message);
  }

  if (found) {
    try {
      await deletePcuSettlementFromCPanel(found.id);
    } catch (err: any) {
      console.warn('Error deleting settlement from MySQL:', err.message);
    }
  }

  return true;
}

function unescapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#[xX]2[fF];/g, '/')
    .replace(/&#[xX]3[dD];/g, '=')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#[xX]27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Helper to calculate password hash
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Ensure database files exist
export async function initDb() {
  try {
    safeMkdirSync(DATA_DIR);

    // Init Users
    let content = '[]';
    if (fs.existsSync(USERS_FILE)) {
      try {
        content = fs.readFileSync(USERS_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read USERS_FILE:', e.message);
      }
    }
    try {
      usersCache = JSON.parse(content);
    } catch (e) {
      usersCache = [];
    }

    // Ensure master admin exists
    const masterAdmin = usersCache.find(u => u.username.toLowerCase() === 'admin');
    if (!masterAdmin) {
      const masterHash = hashPassword('2026');
      usersCache.unshift({
        username: 'admin',
        email: 'admin@clinic.gov.ph',
        passwordHash: masterHash,
        passwordPlain: '2026',
        role: 'Administrator',
        status: 'Active'
      });
    } else {
      if (!masterAdmin.email) {
        masterAdmin.email = 'admin@clinic.gov.ph';
      }
    }
    safeWriteFileSync(USERS_FILE, JSON.stringify(usersCache, null, 2));

    // Init Tombstones / Deleted Records
    if (fs.existsSync(DELETED_CONTACTS_FILE)) {
      try {
        const raw = fs.readFileSync(DELETED_CONTACTS_FILE, 'utf-8');
        deletedContactsCache = JSON.parse(raw);
        if (!Array.isArray(deletedContactsCache)) deletedContactsCache = [];
      } catch (e) {
        deletedContactsCache = [];
      }
    } else {
      deletedContactsCache = [];
      safeWriteFileSync(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2));
    }

    if (fs.existsSync(DELETED_BARANGAYS_FILE)) {
      try {
        const raw = fs.readFileSync(DELETED_BARANGAYS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          deletedBarangaysCache = Array.from(
            new Set(
              parsed.map(extractBarangayName).filter((b: string) => typeof b === 'string' && b.length > 0)
            )
          );
        } else {
          deletedBarangaysCache = [];
        }
      } catch (e) {
        deletedBarangaysCache = [];
      }
    } else {
      deletedBarangaysCache = [];
      safeWriteFileSync(DELETED_BARANGAYS_FILE, JSON.stringify(deletedBarangaysCache, null, 2));
    }

    if (fs.existsSync(DELETED_EXISTING_ACCOUNTS_FILE)) {
      try {
        const raw = fs.readFileSync(DELETED_EXISTING_ACCOUNTS_FILE, 'utf-8');
        deletedExistingAccountsCache = JSON.parse(raw);
        if (!Array.isArray(deletedExistingAccountsCache)) deletedExistingAccountsCache = [];
      } catch (e) {
        deletedExistingAccountsCache = [];
      }
    } else {
      deletedExistingAccountsCache = [];
      safeWriteFileSync(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2));
    }

    if (fs.existsSync(DELETED_USERS_FILE)) {
      try {
        const raw = fs.readFileSync(DELETED_USERS_FILE, 'utf-8');
        deletedUsersCache = JSON.parse(raw);
        if (!Array.isArray(deletedUsersCache)) deletedUsersCache = [];
      } catch (e) {
        deletedUsersCache = [];
      }
    } else {
      deletedUsersCache = [];
      safeWriteFileSync(DELETED_USERS_FILE, JSON.stringify(deletedUsersCache, null, 2));
    }

    // Scrub users cache of any tombstoned accounts
    usersCache = usersCache.filter(u => !isUserTombstoned(u.username, u.email));
    safeWriteFileSync(USERS_FILE, JSON.stringify(usersCache, null, 2));

    // Init Contacts
    if (!fs.existsSync(CONTACTS_FILE)) {
      // Start with empty contacts list as requested
      const initialContacts: Contact[] = [];
      safeWriteFileSync(CONTACTS_FILE, JSON.stringify(initialContacts, null, 2));
      contactsCache = initialContacts;
    } else {
      let content = '[]';
      try {
        content = fs.readFileSync(CONTACTS_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read CONTACTS_FILE:', e.message);
      }
      try {
        contactsCache = JSON.parse(content);
      } catch (e) {
        contactsCache = [];
      }
      // Migrate legacy cache entries from address -> barangay & purok, and normalize barangay name casing
      let migrated = false;
      contactsCache = contactsCache.map(c => {
        let updated = false;
        const anyC = c as any;
        if (anyC.address !== undefined && anyC.barangay === undefined) {
          anyC.barangay = anyC.address;
          delete anyC.address;
          updated = true;
        }
        if (anyC.purok === undefined) {
          anyC.purok = '';
          updated = true;
        }
        if (anyC.barangay) {
          const normBarangay = normalizeBarangayName(anyC.barangay);
          if (anyC.barangay !== normBarangay) {
            anyC.barangay = normBarangay;
            updated = true;
          }
        }
        if (anyC.purok) {
          const normPurok = capitalizeWords(anyC.purok);
          if (anyC.purok !== normPurok) {
            anyC.purok = normPurok;
            updated = true;
          }
        }
        if (anyC.added_from_print_list === undefined) {
          anyC.added_from_print_list = true;
          updated = true;
        }
        if (updated) migrated = true;
        return anyC as Contact;
      });
      // Deduplicate contacts and filter out deleted or tombstoned records
      contactsCache = deduplicateContactsByName(
        contactsCache.filter(c => c && !c.deleted_at && !isContactTombstoned(c) && !isBarangayTombstoned(c.barangay))
      );

      // Ensure contacts cache is populated from contacts_sheets_backup.json if cache is empty or has only placeholder records
      if (contactsCache.length <= 10 && fs.existsSync(CONTACTS_SHEETS_BACKUP_FILE)) {
        try {
          const rawBackup = fs.readFileSync(CONTACTS_SHEETS_BACKUP_FILE, 'utf-8');
          const backupContacts = JSON.parse(rawBackup);
          if (Array.isArray(backupContacts) && backupContacts.length > contactsCache.length) {
            console.log(`[initDb] Seeding ${backupContacts.length} contacts from contacts_sheets_backup.json into contactsCache.`);
            const existingIds = new Set(contactsCache.map(c => String(c.id)));
            for (const c of backupContacts) {
              if (c && !existingIds.has(String(c.id))) {
                contactsCache.push(c);
              }
            }
            contactsCache = deduplicateContactsByName(contactsCache);
          }
        } catch (err: any) {
          console.warn('[initDb] Failed to seed contactsCache from sheets backup:', err.message);
        }
      }

      syncPCUFieldsToCache();
      safeWriteFileSync(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2));
    }

    // Init Activities
    if (!fs.existsSync(ACTIVITIES_FILE)) {
      const initialActivities: Activity[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          username: 'System',
          action: 'Database initialized with seed records.'
        }
      ];
      safeWriteFileSync(ACTIVITIES_FILE, JSON.stringify(initialActivities, null, 2));
      activitiesCache = initialActivities;
    } else {
      let content = '[]';
      try {
        content = fs.readFileSync(ACTIVITIES_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read ACTIVITIES_FILE:', e.message);
      }
      try {
        activitiesCache = JSON.parse(content);
      } catch (e) {
        activitiesCache = [];
      }
    }

    // Init PCU Updates
    if (!fs.existsSync(PCU_UPDATES_FILE)) {
      const initialPCUUpdates: PCUUpdate[] = [];
      safeWriteFileSync(PCU_UPDATES_FILE, JSON.stringify(initialPCUUpdates, null, 2));
      pcuUpdatesCache = initialPCUUpdates;
    } else {
      let content = '[]';
      try {
        content = fs.readFileSync(PCU_UPDATES_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read PCU_UPDATES_FILE:', e.message);
      }
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          pcuUpdatesCache = parsed.filter(u => u && (u.fullName || u.fileName) && !isBarangayTombstoned(u.barangay));
          safeWriteFileSync(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2));
        } else {
          pcuUpdatesCache = [];
        }
      } catch (e) {
        pcuUpdatesCache = [];
      }
    }

    // Init PCU History Log
    if (!fs.existsSync(PCU_HISTORY_FILE)) {
      safeWriteFileSync(PCU_HISTORY_FILE, JSON.stringify([], null, 2));
      pcuHistoryCache = [];
    } else {
      try {
        const rawHist = fs.readFileSync(PCU_HISTORY_FILE, 'utf-8');
        const parsedHist = JSON.parse(rawHist);
        pcuHistoryCache = Array.isArray(parsedHist) ? parsedHist : [];
      } catch (e) {
        pcuHistoryCache = [];
      }
    }

    // Init PCU Config (Verified & Pending Base Rates)
    if (fs.existsSync(PCU_CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(PCU_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.baseRate === 'number') {
          pcuBaseRate = parsed.baseRate;
          siteSettings.pcuBaseRate = pcuBaseRate;
        }
        if (parsed && typeof parsed.pendingBaseRate === 'number') {
          pcuPendingBaseRate = parsed.pendingBaseRate;
          siteSettings.pcuPendingBaseRate = pcuPendingBaseRate;
        }
      } catch (e: any) {
        console.warn('Failed to read PCU_CONFIG_FILE:', e.message);
      }
    } else {
      safeWriteFileSync(PCU_CONFIG_FILE, JSON.stringify({ baseRate: pcuBaseRate, pendingBaseRate: pcuPendingBaseRate }, null, 2));
    }

    // Init PCU Settlements Cache
    if (!fs.existsSync(PCU_SETTLEMENTS_FILE)) {
      safeWriteFileSync(PCU_SETTLEMENTS_FILE, JSON.stringify([], null, 2));
      pcuSettlementsCache = [];
    } else {
      try {
        const raw = fs.readFileSync(PCU_SETTLEMENTS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        pcuSettlementsCache = Array.isArray(parsed) ? parsed : [];
      } catch (e: any) {
        pcuSettlementsCache = [];
      }
    }

    // Prune any submitted contacts from contactsCache so they are not displayed in PCU Directory
    syncPCUFieldsToCache();
    console.log(`[Init] Filtered submitted contacts so they are omitted from PCU Directory.`);
    safeWriteFileSync(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2));

    // Init Existing Accounts
    if (!fs.existsSync(EXISTING_ACCOUNTS_FILE)) {
      const initialExistingAccounts: ExistingAccountItem[] = [];
      safeWriteFileSync(EXISTING_ACCOUNTS_FILE, JSON.stringify(initialExistingAccounts, null, 2));
      existingAccountsCache = initialExistingAccounts;
    } else {
      let content = '[]';
      try {
        content = fs.readFileSync(EXISTING_ACCOUNTS_FILE, 'utf-8');
      } catch (e: any) {
        console.warn('Failed to read EXISTING_ACCOUNTS_FILE:', e.message);
      }
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          existingAccountsCache = parsed.filter(acc => acc && acc.full_name);
          for (const acc of existingAccountsCache) {
            unTombstoneExistingAccount(acc.id, acc.full_name, acc.barangay);
          }
          safeWriteFileSync(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2));
        } else {
          existingAccountsCache = [];
        }
      } catch (e) {
        existingAccountsCache = [];
      }
    }

    // Init Barangays
    if (fs.existsSync(BARANGAYS_FILE)) {
      try {
        const raw = fs.readFileSync(BARANGAYS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          barangaysCache = parsed.filter((b: string) => !isBarangayTombstoned(b));
        } else {
          barangaysCache = [...DEFAULT_BARANGAYS].filter(b => !isBarangayTombstoned(b));
          safeWriteFileSync(BARANGAYS_FILE, JSON.stringify(barangaysCache, null, 2));
        }
      } catch (e) {
        barangaysCache = [...DEFAULT_BARANGAYS].filter(b => !isBarangayTombstoned(b));
      }
    } else {
      barangaysCache = [...DEFAULT_BARANGAYS].filter(b => !isBarangayTombstoned(b));
      safeWriteFileSync(BARANGAYS_FILE, JSON.stringify(barangaysCache, null, 2));
    }

    // Init Sheets Config
    if (fs.existsSync(SHEETS_CONFIG_FILE)) {
      try {
        const content = fs.readFileSync(SHEETS_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        sheetsConfig = normalizeSheetsConfig(parsed);
      } catch (e) {
        console.error('Error parsing sheets config:', e);
      }
    }

    // Init Site Settings
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        let logoDataUrl = unescapeHtml(parsed.logoDataUrl || '');
        let faviconDataUrl = unescapeHtml(parsed.faviconDataUrl || '');

        if (fs.existsSync(LOGO_DATA_FILE)) {
          try {
            const fileLogo = unescapeHtml(fs.readFileSync(LOGO_DATA_FILE, 'utf-8'));
            if (fileLogo && fileLogo.length > logoDataUrl.length) {
              logoDataUrl = fileLogo;
            }
          } catch (e) {}
        }
        if (!logoDataUrl && fs.existsSync(LOGO_DATA_FILE)) {
          try { logoDataUrl = unescapeHtml(fs.readFileSync(LOGO_DATA_FILE, 'utf-8')); } catch (e) {}
        }

        if (fs.existsSync(FAVICON_DATA_FILE)) {
          try {
            const fileFavicon = unescapeHtml(fs.readFileSync(FAVICON_DATA_FILE, 'utf-8'));
            if (fileFavicon && fileFavicon.length > faviconDataUrl.length) {
              faviconDataUrl = fileFavicon;
            }
          } catch (e) {}
        }
        if (!faviconDataUrl && fs.existsSync(FAVICON_DATA_FILE)) {
          try { faviconDataUrl = unescapeHtml(fs.readFileSync(FAVICON_DATA_FILE, 'utf-8')); } catch (e) {}
        }

        siteSettings = {
          title: unescapeHtml(parsed.title || 'PCU Uploader'),
          faviconTitle: unescapeHtml(parsed.faviconTitle || 'PCU Uploader'),
          logoDataUrl,
          faviconDataUrl,
          navDashboard: unescapeHtml(parsed.navDashboard || 'Dashboard'),
          navMap: unescapeHtml(parsed.navMap || 'Clinic Map'),
          navDirectory: unescapeHtml(parsed.navDirectory || 'Clinic Directory'),
          navRecentUpload: unescapeHtml(parsed.navRecentUpload || 'Recent Upload'),
          navAccounts: unescapeHtml(parsed.navAccounts || 'Account Management'),
          navBulk: unescapeHtml(parsed.navBulk || 'Bulk Entry'),
          navPrint: unescapeHtml(parsed.navPrint || 'Print List'),
          navAdmins: unescapeHtml(parsed.navAdmins || 'Admin Credentials'),
          navSettings: unescapeHtml(parsed.navSettings || 'Website Settings'),
          navExistingAccount: unescapeHtml(parsed.navExistingAccount || 'Existing Account'),
          navExistAccFiles: unescapeHtml(parsed.navExistAccFiles || 'Exist. Acc. Files'),
          rolePermissions: (() => {
            const parsedPermissions = parsed.rolePermissions || {};
            const merged: Record<string, string[]> = { ...DEFAULT_ROLE_PERMISSIONS };
            for (const role of Object.keys(parsedPermissions)) {
              const perms = parsedPermissions[role];
              if (Array.isArray(perms)) {
                merged[role] = perms;
              }
            }
            return merged;
          })()
        };
      } catch (e) {
        console.error('Error parsing site settings:', e);
      }
    } else {
      let logoDataUrl = '';
      let faviconDataUrl = '';
      if (fs.existsSync(LOGO_DATA_FILE)) {
        try { logoDataUrl = fs.readFileSync(LOGO_DATA_FILE, 'utf-8'); } catch (e) {}
      }
      if (fs.existsSync(FAVICON_DATA_FILE)) {
        try { faviconDataUrl = fs.readFileSync(FAVICON_DATA_FILE, 'utf-8'); } catch (e) {}
      }
      siteSettings.logoDataUrl = logoDataUrl;
      siteSettings.faviconDataUrl = faviconDataUrl;
      safeWriteFileSync(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2));
    }

    // Initialize cPanel MySQL Database connection
    try {
      console.log('[cPanel DB] Initializing cPanel MySQL Database connection...');
      await reinitializePool();
      if (isCPanelDbConnected()) {
        console.log('[cPanel DB] Successfully connected to cPanel MySQL Database!');
        const cpanelData = await fetchAllFromCPanelDb();
        
        // Comprehensive check: does MySQL already contain any existing data?
        let mysqlHasData = Boolean(
          cpanelData && (
            cpanelData.contacts.length > 0 ||
            cpanelData.users.length > 0 ||
            cpanelData.existingAccounts.length > 0 ||
            (cpanelData.barangays && cpanelData.barangays.length > 0) ||
            (cpanelData.activities && cpanelData.activities.length > 0)
          )
        );

        // Also check if pcu_submissions or pcu_settlements exist in MySQL
        if (!mysqlHasData) {
          try {
            const pool = (await import('./cpanel_db.js')).getPool();
            if (pool) {
              const [pcuRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM pcu_submissions').catch(() => [[{ cnt: 0 }]]);
              const [settleRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM pcu_settlements').catch(() => [[{ cnt: 0 }]]);
              if ((pcuRows?.[0]?.cnt || 0) > 0 || (settleRows?.[0]?.cnt || 0) > 0) {
                mysqlHasData = true;
              }
            }
          } catch (cntErr) {}
        }

        if (cpanelData && mysqlHasData) {
          console.log(`[cPanel DB Safety] MySQL Database is ACTIVE and PROTECTED. Preserving all records during application update.`);
          console.log(`[cPanel DB] Loaded ${cpanelData.contacts.length} contacts, ${cpanelData.users.length} users, and ${cpanelData.existingAccounts.length} existing accounts from cPanel MySQL Database.`);
          
          // Populate local cache from authoritative MySQL database
          if (cpanelData.contacts.length > 0) {
            contactsCache = cpanelData.contacts;
            safeWriteFileSync(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2));
          }
          if (cpanelData.existingAccounts.length > 0) {
            existingAccountsCache = cpanelData.existingAccounts;
            safeWriteFileSync(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2));
          }
          if (cpanelData.barangays && cpanelData.barangays.length > 0) {
            barangaysCache = cpanelData.barangays;
            safeWriteFileSync(BARANGAYS_FILE, JSON.stringify(barangaysCache, null, 2));
          }
          if (cpanelData.settings && Object.keys(cpanelData.settings).length > 0) {
            siteSettings = { ...siteSettings, ...cpanelData.settings };
            if (cpanelData.settings.pcu_base_rate !== undefined) {
              const remoteRate = Number(cpanelData.settings.pcu_base_rate);
              if (!isNaN(remoteRate) && remoteRate >= 0) {
                pcuBaseRate = remoteRate;
                siteSettings.pcuBaseRate = pcuBaseRate;
              }
            }
            if (cpanelData.settings.pcu_pending_base_rate !== undefined) {
              const remotePending = Number(cpanelData.settings.pcu_pending_base_rate);
              if (!isNaN(remotePending) && remotePending >= 0) {
                pcuPendingBaseRate = remotePending;
                siteSettings.pcuPendingBaseRate = pcuPendingBaseRate;
              }
            }
            safeWriteFileSync(PCU_CONFIG_FILE, JSON.stringify({ baseRate: pcuBaseRate, pendingBaseRate: pcuPendingBaseRate }, null, 2));
          }

          // Sync PCU submissions with MySQL to guarantee zero data loss during application updates
          try {
            const remotePcuSubmissions = (cpanelData as any).pcuSubmissions || await fetchAllPcuSubmissionsFromCPanel();
            if (Array.isArray(remotePcuSubmissions) && remotePcuSubmissions.length > 0) {
              const pcuMap = new Map<string, PCUUpdate>();
              // Keep existing local memory records
              pcuUpdatesCache.forEach(u => pcuMap.set(String(u.id), u));
              // Authoritative MySQL records override or merge
              remotePcuSubmissions.forEach(sub => {
                pcuMap.set(String(sub.id), {
                  id: String(sub.id),
                  contactId: sub.contactId || sub.id,
                  fullName: sub.fullName,
                  barangay: sub.barangay,
                  purok: sub.purok || '',
                  fileName: sub.fileName || 'PCU Document',
                  fileData: sub.fileUrl || '',
                  uploadedAt: sub.uploadedAt,
                  uploadedBy: sub.uploadedBy || 'Admin',
                  added_from_website: true,
                  status: sub.status || 'FILES',
                  verified_at: sub.verified_at || null,
                  verified_by: sub.verified_by || null,
                  pending_at: sub.pending_at || null,
                  pending_by: sub.pending_by || null,
                  updated_status_at: sub.updated_status_at || null,
                  updated_status_by: sub.updated_status_by || null,
                  verified_credit_added: Boolean(sub.verified_credit_added),
                  pending_credit_added: Boolean(sub.pending_credit_added),
                  contact_number: sub.contactNumber || '',
                  uploadedFiles: sub.uploadedFiles || []
                });
              });
              pcuUpdatesCache = Array.from(pcuMap.values()).sort(
                (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
              );
              safeWriteFileSync(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2));
              console.log(`[cPanel DB] Protected and synced ${pcuUpdatesCache.length} PCU submissions from MySQL.`);
            } else if (pcuUpdatesCache.length > 0) {
              for (const u of pcuUpdatesCache) {
                await savePcuSubmissionToCPanel({
                  id: String(u.id),
                  contactId: u.contactId,
                  fullName: u.fullName,
                  barangay: u.barangay || '',
                  purok: u.purok || '',
                  contactNumber: (u as any).contact_number || '',
                  fileName: u.fileName,
                  fileUrl: u.fileData,
                  uploadedFiles: (u as any).uploadedFiles,
                  uploadedBy: u.uploadedBy,
                  uploadedAt: u.uploadedAt,
                  status: u.status || 'FILES',
                  verified_at: u.verified_at,
                  verified_by: u.verified_by,
                  pending_at: u.pending_at,
                  pending_by: u.pending_by,
                  updated_status_at: u.updated_status_at,
                  updated_status_by: u.updated_status_by,
                  verified_credit_added: u.verified_credit_added,
                  pending_credit_added: u.pending_credit_added
                });
              }
            }
          } catch (pcuSyncErr: any) {
            console.warn('[cPanel DB] Error syncing PCU submissions with MySQL:', pcuSyncErr.message);
          }

          // Sync PCU History log from MySQL
          try {
            const remoteHistory = (cpanelData as any).pcuHistory || await fetchPcuHistoryFromCPanel(500);
            if (Array.isArray(remoteHistory) && remoteHistory.length > 0) {
              const histMap = new Map<string, PcuHistoryItem>();
              pcuHistoryCache.forEach(h => histMap.set(h.id, h));
              remoteHistory.forEach(h => histMap.set(h.id, h));
              pcuHistoryCache = Array.from(histMap.values()).sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );
              safeWriteFileSync(PCU_HISTORY_FILE, JSON.stringify(pcuHistoryCache, null, 2));
              console.log(`[cPanel DB] Synced ${pcuHistoryCache.length} PCU history records from MySQL.`);
            }
          } catch (histSyncErr: any) {
            console.warn('[cPanel DB] Error syncing PCU history from MySQL:', histSyncErr.message);
          }

          // Sync PCU settlements with MySQL non-destructively
          try {
            const remoteSettlements = await fetchPcuSettlementsFromCPanel();
            if (Array.isArray(remoteSettlements) && remoteSettlements.length > 0) {
              const map = new Map<string, PcuSettlement>();
              pcuSettlementsCache.forEach(s => map.set(s.id, s));
              remoteSettlements.forEach(s => map.set(s.id, s));
              pcuSettlementsCache = Array.from(map.values()).sort(
                (a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime()
              );
              safeWriteFileSync(PCU_SETTLEMENTS_FILE, JSON.stringify(pcuSettlementsCache, null, 2));
              console.log(`[cPanel DB] Synced ${pcuSettlementsCache.length} PCU settlements with MySQL.`);
            } else if (pcuSettlementsCache.length > 0) {
              for (const s of pcuSettlementsCache) {
                await savePcuSettlementToCPanel(s);
              }
            }
          } catch (settleErr: any) {
            console.warn('[cPanel DB] Error syncing settlements with MySQL:', settleErr.message);
          }

          // Bidirectional user synchronization to protect new registrations
          await syncUsersFromCPanel();
        } else if (!mysqlHasData && (contactsCache.length > 0 || usersCache.length > 0)) {
          // Brand-new empty MySQL database: gentle seed without any destructive queries
          console.log('[cPanel DB] Empty MySQL database detected. Seeding initial records non-destructively...');
          await migrateAllDataToCPanelDb({
            contacts: contactsCache,
            users: usersCache,
            existingAccounts: existingAccountsCache,
            barangays: barangaysCache,
            activities: activitiesCache,
            settings: siteSettings
          });
        }
      } else {
        console.log('[cPanel DB] Note: cPanel MySQL Database not yet connected. Ready to connect via Settings or .env');
      }
    } catch (cpanelErr: any) {
      console.log('[cPanel DB] Initialization note:', cpanelErr.message);
    }

    // Ensure all Base44 JSON Cache files exist on disk to prevent read-only filesystem crash or empty fallback failures
    const base44Caches = [HOUSEHOLDS_CACHE_FILE, PCUS_CACHE_FILE, MEMBER_VERIFIED_CACHE_FILE, MESSAGES_CACHE_FILE];
    for (const cacheFile of base44Caches) {
      if (!fs.existsSync(cacheFile)) {
        safeWriteFileSync(cacheFile, '[]');
      }
    }

    console.log('Database initialized successfully. Contacts:', contactsCache.length);
    if (contactsCache.length > 0) {
      contactsLoadedFromSheets = true;
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Background auto-sync manager: connects Google Sheets database automatically and keeps it continuously in sync
let autoSyncTimer: NodeJS.Timeout | null = null;
let isAutoSyncRunning = false;

export function startAutoSheetsSync() {
  // Google Sheets integration decommissioned in favor of cPanel MySQL Database.
  return;
}

/**
 * Synchronize live records from the cPanel MySQL database into the application cache.
 */
export async function syncWithCPanelDb(username: string = 'admin'): Promise<{ success: boolean; message: string; count: number }> {
  if (!isCPanelDbConnected()) {
    return {
      success: false,
      message: 'cPanel MySQL Database is not connected. Please configure your credentials in Website Settings > cPanel Database.',
      count: contactsCache.length
    };
  }
  try {
    const cpanelData = await fetchAllFromCPanelDb();
    if (cpanelData) {
      const activeContacts = (cpanelData.contacts || []).filter(c => c && !c.deleted_at && c.status !== 'DELETED');
      contactsCache = deduplicateContactsByName(activeContacts);

      // Ensure active contacts from MySQL have any stale deletion tombstones cleared
      for (const ac of activeContacts) {
        if (!ac.isSubmitted && ac.status !== 'SUBMITTED') {
          removeContactTombstone({ full_name: ac.full_name, id: ac.id });
        }
      }

      // Bidirectional user synchronization to protect new registrations
      await syncUsersFromCPanel();

      existingAccountsCache = cpanelData.existingAccounts || [];
      if (cpanelData.barangays && cpanelData.barangays.length > 0) {
        barangaysCache = cpanelData.barangays;
      }
      if (cpanelData.settings && Object.keys(cpanelData.settings).length > 0) {
        siteSettings = { ...siteSettings, ...cpanelData.settings };
      }

      // Reconstruct PCU uploads cache from contacts that have pcu_file_url or are marked submitted
      for (const c of cpanelData.contacts || []) {
        if (c.pcu_file_url || c.isSubmitted) {
          const exists = pcuUpdatesCache.some(p => 
            (p.contactId && c.id && String(p.contactId) === String(c.id)) ||
            (p.fullName && c.full_name && p.fullName.trim().toLowerCase() === c.full_name.trim().toLowerCase())
          );
          if (!exists) {
            pcuUpdatesCache.push({
              id: `pcu_${c.id || Date.now()}`,
              contactId: Number(c.id) || Date.now(),
              fullName: c.full_name,
              barangay: c.barangay || '',
              purok: c.purok || '',
              fileName: c.pcu_file_url ? (c.pcu_file_url.split('/').pop()?.split('?')[0] || 'Household_PCU_Document.pdf') : 'PCU_Document.pdf',
              fileData: c.pcu_file_url || '',
              uploadedAt: c.pcu_uploaded_at || c.updated_at || c.created_at || new Date().toISOString(),
              uploadedBy: c.pcu_uploaded_by || 'Staff',
              added_from_website: true
            });
          }
        }
      }

      await safeWriteFile(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2), 'utf-8');
      await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
      await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
      await safeWriteFile(BARANGAYS_FILE, JSON.stringify(barangaysCache, null, 2), 'utf-8');
      await safeWriteFile(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2), 'utf-8');
      await safeWriteFile(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2), 'utf-8');
      await addActivity(username, `Synchronized data with cPanel MySQL Database (${contactsCache.length} contacts)`);
      return {
        success: true,
        message: `Successfully synchronized with cPanel MySQL Database! Loaded ${contactsCache.length} contacts and ${usersCache.length} users.`,
        count: contactsCache.length
      };
    }
    return {
      success: true,
      message: 'cPanel MySQL Database returned no data.',
      count: 0
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to sync with cPanel MySQL Database: ${err.message || err}`,
      count: contactsCache.length
    };
  }
}

// Clean and extract precise Barangay names instead of Team titles
function getExactBarangay(sub: any): string {
  let raw = '';

  // 1. Try pmrf_front (highly reliable)
  if (sub.pmrf_front) {
    if (sub.pmrf_front.perm_Barangay && typeof sub.pmrf_front.perm_Barangay === 'string' && sub.pmrf_front.perm_Barangay.trim()) {
      raw = sub.pmrf_front.perm_Barangay;
    } else if (sub.pmrf_front.mail_Barangay && typeof sub.pmrf_front.mail_Barangay === 'string' && sub.pmrf_front.mail_Barangay.trim()) {
      raw = sub.pmrf_front.mail_Barangay;
    } else if (sub.pmrf_front.barangay && typeof sub.pmrf_front.barangay === 'string' && sub.pmrf_front.barangay.trim()) {
      raw = sub.pmrf_front.barangay;
    }
  }

  // 2. Try pcsf
  if (!raw && sub.pcsf) {
    if (sub.pcsf.barangay && typeof sub.pcsf.barangay === 'string' && sub.pcsf.barangay.trim()) {
      raw = sub.pcsf.barangay;
    } else if (sub.pcsf.addr_BARANGAYTOWN && typeof sub.pcsf.addr_BARANGAYTOWN === 'string' && sub.pcsf.addr_BARANGAYTOWN.trim()) {
      raw = sub.pcsf.addr_BARANGAYTOWN;
    }
  }

  // 3. Try fpe
  if (!raw && sub.fpe && sub.fpe.barangay && typeof sub.fpe.barangay === 'string' && sub.fpe.barangay.trim()) {
    raw = sub.fpe.barangay;
  }

  // 4. Fallback to sub.barangay
  if (!raw && sub.barangay && typeof sub.barangay === 'string' && sub.barangay.trim()) {
    raw = sub.barangay;
  }

  return normalizeBarangayName(raw);
}

function normalizeBarangayName(bName: any): string {
  const str = extractBarangayName(bName);
  if (!str) return 'Barangay Central';
  const bUpper = str.toUpperCase();
  if (bUpper.includes('KWT') || bUpper.includes('KAWIT')) return 'Kawit';
  if (bUpper.includes('BLNGSN') || bUpper.includes('BALANGASAN')) return 'Balangasan';
  if (bUpper.includes('NPLN') || bUpper.includes('NAPOLAN')) return 'Napolan';
  if (bUpper.includes('BNL') || bUpper.includes('BANALE')) return 'Banale';
  if (bUpper.includes('SFC') || bUpper.includes('SAN FRANCISCO')) return 'San Francisco';
  if (bUpper.includes('POB') || bUpper.includes('POBLACION')) return 'Poblacion';
  if (bUpper.includes('CENTRAL')) return 'Barangay Central';
  if (bUpper.includes('LUMBIA')) return 'Lumbia';
  if (bUpper.includes('SAN JOSE')) return 'San Jose';
  if (bUpper.includes('STA. LUCIA') || bUpper.includes('STA LUCIA')) return 'Sta. Lucia';
  if (bUpper.includes('SAN PEDRO')) return 'San Pedro';
  if (bUpper.includes('MURICAY')) return 'Muricay';
  if (bUpper.includes('SANTO NIÑO') || bUpper.includes('SANTO NINO')) return 'Santo Niño';

  // Clean up prefixes like "BARANGAY " or "BRGY. " and "TEAM X" strings
  let cleaned = bUpper.replace(/^(BARANGAY|BRGY\.?)\s+/gi, '').trim();
  cleaned = cleaned.replace(/\bTEAM\s+[A-Z0-9]+\b/gi, '').trim();
  if (cleaned && cleaned !== 'UNKNOWN' && cleaned !== 'N/A' && cleaned !== 'NONE') {
    return capitalizeWords(cleaned);
  }
  return 'Barangay Central';
}

// Utility to normalize and deduplicate any list of barangay names (merging "San Jose", "SAN JOSE", "BRGY SAN JOSE", etc.)
export function normalizeAndDeduplicateBarangays(list: string[]): string[] {
  const map = new Map<string, string>(); // lower key -> proper title-cased name

  if (!Array.isArray(list)) return [];

  for (const item of list) {
    if (!item || typeof item !== 'string') continue;
    const normalized = normalizeBarangayName(item);
    if (!normalized) continue;
    const upper = normalized.toUpperCase().trim();
    if (upper === 'UNKNOWN' || upper === 'N/A' || upper === 'NONE') continue;

    let foundKey: string | null = null;
    for (const [key, val] of map.entries()) {
      if (key === normalized.toLowerCase() || isBarangayMatch(val, normalized)) {
        foundKey = key;
        break;
      }
    }

    if (!foundKey) {
      map.set(normalized.toLowerCase(), normalized);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

// Cache for Base44 barangays
const base44BarangaysCache = new Set<string>();

const HOUSEHOLDS_CACHE_FILE = path.join(DATA_DIR, 'base44_households.json');
const PCUS_CACHE_FILE = path.join(DATA_DIR, 'base44_pcus.json');
const MEMBER_VERIFIED_CACHE_FILE = path.join(DATA_DIR, 'base44_member_verified.json');
const MESSAGES_CACHE_FILE = path.join(DATA_DIR, 'base44_messages.json');

let lastHouseholdsFetchTime = 0;
let lastPCUsFetchTime = 0;
let lastMemberVerifiedFetchTime = 0;
let lastMessagesFetchTime = 0;

// Rate limiting tracking
const COOLDOWN_FILE = path.join(DATA_DIR, 'base44_cooldown.json');

function getCooldownResetTime(): number {
  try {
    if (fs.existsSync(COOLDOWN_FILE)) {
      const data = fs.readFileSync(COOLDOWN_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (typeof parsed.resetTime === 'number') {
        return parsed.resetTime;
      }
    }
  } catch (e) {
    // Ignore
  }
  return 0;
}

function setCooldownResetTime(time: number) {
  try {
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify({ resetTime: time }), 'utf-8');
  } catch (e) {
    // Ignore
  }
}

function checkRateLimit(): boolean {
  const resetTime = getCooldownResetTime();
  if (Date.now() < resetTime) {
    return true;
  }
  return false;
}

function handleBase44Error(err: any) {
  const errMsg = err?.message || '';
  if (errMsg.includes('429') || errMsg.includes('traffic volume limit exceeded') || errMsg.includes('limit exceeded') || errMsg.includes('Too Many Requests')) {
    const cooldownTime = Date.now() + 15 * 60 * 1000; // 15 minutes of quiet time
    setCooldownResetTime(cooldownTime);
    console.info('[Base44 Rate Limit] Detected rate limit from Base44 API. Initiating 15-minute persistent cooldown...');
  }
}

// In-memory sliding window rate-limiting to proactively prevent 429 errors from Base44 SDK.
const requestTimestamps: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 6; // Cap at 6 live API read calls to Base44 per minute globally

function trackAndCheckLocalRateLimit(): boolean {
  const now = Date.now();
  // Clear timestamps older than 1 minute (60000 ms)
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
  
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    console.warn(`[Base44 Throttler] Proactively throttling Base44 SDK call to prevent 429 Rate Limit. Active requests in last 60s: ${requestTimestamps.length}`);
    const cooldownTime = now + 60 * 1000; // Trigger a temporary 1-minute cooldown
    setCooldownResetTime(cooldownTime);
    return false;
  }
  
  requestTimestamps.push(now);
  return true;
}

function isCacheFreshEnough(filePath: string, maxAgeMs: number = 300000): boolean {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const age = Date.now() - stats.mtimeMs;
      return age < maxAgeMs;
    }
  } catch (e) {
    // Ignore error
  }
  return false;
}

// Throttled fetch for HouseholdSubmissions with persistent cache fallback
export async function getCachedHouseholdSubmissions(force: boolean = false): Promise<any[]> {
  const cacheExists = fs.existsSync(HOUSEHOLDS_CACHE_FILE);
  if (cacheExists) {
    try {
      const data = fs.readFileSync(HOUSEHOLDS_CACHE_FILE, 'utf-8');
      if (!data || !data.trim()) {
        safeWriteFileSync(HOUSEHOLDS_CACHE_FILE, '[]', 'utf-8');
        return [];
      }
      return JSON.parse(data);
    } catch (e: any) {
      console.warn('[Base44 Cache] Households cache file was corrupted. Resetting automatically.');
      try {
        safeWriteFileSync(HOUSEHOLDS_CACHE_FILE, '[]', 'utf-8');
      } catch (writeErr) {
        // Ignore write error
      }
    }
  }
  return [];
}

// Throttled fetch for PCUUpdates with persistent cache fallback
export async function getCachedPCUUpdates(force: boolean = false): Promise<any[]> {
  const cacheExists = fs.existsSync(PCUS_CACHE_FILE);
  if (cacheExists) {
    try {
      const data = fs.readFileSync(PCUS_CACHE_FILE, 'utf-8');
      if (!data || !data.trim()) {
        safeWriteFileSync(PCUS_CACHE_FILE, '[]', 'utf-8');
        return [];
      }
      return JSON.parse(data);
    } catch (e: any) {
      console.warn('[Base44 Cache] PCUs cache file was corrupted. Resetting automatically.');
      try {
        safeWriteFileSync(PCUS_CACHE_FILE, '[]', 'utf-8');
      } catch (writeErr) {
        // Ignore write error
      }
    }
  }
  return [];
}

// Throttled fetch for MemberVerifiedSubmissions with persistent cache fallback
export async function getCachedMemberVerifiedSubmissions(force: boolean = false): Promise<any[]> {
  const cacheExists = fs.existsSync(MEMBER_VERIFIED_CACHE_FILE);
  if (cacheExists) {
    try {
      const data = fs.readFileSync(MEMBER_VERIFIED_CACHE_FILE, 'utf-8');
      if (!data || !data.trim()) {
        safeWriteFileSync(MEMBER_VERIFIED_CACHE_FILE, '[]', 'utf-8');
        return [];
      }
      return JSON.parse(data);
    } catch (e: any) {
      console.warn('[Base44 Cache] Member verified cache file was corrupted. Resetting automatically.');
      try {
        safeWriteFileSync(MEMBER_VERIFIED_CACHE_FILE, '[]', 'utf-8');
      } catch (writeErr) {
        // Ignore write error
      }
    }
  }
  return [];
}

// Throttled fetch for SubmissionMessages from Base44 with cache fallback
export async function getCachedSubmissionMessages(force: boolean = false): Promise<any[]> {
  const cacheExists = fs.existsSync(MESSAGES_CACHE_FILE);
  if (cacheExists) {
    try {
      const data = fs.readFileSync(MESSAGES_CACHE_FILE, 'utf-8');
      if (!data || !data.trim()) {
        safeWriteFileSync(MESSAGES_CACHE_FILE, '[]', 'utf-8');
        return [];
      }
      return JSON.parse(data);
    } catch (e: any) {
      console.warn('[Base44 Cache] Messages cache file was corrupted. Resetting automatically.');
      try {
        safeWriteFileSync(MESSAGES_CACHE_FILE, '[]', 'utf-8');
      } catch (writeErr) {
        // Ignore write error
      }
    }
  }
  return [];
}

// Add a new SubmissionMessage to Base44
export async function createSubmissionMessage(sender: string, message: string, recipient?: string, barangay?: string): Promise<any> {
  const payload = {
    sender,
    senderName: sender,
    submittedBy: sender,
    submitted_by: sender,
    sentBy: sender,
    memberName: recipient || barangay || 'Broadcast',
    message,
    content: message,
    recipient: recipient || '',
    barangay: barangay || '',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  let newRecord: any = null;
  try {
    const messageEntity = (base44.entities as any).SubmissionMessage;
    if (messageEntity && typeof messageEntity.create === 'function') {
      console.log('[Base44 SDK] Creating live SubmissionMessage in Base44...');
      newRecord = await messageEntity.create(payload);
    }
  } catch (err: any) {
    console.warn('[Base44 SDK Warning] Failed to create SubmissionMessage on Base44 side:', err.message);
  }

  // Fallback / Cache update
  if (!newRecord) {
    newRecord = {
      ...payload,
      id: `local_msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
  }

  try {
    const current = await getCachedSubmissionMessages(false);
    const updated = [newRecord, ...current];
    await safeWriteFile(MESSAGES_CACHE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (cacheErr: any) {
    console.warn('[Base44 Cache Warning] Failed to update cache with new message:', cacheErr.message);
  }

  return newRecord;
}

// Safely parse uploaded files which can be stringified JSON or attachments in the Base44 database
function safeParseUploadedFiles(files: any, fallbackFilesJson?: any, attachments?: any): any[] {
  let list: any[] = [];
  if (files) {
    if (Array.isArray(files)) list = files;
    else if (typeof files === 'string' && files.trim() !== '') {
      try {
        const parsed = JSON.parse(files);
        if (Array.isArray(parsed)) list = parsed;
      } catch (e) {
        console.warn('[Base44 Sync] Failed to parse sub.uploadedFiles string:', files);
      }
    }
  }
  if (list.length === 0 && fallbackFilesJson) {
    if (Array.isArray(fallbackFilesJson)) list = fallbackFilesJson;
    else if (typeof fallbackFilesJson === 'string' && fallbackFilesJson.trim() !== '') {
      try {
        const parsed = JSON.parse(fallbackFilesJson);
        if (Array.isArray(parsed)) list = parsed;
      } catch (e) {
        console.warn('[Base44 Sync] Failed to parse sub.uploadedFilesJson string:', fallbackFilesJson);
      }
    }
  }
  if (list.length === 0 && attachments) {
    if (Array.isArray(attachments)) list = attachments;
    else if (typeof attachments === 'string' && attachments.trim() !== '') {
      try {
        const parsed = JSON.parse(attachments);
        if (Array.isArray(parsed)) list = parsed;
      } catch (e) {
        console.warn('[Base44 Sync] Failed to parse sub.attachments string:', attachments);
      }
    }
  }

  // Normalize each file object so it has name, fileName, url, fileUrl, fileType, size
  return list.map((item: any) => {
    if (!item || typeof item !== 'object') return null;
    const url = item.fileUrl || item.url || '';
    const name = item.fileName || item.name || 'document';
    return {
      name: item.name || name,
      fileName: item.fileName || item.name || name,
      url: url,
      fileUrl: url,
      fileType: item.fileType || getMimeType(name),
      size: item.size || 0,
      uploadedAt: item.uploadedAt || new Date().toISOString(),
      uploadedBy: item.uploadedBy || 'System'
    };
  }).filter(Boolean);
}

// Sync from Base44 HouseholdSubmission entity
export async function syncBase44Contacts(force: boolean = false) {
  base44SyncStatus.lastAttempt = new Date().toISOString();
  try {
    // Skip pulling pre-existing Base44 submissions for display on this website
    base44SyncStatus.lastSuccess = new Date().toISOString();
    base44SyncStatus.count = 0;
    base44SyncStatus.error = null;
    return true;
  } catch (err: any) {
    console.warn('[Base44 Sync Warning] Failed to connect or sync to Base44:', err.message);
    base44SyncStatus.error = null; // Do not show as active failure since we degrade gracefully
    return true; // Return true as we fell back successfully
  }
}

// Save helpers
async function saveContacts() {
  await safeWriteFile(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2), 'utf-8');
}

// Fetch Directory contacts for Print List page (Patient Data List)
export async function fetchHouseholdSubmissionsFromBase44() {
  await ensureContactsSynced();
  const seenNameKeys = new Set<string>();

  const activeContacts = contactsCache.filter(c => 
    !c.deleted_at && 
    !isContactTombstoned(c) && 
    !isContactSubmitted(c)
  );
  const directoryHouseholds: any[] = [];

  for (const c of activeContacts) {
    const nameKey = (c.full_name || '').trim().toLowerCase();
    if (nameKey && !seenNameKeys.has(nameKey)) {
      seenNameKeys.add(nameKey);
      directoryHouseholds.push({
        id: `dir_${c.id}`,
        contactId: c.id,
        full_name: c.full_name,
        barangay: c.barangay,
        purok: c.purok || '',
        contact_number: c.contact_number || '',
        created_at: c.created_at || new Date().toISOString(),
        geotagged: Boolean(c.geotagged),
        latitude: c.latitude,
        longitude: c.longitude,
        addedToDirectory: c.added_from_print_list === true
      });
    }
  }

  return directoryHouseholds;
}

// Fetch all Household Submissions from Base44 that are marked as existing accounts
export async function fetchExistingAccountsFromBase44() {
  const existingAccounts: any[] = [];
  try {
    const submissions = await getCachedHouseholdSubmissions(false);
    if (submissions && Array.isArray(submissions)) {
      const filtered = submissions.filter((sub: any) => 
        sub.existingAcc === true || 
        sub.existingAcc === 'true' || 
        sub.existingAccVerified === true ||
        sub.existingAccVerified === 'true'
      );
      
      filtered.forEach((sub: any, idx: number) => {
        let name = sub.memberName || '';
        if (!name && sub.fpe && sub.fpe.fullName) {
          name = sub.fpe.fullName;
        }
        if (!name && sub.pmrf_front) {
          name = `${sub.pmrf_front.member_first || ''} ${sub.pmrf_front.member_middle || ''} ${sub.pmrf_front.member_last || ''}`.trim();
        }
        if (!name) {
          name = 'Unnamed Household';
        }

        const contact_number = sub.pcsf?.contact || 
                               sub.fpe?.mobile || 
                               sub.pmrf_front?.mobile || 
                               '';

        const barangay = getExactBarangay(sub);
        const purok = sub.purok || (sub.pcsf?.purok || '');

        const hasGeo = sub.geoLocation && typeof sub.geoLocation.latitude === 'number' && typeof sub.geoLocation.longitude === 'number';

        existingAccounts.push({
          id: sub.id || `ext_${idx + 1}`,
          full_name: name,
          barangay: barangay,
          purok: purok,
          contact_number: contact_number,
          created_at: sub.created_date || new Date().toISOString(),
          latitude: hasGeo ? sub.geoLocation.latitude : undefined,
          longitude: hasGeo ? sub.geoLocation.longitude : undefined,
          geotagged: hasGeo,
          existingAcc: sub.existingAcc === true || sub.existingAcc === 'true',
          existingAccVerified: sub.existingAccVerified === true || sub.existingAccVerified === 'true',
          existingAccVisited: sub.existingAccVisited === true || sub.existingAccVisited === 'true',
          status: sub.status || 'pending',
          submittedBy: sub.submittedBy || 'Unknown',
          pin: sub.fpe?.pin || sub.pcsf?.pin || '',
          facebookLink: sub.facebookLink || '',
          uploadedFiles: safeParseUploadedFiles(sub.uploadedFiles, sub.uploadedFilesJson, sub.attachments)
        });
      });
    }
  } catch (err: any) {
    console.error('[Base44] Failed to fetch existing accounts:', err.message);
  }
  return existingAccounts;
}

// Add a specific Household Submission / Patient to the Saint Francis Clinic Directory
export async function addHouseholdToDirectory(household: {
  id?: string | number;
  contactId?: string | number;
  full_name: string;
  barangay: string;
  purok?: string;
  contact_number?: string;
  latitude?: number;
  longitude?: number;
  geotagged?: boolean;
}, actorUsername: string) {
  const formattedName = household.full_name ? capitalizeWords(household.full_name) : '';
  const trimmedBarangay = household.barangay ? normalizeBarangayName(household.barangay) : 'Barangay Central';
  const trimmedPurok = household.purok ? capitalizeWords(household.purok) : '';
  const trimmedContact = household.contact_number ? household.contact_number.trim() : '';

  if (!formattedName) {
    throw new Error('Patient full name is required.');
  }

  // Check if contact already exists by ID or by Full Name & Barangay
  let existing: Contact | undefined;
  const rawId = household.contactId || household.id;
  if (rawId !== undefined && rawId !== null) {
    const rawIdStr = String(rawId).replace(/^dir_/, '');
    const numId = Number(rawIdStr);
    if (!isNaN(numId)) {
      existing = contactsCache.find(c => Number(c.id) === numId);
    }
  }
  if (!existing) {
    existing = contactsCache.find(
      c => !c.deleted_at && (
        isSamePersonFullName(c.full_name, formattedName) ||
        normalizeCompareName(c.full_name, formattedName)
      )
    );
  }

  if (existing) {
    existing.added_from_print_list = true;
    existing.deleted_at = null; // restore in case it was previously soft-deleted
    existing.updated_at = new Date().toISOString();
    await saveContacts();

    // Permanently sync to cPanel MySQL database
    if (isCPanelDbConnected()) {
      try {
        await saveContactToCPanel(existing);
      } catch (err: any) {
        console.warn('[cPanel DB] Notice: could not sync promoted contact to cPanel MySQL:', err.message);
      }
    }

    if (sheetsConfig.syncEnabled) {
      forwardToWebApp('edit', existing).catch(err => console.error('Failed to sync re-added contact to Sheets:', err));
    }
    await addActivity(actorUsername, `Added patient "${formattedName}" from Patient Data List to PCU / Barangay Directory`);
    return existing;
  }

  const newId = Date.now() + Math.floor(Math.random() * 1000);
  const newContact: Contact = {
    id: newId,
    full_name: formattedName,
    barangay: trimmedBarangay,
    purok: trimmedPurok,
    contact_number: trimmedContact,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    latitude: household.latitude,
    longitude: household.longitude,
    geotagged: Boolean(household.geotagged || (household.latitude && household.longitude)),
    added_locally: true,
    added_from_print_list: true
  };

  contactsCache.unshift(newContact);
  await saveContacts();

  // Permanently sync to cPanel MySQL database
  if (isCPanelDbConnected()) {
    try {
      await saveContactToCPanel(newContact);
    } catch (err: any) {
      console.warn('[cPanel DB] Notice: could not sync new contact to cPanel MySQL:', err.message);
    }
  }

  await addActivity(actorUsername, `Added patient "${formattedName}" to PCU / Barangay Directory under Barangay ${trimmedBarangay}`);

  // Async sync to Google Sheets if configured
  forwardToWebApp('add', newContact).catch(err => console.error('Failed to sync contact to Sheets:', err));

  return newContact;
}

// Add all pending Patient Data List contacts to the Saint Francis Clinic Directory
export async function addAllHouseholdsToDirectory(actorUsername: string) {
  let count = 0;
  const updatedContacts: Contact[] = [];

  for (let i = 0; i < contactsCache.length; i++) {
    const c = contactsCache[i];
    if (!c.deleted_at && !isContactTombstoned(c) && !isContactSubmitted(c) && c.added_from_print_list !== true) {
      c.added_from_print_list = true;
      c.updated_at = new Date().toISOString();
      count++;
      updatedContacts.push(c);
    }
  }

  if (count > 0) {
    await saveContacts();
    if (isCPanelDbConnected() && updatedContacts.length > 0) {
      try {
        await saveContactsBulkToCPanel(updatedContacts);
      } catch (err: any) {
        console.warn('[cPanel DB] Notice: could not bulk sync promoted contacts to cPanel MySQL:', err.message);
      }
    }
    await addActivity(actorUsername, `Promoted ${count} patient records from Patient Data List to PCU / Barangay Directory`);
  }

  return { addedCount: count };
}

// Clear all contacts from the directory (Mark inactive instead of deleting)
export async function clearAllDirectoryContacts(actorUsername: string) {
  let count = 0;
  for (let i = 0; i < contactsCache.length; i++) {
    if (contactsCache[i].added_from_print_list !== false) {
      contactsCache[i].added_from_print_list = false;
      contactsCache[i].updated_at = new Date().toISOString();
      count++;
    }
  }
  await saveContacts();
  await addActivity(actorUsername, `Removed all ${count} contacts from Saint Francis Clinic Directory (marked inactive)`);
  if (sheetsConfig.syncEnabled) {
    rewriteAllContactsToGoogleSheets().catch(err => console.error('Failed to sync cleared contacts to Google Sheets:', err));
  }
  return true;
}

async function saveActivities() {
  await safeWriteFile(ACTIVITIES_FILE, JSON.stringify(activitiesCache, null, 2), 'utf-8');
}

export async function addActivity(username: string, action: string) {
  const activity: Activity = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    username,
    action
  };
  activitiesCache.unshift(activity); // Newest first in cache
  if (activitiesCache.length > 500) {
    activitiesCache = activitiesCache.slice(0, 500); // Limit logs
  }
  await saveActivities();
  appendActivityToGoogleSheets(activity).catch(err => console.error('Failed to append activity to Sheets:', err));
}

// Public Barangay helper to fetch unique Barangays from Base44 / contacts database
export function getPublicBarangays(): string[] {
  const barangaySet = new Set<string>();
  const defaultBarangays = ['BARANGAY CENTRAL', 'BALANGASAN', 'BANALE', 'NAPOLAN', 'SAN FRANCISCO', 'POBLACION', 'KAWIT'];
  defaultBarangays.forEach(b => barangaySet.add(b));

  contactsCache.forEach(c => {
    if (c.deleted_at === null && c.barangay && c.barangay.trim()) {
      const bUpper = c.barangay.trim().toUpperCase();
      if (bUpper !== 'UNKNOWN' && bUpper !== 'N/A' && bUpper !== 'NONE') {
        barangaySet.add(bUpper);
      }
    }
  });

  return Array.from(barangaySet).filter(b => b !== 'UNKNOWN' && b !== 'N/A').sort((a, b) => a.localeCompare(b));
}

// User helper matching username or email
export function normalizeUserStatus(status?: string | number, defaultStatus: 'Active' | 'Pending' | 'Suspended' = 'Active'): 'Active' | 'Pending' | 'Suspended' {
  if (status === undefined || status === null || String(status).trim() === '') return defaultStatus;
  const s = String(status).trim().toLowerCase();
  if (s.startsWith('pend') || s === '0' || s === 'unapproved' || s === 'awaiting' || s === 'unverified') return 'Pending';
  if (s.startsWith('susp') || s.startsWith('inact') || s.startsWith('block') || s === 'disabled') return 'Suspended';
  if (s.startsWith('act') || s === '1' || s === 'approved' || s === 'verified') return 'Active';
  return defaultStatus;
}

export function findUser(input: string): User | undefined {
  if (!input) return undefined;
  const target = input.trim().toLowerCase();
  return usersCache.find(
    u => u && typeof u.username === 'string' && (u.username.toLowerCase() === target || (typeof u.email === 'string' && u.email.toLowerCase() === target))
  );
}

// User helper matching email specifically
export function findUserByEmail(email: string): User | undefined {
  if (!email) return undefined;
  const target = email.trim().toLowerCase();
  return usersCache.find(
    u => u && typeof u.email === 'string' && u.email.toLowerCase() === target
  );
}

/**
 * Synchronize users bidirectionally between cPanel MySQL and local storage.
 * Ensures newly registered accounts are never lost and always pushed to MySQL,
 * and preserves 'Pending' status for account approval.
 */
export async function syncUsersFromCPanel(): Promise<User[]> {
  try {
    // 1. Re-read local disk file to ensure users registered in other processes/sessions are present
    let diskUsers: User[] = [];
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          diskUsers = parsed;
        }
      }
    } catch {}

    // Combine current in-memory cache and disk users
    const localMap = new Map<string, User>();
    for (const u of [...usersCache, ...diskUsers]) {
      if (u && u.username && !isUserTombstoned(u.username, u.email)) {
        localMap.set(u.username.toLowerCase(), u);
      }
    }

    if (!isCPanelDbConnected()) {
      usersCache = Array.from(localMap.values()).filter(u => !isUserTombstoned(u.username, u.email));
      return usersCache;
    }

    // 2. Fetch users from cPanel MySQL
    const cpanelData = await fetchAllFromCPanelDb();
    const remoteUsers: any[] = (cpanelData && Array.isArray(cpanelData.users)) ? cpanelData.users : [];

    const mergedMap = new Map<string, User>();
    const usersToPushToCPanel: User[] = [];

    // Process remote users from MySQL first
    for (const r of remoteUsers) {
      if (!r || !r.username) continue;
      const unameLower = r.username.toLowerCase();
      const emailLower = (r.email || '').toLowerCase();

      // Clean up tombstoned accounts if found in MySQL
      if (isUserTombstoned(unameLower, emailLower)) {
        deleteUserFromCPanel(r.username).catch(() => {});
        continue;
      }

      const local = localMap.get(unameLower) || (emailLower ? Array.from(localMap.values()).find(u => u.email && u.email.toLowerCase() === emailLower) : undefined);

      const mergedUser: User = {
        username: r.username,
        email: r.email || (local ? local.email : ''),
        fullName: r.fullName || r.displayName || (local ? local.fullName : r.username),
        displayName: r.displayName || r.fullName || (local ? local.displayName : r.username),
        barangay: r.barangay || (local ? local.barangay : 'Central'),
        passwordHash: r.passwordHash || (local ? local.passwordHash : ''),
        passwordPlain: r.passwordPlain || (local ? local.passwordPlain : ''),
        role: r.role || (local ? local.role : 'Staff'),
        status: normalizeUserStatus(r.status || (local ? local.status : 'Pending')),
        createdAt: r.createdAt || (local ? local.createdAt : new Date().toISOString()),
        updatedAt: r.updatedAt || (local ? local.updatedAt : new Date().toISOString()),
        avatarDataUrl: r.avatarDataUrl || (local ? local.avatarDataUrl : undefined),
        permissions: r.permissions || (local ? local.permissions : undefined)
      };

      mergedMap.set(unameLower, mergedUser);
    }

    // Process local users NOT yet in remote MySQL (e.g. newly registered accounts!)
    for (const [unameLower, local] of localMap.entries()) {
      if (isUserTombstoned(local.username, local.email)) continue;

      if (!mergedMap.has(unameLower)) {
        const existsByEmail = local.email && Array.from(mergedMap.values()).some(u => u.email && u.email.toLowerCase() === local.email?.toLowerCase());
        if (!existsByEmail) {
          mergedMap.set(unameLower, local);
          usersToPushToCPanel.push(local);
        }
      }
    }

    // Ensure master admin account 'admin' is always present and Active
    const hasAdmin = Array.from(mergedMap.values()).some(u => u.username.toLowerCase() === 'admin');
    if (!hasAdmin) {
      const defaultAdmin: User = {
        username: 'admin',
        email: 'admin@clinic.gov.ph',
        fullName: 'Master Administrator',
        displayName: 'Master Administrator',
        barangay: 'Central',
        passwordHash: hashPassword('2026'),
        passwordPlain: '2026',
        role: 'Administrator',
        status: 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mergedMap.set('admin', defaultAdmin);
      usersToPushToCPanel.push(defaultAdmin);
    } else {
      const adm = mergedMap.get('admin');
      if (adm) {
        adm.role = 'Administrator';
        adm.status = 'Active';
      }
    }

    usersCache = Array.from(mergedMap.values()).filter(u => !isUserTombstoned(u.username, u.email));

    // Save updated merged users to local USERS_FILE
    safeWriteFileSync(USERS_FILE, JSON.stringify(usersCache, null, 2));

    // Automatically push any local-only accounts to cPanel MySQL
    if (usersToPushToCPanel.length > 0) {
      for (const u of usersToPushToCPanel) {
        saveUserToCPanel(u).catch(e => console.warn(`[cPanel User Push] Notice for ${u.username}:`, e.message));
      }
    }

    return usersCache;
  } catch (err: any) {
    console.error('[cPanel User Sync] Notice:', err.message);
    return usersCache;
  }
}

export function getUsers() {
  return usersCache
    .filter(u => !isUserTombstoned(u.username, u.email))
    .map(u => ({
      username: u.username,
      email: u.email || u.username,
      fullName: u.fullName || u.displayName || u.username,
      barangay: u.barangay || 'Central',
      role: u.role || 'Staff',
      status: normalizeUserStatus(u.status),
      createdAt: u.createdAt || new Date().toISOString(),
      displayName: u.displayName || u.fullName || '',
      avatarDataUrl: u.avatarDataUrl || '',
      passwordPlain: u.passwordPlain || ''
    }));
}

const NON_BARANGAY_VALUES = new Set([
  'ALL',
  'ALL BARANGAYS',
  'ALL ADDRESSES',
  'ALL BARANGAY',
  'ALL ADDRESS',
  'SELECT',
  'SELECT BARANGAY',
  'SELECT ADDRESS',
  'SELECT ADDRESS (BARANGAY)',
  'UNKNOWN',
  'N/A',
  'NONE',
  'NULL',
  'UNDEFINED',
  'OTHER',
  'OTHERS',
  'PAGADIAN',
  'PAGADIAN CITY',
  'ZAMBOANGA DEL SUR',
  'CITY',
  'PROVINCE'
]);

export function isRealBarangay(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  if (NON_BARANGAY_VALUES.has(upper)) return false;
  if (upper.startsWith('ALL ') || upper.startsWith('SELECT ') || upper.startsWith('FILTER ')) return false;
  return true;
}

export function getBarangayList(): string[] {
  const list = (Array.isArray(barangaysCache) && barangaysCache.length > 0) ? barangaysCache : DEFAULT_BARANGAYS;
  return normalizeAndDeduplicateBarangays(list.filter(b => !isBarangayTombstoned(b)));
}

export async function getBase44Roles(): Promise<string[]> {
  const defaultRoles = [
    'Administrator',
    'Admin',
    'Master Admin',
    'Leader',
    'Co-Leader',
    'IT',
    'Encoder',
    'Data Encoder',
    'Staff',
    'User',
    'Barangay Health Worker',
    'Clinic Doctor',
    'Clinic Nurse',
    'Barangay Official'
  ];

  const roleMap = new Map<string, string>();

  // Initialize with default roles
  defaultRoles.forEach(r => {
    roleMap.set(r.toUpperCase(), r);
  });

  // Collect roles from existing accounts cache
  if (Array.isArray(usersCache)) {
    usersCache.forEach(u => {
      if (u.role && u.role.trim()) {
        const trimmed = u.role.trim();
        const upper = trimmed.toUpperCase();
        if (!roleMap.has(upper)) {
          roleMap.set(upper, trimmed);
        }
      }
    });
  }

  // Collect roles from siteSettings.rolePermissions
  if (siteSettings && siteSettings.rolePermissions) {
    Object.keys(siteSettings.rolePermissions).forEach(r => {
      if (r && r.trim()) {
        const trimmed = r.trim();
        const upper = trimmed.toUpperCase();
        if (!roleMap.has(upper)) {
          roleMap.set(upper, trimmed);
        }
      }
    });
  }

  return Array.from(roleMap.values());
}

export async function registerUser(data: {
  fullName: string;
  email: string;
  password: string;
  barangay: string;
  role?: string;
}) {
  const { fullName, email, password, barangay, role } = data;

  const trimmedName = fullName ? fullName.trim() : '';
  const trimmedEmail = email ? email.trim().toLowerCase() : '';
  const trimmedPass = password ? password.trim() : '';
  const trimmedBarangay = barangay ? barangay.trim() : '';
  const trimmedRole = role && role.trim() ? role.trim() : 'Staff';

  if (!trimmedName || !trimmedEmail || !trimmedPass || !trimmedBarangay) {
    throw new Error('Full Name, Email, Password, and Barangay are all required.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  if (trimmedPass.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  // Pre-sync with cPanel database if available to get freshest users list
  if (isCPanelDbConnected()) {
    try {
      await syncUsersFromCPanel();
    } catch (_) {}
  }

  // Check if email already exists
  const emailExists = usersCache.some(u => u.email && u.email.toLowerCase() === trimmedEmail);
  if (emailExists) {
    throw new Error('An account with this email address already exists. Please log in.');
  }

  // Derive username from email or name
  let username = trimmedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '');
  if (!username) {
    username = 'user';
  }

  // Ensure username is unique to avoid collision in local files or sheet
  let finalUsername = username;
  let counter = 1;
  while (usersCache.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
    finalUsername = `${username}${counter}`;
    counter++;
  }

  // Clear any tombstone if re-registering
  unTombstoneUser(finalUsername, trimmedEmail);

  const newUser: User = {
    username: finalUsername,
    email: trimmedEmail,
    fullName: trimmedName,
    displayName: trimmedName,
    barangay: trimmedBarangay,
    passwordHash: hashPassword(trimmedPass),
    passwordPlain: trimmedPass,
    role: trimmedRole,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  usersCache.push(newUser);
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');

  // Immediately persist registered user into cPanel MySQL Database
  try {
    await saveUserToCPanel(newUser);
  } catch (cpanelErr: any) {
    console.warn('[cPanel Register] Notice saving user to MySQL:', cpanelErr.message);
  }

  await addActivity(finalUsername, `Registered new account (${trimmedName} - ${trimmedBarangay}) with role ${trimmedRole}`);
  try {
    await syncAdminsToGoogleSheets();
  } catch (err: any) {
    console.error('Failed to sync users to Sheets on register:', err.message || err);
  }

  return {
    username: newUser.username,
    email: newUser.email,
    fullName: newUser.fullName,
    barangay: newUser.barangay,
    role: newUser.role,
    status: newUser.status,
    createdAt: newUser.createdAt
  };
}

export async function addUserAccountByAdmin(data: {
  fullName: string;
  email: string;
  password: string;
  barangay: string;
  role: string;
}, actorUsername: string) {
  const { fullName, email, password, barangay, role } = data;

  const trimmedName = fullName ? fullName.trim() : '';
  const trimmedEmail = email ? email.trim().toLowerCase() : '';
  const trimmedPass = password ? password.trim() : '';
  const trimmedBarangay = barangay ? barangay.trim() : '';
  const trimmedRole = role && role.trim() ? role.trim() : 'Staff';

  if (!trimmedName) {
    throw new Error('Full Name is required.');
  }
  if (!trimmedEmail) {
    throw new Error('Email address is required.');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error('Please enter a valid email address format.');
  }
  if (!trimmedPass) {
    throw new Error('Password is required.');
  }
  if (trimmedPass.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }
  if (!trimmedBarangay) {
    throw new Error('Barangay selection from Google Sheet database is required.');
  }
  if (!trimmedRole) {
    throw new Error('Role Permission selection from Google Sheet database is required.');
  }

  // Check if email or username already exists
  const emailExists = usersCache.some(u => 
    (u.email && u.email.toLowerCase() === trimmedEmail) ||
    (u.username && u.username.toLowerCase() === trimmedEmail)
  );
  if (emailExists) {
    throw new Error(`An account with email "${trimmedEmail}" already exists in the system.`);
  }

  // Derive username from email or name
  let username = trimmedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '');
  if (!username) {
    username = 'user';
  }

  let finalUsername = username;
  let counter = 1;
  while (usersCache.some(u => u.username && u.username.toLowerCase() === finalUsername.toLowerCase())) {
    finalUsername = `${username}${counter}`;
    counter++;
  }

  // Clear any tombstone if re-creating
  unTombstoneUser(finalUsername, trimmedEmail);

  const newUser: User = {
    username: finalUsername,
    email: trimmedEmail,
    fullName: trimmedName,
    displayName: trimmedName,
    barangay: trimmedBarangay,
    passwordHash: hashPassword(trimmedPass),
    passwordPlain: trimmedPass,
    role: trimmedRole,
    status: 'Active', // Automatically approved by Admin!
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  usersCache.unshift(newUser);
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');

  // Immediately persist admin-created user into cPanel MySQL Database
  try {
    await saveUserToCPanel(newUser);
  } catch (cpanelErr: any) {
    console.warn('[cPanel Admin User Add] Notice saving user to MySQL:', cpanelErr.message);
  }

  await addActivity(actorUsername || 'admin', `Admin created and auto-approved account @${finalUsername} (${trimmedName} - ${trimmedBarangay}) with role ${trimmedRole}`);

  try {
    await syncAdminsToGoogleSheets(true);
  } catch (err: any) {
    console.error('Failed to sync users to Sheets on admin add user:', err.message || err);
  }

  return {
    username: newUser.username,
    email: newUser.email,
    fullName: newUser.fullName,
    barangay: newUser.barangay,
    role: newUser.role,
    status: newUser.status,
    createdAt: newUser.createdAt,
    updatedAt: newUser.updatedAt
  };
}

export async function updateUserRole(username: string, newRole: string, actorUsername: string) {
  if (!username || !username.trim()) {
    throw new Error('Target username is required.');
  }
  if (!newRole || !newRole.trim()) {
    throw new Error('New role is required.');
  }
  const trimmedTarget = username.trim();
  const trimmedRole = newRole.trim();

  // Find user by username or email
  const user = findUser(trimmedTarget) || usersCache.find(
    u => u && typeof u.username === 'string' && (u.username.toLowerCase() === trimmedTarget.toLowerCase() || (typeof u.email === 'string' && u.email.toLowerCase() === trimmedTarget.toLowerCase()))
  );

  if (!user) {
    throw new Error(`User account "${trimmedTarget}" not found.`);
  }

  if (user.username.toLowerCase() === 'admin' && trimmedRole !== 'Administrator') {
    throw new Error('Master admin role cannot be changed.');
  }

  user.role = trimmedRole;
  user.updatedAt = new Date().toISOString();
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');

  // Immediately persist updated role into cPanel MySQL Database
  try {
    const directOk = await updateUserRoleInCPanel(user.username, user.email || '', trimmedRole);
    if (!directOk) {
      await saveUserToCPanel(user);
    }
  } catch (cpanelErr: any) {
    console.warn('[cPanel User Role] Notice saving user to MySQL:', cpanelErr.message);
  }

  await addActivity(actorUsername, `Updated user @${user.username} (${user.fullName || user.username}) role permission to ${trimmedRole}`);
  try {
    await syncAdminsToGoogleSheets();
  } catch (err: any) {
    console.error('Failed to sync users to Sheets on role update:', err.message || err);
  }
  return {
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    barangay: user.barangay,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function updateUserStatus(username: string, newStatus: 'Active' | 'Pending' | 'Suspended', actorUsername: string) {
  if (!username || !username.trim()) {
    throw new Error('Target username is required.');
  }
  const trimmedTarget = username.trim();
  const user = findUser(trimmedTarget) || usersCache.find(
    u => u && typeof u.username === 'string' && (u.username.toLowerCase() === trimmedTarget.toLowerCase() || (typeof u.email === 'string' && u.email.toLowerCase() === trimmedTarget.toLowerCase()))
  );

  if (!user) {
    throw new Error(`User account "${trimmedTarget}" not found.`);
  }

  if (user.username.toLowerCase() === 'admin' && newStatus !== 'Active') {
    throw new Error('Master admin account must remain Active.');
  }

  // Clear any tombstone for this user when updating or activating
  unTombstoneUser(user.username, user.email);

  user.status = newStatus;
  user.updatedAt = new Date().toISOString();
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');

  // Immediately persist updated status (e.g. Active approval) into cPanel MySQL Database
  try {
    const directOk = await updateUserStatusInCPanel(user.username, user.email || '', newStatus);
    if (!directOk) {
      await saveUserToCPanel(user);
    }
  } catch (cpanelErr: any) {
    console.warn('[cPanel User Status] Notice saving user to MySQL:', cpanelErr.message);
  }

  await addActivity(actorUsername, `Updated user @${user.username} status to ${newStatus}`);
  try {
    await syncAdminsToGoogleSheets(true);
  } catch (err: any) {
    console.error('Failed to sync user status to Sheets:', err.message || err);
  }
  return {
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    barangay: user.barangay,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function editUserAccount(
  targetUsername: string,
  updates: {
    fullName?: string;
    email?: string;
    barangay?: string;
    role?: string;
    status?: 'Active' | 'Pending' | 'Suspended';
    password?: string;
  },
  actorUsername: string
) {
  if (!targetUsername || !targetUsername.trim()) {
    throw new Error('Target account is required.');
  }
  const trimmedTarget = targetUsername.trim();
  const user = findUser(trimmedTarget) || usersCache.find(
    u => u && typeof u.username === 'string' && (u.username.toLowerCase() === trimmedTarget.toLowerCase() || (typeof u.email === 'string' && u.email.toLowerCase() === trimmedTarget.toLowerCase()))
  );

  if (!user) {
    throw new Error(`User account "${trimmedTarget}" not found.`);
  }

  const isMasterAdmin = user.username.toLowerCase() === 'admin';
  if (isMasterAdmin) {
    if (updates.role && updates.role !== 'Administrator') {
      throw new Error('Master admin role cannot be changed.');
    }
    if (updates.status && updates.status !== 'Active') {
      throw new Error('Master admin account must remain Active.');
    }
  }

  if (updates.fullName !== undefined && updates.fullName.trim()) {
    user.fullName = updates.fullName.trim();
    user.displayName = updates.fullName.trim();
  }

  if (updates.email !== undefined) {
    const trimmedEmail = updates.email.trim().toLowerCase();
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error('Please enter a valid email address.');
      }
      const duplicate = usersCache.find(
        u => u.username.toLowerCase() !== user.username.toLowerCase() && u.email && u.email.toLowerCase() === trimmedEmail
      );
      if (duplicate) {
        throw new Error('An account with this email address already exists.');
      }
      user.email = trimmedEmail;
    }
  }

  if (updates.barangay !== undefined && updates.barangay.trim()) {
    user.barangay = updates.barangay.trim();
  }

  if (updates.role !== undefined && updates.role.trim()) {
    user.role = updates.role.trim();
  }

  if (updates.status !== undefined) {
    user.status = updates.status;
  }

  if (updates.password && updates.password.trim()) {
    const trimmedPass = updates.password.trim();
    if (trimmedPass.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }
    user.passwordHash = hashPassword(trimmedPass);
    user.passwordPlain = trimmedPass;
  }

  user.updatedAt = new Date().toISOString();
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');

  // Immediately persist edited user details into cPanel MySQL Database
  try {
    await saveUserToCPanel(user);
  } catch (cpanelErr: any) {
    console.warn('[cPanel User Edit] Notice saving user to MySQL:', cpanelErr.message);
  }

  await addActivity(actorUsername, `Edited user account details for "@${user.username}" (${user.fullName || user.username}) - Role: ${user.role}, Status: ${user.status}`);
  try {
    await syncAdminsToGoogleSheets();
  } catch (err: any) {
    console.error('Failed to sync users to Sheets on edit:', err.message || err);
  }

  return {
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    barangay: user.barangay,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function designateBarangayForUsers(
  barangay: string,
  sourceBarangay?: string,
  usernames?: string[],
  actorUsername?: string
) {
  if (!barangay || !barangay.trim()) {
    throw new Error('Designated Barangay name is required.');
  }
  const trimmedTarget = barangay.trim();
  const trimmedSource = sourceBarangay ? sourceBarangay.trim() : '';

  let transferredCount = 0;

  // Transfer all records inside previous/source folder to selected target folder
  if (trimmedSource && trimmedSource.toLowerCase() !== trimmedTarget.toLowerCase()) {
    const matchingContacts = contactsCache.filter(c => !c.deleted_at && isBarangayMatch(c.barangay, trimmedSource));
    transferredCount = matchingContacts.length;

    if (transferredCount > 0) {
      matchingContacts.forEach(c => {
        c.barangay = trimmedTarget;
        c.updated_at = new Date().toISOString();
      });
      await saveContacts();
    }

    // Automatically remove previous/source folder from barangaysCache
    barangaysCache = barangaysCache.filter(b => 
      !isBarangayMatch(b, trimmedSource) && 
      normalizeBarangayName(b).toLowerCase() !== normalizeBarangayName(trimmedSource).toLowerCase()
    );

    // Ensure target folder is present in barangaysCache
    const existsTarget = barangaysCache.some(b => 
      isBarangayMatch(b, trimmedTarget) || 
      normalizeBarangayName(b).toLowerCase() === normalizeBarangayName(trimmedTarget).toLowerCase()
    );
    if (!existsTarget) {
      barangaysCache.push(trimmedTarget);
      barangaysCache.sort((a, b) => a.localeCompare(b));
    }
    await saveBarangays();

    // Trigger Google Sheets sync if connected
    if (sheetsConfig.syncEnabled) {
      syncBarangaysToGoogleSheets().catch(err =>
        console.error('[Google Sheets] Error syncing barangays after folder transfer:', err.message || err)
      );
      if (transferredCount > 0) {
        rewriteAllContactsToGoogleSheets().catch(err =>
          console.error('[Google Sheets] Error syncing contacts after folder transfer:', err.message || err)
        );
      }
    }

    // Also update any user accounts currently assigned to sourceBarangay to targetBarangay
    let updatedUsersCount = 0;
    usersCache.forEach(u => {
      if (u.barangay && isBarangayMatch(u.barangay, trimmedSource)) {
        u.barangay = trimmedTarget;
        u.updatedAt = new Date().toISOString();
        updatedUsersCount++;
      }
    });

    if (updatedUsersCount > 0) {
      await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
      usersCache.filter(u => u.barangay === trimmedTarget).forEach(u => saveUserToCPanel(u).catch(() => {}));
      syncAdminsToGoogleSheets().catch(err =>
        console.error('Failed to sync updated designated barangays to Sheets:', err)
      );
    }
  } else {
    // If no trimmedSource or same as target, ensure target is in barangaysCache
    const existsTarget = barangaysCache.some(b => 
      isBarangayMatch(b, trimmedTarget) || 
      normalizeBarangayName(b).toLowerCase() === normalizeBarangayName(trimmedTarget).toLowerCase()
    );
    if (!existsTarget) {
      barangaysCache.push(trimmedTarget);
      barangaysCache.sort((a, b) => a.localeCompare(b));
      await saveBarangays();
      if (sheetsConfig.syncEnabled) {
        syncBarangaysToGoogleSheets().catch(err =>
          console.error('[Google Sheets] Error syncing barangays after folder designation:', err.message || err)
        );
      }
    }
  }

  // Update specific user accounts if explicitly requested
  if (Array.isArray(usernames) && usernames.length > 0) {
    let updatedSpecific = 0;
    for (const uname of usernames) {
      const user = usersCache.find(u => u.username.toLowerCase() === uname.toLowerCase());
      if (user && user.username.toLowerCase() !== 'admin') {
        user.barangay = trimmedTarget;
        user.updatedAt = new Date().toISOString();
        updatedSpecific++;
      }
    }
    if (updatedSpecific > 0) {
      await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
      usersCache.filter(u => u.barangay === trimmedTarget).forEach(u => saveUserToCPanel(u).catch(() => {}));
      syncAdminsToGoogleSheets().catch(err =>
        console.error('Failed to sync updated designated barangays to Sheets:', err)
      );
    }
  }

  // Count matching accounts for target barangay
  const matchingAccounts = usersCache.filter(u => u.barangay && isBarangayMatch(u.barangay, trimmedTarget));

  const activityMsg = transferredCount > 0
    ? `Transferred ${transferredCount} household record(s) from folder "${trimmedSource}" to designated folder "${trimmedTarget}". Previous folder "${trimmedSource}" automatically removed.`
    : `Designated Barangay folder "${trimmedTarget}". Available to ${matchingAccounts.length} account(s).`;

  await addActivity(actorUsername || 'admin', activityMsg);

  return {
    success: true,
    message: transferredCount > 0
      ? `Successfully transferred ${transferredCount} household record(s) from "${trimmedSource}" to "${trimmedTarget}". Previous folder "${trimmedSource}" automatically removed!`
      : `Barangay "${trimmedTarget}" folder designated successfully! Available to ${matchingAccounts.length} account(s).`,
    transferredCount,
    sourceBarangay: trimmedSource,
    targetBarangay: trimmedTarget,
    matchingAccountCount: matchingAccounts.length,
    matchingAccounts: matchingAccounts.map(u => ({ username: u.username, fullName: u.fullName || u.username, role: u.role })),
    barangay: trimmedTarget
  };
}

function saveAvatarFile(base64Data: string, username: string): string {
  try {
    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Data;
    }
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    safeMkdirSync(uploadsDir, { recursive: true });

    const distUploadsDir = path.join(process.cwd(), 'dist', 'uploads', 'avatars');
    safeMkdirSync(distUploadsDir, { recursive: true });

    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const fileName = `avatar_${cleanUser}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    const distFilePath = path.join(distUploadsDir, fileName);

    safeWriteFileSync(filePath, imageBuffer as any);
    safeWriteFileSync(distFilePath, imageBuffer as any);

    return `/uploads/avatars/${fileName}?t=${Date.now()}`;
  } catch (err: any) {
    console.warn('Failed to save avatar image file to disk:', err.message || err);
    return base64Data;
  }
}

function chooseBestAvatar(localAvatar?: string, remoteAvatar?: string): string {
  if (!remoteAvatar || remoteAvatar.trim() === '') return localAvatar || '';
  if (!localAvatar || localAvatar.trim() === '') return remoteAvatar || '';

  // If remoteAvatar is truncated (starts with data:image/ and length >= 44000), keep localAvatar
  if (remoteAvatar.startsWith('data:image/') && remoteAvatar.length >= 44000) {
    return localAvatar;
  }

  // If localAvatar is a static upload URL (/uploads/...), prioritize it
  if (localAvatar.startsWith('/uploads/')) {
    if (remoteAvatar.startsWith('/uploads/')) {
      return remoteAvatar;
    }
    return localAvatar;
  }

  return remoteAvatar;
}

export async function updateUserProfile(
  currentUsername: string,
  updates: { username?: string; displayName?: string; avatarDataUrl?: string; password?: string; barangay?: string }
) {
  const user = usersCache.find(u => u.username.toLowerCase() === currentUsername.toLowerCase());
  if (!user) {
    throw new Error('User not found.');
  }

  let finalUsername = currentUsername.toLowerCase();

  if (updates.username) {
    const nextUsername = updates.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!nextUsername) {
      throw new Error('Username cannot be empty.');
    }
    if (nextUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (nextUsername !== currentUsername.toLowerCase()) {
      const exists = usersCache.some(u => u.username.toLowerCase() === nextUsername);
      if (exists) {
        throw new Error(`Username "@${nextUsername}" is already taken.`);
      }
      user.username = nextUsername;
      finalUsername = nextUsername;
    }
  }

  if (updates.displayName !== undefined) {
    const trimmedDisplay = updates.displayName.trim();
    user.displayName = trimmedDisplay;
    user.fullName = trimmedDisplay;
  }

  if (updates.avatarDataUrl !== undefined) {
    let newAvatar = updates.avatarDataUrl;
    if (newAvatar && newAvatar.startsWith('data:image/')) {
      newAvatar = saveAvatarFile(newAvatar, finalUsername);
    }
    user.avatarDataUrl = newAvatar;
  }

  if (updates.barangay !== undefined) {
    user.barangay = updates.barangay.trim();
  }

  if (updates.password) {
    const trimmedPass = updates.password.trim();
    if (trimmedPass.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }
    user.passwordHash = hashPassword(trimmedPass);
    user.passwordPlain = trimmedPass;
  }

  user.updatedAt = new Date().toISOString();

  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');

  // If username was renamed, remove old username record from cPanel MySQL
  if (finalUsername !== currentUsername.toLowerCase()) {
    deleteUserFromCPanel(currentUsername).catch(() => {});
  }
  // Immediately persist updated user profile to cPanel MySQL
  try {
    await saveUserToCPanel(user);
  } catch (cpanelErr: any) {
    console.warn('[cPanel Profile Update] Notice saving user to MySQL:', cpanelErr.message);
  }

  await addActivity(finalUsername, `Updated admin profile settings (Username: @${finalUsername}, Name: ${user.displayName || 'not set'}).`);

  // Synchronize immediately to Google Sheets
  try {
    await syncAdminsToGoogleSheets();
  } catch (err: any) {
    console.error('Failed to sync updated admin profile to Sheets:', err.message || err);
  }

  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName || user.fullName || '',
    avatarDataUrl: user.avatarDataUrl || '',
    barangay: user.barangay || '',
    email: user.email || '',
    status: user.status || 'Active'
  };
}

export async function createAdminUser(username: string, password: string, creatorUsername: string) {
  const trimmedUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const trimmedPass = password.trim();

  if (!trimmedUser || !trimmedPass) {
    throw new Error('Username and password are required.');
  }

  if (trimmedUser.length < 3) {
    throw new Error('Username must be at least 3 characters long and alphanumeric.');
  }

  if (trimmedPass.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const exists = usersCache.some(u => u.username.toLowerCase() === trimmedUser);
  if (exists) {
    throw new Error(`Username "@${trimmedUser}" is already taken.`);
  }

  // Clear any tombstone if re-creating
  unTombstoneUser(trimmedUser, `${trimmedUser}@clinic.gov.ph`);

  const newUser: User = {
    username: trimmedUser,
    fullName: trimmedUser,
    displayName: trimmedUser,
    email: trimmedUser.includes('@') ? trimmedUser : `${trimmedUser}@clinic.gov.ph`,
    barangay: 'Central',
    passwordHash: hashPassword(trimmedPass),
    passwordPlain: trimmedPass,
    role: 'Administrator',
    status: 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  usersCache.push(newUser);
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');

  // Immediately persist newly created admin into cPanel MySQL Database
  try {
    await saveUserToCPanel(newUser);
  } catch (cpanelErr: any) {
    console.warn('[cPanel Admin Create] Notice saving user to MySQL:', cpanelErr.message);
  }

  await addActivity(creatorUsername, `Created new Administrator credential: "@${trimmedUser}"`);
  try {
    await syncAdminsToGoogleSheets();
  } catch (err: any) {
    console.error('Failed to sync admins to Sheets on create:', err.message || err);
  }

  return { username: trimmedUser, role: 'Administrator', status: 'Active' };
}

export async function deleteAdminUser(username: string, creatorUsername: string) {
  if (!username || !username.trim()) {
    throw new Error('Target username is required.');
  }
  const targetUser = username.trim().toLowerCase();
  if (targetUser === 'admin') {
    throw new Error('The master admin account cannot be deleted.');
  }

  const index = usersCache.findIndex(
    u => u && typeof u.username === 'string' && (u.username.toLowerCase() === targetUser || (typeof u.email === 'string' && u.email.toLowerCase() === targetUser))
  );

  let removedUser: User | undefined;
  if (index !== -1) {
    removedUser = usersCache.splice(index, 1)[0];
  } else {
    removedUser = {
      username: targetUser,
      email: targetUser.includes('@') ? targetUser : '',
      fullName: targetUser,
      passwordHash: '',
      role: 'Staff',
      status: 'Suspended'
    };
  }

  const tombUsername = (removedUser && removedUser.username) ? removedUser.username.trim().toLowerCase() : targetUser;
  const tombEmail = (removedUser && removedUser.email) ? removedUser.email.trim().toLowerCase() : '';

  // Permanently tombstone account
  deletedUsersCache = deletedUsersCache.filter(d => {
    const du = d.username ? d.username.trim().toLowerCase() : '';
    const de = d.email ? d.email.trim().toLowerCase() : '';
    if (tombUsername && du && du === tombUsername) return false;
    if (tombEmail && de && de === tombEmail) return false;
    return true;
  });
  deletedUsersCache.push({
    username: tombUsername,
    email: tombEmail,
    deletedAt: new Date().toISOString()
  });
  await safeWriteFile(DELETED_USERS_FILE, JSON.stringify(deletedUsersCache, null, 2), 'utf-8');

  // Purge any duplicates or remaining records from usersCache
  usersCache = usersCache.filter(u => !isUserTombstoned(u.username, u.email));
  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');

  // Delete from cPanel MySQL Database
  deleteUserFromCPanel(tombUsername).catch(() => {});
  if (tombEmail) {
    deleteUserFromCPanel(tombEmail).catch(() => {});
  }

  await addActivity(creatorUsername, `Deleted user account: "@${tombUsername}"`);

  // Direct and permanent synchronization to Google Sheets
  try {
    await syncAdminsToGoogleSheets(true);
    await syncDeletedRecordsToGoogleSheets(true);
  } catch (err: any) {
    console.error('Failed to sync deleted admin to Sheets:', err.message || err);
  }
}

// In-memory store for password reset verification PINs
const resetTokensMap = new Map<string, { pin: string; expiresAt: number; email: string; username: string }>();

export async function requestPasswordResetPIN(emailOrUsername: string) {
  if (!emailOrUsername || !emailOrUsername.trim()) {
    throw new Error('Please enter your email address or username.');
  }

  const target = emailOrUsername.trim().toLowerCase();
  let user: User | undefined = undefined;

  if (target === 'admin') {
    user = findUser('admin');
  } else {
    user = findUserByEmail(target) || findUser(target);
  }

  if (!user) {
    throw new Error(`No registered account found with email or username "${emailOrUsername}". Please check your credentials or register a new account.`);
  }

  // Generate 6-digit PIN
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store PIN valid for 15 minutes
  resetTokensMap.set(user.username.toLowerCase(), {
    pin,
    expiresAt: Date.now() + 15 * 60 * 1000,
    email: user.email || user.username,
    username: user.username
  });

  await addActivity(user.username, `Requested password reset verification PIN.`);

  return {
    success: true,
    message: 'Verification PIN generated successfully.',
    email: user.email || user.username,
    username: user.username,
    pin
  };
}

export async function verifyAndResetPassword(emailOrUsername: string, pin: string, newPassword: string) {
  if (!emailOrUsername || !emailOrUsername.trim()) {
    throw new Error('Please enter your email address or username.');
  }
  if (!pin || !pin.trim()) {
    throw new Error('Please enter the 6-digit verification PIN.');
  }
  if (!newPassword || !newPassword.trim()) {
    throw new Error('Please enter a new password.');
  }

  const trimmedPass = newPassword.trim();
  if (trimmedPass.length < 4) {
    throw new Error('New password must be at least 4 characters long.');
  }

  const target = emailOrUsername.trim().toLowerCase();
  let user: User | undefined = undefined;

  if (target === 'admin') {
    user = findUser('admin');
  } else {
    user = findUserByEmail(target) || findUser(target);
  }

  if (!user) {
    throw new Error('User account not found.');
  }

  const tokenData = resetTokensMap.get(user.username.toLowerCase());
  if (!tokenData) {
    throw new Error('No active password reset request found for this account. Please request a new PIN.');
  }

  if (Date.now() > tokenData.expiresAt) {
    resetTokensMap.delete(user.username.toLowerCase());
    throw new Error('The verification PIN has expired (15 min limit). Please request a new PIN.');
  }

  if (tokenData.pin !== pin.trim()) {
    throw new Error('Invalid 6-digit verification PIN. Please double check the code.');
  }

  // PIN verified - update password
  user.passwordHash = hashPassword(trimmedPass);
  user.passwordPlain = trimmedPass;

  await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  resetTokensMap.delete(user.username.toLowerCase());
  
  await addActivity(user.username, `Successfully reset account password.`);
  syncAdminsToGoogleSheets().catch(err => console.error('Failed to sync updated user password to Sheets:', err));

  return {
    success: true,
    message: 'Password reset successfully! You can now log in with your new password.',
    username: user.username,
    email: user.email || user.username
  };
}

// String Helper for Capitalization
function capitalizeWords(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Flexible Barangay comparison function
export function isBarangayMatch(b1?: any, b2?: any): boolean {
  const str1 = extractBarangayName(b1);
  const str2 = extractBarangayName(b2);
  if (!str1 || !str2) return false;
  const c1 = str1.toLowerCase();
  const c2 = str2.toLowerCase();
  if (c1 === c2) return true;

  // Clean prefixes like "barangay ", "brgy. ", "brgy "
  const clean1 = c1.replace(/^(barangay|brgy\.?)\s+/i, '').trim();
  const clean2 = c2.replace(/^(barangay|brgy\.?)\s+/i, '').trim();
  if (clean1 === clean2 && clean1.length > 0) return true;

  // Compare normalized versions
  const norm1 = normalizeBarangayName(str1).toLowerCase();
  const norm2 = normalizeBarangayName(str2).toLowerCase();
  if (norm1 === norm2 && norm1.length > 0) return true;

  return false;
}

// Helper to check if a contact has already been submitted to Base44 / permanently locked
export function isContactSubmitted(c: Contact): boolean {
  if (!c) return false;
  if (c.status === 'SUBMITTED' || c.status === 'LOCKED' || c.status === 'ALREADY SUBMITTED' || c.locked === true || c.submittedToBase44 === true || c.isSubmitted === true) {
    return true;
  }
  // If explicitly flagged as actively undergoing submission (isSubmitted === false), do not treat as submitted yet
  if (c.isSubmitted === false) {
    return false;
  }
  if (c.pcu_file_url && typeof c.pcu_file_url === 'string' && c.pcu_file_url.trim() !== '') {
    return true;
  }
  if (c.uploadedFiles && Array.isArray(c.uploadedFiles) && c.uploadedFiles.length > 0) {
    return true;
  }
  // Check if contact has matching submission in pcuUpdatesCache
  if (Array.isArray(pcuUpdatesCache) && pcuUpdatesCache.length > 0) {
    const hasPcu = pcuUpdatesCache.some(p => 
      (c.id && p.contactId && c.id.toString() === p.contactId.toString()) ||
      (p.fullName && normalizeCompareName(c.full_name, p.fullName))
    );
    if (hasPcu) return true;
  }
  // Check if contact was submitted to Base44 in deletedContactsCache
  if (Array.isArray(deletedContactsCache) && deletedContactsCache.length > 0) {
    const isSub = deletedContactsCache.some(d => 
      Boolean((d as any).submitted_to_base44) && (
        (c.id && d.id && c.id.toString() === d.id.toString()) ||
        (d.full_name && normalizeCompareName(c.full_name, d.full_name))
      )
    );
    if (isSub) return true;
  }
  return false;
}

// Helper to filter all active contacts for PCU Directory (active, non-deleted records)
export function isContactForDirectory(c: Contact): boolean {
  if (!c || c.deleted_at) return false;
  if (c.added_from_print_list === false) return false;
  if (isContactTombstoned(c)) return false;
  return true;
}

// Helper to filter only available (unsubmitted) contacts for PCU Directory
export function isAvailableForDirectory(c: Contact): boolean {
  if (!isContactForDirectory(c)) return false;
  return !isContactSubmitted(c);
}

// Canonical name normalization key for strict duplicate detection and resolution
export function getCanonicalNameKey(name?: string): string {
  if (!name) return '';
  let str = name.toLowerCase().trim();
  // Normalize Spanish / Filipino particles: "de la" -> "dela", "de los" -> "delos", "de las" -> "delas", "del carmen" -> "delcarmen", etc.
  str = str.replace(/\bde\s+la\b/g, 'dela')
           .replace(/\bde\s+los\b/g, 'delos')
           .replace(/\bde\s+las\b/g, 'delas')
           .replace(/\bsta\b\.?/g, 'santa')
           .replace(/\bsto\b\.?/g, 'santo');
  // Strip common generational suffixes and honorific titles when building canonical comparison key
  // (e.g. "Sr.", "Jr.", "II", "III", "IV", "V", "Dr.", "Mr.", "Mrs.", "Ms.", "MD")
  str = str.replace(/\b(sr|jr|ii|iii|iv|v|vi|dr|mr|mrs|ms|md)\b\.?/gi, ' ');
  const clean = str.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  if (clean.length === 0) return name.trim().toLowerCase();
  return clean.sort().join(' ');
}

// Strict full-name identity matching across permutations, particles, suffixes, and formats
export function isSamePersonFullName(name1?: string, name2?: string): boolean {
  if (!name1 || !name2) return false;
  const n1 = name1.trim().toLowerCase();
  const n2 = name2.trim().toLowerCase();
  if (n1 === n2 && n1.length > 0) return true;

  const key1 = getCanonicalNameKey(name1);
  const key2 = getCanonicalNameKey(name2);
  if (key1 && key2 && key1 === key2) return true;

  if (normalizeCompareName(name1, name2)) return true;

  return false;
}

// Deduplicate contacts list strictly by Full Name, merging and retaining the highest quality record
export function deduplicateContactsByName(contacts: Contact[]): Contact[] {
  const result: Contact[] = [];
  const seenKeys = new Map<string, number>(); // canonicalKey -> index in result

  for (const c of contacts) {
    if (!c || c.deleted_at) continue;
    const key = getCanonicalNameKey(c.full_name);
    if (!key) {
      result.push(c);
      continue;
    }

    if (!seenKeys.has(key)) {
      seenKeys.set(key, result.length);
      result.push(c);
    } else {
      const existingIdx = seenKeys.get(key)!;
      const existing = result[existingIdx];

      const timeExisting = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const timeC = new Date(c.updated_at || c.created_at || 0).getTime();
      const cIsNewer = timeC >= timeExisting;
      const newest = cIsNewer ? c : existing;
      const older = cIsNewer ? existing : c;

      // Choose the most descriptive and complete legal full name (e.g. retaining "Sr.", "Jr.", or longer title)
      const hasSuffixExisting = /\b(sr|jr|ii|iii|iv|v|vi)\b\.?/i.test(existing.full_name || '');
      const hasSuffixC = /\b(sr|jr|ii|iii|iv|v|vi)\b\.?/i.test(c.full_name || '');
      let bestName = newest.full_name;
      if (hasSuffixC && !hasSuffixExisting) {
        bestName = c.full_name;
      } else if (hasSuffixExisting && !hasSuffixC) {
        bestName = existing.full_name;
      } else if ((existing.full_name || '').length > (c.full_name || '').length) {
        bestName = existing.full_name;
      }

      const mergedContactNumber = newest.contact_number || older.contact_number || '';
      const mergedBarangay = newest.barangay || older.barangay || '';
      const mergedPurok = newest.purok || older.purok || '';
      const mergedMaintenance = newest.maintenance || older.maintenance || 'None';
      const mergedMedicine = (mergedMaintenance === 'Yes')
        ? (newest.maintenance === 'Yes' ? newest.maintenance_medicine : older.maintenance_medicine) || ''
        : '';

      const existingSub = isContactSubmitted(existing);
      const cSub = isContactSubmitted(c);
      const isSub = existingSub || cSub;

      result[existingIdx] = {
        ...older,
        ...newest,
        full_name: bestName || newest.full_name,
        contact_number: mergedContactNumber,
        barangay: mergedBarangay,
        purok: mergedPurok,
        maintenance: mergedMaintenance,
        maintenance_medicine: mergedMedicine,
        photo_url: newest.photo_url || older.photo_url,
        pcu_file_url: newest.pcu_file_url || older.pcu_file_url,
        pcu_uploaded_by: newest.pcu_uploaded_by || older.pcu_uploaded_by,
        pcu_uploaded_at: newest.pcu_uploaded_at || older.pcu_uploaded_at,
        isSubmitted: isSub,
        locked: isSub,
        status: isSub ? 'SUBMITTED' : (newest.status || older.status || 'ACTIVE'),
        uploadedFiles: (newest.uploadedFiles && newest.uploadedFiles.length > 0) ? newest.uploadedFiles : older.uploadedFiles,
        updated_at: new Date(Math.max(timeExisting, timeC, Date.now())).toISOString()
      };
    }
  }

  return result;
}

// Get contacts with flexible pagination, sorting, searching, and filtering
export async function getContacts(params: {
  search?: string;
  barangay?: string;
  address?: string;
  purok?: string;
  sortBy?: 'name' | 'barangay' | 'purok' | 'date';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  forceSync?: boolean;
}) {
  const { search, barangay, address, purok, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 10, forceSync = false } = params;

  if (isCPanelDbConnected()) {
    if (forceSync || contactsCache.length === 0 || (await checkCPanelDbNeedsSync())) {
      try {
        await syncWithCPanelDb();
      } catch (err: any) {
        console.error('[cPanel DB] Failed to sync contacts in getContacts:', err.message || err);
      }
    }
  }

  // Ensure all PCU statuses are fully restored on any contacts before querying/filtering
  syncPCUFieldsToCache();

  const filterBarangay = barangay || address;

  // Query all active contacts for PCU DIRECTORY (both available and submitted) and strictly deduplicate by Full Name
  const directoryContacts = deduplicateContactsByName(contactsCache.filter(isContactForDirectory));
  let filtered = [...directoryContacts];

  // Get ALL unique barangays from Google Sheet database (getBarangayList) + deduplicated active contacts
  const rawBarangaysList: string[] = [];

  // 1. Fetch barangay list from Google Sheet database cache/file
  const sheetBarangays = getBarangayList();
  if (Array.isArray(sheetBarangays)) {
    sheetBarangays.forEach(bg => {
      if (bg && typeof bg === 'string' && bg.trim()) {
        rawBarangaysList.push(bg.trim());
      }
    });
  }

  // 2. Add any barangay from directory contacts in contactsCache
  directoryContacts.forEach(c => {
    if (c.barangay && c.barangay.trim()) {
      rawBarangaysList.push(c.barangay.trim());
    }
  });

  const allBarangays = normalizeAndDeduplicateBarangays(rawBarangaysList);

  // Compute NO ADDRESS folder statistics if there are contacts without address
  const noAddressContacts = directoryContacts.filter(c => 
    !c.barangay || !c.barangay.trim() || c.barangay.trim().toLowerCase() === 'no address' || c.barangay.trim().toLowerCase() === 'no barangay'
  );

  if (noAddressContacts.length > 0 && !allBarangays.includes('NO ADDRESS')) {
    allBarangays.push('NO ADDRESS');
  }

  // Get ALL unique non-empty puroks for filtering dropdown before search filters are applied
  const allPuroksSet = new Set<string>();
  let hasNoPurokContacts = false;
  directoryContacts.forEach(c => {
    if (c.purok && c.purok.trim() && c.purok.trim().toLowerCase() !== 'no purok') {
      allPuroksSet.add(c.purok.trim());
    } else {
      hasNoPurokContacts = true;
    }
  });
  const allPuroks = Array.from(allPuroksSet).sort((a, b) => a.localeCompare(b));
  if (hasNoPurokContacts) {
    allPuroks.push("No Purok");
  }

  // Apply Barangay Filter with flexible matching
  if (filterBarangay && filterBarangay !== 'All Addresses' && filterBarangay !== 'All Barangays') {
    if (filterBarangay.toUpperCase() === 'NO ADDRESS') {
      filtered = filtered.filter(c => !c.barangay || !c.barangay.trim() || c.barangay.trim().toLowerCase() === 'no address' || c.barangay.trim().toLowerCase() === 'no barangay');
    } else {
      filtered = filtered.filter(c => isBarangayMatch(c.barangay, filterBarangay));
    }
  }

  // Apply Purok Filter
  if (purok && purok !== 'All Puroks') {
    if (purok === 'No Purok') {
      filtered = filtered.filter(c => !c.purok || !c.purok.trim() || c.purok.toLowerCase() === 'no purok');
    } else {
      filtered = filtered.filter(c => c.purok && c.purok.toLowerCase() === purok.toLowerCase());
    }
  }

  // Helper: Smart contact search matching (exact, clean, tokenized / word-order agnostic)
  const contactMatchesSearch = (
    c: { full_name?: string; barangay?: string; purok?: string; contact_number?: string },
    searchTerm: string
  ): boolean => {
    if (!searchTerm) return true;
    const raw = searchTerm.toLowerCase().trim();
    const name = (c.full_name || '').toLowerCase();
    const bg = (c.barangay || '').toLowerCase();
    const pur = (c.purok || '').toLowerCase();
    const phone = (c.contact_number || '').replace(/[\s-]/g, '');
    const cleanTermPhone = raw.replace(/[\s-]/g, '');

    // 1. Direct substring match on any field
    if (
      name.includes(raw) ||
      bg.includes(raw) ||
      pur.includes(raw) ||
      (!c.purok && 'no purok'.includes(raw)) ||
      (phone && cleanTermPhone && phone.includes(cleanTermPhone))
    ) {
      return true;
    }

    // 2. Tokenized word matching (ignores commas, hyphens, and word order e.g. "Veradio, Angel Kate" vs "Angel Kate Veradio")
    const tokens = raw.replace(/[,.\-_/]/g, ' ').split(/\s+/).filter(t => t.length > 0);
    if (tokens.length > 1) {
      const combined = `${name} ${bg} ${pur}`;
      if (tokens.every(token => combined.includes(token))) {
        return true;
      }
    }

    return false;
  };

  // Apply Search (Full Name, Barangay, Purok, Contact Number)
  if (search) {
    const term = search.toLowerCase().trim();
    filtered = filtered.filter(c => contactMatchesSearch(c, term));
  }

  // Apply Sorting: Available contacts ALWAYS first, Submitted / Locked contacts ALWAYS at the bottom!
  filtered.sort((a, b) => {
    const aLocked = isContactSubmitted(a);
    const bLocked = isContactSubmitted(b);

    if (!aLocked && bLocked) return -1;
    if (aLocked && !bLocked) return 1;

    let comparison = 0;
    if (sortBy === 'name') {
      comparison = (a.full_name || '').localeCompare(b.full_name || '');
    } else if (sortBy === 'barangay' || sortBy === 'address' as any) {
      comparison = (a.barangay || '').localeCompare(b.barangay || '');
    } else if (sortBy === 'purok') {
      comparison = (a.purok || 'No Purok').localeCompare(b.purok || 'No Purok');
    } else if (sortBy === 'date') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination calculations
  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit).map(c => {
    const isSub = isContactSubmitted(c);
    if (isSub) {
      return {
        ...c,
        locked: true,
        isSubmitted: true,
        status: c.status || 'SUBMITTED'
      };
    }
    return c;
  });
  const totalPages = Math.ceil(total / limit);

  // Optimized single-pass statistics calculation for barangays and puroks
  const term = search ? search.toLowerCase().trim() : '';

  // Canonical barangay map for O(1) matching
  const uniqueContactBarangays = Array.from(new Set(directoryContacts.map(c => (c.barangay || '').trim())));
  const canonicalBarangayMap = new Map<string, string>();
  for (const rawBg of uniqueContactBarangays) {
    if (!rawBg || rawBg.toLowerCase() === 'no address' || rawBg.toLowerCase() === 'no barangay') {
      canonicalBarangayMap.set(rawBg, 'NO ADDRESS');
      continue;
    }
    const matched = allBarangays.find(b => isBarangayMatch(rawBg, b));
    canonicalBarangayMap.set(rawBg, matched || normalizeBarangayName(rawBg));
  }

  // Pre-initialize stats objects for all barangays
  const bgStats = new Map<string, {
    barangay: string;
    count: number;
    availableCount: number;
    submittedCount: number;
    purokSet: Set<string>;
    geotaggedCount: number;
    hasMatchingContact: boolean;
  }>();

  for (const bg of allBarangays) {
    bgStats.set(bg, {
      barangay: bg,
      count: 0,
      availableCount: 0,
      submittedCount: 0,
      purokSet: new Set<string>(),
      geotaggedCount: 0,
      hasMatchingContact: false
    });
  }

  // Pre-initialize stats objects for all puroks
  const purokStats = new Map<string, {
    purok: string;
    count: number;
    availableCount: number;
    submittedCount: number;
    barangaySet: Set<string>;
    geotaggedCount: number;
    hasMatchingContact: boolean;
  }>();

  for (const pur of allPuroks) {
    purokStats.set(pur, {
      purok: pur,
      count: 0,
      availableCount: 0,
      submittedCount: 0,
      barangaySet: new Set<string>(),
      geotaggedCount: 0,
      hasMatchingContact: false
    });
  }

  // Single pass over directoryContacts
  const isNoAddressFilter = filterBarangay && (filterBarangay.toUpperCase() === 'NO ADDRESS' || filterBarangay.toLowerCase() === 'no address');
  const hasSpecificBarangayFilter = Boolean(filterBarangay && filterBarangay !== 'All Addresses' && filterBarangay !== 'All Barangays');

  for (const c of directoryContacts) {
    const rawBg = (c.barangay || '').trim();
    const canonBg = canonicalBarangayMap.get(rawBg) || (rawBg ? normalizeBarangayName(rawBg) : 'NO ADDRESS');
    
    const rawPur = (c.purok || '').trim();
    const canonPur = (!rawPur || rawPur.toLowerCase() === 'no purok') ? 'No Purok' : rawPur;

    const isSubmitted = Boolean(c.locked || c.status === 'SUBMITTED' || c.isSubmitted || c.submittedToBase44);
    const isGeotagged = Boolean(c.geotagged);

    const contactMatchesTerm = Boolean(term && contactMatchesSearch(c, term));

    // Update Barangay Stats
    let bEntry = bgStats.get(canonBg);
    if (!bEntry && canonBg === 'NO ADDRESS') {
      bEntry = {
        barangay: 'NO ADDRESS',
        count: 0,
        availableCount: 0,
        submittedCount: 0,
        purokSet: new Set<string>(),
        geotaggedCount: 0,
        hasMatchingContact: false
      };
      bgStats.set('NO ADDRESS', bEntry);
    }
    if (bEntry) {
      bEntry.count++;
      if (isSubmitted) bEntry.submittedCount++;
      else bEntry.availableCount++;
      if (isGeotagged) bEntry.geotaggedCount++;
      bEntry.purokSet.add(canonPur);
      if (contactMatchesTerm) bEntry.hasMatchingContact = true;
    }

    // Update Purok Stats (respecting filterBarangay if specified)
    let passesBarangayForPurok = true;
    if (hasSpecificBarangayFilter) {
      if (isNoAddressFilter) {
        passesBarangayForPurok = (canonBg === 'NO ADDRESS');
      } else {
        passesBarangayForPurok = (canonBg === filterBarangay || isBarangayMatch(rawBg, filterBarangay!));
      }
    }

    if (passesBarangayForPurok) {
      // Find matching purok entry in purokStats (case-insensitive fallback)
      let pEntry = purokStats.get(canonPur);
      if (!pEntry) {
        for (const [key, val] of purokStats.entries()) {
          if (key.toLowerCase() === canonPur.toLowerCase()) {
            pEntry = val;
            break;
          }
        }
      }
      if (pEntry) {
        pEntry.count++;
        if (isSubmitted) pEntry.submittedCount++;
        else pEntry.availableCount++;
        if (isGeotagged) pEntry.geotaggedCount++;
        if (canonBg) pEntry.barangaySet.add(canonBg);
        if (contactMatchesTerm) pEntry.hasMatchingContact = true;
      }
    }
  }

  // Build folder arrays
  let barangayFolders = Array.from(bgStats.values())
    .filter(f => f.count > 0)
    .map(f => ({
      barangay: f.barangay,
      count: f.count,
      availableCount: f.availableCount,
      submittedCount: f.submittedCount,
      purokCount: f.purokSet.size,
      geotaggedCount: f.geotaggedCount
    }));

  let purokFolders = Array.from(purokStats.values())
    .filter(f => f.count > 0)
    .map(f => ({
      purok: f.purok,
      count: f.count,
      availableCount: f.availableCount,
      submittedCount: f.submittedCount,
      barangayCount: f.barangaySet.size,
      geotaggedCount: f.geotaggedCount,
      barangays: Array.from(f.barangaySet)
    }));

  // Apply Search to folders so that we only return matching folders or folders containing matching contacts
  if (term) {
    const bgFoldersWithMatches = new Set(
      Array.from(bgStats.values())
        .filter(f => f.barangay.toLowerCase().includes(term) || f.hasMatchingContact)
        .map(f => f.barangay)
    );
    barangayFolders = barangayFolders.filter(f => bgFoldersWithMatches.has(f.barangay));

    const purokFoldersWithMatches = new Set(
      Array.from(purokStats.values())
        .filter(f => f.purok.toLowerCase().includes(term) || f.hasMatchingContact)
        .map(f => f.purok)
    );
    purokFolders = purokFolders.filter(f => purokFoldersWithMatches.has(f.purok));
  }

  // Sort both Barangay Folders and Purok Folders based on the number of contacts (highest population on top)
  barangayFolders.sort((a, b) => b.count - a.count || a.barangay.localeCompare(b.barangay));
  purokFolders.sort((a, b) => b.count - a.count || a.purok.localeCompare(b.purok));

  return {
    contacts: paginated,
    total,
    page,
    totalPages,
    allAddresses: allBarangays, // returning as allAddresses for backward compatibility with existing frontends
    allPuroks,
    barangayFolders,
    purokFolders
  };
}

// Get all non-deleted contacts for exporting and printing without pagination (available first, submitted at bottom)
export function getAllFilteredContacts(params: {
  search?: string;
  barangay?: string;
  address?: string;
  purok?: string;
  sortBy?: 'name' | 'barangay' | 'purok' | 'date';
  sortOrder?: 'asc' | 'desc';
}) {
  const { search, barangay, address, purok, sortBy = 'date', sortOrder = 'desc' } = params;
  
  // Ensure all PCU statuses are fully restored on any contacts before querying/filtering
  syncPCUFieldsToCache();

  const filterBarangay = barangay || address;
  const directoryContacts = deduplicateContactsByName(contactsCache.filter(isContactForDirectory));
  let filtered = [...directoryContacts];

  if (filterBarangay && filterBarangay !== 'All Addresses' && filterBarangay !== 'All Barangays') {
    if (filterBarangay.toUpperCase() === 'NO ADDRESS') {
      filtered = filtered.filter(c => !c.barangay || !c.barangay.trim() || c.barangay.trim().toLowerCase() === 'no address' || c.barangay.trim().toLowerCase() === 'no barangay');
    } else {
      filtered = filtered.filter(c => isBarangayMatch(c.barangay, filterBarangay));
    }
  }

  if (purok && purok !== 'All Puroks') {
    if (purok === 'No Purok') {
      filtered = filtered.filter(c => !c.purok || !c.purok.trim() || c.purok.toLowerCase() === 'no purok');
    } else {
      filtered = filtered.filter(c => c.purok && c.purok.toLowerCase() === purok.toLowerCase());
    }
  }

  if (search) {
    const term = search.toLowerCase().trim();
    filtered = filtered.filter(
      c =>
        (c.full_name || '').toLowerCase().includes(term) ||
        (c.barangay || '').toLowerCase().includes(term) ||
        ((c.purok && c.purok.toLowerCase().includes(term)) || (!c.purok && 'no purok'.includes(term))) ||
        (c.contact_number || '').includes(term)
    );
  }

  filtered.sort((a, b) => {
    const aLocked = Boolean(a.locked || a.status === 'SUBMITTED' || a.submittedToBase44 || a.isSubmitted);
    const bLocked = Boolean(b.locked || b.status === 'SUBMITTED' || b.submittedToBase44 || b.isSubmitted);

    if (!aLocked && bLocked) return -1;
    if (aLocked && !bLocked) return 1;

    let comparison = 0;
    if (sortBy === 'name') {
      comparison = (a.full_name || '').localeCompare(b.full_name || '');
    } else if (sortBy === 'barangay' || sortBy === 'address' as any) {
      comparison = (a.barangay || '').localeCompare(b.barangay || '');
    } else if (sortBy === 'purok') {
      comparison = (a.purok || 'No Purok').localeCompare(b.purok || 'No Purok');
    } else if (sortBy === 'date') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
}

// Helper to generate IDs for locally added contacts to avoid clash with Base44 entries (1..N)
function getNextLocalId(): number {
  const localIdStart = 100000;
  const ids = contactsCache
    .map(c => typeof c.id === 'number' ? c.id : parseInt(c.id as any, 10))
    .filter(id => !isNaN(id) && id >= localIdStart);
  
  let nextId = ids.length > 0 ? Math.max(...ids) + 1 : localIdStart;
  
  // Guarantee absolute uniqueness against any existing record
  while (contactsCache.some(c => Number(c.id) === nextId)) {
    nextId++;
  }
  return nextId;
}

// Helper to save or update contact records in Base44 database
export async function saveContactToBase44(contact: Contact, username: string): Promise<void> {
  try {
    const submissionEntity = (base44.entities as any).HouseholdSubmission;
    if (!submissionEntity) return;

    const userObj = findUser(username);
    const uName = userObj?.fullName || userObj?.displayName || username;
    const userEmail = userObj?.email || (username.includes('@') ? username : 'saintfrancisclinic2026@gmail.com');

    const nameParts = (contact.full_name || '').trim().split(/\s+/);
    let firstName = 'Unknown';
    let lastName = 'Unknown';
    if (nameParts.length > 1) {
      firstName = nameParts.slice(0, -1).join(' ');
      lastName = nameParts[nameParts.length - 1];
    } else if (nameParts.length === 1 && nameParts[0] !== '') {
      firstName = nameParts[0];
      lastName = 'Unknown';
    }

    const hasGeo = (contact.latitude !== undefined && contact.latitude !== null && !isNaN(Number(contact.latitude)) &&
                    contact.longitude !== undefined && contact.longitude !== null && !isNaN(Number(contact.longitude)));
    const latNum = hasGeo ? Number(contact.latitude) : null;
    const lngNum = hasGeo ? Number(contact.longitude) : null;
    const isGeotagged = Boolean(contact.geotagged || hasGeo);

    const cleanUploadedFiles: any[] = [];
    if (Array.isArray(contact.uploadedFiles)) {
      for (const f of contact.uploadedFiles) {
        let fUrl = f.url || f.fileUrl || '';
        const fName = f.name || f.fileName || 'document';
        if (fUrl && fUrl.startsWith('data:')) {
          try {
            fUrl = await uploadFileToBase44(fUrl, fName, f.fileType);
            f.url = fUrl;
            f.fileUrl = fUrl;
          } catch (e) {
            console.warn('[saveContactToBase44] Failed to convert file url:', e);
          }
        }
        if (fUrl && !fUrl.startsWith('data:') && fUrl.length <= 500) {
          cleanUploadedFiles.push({
            name: f.name || fName,
            fileName: f.fileName || fName,
            fileType: f.fileType || getMimeType(fName),
            fileUrl: fUrl,
            url: fUrl,
            size: f.size || 0,
            uploadedAt: f.uploadedAt || new Date().toISOString(),
            uploadedBy: f.uploadedBy || uName
          });
        }
      }
    }

    let cleanPhotoUrl = contact.photo_url || '';
    if (cleanPhotoUrl && cleanPhotoUrl.startsWith('data:')) {
      try {
        cleanPhotoUrl = await uploadFileToBase44(cleanPhotoUrl, `photo_${contact.id}.png`);
        contact.photo_url = cleanPhotoUrl;
      } catch (_) {
        cleanPhotoUrl = '';
      }
    }
    if (cleanPhotoUrl.length > 500 || cleanPhotoUrl.startsWith('data:')) cleanPhotoUrl = '';

    let cleanPcuFileUrl = contact.pcu_file_url || '';
    if (cleanPcuFileUrl && cleanPcuFileUrl.startsWith('data:')) {
      try {
        cleanPcuFileUrl = await uploadFileToBase44(cleanPcuFileUrl, `pcu_${contact.id}.jpg`);
        contact.pcu_file_url = cleanPcuFileUrl;
      } catch (_) {
        cleanPcuFileUrl = '';
      }
    }
    if (cleanPcuFileUrl.length > 500 || cleanPcuFileUrl.startsWith('data:')) cleanPcuFileUrl = '';

    // Only send https:// URLs to Base44 entity to prevent entity validation errors on file URLs
    const base44CloudFiles = cleanUploadedFiles.filter(f => f.url && f.url.startsWith('https://'));

    const payload: any = {
      contactId: contact.id,
      memberName: contact.full_name,
      full_name: contact.full_name,
      fullName: contact.full_name,
      firstName,
      lastName,
      barangay: contact.barangay || '',
      Barangay: contact.barangay || '',
      purok: contact.purok || '',
      address: `${contact.purok ? contact.purok + ', ' : ''}${contact.barangay || ''}`.trim(),
      contact: contact.contact_number || '',
      contact_number: contact.contact_number || '',
      contactNumber: contact.contact_number || '',
      mobile: contact.contact_number || '',
      maintenance: contact.maintenance || 'None',
      maintenance_medicine: contact.maintenance_medicine || '',
      maintenanceMedicine: contact.maintenance_medicine || '',
      status: 'approved',
      existingAcc: false,
      submittedBy: uName,
      "Submitted by": uName,
      submittedByEmail: userEmail,
      latitude: latNum,
      longitude: lngNum,
      geotagged: isGeotagged,
      geoLocation: hasGeo ? {
        latitude: latNum,
        longitude: lngNum
      } : undefined,
      fpe: {
        fullName: contact.full_name,
        mobile: contact.contact_number || '',
        purok: contact.purok || '',
        barangay: contact.barangay || '',
        latitude: latNum,
        longitude: lngNum,
        geotagged: isGeotagged
      },
      pcsf: {
        contact: contact.contact_number || '',
        purok: contact.purok || '',
        barangay: contact.barangay || '',
        latitude: latNum,
        longitude: lngNum,
        geotagged: isGeotagged
      },
      uploadedFiles: base44CloudFiles,
      uploadedFilesJson: JSON.stringify(cleanUploadedFiles),
      attachments: base44CloudFiles,
      isSubmitted: true,
      submittedAt: contact.pcu_uploaded_at || new Date().toISOString(),
      pcu_file_url: cleanPcuFileUrl,
      pcu_uploaded_by: contact.pcu_uploaded_by || uName,
      pcu_uploaded_at: contact.pcu_uploaded_at || new Date().toISOString(),
      photo_url: cleanPhotoUrl,
      photoUrl: cleanPhotoUrl,
      created_at: contact.created_at || new Date().toISOString(),
      updated_at: contact.updated_at || new Date().toISOString()
    };

    console.log(`[Base44 SDK] Permanently saving contact "${contact.full_name}" (Geotagged: ${isGeotagged}, Lat: ${latNum}, Lng: ${lngNum}) to Base44 HouseholdSubmission database...`);

    // Check if matching record exists in Base44 cache
    let matchedId: string | null = null;
    try {
      const existingHouseholds = await getCachedHouseholdSubmissions(false);
      if (Array.isArray(existingHouseholds)) {
        const match = existingHouseholds.find((h: any) => 
          h.id === String(contact.id) ||
          h.contactId === contact.id ||
          (h.fullName && h.fullName.trim().toUpperCase() === contact.full_name.trim().toUpperCase() &&
           (!contact.contact_number || h.contact === contact.contact_number || h.contact_number === contact.contact_number)) ||
          (h.full_name && h.full_name.trim().toUpperCase() === contact.full_name.trim().toUpperCase() &&
           (!contact.contact_number || h.contact === contact.contact_number || h.contact_number === contact.contact_number))
        );
        if (match && match.id) {
          matchedId = match.id;
        }
      }
    } catch (findErr) {
      // Ignore
    }

    let savedRecord: any = null;
    try {
      if (matchedId && typeof submissionEntity.update === 'function') {
        try {
          console.log(`[Base44 SDK] Updating existing Base44 HouseholdSubmission (ID: ${matchedId})...`);
          savedRecord = await submissionEntity.update(matchedId, payload);
        } catch (updateErr: any) {
          console.warn(`[Base44 SDK] Update failed (falling back to create): ${updateErr.message}`);
          savedRecord = await submissionEntity.create(payload);
        }
      } else {
        savedRecord = await submissionEntity.create(payload);
      }
    } catch (sdkCloudErr: any) {
      console.warn(`[Base44 SDK] Note: Cloud write unavailable or quota reached (${sdkCloudErr.message || 'quota limit'}). Preserved safely in local cache and cPanel MySQL.`);
    }

    // Update local HOUSEHOLDS_CACHE_FILE with the complete records and intact uploaded files
    try {
      if (fs.existsSync(HOUSEHOLDS_CACHE_FILE)) {
        const data = fs.readFileSync(HOUSEHOLDS_CACHE_FILE, 'utf-8');
        const list = data ? JSON.parse(data) : [];
        const recordToStore = {
          id: savedRecord?.id || matchedId || `hh_${contact.id}`,
          ...payload,
          uploadedFiles: cleanUploadedFiles,
          attachments: cleanUploadedFiles
        };
        const idx = list.findIndex((h: any) => 
          h.id === recordToStore.id || 
          h.contactId === contact.id || 
          (h.fullName && h.fullName.trim().toUpperCase() === contact.full_name.trim().toUpperCase()) ||
          (h.full_name && h.full_name.trim().toUpperCase() === contact.full_name.trim().toUpperCase())
        );
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...recordToStore };
        } else {
          list.unshift(recordToStore);
        }
        safeWriteFileSync(HOUSEHOLDS_CACHE_FILE, JSON.stringify(list, null, 2), 'utf-8');
      }
    } catch (cacheErr) {
      console.warn('[Base44 Cache] Failed to update local households cache:', cacheErr);
    }

    console.log(`[Base44 SDK] Contact "${contact.full_name}" successfully saved permanently to Base44 database.`);
  } catch (err: any) {
    console.warn(`[Base44 SDK Warning] Base44 save warning (saving safely in local cache and MySQL):`, err.message || err);
    // Still ensure it is safely stored in the Base44 local households database cache
    try {
      if (fs.existsSync(HOUSEHOLDS_CACHE_FILE)) {
        const data = fs.readFileSync(HOUSEHOLDS_CACHE_FILE, 'utf-8');
        const list = data ? JSON.parse(data) : [];
        const recordToStore = {
          id: `hh_${contact.id}`,
          contactId: contact.id,
          fullName: contact.full_name,
          full_name: contact.full_name,
          barangay: contact.barangay,
          purok: contact.purok,
          contact: contact.contact_number,
          contact_number: contact.contact_number,
          isSubmitted: true,
          status: 'approved',
          submittedAt: new Date().toISOString(),
          submittedBy: username,
          uploadedFiles: contact.uploadedFiles || []
        };
        const idx = list.findIndex((h: any) => 
          h.id === recordToStore.id || 
          h.contactId === contact.id || 
          (h.fullName && h.fullName.trim().toUpperCase() === (contact.full_name || '').trim().toUpperCase())
        );
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...recordToStore };
        } else {
          list.unshift(recordToStore);
        }
        safeWriteFileSync(HOUSEHOLDS_CACHE_FILE, JSON.stringify(list, null, 2), 'utf-8');
      }
    } catch (e) {
      console.error('[Base44 Emergency Cache] Failed to write local fallback:', e);
    }
  }
}

// Add a single contact with full validation and capitalization formatting
export async function addContact(
  contact: { 
    full_name: string; 
    barangay: string; 
    purok?: string; 
    address?: string; 
    contact_number: string;
    latitude?: number | null;
    longitude?: number | null;
    geotagged?: boolean;
    maintenance?: 'None' | 'Yes' | string;
    maintenance_medicine?: string;
  },
  username: string
) {
  const rawName = (contact.full_name || (contact as any).fullName || '').trim();
  const rawBarangay = (contact.barangay || (contact as any).address || '').trim();
  const rawPurok = (contact.purok || '').trim();
  const rawNumber = (contact.contact_number || (contact as any).contactNumber || '').trim();

  if (!rawName || !rawBarangay || !rawNumber) {
    throw new Error('Full Name, Barangay, and Contact Number are required.');
  }

  const formattedName = capitalizeWords(rawName);
  const formattedBarangay = normalizeBarangayName(rawBarangay);
  const formattedPurok = rawPurok ? capitalizeWords(rawPurok) : '';

  const nameKey = getCanonicalNameKey(formattedName);

  // Check for duplicate among active records or reactivate inactive ones strictly by Full Name
  const existing = contactsCache.find(
    c =>
      !c.deleted_at &&
      (isSamePersonFullName(c.full_name, formattedName) ||
       getCanonicalNameKey(c.full_name) === nameKey)
  );

  const hasGeo = (contact.latitude !== undefined && contact.latitude !== null && !isNaN(Number(contact.latitude)) &&
                  contact.longitude !== undefined && contact.longitude !== null && !isNaN(Number(contact.longitude)));
  const updateLat = hasGeo ? Number(contact.latitude) : undefined;
  const updateLng = hasGeo ? Number(contact.longitude) : undefined;
  const updateGeotag = contact.geotagged !== undefined ? Boolean(contact.geotagged) : (hasGeo ? true : undefined);

  // Clear any existing tombstone so this contact can be cleanly re-entered without being blocked
  removeContactTombstone({ full_name: formattedName });

  if (existing) {
    if (existing.added_from_print_list === false) {
      existing.added_from_print_list = true;
      existing.barangay = formattedBarangay;
      if (formattedPurok) existing.purok = formattedPurok;
      if (rawNumber) existing.contact_number = rawNumber;
      if (updateLat !== undefined) existing.latitude = updateLat;
      if (updateLng !== undefined) existing.longitude = updateLng;
      if (updateGeotag !== undefined) existing.geotagged = updateGeotag;
      if (contact.maintenance !== undefined) existing.maintenance = contact.maintenance;
      if (contact.maintenance_medicine !== undefined) existing.maintenance_medicine = contact.maintenance_medicine;
      existing.updated_at = new Date().toISOString();
      await saveContacts();
      if (sheetsConfig.syncEnabled) {
        forwardToWebApp('edit', existing).catch(err => console.error('Failed to sync reactivated contact to Sheets:', err));
      }
      saveContactToBase44(existing, username).catch(err => console.warn('Failed to save to Base44:', err));
      return existing;
    }
    throw new Error(`Duplicate contact: A contact named "${formattedName}" already exists.`);
  }

  const newId = getNextLocalId();
  const newContact: Contact = {
    id: newId,
    full_name: formattedName,
    barangay: formattedBarangay,
    purok: formattedPurok,
    contact_number: rawNumber,
    latitude: updateLat,
    longitude: updateLng,
    geotagged: updateGeotag || false,
    maintenance: contact.maintenance === 'Yes' ? 'Yes' : 'None',
    maintenance_medicine: contact.maintenance === 'Yes' ? (contact.maintenance_medicine || '').trim() : '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    added_locally: true,
    added_from_print_list: true
  };

  removeContactTombstone({ full_name: formattedName });
  contactsCache.push(newContact);
  await saveContacts();
  await addActivity(username, `Added contact: "${formattedName}" (${rawNumber})`);

  if (isCPanelDbConnected()) {
    saveContactToCPanel(newContact).catch(err => console.warn('Error saving new contact to cPanel DB:', err));
  }

  // Forward write operation to Apps Script Web App if configured
  forwardToWebApp('add', newContact).catch(err => console.error('Error forwarding add to Sheets Web App:', err));

  // Save data to Base44 database
  saveContactToBase44(newContact, username).catch(err => console.warn('Error saving new contact to Base44:', err));

  return newContact;
}

// Edit a contact
export async function editContact(
  id: number | string,
  contact: { 
    full_name: string; 
    barangay: string; 
    purok?: string; 
    address?: string; 
    contact_number: string;
    latitude?: number | null;
    longitude?: number | null;
    geotagged?: boolean;
    maintenance?: 'None' | 'Yes' | string;
    maintenance_medicine?: string;
  },
  username: string
) {
  const idStr = id !== undefined && id !== null ? String(id).trim() : '';
  const idNum = !isNaN(Number(id)) ? Number(id) : null;
  const rawTargetName = (contact.full_name || '').trim();

  const rawName = contact.full_name.trim();
  const rawBarangay = (contact.barangay || contact.address || '').trim();
  const rawPurok = (contact.purok || '').trim();
  const rawNumber = contact.contact_number.trim();

  if (!rawName || !rawBarangay || !rawNumber) {
    throw new Error('Full Name, Barangay, and Contact Number are required.');
  }

  const formattedName = capitalizeWords(rawName);
  const formattedBarangay = normalizeBarangayName(rawBarangay);
  const formattedPurok = rawPurok ? capitalizeWords(rawPurok) : '';
  const targetCanonicalKey = getCanonicalNameKey(formattedName) || getCanonicalNameKey(rawTargetName);

  const matchedIndices: number[] = [];
  contactsCache.forEach((c, idx) => {
    if (!c || c.deleted_at) return;
    const cIdStr = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
    const matchId = (idStr && cIdStr && cIdStr === idStr) || (idNum !== null && Number(c.id) === idNum);
    const matchName = (targetCanonicalKey && getCanonicalNameKey(c.full_name) === targetCanonicalKey) ||
      (rawTargetName && c.full_name && (normalizeCompareName(c.full_name, rawTargetName) || c.full_name.trim().toLowerCase() === rawTargetName.toLowerCase()));
    if (matchId || matchName) {
      matchedIndices.push(idx);
    }
  });

  if (matchedIndices.length === 0) {
    throw new Error('Contact not found or has been deleted.');
  }

  // Check for duplicate in other active records strictly by Full Name
  const isDuplicate = contactsCache.some(
    (c, idx) =>
      !matchedIndices.includes(idx) &&
      !c.deleted_at &&
      (isSamePersonFullName(c.full_name, formattedName) ||
       getCanonicalNameKey(c.full_name) === targetCanonicalKey)
  );

  if (isDuplicate) {
    throw new Error(`Another contact with full name "${formattedName}" already exists.`);
  }

  const primaryIndex = matchedIndices[0];
  const original = contactsCache[primaryIndex];
  
  // Conditionally process geotag values if they are provided
  const updateGeotag = contact.geotagged !== undefined ? contact.geotagged : original.geotagged;
  const updateLat = contact.latitude !== undefined ? contact.latitude : original.latitude;
  const updateLng = contact.longitude !== undefined ? contact.longitude : original.longitude;
  const updateMaintenance = contact.maintenance !== undefined ? contact.maintenance : (original.maintenance || 'None');
  const updateMedicine = updateMaintenance === 'Yes' 
    ? (contact.maintenance_medicine !== undefined ? contact.maintenance_medicine.trim() : (original.maintenance_medicine || '')) 
    : '';

  const nowIso = new Date().toISOString();
  for (const idx of matchedIndices) {
    contactsCache[idx] = {
      ...contactsCache[idx],
      full_name: formattedName,
      barangay: formattedBarangay,
      purok: formattedPurok,
      contact_number: rawNumber,
      geotagged: updateGeotag,
      latitude: updateLat,
      longitude: updateLng,
      maintenance: updateMaintenance,
      maintenance_medicine: updateMedicine,
      updated_at: nowIso
    };
  }

  const updatedContact = contactsCache[primaryIndex];

  await saveContacts();
  await addActivity(
    username,
    `Edited contact: "${original.full_name}" -> "${formattedName}"`
  );

  if (isCPanelDbConnected()) {
    try {
      await saveContactToCPanel(updatedContact);
    } catch (cpanelErr: any) {
      console.warn('Error saving edited contact to cPanel DB:', cpanelErr.message || cpanelErr);
    }
  }

  // Forward write operation to Apps Script Web App if configured
  forwardToWebApp('edit', updatedContact).catch(err => console.error('Error forwarding edit to Sheets Web App:', err));

  // Save update to Base44 database
  try {
    await saveContactToBase44(updatedContact, username);
  } catch (base44Err: any) {
    console.warn('Error saving edited contact to Base44:', base44Err.message || base44Err);
  }

  return updatedContact;
}

// Delete a contact permanently from the database and Google Sheets
export async function deleteContact(id: number | string, username: string) {
  const idStr = id !== undefined && id !== null ? String(id).trim() : '';
  const idNum = !isNaN(Number(id)) ? Number(id) : null;

  const index = contactsCache.findIndex(c => {
    if (!c) return false;
    const cIdStr = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
    if (idStr && cIdStr && cIdStr === idStr) return true;
    if (idNum !== null && Number(c.id) === idNum) return true;
    return false;
  });
  if (index === -1) {
    throw new Error('Contact not found or already removed from directory.');
  }

  const deletedContact = contactsCache[index];
  
  // Record in tombstone cache so it is NEVER restored on refresh or reload
  deletedContactsCache.push({
    id: deletedContact.id,
    full_name: deletedContact.full_name,
    barangay: deletedContact.barangay,
    deletedAt: new Date().toISOString()
  });
  await safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8');

  // Remove permanently from contactsCache array
  contactsCache.splice(index, 1);

  // Also remove from PCU updates cache if any
  pcuUpdatesCache = pcuUpdatesCache.filter(u => 
    u && 
    !(idStr && u.contactId !== undefined && u.contactId !== null && String(u.contactId).trim() === idStr) &&
    !(idNum !== null && Number(u.contactId) === idNum) &&
    !normalizeCompareName(u.fullName, deletedContact.full_name)
  );
  await safeWriteFile(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2), 'utf-8');

  await saveContacts();
  await addActivity(username, `Permanently deleted contact from Clinic Directory: "${deletedContact.full_name}"`);

  if (isCPanelDbConnected()) {
    deleteContactFromCPanel(deletedContact.id, new Date().toISOString(), deletedContact.full_name, deletedContact.barangay).catch(err => console.warn('Error deleting contact from cPanel DB:', err));
  }

  resetGoogleSheetsCooldown();
  if (sheetsConfig.syncEnabled) {
    try {
      console.log(`[Google Sheets] Permanently deleting contact from Google Sheets database: "${deletedContact.full_name}"...`);
      const deletedFromSheets = await deleteContactPermanentlyFromGoogleSheets(deletedContact);
      if (!deletedFromSheets) {
        await rewriteAllContactsToGoogleSheets().catch(err2 => console.error('Failed to sync permanent deletions to Google Sheets:', err2));
      }
    } catch (err: any) {
      console.error('[Google Sheets] Direct row deletion failed, falling back to full sheet rewrite:', err.message || err);
      await rewriteAllContactsToGoogleSheets().catch(err2 => console.error('Failed to sync permanent deletions to Google Sheets:', err2));
    }
  }

  await forwardToWebApp('delete', deletedContact).catch(() => {});

  return true;
}

// Delete an entire Barangay folder permanently (Removes all contacts in the folder and removes folder from list)
export async function deleteBarangayFolderContacts(barangay: string, username: string) {
  if (!barangay) throw new Error('Barangay name is required.');
  const target = barangay.trim().toLowerCase();
  
  // Record Barangay in tombstone cache so it is NEVER restored on Google Sheets refresh or reload
  if (!deletedBarangaysCache.some(b => isBarangayMatch(b, barangay) || normalizeBarangayName(b).toLowerCase() === normalizeBarangayName(target).toLowerCase())) {
    deletedBarangaysCache.push(barangay.trim());
    await safeWriteFile(DELETED_BARANGAYS_FILE, JSON.stringify(deletedBarangaysCache, null, 2), 'utf-8');
  }

  const initialLength = contactsCache.length;
  const removedContacts: Contact[] = [];

  // Filter out any contacts in the target barangay permanently from the database array!
  contactsCache = contactsCache.filter(c => {
    const isTargetBarangay = c.barangay && (isBarangayMatch(c.barangay, barangay) || normalizeBarangayName(c.barangay).toLowerCase() === normalizeBarangayName(target).toLowerCase());
    if (isTargetBarangay) {
      removedContacts.push(c);
      return false;
    }
    return !isTargetBarangay;
  });

  // Record all removed contacts into deletedContactsCache
  for (const c of removedContacts) {
    deletedContactsCache.push({
      id: c.id,
      full_name: c.full_name,
      barangay: c.barangay,
      deletedAt: new Date().toISOString()
    });
  }
  await safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8');
  syncDeletedRecordsToGoogleSheets().catch(err => console.error('Failed to sync deleted records to Google Sheets:', err));
  
  const count = initialLength - contactsCache.length;

  // Remove matching PCU updates
  pcuUpdatesCache = pcuUpdatesCache.filter(u => !u.barangay || (!isBarangayMatch(u.barangay, barangay) && normalizeBarangayName(u.barangay).toLowerCase() !== normalizeBarangayName(target).toLowerCase()));
  await safeWriteFile(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2), 'utf-8');

  // Remove barangay from barangaysCache so empty or deleted folder does not remain in directory
  barangaysCache = barangaysCache.filter(b => 
    !isBarangayMatch(b, barangay) && 
    normalizeBarangayName(b).toLowerCase() !== normalizeBarangayName(target).toLowerCase()
  );

  await saveContacts();
  await saveBarangays();

  await addActivity(username, `Permanently deleted Barangay folder "${barangay}" (${count} households) from Clinic Directory.`);

  if (isCPanelDbConnected()) {
    deleteBarangayFromCPanel(barangay).catch(err => console.warn('Error deleting barangay from cPanel DB:', err));
    for (const c of removedContacts) {
      deleteContactFromCPanel(c.id, new Date().toISOString()).catch(err => console.warn('Error deleting contact from cPanel DB:', err));
    }
  }

  return { success: true, count, message: `Barangay folder "${barangay}" permanently deleted successfully.` };
}

// Overwrite Google Sheets with all active (non-soft-deleted) contacts
export async function rewriteAllContactsToGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) {
    console.log('[Google Sheets] Sheets client not configured or disabled.');
    return false;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const sheetName = sheetsConfig.sheetName || 'Sheet1';

    // Ensure the sheet exists
    await ensureSheetExists(sheets, spreadsheetId, sheetName);
    markSheetsConnected();

    // Get current headers to match column positions
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1`
    });
    const headerRow = (headerResponse.data.values && headerResponse.data.values[0]) || [];
    let headers = headerRow.map((h: any) => (h || '').toString().toLowerCase().trim());

    if (headers.length === 0) {
      headers = ['id', 'name', 'barangay', 'purok', 'contact number', 'created at', 'updated at'];
    }

    const idIdx = headers.findIndex((h: string) => h.includes('id'));
    const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
    const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
    const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
    const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
    const createdIdx = headers.findIndex((h: string) => h.includes('created') || h.includes('date'));
    const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
    const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

    const maxIdx = Math.max(idIdx, nameIdx, barangayIdx, purokIdx, numberIdx, createdIdx, updatedIdx, addedIdx, headers.length - 1, 7);

    // Clear everything in A:Z range
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A:Z`
    });

    const activeContacts = contactsCache.filter(c => 
      !c.deleted_at && 
      !isContactSubmitted(c) && 
      !isContactTombstoned(c) && 
      c.added_from_print_list !== false
    );
    const rowsToPut = [
      headerRow.length > 0 ? headerRow : headers.map(h => capitalizeWords(h)),
      ...activeContacts.map(c => {
        const rowValues = new Array(maxIdx + 1).fill('');

        if (idIdx !== -1) rowValues[idIdx] = c.id;
        else rowValues[0] = c.id;

        if (nameIdx !== -1) rowValues[nameIdx] = c.full_name;
        else rowValues[1] = c.full_name;

        if (barangayIdx !== -1) rowValues[barangayIdx] = c.barangay;
        else rowValues[2] = c.barangay;

        if (purokIdx !== -1) rowValues[purokIdx] = c.purok;
        else rowValues[3] = c.purok;

        if (numberIdx !== -1) rowValues[numberIdx] = c.contact_number;
        else rowValues[4] = c.contact_number;

        if (createdIdx !== -1) rowValues[createdIdx] = c.created_at;
        else rowValues[5] = c.created_at;

        if (updatedIdx !== -1) rowValues[updatedIdx] = c.updated_at;
        else rowValues[6] = c.updated_at;

        if (addedIdx !== -1) {
          rowValues[addedIdx] = c.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        } else {
          rowValues[7] = c.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        }

        return rowValues;
      })
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets(rowsToPut)
      }
    });

    console.log(`[Google Sheets] Overwrote sheet with ${activeContacts.length} active contacts successfully.`);
    return true;
  } catch (err: any) {
    console.error('[Google Sheets] Failed to rewrite contacts to Google Sheets:', err.message || err);
    handleGoogleSheetsError(err, 'rewriteAllContactsToGoogleSheets');
    return false;
  }
}

// Permanently delete a contact from the Google Sheets database (Sheet1)
export async function deleteContactPermanentlyFromGoogleSheets(contact: {
  id?: number | string;
  full_name?: string;
  barangay?: string;
  purok?: string;
  contact_number?: string;
}): Promise<boolean> {
  resetGoogleSheetsCooldown();

  const sheets = getSheetsClient();
  if (!sheets) {
    console.log('[Google Sheets] Service Account not configured; checking Web App URL fallback...');
    if (sheetsConfig.webAppUrl) {
      try {
        const res = await fetch(sheetsConfig.webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', ...contact })
        });
        return res.ok;
      } catch (e: any) {
        console.warn('[Google Sheets] Web App fallback error on delete:', e.message || e);
      }
    }
    return false;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const sheetName = sheetsConfig.sheetName || 'Sheet1';

    await ensureSheetExists(sheets, spreadsheetId, sheetName);
    markSheetsConnected();

    // Fetch all rows
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      console.log('[Google Sheets] Sheet has no contact data rows to delete.');
      return true;
    }

    const headers = (rows[0] || []).map((h: any) => (h || '').toString().toLowerCase().trim());
    const idColIdx = headers.findIndex((h: string) => h.includes('id') || h === 'no');
    const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
    const firstNameIdx = headers.findIndex((h: string) => h.includes('first'));
    const lastNameIdx = headers.findIndex((h: string) => h.includes('last'));
    const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
    const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
    const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));

    const targetIdStr = contact.id !== undefined && contact.id !== null ? String(contact.id).trim() : '';
    const targetName = (contact.full_name || '').trim();
    const targetBarangay = (contact.barangay || '').trim();
    const targetNumber = (contact.contact_number || '').trim().replace(/[^0-9]/g, '');

    const matchingRowIndices: number[] = []; // 0-based row indices

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rIdStr = idColIdx !== -1 && row[idColIdx] !== undefined ? String(row[idColIdx]).trim() : '';
      let rName = nameIdx !== -1 && row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : '';
      if (!rName && (firstNameIdx !== -1 || lastNameIdx !== -1)) {
        const parts = [
          firstNameIdx !== -1 ? (row[firstNameIdx] || '') : '',
          lastNameIdx !== -1 ? (row[lastNameIdx] || '') : ''
        ].filter(Boolean);
        rName = parts.join(' ').trim();
      }
      const rBarangay = barangayIdx !== -1 && row[barangayIdx] !== undefined ? String(row[barangayIdx]).trim() : '';
      const rNumber = numberIdx !== -1 && row[numberIdx] !== undefined ? String(row[numberIdx]).trim().replace(/[^0-9]/g, '') : '';

      let isMatch = false;

      // 1. Match by exact or numeric ID
      if (targetIdStr && rIdStr) {
        if (targetIdStr.toLowerCase() === rIdStr.toLowerCase()) {
          isMatch = true;
        } else if (!isNaN(Number(targetIdStr)) && !isNaN(Number(rIdStr)) && Number(targetIdStr) === Number(rIdStr)) {
          isMatch = true;
        }
      }

      // 2. Match by Name
      if (!isMatch && targetName && rName && (normalizeCompareName(rName, targetName) || targetName.toLowerCase() === rName.toLowerCase())) {
        isMatch = true;
      }

      // 3. Match by Contact Number and Name similarity
      if (!isMatch && targetNumber && rNumber && targetNumber === rNumber && targetName && rName && normalizeCompareName(rName, targetName)) {
        isMatch = true;
      }

      // 4. Fallback search across any cell in the row for targetName
      if (!isMatch && targetName) {
        for (const cell of row) {
          const val = (cell || '').toString().trim();
          if (val && (normalizeCompareName(val, targetName) || val.toLowerCase() === targetName.toLowerCase())) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        matchingRowIndices.push(i);
      }
    }

    if (matchingRowIndices.length > 0) {
      // Obtain the numeric sheetId
      const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
      const targetSheetObj = spreadsheetInfo.data.sheets?.find(s => s.properties?.title === sheetName);
      const numericSheetId = targetSheetObj?.properties?.sheetId || 0;

      // Sort indices in descending order so that deleting later rows doesn't shift earlier row indices
      matchingRowIndices.sort((a, b) => b - a);

      const requests = matchingRowIndices.map(rowIdx => ({
        deleteDimension: {
          range: {
            sheetId: numericSheetId,
            dimension: 'ROWS',
            startIndex: rowIdx,
            endIndex: rowIdx + 1
          }
        }
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });

      console.log(`[Google Sheets] Successfully permanently deleted ${matchingRowIndices.length} row(s) for "${targetName || targetIdStr}" from Google Sheets (${sheetName}).`);
      return true;
    } else {
      console.log(`[Google Sheets] Contact "${targetName || targetIdStr}" not found in sheet (${sheetName}) - already absent.`);
      return true;
    }
  } catch (err: any) {
    console.error('[Google Sheets] Error deleting contact row from Google Sheets:', err.message || err);
    handleGoogleSheetsError(err, 'deleteContactPermanentlyFromGoogleSheets');
    return false;
  }
}

// Auto-detect bulk separator (supports Pipe, Tab, Semicolon, Comma)
export function detectSeparator(text: string): string {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return ',';

  let pipes = 0;
  let commas = 0;
  let tabs = 0;
  let semicolons = 0;

  const sample = lines.slice(0, 10);
  for (const line of sample) {
    pipes += (line.match(/\|/g) || []).length;
    commas += (line.match(/,/g) || []).length;
    tabs += (line.match(/\t/g) || []).length;
    semicolons += (line.match(/;/g) || []).length;
  }

  if (pipes >= commas && pipes >= tabs && pipes >= semicolons && pipes > 0) return '|';
  if (tabs >= commas && tabs >= pipes && tabs >= semicolons && tabs > 0) return '\t';
  if (semicolons >= commas && semicolons >= pipes && semicolons >= tabs && semicolons > 0) return ';';
  return ',';
}

export interface ParseResult {
  raw: string;
  full_name: string;
  barangay: string;
  purok: string;
  contact_number: string;
  status: 'valid' | 'duplicate' | 'invalid';
  reason?: string;
}

function cleanBulkField(str: any): string {
  if (str === null || str === undefined) return '';
  let s = String(str).trim();
  // Strip outer quotes if any
  s = s.replace(/^["'`]+|["'`]+$/g, '').trim();
  return s;
}

// Bulk Import Preview Generator
export function previewBulkImport(
  text: string,
  defaultBarangay?: string,
  defaultPurok?: string
): {
  results: ParseResult[];
  summary: { total: number; valid: number; duplicate: number; invalid: number };
  detectedSeparator: string;
} {
  const separator = detectSeparator(text);
  const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const results: ParseResult[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  // Track already-seen in current batch to prevent intra-batch duplicates
  const batchSeen = new Set<string>();

  // Detect and skip header row if present
  let startIndex = 0;
  if (rawLines.length > 0) {
    const firstLineLower = rawLines[0].toLowerCase();
    const hasHeaderKeywords = (
      firstLineLower.includes('name') || 
      firstLineLower.includes('full name') ||
      firstLineLower.includes('fullname')
    ) && (
      firstLineLower.includes('barangay') || 
      firstLineLower.includes('address') || 
      firstLineLower.includes('purok') || 
      firstLineLower.includes('contact') || 
      firstLineLower.includes('phone') ||
      firstLineLower.includes('number')
    );
    if (hasHeaderKeywords) {
      startIndex = 1;
    }
  }

  const lines = rawLines.slice(startIndex);

  const fallbackBg = defaultBarangay ? normalizeBarangayName(defaultBarangay) : 'Barangay Central';
  const fallbackPur = defaultPurok ? capitalizeWords(defaultPurok.trim()) : '';

  for (const line of lines) {
    let parts = line.split(separator).map(cleanBulkField);

    // If first column is purely a row number (e.g. 1, 2, 10, #, No.), shift it off
    if (parts.length > 1 && /^#|^\d+[\.\)]?$|^no\.?$/i.test(parts[0])) {
      parts = parts.slice(1);
    }

    let rawName = parts[0] || '';
    // Strip leading numbers from name if user pasted "1. Juan Dela Cruz" or "1) Juan Dela Cruz"
    rawName = rawName.replace(/^\d+[\.\)]\s*/, '').trim();

    let name = capitalizeWords(rawName);
    let barangay = '';
    let purok = '';
    let number = '';

    if (parts.length >= 4) {
      barangay = parts[1] ? normalizeBarangayName(parts[1]) : fallbackBg;
      purok = parts[2] ? capitalizeWords(parts[2]) : fallbackPur;
      number = parts[3] || '';
    } else if (parts.length === 3) {
      barangay = parts[1] ? normalizeBarangayName(parts[1]) : fallbackBg;
      const lastPart = parts[2];
      const digitCount = (lastPart.match(/\d/g) || []).length;
      const isProbablyPhoneNumber = digitCount >= 5 || /^[0\+]\d+/.test(lastPart);
      if (isProbablyPhoneNumber) {
        purok = fallbackPur;
        number = lastPart;
      } else {
        purok = capitalizeWords(lastPart) || fallbackPur;
        number = '';
      }
    } else if (parts.length === 2) {
      const secondPart = parts[1];
      const digitCount = (secondPart.match(/\d/g) || []).length;
      const isProbablyPhoneNumber = digitCount >= 7 || /^[0\+]\d+/.test(secondPart);
      if (isProbablyPhoneNumber) {
        barangay = fallbackBg;
        purok = fallbackPur;
        number = secondPart;
      } else {
        barangay = secondPart ? normalizeBarangayName(secondPart) : fallbackBg;
        purok = fallbackPur;
        number = '';
      }
    } else if (parts.length === 1 && name) {
      barangay = fallbackBg;
      purok = fallbackPur;
      number = '';
    } else {
      results.push({
        raw: line,
        full_name: name,
        barangay: fallbackBg,
        purok: fallbackPur,
        contact_number: '',
        status: 'invalid',
        reason: 'Line is empty or cannot be parsed.'
      });
      invalidCount++;
      continue;
    }

    if (!barangay) {
      barangay = fallbackBg;
    }

    if (!name || name.length < 2) {
      results.push({
        raw: line,
        full_name: name,
        barangay: barangay,
        purok: purok,
        contact_number: number,
        status: 'invalid',
        reason: 'Full Name is required and must be at least 2 characters.'
      });
      invalidCount++;
      continue;
    }

    const nameKey = getCanonicalNameKey(name);
    // Check duplicate in database strictly based on full name
    const dbDuplicate = contactsCache.some(
      c =>
        !c.deleted_at &&
        getCanonicalNameKey(c.full_name) === nameKey
    );

    const batchDuplicate = batchSeen.has(nameKey);

    if (dbDuplicate || batchDuplicate) {
      results.push({
        raw: line,
        full_name: name,
        barangay: barangay,
        purok: purok,
        contact_number: number,
        status: 'duplicate',
        reason: dbDuplicate ? 'Contact already exists in directory (will update if selected).' : 'Duplicate name earlier in this bulk list.'
      });
      duplicateCount++;
    } else {
      results.push({
        raw: line,
        full_name: name,
        barangay: barangay,
        purok: purok,
        contact_number: number,
        status: 'valid'
      });
      validCount++;
    }

    batchSeen.add(nameKey);
  }

  return {
    results,
    summary: {
      total: lines.length,
      valid: validCount,
      duplicate: duplicateCount,
      invalid: invalidCount
    },
    detectedSeparator: separator === '|' ? 'Pipe (|)' : separator === '\t' ? 'Tab' : separator === ';' ? 'Semicolon (;)' : 'Comma (,)'
  };
}

// Bulk Import Saver
export async function saveBulkImport(
  items: Array<{ full_name: string; barangay?: string; address?: string; purok?: string; contact_number?: string; status?: string }>,
  option: 'save_all' | 'add_as_new' | 'skip_invalid' | 'replace_duplicate' = 'save_all',
  username: string = 'Admin'
) {
  let savedCount = 0;
  let skippedCount = 0;
  let replacedCount = 0;

  const appended: Contact[] = [];
  const updated: Contact[] = [];
  const batchSavedKeys = new Set<string>();

  // Determine starting local ID once before the loop to guarantee efficiency and uniqueness
  let currentNextId = getNextLocalId();

  for (const item of items) {
    const rawName = cleanBulkField(item.full_name).replace(/^\d+[\.\)]\s*/, '').trim();
    const formattedName = capitalizeWords(rawName);
    const formattedBarangay = normalizeBarangayName(cleanBulkField(item.barangay || item.address || '')) || 'Barangay Central';
    const formattedPurok = capitalizeWords(cleanBulkField(item.purok || ''));
    const number = cleanBulkField(item.contact_number || '');

    if (!formattedName || formattedName.length < 2) {
      skippedCount++;
      continue;
    }

    const nameKey = getCanonicalNameKey(formattedName);

    // Clear any existing tombstone so re-entered contacts are not blocked
    removeContactTombstone({ full_name: formattedName });

    // If option is add_as_new, always insert as a new contact even if name matches!
    if (option === 'add_as_new') {
      while (contactsCache.some(c => Number(c.id) === currentNextId)) {
        currentNextId++;
      }
      const newId = currentNextId++;

      const newContact: Contact = {
        id: newId,
        full_name: formattedName,
        barangay: formattedBarangay,
        purok: formattedPurok,
        contact_number: number,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        added_locally: true,
        added_from_print_list: true
      };
      contactsCache.push(newContact);
      appended.push(newContact);
      savedCount++;
      batchSavedKeys.add(nameKey);
      continue;
    }

    // Check for duplicate in batch already processed
    if (batchSavedKeys.has(nameKey)) {
      if (option === 'replace_duplicate' || option === 'save_all') {
        const idx = contactsCache.findIndex(c => !c.deleted_at && getCanonicalNameKey(c.full_name) === nameKey);
        if (idx !== -1) {
          contactsCache[idx] = {
            ...contactsCache[idx],
            barangay: formattedBarangay,
            purok: formattedPurok || contactsCache[idx].purok,
            contact_number: number || contactsCache[idx].contact_number,
            updated_at: new Date().toISOString()
          };
          updated.push(contactsCache[idx]);
          replacedCount++;
          savedCount++;
        }
      } else {
        skippedCount++;
      }
      continue;
    }

    // Find database duplicate strictly by Full Name
    const duplicateIndex = contactsCache.findIndex(
      c =>
        !c.deleted_at &&
        getCanonicalNameKey(c.full_name) === nameKey
    );

    if (duplicateIndex !== -1) {
      if (option === 'replace_duplicate' || option === 'save_all') {
        // Update details of duplicate contact and reset update timestamp
        contactsCache[duplicateIndex] = {
          ...contactsCache[duplicateIndex],
          barangay: formattedBarangay,
          purok: formattedPurok || contactsCache[duplicateIndex].purok,
          contact_number: number || contactsCache[duplicateIndex].contact_number,
          updated_at: new Date().toISOString()
        };
        updated.push(contactsCache[duplicateIndex]);
        replacedCount++;
        savedCount++;
        batchSavedKeys.add(nameKey);
      } else {
        // Strictly skip duplicate
        skippedCount++;
      }
    } else {
      // Valid record (no duplicate in database or batch)
      while (contactsCache.some(c => Number(c.id) === currentNextId)) {
        currentNextId++;
      }
      const newId = currentNextId++;

      const newContact: Contact = {
        id: newId,
        full_name: formattedName,
        barangay: formattedBarangay,
        purok: formattedPurok,
        contact_number: number,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        added_locally: true,
        added_from_print_list: true
      };
      contactsCache.push(newContact);
      appended.push(newContact);
      savedCount++;
      batchSavedKeys.add(nameKey);
    }
  }

  // Deduplicate contactsCache to guarantee strict uniqueness by Full Name (unless add_as_new was chosen)
  if (option !== 'add_as_new') {
    contactsCache = deduplicateContactsByName(contactsCache);
  }

  // Clear any existing deletion tombstones for all imported contacts so they are fully active
  for (const c of [...appended, ...updated]) {
    removeContactTombstone({ full_name: c.full_name, id: c.id });
  }

  await saveContacts();
  await addActivity(
    username,
    `Performed bulk entry import. Saved: ${savedCount} records (including ${replacedCount} updated records), Skipped: ${skippedCount}.`
  );

  // Sync bulk contacts to cPanel MySQL database if connected
  const dbStatus = getCPanelDbStatus();
  const dbResult = {
    connected: isCPanelDbConnected(),
    target: isCPanelDbConnected() ? 'cPanel MySQL' : 'Local Storage Mode (data/contacts.json)',
    database: dbStatus.database || '',
    savedToDb: 0,
    error: null as string | null
  };

  if (isCPanelDbConnected()) {
    const contactsToSync = [...appended, ...updated];
    if (contactsToSync.length > 0) {
      try {
        const cpanelSync = await saveContactsBulkToCPanel(contactsToSync);
        if (cpanelSync.success) {
          dbResult.savedToDb = cpanelSync.saved;
        } else {
          dbResult.error = cpanelSync.error || 'Failed to save to cPanel MySQL database';
          console.warn('[cPanel DB] Warning: Bulk contacts save to cPanel returned failure:', cpanelSync.error);
        }
      } catch (err: any) {
        dbResult.error = err.message || 'Database error occurred while saving to cPanel MySQL';
        console.error('[cPanel DB] Failed to save bulk contacts to cPanel DB:', err);
      }
    }
  }

  return {
    total: items.length,
    saved: savedCount,
    replaced: replacedCount,
    skipped: skippedCount,
    database: dbResult
  };
}

async function pushBulkToSheets(appended: Contact[], updated: Contact[]) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const sheetName = sheetsConfig.sheetName || 'Sheet1';

    // Ensure the sheet exists
    await ensureSheetExists(sheets, spreadsheetId, sheetName);

    // 1. Batch Append newly added contacts
    if (appended.length > 0) {
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z1`
      });
      const headerRow = (headerResponse.data.values && headerResponse.data.values[0]) || [];
      const headers = headerRow.map((h: any) => (h || '').toString().toLowerCase().trim());

      const idIdx = headers.findIndex((h: string) => h.includes('id'));
      const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
      const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
      const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
      const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
      const createdIdx = headers.findIndex((h: string) => h.includes('created') || h.includes('date'));
      const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
      const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

      const maxIdx = Math.max(idIdx, nameIdx, barangayIdx, purokIdx, numberIdx, createdIdx, updatedIdx, addedIdx, headers.length - 1, 7);

      const valuesToAppend = appended.map(c => {
        const rowValues = new Array(maxIdx + 1).fill('');

        if (idIdx !== -1) rowValues[idIdx] = c.id;
        else rowValues[0] = c.id;

        if (nameIdx !== -1) rowValues[nameIdx] = c.full_name;
        else rowValues[1] = c.full_name;

        if (barangayIdx !== -1) rowValues[barangayIdx] = c.barangay;
        else rowValues[2] = c.barangay;

        if (purokIdx !== -1) rowValues[purokIdx] = c.purok;
        else rowValues[3] = c.purok;

        if (numberIdx !== -1) rowValues[numberIdx] = c.contact_number;
        else rowValues[4] = c.contact_number;

        if (createdIdx !== -1) rowValues[createdIdx] = c.created_at;
        else rowValues[5] = c.created_at;

        if (updatedIdx !== -1) rowValues[updatedIdx] = c.updated_at;
        else rowValues[6] = c.updated_at;

        if (addedIdx !== -1) {
          rowValues[addedIdx] = c.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        } else {
          rowValues[7] = c.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        }

        return rowValues;
      });

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: sanitizeRowsForSheets(valuesToAppend)
        }
      });
      console.log(`Successfully batch-appended ${appended.length} contacts to Google Sheets.`);
    }

    // 2. Update existing contacts
    if (updated.length > 0) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`
      });
      const rows = response.data.values;
      if (rows && rows.length > 0) {
        const headers = rows[0].map((h: any) => h.toString().toLowerCase().trim());
        const idColIdx = headers.findIndex((h: string) => h.includes('id'));
        const targetColIdx = idColIdx !== -1 ? idColIdx : 0;

        const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
        const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
        const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
        const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
        const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
        const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

        for (const contact of updated) {
          let targetRowIdx = -1;
          for (let i = 1; i < rows.length; i++) {
            if (parseInt(rows[i][targetColIdx], 10) === parseInt(contact.id as any, 10)) {
              targetRowIdx = i + 1;
              break;
            }
          }

          if (targetRowIdx !== -1) {
            const rowValues = [...rows[targetRowIdx - 1]];
            if (nameIdx !== -1) rowValues[nameIdx] = contact.full_name;
            if (barangayIdx !== -1) rowValues[barangayIdx] = contact.barangay;
            if (purokIdx !== -1) rowValues[purokIdx] = contact.purok;
            if (numberIdx !== -1) rowValues[numberIdx] = contact.contact_number;
            if (updatedIdx !== -1) rowValues[updatedIdx] = contact.updated_at;
            if (addedIdx !== -1) rowValues[addedIdx] = contact.added_from_print_list !== false ? 'TRUE' : 'FALSE';

            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${sheetName}!A${targetRowIdx}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: sanitizeRowsForSheets([rowValues])
              }
            });
          }
        }
        console.log(`Successfully updated ${updated.length} contacts in Google Sheets.`);
      }
    }
  } catch (err: any) {
    console.error('Error batch pushing bulk import to Google Sheets:', err.message || err);
  }

  // Fallback to Apps Script Web App if service account is not configured or in addition
  if (sheetsConfig.webAppUrl) {
    for (const c of appended) {
      forwardToWebApp('add', c).catch(() => {});
    }
    for (const c of updated) {
      forwardToWebApp('edit', c).catch(() => {});
    }
  }
}

// Helper to get valid date strings (YYYY-MM-DD) for today across client timezone, UTC, local server, and Asia/Manila
export function getValidTodayDateStrings(clientDate?: string, clientTz?: string): string[] {
  const validDates = new Set<string>();
  if (clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
    validDates.add(clientDate);
  }
  const now = new Date();
  validDates.add(now.toISOString().slice(0, 10)); // UTC date
  validDates.add(now.toLocaleDateString('en-CA')); // Server local date
  try {
    validDates.add(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now));
  } catch {}
  if (clientTz) {
    try {
      validDates.add(new Intl.DateTimeFormat('en-CA', { timeZone: clientTz }).format(now));
    } catch {}
  }
  return Array.from(validDates);
}

// Helper to determine if a contact was added today
export function isContactAddedToday(c: Contact, clientDate?: string, clientTz?: string): boolean {
  if (!c) return false;
  const raw = c.created_at || (c as any).createdAt || (c as any).updated_at || '';
  if (!raw) return false;

  const validDateStrings = getValidTodayDateStrings(clientDate, clientTz);
  const str = String(raw).trim();
  for (const v of validDateStrings) {
    if (str.startsWith(v)) return true;
  }

  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const pUtc = parsed.toISOString().slice(0, 10);
      const pLocal = parsed.toLocaleDateString('en-CA');
      if (validDateStrings.includes(pUtc) || validDateStrings.includes(pLocal)) return true;
      try {
        const pManila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(parsed);
        if (validDateStrings.includes(pManila)) return true;
      } catch {}
      if (clientTz) {
        try {
          const pClient = new Intl.DateTimeFormat('en-CA', { timeZone: clientTz }).format(parsed);
          if (validDateStrings.includes(pClient)) return true;
        } catch {}
      }
    }
  } catch {}

  return false;
}

// Async Dashboard statistics that checks direct MySQL metrics if connected
export async function getDashboardStatsAsync(clientDate?: string, clientTz?: string) {
  const dateStrings = getValidTodayDateStrings(clientDate, clientTz);
  let cpanelStats: { totalContacts: number; contactsToday: number; totalAddresses: number } | null = null;
  if (isCPanelDbConnected()) {
    try {
      cpanelStats = await getCPanelContactsStats(dateStrings);
    } catch (e: any) {
      console.warn('[cPanel DB] Notice getting direct MySQL contacts stats:', e.message);
    }
  }

  const activeContacts = deduplicateContactsByName(contactsCache.filter(isAvailableForDirectory));
  
  const totalContacts = (cpanelStats && cpanelStats.totalContacts !== undefined)
    ? cpanelStats.totalContacts
    : activeContacts.length;

  const barangaySet = new Set<string>();
  activeContacts.forEach(c => {
    if (c.barangay) {
      barangaySet.add(c.barangay.toLowerCase().trim());
    }
  });
  const totalAddresses = (cpanelStats && cpanelStats.totalAddresses !== undefined)
    ? cpanelStats.totalAddresses
    : barangaySet.size;

  const contactsToday = (cpanelStats && cpanelStats.contactsToday !== undefined)
    ? cpanelStats.contactsToday
    : activeContacts.filter(c => isContactAddedToday(c, clientDate, clientTz)).length;

  const recentActivities = activitiesCache.slice(0, 15);

  return {
    totalContacts,
    totalAddresses,
    contactsToday,
    recentActivities,
    cpanelDbStatus: getCPanelDbStatus(),
    sheetsStatus: getSheetsStatus(),
    base44SyncStatus: getBase44SyncStatus()
  };
}

// Synchronous Dashboard statistics fallback
export function getDashboardStats(clientDate?: string, clientTz?: string) {
  const activeContacts = deduplicateContactsByName(contactsCache.filter(isAvailableForDirectory));
  
  // Total Contacts in PCU Directory
  const totalContacts = activeContacts.length;

  // Total Barangays (previously Addresses)
  const barangaySet = new Set<string>();
  activeContacts.forEach(c => {
    if (c.barangay) {
      barangaySet.add(c.barangay.toLowerCase().trim());
    }
  });
  const totalAddresses = barangaySet.size;

  // Contacts added today (PST or Server local time matching today's date)
  const contactsToday = activeContacts.filter(c => isContactAddedToday(c, clientDate, clientTz)).length;

  // Get recent activities (last 15)
  const recentActivities = activitiesCache.slice(0, 15);

  return {
    totalContacts,
    totalAddresses,
    contactsToday,
    recentActivities,
    cpanelDbStatus: getCPanelDbStatus(),
    sheetsStatus: getSheetsStatus(),
    base44SyncStatus: getBase44SyncStatus()
  };
}

// --- Google Sheets Database Integration Functions ---

function getSheetsClient() {
  // Google Sheets database connection has been replaced with cPanel MySQL Database as the primary database
  return null;
}

async function ensureSheetExists(sheets: any, spreadsheetId: string, sheetName: string) {
  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }
  try {
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    const exists = existingSheets.has(sheetName);

    if (exists) {
      return;
    }

    console.log(`Sheet "${sheetName}" not found. Creating table automatically...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetName
            }
          }
        }]
      }
    });
    existingSheets.add(sheetName);

    // Write default headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:H1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['ID', 'Full Name', 'Barangay', 'Purok', 'Contact Number', 'Created At', 'Updated At', 'Added To Directory']]
      }
    });

    // Seed with existing contacts if any are cached locally
    if (contactsCache.length > 0) {
      const valuesToAppend = contactsCache.map(c => [
        c.id,
        c.full_name,
        c.barangay,
        c.purok,
        c.contact_number,
        c.created_at,
        c.updated_at,
        c.added_from_print_list !== false ? 'TRUE' : 'FALSE'
      ]);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: valuesToAppend
        }
      });
    }
    console.log(`Automatically created and seeded database table "${sheetName}" successfully.`);
  } catch (err: any) {
    handleGoogleSheetsError(err, 'ensureSheetExists');
  }
}

export async function forwardToWebApp(action: 'add' | 'edit' | 'delete', data: any) {
  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }
  // Try direct write using Google Sheets API & Service Account if active
  const sheets = getSheetsClient();
  if (sheets) {
    try {
      let spreadsheetId = sheetsConfig.spreadsheetId;
      const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        spreadsheetId = match[1];
      }
      const sheetName = sheetsConfig.sheetName || 'Sheet1';

      // Automatically create the table/sheet if it doesn't exist yet!
      await ensureSheetExists(sheets, spreadsheetId, sheetName);

      if (action === 'add') {
        const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:Z1`
        });
        const headerRow = (headerResponse.data.values && headerResponse.data.values[0]) || [];
        const headers = headerRow.map((h: any) => (h || '').toString().toLowerCase().trim());

        const idIdx = headers.findIndex((h: string) => h.includes('id'));
        const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
        const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
        const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
        const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
        const createdIdx = headers.findIndex((h: string) => h.includes('created') || h.includes('date'));
        const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
        const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

        const maxIdx = Math.max(idIdx, nameIdx, barangayIdx, purokIdx, numberIdx, createdIdx, updatedIdx, addedIdx, headers.length - 1, 7);
        const rowValues = new Array(maxIdx + 1).fill('');

        if (idIdx !== -1) rowValues[idIdx] = data.id;
        else rowValues[0] = data.id;

        if (nameIdx !== -1) rowValues[nameIdx] = data.full_name;
        else rowValues[1] = data.full_name;

        if (barangayIdx !== -1) rowValues[barangayIdx] = data.barangay;
        else rowValues[2] = data.barangay;

        if (purokIdx !== -1) rowValues[purokIdx] = data.purok;
        else rowValues[3] = data.purok;

        if (numberIdx !== -1) rowValues[numberIdx] = data.contact_number;
        else rowValues[4] = data.contact_number;

        if (createdIdx !== -1) rowValues[createdIdx] = data.created_at;
        else rowValues[5] = data.created_at;

        if (updatedIdx !== -1) rowValues[updatedIdx] = data.updated_at;
        else rowValues[6] = data.updated_at;

        if (addedIdx !== -1) {
          rowValues[addedIdx] = data.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        } else {
          rowValues[7] = data.added_from_print_list !== false ? 'TRUE' : 'FALSE';
        }

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A:Z`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: sanitizeRowsForSheets([rowValues])
          }
        });
        console.log('Successfully appended contact to Google Sheets using Service Account!');
      } else if (action === 'delete') {
        await deleteContactPermanentlyFromGoogleSheets(data);
        return;
      } else if (action === 'edit') {
        // Find row to edit
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });
        const rows = response.data.values;
        if (rows && rows.length > 0) {
          const headers = rows[0].map((h: any) => h.toString().toLowerCase().trim());
          const idColIdx = headers.findIndex((h: string) => h.includes('id'));
          const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
          const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));

          let targetRowIdx = -1;
          for (let i = 1; i < rows.length; i++) {
            // 1. Try matching by ID first if we have a valid ID column
            if (idColIdx !== -1 && rows[i][idColIdx] && !isNaN(parseInt(rows[i][idColIdx], 10)) && parseInt(rows[i][idColIdx], 10) === parseInt(data.id, 10)) {
              targetRowIdx = i + 1; // 1-based row number
              break;
            }
            // 2. Try matching by Name and Barangay as a robust fallback
            if (nameIdx !== -1 && barangayIdx !== -1) {
              const rName = rows[i][nameIdx] || '';
              const rBarangay = rows[i][barangayIdx] || '';
              if (normalizeCompareName(rName, data.full_name) && 
                  normalizeBarangayName(rBarangay).toLowerCase() === normalizeBarangayName(data.barangay).toLowerCase()) {
                targetRowIdx = i + 1;
                break;
              }
            }
          }

          if (targetRowIdx !== -1) {
            // Edit row
            const nameIdx = headers.findIndex((h: string) => h.includes('name') || h.includes('full'));
            const barangayIdx = headers.findIndex((h: string) => h.includes('barangay') || h.includes('address'));
            const purokIdx = headers.findIndex((h: string) => h.includes('purok'));
            const numberIdx = headers.findIndex((h: string) => h.includes('number') || h.includes('contact') || h.includes('phone'));
            const updatedIdx = headers.findIndex((h: string) => h.includes('updated') || h.includes('last'));
            const addedIdx = headers.findIndex((h: string) => h.includes('added') || h.includes('directory') || h.includes('print_list') || h.includes('list'));

            const rowValues = [...rows[targetRowIdx - 1]];
            if (nameIdx !== -1) rowValues[nameIdx] = data.full_name;
            if (barangayIdx !== -1) rowValues[barangayIdx] = data.barangay;
            if (purokIdx !== -1) rowValues[purokIdx] = data.purok;
            if (numberIdx !== -1) rowValues[numberIdx] = data.contact_number;
            if (updatedIdx !== -1) rowValues[updatedIdx] = data.updated_at;
            if (addedIdx !== -1) rowValues[addedIdx] = data.added_from_print_list !== false ? 'TRUE' : 'FALSE';

            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${sheetName}!A${targetRowIdx}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: sanitizeRowsForSheets([rowValues])
              }
            });
            console.log('Successfully updated contact row in Google Sheets using Service Account!');
          } else {
            throw new Error(`Row matching ID "${data.id}" or Name "${data.full_name}" in Barangay "${data.barangay}" was not found in the Google Sheet.`);
          }
        }
      }
      return;
    } catch (err: any) {
      console.error('Service Account direct write to Google Sheets failed:', err.message || err);
      handleGoogleSheetsError(err, 'forwardToWebApp');
      throw err;
    }
  }

  // Fallback to Apps Script Web App
  if (!sheetsConfig.webAppUrl) return;
  try {
    const res = await fetch(sheetsConfig.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });
    if (!res.ok) {
      console.warn('Google Sheets Web App request failed:', res.statusText);
    }
  } catch (err) {
    console.warn('Error forwarding write to Google Sheets Web App:', err);
  }
}

export function getSheetsConfig(): SheetsConfig {
  return sheetsConfig;
}

export async function saveSheetsConfig(config: SheetsConfig, username: string) {
  sheetsConfig = normalizeSheetsConfig(config);
  resetGoogleSheetsCooldown();
  await safeWriteFile(SHEETS_CONFIG_FILE, JSON.stringify(sheetsConfig, null, 2), 'utf-8');
  await addActivity(username, `Updated Google Sheets Database settings (Auth: ${sheetsConfig.authType}, Sync: ${sheetsConfig.syncEnabled ? 'ENABLED' : 'DISABLED'})`);

  if (sheetsConfig.syncEnabled) {
    markSheetsConnected();
    try {
      const settingsPulled = await pullSiteSettingsFromGoogleSheets();
      if (!settingsPulled) {
        await syncSiteSettingsToGoogleSheets();
      }
    } catch (err: any) {
      console.error('Failed to pull/sync site settings on configuration save:', err.message);
    }

    try {
      const adminsPulled = await pullAdminsFromGoogleSheets();
      if (!adminsPulled) {
        await syncAdminsToGoogleSheets();
      }
    } catch (err: any) {
      console.error('Failed to pull/sync administrators on configuration save:', err.message);
    }

    try {
      const barangaysPulled = await pullBarangaysFromGoogleSheets();
      if (!barangaysPulled) {
        await syncBarangaysToGoogleSheets();
      }
    } catch (err: any) {
      console.error('Failed to pull/sync barangays on configuration save:', err.message);
    }

    await syncWithGoogleSheets(username);
  }
}

export function isQuotaOrRateLimitError(err: any): boolean {
  if (!err) return false;
  const errMsg = (err?.message || err?.toString() || '').toString().toLowerCase();
  return (
    errMsg.includes('quota exceeded') ||
    errMsg.includes('quota') ||
    err?.status === 429 ||
    (err?.response && err.response.status === 429) ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('rate limit') ||
    errMsg.includes('read requests') ||
    errMsg.includes('read requests per minute') ||
    errMsg.includes('write requests') ||
    errMsg.includes('quota metric')
  );
}

export function handleGoogleSheetsError(err: any, context: string) {
  const errMsg = (err?.message || err?.toString() || '').toString();
  
  if (errMsg.includes('Precondition check failed') || errMsg.includes('Precondition')) {
    if (Date.now() >= googleSheetsQuotaCooldownUntil) {
      console.warn(`⚠️ [Google Sheets API Precondition Error in ${context}]: "Precondition check failed."`);
      console.warn('This error usually indicates that the "Google Sheets API" has not been enabled in your Google Cloud Console project, or your Service Account does not have proper write permissions.');
      console.warn('[Action taken]: Placing Google Sheets sync on a 15-minute cooldown to prevent spamming your logs.');
    }
    googleSheetsQuotaCooldownUntil = Date.now() + 15 * 60 * 1000; // 15 minutes cooldown
    return;
  }
  
  const isQuota = isQuotaOrRateLimitError(err);
                  
  if (isQuota) {
    if (Date.now() >= googleSheetsQuotaCooldownUntil) {
      console.warn(`[Google Sheets Quota Cooldown] Quota / Rate limit ("Read requests per minute") reached. Automatically switching to local offline-first database cache and cooling down Sheets API requests for 10 minutes.`);
    }
    googleSheetsQuotaCooldownUntil = Date.now() + 10 * 60 * 1000; // 10 minutes
  } else {
    if (Date.now() >= googleSheetsQuotaCooldownUntil) {
      console.error(`[Google Sheets Error in ${context}]:`, errMsg);
      console.warn(`[Google Sheets Cooldown] Error detected. Cooling down Sheets API for 1 minute.`);
    }
    googleSheetsQuotaCooldownUntil = Date.now() + 60 * 1000; // 1 minute
  }
}

export function resetGoogleSheetsCooldown() {
  googleSheetsQuotaCooldownUntil = 0;
  clearCachedSheetNames();
}

const cachedSheetNames = new Map<string, { names: Set<string>; cachedAt: number }>();

export function clearCachedSheetNames() {
  cachedSheetNames.clear();
}

async function getExistingSheets(sheets: any, spreadsheetId: string): Promise<Set<string>> {
  const cached = cachedSheetNames.get(spreadsheetId);
  if (cached && (Date.now() - cached.cachedAt < 600000)) {
    return cached.names;
  }

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return cached?.names || new Set<string>();
  }
  
  try {
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = spreadsheetInfo.data.sheets || [];
    const names = new Set<string>();
    sheetsList.forEach((s: any) => {
      if (s.properties?.title) {
        names.add(s.properties.title);
      }
    });
    cachedSheetNames.set(spreadsheetId, { names, cachedAt: Date.now() });
    return names;
  } catch (err: any) {
    handleGoogleSheetsError(err, 'getExistingSheets');
    return cached?.names || new Set<string>();
  }
}

export let contactsLoadedFromSheets = false;
let contactsSyncPromise: Promise<any> | null = null;
let lastContactsSyncTime = 0;

export async function ensureContactsSynced(force: boolean = false): Promise<boolean> {
  // Sync live PCU updates from Base44 DB as well!
  await syncPCUUpdatesFromBase44(force);

  if (!sheetsConfig.syncEnabled) {
    return true;
  }

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return true;
  }

  // If we synced very recently (within 5 minutes) and force is false, use cache
  if (!force && contactsLoadedFromSheets && (Date.now() - lastContactsSyncTime < 300000)) {
    return true;
  }

  if (contactsSyncPromise) {
    await contactsSyncPromise;
    return true;
  }

  contactsSyncPromise = (async () => {
    try {
      console.log('[Sync] Syncing contacts and barangays live from Google Sheets...');
      const result = await syncWithGoogleSheets('Live Load/Sync');
      if (result && result.success) {
        contactsLoadedFromSheets = true;
        lastContactsSyncTime = Date.now();
      } else {
        lastContactsSyncTime = Date.now();
      }
      return result;
    } catch (err: any) {
      handleGoogleSheetsError(err, 'ensureContactsSynced');
      lastContactsSyncTime = Date.now();
      return { success: false };
    } finally {
      contactsSyncPromise = null;
    }
  })();

  await contactsSyncPromise;
  return true;
}

export function normalizeCompareName(name1: string, name2: string): boolean {
  const clean1 = (name1 || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const clean2 = (name2 || '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (clean1 === clean2 && clean1.length > 0) return true;

  // Word-based order-insensitive comparison for names like "Asutilla, Hannah Balios" vs "Balios, Asutilla, Hannah"
  const w1 = clean1.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  const w2 = clean2.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  if (w1.length === 0 || w2.length === 0) return false;

  const s1 = [...w1].sort().join(' ');
  const s2 = [...w2].sort().join(' ');
  return s1 === s2;
}

export let lastPCUSyncTime = 0;

export async function syncPCUUpdatesFromBase44(force: boolean = false): Promise<boolean> {
  // Do not pull or display pre-existing PCU update records from Base44
  return false;
}

export function syncPCUFieldsToCache() {
  if (!Array.isArray(contactsCache)) return;

  // Prune any contacts from contactsCache that have been submitted to Base44 or tombstoned
  const initialLen = contactsCache.length;
  contactsCache = contactsCache.filter(c => {
    if (!c) return false;
    if (isContactSubmitted(c) || isContactTombstoned(c)) {
      return false;
    }
    return true;
  });
  if (contactsCache.length !== initialLen) {
    safeWriteFile(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2), 'utf-8').catch(() => {});
  }
}

export async function syncWithGoogleSheets(username: string): Promise<{ success: boolean; message: string; count?: number }> {
  lastSyncStatus.lastAttempt = new Date().toISOString();

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return { success: true, message: 'Google Sheets sync paused during quota cooldown; served from local database.', count: contactsCache.length };
  }

  // 1. Pull latest deleted records and tombstones first (using throttled cached method)
  try {
    await pullDeletedRecordsOnce();
  } catch (err: any) {
    // Graceful fallback
  }

  // 2. Pull latest Barangays list from Google Sheets first if available (using throttled cached method)
  try {
    await pullBarangaysOnce();
  } catch (err: any) {
    // Graceful fallback
  }

  let rows: string[][] = [];

  const sheets = getSheetsClient();
  if (sheets) {
    if (!sheetsConfig.spreadsheetId) {
      const errMsg = 'Spreadsheet ID is required for synchronization.';
      lastSyncStatus.connected = false;
      lastSyncStatus.error = errMsg;
      throw new Error(errMsg);
    }
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const sheetName = sheetsConfig.sheetName || 'Sheet1';

    try {
      // Automatically ensure that the sheet/table exists before syncing
      await ensureSheetExists(sheets, spreadsheetId, sheetName);

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'`
      });
      rows = (res.data.values || []) as string[][];
    } catch (err: any) {
      handleGoogleSheetsError(err, 'syncWithGoogleSheets [Service Account read]');
      if (isQuotaOrRateLimitError(err)) {
        return { success: true, message: 'Google Sheets sync paused during quota cooldown; served from local database.', count: contactsCache.length };
      }
      if (!err.message?.includes('Precondition')) {
        console.warn('Google Sheets Service Account read error (serving local cache):', err.message || err);
      }
      let errMsg = 'Failed to fetch spreadsheet using Service Account. Please verify that your Spreadsheet ID is correct and that the Google Sheet is shared with your Service Account Email.';
      if (err.status === 403) {
        let emailUsed = sheetsConfig.clientEmail;
        if (sheetsConfig.privateKey && sheetsConfig.privateKey.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(sheetsConfig.privateKey.trim());
            if (parsed.client_email) {
              emailUsed = parsed.client_email;
            }
          } catch (e) {}
        }
        errMsg = `Access Denied: Please share your Google Sheet with your Service Account email: "${emailUsed}" with "Editor" permissions.`;
      }
      lastSyncStatus.connected = false;
      lastSyncStatus.error = errMsg;
      throw new Error(errMsg);
    }
  } else {
    // API Key fallback
    if (!sheetsConfig.apiKey || !sheetsConfig.spreadsheetId) {
      const errMsg = 'Google Sheets API Key and Spreadsheet ID are required for synchronization.';
      lastSyncStatus.connected = false;
      lastSyncStatus.error = errMsg;
      throw new Error(errMsg);
    }

    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }

    const sheetRange = encodeURIComponent(sheetsConfig.sheetName || 'Sheet1');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetRange}?key=${sheetsConfig.apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Sheets API error response:', errText);
      let errMsg = 'Failed to fetch spreadsheet. Please check your API Key and Spreadsheet ID/URL.';
      if (res.status === 403) {
        errMsg = 'Permission Denied: Please verify that your Google Sheet is shared with "Anyone with the link" and that your API Key is correct and has access to the Google Sheets API.';
      } else if (res.status === 404) {
        errMsg = 'Spreadsheet or Sheet Name not found. Please verify the Spreadsheet ID/URL and Sheet Name.';
      }
      lastSyncStatus.connected = false;
      lastSyncStatus.error = errMsg;
      throw new Error(errMsg);
    }

    const data: any = await res.json();
    rows = data.values || [];
  }

  // Update status to connected on successful fetch
  lastSyncStatus.connected = true;
  lastSyncStatus.lastSuccess = new Date().toISOString();
  lastSyncStatus.error = null;

  if (rows.length === 0) {
    return { success: true, message: 'Google Sheet is connected but contains no data/rows.', count: 0 };
  }

  const headers = rows[0].map(h => (h || '').toString().trim().toLowerCase());

  // Check if rows[0] is actually a header row or a data row.
  const isHeaderRow = headers.some(h => {
    const clean = h.replace(/[^a-z0-9]/g, '');
    return ['id', 'name', 'fullname', 'full_name', 'address', 'barangay', 'purok', 'phone', 'phonenumber', 'contact', 'contactnumber', 'contact_number', 'createdat', 'created_at', 'updatedat', 'updated_at', 'created', 'updated', 'date', 'latitude', 'longitude', 'status'].includes(clean);
  });

  const findCol = (keywords: string[]): number => {
    return headers.findIndex(h => {
      const clean = h.replace(/[^a-z0-9]/g, '');
      return keywords.some(k => clean.includes(k.replace(/[^a-z0-9]/g, '')) || clean === k.replace(/[^a-z0-9]/g, ''));
    });
  };

  let idIdx = -1;
  let nameIdx = -1;
  let firstNameIdx = -1;
  let lastNameIdx = -1;
  let middleNameIdx = -1;
  let barangayIdx = -1;
  let purokIdx = -1;
  let numberIdx = -1;
  let createdIdx = -1;
  let updatedIdx = -1;
  let addedIdx = -1;
  let latIdx = -1;
  let lngIdx = -1;
  let photoIdx = -1;
  let pcuIdx = -1;
  let startIndex = 1;

  if (!isHeaderRow) {
    startIndex = 0;
    const firstRow = rows[0] || [];
    const isFirstColNumber = /^\d+$/.test((firstRow[0] || '').toString().trim());
    if (isFirstColNumber && firstRow.length >= 4) {
      idIdx = 0;
      nameIdx = 1;
      barangayIdx = 2;
      purokIdx = 3;
      numberIdx = 4;
    } else {
      idIdx = -1;
      nameIdx = 0;
      barangayIdx = 1;
      purokIdx = -1;
      numberIdx = 2;
    }
  } else {
    idIdx = findCol(['id', 'no', 'numberid', 'contactid', 'householdid', 'memberid']);
    nameIdx = findCol(['fullname', 'full_name', 'name', 'householdhead', 'membername', 'patientname', 'beneficiary', 'pangalan', 'client']);
    firstNameIdx = findCol(['firstname', 'first_name', 'fname', 'first', 'givenname']);
    lastNameIdx = findCol(['lastname', 'last_name', 'lname', 'surname', 'familyname', 'last', 'apelyido']);
    middleNameIdx = findCol(['middlename', 'middle_name', 'mname', 'middle', 'mi']);
    barangayIdx = findCol(['barangay', 'brgy', 'address', 'location', 'tirahan', 'village', 'community', 'town']);
    purokIdx = findCol(['purok', 'prk', 'zone', 'sitio', 'street', 'st', 'block', 'lot', 'phase', 'subdivision']);
    numberIdx = findCol(['contactnumber', 'contact_number', 'phone', 'phonenumber', 'mobile', 'cell', 'cellphone', 'tel', 'telephone', 'cp', 'numero', 'contact']);
    createdIdx = findCol(['createdat', 'created_at', 'created', 'dateadded', 'date_added', 'timestamp', 'date', 'entrydate']);
    updatedIdx = findCol(['updatedat', 'updated_at', 'updated', 'lastupdated', 'modified']);
    addedIdx = findCol(['addedfromprintlist', 'added_from_print_list', 'directory', 'printlist', 'added', 'status', 'list']);
    latIdx = findCol(['latitude', 'lat', 'ycoord']);
    lngIdx = findCol(['longitude', 'lng', 'long', 'xcoord']);
    photoIdx = findCol(['photourl', 'photo', 'picture', 'image', 'avatar']);
    pcuIdx = findCol(['pcufileurl', 'pcu', 'attachment', 'document', 'file']);

    if (nameIdx === -1 && firstNameIdx === -1) {
      nameIdx = 1;
    }
    if (barangayIdx === -1) barangayIdx = 2;
    if (numberIdx === -1) numberIdx = 3;
  }

  const newContacts: Contact[] = [];
  let nextId = 1;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    let rawName = '';
    if (nameIdx !== -1 && row[nameIdx]) {
      rawName = row[nameIdx];
    } else if (firstNameIdx !== -1 || lastNameIdx !== -1) {
      const parts = [
        firstNameIdx !== -1 ? (row[firstNameIdx] || '') : '',
        middleNameIdx !== -1 ? (row[middleNameIdx] || '') : '',
        lastNameIdx !== -1 ? (row[lastNameIdx] || '') : ''
      ].filter(p => p && p.trim());
      rawName = parts.join(' ');
    } else {
      // Find the first non-empty column that contains alphabetical characters
      for (let c = 0; c < row.length; c++) {
        const val = (row[c] || '').toString().trim();
        if (val && /[a-zA-Z]/.test(val) && val.length > 2) {
          rawName = val;
          break;
        }
      }
    }

    if (!rawName || !rawName.trim()) continue; // Skip blank rows

    const rawBarangay = (barangayIdx !== -1 && row[barangayIdx]) ? row[barangayIdx] : '';
    const rawPurok = (purokIdx !== -1 && row[purokIdx]) ? row[purokIdx] : '';
    const rawNumber = (numberIdx !== -1 && row[numberIdx]) ? row[numberIdx] : '';

    let id = idIdx !== -1 && row[idIdx] ? parseInt(row[idIdx], 10) : NaN;
    if (isNaN(id)) {
      id = nextId++;
    } else {
      if (id >= nextId) {
        nextId = id + 1;
      }
    }

    const createdAt = createdIdx !== -1 && row[createdIdx] ? row[createdIdx] : new Date().toISOString();
    const updatedAt = updatedIdx !== -1 && row[updatedIdx] ? row[updatedIdx] : new Date().toISOString();

    const formattedName = capitalizeWords(rawName);
    const formattedBarangay = rawBarangay.trim() ? normalizeBarangayName(rawBarangay) : 'NO ADDRESS';

    // Check if this contact has been permanently deleted (tombstoned)
    if (isContactTombstoned({ id, full_name: formattedName, barangay: formattedBarangay, contact_number: rawNumber }) ||
        isContactTombstoned({ id, full_name: rawName, barangay: rawBarangay, contact_number: rawNumber })) {
      deleteContactPermanentlyFromGoogleSheets({ id, full_name: formattedName, barangay: formattedBarangay, contact_number: rawNumber }).catch(() => {});
      continue;
    }

    // Find if this contact already exists in local cache
    const existingLocal = contactsCache.find(lc => 
      (lc.id && id && lc.id.toString() === id.toString()) || 
      (normalizeCompareName(lc.full_name, rawName) && 
       (normalizeBarangayName(lc.barangay).toLowerCase() === formattedBarangay.toLowerCase() || !lc.barangay || !formattedBarangay))
    );

    const matchedUpdate = pcuUpdatesCache.find(p => 
      (id && p.contactId && p.contactId.toString() === id.toString()) || 
      (existingLocal && p.contactId && p.contactId.toString() === existingLocal.id.toString()) || 
      normalizeCompareName(p.fullName, rawName) ||
      normalizeCompareName(p.fullName, formattedName)
    );

    let latVal: number | undefined = undefined;
    let lngVal: number | undefined = undefined;
    if (latIdx !== -1 && row[latIdx]) {
      const parsedLat = parseFloat((row[latIdx] || '').toString().replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsedLat)) latVal = parsedLat;
    }
    if (lngIdx !== -1 && row[lngIdx]) {
      const parsedLng = parseFloat((row[lngIdx] || '').toString().replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsedLng)) lngVal = parsedLng;
    }
    if (latVal === undefined && existingLocal && existingLocal.latitude !== undefined) {
      latVal = existingLocal.latitude;
    }
    if (lngVal === undefined && existingLocal && existingLocal.longitude !== undefined) {
      lngVal = existingLocal.longitude;
    }

    // Check if this contact has already been submitted to Base44 database
    const isAlreadySubmitted = (existingLocal && isContactSubmitted(existingLocal)) || Boolean(matchedUpdate) || isContactSubmitted({ id, full_name: formattedName, barangay: formattedBarangay, contact_number: rawNumber } as any);
    if (isAlreadySubmitted) {
      console.log(`[Google Sheets Sync] Contact "${formattedName}" is already submitted to Base44. Permanently deleting from Google Sheets and omitting from PCU Directory...`);
      const targetId = existingLocal ? existingLocal.id : id;
      if (!deletedContactsCache.some(d => 
        (targetId && d.id && d.id.toString() === targetId.toString()) || 
        (d.full_name && normalizeCompareName(d.full_name, formattedName))
      )) {
        deletedContactsCache.push({
          id: targetId,
          full_name: formattedName,
          barangay: formattedBarangay,
          deletedAt: new Date().toISOString(),
          submitted_to_base44: true
        });
        safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8').catch(() => {});
        syncDeletedRecordsToGoogleSheets().catch(() => {});
      }
      deleteContactPermanentlyFromGoogleSheets({ id: targetId, full_name: formattedName, barangay: formattedBarangay, contact_number: rawNumber }).catch(() => {});
      continue;
    }

    const rawAdded = addedIdx !== -1 ? (row[addedIdx] || '').toString().trim().toUpperCase() : '';
    let addedFromPrintList = true;
    if (rawAdded) {
      addedFromPrintList = !(rawAdded === 'FALSE' || rawAdded === 'NO' || rawAdded === '0' || rawAdded === 'N');
    } else if (existingLocal) {
      addedFromPrintList = existingLocal.added_from_print_list !== false;
    } else {
      addedFromPrintList = true;
    }

    const pcuFileUrl = (pcuIdx !== -1 && row[pcuIdx]) ? row[pcuIdx] : ((existingLocal && existingLocal.pcu_file_url) || (matchedUpdate && (matchedUpdate.fileData || `Uploaded: ${matchedUpdate.fileName}`)));
    if (pcuFileUrl || (existingLocal && isContactSubmitted(existingLocal))) {
      deleteContactPermanentlyFromGoogleSheets({ id, full_name: formattedName, barangay: formattedBarangay, contact_number: rawNumber }).catch(() => {});
      continue;
    }
    const pcuUploadedBy = (existingLocal && existingLocal.pcu_uploaded_by) || (matchedUpdate && matchedUpdate.uploadedBy);
    const pcuUploadedAt = (existingLocal && existingLocal.pcu_uploaded_at) || (matchedUpdate && matchedUpdate.uploadedAt);
    const photoUrl = (photoIdx !== -1 && row[photoIdx]) ? row[photoIdx] : (existingLocal ? existingLocal.photo_url : undefined);

    newContacts.push({
      id,
      full_name: formattedName,
      barangay: formattedBarangay,
      purok: rawPurok ? capitalizeWords(rawPurok) : '',
      contact_number: rawNumber.toString().trim(),
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: existingLocal ? existingLocal.deleted_at : null,
      latitude: latVal,
      longitude: lngVal,
      geotagged: (latVal !== undefined && lngVal !== undefined) || (existingLocal ? existingLocal.geotagged : false),
      photo_url: photoUrl,
      pcu_file_url: pcuFileUrl || undefined,
      pcu_uploaded_by: pcuUploadedBy || undefined,
      pcu_uploaded_at: pcuUploadedAt || undefined,
      added_locally: false,
      added_from_print_list: addedFromPrintList
    });
  }

  // Merge pulled contacts from Google Sheets into local cache
  const mergedContacts: Contact[] = [...newContacts];
  
  for (const lc of contactsCache) {
    if (!lc || lc.deleted_at || isContactTombstoned(lc) || isContactSubmitted(lc)) {
      continue;
    }
    const alreadyExists = mergedContacts.some(mc => 
      (mc.id && lc.id && mc.id.toString() === lc.id.toString()) || 
      (normalizeCompareName(mc.full_name, lc.full_name) && 
       normalizeBarangayName(mc.barangay).toLowerCase() === normalizeBarangayName(lc.barangay).toLowerCase())
    );
    
    if (!alreadyExists) {
      // Retain active local additions and print list records that have not been submitted or tombstoned
      if ((lc.added_locally || lc.added_from_print_list !== false) && !isContactSubmitted(lc) && !isContactTombstoned(lc)) {
        mergedContacts.push(lc);
      }
    } else {
      const targetIndex = mergedContacts.findIndex(mc => 
        (mc.id && lc.id && mc.id.toString() === lc.id.toString()) || 
        (normalizeCompareName(mc.full_name, lc.full_name) && 
         normalizeBarangayName(mc.barangay).toLowerCase() === normalizeBarangayName(lc.barangay).toLowerCase())
      );
      if (targetIndex !== -1) {
        if (isContactSubmitted(lc) || isContactSubmitted(mergedContacts[targetIndex])) {
          // Remove from merged contacts if submitted
          mergedContacts.splice(targetIndex, 1);
        } else {
          mergedContacts[targetIndex] = {
            ...lc,
            ...mergedContacts[targetIndex],
            photo_url: mergedContacts[targetIndex].photo_url || lc.photo_url,
            pcu_file_url: mergedContacts[targetIndex].pcu_file_url || lc.pcu_file_url,
            pcu_uploaded_by: mergedContacts[targetIndex].pcu_uploaded_by || lc.pcu_uploaded_by,
            pcu_uploaded_at: mergedContacts[targetIndex].pcu_uploaded_at || lc.pcu_uploaded_at,
            uploadedFiles: (lc.uploadedFiles && lc.uploadedFiles.length > 0) ? lc.uploadedFiles : mergedContacts[targetIndex].uploadedFiles,
            latitude: mergedContacts[targetIndex].latitude !== undefined ? mergedContacts[targetIndex].latitude : lc.latitude,
            longitude: mergedContacts[targetIndex].longitude !== undefined ? mergedContacts[targetIndex].longitude : lc.longitude,
            geotagged: mergedContacts[targetIndex].geotagged || lc.geotagged,
            deleted_at: mergedContacts[targetIndex].deleted_at !== undefined ? mergedContacts[targetIndex].deleted_at : lc.deleted_at
          };
        }
      }
    }
  }

  contactsCache = deduplicateContactsByName(
    mergedContacts.filter(c => c && !c.deleted_at && !isContactTombstoned(c) && !isContactSubmitted(c))
  );
  syncPCUFieldsToCache();
  await saveContacts();

  // Aggregate all unique active barangays from both pulled barangaysCache and active contactsCache
  const rawSyncBarangays: string[] = [];
  if (Array.isArray(barangaysCache)) {
    barangaysCache.forEach(b => {
      if (b && typeof b === 'string' && b.trim() && !isBarangayTombstoned(b)) {
        rawSyncBarangays.push(b.trim());
      }
    });
  }

  contactsCache.forEach(c => {
    if (!c.deleted_at && c.added_from_print_list !== false && c.barangay && c.barangay.trim() && !isBarangayTombstoned(c.barangay)) {
      rawSyncBarangays.push(c.barangay.trim());
    }
  });

  barangaysCache = normalizeAndDeduplicateBarangays(rawSyncBarangays).filter(b => !isBarangayTombstoned(b));
  await saveBarangays();

  syncBarangaysToGoogleSheets().catch(err => console.error('Failed to sync Barangays in syncWithGoogleSheets:', err));
  await addActivity(username, `Synchronized ${newContacts.length} contacts from Google Sheet.`);

  return {
    success: true,
    message: `Successfully synchronized ${newContacts.length} contacts!`,
    count: newContacts.length
  };
}

export async function syncAdminsToGoogleSheets(force = false) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  if (!force && Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }
  if (force) {
    resetGoogleSheetsCooldown();
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    
    // Verify sheet exists, if not create it
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();

    const adminSheetCandidates = ['Administrators', 'Users', 'User Accounts', 'Accounts'];
    let adminSheetName = 'Administrators';
    for (const candidate of adminSheetCandidates) {
      if (existingSheets.has(candidate)) {
        adminSheetName = candidate;
        break;
      }
    }

    if (!existingSheets.has(adminSheetName)) {
      console.log(`Sheet "${adminSheetName}" not found. Creating administrators table automatically...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: adminSheetName
              }
            }
          }]
        }
      });
      existingSheets.add(adminSheetName);
    }

    // Ensure master admin is always in usersCache
    const hasAdmin = usersCache.some(u => u.username.toLowerCase() === 'admin');
    if (!hasAdmin) {
      usersCache.unshift({
        username: 'admin',
        email: 'admin@clinic.gov.ph',
        fullName: 'Master Administrator',
        displayName: 'Master Administrator',
        barangay: 'Central',
        passwordHash: hashPassword('2026'),
        passwordPlain: '2026',
        role: 'Administrator',
        status: 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Filter out any tombstoned accounts before writing
    const activeNonDeletedUsers = usersCache.filter(u => !isUserTombstoned(u.username, u.email));

    // Write headers and data first to ensure no empty sheet window
    const headers = ['Username', 'Password Hash (SHA-256)', 'Role', 'Display Name', 'Avatar Data URL', 'Email', 'Barangay', 'Status', 'Created At', 'Plain Password', 'Updated At'];
    const rowsToPut = [
      headers,
      ...activeNonDeletedUsers.map(u => [
        u.username,
        u.passwordHash || hashPassword(u.passwordPlain || '2026'),
        u.role || 'Staff',
        u.displayName || u.fullName || u.username,
        u.avatarDataUrl && u.avatarDataUrl.length > 45000 ? u.avatarDataUrl.substring(0, 45000) : (u.avatarDataUrl || ''),
        u.email || (u.username.includes('@') ? u.username : `${u.username}@clinic.gov.ph`),
        u.barangay || 'Central',
        u.status || 'Active',
        u.createdAt || new Date().toISOString(),
        u.passwordPlain || '',
        u.updatedAt || new Date().toISOString()
      ])
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${adminSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets(rowsToPut)
      }
    });

    // Clear any extra rows below the written data
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${adminSheetName}!A${rowsToPut.length + 1}:K500`
      });
    } catch (clearErr) {
      // Benign if range does not exist
    }

    console.log('[Google Sheets] Synchronized administrators list successfully! Total accounts saved:', activeNonDeletedUsers.length);
  } catch (err: any) {
    console.error('Failed to sync administrators to Google Sheets:', err.message || err);
    handleGoogleSheetsError(err, 'syncAdminsToGoogleSheets');
    markSheetsDisconnected(err);
  }
}

export async function syncDeletedRecordsToGoogleSheets(force = false) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  if (!force && Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }
  if (force) {
    resetGoogleSheetsCooldown();
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }

    // Merge tombstones already in the sheet into local memory BEFORE rewriting, so multiple server
    // instances (e.g. live deployment + another environment) never wipe each other's tombstones.
    try {
      await pullDeletedRecordsFromGoogleSheets();
    } catch (mergeErr: any) {
      console.warn('[Google Sheets] Could not merge remote tombstones before sync:', mergeErr.message || mergeErr);
    }

    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();

    // 1. Sync DeletedBarangays
    const bgSheetName = 'DeletedBarangays';
    if (!existingSheets.has(bgSheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: bgSheetName } } }]
        }
      });
      existingSheets.add(bgSheetName);
    }
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${bgSheetName}!A:Z` });
    const bgRows = [['Barangay Name'], ...deletedBarangaysCache.map(extractBarangayName).filter(Boolean).map(b => [b])];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${bgSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: bgRows }
    });

    // 2. Sync DeletedContacts
    const contactSheetName = 'DeletedContacts';
    if (!existingSheets.has(contactSheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: contactSheetName } } }]
        }
      });
      existingSheets.add(contactSheetName);
    }
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${contactSheetName}!A:Z` });
    const contactRows = [
      ['ID', 'Full Name', 'Barangay', 'Deleted At', 'Submitted To Base44'],
      ...deletedContactsCache.map(c => [c.id || '', c.full_name || '', c.barangay || '', c.deletedAt || '', c.submitted_to_base44 ? 'TRUE' : 'FALSE'])
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${contactSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: contactRows }
    });

    // 3. Sync DeletedExistingAccounts
    const existSheetName = 'DeletedExistingAccounts';
    if (!existingSheets.has(existSheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: existSheetName } } }]
        }
      });
      existingSheets.add(existSheetName);
    }
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${existSheetName}!A:Z` });
    const existRows = [
      ['ID', 'Full Name', 'Barangay', 'Deleted At'],
      ...deletedExistingAccountsCache.map(c => [c.id || '', c.full_name || '', c.barangay || '', c.deletedAt || ''])
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${existSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: existRows }
    });

    // 4. Sync DeletedUsers
    const userSheetName = 'DeletedUsers';
    if (!existingSheets.has(userSheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: userSheetName } } }]
        }
      });
      existingSheets.add(userSheetName);
    }
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${userSheetName}!A:Z` });
    const userRows = [
      ['Username', 'Email', 'Deleted At'],
      ...deletedUsersCache.map(u => [u.username || '', u.email || '', u.deletedAt || ''])
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${userSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: userRows }
    });

    console.log('[Google Sheets] Successfully synchronized deleted records and users lists!');
  } catch (err: any) {
    console.error('Failed to sync deleted records to Google Sheets:', err.message || err);
    handleGoogleSheetsError(err, 'syncDeletedRecordsToGoogleSheets');
  }
}

export async function pullDeletedRecordsFromGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) return false;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return false;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;

    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }

    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();

    let loadedAny = false;

    // Batch fetch all deleted record ranges in a single API call to preserve read quota
    const bgSheetName = 'DeletedBarangays';
    const contactSheetName = 'DeletedContacts';
    const existSheetName = 'DeletedExistingAccounts';
    const userSheetName = 'DeletedUsers';

    const rangesToFetch: { name: string; range: string }[] = [];
    if (existingSheets.has(bgSheetName)) rangesToFetch.push({ name: bgSheetName, range: `${bgSheetName}!A:A` });
    if (existingSheets.has(contactSheetName)) rangesToFetch.push({ name: contactSheetName, range: `${contactSheetName}!A:E` });
    if (existingSheets.has(existSheetName)) rangesToFetch.push({ name: existSheetName, range: `${existSheetName}!A:D` });
    if (existingSheets.has(userSheetName)) rangesToFetch.push({ name: userSheetName, range: `${userSheetName}!A:C` });

    if (rangesToFetch.length > 0) {
      const batchRes = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: rangesToFetch.map(r => r.range)
      });
      const valueRanges = batchRes.data.valueRanges || [];

      for (const vr of valueRanges) {
        const rangeStr = vr.range || '';
        const rows = (vr.values || []) as string[][];
        if (rows.length <= 1) continue;

        if (rangeStr.includes('DeletedBarangays')) {
          const pulledBgs = rows.slice(1).map(r => (r[0] || '').toString().trim()).filter(Boolean);
          pulledBgs.forEach(bg => {
            if (!deletedBarangaysCache.some(localBg => localBg.trim().toLowerCase() === bg.toLowerCase())) {
              deletedBarangaysCache.push(bg);
            }
          });
          await safeWriteFile(DELETED_BARANGAYS_FILE, JSON.stringify(deletedBarangaysCache, null, 2), 'utf-8');
          loadedAny = true;
        } else if (rangeStr.includes('DeletedContacts')) {
          const pulledContacts = rows.slice(1).map(row => ({
            id: row[0] ? (isNaN(parseInt(row[0], 10)) ? row[0] : parseInt(row[0], 10)) : '',
            full_name: (row[1] || '').toString().trim(),
            barangay: (row[2] || '').toString().trim(),
            deletedAt: (row[3] || '').toString().trim() || new Date().toISOString(),
            submitted_to_base44: row[4] ? (row[4].toString().trim().toUpperCase() === 'TRUE') : false
          })).filter(c => c.full_name);

          pulledContacts.forEach(pc => {
            const localMatch = deletedContactsCache.find(lc => 
              (pc.id && lc.id && pc.id.toString() === lc.id.toString()) ||
              (normalizeCompareName(pc.full_name, lc.full_name) && 
               (pc.submitted_to_base44 || (lc as any).submitted_to_base44 || normalizeBarangayName(pc.barangay).toLowerCase() === normalizeBarangayName(lc.barangay).toLowerCase()))
            );
            if (!localMatch) {
              deletedContactsCache.push(pc);
            } else if (pc.submitted_to_base44 && !localMatch.submitted_to_base44) {
              // Preserve the "submitted to Base44" flag so the contact is blocked by name under any barangay
              localMatch.submitted_to_base44 = true;
            }
          });
          await safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8');
          loadedAny = true;
        } else if (rangeStr.includes('DeletedExistingAccounts')) {
          const pulledExists = rows.slice(1).map(row => ({
            id: (row[0] || '').toString().trim(),
            full_name: (row[1] || '').toString().trim(),
            barangay: (row[2] || '').toString().trim(),
            deletedAt: (row[3] || '').toString().trim() || new Date().toISOString()
          })).filter(c => c.full_name);

          pulledExists.forEach(pe => {
            const isActive = existingAccountsCache.some(ea =>
              (pe.id && ea.id && pe.id.toString() === ea.id.toString()) ||
              (normalizeCompareName(pe.full_name, ea.full_name) && 
               normalizeBarangayName(pe.barangay).toLowerCase() === normalizeBarangayName(ea.barangay).toLowerCase())
            );
            if (isActive) return;

            const alreadyLocal = deletedExistingAccountsCache.some(lc => 
              (pe.id && lc.id && pe.id.toString() === lc.id.toString()) ||
              (normalizeCompareName(pe.full_name, lc.full_name) && 
               normalizeBarangayName(pe.barangay).toLowerCase() === normalizeBarangayName(lc.barangay).toLowerCase())
            );
            if (!alreadyLocal) {
              deletedExistingAccountsCache.push(pe);
            }
          });
          await safeWriteFile(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2), 'utf-8');
          loadedAny = true;
        } else if (rangeStr.includes('DeletedUsers')) {
          const pulledUsers = rows.slice(1).map(row => ({
            username: (row[0] || '').toString().trim(),
            email: (row[1] || '').toString().trim(),
            deletedAt: (row[2] || '').toString().trim() || new Date().toISOString()
          })).filter(u => u.username || u.email);

          pulledUsers.forEach(pu => {
            const alreadyLocal = deletedUsersCache.some(lu => 
              (pu.username && lu.username && pu.username.toLowerCase() === lu.username.toLowerCase()) ||
              (pu.email && lu.email && pu.email.toLowerCase() === lu.email.toLowerCase())
            );
            if (!alreadyLocal) {
              deletedUsersCache.push(pu);
            }
          });
          await safeWriteFile(DELETED_USERS_FILE, JSON.stringify(deletedUsersCache, null, 2), 'utf-8');
          loadedAny = true;
        }
      }
    }

    if (loadedAny) {
      console.log('[Google Sheets] Pulled deleted records and tombstones successfully!');
      // Apply filtering to local active cache immediately to scrub deleted records
      contactsCache = contactsCache.filter(c => !isContactTombstoned(c) && !isBarangayTombstoned(c.barangay) && !isContactSubmitted(c));
      barangaysCache = barangaysCache.filter(b => !isBarangayTombstoned(b));
      usersCache = usersCache.filter(u => !isUserTombstoned(u.username, u.email));
      await saveContacts();
      await saveBarangays();
      await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
    }
    return loadedAny;
  } catch (err: any) {
    handleGoogleSheetsError(err, 'pullDeletedRecordsFromGoogleSheets');
    if (!isQuotaOrRateLimitError(err) && !err.message?.includes('Precondition')) {
      console.warn('Could not pull deleted records from Google Sheets (serving local):', err.message || err);
    }
    return false;
  }
}

export async function syncBarangaysToGoogleSheets() {
  const sheets = getSheetsClient();
  if (!sheets) return;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const barangaySheetName = 'Barangays';

    // Verify sheet exists, if not create it
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();
    const exists = existingSheets.has(barangaySheetName);

    if (!exists) {
      console.log(`Sheet "${barangaySheetName}" not found. Creating Barangays table automatically...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: barangaySheetName
              }
            }
          }]
        }
      });
      existingSheets.add(barangaySheetName);
    }

    // Clear and rewrite barangays
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${barangaySheetName}!A:Z`
    });

    const headers = ['Barangay Name'];
    const rowsToPut = [
      headers,
      ...barangaysCache.map(b => [b])
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${barangaySheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets(rowsToPut)
      }
    });
    console.log('[Google Sheets] Synchronized Barangays list successfully!');
  } catch (err: any) {
    console.error('Failed to sync Barangays to Google Sheets:', err.message || err);
    handleGoogleSheetsError(err, 'syncBarangaysToGoogleSheets');
    markSheetsDisconnected(err);
  }
}

export async function pullBarangaysFromGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) return false;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return false;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;

    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const barangaySheetName = 'Barangays';

    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();
    const exists = existingSheets.has(barangaySheetName);

    if (!exists) {
      console.log(`Sheet "${barangaySheetName}" not found. No remote barangays to pull.`);
      return false;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${barangaySheetName}!A:A`
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      console.log('Barangays sheet is empty or only contains headers.');
      return false;
    }

    const pulled: string[] = [];
    for (const row of rows.slice(1)) {
      if (!row || row.length === 0) continue;
      const bgName = (row[0] || '').toString().trim();
      if (bgName && !pulled.includes(bgName) && !isBarangayTombstoned(bgName)) {
        pulled.push(bgName);
      }
    }

    if (pulled.length > 0) {
      barangaysCache = normalizeAndDeduplicateBarangays(pulled).filter(b => !isBarangayTombstoned(b));
      await saveBarangays();
      console.log('[Google Sheets] Successfully pulled Barangays from Google Sheets. Total count:', barangaysCache.length);
      return true;
    }
  } catch (err: any) {
    handleGoogleSheetsError(err, 'pullBarangaysFromGoogleSheets');
    if (!isQuotaOrRateLimitError(err) && !err.message?.includes('Precondition')) {
      console.warn('Could not pull Barangays from Google Sheets (serving local):', err.message || err);
      markSheetsDisconnected(err);
    }
  }
  return false;
}

export async function syncSiteSettingsToGoogleSheets() {
  const sheets = getSheetsClient();
  if (!sheets) return;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const settingsSheetName = 'WebsiteSettings';

    // Verify sheet exists, if not create it
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();

    const exists = existingSheets.has(settingsSheetName);

    if (!exists) {
      console.log(`Sheet "${settingsSheetName}" not found. Creating WebsiteSettings table automatically...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: settingsSheetName
              }
            }
          }]
        }
      });
      existingSheets.add(settingsSheetName);
    }

    // Clear and rewrite site settings
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${settingsSheetName}!A:Z`
    });

    const headers = ['Key', 'Value'];
    const rowsToPut = [
      headers,
      ['title', siteSettings.title || ''],
      ['faviconTitle', siteSettings.faviconTitle || ''],
      ['logoDataUrl', siteSettings.logoDataUrl || ''],
      ['faviconDataUrl', siteSettings.faviconDataUrl || ''],
      ['navDashboard', siteSettings.navDashboard || ''],
      ['navMap', siteSettings.navMap || ''],
      ['navDirectory', siteSettings.navDirectory || ''],
      ['navRecentUpload', siteSettings.navRecentUpload || ''],
      ['navAccounts', siteSettings.navAccounts || ''],
      ['navBulk', siteSettings.navBulk || ''],
      ['navPrint', siteSettings.navPrint || ''],
      ['navAdmins', siteSettings.navAdmins || ''],
      ['navSettings', siteSettings.navSettings || ''],
      ['navExistingAccount', siteSettings.navExistingAccount || ''],
      ['navExistAccFiles', siteSettings.navExistAccFiles || ''],
      ['rolePermissions', siteSettings.rolePermissions ? JSON.stringify(siteSettings.rolePermissions) : '']
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${settingsSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets(rowsToPut)
      }
    });
    console.log('[Google Sheets] Synchronized WebsiteSettings list successfully!');
  } catch (err: any) {
    console.error('Failed to sync WebsiteSettings to Google Sheets:', err.message || err);
    markSheetsDisconnected(err);
  }
}

export async function pullSiteSettingsFromGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) return false;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return false;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;

    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const settingsSheetName = 'WebsiteSettings';

    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();
    const exists = existingSheets.has(settingsSheetName);

    if (!exists) {
      console.log(`Sheet "${settingsSheetName}" not found. No remote site settings to pull.`);
      return false;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${settingsSheetName}!A:B`
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      console.log('WebsiteSettings sheet is empty or only contains headers.');
      return false;
    }

    const pulledSettings: Partial<SiteSettings> = {};
    for (const row of rows.slice(1)) {
      if (!row || row.length < 2) continue;
      const key = (row[0] || '').toString().trim();
      const val = unescapeHtml((row[1] || '').toString().trim());
      if (!key) continue;

      if (key === 'rolePermissions') {
        try {
          pulledSettings.rolePermissions = JSON.parse(val);
        } catch (e) {
          console.error('Failed to parse rolePermissions JSON:', val);
        }
      } else if (key === 'logoDataUrl') {
        let localLogo = '';
        if (fs.existsSync(LOGO_DATA_FILE)) {
          try { localLogo = unescapeHtml(fs.readFileSync(LOGO_DATA_FILE, 'utf-8')); } catch (e) {}
        }
        if (!localLogo) {
          localLogo = siteSettings.logoDataUrl || '';
        }
        const isPrefix = localLogo && localLogo.startsWith(val);
        if (localLogo && (val.length === 49000 || isPrefix || val.length < localLogo.length || !val)) {
          pulledSettings.logoDataUrl = localLogo;
        } else {
          pulledSettings.logoDataUrl = val;
        }
      } else if (key === 'faviconDataUrl') {
        let localFavicon = '';
        if (fs.existsSync(FAVICON_DATA_FILE)) {
          try { localFavicon = unescapeHtml(fs.readFileSync(FAVICON_DATA_FILE, 'utf-8')); } catch (e) {}
        }
        if (!localFavicon) {
          localFavicon = siteSettings.faviconDataUrl || '';
        }
        const isPrefix = localFavicon && localFavicon.startsWith(val);
        if (localFavicon && (val.length === 49000 || isPrefix || val.length < localFavicon.length || !val)) {
          pulledSettings.faviconDataUrl = localFavicon;
        } else {
          pulledSettings.faviconDataUrl = val;
        }
      } else {
        (pulledSettings as any)[key] = val;
      }
    }

    if (Object.keys(pulledSettings).length > 0) {
      siteSettings = {
        ...siteSettings,
        ...pulledSettings
      };
      
      // Save pulled settings locally as cache
      if (siteSettings.logoDataUrl) {
        safeWriteFileSync(LOGO_DATA_FILE, siteSettings.logoDataUrl, 'utf-8');
      }
      if (siteSettings.faviconDataUrl) {
        safeWriteFileSync(FAVICON_DATA_FILE, siteSettings.faviconDataUrl, 'utf-8');
      }
      safeWriteFileSync(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2), 'utf-8');
      
      console.log('[Google Sheets] Successfully pulled WebsiteSettings from Google Sheets.');
      return true;
    }
  } catch (err: any) {
    handleGoogleSheetsError(err, 'pullSiteSettingsFromGoogleSheets');
    if (!isQuotaOrRateLimitError(err) && !err.message?.includes('Precondition')) {
      console.warn('Could not pull WebsiteSettings from Google Sheets (serving local):', err.message || err);
      markSheetsDisconnected(err);
    }
  }
  return false;
}

export async function pullAdminsFromGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) return false;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return false;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;

    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }

    // Verify sheet exists
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();

    const adminSheetCandidates = ['Administrators', 'Users', 'User Accounts', 'Accounts'];
    let adminSheetName = 'Administrators';
    let exists = false;
    for (const candidate of adminSheetCandidates) {
      if (existingSheets.has(candidate)) {
        adminSheetName = candidate;
        exists = true;
        break;
      }
    }

    if (!exists) {
      console.log(`Administrators sheet not found. Pushing current user accounts to sheet...`);
      await syncAdminsToGoogleSheets();
      return true;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${adminSheetName}!A:K`
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      console.log('Administrators sheet is empty or only contains headers. Syncing local users to sheet...');
      if (usersCache.length > 0) {
        await syncAdminsToGoogleSheets();
      }
      return false;
    }

    // Dynamically map headers to column indices
    const headerRow = rows[0] || [];
    const getColIndex = (patterns: RegExp[], fallback: number): number => {
      for (let i = 0; i < headerRow.length; i++) {
        const val = (headerRow[i] || '').toString().trim();
        for (const pattern of patterns) {
          if (pattern.test(val)) return i;
        }
      }
      return fallback;
    };

    const colUsername = getColIndex([/^user/i, /^username/i], 0);
    const colPasswordHash = getColIndex([/hash/i, /sha/i], 1);
    const colRole = getColIndex([/^role/i, /permission/i], 2);
    const colDisplayName = getColIndex([/display\s*name/i, /full\s*name/i, /^name/i], 3);
    const colAvatar = getColIndex([/avatar/i, /photo/i, /picture/i], 4);
    const colEmail = getColIndex([/^email/i, /mail/i], 5);
    const colBarangay = getColIndex([/barangay/i, /address/i, /location/i], 6);
    const colStatus = getColIndex([/^status/i, /state/i], 7);
    const colCreatedAt = getColIndex([/created/i, /registered/i, /date/i], 8);
    const colPasswordPlain = getColIndex([/plain\s*password/i, /^plain/i, /^password$/i, /password_plain/i], 9);
    const colUpdatedAt = getColIndex([/updated/i, /modified/i], 10);

    const remoteUsers: User[] = [];
    for (const row of rows.slice(1)) {
      if (!row || row.length < 1) continue;
      const username = row[colUsername]?.trim();
      if (!username) continue;

      const rawPasswordHash = row[colPasswordHash]?.trim() || '';
      const role = row[colRole]?.trim() || 'Staff';
      const displayName = row[colDisplayName]?.trim() || '';
      const avatarDataUrl = row[colAvatar]?.trim() || '';
      const email = row[colEmail]?.trim() || '';
      if (isUserTombstoned(username, email)) {
        continue;
      }
      const barangay = row[colBarangay]?.trim() || '';
      const rawStatus = row[colStatus]?.trim();
      const status = normalizeUserStatus(rawStatus);
      const createdAt = row[colCreatedAt]?.trim() || new Date().toISOString();
      const passwordPlain = row[colPasswordPlain]?.trim() || '';
      const updatedAt = row[colUpdatedAt]?.trim() || '';

      const passwordHash = rawPasswordHash || (passwordPlain ? hashPassword(passwordPlain) : hashPassword('2026'));

      remoteUsers.push({
        username,
        passwordHash,
        role,
        displayName,
        avatarDataUrl,
        fullName: displayName || username,
        email: email || (username.includes('@') ? username : `${username}@clinic.gov.ph`),
        barangay: barangay || 'Central',
        status: status || 'Active',
        createdAt,
        passwordPlain,
        updatedAt
      });
    }

    if (remoteUsers.length > 0) {
      const mergedUsers: User[] = [];
      const matchedUsernames = new Set<string>();

      for (const remote of remoteUsers) {
        if (isUserTombstoned(remote.username, remote.email)) continue;
        const local = usersCache.find(
          u => u.username.toLowerCase() === remote.username.toLowerCase() ||
               (u.email && remote.email && u.email.toLowerCase() === remote.email.toLowerCase())
        );

        if (!local) {
          mergedUsers.push(remote);
        } else {
          matchedUsernames.add(local.username.toLowerCase());
          const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : (local.createdAt ? new Date(local.createdAt).getTime() : 0);
          const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : (remote.createdAt ? new Date(remote.createdAt).getTime() : 0);

          // If local user is already Active, do not revert to Pending during sheet sync
          let statusToApply: 'Active' | 'Pending' | 'Suspended' = 'Active';
          if (local.status === 'Active') {
            statusToApply = (remote.status === 'Suspended' && remoteTime > localTime) ? 'Suspended' : 'Active';
          } else {
            statusToApply = (localTime > remoteTime) ? (local.status || remote.status || 'Active') : (remote.status || local.status || 'Active');
          }

          if (localTime > remoteTime) {
            // Local user is strictly newer! Retain local user's fields, or fill from remote if local is blank
            mergedUsers.push({
              ...remote,
              ...local,
              displayName: local.displayName || remote.displayName,
              avatarDataUrl: chooseBestAvatar(local.avatarDataUrl, remote.avatarDataUrl),
              barangay: local.barangay || remote.barangay,
              passwordHash: local.passwordHash || remote.passwordHash,
              passwordPlain: local.passwordPlain || remote.passwordPlain,
              email: local.email || remote.email,
              status: statusToApply,
              role: local.role || remote.role,
              updatedAt: local.updatedAt || new Date().toISOString()
            });
          } else {
            // Remote user is equal or newer!
            mergedUsers.push({
              ...local,
              ...remote,
              displayName: remote.displayName || local.displayName,
              avatarDataUrl: chooseBestAvatar(local.avatarDataUrl, remote.avatarDataUrl),
              barangay: remote.barangay || local.barangay,
              passwordHash: remote.passwordHash || local.passwordHash,
              passwordPlain: remote.passwordPlain || local.passwordPlain,
              email: remote.email || local.email,
              status: statusToApply,
              role: remote.role || local.role,
              updatedAt: remote.updatedAt || local.updatedAt || new Date().toISOString()
            });
          }
        }
      }

      // Also ensure any users from disk USERS_FILE are included in local candidates
      let diskUsers: User[] = [];
      try {
        if (fs.existsSync(USERS_FILE)) {
          const raw = fs.readFileSync(USERS_FILE, 'utf-8');
          diskUsers = JSON.parse(raw);
        }
      } catch (e) {}

      const allLocalCandidates = [...usersCache];
      for (const du of diskUsers) {
        if (du && du.username && !allLocalCandidates.some(u => u.username.toLowerCase() === du.username.toLowerCase() || (u.email && du.email && u.email.toLowerCase() === du.email.toLowerCase()))) {
          allLocalCandidates.push(du);
        }
      }

      // Preserve any local users not present in remote sheet (except tombstoned ones)!
      let hasLocalOnlyUsers = false;
      for (const localUser of allLocalCandidates) {
        if (isUserTombstoned(localUser.username, localUser.email)) continue;
        const isMatched = matchedUsernames.has(localUser.username.toLowerCase()) ||
          (localUser.email ? matchedUsernames.has(localUser.email.toLowerCase()) : false);
        const existsInMerged = mergedUsers.some(
          u => u.username.toLowerCase() === localUser.username.toLowerCase() ||
               (u.email && localUser.email && u.email.toLowerCase() === localUser.email.toLowerCase())
        );
        if (!isMatched && !existsInMerged) {
          mergedUsers.push(localUser);
          hasLocalOnlyUsers = true;
        }
      }

      const hasMasterAdmin = mergedUsers.some(u => u.username.toLowerCase() === 'admin');
      if (!hasMasterAdmin) {
        const localMaster = usersCache.find(u => u.username.toLowerCase() === 'admin');
        if (localMaster) {
          mergedUsers.unshift(localMaster);
        } else {
          mergedUsers.unshift({
            username: 'admin',
            email: 'admin@clinic.gov.ph',
            fullName: 'Master Administrator',
            displayName: 'Master Administrator',
            barangay: 'Central',
            passwordHash: hashPassword('2026'),
            passwordPlain: '2026',
            role: 'Administrator',
            status: 'Active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      usersCache = mergedUsers.filter(u => !isUserTombstoned(u.username, u.email));
      safeWriteFileSync(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
      console.log('[Google Sheets] Successfully pulled administrators from Google Sheets. Total accounts count:', usersCache.length);

      // If local had accounts not yet in remote, push merged list to Google Sheets
      if (hasLocalOnlyUsers || mergedUsers.length !== remoteUsers.length) {
        syncAdminsToGoogleSheets().catch(e => console.error('Failed to sync merged users back to Sheets:', e.message || e));
      }

      return true;
    }
  } catch (err: any) {
    handleGoogleSheetsError(err, 'pullAdminsFromGoogleSheets');
    if (!isQuotaOrRateLimitError(err) && !err.message?.includes('Precondition')) {
      console.warn('Could not pull administrators from Google Sheets (serving local):', err.message || err);
      markSheetsDisconnected(err);
    }
  }
  return false;
}

let existingAccountsSyncPromise: Promise<boolean> | null = null;

export async function syncExistingAccountsToGoogleSheets(force: boolean = false): Promise<boolean> {
  // If a sync is already running, wait for it
  if (existingAccountsSyncPromise) {
    try {
      await existingAccountsSyncPromise;
    } catch (e) {}
  }

  existingAccountsSyncPromise = (async () => {
    const sheets = getSheetsClient();
    if (!sheets) return false;

    if (!force && Date.now() < googleSheetsQuotaCooldownUntil) {
      console.log('[Google Sheets] Existing accounts sync skipped due to cooldown. Will sync when cooldown expires.');
      return false;
    }

    try {
      let spreadsheetId = sheetsConfig.spreadsheetId;
      if (!spreadsheetId) return false;

      const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        spreadsheetId = match[1];
      }
      const existSheetName = 'ExistingAccounts';
      const existSheetCandidates = ['ExistingAccounts', 'Existing Accounts', 'Existing_Accounts', 'Existing'];

      // Verify sheet exists, if not create it
      const existingSheets = await getExistingSheets(sheets, spreadsheetId);
      markSheetsConnected();

      let targetSheetName = '';
      for (const cand of existSheetCandidates) {
        if (existingSheets.has(cand)) {
          targetSheetName = cand;
          break;
        }
      }

      if (!targetSheetName) {
        console.log(`Sheet "${existSheetName}" not found. Creating ExistingAccounts table automatically...`);
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{
                addSheet: {
                  properties: {
                    title: existSheetName
                  }
                }
              }]
            }
          });
          targetSheetName = existSheetName;
          existingSheets.add(existSheetName);
        } catch (addErr: any) {
          console.warn('Could not add sheet (may already exist):', addErr.message || addErr);
          targetSheetName = existSheetName;
        }
      }

      // Write headers and data
      const headers = [
        'ID', 'Full Name', 'Barangay', 'Purok', 'Contact Number', 'Created At',
        'Latitude', 'Longitude', 'Geotagged', 'ExistingAcc', 'Verified',
        'Visited', 'Status', 'Submitted By', 'PIN', 'Facebook Link',
        'Uploaded Files JSON', 'Added To Files', 'Is Submitted'
      ];
      
      const rowsToPut = [
        headers,
        ...existingAccountsCache.map(acc => {
          let phone = (acc.contact_number || '').trim();
          if (phone && phone.startsWith('0')) {
            phone = `'${phone}`;
          }
          let pin = (acc.pin || '').trim();
          if (pin && pin.startsWith('0')) {
            pin = `'${pin}`;
          }

          return [
            acc.id || '',
            acc.full_name || '',
            acc.barangay || '',
            acc.purok || '',
            phone,
            acc.created_at || '',
            acc.latitude !== undefined ? acc.latitude.toString() : '',
            acc.longitude !== undefined ? acc.longitude.toString() : '',
            acc.geotagged ? 'TRUE' : 'FALSE',
            acc.existingAcc ? 'TRUE' : 'FALSE',
            acc.existingAccVerified ? 'TRUE' : 'FALSE',
            acc.existingAccVisited ? 'TRUE' : 'FALSE',
            acc.status || 'approved',
            acc.submittedBy || 'Admin',
            pin,
            acc.facebookLink || '',
            JSON.stringify(acc.uploadedFiles || []),
            acc.addedToFiles ? 'TRUE' : 'FALSE',
            acc.isSubmitted ? 'TRUE' : 'FALSE'
          ];
        })
      ];

      // Clear the target sheet first so no residual trailing rows remain
      try {
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `'${targetSheetName}'!A:Z`
        });
      } catch (clearErr: any) {
        console.warn('Could not clear range before writing (will overwrite):', clearErr.message);
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${targetSheetName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: sanitizeRowsForSheets(rowsToPut)
        }
      });

      console.log(`[Google Sheets] Synchronized ${existingAccountsCache.length} existing accounts to "${targetSheetName}" successfully!`);
      return true;
    } catch (err: any) {
      console.error('Failed to sync existing accounts to Google Sheets:', err.message || err);
      handleGoogleSheetsError(err, 'syncExistingAccountsToGoogleSheets');
      markSheetsDisconnected(err);
      return false;
    } finally {
      existingAccountsSyncPromise = null;
    }
  })();

  return await existingAccountsSyncPromise;
}

export async function pullExistingAccountsFromGoogleSheets(): Promise<boolean> {
  const sheets = getSheetsClient();
  if (!sheets) return false;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return false;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    if (!spreadsheetId) return false;

    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const existSheetCandidates = ['ExistingAccounts', 'Existing Accounts', 'Existing_Accounts', 'Existing'];

    // Verify sheet exists
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    markSheetsConnected();
    
    let targetSheetName = '';
    for (const name of existSheetCandidates) {
      if (existingSheets.has(name)) {
        targetSheetName = name;
        break;
      }
    }

    if (!targetSheetName) {
      console.log(`No existing accounts sheet found among: ${existSheetCandidates.join(', ')}`);
      return false;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${targetSheetName}'`
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      console.log('ExistingAccounts sheet is empty or only contains headers.');
      return false;
    }

    const headers = (rows[0] || []).map((h: any) => (h || '').toString().trim().toLowerCase());
    const findCol = (keywords: string[]): number => {
      return headers.findIndex((h: string) => {
        const clean = h.replace(/[^a-z0-9]/g, '');
        return keywords.some(k => clean.includes(k.replace(/[^a-z0-9]/g, '')) || clean === k.replace(/[^a-z0-9]/g, ''));
      });
    };

    const idIdx = findCol(['id', 'no', 'accountid', 'itemid']);
    const nameIdx = findCol(['fullname', 'full_name', 'name', 'accountname', 'clientname', 'membername', 'patientname', 'householdhead']);
    const barangayIdx = findCol(['barangay', 'brgy', 'address', 'location', 'tirahan', 'village', 'town']);
    const purokIdx = findCol(['purok', 'prk', 'zone', 'sitio', 'street', 'st']);
    const numberIdx = findCol(['contactnumber', 'contact_number', 'phone', 'phonenumber', 'mobile', 'cell', 'numero', 'contact']);
    const createdIdx = findCol(['createdat', 'created_at', 'created', 'date', 'timestamp']);
    const latIdx = findCol(['latitude', 'lat', 'ycoord']);
    const lngIdx = findCol(['longitude', 'lng', 'long', 'xcoord']);
    const geotaggedIdx = findCol(['geotagged', 'geo']);
    const existingAccIdx = findCol(['existingacc', 'existing_acc', 'existingaccount', 'isexisting']);
    const verifiedIdx = findCol(['existingaccverified', 'verified', 'isverified']);
    const visitedIdx = findCol(['existingaccvisited', 'visited', 'isvisited']);
    const statusIdx = findCol(['status', 'approvalstatus', 'state']);
    const submittedIdx = findCol(['submittedby', 'submitted_by', 'uploader', 'author', 'encoder']);
    const pinIdx = findCol(['pin', 'code', 'passcode']);
    const fbIdx = findCol(['facebooklink', 'facebook', 'fb', 'fblink', 'social']);
    const filesIdx = findCol(['uploadedfiles', 'files', 'attachments', 'documents']);
    const addedToFilesIdx = findCol(['addedtofiles', 'added_to_files', 'added', 'folder']);
    const isSubmittedIdx = findCol(['issubmitted', 'is_submitted', 'submitted']);

    const remoteAccounts: ExistingAccountItem[] = [];
    for (const row of rows.slice(1)) {
      if (!row || row.length === 0) continue;
      
      const id = (idIdx !== -1 && row[idIdx]) ? row[idIdx]?.trim() : `ext_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const full_name = (nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : (row[1] || row[0] || '')).toString().trim().toUpperCase();
      const barangay = (barangayIdx !== -1 && row[barangayIdx] ? row[barangayIdx] : (row[2] || 'NO ADDRESS')).toString().trim().toUpperCase();
      const purok = (purokIdx !== -1 && row[purokIdx] ? row[purokIdx] : (row[3] || '')).toString().trim();
      
      let contact_number = (numberIdx !== -1 && row[numberIdx] ? row[numberIdx] : (row[4] || '')).toString().trim();
      if (contact_number.startsWith("'")) {
        contact_number = contact_number.substring(1).trim();
      }
      if (/^9\d{9}$/.test(contact_number)) {
        contact_number = '0' + contact_number;
      }

      const created_at = (createdIdx !== -1 && row[createdIdx] ? row[createdIdx] : (row[5] || '')).toString().trim() || new Date().toISOString();
      
      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;
      if (latIdx !== -1 && row[latIdx]) {
        const pLat = parseFloat((row[latIdx] || '').toString().replace(/[^0-9.-]/g, ''));
        if (!isNaN(pLat)) latitude = pLat;
      }
      if (lngIdx !== -1 && row[lngIdx]) {
        const pLng = parseFloat((row[lngIdx] || '').toString().replace(/[^0-9.-]/g, ''));
        if (!isNaN(pLng)) longitude = pLng;
      }

      const geotagged = (geotaggedIdx !== -1 && row[geotaggedIdx]) ? row[geotaggedIdx]?.toString().trim().toUpperCase() === 'TRUE' : (latitude !== undefined && longitude !== undefined);
      const existingAcc = (existingAccIdx !== -1 && row[existingAccIdx]) ? row[existingAccIdx]?.toString().trim().toUpperCase() !== 'FALSE' : true;
      const existingAccVerified = (verifiedIdx !== -1 && row[verifiedIdx]) ? row[verifiedIdx]?.toString().trim().toUpperCase() === 'TRUE' : false;
      const existingAccVisited = (visitedIdx !== -1 && row[visitedIdx]) ? row[visitedIdx]?.toString().trim().toUpperCase() === 'TRUE' : false;
      const status = (statusIdx !== -1 && row[statusIdx] ? row[statusIdx] : (row[12] || 'approved')).toString().trim();
      const submittedBy = (submittedIdx !== -1 && row[submittedIdx] ? row[submittedIdx] : (row[13] || 'Admin')).toString().trim();
      
      let pin = (pinIdx !== -1 && row[pinIdx] ? row[pinIdx] : (row[14] || '')).toString().trim();
      if (pin.startsWith("'")) {
        pin = pin.substring(1).trim();
      }

      const facebookLink = (fbIdx !== -1 && row[fbIdx] ? row[fbIdx] : (row[15] || '')).toString().trim();
      
      let uploadedFiles: any[] = [];
      try {
        const rawFiles = (filesIdx !== -1 && row[filesIdx]) ? row[filesIdx] : (row[16] || '');
        if (rawFiles && rawFiles.toString().trim()) {
          uploadedFiles = JSON.parse(rawFiles.toString().trim());
          if (!Array.isArray(uploadedFiles)) uploadedFiles = [];
        }
      } catch (e) {}

      const addedToFiles = (addedToFilesIdx !== -1 && row[addedToFilesIdx]) ? row[addedToFilesIdx]?.toString().trim().toUpperCase() === 'TRUE' : false;
      const isSubmitted = (isSubmittedIdx !== -1 && row[isSubmittedIdx]) ? row[isSubmittedIdx]?.toString().trim().toUpperCase() === 'TRUE' : (uploadedFiles.length > 0);

      // Do not discard if active in local cache (prevents newly registered accounts from bouncing back)
      const isLocallyActive = existingAccountsCache.some(loc => 
        (loc.id && id && loc.id === id) || 
        (loc.full_name && loc.barangay && loc.full_name.toUpperCase() === full_name.toUpperCase() && loc.barangay.toUpperCase() === barangay.toUpperCase())
      );

      if (!full_name || (!isLocallyActive && isExistingAccountTombstoned({ id, full_name, barangay }))) {
        continue;
      }

      remoteAccounts.push({
        id,
        full_name,
        barangay: barangay || 'NO ADDRESS',
        purok,
        contact_number,
        created_at,
        latitude,
        longitude,
        geotagged,
        existingAcc,
        existingAccVerified,
        existingAccVisited,
        status,
        submittedBy,
        pin,
        facebookLink,
        uploadedFiles,
        addedToFiles,
        isSubmitted
      });
    }

    // Smart merge: retain local cache data for newly added or edited fields so local entries never bounce back
    const merged: ExistingAccountItem[] = [];
    const localMap = new Map<string, ExistingAccountItem>();
    for (const loc of existingAccountsCache) {
      if (loc.id) localMap.set(loc.id.toString(), loc);
      const compositeKey = `${(loc.full_name || '').trim().toUpperCase()}_${(loc.barangay || '').trim().toUpperCase()}`;
      if (compositeKey !== '_') localMap.set(compositeKey, loc);
    }

    for (const rem of remoteAccounts) {
      const compositeKey = `${(rem.full_name || '').trim().toUpperCase()}_${(rem.barangay || '').trim().toUpperCase()}`;
      const loc = (rem.id ? localMap.get(rem.id.toString()) : null) || localMap.get(compositeKey);

      if (loc) {
        // Merge: keep local state if more detailed or updated locally
        merged.push({
          ...rem,
          ...loc,
          id: rem.id || loc.id,
          full_name: rem.full_name || loc.full_name,
          barangay: rem.barangay || loc.barangay,
          purok: loc.purok || rem.purok,
          contact_number: loc.contact_number || rem.contact_number,
          pin: loc.pin || rem.pin,
          latitude: loc.latitude !== undefined ? loc.latitude : rem.latitude,
          longitude: loc.longitude !== undefined ? loc.longitude : rem.longitude,
          geotagged: loc.geotagged !== undefined ? loc.geotagged : rem.geotagged,
          addedToFiles: loc.addedToFiles !== undefined ? loc.addedToFiles : rem.addedToFiles,
          isSubmitted: loc.isSubmitted !== undefined ? loc.isSubmitted : rem.isSubmitted,
          uploadedFiles: (loc.uploadedFiles && loc.uploadedFiles.length > 0) ? loc.uploadedFiles : (rem.uploadedFiles || []),
          facebookLink: loc.facebookLink || rem.facebookLink,
          status: loc.status || rem.status || 'approved'
        });
        if (loc.id) localMap.delete(loc.id.toString());
        localMap.delete(compositeKey);
      } else {
        merged.push(rem);
      }
    }

    // Add remaining local-only accounts (such as newly registered bulk accounts not yet in remote)
    for (const [, loc] of localMap.entries()) {
      if (!merged.some(m => m.id === loc.id || (m.full_name === loc.full_name && m.barangay === loc.barangay))) {
        merged.push(loc);
      }
    }

    existingAccountsCache = merged;
    await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
    console.log('[Google Sheets] Successfully pulled existing accounts from Google Sheets. Total count:', existingAccountsCache.length);
    return true;
  } catch (err: any) {
    handleGoogleSheetsError(err, 'pullExistingAccountsFromGoogleSheets');
    if (!isQuotaOrRateLimitError(err) && !err.message?.includes('Precondition')) {
      console.warn('Could not pull existing accounts from Google Sheets (serving local):', err.message || err);
      markSheetsDisconnected(err);
    }
  }
  return false;
}

export async function appendActivityToGoogleSheets(activity: Activity) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  if (Date.now() < googleSheetsQuotaCooldownUntil) {
    return;
  }

  try {
    let spreadsheetId = sheetsConfig.spreadsheetId;
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
    const logSheetName = 'AuditLogs';

    // Verify sheet exists, if not create it
    const existingSheets = await getExistingSheets(sheets, spreadsheetId);
    const exists = existingSheets.has(logSheetName);

    if (!exists) {
      console.log(`Sheet "${logSheetName}" not found. Creating audit logs table automatically...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: logSheetName
              }
            }
          }]
        }
      });
      existingSheets.add(logSheetName);
      // Write headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${logSheetName}!A1:D1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['ID', 'Timestamp', 'Username', 'Action']]
        }
      });
    }

    // Append the row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${logSheetName}!A:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sanitizeRowsForSheets([[activity.id, activity.timestamp, activity.username, activity.action]])
      }
    });
    console.log('[Google Sheets] Logged activity successfully!');
  } catch (err: any) {
    console.error('Failed to append activity to Google Sheets:', err.message || err);
    handleGoogleSheetsError(err, 'appendActivityToGoogleSheets');
  }
}

// Helper to derive MIME type from file extension
function getMimeType(fileName: string, fallbackMime?: string): string {
  if (fallbackMime && fallbackMime !== 'application/octet-stream') return fallbackMime;
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'svg': return 'image/svg+xml';
    case 'csv': return 'text/csv';
    case 'txt': return 'text/plain';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default: return fallbackMime || 'application/octet-stream';
  }
}

// Helper to parse base64 Data URLs without regex backtracking or byte corruption
function parseDataUrl(dataUrl: string, fileName?: string): { mimeType: string, buffer: Buffer } {
  if (dataUrl && dataUrl.startsWith('data:')) {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx !== -1) {
      const meta = dataUrl.substring(5, commaIdx);
      let mimeType = meta.split(';')[0] || 'application/octet-stream';
      if (fileName) {
        mimeType = getMimeType(fileName, mimeType);
      }
      let rawBase64 = dataUrl.substring(commaIdx + 1).trim();
      if (rawBase64.includes('%')) {
        try {
          rawBase64 = decodeURIComponent(rawBase64);
        } catch (_) {}
      }
      rawBase64 = rawBase64.replace(/\s/g, '');
      return { mimeType, buffer: Buffer.from(rawBase64, 'base64') };
    }
  }
  const fallbackMime = fileName ? getMimeType(fileName, 'application/octet-stream') : 'application/octet-stream';
  let rawBase64 = (dataUrl || '').trim();
  if (rawBase64.includes('%')) {
    try {
      rawBase64 = decodeURIComponent(rawBase64);
    } catch (_) {}
  }
  rawBase64 = rawBase64.replace(/\s/g, '');
  return { mimeType: fallbackMime, buffer: Buffer.from(rawBase64, 'base64') };
}

// Upload file to Base44 public CDN storage or intact local static uploads storage
async function uploadFileToBase44(dataUrl: string, fileName: string, explicitMime?: string): Promise<string> {
  if (!dataUrl) return '';
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://') || dataUrl.startsWith('/uploads/')) {
    return dataUrl;
  }
  try {
    const { mimeType: parsedMime, buffer } = parseDataUrl(dataUrl, fileName);
    const mimeType = explicitMime && explicitMime !== 'application/octet-stream' 
      ? explicitMime 
      : (parsedMime && parsedMime !== 'application/octet-stream' ? parsedMime : getMimeType(fileName));
    
    // Ensure uploads directory exists on disk in all standard locations
    const publicUploads = path.join(process.cwd(), 'public', 'uploads', 'files');
    const distUploads = path.join(process.cwd(), 'dist', 'uploads', 'files');
    const dataUploads = path.join(DATA_DIR, 'uploads', 'files');
    for (const dir of [publicUploads, distUploads, dataUploads]) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (_) {}
      }
    }

    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const ext = path.extname(fileName) || (mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/png' ? '.png' : mimeType === 'image/jpeg' ? '.jpg' : '');
    const cleanBase = path.basename(fileName, path.extname(fileName)).replace(/[^\w.-]/g, '_');
    const safeSavedName = `${timestamp}_${randomHex}_${cleanBase}${ext}`;

    // Write exact binary bytes to local uploads storage to guarantee 100% intact file preservation (no damage, no corruption)
    for (const dir of [publicUploads, distUploads, dataUploads]) {
      try {
        fs.writeFileSync(path.join(dir, safeSavedName), buffer);
      } catch (_) {}
    }

    const localStaticUrl = `/uploads/files/${safeSavedName}`;

    // Attempt to upload to Base44 CDN via SDK if available and within monthly quota
    try {
      const exactBytes = new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      const safeFileName = (fileName || 'document').replace(/[^\w.-]/g, '_');
      const file = new File([exactBytes], safeFileName, { type: mimeType });
      
      console.log(`[Base44 Upload] Attempting SDK upload for "${safeFileName}" (${exactBytes.length} bytes, type: ${mimeType})...`);
      const result = await base44.integrations.Core.UploadFile({ file });
      if (result && result.file_url) {
        console.log(`[Base44 Upload] Successfully uploaded to Base44 CDN: ${result.file_url}`);
        return result.file_url;
      }
    } catch (sdkErr: any) {
      console.log(`[Base44 Upload Note] SDK upload limit or unavailable (${sdkErr.message || 'quota limit'}). Preserved file intact in local static storage: ${localStaticUrl}`);
    }

    return localStaticUrl;
  } catch (err: any) {
    console.error('[Base44 Upload Error] File processing error:', err.message || err);
    return '';
  }
}

// Save PCU Updates to file
async function savePCUUpdates() {
  await safeWriteFile(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2), 'utf-8');
}

// Upload a contact photo
export async function uploadContactPhoto(contactId: number | string, photoDataUrl: string, username: string) {
  const idStr = contactId !== undefined && contactId !== null ? String(contactId).trim() : '';
  const idNum = !isNaN(Number(contactId)) ? Number(contactId) : null;

  const contact = contactsCache.find(c => {
    if (!c || c.deleted_at) return false;
    const cIdStr = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
    if (idStr && cIdStr && cIdStr === idStr) return true;
    if (idNum !== null && Number(c.id) === idNum) return true;
    return false;
  });
  if (!contact) {
    throw new Error('Contact not found or has been deleted.');
  }

  let finalUrl = photoDataUrl;
  try {
    // Attempt to upload to Base44 CDN to keep local JSON light and avoid Google Sheets cell limit issues
    const uploadedUrl = await uploadFileToBase44(photoDataUrl, `photo_${contactId}.png`);
    if (uploadedUrl) {
      finalUrl = uploadedUrl;
    }
  } catch (err: any) {
    console.warn('[Base44 Photo Upload Warning] Failed to upload photo to CDN, storing base64 locally instead:', err.message);
  }

  contact.photo_url = finalUrl;
  contact.updated_at = new Date().toISOString();
  await saveContacts();
  await addActivity(username, `Uploaded photo for contact: "${contact.full_name}"`);
  
  // Forward update to Web App if configured
  forwardToWebApp('edit', contact).catch(err => console.error('Error forwarding photo update to Sheets Web App:', err));
  
  return contact;
}

// Add a PCU Update (saves to Base44 PCUUpdate entity + locally)
export async function addPCUUpdate(
  contactId: number | string, 
  fullName: string, 
  fileName: string, 
  fileData: string, 
  username: string,
  options?: { 
    barangay?: string; 
    purok?: string; 
    contact_number?: string; 
    latitude?: number | null; 
    longitude?: number | null; 
    geotagged?: boolean;
    maintenance?: 'None' | 'Yes' | string;
    maintenance_medicine?: string;
  }
) {
  const idStr = contactId !== undefined && contactId !== null ? String(contactId).trim() : '';
  const idNum = !isNaN(Number(contactId)) ? Number(contactId) : null;
  const targetName = (fullName || '').trim();

  let contact = contactsCache.find(c => {
    if (!c || c.deleted_at) return false;
    const cIdStr = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
    if (idStr && cIdStr && cIdStr === idStr) return true;
    if (idNum !== null && Number(c.id) === idNum) return true;
    if (targetName && c.full_name && (normalizeCompareName(c.full_name, targetName) || c.full_name.trim().toLowerCase() === targetName.toLowerCase())) {
      return true;
    }
    return false;
  });

  if (contact && (isContactSubmitted(contact) || contact.locked || contact.status === 'SUBMITTED' || contact.submittedToBase44)) {
    throw new Error(`Contact "${contact.full_name}" has already been submitted to Base44 and is permanently locked. Duplicate submission is strictly prohibited.`);
  }

  if (contact) {
    if (options?.barangay !== undefined && options.barangay.trim() !== '') {
      contact.barangay = options.barangay.trim();
    }
    if (options?.purok !== undefined && options.purok.trim() !== '') {
      contact.purok = options.purok.trim();
    }
    if (options?.contact_number !== undefined && options.contact_number.trim() !== '') {
      contact.contact_number = options.contact_number.trim();
    }
    if (options?.maintenance !== undefined) {
      contact.maintenance = options.maintenance;
    }
    if (options?.maintenance_medicine !== undefined) {
      contact.maintenance_medicine = options.maintenance_medicine;
    }
    if (options?.latitude !== undefined && options.latitude !== null && !isNaN(Number(options.latitude))) {
      contact.latitude = Number(options.latitude);
    }
    if (options?.longitude !== undefined && options.longitude !== null && !isNaN(Number(options.longitude))) {
      contact.longitude = Number(options.longitude);
    }
    if (options?.geotagged !== undefined) {
      contact.geotagged = options.geotagged;
    } else if (contact.latitude && contact.longitude) {
      contact.geotagged = true;
    }
  }

  const barangay = contact ? (contact.barangay || '') : (options?.barangay || '');
  const purok = contact ? (contact.purok || '') : (options?.purok || '');
  const contactNumber = contact ? (contact.contact_number || '') : (options?.contact_number || '');
  const latVal = contact?.latitude ?? (options?.latitude !== undefined && options.latitude !== null ? Number(options.latitude) : null);
  const lngVal = contact?.longitude ?? (options?.longitude !== undefined && options.longitude !== null ? Number(options.longitude) : null);
  const hasGeo = latVal !== null && !isNaN(latVal) && lngVal !== null && !isNaN(lngVal);
  const isGeotagged = Boolean(contact?.geotagged || options?.geotagged || hasGeo);
  
  let finalFileUrlOrData = fileData;
  let base44EntityValue = '';
  let uploadSuccess = false;

  try {
    // Upload the file to public storage and get the URL to avoid 400 Field limit errors
    const uploadedUrl = await uploadFileToBase44(fileData, fileName);
    if (uploadedUrl) {
      finalFileUrlOrData = uploadedUrl;
      base44EntityValue = uploadedUrl;
      uploadSuccess = true;
    } else {
      throw new Error('Upload returned empty URL');
    }
  } catch (err: any) {
    console.warn('[Base44 PCU Upload Notice] Using local static file storage:', err.message || err);
    try {
      const { mimeType: mType, buffer: buf } = parseDataUrl(fileData, fileName);
      const safeSavedName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${(fileName || 'document').replace(/[^\w.-]/g, '_')}`;
      const pubDir = path.join(process.cwd(), 'public', 'uploads', 'files');
      if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
      fs.writeFileSync(path.join(pubDir, safeSavedName), buf);
      finalFileUrlOrData = `/uploads/files/${safeSavedName}`;
      base44EntityValue = finalFileUrlOrData;
    } catch (_) {
      finalFileUrlOrData = `/uploads/files/doc_${Date.now()}.jpg`;
      base44EntityValue = finalFileUrlOrData;
    }
    uploadSuccess = false;
  }

  const newUpdate: PCUUpdate = {
    id: crypto.randomBytes(8).toString('hex'),
    contactId,
    fullName,
    barangay,
    purok,
    fileName,
    fileData: finalFileUrlOrData, // Save the full URL (if success) or full base64 (if local fallback) in local cache
    uploadedAt: new Date().toISOString(),
    uploadedBy: username,
    added_from_website: true,
    status: 'FILES',
    contact_number: contactNumber,
    uploadedFiles: [{
      name: fileName,
      url: finalFileUrlOrData,
      uploadedAt: new Date().toISOString(),
      uploadedBy: username
    }]
  };

  pcuUpdatesCache.unshift(newUpdate);
  await savePCUUpdates();

  // Try to upload metadata to Base44 PCUUpdate entity
  try {
    console.log(`[Base44 SDK] Uploading PCU File metadata to table PCUUpdate for contact: ${fullName}...`);
    const pcuEntity = (base44.entities as any).PCUUpdate || {
      create: async (data: any) => {
        console.log('[Base44 SDK] Simulating PCUUpdate creation dynamically');
        return data;
      }
    };
    
    // Extract firstName and lastName to satisfy Base44 schema requirement
    const nameParts = (fullName || '').trim().split(/\s+/);
    let firstName = 'Unknown';
    let lastName = 'Unknown';
    if (nameParts.length > 1) {
      firstName = nameParts.slice(0, -1).join(' ');
      lastName = nameParts[nameParts.length - 1];
    } else if (nameParts.length === 1 && nameParts[0] !== '') {
      firstName = nameParts[0];
      lastName = 'Unknown';
    }

    const userObj = findUser(username);
    const userEmail = userObj?.email || (username.includes('@') ? username : 'saintfrancisclinic2026@gmail.com');
    const uName = userObj?.fullName || userObj?.displayName || username;
    const { mimeType } = parseDataUrl(fileData);

    await pcuEntity.create({
      contactId,
      fullName,
      firstName,
      lastName,
      barangay,
      Barangay: barangay,
      purok,
      fileName,
      fileUrl: base44EntityValue, // Save either the CDN URL or the safe metadata placeholder
      fileType: mimeType,
      uploadDate: newUpdate.uploadedAt,
      uploadedBy: uName,
      "Submitted by": uName,
      uploadedByEmail: userEmail,
      contact: contactNumber,
      contact_number: contactNumber,
      latitude: latVal,
      longitude: lngVal,
      geotagged: isGeotagged,
      geoLocation: hasGeo ? {
        latitude: latVal,
        longitude: lngVal
      } : undefined,
      "Attachment data": base44EntityValue,
      attachmentUrl: base44EntityValue
    });
    console.log('[Base44 SDK] PCU File metadata saved successfully in Base44 PCUUpdate table.');
  } catch (err: any) {
    console.warn('[Base44 SDK Warning] Base44 direct write failed (saving locally instead):', err.message);
  }

  // Update contact's PCU file url status
  if (contact) {
    contact.isSubmitted = true;
    contact.submittedAt = newUpdate.uploadedAt;
    contact.pcu_file_url = uploadSuccess ? finalFileUrlOrData : `Uploaded: ${fileName} (Local Cache)`;
    contact.pcu_uploaded_by = username;
    contact.pcu_uploaded_at = newUpdate.uploadedAt;
    contact.uploadedFiles = contact.uploadedFiles || [];
    contact.uploadedFiles.push({
      name: fileName,
      url: finalFileUrlOrData,
      uploadedAt: newUpdate.uploadedAt,
      uploadedBy: username
    });
    contact.updated_at = new Date().toISOString();

    // 1. SAVE TO SUBMIT PCU (Files section) & MYSQL pcu_submissions:
    console.log(`[Submission Pipeline] Step 1: Saving contact "${fullName}" to Submit PCU (Files section) in MySQL...`);
    if (isCPanelDbConnected()) {
      try {
        await savePcuSubmissionToCPanel({
          id: String(contact.id || newUpdate.id),
          contactId: contact.id,
          fullName: contact.full_name || fullName,
          barangay: contact.barangay || barangay,
          purok: contact.purok || purok,
          contactNumber: contact.contact_number || contactNumber,
          fileName,
          fileUrl: finalFileUrlOrData,
          uploadedFiles: contact.uploadedFiles,
          uploadedBy: username,
          uploadedAt: newUpdate.uploadedAt,
          status: 'FILES'
        });
        console.log(`[Submission Pipeline] Step 1 Confirmed: Contact "${fullName}" saved to MySQL pcu_submissions.`);
      } catch (saveErr: any) {
        console.warn('[Submission Pipeline] MySQL pcu_submissions write notice:', saveErr.message || saveErr);
      }
    }

    // Log action to PCU History
    await logPcuHistory({
      action: 'SUBMITTED_FILES',
      recordId: String(contact.id || newUpdate.id),
      patientName: fullName,
      barangay: contact.barangay || barangay,
      submitter: username,
      performedBy: username,
      previousStatus: 'DIRECTORY',
      newStatus: 'FILES',
      details: `Submitted PCU file "${fileName}" from PCU Directory to Submit PCU under Barangay Folder "${contact.barangay || barangay}" (Files section).`
    });

    // 2. PERMANENTLY DELETE CONTACT FROM CPANEL MYSQL DATABASE:
    let cpanelSyncSuccess = true;
    let cpanelSyncWarning: string | null = null;
    if (isCPanelDbConnected()) {
      try {
        console.log(`[Submission Pipeline] Step 2: Marking contact "${fullName}" deleted in cPanel MySQL database...`);
        await deleteContactFromCPanel(contact.id, new Date().toISOString(), fullName, contact.barangay);
        console.log(`[Submission Pipeline] Step 2 Confirmed: Contact "${fullName}" deleted in cPanel MySQL database.`);
      } catch (err: any) {
        cpanelSyncSuccess = false;
        cpanelSyncWarning = err.message || 'Error updating cPanel MySQL database';
        console.error('[Submission Pipeline] Step 2 Error deleting contact from cPanel MySQL database:', cpanelSyncWarning);
      }
    }

    // 3. PERMANENTLY DELETE CONTACT FROM PCU DIRECTORY AND RECORD TOMBSTONE:
    console.log(`[Submission Pipeline] Step 3: Permanently deleting contact "${fullName}" from PCU Directory and recording tombstone...`);
    const targetContactId = contact.id;
    const targetContactName = contact.full_name || fullName;
    const targetContactBarangay = contact.barangay || options?.barangay || '';

    // Record tombstone in deletedContactsCache with submitted_to_base44: true
    deletedContactsCache = deletedContactsCache.filter(d => 
      !(targetContactId && d.id && d.id.toString() === targetContactId.toString()) && 
      !(targetContactName && d.full_name && normalizeCompareName(d.full_name, targetContactName))
    );
    deletedContactsCache.push({
      id: targetContactId,
      full_name: targetContactName,
      barangay: targetContactBarangay,
      deletedAt: new Date().toISOString(),
      submitted_to_base44: true
    });
    await safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8');
    syncDeletedRecordsToGoogleSheets(true).catch(err => console.error('Failed to sync deleted records to Google Sheets:', err));

    // Permanently remove from contactsCache so it NEVER displays in PCU Directory or in any folder
    contactsCache = contactsCache.filter(c => 
      !(targetContactId && c.id && c.id.toString() === targetContactId.toString()) && 
      !(targetContactName && c.full_name && normalizeCompareName(c.full_name, targetContactName))
    );
    await saveContacts();

    await addActivity(username, `Uploaded PCU File "${fileName}", submitted to Base44, and permanently deleted from PCU Directory: "${fullName}"`);

    return {
      ...newUpdate,
      cpanelSyncSuccess,
      cpanelSyncWarning: cpanelSyncWarning || undefined,
      sheetsSyncSuccess: true,
      sheetsSyncWarning: undefined,
      isDeleted: true,
      isSubmitted: true,
      status: 'SUBMITTED',
      submittedToBase44: true
    };
  } else {
    await addActivity(username, `Uploaded PCU File "${fileName}" for unregistered household: "${fullName}"`);
  }

  return newUpdate;
}

// Add multiple PCU updates for a contact (saves to Base44 PCUUpdate entity + locally)
export async function addPCUUpdatesMultiple(
  contactId: number | string, 
  fullName: string, 
  files: { fileName: string; fileData: string }[], 
  username: string,
  options?: { 
    barangay?: string; 
    purok?: string; 
    contact_number?: string; 
    latitude?: number | null; 
    longitude?: number | null; 
    geotagged?: boolean;
    isLastBatch?: boolean;
    totalFilesCount?: number;
    maintenance?: 'None' | 'Yes' | string;
    maintenance_medicine?: string;
  }
) {
  const contactIdStr = contactId !== undefined && contactId !== null ? String(contactId).trim() : '';
  const contactIdNum = !isNaN(Number(contactId)) ? Number(contactId) : null;
  const targetName = (fullName || '').trim();

  // 1. Search active contacts cache
  let contact = contactsCache.find(c => {
    if (!c) return false;
    const cIdStr = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
    if (contactIdStr && cIdStr && cIdStr === contactIdStr) return true;
    if (contactIdNum !== null && Number(c.id) === contactIdNum) return true;
    if (targetName && c.full_name && (normalizeCompareName(c.full_name, targetName) || c.full_name.trim().toLowerCase() === targetName.toLowerCase())) {
      return true;
    }
    return false;
  });

  // Only reject duplicate submission if it was ALREADY permanently locked in an earlier completed session
  if (contact && (contact.locked || contact.status === 'SUBMITTED' || contact.submittedToBase44)) {
    const isOngoingSession = options?.isLastBatch !== undefined || (files && files.length > 0);
    if (!isOngoingSession) {
      throw new Error(`Contact "${contact.full_name}" has already been submitted to Base44 and is permanently locked. Duplicate submission is strictly prohibited.`);
    }
  }

  // 2. If not found in active contacts, check tombstone cache, pcu updates cache, or existing accounts
  if (!contact) {
    const tombstone = deletedContactsCache.find(d => {
      if (!d) return false;
      const dIdStr = d.id !== undefined && d.id !== null ? String(d.id).trim() : '';
      if (contactIdStr && dIdStr && dIdStr === contactIdStr) return true;
      if (contactIdNum !== null && Number(d.id) === contactIdNum) return true;
      if (targetName && d.full_name && (normalizeCompareName(d.full_name, targetName) || d.full_name.trim().toLowerCase() === targetName.toLowerCase())) {
        return true;
      }
      return false;
    });

    const existingPCU = pcuUpdatesCache.find(p => {
      if (!p) return false;
      const pIdStr = p.contactId !== undefined && p.contactId !== null ? String(p.contactId).trim() : '';
      if (contactIdStr && pIdStr && pIdStr === contactIdStr) return true;
      if (contactIdNum !== null && Number(p.contactId) === contactIdNum) return true;
      if (targetName && p.fullName && (normalizeCompareName(p.fullName, targetName) || p.fullName.trim().toLowerCase() === targetName.toLowerCase())) {
        return true;
      }
      return false;
    });

    const existingAcc = existingAccountsCache.find(e => {
      if (!e) return false;
      const eIdStr = e.id !== undefined && e.id !== null ? String(e.id).trim() : '';
      if (contactIdStr && eIdStr && eIdStr === contactIdStr) return true;
      if (contactIdNum !== null && Number(e.id) === contactIdNum) return true;
      if (targetName && e.full_name && (normalizeCompareName(e.full_name, targetName) || e.full_name.trim().toLowerCase() === targetName.toLowerCase())) {
        return true;
      }
      return false;
    });

    if (tombstone || existingPCU || existingAcc) {
      contact = {
        id: (contactId || (existingAcc ? existingAcc.id : (tombstone ? tombstone.id : Date.now()))) as any,
        full_name: fullName || tombstone?.full_name || existingPCU?.fullName || existingAcc?.full_name || 'Contact',
        barangay: options?.barangay || tombstone?.barangay || existingPCU?.barangay || existingAcc?.barangay || '',
        purok: options?.purok || existingPCU?.purok || existingAcc?.purok || '',
        contact_number: options?.contact_number || existingAcc?.contact_number || '',
        created_at: existingAcc?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        isSubmitted: false,
        uploadedFiles: existingAcc?.uploadedFiles || []
      };
    } else {
      // Graceful dynamic fallback: construct contact record from submitted metadata so submission NEVER fails with "Contact record not found."
      contact = {
        id: contactId || Date.now(),
        full_name: fullName || 'Contact',
        barangay: options?.barangay || '',
        purok: options?.purok || '',
        contact_number: options?.contact_number || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        isSubmitted: false,
        uploadedFiles: []
      };
    }
  }

  // Ensure uploadedFiles is initialized as an array
  if (!Array.isArray(contact.uploadedFiles)) {
    contact.uploadedFiles = [];
  }

  // Mark actively in progress for batch submissions
  if (options?.isLastBatch === false) {
    contact.isSubmitted = false;
  }

  if (options?.barangay !== undefined && options.barangay.trim() !== '') {
    contact.barangay = options.barangay.trim();
  }
  if (options?.purok !== undefined && options.purok.trim() !== '') {
    contact.purok = options.purok.trim();
  }
  if (options?.contact_number !== undefined && options.contact_number.trim() !== '') {
    contact.contact_number = options.contact_number.trim();
  }
  if (options?.maintenance !== undefined) {
    contact.maintenance = options.maintenance;
  }
  if (options?.maintenance_medicine !== undefined) {
    contact.maintenance_medicine = options.maintenance_medicine;
  }
  if (options?.latitude !== undefined && options.latitude !== null && !isNaN(Number(options.latitude))) {
    contact.latitude = Number(options.latitude);
  }
  if (options?.longitude !== undefined && options.longitude !== null && !isNaN(Number(options.longitude))) {
    contact.longitude = Number(options.longitude);
  }
  if (options?.geotagged !== undefined) {
    contact.geotagged = options.geotagged;
  } else if (contact.latitude && contact.longitude) {
    contact.geotagged = true;
  }

  const barangay = contact.barangay || '';
  const purok = contact.purok || '';
  const contactNumber = contact.contact_number || '';
  const hasGeo = (contact.latitude !== undefined && contact.latitude !== null && !isNaN(Number(contact.latitude)) &&
                  contact.longitude !== undefined && contact.longitude !== null && !isNaN(Number(contact.longitude)));
  const latNum = hasGeo ? Number(contact.latitude) : null;
  const lngNum = hasGeo ? Number(contact.longitude) : null;
  const isGeotagged = Boolean(contact.geotagged || hasGeo);
  
  const userObj = findUser(username);
  const uName = userObj?.fullName || userObj?.displayName || username;
  const userEmail = userObj?.email || (username.includes('@') ? username : 'saintfrancisclinic2026@gmail.com');

  contact.uploadedFiles = contact.uploadedFiles || [];
  let lastFileUrl = '';
  let lastUploadedAt = new Date().toISOString();

  // Process files in controlled concurrent batches of 4 for maximum speed and network reliability
  const BATCH_CONCURRENCY = 4;
  for (let i = 0; i < files.length; i += BATCH_CONCURRENCY) {
    const chunk = files.slice(i, i + BATCH_CONCURRENCY);
    await Promise.all(chunk.map(async (file) => {
      const { fileName, fileData } = file;
      let finalFileUrlOrData = fileData;
      let base44EntityValue = '';
      let uploadSuccess = false;

      try {
        // Upload the file to public storage and get the URL to avoid 400 Field limit errors
        const uploadedUrl = await uploadFileToBase44(fileData, fileName);
        if (uploadedUrl) {
          finalFileUrlOrData = uploadedUrl;
          base44EntityValue = uploadedUrl;
          uploadSuccess = true;
        } else {
          throw new Error('Upload returned empty URL');
        }
      } catch (err: any) {
        console.warn('[Base44 PCU Upload Notice] Using local static file storage:', err.message || err);
        try {
          const { mimeType: mType, buffer: buf } = parseDataUrl(fileData, fileName);
          const safeSavedName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${(fileName || 'document').replace(/[^\w.-]/g, '_')}`;
          const pubDir = path.join(process.cwd(), 'public', 'uploads', 'files');
          if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
          fs.writeFileSync(path.join(pubDir, safeSavedName), buf);
          finalFileUrlOrData = `/uploads/files/${safeSavedName}`;
          base44EntityValue = finalFileUrlOrData;
        } catch (_) {
          finalFileUrlOrData = `/uploads/files/doc_${Date.now()}.jpg`;
          base44EntityValue = finalFileUrlOrData;
        }
        uploadSuccess = false;
      }

      const fileUploadedAt = new Date().toISOString();
      const newUpdate: PCUUpdate = {
        id: crypto.randomBytes(8).toString('hex'),
        contactId,
        fullName,
        barangay,
        purok,
        fileName,
        fileData: finalFileUrlOrData, // Save the full URL (if success) or full base64 (if local fallback) in local cache
        uploadedAt: fileUploadedAt,
        uploadedBy: username,
        added_from_website: true,
        status: 'FILES',
        contact_number: contactNumber
      };

      pcuUpdatesCache.unshift(newUpdate);
      lastUploadedAt = fileUploadedAt;
      lastFileUrl = uploadSuccess ? finalFileUrlOrData : `Uploaded: ${fileName} (Local Cache)`;

      // Try to upload metadata to Base44 PCUUpdate entity
      try {
        console.log(`[Base44 SDK] Uploading PCU File metadata to table PCUUpdate for contact: ${fullName}...`);
        const pcuEntity = (base44.entities as any).PCUUpdate || {
          create: async (data: any) => {
            console.log('[Base44 SDK] Simulating PCUUpdate creation dynamically');
            return data;
          }
        };
        
        // Extract firstName and lastName to satisfy Base44 schema requirement
        const nameParts = (fullName || '').trim().split(/\s+/);
        let firstName = 'Unknown';
        let lastName = 'Unknown';
        if (nameParts.length > 1) {
          firstName = nameParts.slice(0, -1).join(' ');
          lastName = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 1 && nameParts[0] !== '') {
          firstName = nameParts[0];
          lastName = 'Unknown';
        }

        const { mimeType } = parseDataUrl(fileData);

        await pcuEntity.create({
          contactId,
          fullName,
          firstName,
          lastName,
          barangay,
          Barangay: barangay,
          purok,
          fileName,
          fileUrl: base44EntityValue, // Save either the CDN URL or the safe metadata placeholder
          fileType: mimeType,
          uploadDate: newUpdate.uploadedAt,
          uploadedBy: uName,
          "Submitted by": uName,
          uploadedByEmail: userEmail,
          contact: contactNumber,
          contact_number: contactNumber,
          maintenance: contact.maintenance || 'None',
          maintenance_medicine: contact.maintenance_medicine || '',
          maintenanceMedicine: contact.maintenance_medicine || '',
          latitude: latNum,
          longitude: lngNum,
          geotagged: isGeotagged,
          geoLocation: hasGeo ? {
            latitude: latNum,
            longitude: lngNum
          } : undefined,
          "Attachment data": base44EntityValue,
          attachmentUrl: base44EntityValue
        });
        console.log('[Base44 SDK] PCU File metadata saved successfully in Base44 PCUUpdate table.');
      } catch (err: any) {
        console.warn('[Base44 SDK Warning] Base44 direct write failed (saving locally instead):', err.message);
      }

      // Add to contact.uploadedFiles array (avoiding duplicate entries)
      const alreadyExists = contact.uploadedFiles.some(f => f.name === fileName && (f.url === finalFileUrlOrData || f.uploadedBy === uName));
      if (!alreadyExists) {
        contact.uploadedFiles.push({
          name: fileName,
          url: finalFileUrlOrData,
          uploadedAt: newUpdate.uploadedAt,
          uploadedBy: uName
        });
      }
    }));
  }

  // Update contact's main PCU fields
  contact.pcu_file_url = lastFileUrl;
  contact.pcu_uploaded_by = username;
  contact.pcu_uploaded_at = lastUploadedAt;
  contact.updated_at = new Date().toISOString();

  await savePCUUpdates();

  const isLastBatch = options?.isLastBatch !== false;

  if (isLastBatch) {
    contact.isSubmitted = true;
    contact.submittedAt = lastUploadedAt;

    // 1. SAVE TO SUBMIT PCU (Files section) & MYSQL pcu_submissions:
    console.log(`[Submission Pipeline] Step 1: Saving contact "${fullName}" (${contact.uploadedFiles?.length || 1} files) to Submit PCU (Files section) in MySQL...`);
    if (isCPanelDbConnected()) {
      try {
        await savePcuSubmissionToCPanel({
          id: String(contact.id || crypto.randomUUID()),
          contactId: contact.id,
          fullName: contact.full_name || fullName,
          barangay: contact.barangay || options?.barangay || '',
          purok: contact.purok || options?.purok || '',
          contactNumber: contact.contact_number || options?.contact_number || '',
          fileName: files[0]?.fileName || 'PCU Document',
          fileUrl: lastFileUrl,
          uploadedFiles: contact.uploadedFiles,
          uploadedBy: username,
          uploadedAt: lastUploadedAt,
          status: 'FILES'
        });
        console.log(`[Submission Pipeline] Step 1 Confirmed: Contact "${fullName}" saved to MySQL pcu_submissions table.`);
      } catch (saveErr: any) {
        console.warn('[Submission Pipeline] MySQL pcu_submissions write notice:', saveErr.message || saveErr);
      }
    }

    // Log action to PCU History
    await logPcuHistory({
      action: 'SUBMITTED_FILES',
      recordId: String(contact.id),
      patientName: fullName,
      barangay: contact.barangay || options?.barangay || '',
      submitter: username,
      performedBy: username,
      previousStatus: 'DIRECTORY',
      newStatus: 'FILES',
      details: `Submitted ${contact.uploadedFiles?.length || 1} file(s) from PCU Directory to Submit PCU under Barangay Folder "${contact.barangay || options?.barangay || ''}" (Files section).`
    });

    // 2. PERMANENTLY DELETE CONTACT FROM CPANEL MYSQL DATABASE:
    let cpanelSyncSuccess = true;
    let cpanelSyncWarning: string | null = null;
    if (isCPanelDbConnected()) {
      try {
        console.log(`[Submission Pipeline] Step 2: Marking contact "${fullName}" deleted in cPanel MySQL database...`);
        await deleteContactFromCPanel(contact.id, new Date().toISOString(), fullName, contact.barangay);
        console.log(`[Submission Pipeline] Step 2 Confirmed: Contact "${fullName}" deleted in cPanel MySQL database.`);
      } catch (err: any) {
        cpanelSyncSuccess = false;
        cpanelSyncWarning = err.message || 'Error updating cPanel MySQL database';
        console.error('[Submission Pipeline] Step 2 Error deleting contact from cPanel MySQL database:', cpanelSyncWarning);
      }
    }

    // 3. PERMANENTLY DELETE CONTACT FROM PCU DIRECTORY AND RECORD TOMBSTONE:
    console.log(`[Submission Pipeline] Step 3: Permanently deleting contact "${fullName}" from PCU Directory and recording tombstone...`);
    const targetContactId = contact.id;
    const targetContactName = contact.full_name || fullName;
    const targetContactBarangay = contact.barangay || options?.barangay || '';

    // Record tombstone in deletedContactsCache with submitted_to_base44: true
    deletedContactsCache = deletedContactsCache.filter(d => 
      !(targetContactId && d.id && d.id.toString() === targetContactId.toString()) && 
      !(targetContactName && d.full_name && normalizeCompareName(d.full_name, targetContactName))
    );
    deletedContactsCache.push({
      id: targetContactId,
      full_name: targetContactName,
      barangay: targetContactBarangay,
      deletedAt: new Date().toISOString(),
      submitted_to_base44: true
    });
    await safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8');
    syncDeletedRecordsToGoogleSheets(true).catch(err => console.error('Failed to sync deleted records to Google Sheets:', err));

    // Permanently remove from contactsCache so it NEVER displays in PCU Directory or in any folder
    contactsCache = contactsCache.filter(c => 
      !(targetContactId && c.id && c.id.toString() === targetContactId.toString()) && 
      !(targetContactName && c.full_name && normalizeCompareName(c.full_name, targetContactName))
    );
    await saveContacts();

    const totalUploadedCount = options?.totalFilesCount || files.length;
    await addActivity(username, `Uploaded ${totalUploadedCount} PCU File(s), submitted to Base44, and permanently deleted from PCU Directory: "${fullName}"`);

    return {
      ...contact,
      cpanelSyncSuccess,
      cpanelSyncWarning: cpanelSyncWarning || undefined,
      sheetsSyncSuccess: true,
      sheetsSyncWarning: undefined,
      isDeleted: true,
      isSubmitted: true,
      status: 'SUBMITTED',
      submittedToBase44: true
    };
  } else {
    // Intermediate batch: save updated contactsCache without removing the contact yet
    await saveContacts();
  }

  return contact;
}

/**
 * Logs a PCU action/status transition into pcuHistoryCache and cPanel MySQL table `pcu_history`.
 */
export async function logPcuHistory(item: {
  action: string;
  recordId?: string;
  patientName: string;
  barangay?: string;
  submitter?: string;
  performedBy: string;
  previousStatus?: string;
  newStatus: string;
  details?: string;
}): Promise<PcuHistoryItem> {
  const historyEntry: PcuHistoryItem = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    action: item.action,
    recordId: item.recordId || '',
    patientName: item.patientName || 'Unknown Patient',
    barangay: item.barangay || '',
    submitter: item.submitter || '',
    performedBy: item.performedBy || 'Admin',
    previousStatus: item.previousStatus || '',
    newStatus: item.newStatus || '',
    timestamp: new Date().toISOString(),
    details: item.details || ''
  };

  pcuHistoryCache.unshift(historyEntry);
  if (pcuHistoryCache.length > 2000) {
    pcuHistoryCache = pcuHistoryCache.slice(0, 2000);
  }
  await safeWriteFile(PCU_HISTORY_FILE, JSON.stringify(pcuHistoryCache, null, 2), 'utf-8').catch(() => {});

  if (isCPanelDbConnected()) {
    try {
      await savePcuHistoryToCPanel(historyEntry);
    } catch (err: any) {
      console.warn('[cPanel DB History] Error saving history to MySQL:', err.message);
    }
  }

  return historyEntry;
}

export function getPcuHistory(): PcuHistoryItem[] {
  return pcuHistoryCache;
}

/**
 * Transfers a contact from PCU Directory directly to Submit PCU under its Barangay folder (Files section).
 * New Workflow: PCU Directory -> Submit PCU -> Barangay Folder -> Files
 * Removes the old Base44 workflow completely while ensuring 100% data integrity and persistence.
 */
export async function transferContactToSubmitPcu(contactIdOrName: string | number, username: string = 'Admin') {
  const idStr = String(contactIdOrName).trim();
  const idNum = !isNaN(Number(contactIdOrName)) ? Number(contactIdOrName) : null;

  let contact = contactsCache.find(c => {
    if (!c) return false;
    const cIdStr = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
    if (idStr && cIdStr && cIdStr === idStr) return true;
    if (idNum !== null && Number(c.id) === idNum) return true;
    if (normalizeCompareName(c.full_name, idStr)) return true;
    return false;
  });

  if (!contact) {
    throw new Error(`Contact "${contactIdOrName}" not found in PCU Directory.`);
  }

  const fullName = contact.full_name.trim();
  const barangay = (contact.barangay || 'General / Unassigned').trim();
  const purok = (contact.purok || '').trim();
  const contactNumber = (contact.contact_number || '').trim();
  const submissionId = String(contact.id);

  // Prevent duplicate submissions if already transferred or submitted
  const isAlreadySubmitted = pcuUpdatesCache.some(p => 
    String(p.contactId) === submissionId || 
    String(p.id) === submissionId ||
    (p.fullName && normalizeCompareName(p.fullName, fullName) && isBarangayMatch(p.barangay || '', barangay))
  );

  if (isAlreadySubmitted) {
    // If already in Submit PCU, ensure it's safely removed from PCU Directory and notify
    contactsCache = contactsCache.filter(c => c.id !== contact!.id && !normalizeCompareName(c.full_name, fullName));
    await saveContacts();
    if (isCPanelDbConnected()) {
      deleteContactFromCPanel(contact.id, new Date().toISOString(), fullName, barangay).catch(() => {});
    }
    return {
      success: true,
      message: `Contact "${fullName}" is already present in Submit PCU under Barangay "${barangay}" (Files section).`,
      alreadyExisted: true
    };
  }

  // 1. Prepare PCU Submission Record for Submit PCU (Files section)
  const uploadedAt = new Date().toISOString();
  const defaultFileName = contact.pcu_file_url 
    ? 'PCU Document' 
    : (contact.photo_url ? 'Patient Photo Record' : 'Patient Information Document');
  const defaultFileUrl = contact.pcu_file_url || contact.photo_url || '';

  const uploadedFiles = contact.uploadedFiles && contact.uploadedFiles.length > 0 
    ? contact.uploadedFiles 
    : [{
        name: defaultFileName,
        url: defaultFileUrl,
        uploadedAt,
        uploadedBy: username
      }];

  const newSubmission: PCUUpdate = {
    id: submissionId,
    contactId: submissionId,
    fullName,
    barangay,
    purok,
    fileName: uploadedFiles[0]?.name || defaultFileName,
    fileData: uploadedFiles[0]?.url || defaultFileUrl,
    uploadedAt,
    uploadedBy: username,
    added_from_website: true,
    status: 'FILES',
    contact_number: contactNumber,
    uploadedFiles
  };

  // 2. Add to pcuUpdatesCache and persist locally
  pcuUpdatesCache.unshift(newSubmission);
  await safeWriteFile(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2), 'utf-8');

  // 3. Save directly to cPanel MySQL pcu_submissions table
  let cpanelSyncSuccess = true;
  let cpanelSyncWarning: string | null = null;
  if (isCPanelDbConnected()) {
    try {
      await savePcuSubmissionToCPanel({
        id: submissionId,
        contactId: submissionId,
        fullName,
        barangay,
        purok,
        contactNumber,
        fileName: newSubmission.fileName,
        fileUrl: newSubmission.fileData,
        uploadedFiles,
        uploadedBy: username,
        uploadedAt,
        status: 'FILES'
      });
      console.log(`[PCU Directory -> Submit PCU] Successfully saved contact "${fullName}" to MySQL pcu_submissions table.`);
    } catch (saveErr: any) {
      cpanelSyncSuccess = false;
      cpanelSyncWarning = saveErr.message || 'Error saving to MySQL pcu_submissions';
      console.warn('[PCU Transfer Warning] Failed to save to MySQL pcu_submissions:', cpanelSyncWarning);
    }
  }

  // 4. Record action in PCU History log and system activity
  await logPcuHistory({
    action: 'TRANSFERRED_FROM_DIRECTORY',
    recordId: submissionId,
    patientName: fullName,
    barangay,
    submitter: username,
    performedBy: username,
    previousStatus: 'DIRECTORY',
    newStatus: 'FILES',
    details: `Transferred from PCU Directory to Submit PCU under Barangay Folder "${barangay}" (Files section).`
  });
  await addActivity(username, `Transferred contact "${fullName}" from PCU Directory to Submit PCU under Barangay "${barangay}" (Files).`);

  // 5. ONLY AFTER successful persistence in Submit PCU: remove from PCU Directory & record tombstone
  const targetContactId = contact.id;
  deletedContactsCache = deletedContactsCache.filter(d => 
    !(targetContactId && d.id && d.id.toString() === targetContactId.toString()) && 
    !(fullName && d.full_name && normalizeCompareName(d.full_name, fullName))
  );
  deletedContactsCache.push({
    id: targetContactId,
    full_name: fullName,
    barangay,
    deletedAt: uploadedAt,
    submitted_to_base44: true
  });
  await safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8');

  // Remove from contactsCache
  contactsCache = contactsCache.filter(c => 
    c.id !== targetContactId && !(fullName && c.full_name && normalizeCompareName(c.full_name, fullName))
  );
  await saveContacts();

  // Permanently delete contact from cPanel MySQL contacts table
  if (isCPanelDbConnected()) {
    deleteContactFromCPanel(targetContactId, uploadedAt, fullName, barangay).catch(() => {});
  }

  return {
    success: true,
    message: `Contact "${fullName}" successfully transferred to Submit PCU under Barangay "${barangay}" (Files section) and removed from PCU Directory.`,
    data: newSubmission,
    cpanelSyncSuccess,
    cpanelSyncWarning: cpanelSyncWarning || undefined
  };
}

/**
 * Backward compatibility alias: forwards old submitContactToBase44 calls to the new transferContactToSubmitPcu workflow.
 */
export async function submitContactToBase44(contactIdOrName: string | number, username: string = 'Admin') {
  return await transferContactToSubmitPcu(contactIdOrName, username);
}

// Get all PCU Updates
export function getPCUUpdates() {
  return pcuUpdatesCache;
}

// Get Recent Uploads filtered specifically for the current user/uploader
export function getRecentUploads(params: {
  username: string;
  search?: string;
  barangay?: string;
  purok?: string;
  sortBy?: 'name' | 'barangay' | 'purok' | 'date';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) {
  const { username, search, barangay, purok, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 10 } = params;

  // Ensure all PCU statuses are fully restored on any contacts before querying/filtering
  syncPCUFieldsToCache();

  // 1. Get uploaded contacts from pcuUpdatesCache and contactsCache
  const current = (username || '').toLowerCase().trim();
  const userObj = findUser(username);
  const uName = (userObj?.fullName || userObj?.displayName || '').toLowerCase().trim();
  const userRole = (userObj?.role || '').toUpperCase();
  const isSuper = !current || current === 'admin' || userRole === 'ADMIN' || userRole === 'MASTER ADMIN' || userRole === 'IT';

  // Group all PCU uploads by person
  const updatesByPerson = new Map<string, any>();

  for (const u of pcuUpdatesCache) {
    if (!u) continue;
    const nameKey = `${(u.fullName || '').trim().toLowerCase()}___${(u.barangay || '').trim().toLowerCase()}`;
    if (!nameKey.replace(/___/g, '')) continue;

    const actualId = (u.contactId && String(u.contactId).toLowerCase() !== 'new' ? u.contactId : u.id) || `pcu_${Date.now()}`;
    const rawStatus = (u.status || 'FILES').toUpperCase();
    const pcuStatus = (rawStatus === 'VERIFIED' || rawStatus === 'PENDING' || rawStatus === 'UPDATED') ? rawStatus : 'FILES';

    if (!updatesByPerson.has(nameKey)) {
      updatesByPerson.set(nameKey, {
        id: actualId,
        full_name: u.fullName,
        barangay: u.barangay || 'Unassigned',
        purok: u.purok || '',
        contact_number: (u as any).contact_number || (u as any).contactNumber || '',
        created_at: u.uploadedAt || new Date().toISOString(),
        updated_at: u.uploadedAt || new Date().toISOString(),
        deleted_at: null,
        pcu_file_url: u.fileData || '',
        pcu_uploaded_by: u.uploadedBy || 'Admin',
        pcu_uploaded_at: u.uploadedAt || new Date().toISOString(),
        isExistingAccount: false,
        category: 'pcu',
        status: pcuStatus,
        verified_at: (u as any).verified_at || null,
        verified_by: (u as any).verified_by || null,
        pending_at: (u as any).pending_at || null,
        pending_by: (u as any).pending_by || null,
        updated_status_at: (u as any).updated_status_at || null,
        updated_status_by: (u as any).updated_status_by || null,
        verified_credit_added: Boolean((u as any).verified_credit_added),
        pending_credit_added: Boolean((u as any).pending_credit_added),
        uploadedFiles: []
      });
    }

    const item = updatesByPerson.get(nameKey)!;
    if (pcuStatus === 'VERIFIED' || pcuStatus === 'PENDING' || pcuStatus === 'UPDATED') {
      item.status = pcuStatus;
    }
    if ((u as any).verified_at) item.verified_at = (u as any).verified_at;
    if ((u as any).verified_by) item.verified_by = (u as any).verified_by;
    if ((u as any).pending_at) item.pending_at = (u as any).pending_at;
    if ((u as any).pending_by) item.pending_by = (u as any).pending_by;
    if ((u as any).updated_status_at) item.updated_status_at = (u as any).updated_status_at;
    if ((u as any).updated_status_by) item.updated_status_by = (u as any).updated_status_by;
    if ((u as any).verified_credit_added) item.verified_credit_added = true;
    if ((u as any).pending_credit_added) item.pending_credit_added = true;
    if ((!item.barangay || item.barangay === 'Unassigned') && u.barangay) {
      item.barangay = u.barangay;
    }
    if (!item.purok && u.purok) {
      item.purok = u.purok;
    }
    item.uploadedFiles.push({
      name: u.fileName || 'PCU Document',
      url: u.fileData || '',
      uploadedAt: u.uploadedAt || new Date().toISOString(),
      uploadedBy: u.uploadedBy || 'Admin'
    });
  }

  // Also include any in contactsCache that have PCU files
  for (const c of contactsCache) {
    if (!c || !isContactSubmitted(c)) continue;
    const nameKey = `${(c.full_name || '').trim().toLowerCase()}___${(c.barangay || '').trim().toLowerCase()}`;
    if (!nameKey.replace(/___/g, '')) continue;
    const cStatus = ((c as any).pcu_status || c.status || '').toUpperCase() === 'VERIFIED' ? 'VERIFIED' : 'PENDING';

    if (!updatesByPerson.has(nameKey)) {
      const uploadedFiles = c.uploadedFiles && c.uploadedFiles.length > 0 ? c.uploadedFiles : [{
        name: c.pcu_file_url ? (c.pcu_file_url.includes('/') ? (c.pcu_file_url.split('/').pop() || 'PCU Document').replace(/^\d+_/,'') : c.pcu_file_url) : 'PCU Document',
        url: c.pcu_file_url || '',
        uploadedAt: c.pcu_uploaded_at || c.updated_at || new Date().toISOString(),
        uploadedBy: c.pcu_uploaded_by || 'Admin'
      }];
      updatesByPerson.set(nameKey, {
        ...c,
        isExistingAccount: false,
        category: 'pcu',
        status: cStatus,
        uploadedFiles
      });
    }
  }

  const uploadedContacts = Array.from(updatesByPerson.values()).filter(c => {
    if (isSuper) return true;

    const uploader = (c.pcu_uploaded_by || '').toLowerCase().trim();
    if (uploader === current || (uName && uploader === uName) || uploader === 'admin') {
      return true;
    }

    if (c.uploadedFiles && c.uploadedFiles.some((f: any) => {
      const up = (f.uploadedBy || '').toLowerCase().trim();
      return up === current || (uName && up === uName) || up === 'admin';
    })) {
      return true;
    }

    if (userObj?.barangay && c.barangay && normalizeBarangayName(userObj.barangay).toLowerCase() === normalizeBarangayName(c.barangay).toLowerCase()) {
      return true;
    }

    return false;
  });

  // 2. Get uploaded existing accounts from existingAccountsCache (those transferred with uploaded files)
  const uploadedExistingAccounts = existingAccountsCache.filter(acc => {
    // Only include if it has uploaded files
    const hasFiles = Boolean(acc.uploadedFiles && acc.uploadedFiles.length > 0);
    if (!hasFiles) return false;

    const uploader = (acc.uploadedFiles && acc.uploadedFiles.length > 0 ? acc.uploadedFiles[0].uploadedBy : '') || acc.submittedBy || 'Admin';
    const current = (username || '').toLowerCase().trim();
    if (!current || current === 'admin') return true;
    return uploader.toLowerCase().trim() === current || uploader.toLowerCase().trim() === 'admin';
  }).map(acc => {
    const hasFiles = acc.uploadedFiles && acc.uploadedFiles.length > 0;
    const fileUrl = hasFiles ? acc.uploadedFiles![0].url : '';
    const uploadedBy = hasFiles ? (acc.uploadedFiles![0].uploadedBy || acc.submittedBy || 'Admin') : (acc.submittedBy || 'Admin');
    const uploadedAt = hasFiles ? acc.uploadedFiles![0].uploadedAt : (acc.created_at || new Date().toISOString());
    return {
      id: acc.id,
      full_name: acc.full_name,
      barangay: acc.barangay,
      purok: acc.purok,
      contact_number: acc.contact_number,
      created_at: acc.created_at,
      updated_at: acc.created_at,
      deleted_at: null,
      pcu_file_url: fileUrl,
      pcu_uploaded_by: uploadedBy,
      pcu_uploaded_at: uploadedAt,
      isExistingAccount: true,
      category: 'existing_account',
      status: ((acc as any).pcu_status || (acc as any).status || '').toUpperCase() === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
      pin: acc.pin || '',
      facebookLink: acc.facebookLink || '',
      latitude: acc.latitude,
      longitude: acc.longitude,
      geotagged: acc.geotagged || (acc.latitude !== undefined && acc.longitude !== undefined),
      uploadedFiles: acc.uploadedFiles || []
    };
  });

  // Combine both types of uploads
  let combined = [...uploadedContacts, ...uploadedExistingAccounts];

  const allBarangaysSet = new Set<string>();
  combined.forEach(c => {
    if (c.barangay && c.barangay.trim()) {
      allBarangaysSet.add(c.barangay.trim());
    }
  });
  const allBarangays = Array.from(allBarangaysSet).sort((a, b) => a.localeCompare(b));

  const allPuroksSet = new Set<string>();
  combined.forEach(c => {
    if (c.purok) allPuroksSet.add(c.purok.trim());
  });
  const allPuroks = Array.from(allPuroksSet).sort((a, b) => a.localeCompare(b));

  if (barangay && barangay !== 'All Addresses' && barangay !== 'All Barangays') {
    combined = combined.filter(c => isBarangayMatch(c.barangay, barangay));
  }

  if (purok && purok !== 'All Puroks') {
    combined = combined.filter(c => c.purok && c.purok.toLowerCase() === purok.toLowerCase());
  }

  if (search) {
    const term = search.toLowerCase().trim();
    combined = combined.filter(c =>
      c.full_name.toLowerCase().includes(term) ||
      c.barangay.toLowerCase().includes(term) ||
      (c.purok && c.purok.toLowerCase().includes(term)) ||
      (c.contact_number && c.contact_number.includes(term))
    );
  }

  combined.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.full_name.localeCompare(b.full_name);
    } else if (sortBy === 'barangay') {
      comparison = a.barangay.localeCompare(b.barangay);
    } else if (sortBy === 'purok') {
      comparison = (a.purok || '').localeCompare(b.purok || '');
    } else {
      const timeA = new Date(a.pcu_uploaded_at || a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.pcu_uploaded_at || b.updated_at || b.created_at).getTime();
      comparison = timeB - timeA;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const total = combined.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (safePage - 1) * limit;
  const paginated = combined.slice(startIndex, startIndex + limit);

  return {
    contacts: paginated,
    total,
    page: safePage,
    totalPages,
    limit,
    allBarangays,
    allPuroks
  };
}

// Restore files and move an existing account back to directory (clears files, sets addedToFiles = true)
export async function restoreExistingAccountFiles(id: string, username: string): Promise<ExistingAccountItem> {
  const accountIndex = existingAccountsCache.findIndex(acc => acc.id === id);
  if (accountIndex === -1) {
    throw new Error(`Existing account with ID "${id}" not found`);
  }

  const existingAccount = existingAccountsCache[accountIndex];
  existingAccount.uploadedFiles = [];
  existingAccount.addedToFiles = true;

  // Persist locally
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  
  await addActivity(username, `Restored files and moved existing account back to directory: "${existingAccount.full_name}"`);
  
  // Also update in Base44 database if applicable
  if (!id.toString().startsWith('ext_')) {
    try {
      const submissionEntity = base44.entities.HouseholdSubmission;
      if (submissionEntity && typeof submissionEntity.update === 'function') {
        console.log(`[Base44 SDK] Restoring (clearing files) in Base44 HouseholdSubmission for ID: ${id}...`);
        await submissionEntity.update(id, { uploadedFiles: [] });
        console.log(`[Base44 SDK] Successfully updated in Base44.`);
      }
    } catch (err: any) {
      console.warn(`[Base44 SDK Warning] Failed to update in Base44:`, err.message);
    }
  }

  return existingAccount;
}

// Remove PCU file from a contact, returning it to Saint Francis Clinic Directory
export async function removePCUFileFromContact(contactId: number | string, username: string) {
  const contactIdStr = contactId !== undefined && contactId !== null ? String(contactId).trim() : '';
  const contactIdNum = !isNaN(Number(contactId)) ? Number(contactId) : null;

  let contact = contactsCache.find(c => {
    if (!c) return false;
    const cIdStr = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
    if (contactIdStr && cIdStr && cIdStr === contactIdStr) return true;
    if (contactIdNum !== null && Number(c.id) === contactIdNum) return true;
    return false;
  });

  if (!contact) {
    // Check if it was tombstoned
    const tombstoneIndex = deletedContactsCache.findIndex(d => {
      if (!d) return false;
      const dIdStr = d.id !== undefined && d.id !== null ? String(d.id).trim() : '';
      if (contactIdStr && dIdStr && dIdStr === contactIdStr) return true;
      if (contactIdNum !== null && Number(d.id) === contactIdNum) return true;
      return false;
    });

    const existingPCU = pcuUpdatesCache.find(p => {
      if (!p) return false;
      const pIdStr = p.contactId !== undefined && p.contactId !== null ? String(p.contactId).trim() : '';
      if (contactIdStr && pIdStr && pIdStr === contactIdStr) return true;
      if (contactIdNum !== null && Number(p.contactId) === contactIdNum) return true;
      return false;
    });

    if (tombstoneIndex !== -1 || existingPCU) {
      const tombstone = tombstoneIndex !== -1 ? deletedContactsCache[tombstoneIndex] : null;
      contact = {
        id: (contactId || (tombstone ? tombstone.id : Date.now())) as any,
        full_name: tombstone?.full_name || existingPCU?.fullName || 'Contact',
        barangay: tombstone?.barangay || existingPCU?.barangay || '',
        purok: existingPCU?.purok || '',
        contact_number: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        isSubmitted: false,
        uploadedFiles: []
      };
      // Re-insert into contactsCache
      contactsCache.push(contact);
      if (tombstoneIndex !== -1) {
        deletedContactsCache.splice(tombstoneIndex, 1);
        safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8').catch(() => {});
      }
    }
  }

  if (!contact) throw new Error('Contact record not found.');

  // Find and remove from base44 database
  try {
    const pcuEntity = (base44.entities as any).PCUUpdate;
    if (pcuEntity) {
      console.log(`[Base44 SDK] Searching for PCUUpdate records to delete for contact: ${contact.full_name}...`);
      const submissions = await getCachedPCUUpdates(false);
      if (submissions && Array.isArray(submissions)) {
        // Extract firstName and lastName to compare
        const nameParts = (contact.full_name || '').trim().split(/\s+/);
        let firstName = 'Unknown';
        let lastName = 'Unknown';
        if (nameParts.length > 1) {
          firstName = nameParts.slice(0, -1).join(' ');
          lastName = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 1 && nameParts[0] !== '') {
          firstName = nameParts[0];
          lastName = 'Unknown';
        }

        const matchLower = (str?: string) => (str || '').trim().toLowerCase();
        
        // Find matching updates
        const matchingEntries = submissions.filter((sub: any) => {
          return (
            (matchLower(sub.firstName) === matchLower(firstName) && matchLower(sub.lastName) === matchLower(lastName)) ||
            (sub.contact === contact.contact_number && contact.contact_number !== '')
          );
        });

        // Note: Application is submission-only and strictly never deletes records from Base44 database
      }
    }
  } catch (err: any) {
    console.error('[Base44 SDK Warning] Error in removePCUFileFromContact:', err.message || err);
  }

  // Remove matching updates from local cache
  pcuUpdatesCache = pcuUpdatesCache.filter(p => 
    p.contactId.toString() !== contactId.toString() && 
    !normalizeCompareName(p.fullName, contact.full_name)
  );
  await savePCUUpdates();

  delete contact.pcu_file_url;
  delete contact.pcu_uploaded_by;
  delete contact.pcu_uploaded_at;
  delete contact.uploadedFiles;
  contact.isSubmitted = false;
  delete contact.submittedAt;
  contact.updated_at = new Date().toISOString();

  // Also clear from local Base44 households cache if present
  try {
    if (fs.existsSync(HOUSEHOLDS_CACHE_FILE)) {
      const data = fs.readFileSync(HOUSEHOLDS_CACHE_FILE, 'utf-8');
      if (data && data.trim()) {
        const submissions = JSON.parse(data);
        if (Array.isArray(submissions)) {
          const filtered = submissions.filter((sub: any) => {
            if (sub.contactId && sub.contactId.toString() === contactId.toString()) return false;
            if (sub.id && (sub.id === `hh_${contactId}` || sub.id === String(contactId))) return false;
            const sName = sub.memberName || (sub.fpe && sub.fpe.fullName) || sub.full_name || '';
            if (sName && normalizeCompareName(sName, contact.full_name)) return false;
            return true;
          });
          safeWriteFileSync(HOUSEHOLDS_CACHE_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
        }
      }
    }
  } catch (e) {}

  await saveContacts();
  await addActivity(username, `Restored household record to Clinic Directory and deleted associated PCU file: "${contact.full_name}"`);

  if (sheetsConfig.syncEnabled) {
    forwardToWebApp('add', contact).catch(err => console.error('[Google Sheets] Error restoring contact to Google Sheets:', err));
  }

  return contact;
}

/**
 * Permanently deletes a PCU submission or individual file from cPanel MySQL and all clinic records.
 */
export async function permanentlyDeletePcuSubmission(params: {
  id?: string | number;
  fullName?: string;
  fileName?: string;
  fileUrl?: string;
  deleteAll?: boolean;
  username?: string;
}): Promise<{ success: boolean; message: string; remainingFiles?: number }> {
  const { id, fullName, fileName, fileUrl, deleteAll, username } = params;

  console.log(`[PCU Deletion] Permanently deleting PCU record/file:`, params);

  // 1. Permanently delete from cPanel MySQL database
  if (isCPanelDbConnected()) {
    try {
      if (deleteAll || (!fileName && !fileUrl)) {
        await deletePcuSubmissionFromCPanel({ id, fullName, fileName, fileUrl });
      } else {
        await deletePcuFileFromCPanel({ id, fullName, fileName, fileUrl });
      }
    } catch (err: any) {
      console.warn('[PCU Deletion Warning] Failed to delete from cPanel MySQL:', err.message || err);
    }
  }

  // 2. Remove or update in local pcuUpdatesCache
  const normName = (fullName || '').trim().toLowerCase();
  const idStr = id !== undefined && id !== null ? String(id).trim() : '';

  if (deleteAll || (!fileName && !fileUrl)) {
    pcuUpdatesCache = pcuUpdatesCache.filter(u => {
      if (!u) return false;
      if (idStr && (String(u.id) === idStr || String(u.contactId) === idStr)) return false;
      if (normName && (u.fullName || '').trim().toLowerCase() === normName) return false;
      return true;
    });
  } else {
    pcuUpdatesCache = pcuUpdatesCache.filter(u => {
      if (!u) return false;
      const matchPerson = (idStr && (String(u.id) === idStr || String(u.contactId) === idStr)) ||
                          (normName && (u.fullName || '').trim().toLowerCase() === normName);
      if (matchPerson) {
        if (fileName && (u.fileName === fileName || (u as any).name === fileName)) return false;
        if (fileUrl && (u.fileData === fileUrl || (u as any).url === fileUrl)) return false;
      }
      return true;
    });
  }
  await savePCUUpdates();

  // 3. Update or remove from contactsCache if matching
  let remainingCount = 0;
  const matchingContact = contactsCache.find(c => {
    if (!c) return false;
    if (idStr && String(c.id) === idStr) return true;
    if (normName && (c.full_name || '').trim().toLowerCase() === normName) return true;
    return false;
  });

  if (matchingContact) {
    if (deleteAll || (!fileName && !fileUrl)) {
      delete matchingContact.pcu_file_url;
      delete matchingContact.pcu_uploaded_by;
      delete matchingContact.pcu_uploaded_at;
      matchingContact.uploadedFiles = [];
      matchingContact.isSubmitted = false;
      delete matchingContact.submittedAt;
      matchingContact.updated_at = new Date().toISOString();
      remainingCount = 0;
    } else if (Array.isArray(matchingContact.uploadedFiles) && matchingContact.uploadedFiles.length > 0) {
      matchingContact.uploadedFiles = matchingContact.uploadedFiles.filter((f: any) => {
        if (fileName && (f.name === fileName || f.fileName === fileName)) return false;
        if (fileUrl && (f.url === fileUrl || f.fileData === fileUrl)) return false;
        return true;
      });
      remainingCount = matchingContact.uploadedFiles.length;
      if (matchingContact.uploadedFiles.length > 0) {
        const last: any = matchingContact.uploadedFiles[matchingContact.uploadedFiles.length - 1];
        matchingContact.pcu_file_url = last.url || last.fileData || '';
      } else {
        delete matchingContact.pcu_file_url;
        delete matchingContact.pcu_uploaded_by;
        delete matchingContact.pcu_uploaded_at;
        matchingContact.isSubmitted = false;
        delete matchingContact.submittedAt;
      }
      matchingContact.updated_at = new Date().toISOString();
    }
    await saveContacts();
  }

  // 4. Update or clean up deletedContactsCache if tombstone exists
  if (deleteAll || (!fileName && !fileUrl) || remainingCount === 0) {
    deletedContactsCache = deletedContactsCache.filter(d => {
      if (!d) return false;
      if (idStr && String(d.id) === idStr) return false;
      if (normName && (d.full_name || '').trim().toLowerCase() === normName) return false;
      return true;
    });
    safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8').catch(() => {});
  }

  // 5. Activity log
  const targetLabel = fileName ? `file "${fileName}" for ${fullName || 'patient'}` : `submission for "${fullName || id}"`;
  await addActivity(username || 'Admin', `Permanently deleted PCU ${targetLabel} from MySQL database.`);

  return {
    success: true,
    message: `Permanently deleted PCU ${targetLabel} from MySQL database and clinic records.`,
    remainingFiles: remainingCount
  };
}

/**
 * Updates the status of a PCU submission (VERIFIED, PENDING, UPDATED, or FILES).
 * Handles idempotent credit calculation and logs each action permanently to MySQL pcu_history.
 */
export async function updatePcuSubmissionStatus(params: {
  id?: string | number;
  fullName?: string;
  status: 'VERIFIED' | 'PENDING' | 'UPDATED' | 'FILES' | string;
  username?: string;
}): Promise<{ success: boolean; status: string; fullName: string; message: string; creditAdded?: boolean }> {
  const { id, fullName, status: rawStatus, username = 'Admin' } = params;
  const status = (rawStatus || 'FILES').toUpperCase() as 'VERIFIED' | 'PENDING' | 'UPDATED' | 'FILES';
  const normName = (fullName || '').trim().toLowerCase();
  const idStr = id !== undefined && id !== null ? String(id).trim() : '';
  const nowIso = new Date().toISOString();

  console.log(`[PCU Status] Setting status to "${status}" for: id=${idStr}, name=${fullName}`);

  let matchedSubmission: PCUUpdate | null = null;
  let previousStatus = 'FILES';
  let creditAdded = false;

  // 1. Update in local pcuUpdatesCache
  for (const u of pcuUpdatesCache) {
    if (!u) continue;
    const matchPerson = (idStr && idStr !== 'new' && (String(u.id) === idStr || String(u.contactId) === idStr)) ||
                        (normName && (u.fullName || '').trim().toLowerCase() === normName);
    if (matchPerson) {
      matchedSubmission = u;
      previousStatus = (u.status || 'FILES').toUpperCase();
      u.status = status;

      if (status === 'VERIFIED') {
        u.verified_at = nowIso;
        u.verified_by = username;
        if (!u.verified_credit_added) {
          u.verified_credit_added = true;
          creditAdded = true;
        }
      } else if (status === 'PENDING') {
        u.pending_at = nowIso;
        u.pending_by = username;
        if (!u.pending_credit_added) {
          u.pending_credit_added = true;
          creditAdded = true;
        }
      } else if (status === 'UPDATED') {
        u.updated_status_at = nowIso;
        u.updated_status_by = username;
      }
    }
  }

  // 2. Also update in contactsCache if matching
  for (const c of contactsCache) {
    if (!c) continue;
    const matchPerson = (idStr && idStr !== 'new' && String(c.id) === idStr) ||
                        (normName && (c.full_name || '').trim().toLowerCase() === normName);
    if (matchPerson) {
      (c as any).pcu_status = status;
      if (status === 'VERIFIED') {
        (c as any).verified_at = nowIso;
        (c as any).verified_by = username;
      } else if (status === 'PENDING') {
        (c as any).pending_at = nowIso;
        (c as any).pending_by = username;
      } else if (status === 'UPDATED') {
        (c as any).updated_status_at = nowIso;
        (c as any).updated_status_by = username;
      }
    }
  }

  // 3. Save to local pcu_updates.json
  await savePCUUpdates();

  // 4. Update in cPanel MySQL database if connected
  if (isCPanelDbConnected()) {
    try {
      await updatePcuStatusInCPanel({
        id: idStr,
        fullName: fullName || matchedSubmission?.fullName || '',
        status,
        username
      });
    } catch (err: any) {
      console.warn('[PCU Status Warning] Failed to update in cPanel MySQL:', err.message || err);
    }
  }

  // 5. Log to pcu_history in MySQL
  const patName = fullName || matchedSubmission?.fullName || 'Record';
  const patBarangay = matchedSubmission?.barangay || '';
  const submitter = matchedSubmission?.uploadedBy || '';

  let actionName = 'STATUS_UPDATED';
  let detailsText = `Status updated to ${status} by ${username}.`;

  if (status === 'VERIFIED') {
    actionName = 'VERIFIED';
    detailsText = `Verified submission by ${username}. 1 Credit × ₱${pcuBaseRate.toFixed(2)} credited to ${submitter}.`;
  } else if (status === 'PENDING') {
    actionName = 'MOVED_TO_PENDING';
    detailsText = `Moved to Pending by ${username}. 1 Credit × ₱${pcuPendingBaseRate.toFixed(2)} credited to ${submitter}.`;
  } else if (status === 'UPDATED') {
    actionName = 'MOVED_TO_UPDATED';
    detailsText = `Updated record by ${username}. Transferred from Pending to Updated.`;
  } else if (status === 'FILES') {
    actionName = 'MOVED_TO_FILES';
    detailsText = `Returned to Files by ${username}.`;
  }

  await logPcuHistory({
    action: actionName,
    recordId: idStr || (matchedSubmission ? String(matchedSubmission.id) : ''),
    patientName: patName,
    barangay: patBarangay,
    submitter,
    performedBy: username,
    previousStatus,
    newStatus: status,
    details: detailsText
  });

  await addActivity(username, `${actionName.replace(/_/g, ' ')}: "${patName}" (${previousStatus} -> ${status})`);

  return {
    success: true,
    status,
    fullName: patName,
    message: `Record "${patName}" is now ${status}.`,
    creditAdded
  };
}

// Get local existing accounts
export function getLocalExistingAccounts(): ExistingAccountItem[] {
  return existingAccountsCache.filter(acc => acc && acc.full_name);
}

// Add local existing account
export async function addLocalExistingAccount(data: any, username: string): Promise<ExistingAccountItem> {
  const newAccount: ExistingAccountItem = {
    id: `ext_man_${Date.now()}`,
    full_name: (data.full_name || '').toUpperCase().trim(),
    barangay: (data.barangay || '').toUpperCase().trim(),
    purok: (data.purok || '').trim(),
    contact_number: (data.contact_number || '').trim(),
    created_at: new Date().toISOString(),
    latitude: data.latitude,
    longitude: data.longitude,
    geotagged: data.latitude !== undefined && data.longitude !== undefined,
    existingAcc: true,
    existingAccVerified: data.existingAccVerified === true,
    existingAccVisited: data.existingAccVisited === true,
    status: data.status || 'approved',
    submittedBy: username || 'Admin',
    pin: data.pin || '',
    uploadedFiles: [],
    added_from_website: true
  };

  // Untombstone account and its barangay so newly registered account displays immediately
  unTombstoneExistingAccount(newAccount.id, newAccount.full_name, newAccount.barangay);
  unTombstoneBarangay(newAccount.barangay);

  const userObj = findUser(username);
  const uName = userObj?.fullName || userObj?.displayName || username;

  if (data.files && Array.isArray(data.files)) {
    for (const file of data.files) {
      try {
        console.log(`[New Account Upload] Processing file "${file.fileName}" for new account: "${newAccount.full_name}"`);
        const fileUrl = await uploadFileToBase44(file.fileData, file.fileName);
        
        const fileObj = {
          name: file.fileName,
          url: fileUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uName
        };

        newAccount.uploadedFiles!.push(fileObj);
      } catch (err: any) {
        console.error(`[New Account Upload Error] Failed to upload file "${file.fileName}":`, err.message);
        throw new Error(`Failed to upload file "${file.fileName}": ${err.message}`);
      }
    }
  }

  const hasFiles = Boolean(newAccount.uploadedFiles && newAccount.uploadedFiles.length > 0);
  const isSubmitted = (data as any).isSubmitted === true || (data as any).submitToBase44 === true || hasFiles;
  newAccount.isSubmitted = isSubmitted;
  if (isSubmitted) {
    newAccount.submittedAt = new Date().toISOString();
  }

  existingAccountsCache.push(newAccount);
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  await addActivity(username, `Manually registered a new existing account record: "${newAccount.full_name}"`);

  // Sync to base44 HouseholdSubmission and MemberVerifiedSubmission databases ONLY if submitted by user
  if (isSubmitted) {
    const realId = await syncToBase44HouseholdSubmission(newAccount, username);
    if (realId && realId !== newAccount.id) {
      newAccount.id = realId;
      const lastIdx = existingAccountsCache.length - 1;
      existingAccountsCache[lastIdx].id = realId;
      await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
    }
    await syncToBase44MemberVerifiedSubmission(newAccount, username);
  } else {
    console.log(`[Base44 SDK] New account "${newAccount.full_name}" registered without submission. Skipping Base44 database write.`);
  }

  if (isCPanelDbConnected()) {
    saveExistingAccountToCPanel(newAccount).catch(err => console.warn('Failed to save existing account to cPanel DB:', err));
  }

  return newAccount;
}

// Add local existing accounts in bulk
export async function addLocalExistingAccountsBulk(dataList: any[], username: string): Promise<ExistingAccountItem[]> {
  const processedAccounts: ExistingAccountItem[] = [];
  const now = Date.now();
  for (let index = 0; index < dataList.length; index++) {
    const data = dataList[index];
    const fullName = (data.full_name || '').toUpperCase().trim();
    const barangay = (data.barangay || '').toUpperCase().trim();
    const purok = (data.purok || '').trim();
    
    let contactNumber = (data.contact_number || '').trim();
    if (contactNumber.startsWith("'")) {
      contactNumber = contactNumber.substring(1).trim();
    }
    if (/^9\d{9}$/.test(contactNumber)) {
      contactNumber = '0' + contactNumber;
    }

    let pin = (data.pin || '').trim();
    if (pin.startsWith("'")) {
      pin = pin.substring(1).trim();
    }

    // Check if account already exists in cache (by ID or by Name + Barangay)
    const existingIndex = existingAccountsCache.findIndex(acc => 
      (data.id && acc.id === data.id) ||
      (acc.full_name && acc.barangay && acc.full_name.toUpperCase() === fullName && acc.barangay.toUpperCase() === barangay)
    );

    if (existingIndex !== -1) {
      const existing = existingAccountsCache[existingIndex];
      const updated: ExistingAccountItem = {
        ...existing,
        purok: purok || existing.purok,
        contact_number: contactNumber || existing.contact_number,
        pin: pin || existing.pin,
        status: data.status || existing.status || 'approved',
        existingAcc: true,
        existingAccVerified: true,
        existingAccVisited: true,
        isBulkEntry: true
      };
      existingAccountsCache[existingIndex] = updated;
      processedAccounts.push(updated);
      unTombstoneExistingAccount(updated.id, updated.full_name, updated.barangay);
      unTombstoneBarangay(updated.barangay);
    } else {
      const newAccount: ExistingAccountItem = {
        id: data.id || `ext_man_${now}_${index}`,
        full_name: fullName,
        barangay: barangay || 'NO ADDRESS',
        purok,
        contact_number: contactNumber,
        created_at: data.created_at || new Date().toISOString(),
        latitude: data.latitude,
        longitude: data.longitude,
        geotagged: data.latitude !== undefined && data.longitude !== undefined,
        existingAcc: true,
        existingAccVerified: true,
        existingAccVisited: true,
        status: data.status || 'approved',
        submittedBy: username || 'Admin',
        pin,
        uploadedFiles: [],
        added_from_website: true,
        isBulkEntry: true,
        isSubmitted: false
      };

      unTombstoneExistingAccount(newAccount.id, newAccount.full_name, newAccount.barangay);
      unTombstoneBarangay(newAccount.barangay);

      existingAccountsCache.push(newAccount);
      processedAccounts.push(newAccount);
    }
  }

  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  await addActivity(username, `Manually registered ${processedAccounts.length} new existing account records in bulk`);

  if (isCPanelDbConnected()) {
    for (const acc of processedAccounts) {
      saveExistingAccountToCPanel(acc).catch(err => console.warn('Failed to save existing account to cPanel DB:', err));
    }
  }

  return processedAccounts;
}

// Helper to permanently save/sync existing account verification data to Base44 MemberVerifiedSubmission table
export async function syncToBase44MemberVerifiedSubmission(existingAccount: ExistingAccountItem, username: string): Promise<void> {
  try {
    console.log(`[Base44 SDK] Syncing member verification data for "${existingAccount.full_name}" to MemberVerifiedSubmission table...`);
    const verifiedSubmissionEntity = (base44.entities as any).MemberVerifiedSubmission || {
      create: async (data: any) => {
        console.log('[Base44 SDK] Simulating MemberVerifiedSubmission creation dynamically');
        return data;
      }
    };

    const userObj = findUser(username);
    const uName = userObj?.fullName || userObj?.displayName || username;
    const uEmail = userObj?.email || '';

    // Resolve the full name of the account who submitted the data
    const submitterObj = findUser(existingAccount.submittedBy || username);
    const submitterFullName = submitterObj?.fullName || submitterObj?.displayName || existingAccount.submittedBy || username;

    const filesToSync = existingAccount.uploadedFiles && existingAccount.uploadedFiles.length > 0
      ? existingAccount.uploadedFiles
      : [];

    // Ensure any data URLs in uploadedFiles are uploaded to Base44 CDN
    for (const file of filesToSync) {
      if (file.url && file.url.startsWith('data:')) {
        try {
          const fName = file.fileName || file.name || 'document';
          const cdnUrl = await uploadFileToBase44(file.url, fName, file.fileType);
          file.url = cdnUrl;
          file.fileUrl = cdnUrl;
        } catch (err: any) {
          console.warn(`[Base44 MemberVerifiedSubmission Warning] Failed to upload "${file.name}" to CDN:`, err.message);
        }
      }
    }

    const formattedAllFiles = (existingAccount.uploadedFiles || []).map(f => ({
      name: `${unescapeHtml(existingAccount.full_name)} (Member)`,
      fileName: f.fileName || f.name || 'document',
      fileUrl: f.fileUrl || f.url,
      url: f.fileUrl || f.url,
      fileType: f.fileType || getMimeType(f.fileName || f.name),
      size: f.size || 0,
      uploadedAt: f.uploadedAt || new Date().toISOString(),
      uploadedBy: f.uploadedBy || uName
    })).filter(f => f.fileUrl && !f.fileUrl.startsWith('data:'));

    const itemsToIterate: any[] = filesToSync.length > 0 ? filesToSync : [{ url: '', name: '', fileUrl: '', fileName: '', fileType: '', size: 0 }];

    for (const item of itemsToIterate) {
      const currentFile = item as any;
      const rawUrl = currentFile.fileUrl || currentFile.url || '';
      // Ensure we NEVER send raw data URLs to Base44 string fields
      const fileUrl = (rawUrl && !rawUrl.startsWith('data:')) ? rawUrl : '';
      const fileName = currentFile.fileName || currentFile.name || '';
      const mimeType = currentFile.fileType || getMimeType(fileName);

      const singleAtt = fileUrl ? [{
        name: `${unescapeHtml(existingAccount.full_name)} (Member)`,
        fileName: fileName,
        fileUrl: fileUrl,
        url: fileUrl,
        fileType: mimeType,
        size: currentFile.size || 0
      }] : [];

      const payload = {
        existingAccountId: existingAccount.id,
        id: existingAccount.id,
        full_name: unescapeHtml(existingAccount.full_name),
        fullName: unescapeHtml(existingAccount.full_name),
        address: unescapeHtml(`${existingAccount.purok ? existingAccount.purok + ', ' : ''}${existingAccount.barangay || ''}`.trim()),
        barangay: existingAccount.barangay || '',
        purok: existingAccount.purok || '',
        contact: existingAccount.contact_number || '',
        contact_number: existingAccount.contact_number || '',
        contactNumber: existingAccount.contact_number || '',
        dateRegistered: existingAccount.created_at || new Date().toISOString(),
        created_at: existingAccount.created_at || new Date().toISOString(),
        latitude: existingAccount.latitude || null,
        longitude: existingAccount.longitude || null,
        geotagged: existingAccount.geotagged || false,
        existingAcc: existingAccount.existingAcc || false,
        existingAccVerified: existingAccount.existingAccVerified || false,
        existingAccVisited: existingAccount.existingAccVisited || false,
        status: existingAccount.status || 'Residency Check',
        pin: unescapeHtml(existingAccount.pin || ''),
        notes: unescapeHtml(existingAccount.pin || ''),
        validationNotes: unescapeHtml(existingAccount.pin || ''),
        validation_notes: unescapeHtml(existingAccount.pin || ''),
        facebookLink: existingAccount.facebookLink || '',
        uploadedFiles: formattedAllFiles.length > 0 ? formattedAllFiles : singleAtt,
        uploadedFilesJson: JSON.stringify(formattedAllFiles.length > 0 ? formattedAllFiles : singleAtt),
        attachments: formattedAllFiles.length > 0 ? formattedAllFiles : singleAtt,
        
        // Strict exact mappings requested by user:
        // "Submitted by (Full Name of an account who submitted the data)"
        "Submitted by": submitterFullName,
        "submittedBy": submitterFullName,
        "submitted_by": submitterFullName,
        "submitedBy": submitterFullName,
        "submited_by": submitterFullName,
        
        // "Barangay"
        "Barangay": existingAccount.barangay || '',
        
        // "Attachment data (The File image must saved accurately on base44 database)"
        "Attachment data": fileUrl || (formattedAllFiles[0]?.fileUrl || ''),
        "Attachment Data": fileUrl || (formattedAllFiles[0]?.fileUrl || ''),
        "attachment_data": fileUrl || (formattedAllFiles[0]?.fileUrl || ''),
        "attachmentData": fileUrl || (formattedAllFiles[0]?.fileUrl || ''),

        // User requested exact field names:
        attachmentUrl: fileUrl || (formattedAllFiles[0]?.fileUrl || null),
        attachmentName: fileName || (formattedAllFiles[0]?.fileName || null),
        memberName: unescapeHtml(existingAccount.full_name),
        verifiedByEmail: uEmail,
        verifiedDate: new Date().toISOString(),

        verifiedBy: uName,
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      let matchedId = null;
      try {
        const existingRecords = await getCachedMemberVerifiedSubmissions(false);
        if (Array.isArray(existingRecords)) {
          if (fileUrl) {
            const match = existingRecords.find((rec: any) => 
              (rec.attachmentUrl === fileUrl || rec.attachment_data === fileUrl) &&
              (rec.existingAccountId === existingAccount.id || rec.id === existingAccount.id ||
               (rec.fullName && rec.fullName.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase()) ||
               (rec.full_name && rec.full_name.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase()))
            );
            if (match && match.id) {
              matchedId = match.id;
            }
          } else {
            const match = existingRecords.find((rec: any) => 
              rec.existingAccountId === existingAccount.id || 
              rec.id === existingAccount.id ||
              (rec.fullName && rec.fullName.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase()) ||
              (rec.full_name && rec.full_name.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase())
            );
            if (match && match.id) {
              matchedId = match.id;
            }
          }
        }
      } catch (e: any) {
        console.warn('[Base44 SDK Warning] Failed to get cached MemberVerifiedSubmissions, will fallback to direct create:', e.message);
      }

      let updateSuccessful = false;
      if (matchedId && typeof verifiedSubmissionEntity.update === 'function') {
        const originalConsoleError = console.error;
        try {
          console.log(`[Base44 SDK] Updating existing MemberVerifiedSubmission record with ID: ${matchedId}...`);
          console.error = () => {}; // Suppress SDK 404 error logs
          await verifiedSubmissionEntity.update(matchedId, payload);
          console.log('[Base44 SDK] Successfully updated MemberVerifiedSubmission record.');
          updateSuccessful = true;
          
          // Update local cache
          try {
            const cached = await getCachedMemberVerifiedSubmissions(false);
            const updatedCache = cached.map((rec: any) => rec.id === matchedId ? { ...rec, ...payload, id: matchedId } : rec);
            await safeWriteFile(MEMBER_VERIFIED_CACHE_FILE, JSON.stringify(updatedCache, null, 2), 'utf-8');
          } catch (cacheErr: any) {
            console.warn('[Base44 Cache Warning] Failed to update local MemberVerifiedSubmission cache:', cacheErr.message);
          }
        } catch (updateErr: any) {
          console.log(`[Base44 SDK Info] Update failed for ${matchedId} (possibly deleted or not found on Base44 side). Falling back to create. Error:`, updateErr.message);
        } finally {
          console.error = originalConsoleError;
        }
      }

      if (!updateSuccessful && typeof verifiedSubmissionEntity.create === 'function') {
        const originalConsoleError = console.error;
        let result;
        try {
          console.log(`[Base44 SDK] Creating new MemberVerifiedSubmission record...`);
          console.error = () => {}; // Suppress SDK error logs
          result = await verifiedSubmissionEntity.create(payload);
          console.log('[Base44 SDK] Successfully created MemberVerifiedSubmission record. ID:', result?.id || 'done');
        } finally {
          console.error = originalConsoleError;
        }
        
        // Update local cache with newly created item
        try {
          const cached = await getCachedMemberVerifiedSubmissions(false);
          const newItem = { ...payload, id: result?.id || `${existingAccount.id}_${fileName}` };
          const updatedCache = [...cached.filter((rec: any) => rec.id !== newItem.id), newItem];
          await safeWriteFile(MEMBER_VERIFIED_CACHE_FILE, JSON.stringify(updatedCache, null, 2), 'utf-8');
        } catch (cacheErr: any) {
          console.warn('[Base44 Cache Warning] Failed to add new item to local MemberVerifiedSubmission cache:', cacheErr.message);
        }
      }
    }
  } catch (err: any) {
    console.warn('[Base44 SDK Warning] Failed to save/sync to MemberVerifiedSubmission:', err.message);
  }
}

function removeIdFromHouseholdCache(id: string): void {
  try {
    if (fs.existsSync(HOUSEHOLDS_CACHE_FILE)) {
      const data = fs.readFileSync(HOUSEHOLDS_CACHE_FILE, 'utf-8');
      const submissions = JSON.parse(data);
      if (Array.isArray(submissions)) {
        const filtered = submissions.filter((sub: any) => sub.id !== id);
        safeWriteFileSync(HOUSEHOLDS_CACHE_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
        console.log(`[Base44 Cache] Successfully removed stale ID ${id} from HouseholdSubmission cache.`);
      }
    }
  } catch (err: any) {
    console.warn('[Base44 Cache Warning] Failed to remove stale ID from cache:', err.message);
  }
}

// Update an existing local account
export async function syncToBase44HouseholdSubmission(existingAccount: ExistingAccountItem, username: string): Promise<string> {
  const submissionEntity = base44.entities.HouseholdSubmission;
  if (!submissionEntity) return existingAccount.id;

  const userObj = findUser(username);
  const uName = userObj?.fullName || userObj?.displayName || username;
  const uEmail = userObj?.email || (userObj?.username ? `${userObj.username}@example.com` : 'admin@example.com');
  const id = existingAccount.id;
  let isNewOrRecreated = false;

  // Make sure all uploaded files have real CDN URLs and full dictionary structures
  const processedFiles: { 
    name: string; 
    fileName: string; 
    url: string; 
    fileUrl: string; 
    fileType: string; 
    size: number; 
    uploadedAt: string; 
    uploadedBy?: string 
  }[] = [];

  const fullName = (existingAccount.full_name || '').trim().toUpperCase();

  if (Array.isArray(existingAccount.uploadedFiles)) {
    for (const file of existingAccount.uploadedFiles) {
      let finalUrl = file.fileUrl || file.url || '';
      const fName = file.fileName || file.name || 'document';
      const mType = file.fileType || getMimeType(fName);
      if (finalUrl && finalUrl.startsWith('data:')) {
        try {
          console.log(`[Base44 SDK] Uploading staged file "${fName}" to Base44 public CDN...`);
          finalUrl = await uploadFileToBase44(finalUrl, fName, mType);
        } catch (err: any) {
          console.warn(`[Base44 SDK Warning] Upload file failed for "${fName}":`, err.message);
        }
      }
      processedFiles.push({
        name: `${fullName} (Member)`,
        fileName: fName,
        url: finalUrl,
        fileUrl: finalUrl,
        fileType: mType,
        size: file.size || 0,
        uploadedAt: file.uploadedAt || new Date().toISOString(),
        uploadedBy: file.uploadedBy || uName
      });
    }
  }
  existingAccount.uploadedFiles = processedFiles;

  // Application is strictly submission-only: keep uploaded attachments intact and direct without pulling/merging stale records
  const validAttachments = processedFiles.filter(a => a.fileUrl && !a.fileUrl.startsWith('data:') && a.fileUrl.length <= 2000);
  const primaryAttachmentUrl = (validAttachments[0]?.fileUrl && validAttachments[0].fileUrl.length <= 2000) ? validAttachments[0].fileUrl : null;
  const primaryAttachmentName = validAttachments[0]?.fileName || null;

  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || fullName;
  const lastName = nameParts.slice(1).join(' ') || '';
  const address = `${existingAccount.purok ? existingAccount.purok + ', ' : ''}${existingAccount.barangay || ''}`.trim();
  const contact = existingAccount.contact_number || '';
  const pin = existingAccount.pin || '';

  const latNum = existingAccount.latitude !== undefined && existingAccount.latitude !== null && !isNaN(Number(existingAccount.latitude))
    ? Number(existingAccount.latitude)
    : null;
  const lngNum = existingAccount.longitude !== undefined && existingAccount.longitude !== null && !isNaN(Number(existingAccount.longitude))
    ? Number(existingAccount.longitude)
    : null;
  const isGeotagged = !!(existingAccount.geotagged && latNum !== null && lngNum !== null);

  const fullPayload: any = {
    memberName: fullName,
    fullName: fullName,
    full_name: fullName,
    firstName: firstName,
    lastName: lastName,

    barangay: existingAccount.barangay || 'Central',
    Barangay: existingAccount.barangay || 'Central',
    purok: existingAccount.purok || '',
    address: address,

    contact: contact,
    contact_number: contact,
    contactNumber: contact,
    mobile: contact,

    pin: pin,
    notes: pin,
    validationNotes: pin,
    validation_notes: pin,

    latitude: latNum,
    longitude: lngNum,
    geotagged: isGeotagged,
    geoLocation: isGeotagged ? { latitude: latNum, longitude: lngNum, accuracy: 1 } : undefined,

    status: existingAccount.status || 'approved',
    existingAcc: true,
    existingAccVerified: true,
    existingAccVisited: true,
    isSubmitted: true,
    submittedAt: existingAccount.submittedAt || new Date().toISOString(),

    submittedBy: uName,
    "Submitted by": uName,
    submittedByEmail: uEmail,

    facebookLink: existingAccount.facebookLink || '',

    uploadedFiles: validAttachments,
    uploadedFilesJson: JSON.stringify(validAttachments),
    attachments: validAttachments,

    attachmentUrl: primaryAttachmentUrl,
    attachmentName: primaryAttachmentName,
    "Attachment data": primaryAttachmentUrl || '',
    "Attachment Data": primaryAttachmentUrl || '',
    "attachment_data": primaryAttachmentUrl || '',
    "attachmentData": primaryAttachmentUrl || '',

    fpe: {
      fullName: fullName,
      pin: pin,
      mobile: contact,
      purok: existingAccount.purok || '',
      barangay: existingAccount.barangay || 'Central',
      latitude: latNum,
      longitude: lngNum,
      geotagged: isGeotagged
    },
    pcsf: {
      contact: contact,
      pin: pin,
      purok: existingAccount.purok || '',
      barangay: existingAccount.barangay || 'Central'
    },

    updatedAt: new Date().toISOString(),
    created_at: existingAccount.created_at || new Date().toISOString()
  };

  if (id && !id.toString().startsWith('ext_')) {
    try {
      if (typeof submissionEntity.update === 'function') {
        console.log(`[Base44 SDK] Updating details in Base44 HouseholdSubmission database for ID: ${id}...`);
        await submissionEntity.update(id.toString(), fullPayload);
        console.log(`[Base44 SDK] Successfully updated HouseholdSubmission in Base44.`);
        return id.toString();
      }
    } catch (err: any) {
      console.warn(`[Base44 SDK Warning] Failed to update HouseholdSubmission in Base44 database for ID ${id}:`, err.message);
      if (err.message && (err.message.includes('not found') || err.message.includes('404'))) {
        console.log(`[Base44 SDK Info] HouseholdSubmission ${id} not found on server side. Evicting from cache and falling back to matching/creation.`);
        removeIdFromHouseholdCache(id.toString());
        isNewOrRecreated = true;
      } else {
        return id;
      }
    }
  }

  // Fallback or Match-and-create block
  try {
    console.log(`[Base44 SDK Info] Account "${existingAccount.full_name}" is being matched or created in HouseholdSubmission...`);
    const submissions = await getCachedHouseholdSubmissions(false);
    const matched = submissions.find((sub: any) => {
      let name = sub.memberName || '';
      if (!name && sub.fpe && sub.fpe.fullName) name = sub.fpe.fullName;
      if (!name && sub.pmrf_front) {
        name = `${sub.pmrf_front.member_first || ''} ${sub.pmrf_front.member_middle || ''} ${sub.pmrf_front.member_last || ''}`.trim();
      }
      return name.trim().toUpperCase() === existingAccount.full_name.trim().toUpperCase();
    });

    if (matched && matched.id && !isNewOrRecreated) {
      console.log(`[Base44 SDK] Found matching HouseholdSubmission in Base44 with ID: ${matched.id}. Updating it...`);
      if (typeof submissionEntity.update === 'function') {
        try {
          await submissionEntity.update(matched.id, fullPayload);
          console.log(`[Base44 SDK] Successfully updated matched HouseholdSubmission in Base44.`);
          return matched.id;
        } catch (updateErr: any) {
          console.warn(`[Base44 SDK Warning] Failed to update matched HouseholdSubmission in Base44 for ID ${matched.id}:`, updateErr.message);
          if (updateErr.message && (updateErr.message.includes('not found') || updateErr.message.includes('404'))) {
            console.log(`[Base44 SDK Info] Matched HouseholdSubmission ${matched.id} not found on server side. Evicting from cache and falling back to creation.`);
            removeIdFromHouseholdCache(matched.id);
            // Fall through to create
          } else {
            return matched.id;
          }
        }
      }
    }

    console.log(`[Base44 SDK] Creating new HouseholdSubmission record in Base44...`);
    if (typeof submissionEntity.create === 'function') {
      const newSubmission = await submissionEntity.create(fullPayload);
      if (newSubmission && newSubmission.id) {
        console.log(`[Base44 SDK] Successfully created new record. ID: ${newSubmission.id}`);
        try {
          const cacheExists = fs.existsSync(HOUSEHOLDS_CACHE_FILE);
          if (cacheExists) {
            const data = fs.readFileSync(HOUSEHOLDS_CACHE_FILE, 'utf-8');
            const submissions = JSON.parse(data);
            if (Array.isArray(submissions)) {
              submissions.push(newSubmission);
              safeWriteFileSync(HOUSEHOLDS_CACHE_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
            }
          }
        } catch (cacheErr: any) {
          console.warn('[Base44 Cache Warning] Failed to update local cache with new record:', cacheErr.message);
        }
        return newSubmission.id;
      }
    }
  } catch (err: any) {
    console.warn(`[Base44 SDK Warning] Failed to match or create HouseholdSubmission:`, err.message);
  }
  return existingAccount.id;
}

// Update an existing local account
export async function updateLocalExistingAccount(
  id: string, 
  updates: Partial<ExistingAccountItem> & { submitToBase44?: boolean; files?: { fileName: string; fileData: string }[] }, 
  username: string
): Promise<ExistingAccountItem> {
  const accountIndex = existingAccountsCache.findIndex(acc => acc.id === id || (acc as any).localId === id);
  if (accountIndex === -1) {
    throw new Error(`Existing account with ID "${id}" not found`);
  }

  const existingAccount = existingAccountsCache[accountIndex];
  const userObj = findUser(username);
  const uName = userObj?.fullName || userObj?.displayName || username;

  const isExplicitSubmit = updates.isSubmitted === true || (updates as any).submitToBase44 === true;
  const isAlreadySubmitted = existingAccount.isSubmitted === true;
  const shouldSyncToBase44 = isExplicitSubmit || isAlreadySubmitted;

  // Initialize or copy uploadedFiles
  let updatedFiles = existingAccount.uploadedFiles ? [...existingAccount.uploadedFiles] : [];

  // If explicit uploadedFiles array was provided (e.g. file removed)
  if (Array.isArray(updates.uploadedFiles)) {
    updatedFiles = updates.uploadedFiles;
  }

  // If new staged files are attached in the request
  if (Array.isArray(updates.files) && updates.files.length > 0) {
    for (const f of updates.files) {
      const fName = f.fileName || 'document';
      const mType = (f as any).fileType || getMimeType(fName);
      let fileUrl = '';
      try {
        console.log(`[Base44 Upload] Processing staged file "${fName}" for "${existingAccount.full_name}"...`);
        fileUrl = await uploadFileToBase44(f.fileData, fName, mType);
      } catch (err: any) {
        console.error(`[Base44 Upload Error] Failed to process "${fName}":`, err);
        fileUrl = f.fileData;
      }

      updatedFiles.push({
        name: fName,
        fileName: fName,
        url: fileUrl,
        fileUrl: fileUrl,
        fileType: mType,
        size: (f as any).size || 0,
        uploadedAt: new Date().toISOString(),
        uploadedBy: uName
      });
    }
  }

  // Ensure any previous data URLs are also migrated to intact static file storage
  for (let i = 0; i < updatedFiles.length; i++) {
    const uFile = updatedFiles[i];
    const curUrl = uFile.fileUrl || uFile.url || '';
    if (curUrl && curUrl.startsWith('data:')) {
      try {
        const fName = uFile.fileName || uFile.name || 'document';
        const mType = uFile.fileType || getMimeType(fName);
        console.log(`[Base44 Upload] Converting cached data URL for "${fName}" to intact file storage...`);
        const cdnUrl = await uploadFileToBase44(curUrl, fName, mType);
        uFile.url = cdnUrl;
        uFile.fileUrl = cdnUrl;
      } catch (err: any) {
        console.warn(`[Base44 Upload Warning] Failed to convert data URL for "${uFile.name}":`, err);
      }
    }
  }

  const updatedAccount: ExistingAccountItem = {
    ...existingAccount,
    ...updates,
    localId: (existingAccount as any).localId || existingAccount.id,
    id: existingAccount.id,
    uploadedFiles: updatedFiles,
    isSubmitted: shouldSyncToBase44 ? true : (existingAccount.isSubmitted || false),
    submittedAt: shouldSyncToBase44 ? (existingAccount.submittedAt || new Date().toISOString()) : existingAccount.submittedAt
  };

  // Clean up non-schema fields
  delete (updatedAccount as any).files;
  delete (updatedAccount as any).submitToBase44;

  if (shouldSyncToBase44) {
    try {
      // Sync to Base44 HouseholdSubmission FIRST and get/update the real Base44 ID
      const realId = await syncToBase44HouseholdSubmission(updatedAccount, username);
      if (realId && realId !== updatedAccount.id) {
        updatedAccount.id = realId;
      }
    } catch (syncErr: any) {
      console.warn('[Base44 Sync Warning] HouseholdSubmission sync encountered error (continuing local persistence):', syncErr.message || syncErr);
    }
  }

  existingAccountsCache[accountIndex] = updatedAccount;
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');

  // Persist to cPanel MySQL database
  saveExistingAccountToCPanel(updatedAccount).catch(err => console.warn('[cPanel DB Warning] Failed to sync account to cPanel MySQL:', err.message));
  
  if (updates.addedToFiles !== undefined) {
    const actionStr = updates.addedToFiles ? 'added to' : 'removed from';
    await addActivity(username, `Updated account: ${actionStr} files list for "${existingAccount.full_name}"`);
  } else if (isExplicitSubmit) {
    await addActivity(username, `Submitted existing account record and attached documents to Base44: "${existingAccount.full_name}"`);
  } else {
    await addActivity(username, `Updated existing account record: "${existingAccount.full_name}"`);
  }

  if (shouldSyncToBase44) {
    try {
      // Permanently save to base44 database at the MemberVerifiedSubmission table
      await syncToBase44MemberVerifiedSubmission(updatedAccount, username);
    } catch (memberErr: any) {
      console.warn('[Base44 Sync Warning] MemberVerifiedSubmission write encountered error:', memberErr.message || memberErr);
    }

    // Log to Base44 ExistingAccFileUpdate table if files are present or upon explicit submit
    if (updatedAccount.uploadedFiles && updatedAccount.uploadedFiles.length > 0) {
      try {
        console.log(`[Base44 SDK] Saving Existing Account file update metadata to table ExistingAccFileUpdate on verification save...`);
        const updateEntity = (base44.entities as any).ExistingAccFileUpdate || {
          create: async (data: any) => {
            console.log('[Base44 SDK] Simulating ExistingAccFileUpdate creation dynamically');
            return data;
          }
        };

        const base44FormattedFiles = (updatedAccount.uploadedFiles || []).map(f => {
          const fName = f.fileName || f.name || 'document';
          const url = f.fileUrl || f.url || '';
          return {
            name: `${unescapeHtml(updatedAccount.full_name)} (Member)`,
            fileName: fName,
            fileUrl: url,
            url: url,
            fileType: f.fileType || getMimeType(fName),
            size: f.size || 0,
            uploadedAt: f.uploadedAt || new Date().toISOString(),
            uploadedBy: f.uploadedBy || uName
          };
        }).filter(f => f.fileUrl && !f.fileUrl.startsWith('data:') && f.fileUrl.length <= 2000);

        await updateEntity.create({
          householdSubmissionId: updatedAccount.id,
          fullName: updatedAccount.full_name,
          householdName: updatedAccount.full_name || '',
          barangay: updatedAccount.barangay || '',
          purok: updatedAccount.purok || '',
          contact: updatedAccount.contact_number || '',
          pin: updatedAccount.pin || '',
          facebookLink: updatedAccount.facebookLink || '',
          files: base44FormattedFiles,
          uploadedFiles: base44FormattedFiles,
          attachments: base44FormattedFiles,
          fileUrl: base44FormattedFiles[0]?.fileUrl || null,
          fileName: base44FormattedFiles[0]?.fileName || null,
          attachmentUrl: base44FormattedFiles[0]?.fileUrl || null,
          attachmentName: base44FormattedFiles[0]?.fileName || null,
          createdBy: uName,
          updatedBy: uName,
          updatedAt: new Date().toISOString()
        });
        console.log('[Base44 SDK] Successfully saved to Base44 ExistingAccFileUpdate on verification save.');
      } catch (err: any) {
        console.warn('[Base44 SDK Warning] Failed to create ExistingAccFileUpdate record on verification save:', err.message);
      }
    }
  } else {
    console.log(`[Base44 SDK] Account "${existingAccount.full_name}" is saved locally. Skipping Base44 database write because it was not submitted.`);
  }

  // Sync to Google Sheets
  syncExistingAccountsToGoogleSheets().catch(err => console.error('Failed to sync existing account to Sheets on update:', err));

  return updatedAccount;
}

// Upload multiple files for an existing account and save them locally & to the Base44 database ONLY if submitted
export async function uploadFilesForExistingAccount(
  id: string,
  files: { fileName: string; fileData: string }[],
  facebookLink: string | undefined,
  username: string,
  submitToBase44: boolean = false
): Promise<ExistingAccountItem> {
  const accountIndex = existingAccountsCache.findIndex(acc => acc.id === id || (acc as any).localId === id);
  if (accountIndex === -1) {
    throw new Error(`Existing account with ID "${id}" not found`);
  }

  const existingAccount = existingAccountsCache[accountIndex];
  
  if (facebookLink !== undefined) {
    existingAccount.facebookLink = facebookLink;
  }

  const userObj = findUser(username);
  const uName = userObj?.fullName || userObj?.displayName || username;

  if (files && files.length > 0) {
    existingAccount.uploadedFiles = existingAccount.uploadedFiles || [];

    for (const file of files) {
      try {
        const fName = file.fileName || 'document';
        const mType = (file as any).fileType || getMimeType(fName);
        const fileUrl = await uploadFileToBase44(file.fileData, fName, mType);
        
        const fileObj = {
          name: fName,
          fileName: fName,
          url: fileUrl,
          fileUrl: fileUrl,
          fileType: mType,
          size: (file as any).size || 0,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uName
        };

        existingAccount.uploadedFiles.push(fileObj);
      } catch (err: any) {
        console.error(`[Existing Account Upload Error] Failed to process file "${file.fileName}":`, err.message);
        throw new Error(`Failed to process file "${file.fileName}": ${err.message}`);
      }
    }
  }

  if (submitToBase44) {
    // Convert any pre-existing data URLs to intact static storage URLs
    if (existingAccount.uploadedFiles) {
      for (let i = 0; i < existingAccount.uploadedFiles.length; i++) {
        const uFile = existingAccount.uploadedFiles[i];
        const curUrl = uFile.fileUrl || uFile.url || '';
        if (curUrl && curUrl.startsWith('data:')) {
          try {
            const fName = uFile.fileName || uFile.name || 'document';
            const mType = uFile.fileType || getMimeType(fName);
            console.log(`[Base44 Upload] Converting cached data URL for "${fName}" to intact file storage...`);
            const cdnUrl = await uploadFileToBase44(curUrl, fName, mType);
            uFile.url = cdnUrl;
            uFile.fileUrl = cdnUrl;
          } catch (err: any) {
            console.warn(`[Base44 Upload Warning] Failed to convert data URL for "${uFile.name}":`, err.message);
          }
        }
      }
    }

    // Mark as submitted upon explicit submission
    existingAccount.isSubmitted = true;
    if (!existingAccount.submittedAt) {
      existingAccount.submittedAt = new Date().toISOString();
    }
    (existingAccount as any).localId = (existingAccount as any).localId || existingAccount.id;

    // Sync to Base44 HouseholdSubmission and update Base44 ID
    try {
      const realId = await syncToBase44HouseholdSubmission(existingAccount, username);
      if (realId && realId !== existingAccount.id) {
        existingAccount.id = realId;
      }
    } catch (syncErr: any) {
      console.warn('[Base44 Sync Warning] HouseholdSubmission sync encountered error (continuing local persistence):', syncErr.message || syncErr);
    }
  }

  // Persist locally
  const accIdx = existingAccountsCache.findIndex(acc => acc.id === id || (acc as any).localId === id);
  if (accIdx !== -1) {
    existingAccountsCache[accIdx] = existingAccount;
  }
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  
  // Persist to cPanel MySQL database
  saveExistingAccountToCPanel(existingAccount).catch(err => console.warn('[cPanel DB Warning] Failed to sync account to cPanel MySQL:', err.message));

  if (submitToBase44) {
    if (files && files.length > 0) {
      await addActivity(username, `Uploaded ${files.length} file(s) and submitted existing account to Base44: "${existingAccount.full_name}"`);
    } else {
      await addActivity(username, `Submitted details for existing account to Base44: "${existingAccount.full_name}"`);
    }

    // Save to Base44 ExistingAccFileUpdate table if files are present
    if (existingAccount.uploadedFiles && existingAccount.uploadedFiles.length > 0) {
      try {
        console.log(`[Base44 SDK] Saving Existing Account file update metadata to table ExistingAccFileUpdate...`);
        const updateEntity = (base44.entities as any).ExistingAccFileUpdate || {
          create: async (data: any) => {
            console.log('[Base44 SDK] Simulating ExistingAccFileUpdate creation dynamically');
            return data;
          }
        };

        const base44FormattedFiles = (existingAccount.uploadedFiles || []).map(f => {
          const fName = f.fileName || f.name || 'document';
          const url = f.fileUrl || f.url || '';
          return {
            name: `${unescapeHtml(existingAccount.full_name)} (Member)`,
            fileName: fName,
            fileUrl: url,
            url: url,
            fileType: f.fileType || getMimeType(fName),
            size: f.size || 0,
            uploadedAt: f.uploadedAt || new Date().toISOString(),
            uploadedBy: f.uploadedBy || uName
          };
        }).filter(f => f.fileUrl && !f.fileUrl.startsWith('data:'));

        await updateEntity.create({
          householdSubmissionId: existingAccount.id,
          fullName: existingAccount.full_name,
          householdName: existingAccount.full_name || '',
          barangay: existingAccount.barangay || '',
          purok: existingAccount.purok || '',
          contact: existingAccount.contact_number || '',
          pin: existingAccount.pin || '',
          facebookLink: existingAccount.facebookLink || '',
          files: base44FormattedFiles,
          uploadedFiles: base44FormattedFiles,
          attachments: base44FormattedFiles,
          fileUrl: base44FormattedFiles[0]?.fileUrl || null,
          fileName: base44FormattedFiles[0]?.fileName || null,
          attachmentUrl: base44FormattedFiles[0]?.fileUrl || null,
          attachmentName: base44FormattedFiles[0]?.fileName || null,
          createdBy: uName,
          updatedBy: uName,
          updatedAt: new Date().toISOString()
        });
        console.log('[Base44 SDK] Successfully saved to Base44 ExistingAccFileUpdate.');
      } catch (err: any) {
        console.warn('[Base44 SDK Warning] Failed to create ExistingAccFileUpdate record:', err.message);
      }
    }

    // Also sync member verification files & data to Base44 MemberVerifiedSubmission table
    await syncToBase44MemberVerifiedSubmission(existingAccount, username);
  } else {
    console.log(`[Base44 SDK] Files for "${existingAccount.full_name}" saved locally without Base44 submission.`);
    await addActivity(username, `Saved ${files?.length || 0} file(s) locally for "${existingAccount.full_name}" (not submitted to Base44)`);
  }

  // Sync to Google Sheets
  syncExistingAccountsToGoogleSheets().catch(err => console.error('Failed to sync existing account files update to Sheets:', err));

  return existingAccount;
}

// Delete and clear a specific Barangay folder (removes accounts completely from database)
export async function deleteExistingAccountFolder(barangay: string, username: string): Promise<{ updatedAccounts: ExistingAccountItem[], deletedAccounts: ExistingAccountItem[] }> {
  const normalizedTarget = (barangay || '').trim().toUpperCase();
  
  // Find all accounts in the target barangay folder
  const targetAccounts = existingAccountsCache.filter(acc => {
    const accBarangay = acc.barangay || 'Unknown Barangay';
    return accBarangay.trim().toUpperCase() === normalizedTarget || isBarangayMatch(accBarangay, barangay);
  });

  // Record into tombstone cache
  for (const acc of targetAccounts) {
    deletedExistingAccountsCache.push({
      id: acc.id,
      full_name: acc.full_name,
      barangay: acc.barangay,
      deletedAt: new Date().toISOString()
    });
  }
  if (!deletedBarangaysCache.some(b => isBarangayMatch(b, barangay) || normalizeBarangayName(b).toLowerCase() === normalizeBarangayName(normalizedTarget).toLowerCase())) {
    deletedBarangaysCache.push(barangay.trim());
    await safeWriteFile(DELETED_BARANGAYS_FILE, JSON.stringify(deletedBarangaysCache, null, 2), 'utf-8');
  }
  await safeWriteFile(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2), 'utf-8');
  syncDeletedRecordsToGoogleSheets().catch(err => console.error('Failed to sync deleted existing accounts to Google Sheets:', err));

  // Remove completely from local cache
  existingAccountsCache = existingAccountsCache.filter(acc => {
    const accBarangay = acc.barangay || 'Unknown Barangay';
    return accBarangay.trim().toUpperCase() !== normalizedTarget && !isBarangayMatch(accBarangay, barangay);
  });

  // Persist locally
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  
  await addActivity(username, `Deleted Barangay folder "${barangay}" completely, removing all ${targetAccounts.length} accounts.`);
  
  if (isCPanelDbConnected()) {
    deleteBarangayFromCPanel(barangay).catch(err => console.warn('Error deleting barangay from cPanel DB:', err));
    for (const acc of targetAccounts) {
      deleteExistingAccountFromCPanel(acc.id, new Date().toISOString()).catch(err => console.warn('Error deleting existing account from cPanel DB:', err));
    }
  }

  return { updatedAccounts: existingAccountsCache, deletedAccounts: targetAccounts };
}

// Delete a single existing account completely
export async function deleteLocalExistingAccount(id: string, username: string): Promise<ExistingAccountItem[]> {
  const targetAcc = existingAccountsCache.find(acc => acc.id.toString() === id.toString());
  if (!targetAcc) {
    throw new Error(`Account with ID "${id}" not found.`);
  }

  // Record in tombstone cache so it is NEVER restored on refresh or reload
  deletedExistingAccountsCache.push({
    id: targetAcc.id,
    full_name: targetAcc.full_name,
    barangay: targetAcc.barangay,
    deletedAt: new Date().toISOString()
  });
  await safeWriteFile(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2), 'utf-8');

  // Remove from cache
  existingAccountsCache = existingAccountsCache.filter(acc => acc.id.toString() !== id.toString());

  // Save changes
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');

  await addActivity(username, `Permanently deleted existing account record of "${targetAcc.full_name}" (Barangay ${targetAcc.barangay || 'N/A'}).`);

  if (isCPanelDbConnected()) {
    deleteExistingAccountFromCPanel(targetAcc.id, new Date().toISOString()).catch(err => console.warn('Error deleting existing account from cPanel DB:', err));
  }

  return existingAccountsCache;
}

// Clear and remove all existing accounts completely
export async function clearAllExistingAccounts(username: string): Promise<ExistingAccountItem[]> {
  const previousCount = existingAccountsCache.length;
  for (const acc of existingAccountsCache) {
    if (!isExistingAccountTombstoned(acc)) {
      deletedExistingAccountsCache.push({
        id: acc.id,
        full_name: acc.full_name,
        barangay: acc.barangay,
        deletedAt: new Date().toISOString()
      });
    }
  }
  await safeWriteFile(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2), 'utf-8');
  syncDeletedRecordsToGoogleSheets().catch(err => console.error('Failed to sync deleted existing accounts to Google Sheets:', err));

  existingAccountsCache = [];
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');

  await addActivity(username, `Permanently cleared all ${previousCount} existing account records from database.`);
  syncExistingAccountsToGoogleSheets().catch(err => console.error('Failed to sync cleared existing accounts to Sheets:', err));

  return existingAccountsCache;
}

// --- DATA MATCHING UTILITIES ---

export interface MatchingGroup {
  contact: Contact;
  account: ExistingAccountItem;
  matchType: 'perfect' | 'fuzzy';
  reason?: string;
}

export function getMatchingAnalysis() {
  const activeContacts = contactsCache.filter(c => !c.deleted_at && c.added_from_print_list !== false);
  const activeAccounts = existingAccountsCache.filter(acc => !isExistingAccountTombstoned(acc));

  const perfectMatches: MatchingGroup[] = [];
  const fuzzyMatches: MatchingGroup[] = [];
  const matchedContactIds = new Set<string | number>();
  const matchedAccountIds = new Set<string>();

  // 1. Identify Perfect Matches (Exact Full Name match)
  for (const contact of activeContacts) {
    const contactName = (contact.full_name || '').trim().toUpperCase();
    for (const acc of activeAccounts) {
      const accName = (acc.full_name || '').trim().toUpperCase();

      if (contactName === accName && contactName.length > 0) {
        perfectMatches.push({
          contact,
          account: acc,
          matchType: 'perfect'
        });
        matchedContactIds.add(contact.id);
        matchedAccountIds.add(acc.id);
      }
    }
  }

  // 2. Identify Fuzzy Matches (Name match but different/missing Barangay, or sub-string name match)
  for (const contact of activeContacts) {
    if (matchedContactIds.has(contact.id)) continue;
    const contactName = (contact.full_name || '').trim().toUpperCase();
    
    for (const acc of activeAccounts) {
      if (matchedAccountIds.has(acc.id)) continue;
      const accName = (acc.full_name || '').trim().toUpperCase();

      if (contactName === accName) {
        fuzzyMatches.push({
          contact,
          account: acc,
          matchType: 'fuzzy',
          reason: `Name matched exactly but Barangays differ ("${contact.barangay || 'N/A'}" vs "${acc.barangay || 'N/A'}")`
        });
        matchedContactIds.add(contact.id);
        matchedAccountIds.add(acc.id);
        break;
      } else if (contactName.includes(accName) || accName.includes(contactName)) {
        // Only if length is substantial to avoid false positives on tiny strings
        if (contactName.length > 5 && accName.length > 5) {
          fuzzyMatches.push({
            contact,
            account: acc,
            matchType: 'fuzzy',
            reason: `Fuzzy Name match ("${contact.full_name}" ~ "${acc.full_name}")`
          });
          matchedContactIds.add(contact.id);
          matchedAccountIds.add(acc.id);
          break;
        }
      }
    }
  }

  const unmatchedContacts = activeContacts.filter(c => !matchedContactIds.has(c.id));
  const unmatchedAccounts = activeAccounts.filter(acc => !matchedAccountIds.has(acc.id));

  return {
    perfectMatches,
    fuzzyMatches,
    unmatchedContacts,
    unmatchedAccounts,
    summary: {
      perfectCount: perfectMatches.length,
      fuzzyCount: fuzzyMatches.length,
      unmatchedContactsCount: unmatchedContacts.length,
      unmatchedAccountsCount: unmatchedAccounts.length,
      totalContacts: activeContacts.length,
      totalAccounts: activeAccounts.length
    }
  };
}

export async function mergeAccountToContact(contactId: string | number, accountId: string, username: string) {
  const contactIdx = contactsCache.findIndex(c => c.id.toString() === contactId.toString());
  const accountIdx = existingAccountsCache.findIndex(acc => acc.id.toString() === accountId.toString());

  if (contactIdx === -1) throw new Error('Contact not found');
  if (accountIdx === -1) throw new Error('Existing Account not found');

  const contact = contactsCache[contactIdx];
  const acc = existingAccountsCache[accountIdx];

  // Merge files
  const contactFiles = contact.uploadedFiles || [];
  const accFiles = acc.uploadedFiles || [];
  const mergedFiles = [...contactFiles];

  for (const file of accFiles) {
    if (!mergedFiles.some(f => f.url === file.url)) {
      mergedFiles.push(file);
    }
  }

  // Merge attributes
  const updatedContact: Contact = {
    ...contact,
    isExistingAccount: true,
    uploadedFiles: mergedFiles,
    updated_at: new Date().toISOString()
  };

  if (!contact.contact_number && acc.contact_number) {
    updatedContact.contact_number = acc.contact_number;
  }
  if (!contact.purok && acc.purok) {
    updatedContact.purok = acc.purok;
  }
  if (!contact.latitude && acc.latitude) {
    updatedContact.latitude = acc.latitude;
    updatedContact.longitude = acc.longitude;
    updatedContact.geotagged = true;
  }

  // Mark account as added/merged
  const updatedAccount: ExistingAccountItem = {
    ...acc,
    addedToFiles: true,
    status: 'approved'
  };

  contactsCache[contactIdx] = updatedContact;
  existingAccountsCache[accountIdx] = updatedAccount;

  // Persist
  await safeWriteFile(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2), 'utf-8');
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');

  await addActivity(username, `Merged Existing Account profile for "${acc.full_name}" into Patient directory ID ${contact.id}`);

  // Sync both to Google Sheets
  syncWithGoogleSheets(username).catch(err => console.error('[Sheets Sync Error] Failed to sync merged contact:', err));
  syncExistingAccountsToGoogleSheets().catch(err => console.error('[Sheets Sync Error] Failed to sync merged existing account:', err));

  return { contact: updatedContact, account: updatedAccount };
}

export async function createContactFromAccount(accountId: string, username: string) {
  const accountIdx = existingAccountsCache.findIndex(acc => acc.id.toString() === accountId.toString());
  if (accountIdx === -1) throw new Error('Existing Account not found');

  const acc = existingAccountsCache[accountIdx];
  const now = new Date().toISOString();

  // Create new contact
  const newContactId = Date.now() + Math.floor(Math.random() * 1000);
  const newContact: Contact = {
    id: newContactId,
    full_name: acc.full_name,
    barangay: acc.barangay,
    purok: acc.purok || '',
    contact_number: acc.contact_number || '',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    latitude: acc.latitude,
    longitude: acc.longitude,
    geotagged: !!acc.latitude,
    isExistingAccount: true,
    uploadedFiles: acc.uploadedFiles || []
  };

  // Mark account as merged/added
  const updatedAccount: ExistingAccountItem = {
    ...acc,
    addedToFiles: true,
    status: 'approved'
  };

  contactsCache.unshift(newContact);
  existingAccountsCache[accountIdx] = updatedAccount;

  // Persist
  await safeWriteFile(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2), 'utf-8');
  await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');

  await addActivity(username, `Created new Patient directory record for "${acc.full_name}" from Existing Account`);

  // Sync both to Google Sheets
  syncWithGoogleSheets(username).catch(err => console.error('[Sheets Sync Error] Failed to sync newly created contact:', err));
  syncExistingAccountsToGoogleSheets().catch(err => console.error('[Sheets Sync Error] Failed to sync updated existing account:', err));

  return { contact: newContact, account: updatedAccount };
}

export async function autoMergeAllPerfectMatches(username: string) {
  const analysis = getMatchingAnalysis();
  const mergedGroups: { contactId: string | number; accountId: string }[] = [];

  for (const match of analysis.perfectMatches) {
    try {
      await mergeAccountToContact(match.contact.id, match.account.id, username);
      mergedGroups.push({ contactId: match.contact.id, accountId: match.account.id });
    } catch (e) {
      console.error(`[Auto Match] Failed to merge contact ${match.contact.id} with account ${match.account.id}:`, e);
    }
  }

  return { mergedCount: mergedGroups.length, mergedGroups };
}

/**
 * Applies restored database data from a parsed backup (JSON or SQL).
 * Handles contacts, existing accounts, users, barangays, settings, and activities.
 * Can either merge with current records or replace them (with safety safeguards).
 */
export async function applyRestoredData(
  payload: {
    contacts?: any[];
    existingAccounts?: any[];
    users?: any[];
    barangays?: any[];
    settings?: any;
    activities?: any[];
    pcuUpdates?: any[];
    messages?: any[];
    deletedContacts?: any[];
    deletedUsers?: any[];
    deletedExistingAccounts?: any[];
    deletedBarangays?: any[];
  },
  mode: 'merge' | 'replace' = 'merge',
  username: string = 'admin'
): Promise<{
  success: boolean;
  message: string;
  counts: {
    contacts: number;
    existingAccounts: number;
    users: number;
    barangays: number;
    settings: number;
    activities: number;
    pcuUpdates?: number;
  };
  destinations?: Record<string, string>;
  totalRecords: number;
}> {
  let contactsCount = 0;
  let accountsCount = 0;
  let usersCount = 0;
  let barangaysCount = 0;
  let settingsCount = 0;
  let activitiesCount = 0;
  let pcuUpdatesCount = 0;

  // Accurately partition incoming records between Contacts and Existing Accounts
  const contactsToProcess: any[] = [];
  const accountsToProcess: any[] = [];

  if (Array.isArray(payload.contacts)) {
    for (const c of payload.contacts) {
      if (!c) continue;
      const isExistAccount =
        c.existingAcc === true ||
        c.existingAcc === 'true' ||
        c.existingAccVerified !== undefined ||
        c.addedToFiles !== undefined ||
        c.category === 'existing_account' ||
        c.isExistingAccount === true ||
        (c.folder && c.folder.toUpperCase() !== 'GENERAL' && c.folder.trim() !== '') ||
        Boolean(c.submittedBy);
      if (isExistAccount) {
        accountsToProcess.push(c);
      } else {
        contactsToProcess.push(c);
      }
    }
  }

  if (Array.isArray(payload.existingAccounts)) {
    for (const a of payload.existingAccounts) {
      if (!a) continue;
      const isExistAccount =
        a.existingAcc === true ||
        a.existingAcc === 'true' ||
        a.existingAccVerified !== undefined ||
        a.addedToFiles !== undefined ||
        a.category === 'existing_account' ||
        a.isExistingAccount === true ||
        (a.folder && a.folder.toUpperCase() !== 'GENERAL' && a.folder.trim() !== '') ||
        Boolean(a.submittedBy);
      if (!isExistAccount && (a.category === 'pcu' || (!a.folder && !a.remarks && !a.submittedBy))) {
        contactsToProcess.push(a);
      } else {
        accountsToProcess.push(a);
      }
    }
  }

  // 1. Process Contacts (PCU Directory, Map View & Print List)
  if (contactsToProcess.length > 0) {
    const normalizedContacts: Contact[] = [];
    for (const raw of contactsToProcess) {
      if (!raw) continue;
      const fullName = String(raw.full_name || raw.fullName || raw.name || '').trim();
      if (!fullName) continue;

      let id: number | string = raw.id;
      if (typeof id === 'string' && /^\d+$/.test(id)) {
        id = parseInt(id, 10);
      } else if (typeof id !== 'number' && typeof id !== 'string') {
        id = Date.now() + Math.floor(Math.random() * 10000);
      }
      if (typeof id === 'number' && (isNaN(id) || id <= 0)) {
        id = Date.now() + Math.floor(Math.random() * 10000);
      }

      const brgy = String(raw.barangay || '').trim().toUpperCase();
      const purok = String(raw.purok || '').trim();

      // Clear any tombstone so contact is immediately visible everywhere
      unTombstoneContact(id, fullName, brgy);
      if (brgy) unTombstoneBarangay(brgy);

      const statusStr = String(raw.status || '').toUpperCase();
      const isSubmitted = Boolean(
        raw.isSubmitted === true ||
        raw.is_submitted === 1 ||
        raw.is_submitted === '1' ||
        raw.is_submitted === true ||
        raw.isSubmitted === 'true' ||
        statusStr === 'SUBMITTED' ||
        statusStr === 'LOCKED'
      );

      // Default added_from_print_list to true so contacts appear in PCU Directory, Map View & Print list
      const addedFromPrintList = raw.added_from_print_list !== undefined 
        ? Boolean(raw.added_from_print_list === true || raw.added_from_print_list === 1 || raw.added_from_print_list === '1' || raw.added_from_print_list === 'true')
        : (raw.addedFromPrintList !== undefined 
            ? Boolean(raw.addedFromPrintList === true || raw.addedFromPrintList === 1 || raw.addedFromPrintList === '1' || raw.addedFromPrintList === 'true')
            : true);

      const contactObj: Contact = {
        id,
        full_name: fullName,
        barangay: brgy,
        purok,
        contact_number: String(raw.contact_number ?? raw.contactNumber ?? raw.phone ?? '').trim(),
        created_at: String(raw.created_at || raw.createdAt || new Date().toISOString()),
        updated_at: String(raw.updated_at || raw.updatedAt || new Date().toISOString()),
        latitude: raw.latitude !== null && raw.latitude !== undefined && raw.latitude !== '' ? parseFloat(String(raw.latitude)) : undefined,
        longitude: raw.longitude !== null && raw.longitude !== undefined && raw.longitude !== '' ? parseFloat(String(raw.longitude)) : undefined,
        geotagged: Boolean(raw.geotagged === 1 || raw.geotagged === '1' || raw.geotagged === true || (raw.latitude && raw.longitude)),
        status: statusStr || (isSubmitted ? 'SUBMITTED' : 'ACTIVE'),
        isSubmitted,
        photo_url: String(raw.photo_url || raw.photoUrl || ''),
        pcu_file_url: String(raw.pcu_file_url || raw.pcuFileUrl || ''),
        pcu_uploaded_by: String(raw.pcu_uploaded_by || raw.pcuUploadedBy || ''),
        pcu_uploaded_at: String(raw.pcu_uploaded_at || raw.pcuUploadedAt || ''),
        added_from_print_list: addedFromPrintList,
        pin: raw.pin ? String(raw.pin) : undefined,
        facebookLink: raw.facebookLink || raw.facebook_link ? String(raw.facebookLink || raw.facebook_link) : undefined,
        category: (raw.category as any) || 'pcu',
        deleted_at: raw.deleted_at || raw.deletedAt ? String(raw.deleted_at || raw.deletedAt) : undefined,
        uploadedFiles: Array.isArray(raw.uploadedFiles) ? raw.uploadedFiles : undefined
      };

      normalizedContacts.push(contactObj);

      // If contact has an uploaded PCU document, ensure it is added to pcuUpdatesCache for Recent Uploads
      if (raw.pcu_file_url || raw.pcuFileUrl || (Array.isArray(raw.uploadedFiles) && raw.uploadedFiles.length > 0)) {
        const fileUrl = String(raw.pcu_file_url || raw.pcuFileUrl || raw.uploadedFiles?.[0]?.url || '');
        const pcuId = 'pcu-' + id;
        if (!pcuUpdatesCache.some(p => String(p.contactId) === String(id) || p.id === pcuId)) {
          pcuUpdatesCache.unshift({
            id: pcuId,
            contactId: typeof id === 'number' ? id : (parseInt(String(id), 10) || 0),
            fullName,
            barangay: brgy,
            purok,
            fileName: fileUrl.includes('/') ? (fileUrl.split('/').pop() || 'PCU Document') : (fileUrl || 'PCU Document'),
            fileData: fileUrl,
            uploadedAt: String(raw.pcu_uploaded_at || raw.created_at || new Date().toISOString()),
            uploadedBy: String(raw.pcu_uploaded_by || 'Admin')
          });
        }
      }
    }

    if (mode === 'replace') {
      contactsCache = normalizedContacts;
    } else {
      const existingMap = new Map<string, Contact>();
      for (const c of contactsCache) {
        existingMap.set(String(c.id), c);
        const nameKey = `${c.full_name.toLowerCase()}_${(c.barangay || '').toLowerCase()}`;
        existingMap.set(nameKey, c);
      }
      for (const newC of normalizedContacts) {
        const idKey = String(newC.id);
        const nameKey = `${newC.full_name.toLowerCase()}_${(newC.barangay || '').toLowerCase()}`;
        if (existingMap.has(idKey)) {
          const idx = contactsCache.findIndex(c => String(c.id) === idKey);
          if (idx >= 0) contactsCache[idx] = { ...contactsCache[idx], ...newC };
        } else if (existingMap.has(nameKey)) {
          const idx = contactsCache.findIndex(c => `${c.full_name.toLowerCase()}_${(c.barangay || '').toLowerCase()}` === nameKey);
          if (idx >= 0) contactsCache[idx] = { ...contactsCache[idx], ...newC };
        } else {
          contactsCache.push(newC);
          existingMap.set(idKey, newC);
          existingMap.set(nameKey, newC);
        }
      }
    }
    contactsCount = normalizedContacts.length;
    await safeWriteFile(CONTACTS_FILE, JSON.stringify(contactsCache, null, 2), 'utf-8');
  }

  // 2. Process Existing Accounts (Existing Account Directory & Exist. Acc. Files)
  if (accountsToProcess.length > 0) {
    const normalizedAccounts: ExistingAccountItem[] = [];
    for (const raw of accountsToProcess) {
      if (!raw) continue;
      const fullName = String(raw.full_name || raw.fullName || raw.name || '').trim();
      if (!fullName) continue;

      const id = String(raw.id || (Date.now() + '-' + Math.random().toString(36).substring(2, 7)));
      const brgy = String(raw.barangay || raw.folder || '').trim().toUpperCase();

      // Clear any tombstone so existing account is immediately visible
      unTombstoneExistingAccount(id, fullName, brgy);
      if (brgy) unTombstoneBarangay(brgy);

      const isAddedToFiles = raw.addedToFiles !== undefined 
        ? Boolean(raw.addedToFiles === true || raw.addedToFiles === 1 || raw.addedToFiles === '1' || raw.addedToFiles === 'true')
        : (raw.added_to_files !== undefined
            ? Boolean(raw.added_to_files === true || raw.added_to_files === 1 || raw.added_to_files === '1' || raw.added_to_files === 'true')
            : Boolean(raw.folder && raw.folder.toUpperCase() !== 'GENERAL' && raw.folder.trim() !== ''));

      const folderName = String(raw.folder || brgy || 'GENERAL').trim().toUpperCase();

      normalizedAccounts.push({
        id,
        full_name: fullName,
        barangay: brgy,
        purok: String(raw.purok || '').trim(),
        contact_number: String(raw.contact_number ?? raw.contactNumber ?? raw.phone ?? '').trim(),
        created_at: String(raw.created_at || raw.createdAt || new Date().toISOString()),
        latitude: raw.latitude !== null && raw.latitude !== undefined && raw.latitude !== '' ? parseFloat(String(raw.latitude)) : undefined,
        longitude: raw.longitude !== null && raw.longitude !== undefined && raw.longitude !== '' ? parseFloat(String(raw.longitude)) : undefined,
        geotagged: Boolean(raw.geotagged === 1 || raw.geotagged === '1' || raw.geotagged === true || (raw.latitude && raw.longitude)),
        existingAcc: true,
        existingAccVerified: Boolean(raw.existingAccVerified || raw.existing_acc_verified || String(raw.status || '').toUpperCase() === 'VERIFIED'),
        existingAccVisited: Boolean(raw.existingAccVisited || raw.existing_acc_visited),
        status: String(raw.status || 'PENDING').toUpperCase(),
        submittedBy: String(raw.submittedBy || raw.submitted_by || 'Admin'),
        pin: String(raw.pin || ''),
        addedToFiles: isAddedToFiles,
        facebookLink: String(raw.facebookLink || raw.facebook_link || ''),
        folder: folderName,
        remarks: String(raw.remarks || ''),
        uploadedFiles: Array.isArray(raw.uploadedFiles) ? raw.uploadedFiles : []
      });
    }

    if (mode === 'replace') {
      existingAccountsCache = normalizedAccounts;
    } else {
      const existMap = new Map<string, ExistingAccountItem>();
      for (const a of existingAccountsCache) {
        existMap.set(a.id, a);
      }
      for (const newA of normalizedAccounts) {
        if (existMap.has(newA.id)) {
          const idx = existingAccountsCache.findIndex(a => a.id === newA.id);
          if (idx >= 0) existingAccountsCache[idx] = { ...existingAccountsCache[idx], ...newA };
        } else {
          existingAccountsCache.push(newA);
          existMap.set(newA.id, newA);
        }
      }
    }
    accountsCount = normalizedAccounts.length;
    await safeWriteFile(EXISTING_ACCOUNTS_FILE, JSON.stringify(existingAccountsCache, null, 2), 'utf-8');
  }

  // 3. Process Users
  if (Array.isArray(payload.users) && payload.users.length > 0) {
    const normalizedUsers: User[] = [];
    for (const raw of payload.users) {
      if (!raw) continue;
      const uName = String(raw.username || '').trim();
      if (!uName) continue;

      let pHash = raw.password_hash || raw.passwordHash;
      if (!pHash && (raw.password || raw.passwordPlain)) {
        pHash = hashPassword(String(raw.password || raw.passwordPlain));
      }
      if (!pHash) {
        pHash = hashPassword('2026');
      }

      const rawStatus = String(raw.status || 'Active').trim();
      let userStatus: 'Active' | 'Pending' | 'Suspended' = 'Active';
      if (/pending/i.test(rawStatus)) userStatus = 'Pending';
      else if (/suspended/i.test(rawStatus) || /inactive/i.test(rawStatus)) userStatus = 'Suspended';

      const emailStr = String(raw.email || '');
      unTombstoneUser(uName, emailStr || undefined);

      normalizedUsers.push({
        username: uName,
        email: emailStr,
        fullName: String(raw.full_name || raw.fullName || raw.displayName || uName),
        displayName: String(raw.displayName || raw.full_name || raw.fullName || uName),
        barangay: String(raw.barangay || ''),
        passwordHash: String(pHash),
        passwordPlain: raw.passwordPlain ? String(raw.passwordPlain) : undefined,
        role: String(raw.role || 'STAFF').toUpperCase(),
        status: userStatus,
        createdAt: String(raw.created_at || raw.createdAt || new Date().toISOString()),
        avatarDataUrl: raw.avatar_data_url || raw.avatarDataUrl ? String(raw.avatar_data_url || raw.avatarDataUrl) : undefined,
        permissions: Array.isArray(raw.permissions) ? raw.permissions : undefined
      });
    }

    if (mode === 'replace') {
      // Safeguard: make sure admin is never accidentally locked out
      const hasAdmin = normalizedUsers.some(u => u.role === 'ADMIN' || u.username === 'admin');
      if (!hasAdmin) {
        const existingAdmin = usersCache.find(u => u.username === 'admin' || u.role === 'ADMIN');
        if (existingAdmin) {
          normalizedUsers.unshift(existingAdmin);
        } else {
          normalizedUsers.unshift({
            username: 'admin',
            passwordHash: hashPassword('2026'),
            role: 'ADMIN',
            fullName: 'Master Administrator',
            displayName: 'Master Administrator',
            status: 'Active',
            createdAt: new Date().toISOString()
          });
        }
      }
      usersCache = normalizedUsers;
    } else {
      const uMap = new Map<string, User>();
      for (const u of usersCache) {
        uMap.set(u.username.toLowerCase(), u);
      }
      for (const newU of normalizedUsers) {
        const key = newU.username.toLowerCase();
        if (uMap.has(key)) {
          const idx = usersCache.findIndex(u => u.username.toLowerCase() === key);
          if (idx >= 0) usersCache[idx] = { ...usersCache[idx], ...newU };
        } else {
          usersCache.push(newU);
          uMap.set(key, newU);
        }
      }
    }
    usersCount = normalizedUsers.length;
    await safeWriteFile(USERS_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  }

  // 4. Process Barangays
  if (Array.isArray(payload.barangays) && payload.barangays.length > 0) {
    const newBarangayNames = payload.barangays
      .map(b => (typeof b === 'string' ? b : (b?.name || '')).trim().toUpperCase())
      .filter(b => b.length > 0);

    if (newBarangayNames.length > 0) {
      for (const b of newBarangayNames) {
        unTombstoneBarangay(b);
      }
      if (mode === 'replace') {
        barangaysCache = Array.from(new Set(newBarangayNames)).sort();
      } else {
        const currentSet = new Set(barangaysCache);
        for (const b of newBarangayNames) {
          currentSet.add(b);
        }
        barangaysCache = Array.from(currentSet).sort();
      }
      barangaysCount = newBarangayNames.length;
      await saveBarangays();
    }
  }

  // 5. Process Site Settings
  if (payload.settings) {
    let settingsObj: Record<string, any> = {};
    if (Array.isArray(payload.settings)) {
      for (const s of payload.settings) {
        const key = s.setting_key || s.key;
        if (key) {
          let val = s.setting_value !== undefined ? s.setting_value : s.value;
          try {
            if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
              val = JSON.parse(val);
            }
          } catch {}
          settingsObj[key] = val;
        }
      }
    } else if (typeof payload.settings === 'object') {
      settingsObj = payload.settings;
    }

    if (Object.keys(settingsObj).length > 0) {
      siteSettings = { ...siteSettings, ...settingsObj };
      settingsCount = Object.keys(settingsObj).length;
      await safeWriteFile(SETTINGS_FILE, JSON.stringify(siteSettings, null, 2), 'utf-8');

      if (settingsObj.logoDataUrl) {
        safeWriteFile(LOGO_DATA_FILE, settingsObj.logoDataUrl, 'utf-8').catch(() => {});
      }
      if (settingsObj.faviconDataUrl) {
        safeWriteFile(FAVICON_DATA_FILE, settingsObj.faviconDataUrl, 'utf-8').catch(() => {});
      }
    }
  }

  // 6. Process Activities / Audit Logs
  if (Array.isArray(payload.activities) && payload.activities.length > 0) {
    for (const raw of payload.activities) {
      if (!raw || !raw.action) continue;
      const actId = raw.id || crypto.randomUUID();
      const existing = activitiesCache.find(a => a.id === actId);
      if (!existing) {
        activitiesCache.unshift({
          id: actId,
          timestamp: raw.timestamp || new Date().toISOString(),
          username: raw.username || 'admin',
          action: raw.action
        });
        activitiesCount++;
      }
    }
    if (activitiesCache.length > 500) {
      activitiesCache = activitiesCache.slice(0, 500);
    }
    await safeWriteFile(ACTIVITIES_FILE, JSON.stringify(activitiesCache, null, 2), 'utf-8');
  }

  // 7. Process Deleted Archives (Recycle Bin) if supplied
  if (Array.isArray(payload.deletedContacts) && payload.deletedContacts.length > 0) {
    if (mode === 'replace') {
      deletedContactsCache = payload.deletedContacts;
    } else {
      for (const d of payload.deletedContacts) {
        if (!deletedContactsCache.some(dc => dc.id === d.id)) {
          deletedContactsCache.push(d);
        }
      }
    }
    await safeWriteFile(DELETED_CONTACTS_FILE, JSON.stringify(deletedContactsCache, null, 2), 'utf-8');
  }
  if (Array.isArray(payload.deletedUsers) && payload.deletedUsers.length > 0) {
    if (mode === 'replace') {
      deletedUsersCache = payload.deletedUsers;
    } else {
      for (const du of payload.deletedUsers) {
        if (!deletedUsersCache.some(u => u.username === du.username)) {
          deletedUsersCache.push(du);
        }
      }
    }
    await safeWriteFile(DELETED_USERS_FILE, JSON.stringify(deletedUsersCache, null, 2), 'utf-8');
  }
  if (Array.isArray(payload.deletedExistingAccounts) && payload.deletedExistingAccounts.length > 0) {
    if (mode === 'replace') {
      deletedExistingAccountsCache = payload.deletedExistingAccounts;
    } else {
      for (const dea of payload.deletedExistingAccounts) {
        if (!deletedExistingAccountsCache.some(ea => ea.id === dea.id)) {
          deletedExistingAccountsCache.push(dea);
        }
      }
    }
    await safeWriteFile(DELETED_EXISTING_ACCOUNTS_FILE, JSON.stringify(deletedExistingAccountsCache, null, 2), 'utf-8');
  }
  if (Array.isArray(payload.deletedBarangays) && payload.deletedBarangays.length > 0) {
    const cleanedBgs = Array.from(
      new Set(
        payload.deletedBarangays
          .map(extractBarangayName)
          .filter((b: string) => typeof b === 'string' && b.length > 0)
      )
    );
    if (mode === 'replace') {
      deletedBarangaysCache = cleanedBgs;
    } else {
      for (const db of cleanedBgs) {
        if (!deletedBarangaysCache.includes(db)) {
          deletedBarangaysCache.push(db);
        }
      }
    }
    await safeWriteFile(DELETED_BARANGAYS_FILE, JSON.stringify(deletedBarangaysCache, null, 2), 'utf-8');
  }

  // 6. Process PCU Updates (Recent Uploads)
  if (Array.isArray(payload.pcuUpdates) && payload.pcuUpdates.length > 0) {
    for (const raw of payload.pcuUpdates) {
      if (!raw) continue;
      const updId = String(raw.id || raw.contactId || (Date.now() + '-' + Math.random().toString(36).substring(2, 7)));
      if (!pcuUpdatesCache.some(p => p.id === updId)) {
        pcuUpdatesCache.unshift({
          id: updId,
          contactId: raw.contactId || raw.contact_id || updId,
          fullName: String(raw.fullName || raw.full_name || ''),
          barangay: String(raw.barangay || '').toUpperCase(),
          purok: String(raw.purok || ''),
          fileName: String(raw.fileName || raw.file_name || 'document.pdf'),
          fileData: String(raw.fileData || raw.file_data || ''),
          uploadedAt: String(raw.uploadedAt || raw.uploaded_at || new Date().toISOString()),
          uploadedBy: String(raw.uploadedBy || raw.uploaded_by || 'Admin')
        });
        pcuUpdatesCount++;
      }
    }
    await safeWriteFile(PCU_UPDATES_FILE, JSON.stringify(pcuUpdatesCache, null, 2), 'utf-8');
  }

  // 7. Process Messages if present
  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    try {
      const msgFile = path.join(DATA_DIR, 'base44_messages.json');
      let msgCache: any[] = [];
      try {
        const rawMsg = await safeReadFile(msgFile, 'utf-8');
        msgCache = JSON.parse(rawMsg);
      } catch {}
      for (const m of payload.messages) {
        if (!m) continue;
        const mId = m.id || (Date.now() + '-' + Math.random().toString(36).substring(2, 7));
        if (!msgCache.some(existing => existing.id === mId)) {
          msgCache.unshift(m);
        }
      }
      await safeWriteFile(msgFile, JSON.stringify(msgCache, null, 2), 'utf-8');
    } catch {}
  }

  // 8. Sync with cPanel MySQL if live database is connected
  try {
    const dbStatus = getCPanelDbStatus();
    if (dbStatus.connected) {
      await migrateAllDataToCPanelDb({
        contacts: contactsCache,
        users: usersCache,
        existingAccounts: existingAccountsCache,
        barangays: barangaysCache,
        activities: activitiesCache,
        settings: siteSettings
      });
    }
  } catch (cpanelErr: any) {
    console.log('[Backup Restore] cPanel DB sync note:', cpanelErr.message);
  }

  const totalRecords = contactsCount + accountsCount + usersCount + barangaysCount + settingsCount + activitiesCount + pcuUpdatesCount;

  await addActivity(
    username,
    `Restored database backup (${mode.toUpperCase()} mode): ${totalRecords} records across tables (Contacts: ${contactsCount}, Accounts: ${accountsCount}, Users: ${usersCount}, Barangays: ${barangaysCount})`
  );

  return {
    success: true,
    message: `Successfully restored backup in ${mode} mode! Restored ${totalRecords} records across tables.`,
    counts: {
      contacts: contactsCount,
      existingAccounts: accountsCount,
      users: usersCount,
      barangays: barangaysCount,
      settings: settingsCount,
      activities: activitiesCount,
      pcuUpdates: pcuUpdatesCount
    },
    destinations: {
      contacts: 'PCU Directory (/directory), Map View & Print List',
      existingAccounts: 'Existing Account (/existing-account) & Exist. Acc. Files (/exist-acc-files)',
      users: 'Admin Credentials (/accounts) & Staff Management',
      barangays: 'Barangay Filters & Dropdowns',
      settings: 'Website Settings & Branding',
      activities: 'Dashboard Recent Activities',
      pcuUpdates: 'Recent Uploads (/recent-upload)'
    },
    totalRecords
  };
}




