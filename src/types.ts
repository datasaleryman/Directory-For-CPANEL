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

export interface SubmittedExistAccRecord {
  id: string;
  existAccountId: string;
  submitterId?: string;
  fullName: string;
  barangay: string;
  purok: string;
  contactNumber: string;
  pin: string;
  latitude?: number | null;
  longitude?: number | null;
  geotagged: boolean;
  facebookLink?: string;
  uploadedFiles: {
    name: string;
    fileName?: string;
    url: string;
    fileUrl?: string;
    fileType?: string;
    size?: number;
    uploadedAt?: string;
    uploadedBy?: string;
  }[];
  filesCount: number;
  uploadedBy: string;
  uploadedAt: string;
  status: string; // 'FILES' | 'VERIFIED' | 'PENDING' | 'UPDATED'
  verified_at?: string | null;
  verified_by?: string | null;
  pending_at?: string | null;
  pending_by?: string | null;
  updated_status_at?: string | null;
  updated_status_by?: string | null;
  verified_credit_added?: boolean;
  pending_credit_added?: boolean;
  remarks?: string;
  isSubmitted?: boolean;
}

export interface ReturnedPcuRecord {
  id: string;
  contactId?: string;
  fullName: string;
  barangay: string;
  purok: string;
  contactNumber?: string;
  fileName?: string;
  fileUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
  submitter_id?: string;
  status: string; // 'RETURNED'
  returned_at?: string | null;
  returned_by?: string | null;
  returned_by_id?: string | null;
  return_reason?: string | null;
  filesCount: number;
  uploadedFiles: {
    name: string;
    url: string;
    uploadedAt?: string;
    uploadedBy?: string;
    size?: number;
  }[];
}

export interface SubmittedExistAccHistoryItem {
  id: string;
  action: string;
  recordId: string;
  patientName: string;
  barangay: string;
  submitter: string;
  performedBy: string;
  previousStatus: string;
  newStatus: string;
  timestamp: string;
  details?: string;
}

export interface SubmittedExistAccSettlement {
  id: string;
  submitter: string;
  totalSubmissions: number;
  baseRate: number;
  totalSalary: number;
  amountPaid: number;
  paymentStatus: string;
  paymentMethod: string;
  referenceNotes?: string;
  settledBy: string;
  settledAt: string;
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  primaryText: string;
  fullName: string;
  barangay?: string;
  purok?: string;
  contactNumber?: string;
  maintenanceMedicine?: string;
  disease?: string;
  isConsulted?: boolean;
  consultedAt?: string;
  consultedBy?: string;
  columns: string[];
  columnHeaders?: string[];
  rawData?: Record<string, string>;
  rawText: string;
  pdfFileName: string;
  pdfPageNumber: number;
  pdfFileUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  createdAt: string;
}


