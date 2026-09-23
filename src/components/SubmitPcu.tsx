import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  ArrowLeft, 
  Plus, 
  Loader2, 
  Building2, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw, 
  FolderCheck, 
  X, 
  Search, 
  Eye, 
  ExternalLink, 
  ZoomIn, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  Database,
  Folder,
  FolderOpen,
  FolderTree,
  BookOpen,
  ScrollText,
  FileSpreadsheet,
  Users,
  Lock,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StagedFile {
  fileName: string;
  fileData: string;
  size: number;
  fileType: string;
  previewUrl?: string;
}

interface UploadedFileItem {
  name: string;
  url: string;
  uploadedAt?: string;
  uploadedBy?: string;
  size?: number;
}

interface UploadedPcuRecord {
  id: string;
  fullName: string;
  barangay: string;
  purok: string;
  contactNumber?: string;
  fileName?: string;
  fileUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
  status?: string;
  filesCount: number;
  uploadedFiles: UploadedFileItem[];
}

interface DeleteTarget {
  record: UploadedPcuRecord;
  file?: UploadedFileItem;
  fileIndex?: number;
  isSingleFile: boolean;
}

interface SubmitPcuProps {
  authToken: string;
  currentUser?: {
    username: string;
    role: string;
    barangay?: string;
  } | null;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  onNavigateToDirectory?: () => void;
}

