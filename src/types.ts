export interface Contact {
  id: number | string;
  full_name: string;
  barangay: string;
  purok: string;
  contact_number: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  latitude?: number;
  longitude?: number;
  geotagged?: boolean;
  photo_url?: string;
  pcu_file_url?: string;
  pcu_uploaded_by?: string;
  pcu_uploaded_at?: string;
  isSubmitted?: boolean;
  status?: string;
  locked?: boolean;
  submittedToBase44?: boolean;
  submittedAt?: string;
  added_from_print_list?: boolean;
  isExistingAccount?: boolean;
  category?: 'pcu' | 'existing_account';
  pin?: string;
  facebookLink?: string;
  uploadedFiles?: { name: string; url: string; uploadedAt: string; uploadedBy?: string }[];
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
  fileData: string; // Base64 content
  uploadedAt: string;
  uploadedBy?: string;
}

export interface Activity {
  id: string;
  timestamp: string;
  username: string;
  action: string;
}

export interface User {
  username: string;
  role: 'Administrator';
}

export interface CPanelDbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
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
  tables?: Array<{ name: string; rowCount: number }>;
}

export interface SheetsStatus {
  connected: boolean;
  autoConnected?: boolean;
  lastAttempt: string | null;
  lastSuccess: string | null;
  error: string | null;
  config: {
    authType: 'apiKey' | 'serviceAccount';
    spreadsheetId: string | null;
    sheetName: string;
    clientEmail?: string;
  };
}

export interface Base44SyncStatus {
  lastAttempt: string | null;
  lastSuccess: string | null;
  count: number;
  error: string | null;
}

export interface DashboardStats {
  totalContacts: number;
  totalAddresses: number;
  contactsToday: number;
  recentActivities: Activity[];
  cpanelDbStatus?: CPanelDbStatus;
  sheetsStatus?: SheetsStatus;
  base44SyncStatus?: Base44SyncStatus;
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
  folder?: string;
  remarks?: string;
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
  isSubmitted?: boolean;
  submittedAt?: string;
  isBulkEntry?: boolean;
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

export interface BulkPreviewResponse {
  results: ParseResult[];
  summary: {
    total: number;
    valid: number;
    duplicate: number;
    invalid: number;
  };
  detectedSeparator: string;
}