export const SubmitPcu: React.FC<SubmitPcuProps> = ({
  authToken,
  currentUser,
  showToast
}) => {
  // Mode state: false = Grid display of uploaded data; true = Upload PCU Form
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [barangay, setBarangay] = useState(currentUser?.barangay || '');
  const [purok, setPurok] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  // Database Barangays list from server
  const [barangaysList, setBarangaysList] = useState<string[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Uploaded records list
  const [uploadedRecords, setUploadedRecords] = useState<UploadedPcuRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Search & Filter state for Grid
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarangay, setFilterBarangay] = useState('ALL');

  // Detail Modal state (Whole data uploaded view)
  const [selectedRecord, setSelectedRecord] = useState<UploadedPcuRecord | null>(null);

  // Full-screen Image Lightbox state
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);

  // Permanent Delete Confirmation Popup Card state (centered on screen)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if current user is Master Admin (only Master Admin can delete PCU files and view Ledger)
  const isMasterAdmin = React.useMemo(() => {
    if (!currentUser) return false;
    const username = (currentUser.username || '').toLowerCase().trim();
    const role = (currentUser.role || '').toUpperCase().trim();
    return role === 'MASTER ADMIN' || role === 'MASTER_ADMIN' || role === 'MASTERADMIN' || username === 'admin';
  }, [currentUser]);

  // Tab state: 'folders' (Barangay Folders) | 'ledger' (Master Admin Ledger)
  const [activeTab, setActiveTab] = useState<'folders' | 'ledger'>('folders');

  // Currently opened Barangay folder: null = showing all folder cards; string = inside that folder
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Folder sub-view mode: 'folders' (browse by folder) | 'all' (flattened grid of all records)
  const [folderViewMode, setFolderViewMode] = useState<'folders' | 'all'>('folders');

  // Folder search filter
  const [folderSearch, setFolderSearch] = useState('');

  // Ledger state & filters (Master Admin Only)
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSubmitterFilter, setLedgerSubmitterFilter] = useState('ALL');
  const [ledgerBarangayFilter, setLedgerBarangayFilter] = useState('ALL');

  // Security guard: If a non-master admin somehow has activeTab === 'ledger', force back to 'folders'
  useEffect(() => {
    if (!isMasterAdmin && activeTab === 'ledger') {
      setActiveTab('folders');
    }
  }, [isMasterAdmin, activeTab]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch verified Barangays from database
  const fetchBarangays = async () => {
    setLoadingBarangays(true);
    try {
      const res = await fetch('/api/public/barangays', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (!res.ok) throw new Error('Failed to load database barangays');
      const data = await res.json();
      if (Array.isArray(data.barangays) && data.barangays.length > 0) {
        setBarangaysList(data.barangays);
        if (!barangay && !currentUser?.barangay) {
          setBarangay(data.barangays[0]);
        }
      }
    } catch (err: any) {
      console.warn('Error fetching barangays:', err.message);
    } finally {
      setLoadingBarangays(false);
    }
  };

  // Fetch Uploaded PCU records from server
  const fetchUploadedRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await fetch('/api/contacts/recent-uploads?limit=100', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        const contactsList = Array.isArray(data.contacts) ? data.contacts : [];
        
        const formatted: UploadedPcuRecord[] = contactsList.map((item: any, idx: number) => {
          let files: UploadedFileItem[] = [];
          if (Array.isArray(item.uploadedFiles) && item.uploadedFiles.length > 0) {
            files = item.uploadedFiles.map((f: any) => ({
              name: f.name || f.fileName || 'PCU Attachment',
              url: f.url || f.fileData || '',
              uploadedAt: f.uploadedAt || item.pcu_uploaded_at || item.created_at || new Date().toISOString(),
              uploadedBy: f.uploadedBy || item.pcu_uploaded_by || 'Staff'
            }));
          } else if (item.pcu_file_url) {
            files = [{
              name: 'PCU Document',
              url: item.pcu_file_url,
              uploadedAt: item.pcu_uploaded_at || item.created_at || new Date().toISOString(),
              uploadedBy: item.pcu_uploaded_by || 'Staff'
            }];
          }

          const uniqueId = String(item.id || item.contactId || `pcu_rec_${idx}_${Date.now()}`);

          return {
            id: uniqueId,
            fullName: item.full_name || item.fullName || 'Patient',
            barangay: item.barangay || 'Central',
            purok: item.purok || '',
            contactNumber: item.contact_number || item.contact || '',
            fileName: files[0]?.name || 'PCU Document',
            fileUrl: files[0]?.url || item.pcu_file_url || '',
            uploadedAt: item.pcu_uploaded_at || item.updated_at || item.created_at || new Date().toISOString(),
            uploadedBy: item.pcu_uploaded_by || 'Staff',
            status: item.status || 'SUBMITTED',
            filesCount: files.length,
            uploadedFiles: files
          };
        });

        setUploadedRecords(formatted);
      } else {
        const fallbackRes = await fetch('/api/contacts/pcu-updates', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const rawList = Array.isArray(fallbackData) ? fallbackData : (fallbackData.updates || []);
          const formatted: UploadedPcuRecord[] = rawList.map((item: any, idx: number) => {
            const fileItem: UploadedFileItem = {
              name: item.fileName || 'PCU Document',
              url: item.fileData || '',
              uploadedAt: item.uploadedAt || new Date().toISOString(),
              uploadedBy: item.uploadedBy || 'Staff'
            };
            return {
              id: String(item.id || item.contactId || `pcu_upd_${idx}_${Date.now()}`),
              fullName: item.fullName || 'Patient',
              barangay: item.barangay || 'Central',
              purok: item.purok || '',
              contactNumber: item.contact || item.contact_number || '',
              fileName: item.fileName || 'PCU Document',
              fileUrl: item.fileData || '',
              uploadedAt: item.uploadedAt || new Date().toISOString(),
              uploadedBy: item.uploadedBy || 'Staff',
              status: 'SUBMITTED',
              filesCount: 1,
              uploadedFiles: [fileItem]
            };
          });
          setUploadedRecords(formatted);
        }
      }
    } catch (err: any) {
      console.warn('Error fetching uploaded records:', err.message);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchBarangays();
    fetchUploadedRecords();
  }, [authToken]);

  // Multiple File Selection Handler
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files) as File[];
    if (filesArray.length === 0) return;

    const validFiles: File[] = [];
    for (const f of filesArray) {
      if (f.size > 25 * 1024 * 1024) {
        showToast(`File "${f.name}" exceeds 25MB limit.`, 'error');
        continue;
      }
      validFiles.push(f);
    }

    try {
      const loaded = await Promise.all(
        validFiles.map(file => {
          return new Promise<StagedFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                resolve({
                  fileName: file.name,
                  fileData: reader.result,
                  size: file.size,
                  fileType: file.type || 'application/octet-stream',
                  previewUrl: file.type.startsWith('image/') ? reader.result : undefined
                });
              } else {
                reject(new Error(`Failed to read file "${file.name}"`));
              }
            };
            reader.onerror = () => reject(reader.error || new Error(`Error reading file "${file.name}"`));
            reader.readAsDataURL(file);
          });
        })
      );

      setStagedFiles(prev => [...prev, ...loaded]);
      showToast(`${loaded.length} image(s) selected and ready for PCU upload.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error loading files', 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCapitalize = (str: string) => {
    return str
      .trim()
      .toLowerCase()
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = fullName.trim();
    const cleanBarangay = barangay.trim();
    const cleanPurok = purok.trim();
    const cleanNumber = contactNumber.trim();

    if (!cleanName) {
      showToast('Full Name is required.', 'warning');
      return;
    }
    if (!cleanBarangay) {
      showToast('Barangay selection is required.', 'warning');
      return;
    }
    if (stagedFiles.length === 0) {
      showToast('Please upload at least one PCU image or document.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const formattedName = handleCapitalize(cleanName);
      const formattedPurok = cleanPurok ? handleCapitalize(cleanPurok) : '';

      const payload = {
        fullName: formattedName,
        barangay: cleanBarangay,
        purok: formattedPurok,
        contact_number: cleanNumber,
        files: stagedFiles.map(f => ({
          fileName: f.fileName,
          fileData: f.fileData,
          fileType: f.fileType,
          size: f.size
        }))
      };

      const res = await fetch('/api/pcu/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit PCU documentation.');
      }

      showToast(`PCU documentation for "${formattedName}" submitted successfully!`, 'success');
      setSubmitSuccess(`PCU record and ${stagedFiles.length} file(s) for "${formattedName}" have been submitted and saved in cPanel MySQL.`);
      
      // Reset form fields
      setFullName('');
      setPurok('');
      setContactNumber('');
      setStagedFiles([]);

      // Return to Grid view to see uploaded record
      setIsFormOpen(false);

      // Refresh uploaded records list
      fetchUploadedRecords();
    } catch (err: any) {
      showToast(err.message || 'Error submitting PCU documentation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Prompt Deletion of an Entire PCU Record (Master Admin only)
  const promptDeleteRecord = (e: React.MouseEvent, record: UploadedPcuRecord) => {
    e.stopPropagation();
    if (!isMasterAdmin) {
      showToast('Access Denied: Only Master Admin can delete PCU submissions.', 'error');
      return;
    }
    setDeleteTarget({
      record,
      isSingleFile: false
    });
  };

  // Prompt Deletion of a Specific Single File (Master Admin only)
  const promptDeleteFile = (e: React.MouseEvent, record: UploadedPcuRecord, file: UploadedFileItem, fileIndex: number) => {
    e.stopPropagation();
    if (!isMasterAdmin) {
      showToast('Access Denied: Only Master Admin can delete PCU files.', 'error');
      return;
    }
    setDeleteTarget({
      record,
      file,
      fileIndex,
      isSingleFile: true
    });
  };

  // Execute Permanent Delete (Sends request to MySQL backend - Master Admin only)
  const executePermanentDelete = async () => {
    if (!deleteTarget) return;
    if (!isMasterAdmin) {
      showToast('Access Denied: Only Master Admin can delete PCU records.', 'error');
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      const { record, file, fileIndex, isSingleFile } = deleteTarget;

      const payload = {
        id: record.id,
        fullName: record.fullName,
        fileName: isSingleFile && file ? file.name : undefined,
        fileUrl: isSingleFile && file ? file.url : undefined,
        deleteAll: !isSingleFile || (record.uploadedFiles.length <= 1)
      };

      const res = await fetch('/api/pcu/submissions/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to permanently delete from MySQL database.');
      }

      showToast(data.message || 'Permanently deleted from cPanel MySQL.', 'success');

      // Update detail modal state if currently open
      if (isSingleFile && record.uploadedFiles.length > 1 && fileIndex !== undefined) {
        if (selectedRecord && selectedRecord.id === record.id) {
          const updatedFiles = selectedRecord.uploadedFiles.filter((_, idx) => idx !== fileIndex);
          setSelectedRecord({
            ...selectedRecord,
            uploadedFiles: updatedFiles,
            filesCount: updatedFiles.length,
            fileUrl: updatedFiles[0]?.url || '',
            fileName: updatedFiles[0]?.name || ''
          });
        }
      } else {
        // Entire record deleted
        if (selectedRecord && selectedRecord.id === record.id) {
          setSelectedRecord(null);
        }
      }

      setDeleteTarget(null);
      fetchUploadedRecords();
    } catch (err: any) {
      showToast(err.message || 'Error deleting record from MySQL.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const isImageFile = (url?: string, name?: string) => {
    if (!url && !name) return false;
    const str = ((url || '') + ' ' + (name || '')).toLowerCase();
    return str.includes('.jpg') || str.includes('.jpeg') || str.includes('.png') || str.includes('.webp') || str.includes('data:image/');
  };

  // =========================================================================
  // BARANGAY FOLDERS COMPUTATION
  // =========================================================================
  const barangayFolders = React.useMemo(() => {
    const map = new Map<string, {
      name: string;
      records: UploadedPcuRecord[];
      totalSubmissions: number;
      totalFiles: number;
      latestUploadedAt: string | null;
      submitters: Set<string>;
    }>();

    // 1. Seed from database verified barangays
    barangaysList.forEach((bg) => {
      const trimmed = bg.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: trimmed,
          records: [],
          totalSubmissions: 0,
          totalFiles: 0,
          latestUploadedAt: null,
          submitters: new Set<string>()
        });
      }
    });

    // 2. Distribute all uploaded PCU files into their respective Barangay folders
    uploadedRecords.forEach((rec) => {
      const bgName = (rec.barangay || 'General / Unassigned').trim();
      const key = bgName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: bgName,
          records: [],
          totalSubmissions: 0,
          totalFiles: 0,
          latestUploadedAt: null,
          submitters: new Set<string>()
        });
      }

      const folder = map.get(key)!;
      folder.records.push(rec);
      folder.totalSubmissions += 1;
      const count = rec.filesCount || (rec.uploadedFiles ? rec.uploadedFiles.length : 1);
      folder.totalFiles += count;
      if (rec.uploadedBy) folder.submitters.add(rec.uploadedBy);
      if (!folder.latestUploadedAt || new Date(rec.uploadedAt).getTime() > new Date(folder.latestUploadedAt).getTime()) {
        folder.latestUploadedAt = rec.uploadedAt;
      }
    });

    // Sort: folders with submissions first, then alphabetically
    return Array.from(map.values()).sort((a, b) => {
      if (b.totalSubmissions !== a.totalSubmissions) {
        return b.totalSubmissions - a.totalSubmissions;
      }
      return a.name.localeCompare(b.name);
    });
  }, [barangaysList, uploadedRecords]);

  // Filtered Barangay Folders list based on folder search
  const filteredBarangayFolders = React.useMemo(() => {
    if (!folderSearch.trim()) return barangayFolders;
    const q = folderSearch.toLowerCase().trim();
    return barangayFolders.filter((f) => 
      f.name.toLowerCase().includes(q) ||
      f.records.some(r => r.fullName.toLowerCase().includes(q) || r.purok.toLowerCase().includes(q))
    );
  }, [barangayFolders, folderSearch]);

  // =========================================================================
  // LEDGER: ALL NAMES WHO SUBMITTED PCU FILES WITH THEIR COUNT OF SUBMISSION
  // =========================================================================
  const submittersLedger = React.useMemo(() => {
    const map = new Map<string, {
      name: string;
      submissionsCount: number;
      filesCount: number;
      barangays: Set<string>;
      latestSubmission: string | null;
      records: UploadedPcuRecord[];
    }>();

    uploadedRecords.forEach((rec) => {
      const submitter = (rec.uploadedBy || 'Staff').trim();
      const key = submitter.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: submitter,
          submissionsCount: 0,
          filesCount: 0,
          barangays: new Set<string>(),
          latestSubmission: null,
          records: []
        });
      }

      const item = map.get(key)!;
      item.submissionsCount += 1;
      const fCount = rec.filesCount || (rec.uploadedFiles ? rec.uploadedFiles.length : 1);
      item.filesCount += fCount;
      if (rec.barangay) item.barangays.add(rec.barangay);
      if (!item.latestSubmission || new Date(rec.uploadedAt).getTime() > new Date(item.latestSubmission).getTime()) {
        item.latestSubmission = rec.uploadedAt;
      }
      item.records.push(rec);
    });

    return Array.from(map.values()).sort((a, b) => b.submissionsCount - a.submissionsCount);
  }, [uploadedRecords]);

  // Ledger Filtered Detailed Records Table
  const filteredLedgerRecords = React.useMemo(() => {
    return uploadedRecords.filter((rec) => {
      const matchesSearch = !ledgerSearch.trim() ||
        (rec.uploadedBy || '').toLowerCase().includes(ledgerSearch.toLowerCase().trim()) ||
        rec.fullName.toLowerCase().includes(ledgerSearch.toLowerCase().trim()) ||
        rec.barangay.toLowerCase().includes(ledgerSearch.toLowerCase().trim()) ||
        rec.purok.toLowerCase().includes(ledgerSearch.toLowerCase().trim());

      const matchesSubmitter = ledgerSubmitterFilter === 'ALL' ||
        (rec.uploadedBy || '').toLowerCase() === ledgerSubmitterFilter.toLowerCase();

      const matchesBarangay = ledgerBarangayFilter === 'ALL' ||
        rec.barangay.toLowerCase() === ledgerBarangayFilter.toLowerCase();

      return matchesSearch && matchesSubmitter && matchesBarangay;
    });
  }, [uploadedRecords, ledgerSearch, ledgerSubmitterFilter, ledgerBarangayFilter]);

  // Export Ledger to CSV Function
  const exportLedgerToCsv = () => {
    if (uploadedRecords.length === 0) {
      showToast('No records available to export', 'warning');
      return;
    }
    const headers = [
      'Submitter Name',
      'Patient Full Name',
      'Barangay',
      'Purok / Address',
      'Contact Number',
      'Files Attached Count',
      'File Names',
      'Submission Date & Time',
      'Status'
    ];
    const rows = uploadedRecords.map((rec) => [
      `"${(rec.uploadedBy || 'Staff').replace(/"/g, '""')}"`,
      `"${(rec.fullName || '').replace(/"/g, '""')}"`,
      `"${(rec.barangay || '').replace(/"/g, '""')}"`,
      `"${(rec.purok || '').replace(/"/g, '""')}"`,
      `"${(rec.contactNumber || '').replace(/"/g, '""')}"`,
      rec.filesCount || (rec.uploadedFiles ? rec.uploadedFiles.length : 1),
      `"${(rec.uploadedFiles || []).map(f => f.name).join('; ').replace(/"/g, '""')}"`,
      `"${formatTimestamp(rec.uploadedAt).replace(/"/g, '""')}"`,
      `"${(rec.status || 'SUBMITTED').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pcu_submissions_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('PCU Submissions Ledger exported to CSV successfully', 'success');
  };

  // Filtered records for Grid when inside a folder or in all-grid mode
  const currentFolderData = React.useMemo(() => {
    if (!selectedFolder) return null;
    return barangayFolders.find(f => f.name.toLowerCase() === selectedFolder.toLowerCase()) || null;
  }, [barangayFolders, selectedFolder]);

  // Filtered records for Grid
  const filteredRecords = (selectedFolder && currentFolderData ? currentFolderData.records : uploadedRecords).filter(rec => {
    const matchesSearch = !searchQuery.trim() || 
      rec.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      rec.barangay.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      rec.purok.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (rec.contactNumber && rec.contactNumber.includes(searchQuery.trim()));

    const matchesBarangay = !selectedFolder && (filterBarangay === 'ALL' || 
      rec.barangay.toLowerCase() === filterBarangay.toLowerCase());

    return matchesSearch && matchesBarangay;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ========================================================================= */}
      {/* SECTION HEADER WITH MOVED "UPLOAD PCU" BUTTON                             */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-emerald-800/40">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Header Title & Subtitle */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              Patient Care Unit (PCU)
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black font-display tracking-tight text-white flex items-center gap-3">
              <span>Submit PCU</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-emerald-200 border border-white/10">
                {uploadedRecords.length} Records
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
              Official portal for submitting Patient Care Unit documentation and multiple image attachments. Click any card in the grid to view whole data uploaded.
            </p>
          </div>

          {/* RIGHT SIDE OF HEADER: THE MOVED "UPLOAD PCU" BUTTON & USER BADGES */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* User Info Badges */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="px-3.5 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 text-right">
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Logged In</span>
                <span className="text-xs font-black text-white">{currentUser?.username || 'Staff'}</span>
              </div>
              {currentUser?.barangay && (
                <div className="px-3.5 py-2 bg-emerald-800/50 backdrop-blur-md rounded-2xl border border-emerald-500/30 text-right">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Barangay</span>
                  <span className="text-xs font-black text-white">{currentUser.barangay}</span>
                </div>
              )}
            </div>

            {/* THE REQUESTED "UPLOAD PCU" BUTTON ON THE HEADER OF THE SECTION */}
            {!isFormOpen ? (
              <button
                type="button"
                name="Upload PCU"
                onClick={() => {
                  setSubmitSuccess(null);
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:from-emerald-600 active:to-teal-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-400/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer focus:outline-none"
              >
                <UploadCloud className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                <span>Upload PCU</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs uppercase tracking-wider rounded-2xl border border-white/20 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Grid</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Toast / Success Message */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 text-xs font-semibold shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* TABS NAVIGATION BAR BELOW THE HEADER                                       */}
      {/* Tab 1: Barangay Folders (Every file placed into its Barangay folder)      */}
      {/* Tab 2: Ledger (Master Admin Only - all submitter names & submission counts)*/}
      {/* ========================================================================= */}
      {!isFormOpen && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2">
            {/* Tab 1: Barangay Folders */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('folders');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'folders'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Barangay Folders</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'folders' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
              }`}>
                {barangayFolders.length}
              </span>
            </button>

            {/* Tab 2: Ledger (Only Master Admin can view) */}
            {isMasterAdmin && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ledger');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Ledger</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-700 border border-amber-300/40">
                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                  Master Admin
                </span>
              </button>
            )}
          </div>

          {/* Quick Info & Refresh */}
          <div className="flex items-center justify-between sm:justify-end gap-3 px-2 sm:px-0">
            <span className="text-xs text-slate-400 font-medium">
              {uploadedRecords.length} Total Submissions
            </span>
            <button
              type="button"
              onClick={fetchUploadedRecords}
              disabled={loadingRecords}
              className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRecords ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic View: Toggle between Grid View of Uploaded Data and Upload PCU Form */}
      <AnimatePresence mode="wait">
        {!isFormOpen ? (
          activeTab === 'folders' ? (
            /* ========================================================================= */
            /* VIEW A: BARANGAY FOLDERS (EACH FILE PLACED IN ITS BARANGAY FOLDER)         */
            /* ========================================================================= */
            <motion.div
              key="folders-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* If no specific folder is selected, show ALL BARANGAY FOLDERS */}
              {selectedFolder === null ? (
                <div className="space-y-6">
                  {/* Folder Sub-Bar: Search & View Mode Switcher */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {/* Search Folders or Patients */}
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={folderSearch}
                          onChange={(e) => setFolderSearch(e.target.value)}
                          placeholder="Search Barangay folders, patient names, or purok..."
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                        />
                        {folderSearch && (
                          <button
                            type="button"
                            onClick={() => setFolderSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* View Switcher: Browse by Folders vs Flattened All Grid */}
                      <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => setFolderViewMode('folders')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            folderViewMode === 'folders'
                              ? 'bg-white text-emerald-800 shadow-xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          <Folder className="w-3.5 h-3.5" />
                          <span>Folders</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFolderViewMode('all')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            folderViewMode === 'all'
                              ? 'bg-white text-emerald-800 shadow-xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>All Grid ({uploadedRecords.length})</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-bold text-slate-500">
                      <span>{barangayFolders.length} Barangay Folders</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-black">
                        {barangayFolders.reduce((sum, f) => sum + f.totalFiles, 0)} Files Total
                      </span>
                    </div>
                  </div>

                  {/* Mode 1: Display as BARANGAY FOLDERS */}
                  {folderViewMode === 'folders' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {filteredBarangayFolders.map((folder) => {
                        const hasFiles = folder.totalSubmissions > 0;

                        return (
                          <div
                            key={folder.name}
                            onClick={() => setSelectedFolder(folder.name)}
                            className="group relative bg-white rounded-3xl border border-slate-200/90 hover:border-emerald-500/60 shadow-xs hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
                          >
                            {/* Top Folder Tab Decoration */}
                            <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-slate-800 group-hover:h-2.5 transition-all" />

                            <div className="p-5 space-y-4">
                              {/* Header: Folder Icon & Files Badge */}
                              <div className="flex items-start justify-between gap-3">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                                  hasFiles
                                    ? 'bg-emerald-100 text-emerald-700 shadow-md shadow-emerald-500/10 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white'
                                    : 'bg-slate-100 text-slate-400'
                                }`}>
                                  <Folder className="w-6 h-6" />
                                </div>

                                <div className="text-right space-y-1">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
                                    hasFiles 
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' 
                                      : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    <ImageIcon className="w-3 h-3" />
                                    <span>{folder.totalFiles} {folder.totalFiles === 1 ? 'file' : 'files'}</span>
                                  </span>
                                  <span className="block text-[11px] font-bold text-slate-400">
                                    {folder.totalSubmissions} {folder.totalSubmissions === 1 ? 'patient' : 'patients'}
                                  </span>
                                </div>
                              </div>

                              {/* Barangay Name & Info */}
                              <div className="space-y-1">
                                <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                                  <span>{folder.name}</span>
                                </h3>
                                <p className="text-[11px] text-slate-400 line-clamp-1">
                                  {hasFiles 
                                    ? `Staff: ${Array.from(folder.submitters).slice(0, 2).join(', ')}${folder.submitters.size > 2 ? '...' : ''}` 
                                    : 'No PCU files uploaded yet'}
                                </p>
                              </div>
                            </div>

                            {/* Card Footer: Last Uploaded & Action */}
                            <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="text-[11px] text-slate-400">
                                {folder.latestUploadedAt ? `Updated ${formatTimestamp(folder.latestUploadedAt).split(',')[0]}` : 'Empty Folder'}
                              </span>

                              <div className="flex items-center gap-1.5 font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                                <span>Open Folder</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Mode 2: Flattened All Grid View */
                    <div className="space-y-4">
                      {/* Search & Filter Bar for All Grid */}
                      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search by patient name, purok, or contact #..."
                              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                            />
                            {searchQuery && (
                              <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="sm:w-56 shrink-0 relative">
                            <select
                              value={filterBarangay}
                              onChange={(e) => setFilterBarangay(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
                            >
                              <option value="ALL">All Barangays ({uploadedRecords.length})</option>
                              {barangaysList.map((bg) => {
                                const count = uploadedRecords.filter(r => r.barangay.toLowerCase() === bg.toLowerCase()).length;
                                return (
                                  <option key={bg} value={bg}>
                                    {bg} {count > 0 ? `(${count})` : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>

                        <div className="text-xs font-bold text-slate-500">
                          Showing <span className="text-slate-900 font-black">{filteredRecords.length}</span> of {uploadedRecords.length}
                        </div>
                      </div>

                      {/* Grid of All Cards */}
                      {filteredRecords.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-dashed border-slate-200">
                          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto" />
                          <h4 className="text-base font-bold text-slate-700">No submissions found</h4>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            No uploaded PCU submissions match your current search criteria.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                          {filteredRecords.map((record, index) => {
                            const firstFile = record.uploadedFiles[0];
                            const hasImage = firstFile && isImageFile(firstFile.url, firstFile.name);

                            return (
                              <div
                                key={`${record.id}-${record.fullName}-${index}`}
                                onClick={() => setSelectedRecord(record)}
                                className="group bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-500/60 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col cursor-pointer transform hover:-translate-y-1 relative"
                              >
                                <div className="relative h-44 sm:h-48 w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                                  {hasImage && firstFile.url ? (
                                    <img
                                      src={firstFile.url}
                                      alt={record.fullName}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                      loading="lazy"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 p-4 space-y-2">
                                      <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600">
                                        <FileText className="w-6 h-6" />
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-500 text-center line-clamp-1">
                                        {firstFile?.name || 'PCU Document'}
                                      </span>
                                    </div>
                                  )}

                                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 backdrop-blur-md text-emerald-200 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30 shadow-xs">
                                      {record.barangay}
                                    </span>

                                    <div className="flex items-center gap-1.5 pointer-events-auto">
                                      <span className="px-2 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 border border-white/10 shadow-xs">
                                        <ImageIcon className="w-3 h-3 text-emerald-400" />
                                        <span>{record.filesCount} {record.filesCount === 1 ? 'file' : 'files'}</span>
                                      </span>

                                      {isMasterAdmin && (
                                        <button
                                          type="button"
                                          onClick={(e) => promptDeleteRecord(e, record)}
                                          className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 active:bg-rose-700 text-white shadow-md transition-all cursor-pointer hover:scale-110"
                                          title="Permanently Delete PCU Record from MySQL (Master Admin Only)"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="absolute inset-0 bg-emerald-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-emerald-900 text-xs font-black shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                                      <Eye className="w-4 h-4 text-emerald-600" />
                                      View Whole Data
                                    </span>
                                  </div>
                                </div>

                                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                  <div className="space-y-1.5">
                                    <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-emerald-700 transition-colors line-clamp-1" title={record.fullName}>
                                      {record.fullName}
                                    </h3>

                                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="truncate">
                                        {record.purok ? `${record.purok}, ` : ''}{record.barangay}
                                      </span>
                                    </div>

                                    {record.contactNumber && (
                                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono">
                                        <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                        <span className="truncate">{record.contactNumber}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                    <div className="flex items-center gap-1 truncate" title={`Uploaded by ${record.uploadedBy}`}>
                                      <User className="w-3 h-3 text-slate-400" />
                                      <span className="truncate font-medium">{record.uploadedBy}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1 shrink-0 font-medium text-slate-400">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span>{new Date(record.uploadedAt).toLocaleDateString()}</span>
                                      </div>

                                      {isMasterAdmin && (
                                        <button
                                          type="button"
                                          onClick={(e) => promptDeleteRecord(e, record)}
                                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                          title="Permanently Delete from MySQL (Master Admin Only)"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* INSIDE A SPECIFIC BARANGAY FOLDER */
                <div className="space-y-6">
                  {/* Folder Breadcrumbs & Controls Banner */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedFolder(null)}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        title="Back to All Barangay Folders"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          <span 
                            onClick={() => setSelectedFolder(null)}
                            className="hover:text-emerald-700 cursor-pointer flex items-center gap-1"
                          >
                            <Folder className="w-3.5 h-3.5 text-emerald-600" />
                            All Folders
                          </span>
                          <span>/</span>
                          <span className="text-emerald-700">Barangay Folder</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                          <span>{selectedFolder}</span>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {currentFolderData?.totalFiles || 0} Files
                          </span>
                        </h2>
                      </div>
                    </div>

                    {/* Right side: Switch folder dropdown & Upload shortcut */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Jump to Another Barangay Folder Dropdown */}
                      <div className="relative">
                        <select
                          value={selectedFolder}
                          onChange={(e) => setSelectedFolder(e.target.value)}
                          className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
                        >
                          {barangayFolders.map((f) => (
                            <option key={f.name} value={f.name}>
                              Folder: {f.name} ({f.totalFiles} files)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Upload Button specifically for this Barangay Folder */}
                      <button
                        type="button"
                        onClick={() => {
                          setBarangay(selectedFolder);
                          setFullName('');
                          setPurok('');
                          setContactNumber('');
                          setStagedFiles([]);
                          setIsFormOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Upload to {selectedFolder}</span>
                      </button>
                    </div>
                  </div>

                  {/* Search within this folder */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search patient records within ${selectedFolder}...`}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-xs"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Submissions Grid for this folder */}
                  {filteredRecords.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-dashed border-slate-200">
                      <FolderOpen className="w-14 h-14 text-emerald-400/60 mx-auto" />
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-slate-800">
                          No PCU files in {selectedFolder} yet
                        </h4>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Be the first to submit Patient Care Unit documentation for this Barangay. All submitted files will be securely organized in this folder.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBarangay(selectedFolder);
                          setFullName('');
                          setPurok('');
                          setContactNumber('');
                          setStagedFiles([]);
                          setIsFormOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload PCU for {selectedFolder}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                      {filteredRecords.map((record, index) => {
                        const firstFile = record.uploadedFiles[0];
                        const hasImage = firstFile && isImageFile(firstFile.url, firstFile.name);

                        return (
                          <div
                            key={`${record.id}-${record.fullName}-${index}`}
                            onClick={() => setSelectedRecord(record)}
                            className="group bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-500/60 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col cursor-pointer transform hover:-translate-y-1 relative"
                          >
                            <div className="relative h-44 sm:h-48 w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                              {hasImage && firstFile.url ? (
                                <img
                                  src={firstFile.url}
                                  alt={record.fullName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 p-4 space-y-2">
                                  <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600">
                                    <FileText className="w-6 h-6" />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-500 text-center line-clamp-1">
                                    {firstFile?.name || 'PCU Document'}
                                  </span>
                                </div>
                              )}

                              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 backdrop-blur-md text-emerald-200 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30 shadow-xs">
                                  {record.barangay}
                                </span>

                                <div className="flex items-center gap-1.5 pointer-events-auto">
                                  <span className="px-2 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 border border-white/10 shadow-xs">
                                    <ImageIcon className="w-3 h-3 text-emerald-400" />
                                    <span>{record.filesCount} {record.filesCount === 1 ? 'file' : 'files'}</span>
                                  </span>

                                  {isMasterAdmin && (
                                    <button
                                      type="button"
                                      onClick={(e) => promptDeleteRecord(e, record)}
                                      className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 active:bg-rose-700 text-white shadow-md transition-all cursor-pointer hover:scale-110"
                                      title="Permanently Delete PCU Record from MySQL (Master Admin Only)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="absolute inset-0 bg-emerald-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-emerald-900 text-xs font-black shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                                  <Eye className="w-4 h-4 text-emerald-600" />
                                  View Whole Data
                                </span>
                              </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                              <div className="space-y-1.5">
                                <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-emerald-700 transition-colors line-clamp-1" title={record.fullName}>
                                  {record.fullName}
                                </h3>

                                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate">
                                    {record.purok ? `${record.purok}, ` : ''}{record.barangay}
                                  </span>
                                </div>

                                {record.contactNumber && (
                                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono">
                                    <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                    <span className="truncate">{record.contactNumber}</span>
                                  </div>
                                )}
                              </div>

                              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                <div className="flex items-center gap-1 truncate" title={`Uploaded by ${record.uploadedBy}`}>
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span className="truncate font-medium">{record.uploadedBy}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 shrink-0 font-medium text-slate-400">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>{new Date(record.uploadedAt).toLocaleDateString()}</span>
                                  </div>

                                  {isMasterAdmin && (
                                    <button
                                      type="button"
                                      onClick={(e) => promptDeleteRecord(e, record)}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Permanently Delete from MySQL (Master Admin Only)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            /* ========================================================================= */
            /* VIEW B: LEDGER (MASTER ADMIN ONLY)                                        */
            /* Lists all the names who submitted PCU Files with their count of submission*/
            /* ========================================================================= */
            <motion.div
              key="ledger-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Ledger Header & Export Controls */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-300/30">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Master Admin Audit Portal</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white flex items-center gap-3">
                      <span>PCU Submissions Ledger</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-emerald-300">
                        {submittersLedger.length} Contributors
                      </span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                      Official record listing all staff and submitters who uploaded PCU files, complete with their submission tallies, attached file counts, and breakdown by Barangay.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={exportLedgerToCsv}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 KPI Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Submissions */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Submissions</span>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900">{uploadedRecords.length}</div>
                  <span className="text-[11px] text-slate-400 block">Verified patient records</span>
                </div>

                {/* 2. Total Files Attached */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Files Attached</span>
                    <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {uploadedRecords.reduce((acc, r) => acc + (r.filesCount || 1), 0)}
                  </div>
                  <span className="text-[11px] text-slate-400 block">Images & documents stored</span>
                </div>

                {/* 3. Active Submitters Count */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Submitters</span>
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900">{submittersLedger.length}</div>
                  <span className="text-[11px] text-slate-400 block">Staff & administrators</span>
                </div>

                {/* 4. Top Barangay */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Leading Barangay</span>
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-lg font-black text-slate-900 truncate" title={barangayFolders[0]?.name || 'None'}>
                    {barangayFolders[0]?.name || 'Central'}
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    {barangayFolders[0]?.totalSubmissions || 0} submissions
                  </span>
                </div>
              </div>

              {/* SECTION 1: ALL THE NAMES WHO SUBMITTED PCU FILES WITH THEIR COUNT OF SUBMISSION */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        Submitters & Contributor Tallies
                      </h3>
                      <p className="text-xs text-slate-400">
                        All staff and user accounts who submitted PCU records with their exact submission counts
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-slate-400">
                    {submittersLedger.length} Registered Submitters
                  </span>
                </div>

                {/* Submitter Cards Grid */}
                {submittersLedger.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium">
                    No submitters recorded yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {submittersLedger.map((sub, idx) => {
                      const isSelected = ledgerSubmitterFilter.toLowerCase() === sub.name.toLowerCase();

                      return (
                        <div
                          key={sub.name}
                          onClick={() => {
                            setLedgerSubmitterFilter(isSelected ? 'ALL' : sub.name);
                          }}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-4 ${
                            isSelected
                              ? 'bg-emerald-50/70 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                              : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-sm flex items-center justify-center shadow-xs">
                                {sub.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-black text-slate-900 text-sm">{sub.name}</h4>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Rank #{idx + 1}
                                </span>
                              </div>
                            </div>

                            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs shadow-xs">
                              {sub.submissionsCount} {sub.submissionsCount === 1 ? 'submission' : 'submissions'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Total Attached Files</span>
                              <span className="font-bold text-slate-800">{sub.filesCount} files</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Barangays Covered</span>
                              <span className="font-bold text-slate-800">{sub.barangays.size} barangays</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                            <span>
                              {sub.latestSubmission ? `Latest: ${formatTimestamp(sub.latestSubmission).split(',')[0]}` : ''}
                            </span>
                            <span className="text-emerald-700 font-bold hover:underline">
                              {isSelected ? 'Reset Filter' : 'Filter Ledger →'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: DETAILED SUBMISSIONS AUDIT LOG TABLE */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        Detailed Submissions Ledger Table
                      </h3>
                      <p className="text-xs text-slate-400">
                        Full verifiable audit trail of every patient submission record in MySQL
                      </p>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-500">
                    Showing <span className="text-slate-900 font-black">{filteredLedgerRecords.length}</span> of {uploadedRecords.length} records
                  </div>
                </div>

                {/* Filters Bar for Ledger Table */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      placeholder="Search submitter, patient, or purok..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                    {ledgerSearch && (
                      <button
                        type="button"
                        onClick={() => setLedgerSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Submitter */}
                  <div>
                    <select
                      value={ledgerSubmitterFilter}
                      onChange={(e) => setLedgerSubmitterFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
                    >
                      <option value="ALL">All Submitters ({submittersLedger.length})</option>
                      {submittersLedger.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name} ({s.submissionsCount} submissions)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Barangay */}
                  <div>
                    <select
                      value={ledgerBarangayFilter}
                      onChange={(e) => setLedgerBarangayFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
                    >
                      <option value="ALL">All Barangays</option>
                      {barangaysList.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Submitter Name</th>
                        <th className="py-3 px-4">Patient Name</th>
                        <th className="py-3 px-4">Barangay & Address</th>
                        <th className="py-3 px-4">Files Attached</th>
                        <th className="py-3 px-4">Submitted At</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLedgerRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                            No matching submissions found in ledger.
                          </td>
                        </tr>
                      ) : (
                        filteredLedgerRecords.map((record, index) => (
                          <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4 font-mono text-slate-400">{index + 1}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{record.uploadedBy}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-800">
                              {record.fullName}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              <span className="font-semibold text-slate-800">{record.barangay}</span>
                              {record.purok ? <span className="text-slate-400"> ({record.purok})</span> : ''}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/60 text-[11px]">
                                <ImageIcon className="w-3 h-3 text-emerald-600" />
                                <span>{record.filesCount} {record.filesCount === 1 ? 'file' : 'files'}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                              {formatTimestamp(record.uploadedAt)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(record)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] transition-colors cursor-pointer"
                                  title="View Whole Data"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </button>
                                {isMasterAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => promptDeleteRecord(e, record)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Permanently Delete Submission from MySQL (Master Admin Only)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )
        ) : (
          /* ========================================================================= */
          /* SECTION 2: THE FORM (DISPLAYED WHEN "Upload PCU" BUTTON IS CLICKED)        */
          /* ========================================================================= */
          <motion.div
            key="upload-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-sm space-y-8">
              {/* Form Navigation Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    title="Back to Grid"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 font-display">
                      PCU Upload & Submission Form
                    </h2>
                    <p className="text-xs text-slate-500">
                      Fill in patient information and select multiple PCU images to submit to Base44 and MySQL.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  Cancel & Return to Grid
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 1. Full Name */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      Enter the patient's complete name (First, Middle, Last).
                    </span>
                  </div>

                  {/* 2. Barangay (selection from database Barangay) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        Barangay <span className="text-rose-500">*</span>
                      </span>
                      {loadingBarangays && (
                        <span className="text-[10px] text-emerald-600 font-normal flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading list...
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <select
                        value={barangay}
                        onChange={(e) => setBarangay(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
                      >
                        {barangaysList.length === 0 ? (
                          <option value="">No Barangays Loaded</option>
                        ) : (
                          barangaysList.map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      Selected from verified clinic database barangays.
                    </span>
                  </div>

                  {/* 3. Purok */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      Purok
                    </label>
                    <input
                      type="text"
                      value={purok}
                      onChange={(e) => setPurok(e.target.value)}
                      placeholder="e.g. Purok 1, Purok Rosal, Sitio Centro"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      Sub-village or purok location within the barangay.
                    </span>
                  </div>

                  {/* 4. Contact # */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      Contact #
                    </label>
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="e.g. 0912-345-6789"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      Mobile number or phone contact for patient follow-up.
                    </span>
                  </div>
                </div>

                {/* 5. Upload PCU (Multiple Image Upload Support) */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      Upload PCU (Multiple Images Supported) <span className="text-rose-500">*</span>
                    </label>
                    {stagedFiles.length > 0 && (
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {stagedFiles.length} image(s) selected
                      </span>
                    )}
                  </div>

                  {/* Dropzone Area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={handleFilesSelected}
                      className="hidden"
                    />

                    <div className="space-y-3">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                        <UploadCloud className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-700">
                          Click to select multiple PCU images or drag & drop files here
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Supports PNG, JPG, JPEG, WEBP, and PDF documents (up to 25MB each)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Preview Grid for Staged Files */}
                  {stagedFiles.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                        <span>Selected Attachments:</span>
                        <button
                          type="button"
                          onClick={() => setStagedFiles([])}
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {stagedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 relative group overflow-hidden flex flex-col justify-between"
                          >
                            <div className="w-full h-24 rounded-lg bg-slate-200/70 overflow-hidden flex items-center justify-center mb-2">
                              {file.previewUrl ? (
                                <img
                                  src={file.previewUrl}
                                  alt={file.fileName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileText className="w-8 h-8 text-slate-400" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-800 truncate" title={file.fileName}>
                                {file.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">
                                {formatFileSize(file.size)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStagedFile(idx);
                              }}
                              className="absolute top-1.5 right-1.5 p-1 bg-white/90 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg shadow-sm border border-slate-200 transition-colors cursor-pointer"
                              title="Remove file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-full min-h-[130px] border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/30 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-emerald-700 transition-all cursor-pointer p-3"
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-[11px] font-bold">Add More</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Action Buttons */}
                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    disabled={submitting}
                    className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || stagedFiles.length === 0}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-700/20 hover:shadow-xl hover:shadow-emerald-700/30 transition-all cursor-pointer focus:outline-none"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting PCU Record...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Submit PCU</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CLICKABLE TO VIEW WHOLE DATA UPLOADED                              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">
                    <ShieldCheck className="w-3 h-3" />
                    Whole Data Uploaded
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
                    {selectedRecord.fullName}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {/* Delete Entire Submission Button (Master Admin only) */}
                  {isMasterAdmin && (
                    <button
                      type="button"
                      onClick={(e) => promptDeleteRecord(e, selectedRecord)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 active:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                      title="Permanently Delete Entire Submission from MySQL (Master Admin Only)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete Submission</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                    title="Close Details"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
                {/* 1. Patient & Upload Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Barangay */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Barangay
                    </span>
                    <p className="text-sm font-black text-slate-800">{selectedRecord.barangay}</p>
                  </div>

                  {/* Purok */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Purok / Address
                    </span>
                    <p className="text-sm font-bold text-slate-800">{selectedRecord.purok || '—'}</p>
                  </div>

                  {/* Contact Number */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> Contact #
                    </span>
                    <p className="text-sm font-bold font-mono text-slate-800">{selectedRecord.contactNumber || '—'}</p>
                  </div>

                  {/* Upload Date & Staff */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" /> Uploaded At
                    </span>
                    <p className="text-xs font-bold text-slate-800">{formatTimestamp(selectedRecord.uploadedAt)}</p>
                    <span className="text-[10px] text-slate-400 block">By: {selectedRecord.uploadedBy}</span>
                  </div>
                </div>

                {/* 2. Gallery of Whole Data Uploaded (All files & images) */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">
                          All Uploaded PCU Files ({selectedRecord.uploadedFiles.length})
                        </h3>
                        <p className="text-xs text-slate-400">
                          Click any image to enlarge or click the delete button to permanently remove it from MySQL
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Files Gallery Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedRecord.uploadedFiles.map((file, idx) => {
                      const isImg = isImageFile(file.url, file.name);

                      return (
                        <div
                          key={idx}
                          className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between group hover:border-emerald-500/60 hover:shadow-md transition-all"
                        >
                          {/* File Preview */}
                          <div
                            onClick={() => {
                              if (isImg && file.url) {
                                setActiveLightboxIndex(idx);
                              } else if (file.url) {
                                window.open(file.url, '_blank');
                              }
                            }}
                            className="relative h-44 w-full bg-slate-200 cursor-pointer overflow-hidden flex items-center justify-center"
                          >
                            {isImg && file.url ? (
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="text-center p-4 space-y-2">
                                <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                                <span className="text-xs font-bold text-slate-600 block">PDF / Document</span>
                              </div>
                            )}

                            {/* Top right delete button on file card (Master Admin only) */}
                            {isMasterAdmin && (
                              <button
                                type="button"
                                onClick={(e) => promptDeleteFile(e, selectedRecord, file, idx)}
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all cursor-pointer z-10"
                                title="Permanently Delete This File from MySQL (Master Admin Only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Overlay zoom indicator */}
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <span className="p-2 rounded-xl bg-white text-slate-900 shadow-md">
                                <ZoomIn className="w-4 h-4 text-emerald-700" />
                              </span>
                            </div>
                          </div>

                          {/* File Description Footer */}
                          <div className="p-3.5 bg-white space-y-2">
                            <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </p>
                            
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                              {/* DELETE BUTTON ON EACH SUBMITTED FILE (Master Admin only) */}
                              {isMasterAdmin ? (
                                <button
                                  type="button"
                                  onClick={(e) => promptDeleteFile(e, selectedRecord, file, idx)}
                                  className="inline-flex items-center gap-1 font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                                  title="Permanently Delete This File from MySQL (Master Admin Only)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete File</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 font-medium">Uploaded File</span>
                              )}

                              {file.url && (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={file.name}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                {isMasterAdmin ? (
                  <button
                    type="button"
                    onClick={(e) => promptDeleteRecord(e, selectedRecord)}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Whole Submission</span>
                  </button>
                ) : (
                  <div className="text-xs text-slate-400 font-medium">
                    Contact Master Admin to delete or modify verified submissions
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* CONFIRMATION POPUP CARD ON THE CENTER OF THE SCREEN                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deleteTarget && (
          <div 
            className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
            onClick={() => !isDeleting && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Center Warning Icon Badge */}
              <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/15 ring-8 ring-rose-50">
                <AlertTriangle className="w-8 h-8" />
              </div>

              {/* Title & Warning Text */}
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {deleteTarget.isSingleFile ? 'Permanently Delete File?' : 'Permanently Delete Submission?'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You are about to permanently remove this record from the clinic system and{' '}
                  <strong className="text-rose-700">cPanel MySQL database</strong>. This action cannot be undone.
                </p>
              </div>

              {/* Information Summary Box */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold">Patient:</span>
                  <span className="font-bold text-slate-800">{deleteTarget.record.fullName}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold">Barangay:</span>
                  <span className="font-semibold text-slate-700">{deleteTarget.record.barangay}</span>
                </div>
                {deleteTarget.isSingleFile && deleteTarget.file && (
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                    <span className="text-slate-400 font-semibold">Target File:</span>
                    <span className="font-bold text-rose-700 truncate max-w-[200px]" title={deleteTarget.file.name}>
                      {deleteTarget.file.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-600" /> Database:
                  </span>
                  <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md text-[11px]">
                    cPanel MySQL (pcu_submissions)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="w-1/2 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executePermanentDelete}
                  disabled={isDeleting}
                  className="w-1/2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:from-rose-800 active:to-red-800 text-white font-black text-xs shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* FULL SCREEN LIGHTBOX PREVIEW                                              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedRecord && activeLightboxIndex !== null && (
          <div
            className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setActiveLightboxIndex(null)}
          >
            {/* Lightbox Controls */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10 pointer-events-auto">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-white">
                  {selectedRecord.uploadedFiles[activeLightboxIndex]?.name || 'PCU Document'}
                </h4>
                <p className="text-[11px] text-emerald-400 font-medium">
                  Image {activeLightboxIndex + 1} of {selectedRecord.uploadedFiles.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedRecord.uploadedFiles[activeLightboxIndex]?.url && (
                  <a
                    href={selectedRecord.uploadedFiles[activeLightboxIndex].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Open Full Resolution"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActiveLightboxIndex(null)}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white transition-colors cursor-pointer"
                  title="Close Lightbox"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Prev/Next buttons if multiple images */}
            {selectedRecord.uploadedFiles.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveLightboxIndex(prev => 
                      prev! > 0 ? prev! - 1 : selectedRecord.uploadedFiles.length - 1
                    );
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveLightboxIndex(prev => 
                      prev! < selectedRecord.uploadedFiles.length - 1 ? prev! + 1 : 0
                    );
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Main Lightbox Image View */}
            <div className="max-w-5xl max-h-[85vh] p-2 flex items-center justify-center">
              <img
                src={selectedRecord.uploadedFiles[activeLightboxIndex]?.url}
                alt={selectedRecord.uploadedFiles[activeLightboxIndex]?.name}
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
