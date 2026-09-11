import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronDown, ChevronUp, Edit2, Trash2, Eye, FileText, ArrowDownToLine, Loader2, Calendar, Phone, User, Clock, ChevronLeft, ChevronRight, Check, Folder, FolderOpen, ArrowLeft, Grid, List, Plus, Layers, Navigation, Upload, Image, UserCheck, ShieldCheck, CheckSquare, Square, BarChart3, AlertTriangle, CheckCircle2, Lock, ShieldAlert, X, SearchX, UserX, UserPlus, RotateCcw, Database } from 'lucide-react';
import { Contact } from '../types.js';

export const isContactLocked = (c: Contact | null | undefined): boolean => {
  if (!c) return false;
  return Boolean(
    c.locked ||
    c.status === 'SUBMITTED' ||
    c.status === 'LOCKED' ||
    c.status === 'ALREADY SUBMITTED' ||
    c.submittedToBase44 ||
    c.isSubmitted ||
    (c.pcu_file_url && typeof c.pcu_file_url === 'string' && c.pcu_file_url.trim() !== '') ||
    (c.uploadedFiles && Array.isArray(c.uploadedFiles) && c.uploadedFiles.length > 0)
  );
};
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';

export interface BarangayFolderInfo {
  barangay: string;
  count: number;
  purokCount: number;
  geotaggedCount?: number;
}

export interface PurokFolderInfo {
  purok: string;
  count: number;
  barangayCount: number;
  geotaggedCount?: number;
  barangays: string[];
}

interface ContactTableProps {
  authToken: string;
  onEdit: (contact: Contact) => void;
  onAddNewContact?: (prefillName?: string) => void;
  onDeleted: () => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  siteSettings?: {
    title: string;
    faviconTitle: string;
    logoDataUrl: string;
    faviconDataUrl: string;
  };
  onNavigateToMap?: (contact: Contact) => void;
  lastSyncTime?: string | null;
  currentUser?: {
    username: string;
    role: string;
    barangay?: string;
  } | null;
  backNavigateContact?: Contact | null;
  onClearBackNavigateContact?: () => void;
}

const DEFAULT_BARANGAYS = [
  'Navalan',
  'Kalingayan',
  'Dampalan',
  'SAN JOSE',
  'SAN FRANCISCO',
  'SANTA MARIA',
  'Dumalinao',
  'NAPOLAN',
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
  'SAN PEDRO',
  'Buenavista',
];

const formatPurokName = (name: string | null | undefined): string => {
  if (!name) return '';
  const cleaned = name.replace(/^(prk)\.?[\s\-_]*/i, '');
  return cleaned.trim() || name;
};

export const ContactTable: React.FC<ContactTableProps> = ({
  authToken,
  onEdit,
  onAddNewContact,
  onDeleted,
  showToast,
  siteSettings,
  onNavigateToMap,
  lastSyncTime,
  currentUser,
  backNavigateContact,
  onClearBackNavigateContact
}) => {
  // Role permissions check for LEADER and CO-LEADER
  const userRoleNormalized = (currentUser?.role || '').toUpperCase();
  const isLeaderOrCoLeader = userRoleNormalized === 'LEADER' || userRoleNormalized === 'CO-LEADER' || userRoleNormalized.includes('LEADER');
  const isAdmin = userRoleNormalized === 'ADMINISTRATOR';
  const userBarangay = currentUser?.barangay || '';

  // Folder View state vs Table View
  const [activeFolder, setActiveFolder] = useState<string | null>(null); // null = Folder Overview, string = specific Barangay folder
  const [folderSearch, setFolderSearch] = useState('');
  const [isChartExpanded, setIsChartExpanded] = useState(true);
  const [chartMetric, setChartMetric] = useState<'households' | 'puroks' | 'all'>('all');

  // Query Filter States
  const [search, setSearch] = useState('');
  const [addressFilter, setAddressFilter] = useState('All Barangays');
  const [purokFilter, setPurokFilter] = useState('All Puroks');
  const [sortBy, setSortBy] = useState<'name' | 'address' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Loaded DB data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [allAddresses, setAllAddresses] = useState<string[]>([]);
  const [allPuroks, setAllPuroks] = useState<string[]>([]);
  const [barangayFolders, setBarangayFolders] = useState<BarangayFolderInfo[]>([]);
  const [overallBarangayFolders, setOverallBarangayFolders] = useState<BarangayFolderInfo[]>([]);
  const [purokFolders, setPurokFolders] = useState<PurokFolderInfo[]>([]);
  const [folderGrouping, setFolderGrouping] = useState<'barangay' | 'purok'>('barangay');
  const [associatedBarangayForPuroks, setAssociatedBarangayForPuroks] = useState<string | null>(null);
  const [activePurokFolder, setActivePurokFolder] = useState<string | null>(null);
  const [lastOpenedBarangay, setLastOpenedBarangay] = useState<string | null>(null);
  const [lastOpenedPurok, setLastOpenedPurok] = useState<string | null>(null);

  const handleSetActivePurokFolder = (purok: string | null) => {
    setActivePurokFolder(purok);
    if (purok) {
      setLastOpenedPurok(purok);
    }
  };
  const [purokSearch, setPurokSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Debounced search terms for smooth, non-blocking filtering
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedFolderSearch, setDebouncedFolderSearch] = useState('');
  const [debouncedPurokSearch, setDebouncedPurokSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const activeRequestIdRef = useRef(0);

  useEffect(() => {
    if (search !== debouncedSearch) setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setIsSearching(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (folderSearch !== debouncedFolderSearch) setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedFolderSearch(folderSearch);
      setIsSearching(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [folderSearch]);

  useEffect(() => {
    if (purokSearch !== debouncedPurokSearch) setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedPurokSearch(purokSearch);
      setIsSearching(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [purokSearch]);

  const filteredPurokFolders = useMemo(() => {
    let result = purokFolders;
    if (associatedBarangayForPuroks) {
      result = result.filter(f =>
        f.barangays.some(
          b => b.trim().toLowerCase() === associatedBarangayForPuroks.trim().toLowerCase()
        )
      );
    }
    return [...result].sort((a, b) => b.count - a.count || a.purok.localeCompare(b.purok));
  }, [purokFolders, associatedBarangayForPuroks]);

  // Export state
  const [exporting, setExporting] = useState<string | null>(null);

  // Barangay List from Google Sheets / Database
  const [dbBarangayList, setDbBarangayList] = useState<string[]>(DEFAULT_BARANGAYS);

  useEffect(() => {
    fetch('/api/public/barangays')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.barangays) && data.barangays.length > 0) {
          const unique = Array.from(new Set([...data.barangays, ...DEFAULT_BARANGAYS])).filter(Boolean);
          setDbBarangayList(unique);
        }
      })
      .catch(err => console.warn('Failed to load public barangays list:', err));
  }, []);

  const availableBarangays = useMemo(() => {
    const list = new Set<string>([
      ...dbBarangayList,
      ...allAddresses,
      ...barangayFolders.map(b => b.barangay)
    ]);
    return Array.from(list)
      .filter(b => Boolean(b) && b.trim() !== '' && b.toLowerCase() !== 'all addresses' && b.toLowerCase() !== 'no address')
      .sort((a, b) => a.localeCompare(b));
  }, [dbBarangayList, allAddresses, barangayFolders]);

  // Active Modals state
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [alreadySubmittedModalContact, setAlreadySubmittedModalContact] = useState<Contact | null>(null);
  const [isEditingContactInModal, setIsEditingContactInModal] = useState(false);
  const [modalEditFullName, setModalEditFullName] = useState('');
  const [modalEditBarangay, setModalEditBarangay] = useState('');
  const [modalEditPurok, setModalEditPurok] = useState('');
  const [modalEditContactNumber, setModalEditContactNumber] = useState('');
  const [modalIsSaving, setModalIsSaving] = useState(false);

  useEffect(() => {
    if (viewContact) {
      if (isContactLocked(viewContact)) {
        setAlreadySubmittedModalContact(viewContact);
        setViewContact(null);
        return;
      }
      setModalEditFullName(viewContact.full_name || '');
      setModalEditBarangay(viewContact.barangay || '');
      setModalEditPurok(viewContact.purok || '');
      setModalEditContactNumber(viewContact.contact_number || '');
      setIsEditingContactInModal(false);
    } else {
      setIsEditingContactInModal(false);
    }
  }, [viewContact]);

  const handleRowOrCardClick = (contact: Contact) => {
    setHighlightedContactId(contact.id);
    if (isContactLocked(contact)) {
      setAlreadySubmittedModalContact(contact);
    } else {
      setViewContact(contact);
    }
  };

  const [highlightedContactId, setHighlightedContactId] = useState<number | string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  // Designate Barangay Folder state
  const [userAccounts, setUserAccounts] = useState<Array<{ username: string; email: string; fullName: string; barangay: string; role: string; status: string }>>([]);
  const [designateModalOpen, setDesignateModalOpen] = useState(false);
  const [sourceDesignateBarangay, setSourceDesignateBarangay] = useState<string>('');
  const [targetDesignateBarangay, setTargetDesignateBarangay] = useState<string>('');
  const [savingDesignation, setSavingDesignation] = useState(false);

  const fetchUserAccounts = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setUserAccounts(data);
      }
    } catch (err: any) {
      if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        console.warn('User accounts fetch suspended (server starting/restarting).');
      } else {
        console.error('Failed to fetch user accounts:', err);
      }
    }
  };

  useEffect(() => {
    fetchUserAccounts();
  }, [authToken]);

  const handleOpenDesignateModal = (sourceName?: string) => {
    const src = sourceName || activeFolder || (barangayFolders[0]?.barangay || '');
    setSourceDesignateBarangay(src);
    
    // Pick target default from allAddresses that is different from src if possible
    const availableTargets = allAddresses.filter(a => a && a !== 'All Barangays' && a.trim().toLowerCase() !== src.trim().toLowerCase());
    const target = availableTargets[0] || (src || 'Navalan');
    setTargetDesignateBarangay(target);
    setDesignateModalOpen(true);
  };

  const handleSaveDesignation = async () => {
    if (!targetDesignateBarangay.trim()) {
      showToast('Please select or enter a target Barangay name.', 'warning');
      return;
    }

    setSavingDesignation(true);
    try {
      const res = await fetch('/api/admin/designate-barangay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          sourceBarangay: sourceDesignateBarangay.trim(),
          barangay: targetDesignateBarangay.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to designate barangay folder.');
      }

      showToast(data.message || `Barangay "${targetDesignateBarangay}" folder designated successfully!`, 'success');
      setDesignateModalOpen(false);
      
      // Refresh user accounts and contact list
      fetchUserAccounts();
      fetchContacts();

      // If active folder was transferred, switch active folder view to target folder
      if (activeFolder && sourceDesignateBarangay && activeFolder.trim().toLowerCase() === sourceDesignateBarangay.trim().toLowerCase()) {
        setActiveFolder(targetDesignateBarangay.trim());
        setAddressFilter(targetDesignateBarangay.trim());
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingDesignation(false);
    }
  };

  // Syncing Base44 state
  const [syncing, setSyncing] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);

  const handleSyncSheets = async () => {
    setSyncingSheets(true);
    try {
      const res = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync with cPanel MySQL Database.');
      }
      showToast(data.message || 'cPanel MySQL Database synchronized live!', 'success');
      fetchContacts(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSyncingSheets(false);
    }
  };

  const [imageUploading, setImageUploading] = useState(false);
  const [pcuUploading, setPcuUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [readingFileProgress, setReadingFileProgress] = useState<string | null>(null);
  const [stagedPcuFiles, setStagedPcuFiles] = useState<{ file: File; fileName: string; size: number }[]>([]);

  useEffect(() => {
    setStagedPcuFiles([]);
    setUploadProgressText(null);
    setIsReadingFiles(false);
    setReadingFileProgress(null);
  }, [viewContact]);

  const convertFileToBase64 = async (file: File): Promise<string> => {
    // If not an image or already under 800 KB, read directly as base64 without canvas
    if (!file.type.startsWith('image/') || file.size < 800 * 1024) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // High-performance image optimization using createImageBitmap if available
    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file);
        const MAX_DIM = 1600;
        let { width, height } = bitmap;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close?.();
          return canvas.toDataURL('image/jpeg', 0.82);
        }
        bitmap.close?.();
      }
    } catch {
      // Fallback if createImageBitmap fails
    }

    // Standard canvas fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1600;
          let width = img.width;
          let height = img.height;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
            return;
          }
          resolve(e.target?.result as string);
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewContact) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file (PNG, JPG, etc.)', 'error');
      return;
    }

    setImageUploading(true);
    try {
      const base64Data = await convertFileToBase64(file);
      const res = await fetch(`/api/contacts/${viewContact.id}/photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ photoDataUrl: base64Data })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload photo.');
      }

      const updatedContact = await res.json();
      setViewContact(updatedContact);
      setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
      showToast('Image photo uploaded successfully!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setImageUploading(false);
    }
  };

  const handlePCUFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files) as File[];

    const newItems: { file: File; fileName: string; size: number }[] = [];
    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      if (file.size > 25 * 1024 * 1024) {
        showToast(`File "${file.name}" exceeds the 25MB size limit.`, 'error');
        continue;
      }
      newItems.push({
        file,
        fileName: file.name,
        size: file.size
      });
    }

    if (newItems.length > 0) {
      setStagedPcuFiles(prev => [...prev, ...newItems]);
      showToast(`Selected ${newItems.length} file(s). Total staged: ${stagedPcuFiles.length + newItems.length}.`, 'info');
    }
    e.target.value = '';
  };

  const removeStagedPcuFile = (index: number) => {
    setStagedPcuFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handlePCUSubmit = async () => {
    if (!viewContact || stagedPcuFiles.length === 0) return;

    if (isContactLocked(viewContact)) {
      showToast('This contact has already been submitted to Base44 and is permanently locked.', 'warning');
      setAlreadySubmittedModalContact(viewContact);
      setViewContact(null);
      setStagedPcuFiles([]);
      return;
    }

    // Validate Barangay: Must be provided if missing on contact
    const currentBarangay = (modalEditBarangay || viewContact.barangay || '').trim();
    const isBarangayValid = currentBarangay !== '' && 
      currentBarangay.toLowerCase() !== 'not specified' && 
      currentBarangay.toLowerCase() !== 'no address' && 
      currentBarangay.toLowerCase() !== 'all addresses';

    if (!isBarangayValid) {
      showToast('Barangay is required before submitting files. Please select a Barangay.', 'warning');
      return;
    }

    // Validate Purok: Must be provided and not "Not specified"
    const currentPurok = (modalEditPurok || viewContact.purok || '').trim();
    const isPurokValid = currentPurok !== '' && currentPurok.toLowerCase() !== 'not specified';

    if (!isPurokValid) {
      showToast('Purok is required before submitting files. Please type the Purok.', 'warning');
      return;
    }

    setPcuUploading(true);
    setUploadProgressText(stagedPcuFiles.length > 15 ? `Preparing ${stagedPcuFiles.length} files...` : 'Saving to Base44 DB...');

    try {
      // 1. If Barangay or Purok was updated, synchronize contact record first
      const needsContactUpdate = 
        currentBarangay !== (viewContact.barangay || '') ||
        currentPurok !== (viewContact.purok || '');

      if (needsContactUpdate) {
        const updateRes = await fetch(`/api/contacts/${viewContact.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            full_name: modalEditFullName.trim() || viewContact.full_name,
            barangay: currentBarangay,
            purok: currentPurok,
            contact_number: modalEditContactNumber.trim() || viewContact.contact_number
          })
        });

        if (!updateRes.ok) {
          const updateErr = await updateRes.json().catch(() => ({}));
          console.warn('Contact info update warning before PCU upload:', updateErr);
        }
      }

      // 2. Submit PCU files in safe, fast batches of 4 with on-demand parallel compression
      const BATCH_SIZE = 4;
      const totalBatches = Math.ceil(stagedPcuFiles.length / BATCH_SIZE);
      let lastResponseData: any = null;

      for (let i = 0; i < stagedPcuFiles.length; i += BATCH_SIZE) {
        const batch = stagedPcuFiles.slice(i, i + BATCH_SIZE);
        const currentBatchNum = Math.floor(i / BATCH_SIZE) + 1;
        const startFileIdx = i + 1;
        const endFileIdx = Math.min(i + BATCH_SIZE, stagedPcuFiles.length);
        const isLastBatch = endFileIdx === stagedPcuFiles.length;

        if (totalBatches > 1) {
          setUploadProgressText(`Uploading batch ${currentBatchNum} of ${totalBatches} (${startFileIdx}–${endFileIdx} of ${stagedPcuFiles.length} files)...`);
        } else {
          setUploadProgressText(`Uploading ${stagedPcuFiles.length} PCU file(s) to Base44 DB...`);
        }

        // Fast parallel base64 conversion & image optimization for this batch
        const convertedFiles = await Promise.all(
          batch.map(async f => ({
            fileName: f.fileName,
            fileData: await convertFileToBase64(f.file)
          }))
        );

        const res = await fetch(`/api/contacts/${viewContact.id}/pcu`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            fullName: viewContact.full_name,
            barangay: currentBarangay,
            purok: currentPurok,
            contact_number: modalEditContactNumber.trim() || viewContact.contact_number,
            files: convertedFiles,
            isLastBatch,
            totalFilesCount: stagedPcuFiles.length
          })
        });
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to upload batch ${currentBatchNum} of ${totalBatches}.`);
        }

        if (isLastBatch) {
          lastResponseData = await res.json().catch(() => ({}));
        }
      }

      const submittedContactId = viewContact.id;
      const submittedName = (viewContact.full_name || '').trim().toLowerCase();
      const memberName = viewContact.full_name;
      const filesCount = stagedPcuFiles.length;

      // Permanently remove submitted contact from directory table
      setContacts(prev => prev.filter(c => 
        c.id !== submittedContactId && 
        (!c.full_name || c.full_name.trim().toLowerCase() !== submittedName)
      ));

      setViewContact(null);
      setStagedPcuFiles([]);
      fetchContacts();
      if (lastResponseData?.sheetsSyncWarning || lastResponseData?.cpanelSyncWarning) {
        showToast(`Submitted "${memberName}" (${filesCount} file(s)) to Base44 database and permanently deleted from PCU Directory. (${lastResponseData.sheetsSyncWarning || lastResponseData.cpanelSyncWarning})`, 'warning');
      } else {
        showToast(`Successfully submitted "${memberName}" (${filesCount} file(s)) to Base44 database and permanently deleted from PCU Directory!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setPcuUploading(false);
      setUploadProgressText(null);
    }
  };

  const handleSyncBase44 = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/contacts/sync-base44', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync with Base44 Database.');
      }
      showToast(data.message || 'Successfully synchronized with Base44 Database!', 'success');
      fetchContacts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Fetch paginated database contacts list
  const fetchContacts = async (forceSync: boolean = false, targetPage?: number) => {
    const requestId = ++activeRequestIdRef.current;
    
    // Only set full loading indicator if we don't have contacts yet or on folder switch, so table doesn't flicker/flash on search typing
    const isSearchActive = Boolean(
      (activeFolder || activePurokFolder)
        ? debouncedSearch.trim()
        : (folderGrouping === 'barangay' ? debouncedFolderSearch.trim() : debouncedPurokSearch.trim())
    );

    if (!isSearchActive || contacts.length === 0) {
      setLoading(true);
    }
    try {
      let currentBarangay = activeFolder ? activeFolder : (addressFilter === 'All Barangays' ? 'All Addresses' : addressFilter);
      if (isLeaderOrCoLeader && userBarangay) {
        currentBarangay = userBarangay;
      }
      let currentPurok = activePurokFolder ? activePurokFolder : (purokFilter === 'All Puroks' ? 'All Puroks' : purokFilter);
      if (activePurokFolder) {
        currentBarangay = associatedBarangayForPuroks || 'All Addresses';
      } else if (folderGrouping === 'purok' && associatedBarangayForPuroks) {
        currentBarangay = associatedBarangayForPuroks;
      }

      const activeSearch = (activeFolder || activePurokFolder)
        ? debouncedSearch
        : (folderGrouping === 'barangay' ? debouncedFolderSearch : debouncedPurokSearch);

      const queryPage = targetPage !== undefined ? targetPage : page;

      const queryParams = new URLSearchParams({
        search: activeSearch,
        address: currentBarangay,
        purok: currentPurok,
        sortBy,
        sortOrder,
        page: queryPage.toString(),
        limit: limit.toString(),
        sync: forceSync ? 'true' : 'false',
        _t: Date.now().toString()
      });

      const res = await fetch(`/api/contacts?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch contacts list.');
      }

      // Discard stale out-of-order responses
      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      const rawContacts: Contact[] = data.contacts || [];
      setContacts(rawContacts);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setAllPuroks(data.allPuroks || []);

      if (Array.isArray(data.purokFolders)) {
        setPurokFolders(data.purokFolders);
      }

      if (isLeaderOrCoLeader && userBarangay) {
        setAllAddresses([userBarangay]);
        if (Array.isArray(data.barangayFolders)) {
          const filtered = data.barangayFolders.filter(
            (f: BarangayFolderInfo) => f.barangay.trim().toLowerCase() === userBarangay.trim().toLowerCase()
          );
          setBarangayFolders(filtered);
          if (!activeSearch) {
            setOverallBarangayFolders(filtered);
          }
        }
      } else {
        setAllAddresses(data.allAddresses || []);
        if (Array.isArray(data.barangayFolders)) {
          setBarangayFolders(data.barangayFolders);
          if (!activeSearch) {
            setOverallBarangayFolders(data.barangayFolders);
          }
        }
      }
    } catch (err: any) {
      if (requestId === activeRequestIdRef.current) {
        showToast(err.message, 'error');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Handle back-navigation focus to the correct Purok and Barangay folder
  useEffect(() => {
    if (backNavigateContact) {
      const bg = backNavigateContact.barangay || 'No Address';
      const pur = backNavigateContact.purok || 'No Purok';
      
      setFolderGrouping('purok');
      setAssociatedBarangayForPuroks(bg);
      setActiveFolder(null);
      handleSetActivePurokFolder(pur);
      
      // Clear the back navigate contact at the root state to prevent repeat triggering
      if (onClearBackNavigateContact) {
        onClearBackNavigateContact();
      }
    }
  }, [backNavigateContact, onClearBackNavigateContact]);

  // Reset page to 1 when filters or debounced search change, and fetch page 1
  useEffect(() => {
    setPage(1);
    fetchContacts(false, 1);
  }, [
    debouncedSearch,
    debouncedFolderSearch,
    debouncedPurokSearch,
    addressFilter,
    purokFilter,
    sortBy,
    sortOrder,
    activeFolder,
    activePurokFolder,
    associatedBarangayForPuroks,
    lastSyncTime
  ]);

  // Listen for database restore event to immediately refresh contacts and barangays
  useEffect(() => {
    const handleRestoreEvent = () => {
      setPage(1);
      fetchContacts(true, 1);
      fetch(`/api/public/barangays?_t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.barangays) && data.barangays.length > 0) {
            const unique = Array.from(new Set([...data.barangays, ...DEFAULT_BARANGAYS])).filter(Boolean);
            setDbBarangayList(unique);
          }
        })
        .catch(err => console.warn('Failed to refresh barangays after restore:', err));
    };

    window.addEventListener('clinic-data-restored', handleRestoreEvent);
    return () => {
      window.removeEventListener('clinic-data-restored', handleRestoreEvent);
    };
  }, []);

  // Handle explicit page changes (e.g. Next / Prev page pagination)
  useEffect(() => {
    if (page > 1) {
      fetchContacts(false, page);
    }
  }, [page]);

  const handleSort = (field: 'name' | 'address' | 'date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Perform save operation for the inline details editor
  const handleSaveContactFromModal = async () => {
    if (!viewContact) return;
    if (!modalEditFullName.trim()) {
      showToast('Full Name is required.', 'error');
      return;
    }
    if (!modalEditBarangay.trim()) {
      showToast('Barangay is required.', 'error');
      return;
    }
    if (!modalEditContactNumber.trim()) {
      showToast('Contact Number is required.', 'error');
      return;
    }

    setModalIsSaving(true);

    try {
      const res = await fetch(`/api/contacts/${viewContact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          full_name: modalEditFullName.trim(),
          barangay: modalEditBarangay.trim(),
          purok: modalEditPurok.trim(),
          contact_number: modalEditContactNumber.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update member record.');
      }

      showToast(`Member record for "${modalEditFullName}" updated successfully!`, 'success');
      
      // Update local view states to reflect updated values
      setViewContact(data);
      setIsEditingContactInModal(false);
      
      // Refresh list to keep parent sync
      fetchContacts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setModalIsSaving(false);
    }
  };

  // Perform soft delete operations
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/contacts/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete record.');
      }

      showToast(`Contact "${deleteTarget.full_name}" has been soft-deleted successfully.`, 'success');
      setDeleteTarget(null);
      onDeleted();
      fetchContacts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Bulk soft delete a whole Barangay folder (Admin only)
  const handleDeleteFolderConfirm = async () => {
    if (!deleteFolderTarget) return;
    setDeletingFolder(true);

    try {
      const res = await fetch(`/api/contacts/folder/${encodeURIComponent(deleteFolderTarget)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete folder.');
      }

      showToast(`Barangay folder "${deleteFolderTarget}" has been successfully deleted along with ${data.count} members.`, 'success');
      setDeleteFolderTarget(null);
      setActiveFolder(null); // Return to folders grid overview if they were inside it
      fetchContacts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDeletingFolder(false);
    }
  };

  // Get full list of filtered records for export
  const fetchAllMatchingForExport = async (overrideBarangay?: string, overridePurok?: string): Promise<Contact[]> => {
    let targetBarangay = overrideBarangay || (activeFolder ? activeFolder : (addressFilter === 'All Barangays' ? 'All Addresses' : addressFilter));
    let targetPurok = overridePurok || (activePurokFolder ? activePurokFolder : (purokFilter === 'All Puroks' ? 'All Puroks' : purokFilter));

    if (overridePurok || activePurokFolder) {
      targetBarangay = associatedBarangayForPuroks || 'All Addresses'; // query across all address/barangay for this purok
    }

    const queryParams = new URLSearchParams({
      search,
      address: targetBarangay,
      purok: targetPurok === 'All Puroks' ? 'All Puroks' : targetPurok,
      sortBy,
      sortOrder
    });

    const res = await fetch(`/api/contacts/export?${queryParams}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to fetch items for export.');
    }

    return await res.json();
  };

  // XLSX Export Handler
  const handleExportExcel = async (overrideBarangay?: string, overridePurok?: string) => {
    const folderName = overridePurok || activePurokFolder || overrideBarangay || activeFolder || 'All_Records';
    setExporting(`Excel-${folderName}`);
    try {
      const data = await fetchAllMatchingForExport(overrideBarangay, overridePurok);
      if (data.length === 0) {
        showToast('No directory records match current criteria to export.', 'warning');
        return;
      }

      const formattedData = data.map((item, index) => ({
        '#': index + 1,
        'Full Name': item.full_name,
        'Barangay': item.barangay || '',
        'Purok': item.purok || '',
        'Contact Number': item.contact_number,
        'Date Recorded': formatDate(item.created_at)
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Household Directory');

      const fileName = `Saint_Francis_Directory_${folderName.replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showToast(`Excel spreadsheet generated with ${data.length} records!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setExporting(null);
    }
  };

  // PDF Export Handler
  const handleExportPDF = async (overrideBarangay?: string, overridePurok?: string) => {
    if (overrideBarangay) {
      // Transition whole website interface to associated Purok Folders alphabetically without downloading PDF
      setFolderGrouping('purok');
      setAssociatedBarangayForPuroks(overrideBarangay);
      setActiveFolder(null); // Clear active Barangay folder view
      handleSetActivePurokFolder(null); // Return to overview of Purok folders
      showToast(`Switched to Purok folders associated with Barangay: ${overrideBarangay}`, 'success');
      return;
    }

    const folderName = overridePurok || activePurokFolder || 'All_Records';
    setExporting(`PDF-${folderName}`);
    try {
      // Transition whole website interface to Purok Folders alphabetically
      setFolderGrouping('purok');
      setActiveFolder(null); // Clear active Barangay folder view
      if (overridePurok) {
        handleSetActivePurokFolder(overridePurok);
      } else if (!activePurokFolder) {
        handleSetActivePurokFolder(null); // Return to overview of Purok folders
      }

      const data = await fetchAllMatchingForExport(undefined, overridePurok);
      if (data.length === 0) {
        showToast('No directory records match current criteria to export.', 'warning');
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      doc.setFillColor(16, 185, 129); // Emerald header banner
      doc.rect(0, 0, 297, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(siteSettings?.faviconTitle || 'Saint Francis Clinic Directory', 14, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Official Household Directory - Folder: ${folderName}`, 14, 18);

      const tableData = data.map((item, index) => [
        (index + 1).toString(),
        item.full_name,
        item.barangay || '',
        item.purok || '',
        item.contact_number,
        formatDate(item.created_at)
      ]);

      autoTable(doc, {
        startY: 30,
        head: [['#', 'Full Name', 'Barangay', 'Purok', 'Contact Number', 'Date Added']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { top: 30, left: 14, right: 14, bottom: 20 }
      });

      doc.save(`Saint_Francis_Directory_${folderName.replace(/\s+/g, '_')}.pdf`);
      showToast(`PDF report generated successfully for ${folderName}!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setExporting(null);
    }
  };

  // Open a Barangay Folder
  const openFolder = (barangayName: string) => {
    if (isLeaderOrCoLeader && userBarangay && barangayName.trim().toLowerCase() !== userBarangay.trim().toLowerCase()) {
      showToast(`Access restricted: Your account is assigned to Barangay ${userBarangay}`, 'warning');
      return;
    }
    setLastOpenedBarangay(barangayName);
    setFolderGrouping('purok');
    setAssociatedBarangayForPuroks(barangayName);
    setActiveFolder(null); // Clear active Barangay folder view
    handleSetActivePurokFolder(null); // Return to overview of Purok folders
    showToast(`Switched to Purok folders associated with Barangay: ${barangayName}`, 'success');
  };

  // Filter and sort Barangay Folders grid by contact population (highest first)
  const rawFiltered = [...barangayFolders]
    .sort((a, b) => b.count - a.count || a.barangay.localeCompare(b.barangay))
    .filter(f => {
      if (isLeaderOrCoLeader && userBarangay) {
        if (f.barangay.trim().toLowerCase() !== userBarangay.trim().toLowerCase()) {
          return false;
        }
      }
      // Server-side has already filtered the folders list based on the search term (including contact names).
      return true;
    });

  const filteredFolders = (isLeaderOrCoLeader && userBarangay && rawFiltered.length === 0)
    ? [{ barangay: userBarangay, count: total, purokCount: allPuroks.length, geotaggedCount: contacts.filter(c => c.geotagged).length }]
    : rawFiltered;

  const maxHouseholds = Math.max(...barangayFolders.map(f => f.count), 1);
  const maxPuroks = Math.max(...barangayFolders.map(f => f.purokCount), 1);

  return (
    <div className="space-y-6">
      {/* View Switcher Breadcrumb Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {activeFolder || activePurokFolder ? (
            <button
              onClick={() => {
                if (activeFolder) {
                  setActiveFolder(null);
                  setAddressFilter(isLeaderOrCoLeader && userBarangay ? userBarangay : 'All Barangays');
                } else {
                  handleSetActivePurokFolder(null);
                }
              }}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to {folderGrouping === 'barangay' ? 'Barangay' : 'Purok'} Folders
            </button>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Folder className="w-5 h-5 text-emerald-700" />
            </div>
          )}

          <div>
            <h2 className="text-lg font-extrabold text-slate-800 font-display flex items-center gap-2">
              {activeFolder ? (
                <>
                  <FolderOpen className="w-5 h-5 text-emerald-600" />
                  {activeFolder} Folder
                </>
              ) : activePurokFolder ? (
                <>
                  <FolderOpen className="w-5 h-5 text-emerald-600" />
                  Purok {formatPurokName(activePurokFolder)} Folder
                </>
              ) : (
                `Saint Francis Clinic Directory (${folderGrouping === 'barangay' ? 'Barangay' : 'Purok'} Folders)`
              )}
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {activeFolder
                ? `Showing member records stored inside ${activeFolder}`
                : activePurokFolder
                  ? `Showing member records stored inside Purok ${formatPurokName(activePurokFolder)}`
                  : isLeaderOrCoLeader && userBarangay && folderGrouping === 'barangay'
                    ? `Assigned Barangay Folder for ${currentUser?.role || 'Leader'}: ${userBarangay}`
                    : folderGrouping === 'barangay'
                      ? `Organized into ${barangayFolders.length} Barangay Folders (Highest Population First)`
                      : `Organized into ${purokFolders.length} Purok Folders (Highest Population First)`}
            </p>
          </div>
        </div>

        {/* Global Auto Sync Badge & Controls */}
        <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
          {/* Folders Grouping Mode Selector Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold gap-1 shadow-inner">
            <button
              onClick={() => {
                setFolderGrouping('barangay');
                setActiveFolder(null);
                handleSetActivePurokFolder(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                folderGrouping === 'barangay'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/40'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Barangay</span>
            </button>
            <button
              onClick={() => {
                setFolderGrouping('purok');
                setActiveFolder(null);
                handleSetActivePurokFolder(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                folderGrouping === 'purok'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/40'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Purok</span>
            </button>
          </div>

          <button
            onClick={handleSyncSheets}
            disabled={syncingSheets || loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
            title="Refresh and sync live data from cPanel MySQL Database"
          >
            {syncingSheets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-emerald-200" />}
            {syncingSheets ? 'Refreshing...' : 'Sync Database ↻'}
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: BARANGAY FOLDERS OVERVIEW GRID */}
      {!activeFolder && !activePurokFolder && folderGrouping === 'barangay' && (
        <div className="space-y-6">
          {/* Barangay Summary & Analytics Panel */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200/50 shadow-inner">
                  <BarChart3 className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 font-display">
                    Barangay Summary Analytics
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Overview of members and puroks across all folders
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                <div className="flex flex-wrap items-center bg-slate-50 p-1 rounded-xl border border-slate-200/60 text-xs gap-1 justify-center sm:justify-start">
                  <button
                    onClick={() => setChartMetric('all')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      chartMetric === 'all'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/40'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Metrics
                  </button>
                  <button
                    onClick={() => setChartMetric('households')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      chartMetric === 'households'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/40'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Members
                  </button>
                  <button
                    onClick={() => setChartMetric('puroks')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      chartMetric === 'puroks'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/40'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Puroks
                  </button>
                </div>

                <button
                  onClick={() => setIsChartExpanded(!isChartExpanded)}
                  className="py-2 px-3 sm:p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 sm:gap-0"
                  title={isChartExpanded ? 'Collapse Analytics' : 'Expand Analytics'}
                >
                  <span className="inline sm:hidden text-xs font-bold text-slate-600">
                    {isChartExpanded ? 'Hide Analytics' : 'Show Analytics'}
                  </span>
                  {isChartExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {isChartExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {(() => {
                    const isSearchFiltered = Boolean(debouncedFolderSearch.trim());
                    const displayFolders = isSearchFiltered 
                      ? barangayFolders 
                      : (overallBarangayFolders.length > 0 ? overallBarangayFolders : barangayFolders);
                    const totalBarangaysCount = displayFolders.length;
                    const totalPuroksCount = displayFolders.reduce((sum, f) => sum + (f.purokCount || 0), 0);
                    const totalMembersCount = isSearchFiltered ? total : displayFolders.reduce((sum, f) => sum + f.count, 0);

                    return (
                      <>
                        {/* Executive Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {isSearchFiltered ? 'Matching Barangays' : 'Total Barangays'}
                              </p>
                              {isSearchFiltered && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                                  Search Result
                                </span>
                              )}
                            </div>
                            <p className="text-2xl font-extrabold text-slate-800 font-display mt-1">
                              {totalBarangaysCount}
                              <span className="text-slate-400 text-sm font-semibold ml-0.5">
                                /{totalPuroksCount}
                              </span>
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {isSearchFiltered ? `Matching folders & puroks for "${folderSearch.trim()}"` : 'Active folders & puroks'}
                            </p>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {isSearchFiltered ? 'Matching Members' : 'Total Members'}
                              </p>
                              {isSearchFiltered && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                                  Search Result
                                </span>
                              )}
                            </div>
                            <p className="text-2xl font-extrabold text-slate-800 font-display mt-1">
                              {totalMembersCount}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {isSearchFiltered ? `Members found matching "${folderSearch.trim()}"` : 'Across all folders'}
                            </p>
                          </div>
                        </div>

                        {/* Ultra-compact Barangay Folders Summary list with no progress bars */}
                        <div className="mt-5 w-full bg-slate-50/30 rounded-2xl border border-slate-100 p-3 sm:p-4">
                          {loading && displayFolders.length === 0 ? (
                            <div className="h-[120px] flex flex-col items-center justify-center gap-2">
                              <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                              <p className="text-xs text-slate-400 font-bold">Populating analytical data...</p>
                            </div>
                          ) : displayFolders.length === 0 ? (
                            <div className="h-[90px] flex flex-col items-center justify-center gap-1.5 text-center text-slate-500 py-3">
                              <SearchX className="w-5 h-5 text-slate-400" />
                              <p className="text-xs font-bold text-slate-600">
                                {isSearchFiltered ? `No barangays match "${folderSearch.trim()}"` : 'No barangays available'}
                              </p>
                              {isSearchFiltered && (
                                <button
                                  onClick={() => setFolderSearch('')}
                                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                                >
                                  Clear search to view all barangay analytics
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                              {[...displayFolders].sort((a, b) => b.count - a.count || a.barangay.localeCompare(b.barangay)).map((f) => (
                                <div 
                                  key={f.barangay} 
                                  className="flex items-center px-3 py-3 bg-white border border-slate-100 rounded-xl shadow-2xs hover:border-emerald-200/40 hover:shadow-xs transition-all h-[52px]"
                                >
                                  <div className="flex flex-col min-w-0 gap-1 w-full">
                                    <span className="font-extrabold text-slate-700 text-xs truncate" title={f.barangay}>
                                      {f.barangay}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[9px] font-black tracking-wide leading-none">
                                      {(chartMetric === 'all' || chartMetric === 'households') && (
                                        <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded-sm border border-emerald-100/50" title={`${f.count} Members`}>
                                          {f.count} M
                                        </span>
                                      )}
                                      {(chartMetric === 'all' || chartMetric === 'puroks') && (
                                        <span className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded-sm border border-amber-100/50" title={`${f.purokCount} Puroks`}>
                                          {f.purokCount} P
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Folders Search & Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative w-full md:max-w-xs lg:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                placeholder="Search Barangay Folder name or contact name..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
              {folderSearch && (
                <button
                  onClick={() => setFolderSearch('')}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-row flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-3">
                {/* Barangay Quick Select Dropdown fetched from Google Sheet database */}
                <div className="relative min-w-[150px]">
                  <select
                    value={addressFilter === 'All Addresses' ? 'All Barangays' : addressFilter}
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected === 'All Barangays') {
                        setActiveFolder(null);
                        setAddressFilter('All Barangays');
                      } else {
                        openFolder(selected);
                      }
                    }}
                    className="w-full appearance-none pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl transition-all text-slate-700 font-semibold text-xs outline-none cursor-pointer"
                  >
                    <option value="All Barangays">All Barangays (Sheet)</option>
                    {(allAddresses || []).map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-500 flex items-center gap-2 shrink-0">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>{filteredFolders.length} Folders</span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => handleOpenDesignateModal()}
                  className="px-3.5 py-2.5 sm:py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0 ml-auto md:ml-0"
                  title="Select a designated barangay and make it available to assigned user accounts"
                >
                  <UserCheck className="w-4 h-4 text-emerald-200" />
                  <span>Designate Barangay to Accounts</span>
                </button>
              )}
            </div>
          </div>

          {/* Direct Matching Contacts list when search term is entered */}
          {debouncedFolderSearch.trim() !== '' && contacts.length > 0 && (
            <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800">
                    Matching Contacts Found ({total})
                  </h4>
                </div>
                <span className="text-xs text-slate-400 font-medium">Click any contact to view details or open their folder</span>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/70 overflow-hidden">
                {contacts.map((contact) => {
                  const isLocked = isContactLocked(contact);
                  return (
                    <div
                      key={contact.id}
                      onClick={() => setViewContact(contact)}
                      className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                        isLocked ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full ${
                          isLocked ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700'
                        } font-bold text-xs flex items-center justify-center shrink-0`}>
                          {isLocked ? <Lock className="w-3.5 h-3.5" /> : (contact.full_name?.charAt(0)?.toUpperCase() || '?')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-800 truncate">{contact.full_name}</span>
                            {isLocked && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Submitted &amp; Locked
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                            <span className="font-bold text-emerald-700">{contact.barangay || 'No Barangay'}</span>
                            <span>•</span>
                            <span className="font-medium text-slate-600">{contact.purok || 'No Purok'}</span>
                            {contact.contact_number && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-slate-600">{contact.contact_number}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                        {contact.barangay && (
                          <button
                            onClick={() => {
                              openFolder(contact.barangay!);
                              setHighlightedContactId(contact.id);
                            }}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            title={`Open Barangay ${contact.barangay} folder`}
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Open Folder</span>
                          </button>
                        )}
                        <button
                          onClick={() => setViewContact(contact)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        {!isLocked && (
                          <button
                            onClick={() => onEdit(contact)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Barangay Folders Cards Grid */}
          {filteredFolders.length > 0 && (
            <div className="space-y-2">
              {debouncedFolderSearch.trim() !== '' && (
                <div className="flex items-center gap-2 px-1 pt-2">
                  <Folder className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                    Matching Barangay Folders ({filteredFolders.length})
                  </h4>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-2">
                {filteredFolders.map((folder) => {
                  const assignedAccounts = userAccounts.filter(
                    u => u.barangay && u.barangay.trim().toLowerCase() === folder.barangay.trim().toLowerCase()
                  );
                  const assignedCount = assignedAccounts.length;
                  const isUserDesignated = userBarangay && userBarangay.trim().toLowerCase() === folder.barangay.trim().toLowerCase();
                  const isHighlighted = lastOpenedBarangay === folder.barangay;
                  
                  return (
                    <motion.div
                      key={folder.barangay}
                      whileHover={{ y: -2, transition: { duration: 0.12 } }}
                      onClick={() => openFolder(folder.barangay)}
                      className="relative cursor-pointer group flex flex-col h-full min-h-[110px] w-full select-none"
                    >
                      {/* Physical Folder Body */}
                      <div className={`flex-1 rounded-xl shadow-2xs group-hover:shadow-xs group-hover:border-emerald-300 transition-all duration-300 p-3 flex flex-col justify-between relative overflow-hidden z-0 ${
                        isHighlighted
                          ? 'folder-highlight-active bg-emerald-50/25 border-emerald-500 shadow-md scale-[1.015]'
                          : 'bg-amber-50/10 hover:bg-amber-50/25 border border-amber-300/40'
                      }`}>
                        {/* Barangay Details */}
                        <div className="space-y-2">
                          <h3 className={`text-sm font-extrabold font-display transition-colors truncate ${
                            isHighlighted
                              ? 'text-emerald-900 group-hover:text-emerald-800'
                              : 'text-slate-800 group-hover:text-emerald-800'
                          }`}>
                            {folder.barangay}
                          </h3>
                          
                          {/* Count Badge matching the user's uploaded image */}
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border rounded-full text-[11px] font-bold w-fit bg-emerald-50/80 border-emerald-200/60 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block shrink-0"></span>
                            <span>{folder.count} {folder.count === 1 ? 'Contact' : 'Contacts'}</span>
                          </div>
                        </div>

                        {/* Folder Action Bar */}
                        {isAdmin && (
                          <div className="mt-2 pt-1.5 border-t border-amber-200/20 group-hover:border-emerald-200/20 flex items-center justify-end z-10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteFolderTarget(folder.barangay);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title={`Delete folder ${folder.barangay} & all its members`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty Search / No Records State */}
          {filteredFolders.length === 0 && contacts.length === 0 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-12 text-center shadow-xs max-w-xl mx-auto my-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mx-auto mb-3.5">
                <UserX className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-800">
                {debouncedFolderSearch.trim()
                  ? `No records found for "${folderSearch.trim()}"`
                  : 'No Barangay Folders Available'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                {debouncedFolderSearch.trim()
                  ? `"${folderSearch.trim()}" is not registered in any Barangay folder. You can add them as a new member right now.`
                  : 'Get started by creating your first folder or importing member records.'}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-6">
                {debouncedFolderSearch.trim() && (
                  <button
                    onClick={() => {
                      if (onAddNewContact) {
                        onAddNewContact(folderSearch.trim());
                      } else {
                        onEdit({
                          id: '',
                          full_name: folderSearch.trim(),
                          barangay: availableBarangays[0] || '',
                          purok: '',
                          contact_number: '',
                          status: 'AVAILABLE',
                          created_at: new Date().toISOString()
                        });
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-200" />
                    <span>+ Add "{folderSearch.trim()}" as New Member</span>
                  </button>
                )}
                {debouncedFolderSearch.trim() && (
                  <button
                    onClick={() => setFolderSearch('')}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Search</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 1-B: PUROK FOLDERS OVERVIEW GRID */}
      {!activeFolder && !activePurokFolder && folderGrouping === 'purok' && (
        <div className="space-y-6">
          {/* Associated Barangay Filter Alert badge */}
          {associatedBarangayForPuroks && (
            <div className="bg-emerald-50/75 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 border border-emerald-200">
                  <Folder className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-950">
                    Showing Puroks Associated with: {associatedBarangayForPuroks}
                  </h4>
                  <p className="text-xs text-emerald-700 font-semibold">
                    Displaying only the Purok folders containing members registered within this Barangay folder.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssociatedBarangayForPuroks(null)}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer hover:border-emerald-300"
              >
                Show All Purok Folders
              </button>
            </div>
          )}


          {/* Purok Folders Search & Toolbar */}
          <div className="space-y-2">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={purokSearch}
                  onChange={(e) => setPurokSearch(e.target.value)}
                  placeholder="Search Purok Folder name or contact name..."
                  className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
                {purokSearch && (
                  <button
                    onClick={() => setPurokSearch('')}
                    className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>{filteredPurokFolders.length} Purok Folders</span>
                </div>
              </div>
            </div>

            {associatedBarangayForPuroks && (
              <div className="flex items-center gap-2 px-1 pb-1">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[10px] uppercase font-black tracking-wider">
                  Associated Barangay:
                </span>
                <span className="text-sm font-black text-slate-800">{associatedBarangayForPuroks}</span>
              </div>
            )}
          </div>

          {/* Direct Matching Contacts list when search term is entered */}
          {debouncedPurokSearch.trim() !== '' && contacts.length > 0 && (
            <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800">
                    Matching Contacts Found ({total})
                  </h4>
                </div>
                <span className="text-xs text-slate-400 font-medium">Click any contact to view details or open their purok folder</span>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/70 overflow-hidden">
                {contacts.map((contact) => {
                  const isLocked = isContactLocked(contact);
                  return (
                    <div
                      key={contact.id}
                      onClick={() => setViewContact(contact)}
                      className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                        isLocked ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full ${
                          isLocked ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700'
                        } font-bold text-xs flex items-center justify-center shrink-0`}>
                          {isLocked ? <Lock className="w-3.5 h-3.5" /> : (contact.full_name?.charAt(0)?.toUpperCase() || '?')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-800 truncate">{contact.full_name}</span>
                            {isLocked && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Submitted &amp; Locked
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                            <span className="font-bold text-emerald-700">{contact.barangay || 'No Barangay'}</span>
                            <span>•</span>
                            <span className="font-medium text-slate-600">{contact.purok || 'No Purok'}</span>
                            {contact.contact_number && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-slate-600">{contact.contact_number}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                        {contact.purok && (
                          <button
                            onClick={() => {
                              handleSetActivePurokFolder(contact.purok!);
                              setHighlightedContactId(contact.id);
                            }}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            title={`Open Purok ${contact.purok} folder`}
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Open Folder</span>
                          </button>
                        )}
                        <button
                          onClick={() => setViewContact(contact)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        {!isLocked && (
                          <button
                            onClick={() => onEdit(contact)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Purok Folders Cards Grid arranged by highest population */}
          {filteredPurokFolders.length > 0 && (
            <div className="space-y-2">
              {debouncedPurokSearch.trim() !== '' && (
                <div className="flex items-center gap-2 px-1 pt-2">
                  <Folder className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                    Matching Purok Folders ({filteredPurokFolders.length})
                  </h4>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pt-2">
                {filteredPurokFolders
                  .sort((a, b) => b.count - a.count || a.purok.localeCompare(b.purok))
                  .map((folder) => {
                    const isHighlighted = lastOpenedPurok === folder.purok;
                    return (
                      <motion.div
                        key={folder.purok}
                        whileHover={{ y: -2, transition: { duration: 0.12 } }}
                        onClick={() => handleSetActivePurokFolder(folder.purok)}
                        className="relative cursor-pointer group flex flex-col h-full min-h-[110px] w-full select-none"
                      >
                        {/* Physical Folder Body */}
                        <div className={`flex-1 rounded-xl shadow-2xs group-hover:shadow-xs group-hover:border-emerald-300 transition-all duration-300 p-3.5 flex flex-col justify-between relative overflow-hidden z-0 ${
                          isHighlighted
                            ? 'folder-highlight-active bg-emerald-50/25 border-emerald-500 shadow-md scale-[1.015]'
                            : 'bg-amber-50/10 hover:bg-amber-50/25 border border-amber-300/40'
                        }`}>
                          {/* Purok Details */}
                          <div className="space-y-2">
                            <h3 className={`text-sm font-extrabold font-display transition-colors truncate ${
                              isHighlighted
                                ? 'text-emerald-900 group-hover:text-emerald-800'
                                : 'text-slate-800 group-hover:text-emerald-800'
                            }`}>
                              {formatPurokName(folder.purok)}
                            </h3>
                            
                            {/* Count Badge matching the user's uploaded image */}
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border rounded-full text-[11px] font-bold w-fit bg-emerald-50/80 border-emerald-200/60 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block shrink-0"></span>
                              <span>{folder.count} {folder.count === 1 ? 'Contact' : 'Contacts'}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Empty Search / No Purok Records State */}
          {filteredPurokFolders.length === 0 && contacts.length === 0 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-12 text-center shadow-xs max-w-xl mx-auto my-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mx-auto mb-3.5">
                <UserX className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-800">
                {debouncedPurokSearch.trim()
                  ? `No records found for "${purokSearch.trim()}"`
                  : 'No Purok Folders Available'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                {debouncedPurokSearch.trim()
                  ? `"${purokSearch.trim()}" does not match any registered member or Purok folder name. You can add them as a new member now.`
                  : 'Get started by creating your first folder or importing member records.'}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-6">
                {debouncedPurokSearch.trim() && (
                  <button
                    onClick={() => {
                      if (onAddNewContact) {
                        onAddNewContact(purokSearch.trim());
                      } else {
                        onEdit({
                          id: '',
                          full_name: purokSearch.trim(),
                          barangay: associatedBarangayForPuroks || availableBarangays[0] || '',
                          purok: '',
                          contact_number: '',
                          status: 'AVAILABLE',
                          created_at: new Date().toISOString()
                        });
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-200" />
                    <span>+ Add "{purokSearch.trim()}" as New Member</span>
                  </button>
                )}
                {debouncedPurokSearch.trim() && (
                  <button
                    onClick={() => setPurokSearch('')}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Search</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: INDIVIDUAL FOLDER HOUSEHOLD RECORDS TABLE */}
      {(activeFolder || activePurokFolder) && (
        <div className="space-y-4 sm:space-y-6">
          {/* Search & Purok Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row gap-3 sm:gap-4 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full lg:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400 min-h-[42px]"
                placeholder={`Search inside ${activeFolder || activePurokFolder}...`}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdown + Export buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
              {/* Barangay Dropdown */}
              <div className="relative w-full sm:w-auto min-w-[160px]">
                <select
                  value={addressFilter === 'All Addresses' ? 'All Barangays' : addressFilter}
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (selected === 'All Barangays') {
                      if (activeFolder) {
                        setActiveFolder(null);
                      }
                      setAddressFilter('All Barangays');
                    } else {
                      if (activeFolder) {
                        openFolder(selected);
                      } else {
                        setAddressFilter(selected);
                      }
                    }
                  }}
                  className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl transition-all text-slate-700 font-semibold text-xs sm:text-sm outline-none cursor-pointer min-h-[42px]"
                >
                  <option value="All Barangays">All Barangays</option>
                  {(allAddresses || []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* Purok Dropdown (Only show if viewing a Barangay folder; hidden if already inside a Purok folder) */}
              {!activePurokFolder && (
                <div className="relative w-full sm:w-auto min-w-[140px]">
                  <select
                    value={purokFilter}
                    onChange={(e) => setPurokFilter(e.target.value)}
                    className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl transition-all text-slate-700 font-semibold text-xs sm:text-sm outline-none cursor-pointer min-h-[42px]"
                  >
                    <option value="All Puroks">All Puroks</option>
                    {(allPuroks || []).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              )}

              {/* Export Controls for this specific folder */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleExportPDF(activeFolder || undefined, activePurokFolder || undefined)}
                  disabled={exporting !== null || loading}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px]"
                  title="Export formatted report to PDF document"
                >
                  {exporting?.startsWith('PDF') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Export PDF
                </button>
                {isAdmin && activeFolder && (
                  <button
                    onClick={() => setDeleteFolderTarget(activeFolder)}
                    className="col-span-2 sm:col-span-1 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px]"
                    title={`Delete folder "${activeFolder}" & all its members`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Folder
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Directory Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs relative">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 select-none">
                  <tr>
                    <th className="py-4 px-5 w-14 text-center">#</th>
                    
                    <th
                      onClick={() => handleSort('name')}
                      className="py-4 px-5 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Full Name
                        {sortBy === 'name' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-600" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-300 opacity-60" />
                        )}
                      </div>
                    </th>

                    <th className="py-4 px-5">Barangay</th>
                    <th className="py-4 px-5">Purok</th>
                    <th className="py-4 px-5">Contact Number</th>

                    <th
                      onClick={() => handleSort('date')}
                      className="py-4 px-5 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Date Added
                        {sortBy === 'date' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-600" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-300 opacity-60" />
                        )}
                      </div>
                    </th>

                    <th className="py-4 px-5 text-center w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm relative">
                  {loading && contacts.length === 0 ? (
                    [1, 2, 3, 4].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-4 px-5 text-center"><div className="h-4 bg-slate-100 rounded w-6 mx-auto" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-44" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-36" /></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                        <td className="py-4 px-5"><div className="h-8 bg-slate-100 rounded-lg w-28 mx-auto" /></td>
                      </tr>
                    ))
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 px-5 text-center text-slate-400">
                        <Folder className="w-10 h-10 mb-3 mx-auto text-slate-300" />
                        <p className="font-semibold text-slate-600">No member records stored in this Barangay folder.</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try clearing search filters or add a new record.</p>
                      </td>
                    </tr>
                  ) : (
                    contacts.map((contact, index) => {
                      const itemIndex = (page - 1) * limit + index + 1;
                      const isHighlighted = highlightedContactId === contact.id;
                      const isLocked = isContactLocked(contact);
                      return (
                        <tr 
                          key={contact.id} 
                          onClick={() => handleRowOrCardClick(contact)}
                          className={`${
                            isLocked
                              ? isHighlighted
                                ? 'bg-emerald-200/95 border-l-4 border-l-emerald-700 font-bold text-emerald-950 shadow-md ring-2 ring-emerald-500/50'
                                : 'bg-emerald-100/85 hover:bg-emerald-200/85 text-emerald-950 border-l-4 border-l-emerald-600 shadow-xs ring-1 ring-emerald-400/40'
                              : isHighlighted 
                                ? 'bg-amber-100/90 border-l-4 border-l-amber-500 font-bold hover:bg-amber-200/90 text-amber-950 shadow-sm ring-1 ring-amber-500/10' 
                                : 'hover:bg-slate-50/80'
                          } transition-all duration-150 cursor-pointer border-b border-slate-100/75`}
                        >
                          <td className={`py-3.5 px-5 text-center text-xs font-bold ${isLocked ? 'text-emerald-900 font-black' : 'text-slate-400'}`}>
                            {itemIndex}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full ${
                                isLocked 
                                  ? 'bg-emerald-200 text-emerald-900 border-emerald-400 shadow-xs ring-2 ring-emerald-500/30' 
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              } font-extrabold text-xs flex items-center justify-center border shrink-0 overflow-hidden`}>
                                {isLocked ? (
                                  <Lock className="w-3.5 h-3.5 text-emerald-800" />
                                ) : contact.photo_url ? (
                                  <img src={contact.photo_url} alt={contact.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  contact.full_name.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={isLocked ? 'text-emerald-950 font-black' : 'text-slate-800'}>{contact.full_name}</span>
                                {isLocked && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-950 text-[10px] font-black uppercase tracking-wider border border-emerald-400 shadow-2xs">
                                    <Lock className="w-2.5 h-2.5 text-emerald-800" />
                                    SUBMITTED &amp; LOCKED
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 font-semibold text-slate-700">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${
                              isLocked
                                ? 'bg-emerald-100/90 border border-emerald-300/90 text-emerald-900'
                                : 'bg-amber-50 border border-amber-200/60 text-amber-900'
                            }`}>
                              <Folder className={`w-3 h-3 ${isLocked ? 'text-emerald-700 fill-emerald-300' : 'text-amber-600 fill-amber-300'}`} />
                              {contact.barangay || 'Unassigned'}
                            </span>
                          </td>
                          <td className={`py-3.5 px-5 font-medium ${isLocked ? 'text-emerald-900 font-semibold' : 'text-slate-600'}`}>
                            {contact.purok || '-'}
                          </td>
                          <td className={`py-3.5 px-5 font-mono text-xs ${isLocked ? 'text-emerald-900 font-semibold' : 'text-slate-600'}`}>
                            <div className="flex items-center gap-1.5">
                              <Phone className={`w-3 h-3 ${isLocked ? 'text-emerald-600' : 'text-slate-400'}`} />
                              {contact.contact_number}
                            </div>
                          </td>
                          <td className={`py-3.5 px-5 text-xs font-medium ${isLocked ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {formatDate(contact.created_at)}
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isLocked ? (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setAlreadySubmittedModalContact(contact); setHighlightedContactId(contact.id); }}
                                    className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-200/80 rounded-lg transition-colors cursor-pointer"
                                    title="Contact Submitted & Locked (Click to view details)"
                                  >
                                    <Lock className="w-4 h-4 text-emerald-700" />
                                  </button>
                                  <button
                                    disabled={true}
                                    onClick={(e) => { e.stopPropagation(); showToast('Locked contact cannot be edited.', 'info'); }}
                                    className="p-1.5 text-emerald-300/60 cursor-not-allowed rounded-lg"
                                    title="Locked record cannot be edited"
                                  >
                                    <Edit2 className="w-4 h-4 opacity-40" />
                                  </button>
                                  <button
                                    disabled={true}
                                    onClick={(e) => { e.stopPropagation(); showToast('Locked contact cannot be deleted.', 'info'); }}
                                    className="p-1.5 text-emerald-300/60 cursor-not-allowed rounded-lg"
                                    title="Locked record cannot be deleted"
                                  >
                                    <Trash2 className="w-4 h-4 opacity-40" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setViewContact(contact); }}
                                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                    title="View details & submit files"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
                                    className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit contact"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(contact); }}
                                    className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete record"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View for Mobile Responsiveness */}
            <div className="block md:hidden divide-y divide-slate-100">
              {loading && contacts.length === 0 ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="p-4 space-y-3 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-1/2" />
                        <div className="h-3 bg-slate-100 rounded w-1/3" />
                      </div>
                    </div>
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                ))
              ) : contacts.length === 0 ? (
                <div className="py-10 px-4 text-center text-slate-400">
                  <Folder className="w-10 h-10 mb-3 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-600 text-sm">No member records found.</p>
                </div>
              ) : (
                contacts.map((contact, index) => {
                  const itemIndex = (page - 1) * limit + index + 1;
                  const isHighlighted = highlightedContactId === contact.id;
                  const isLocked = isContactLocked(contact);
                  return (
                    <div 
                      key={contact.id} 
                      onClick={() => handleRowOrCardClick(contact)}
                      className={`${
                        isLocked
                          ? isHighlighted
                            ? 'bg-emerald-200/95 border-l-4 border-l-emerald-700 font-bold text-emerald-950 shadow-md ring-2 ring-emerald-500/50'
                            : 'bg-emerald-100/85 hover:bg-emerald-200/85 text-emerald-950 border-l-4 border-l-emerald-600 shadow-xs ring-1 ring-emerald-400/40'
                          : isHighlighted 
                            ? 'bg-amber-100/90 border-l-4 border-l-amber-500 font-bold hover:bg-amber-200/90 text-amber-950 shadow-sm ring-1 ring-amber-500/10' 
                            : 'hover:bg-slate-50/50'
                      } p-4 space-y-3 transition-colors cursor-pointer border-b border-slate-100/75`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-9 h-9 rounded-full ${
                            isLocked 
                              ? 'bg-emerald-200 text-emerald-900 border-emerald-400 shadow-xs ring-2 ring-emerald-500/30' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          } font-extrabold text-xs flex items-center justify-center border shrink-0 overflow-hidden`}>
                            {isLocked ? (
                              <Lock className="w-3.5 h-3.5 text-emerald-800" />
                            ) : contact.photo_url ? (
                              <img src={contact.photo_url} alt={contact.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              contact.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className={`text-sm block truncate flex items-center gap-1.5 flex-wrap ${
                              isLocked ? 'font-black text-emerald-950' : 'font-bold text-slate-800'
                            }`}>
                              {contact.full_name}
                              {isLocked ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-950 text-[10px] font-black uppercase tracking-wider border border-emerald-400 shrink-0 shadow-2xs">
                                  <Lock className="w-2.5 h-2.5 text-emerald-800" /> SUBMITTED &amp; LOCKED
                                </span>
                              ) : contact.pcu_file_url ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 text-[9px] font-bold shrink-0">
                                  <Check className="w-2.5 h-2.5" /> PCU
                                </span>
                              ) : null}
                            </span>
                            <span className={`text-[11px] font-semibold block ${isLocked ? 'text-emerald-800' : 'text-slate-400'}`}>{formatDate(contact.created_at)}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${isLocked ? 'bg-emerald-200 text-emerald-950 border border-emerald-400/60 font-black' : 'text-slate-400 bg-slate-100'}`}>
                          #{itemIndex}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold ${
                          isLocked 
                            ? 'bg-emerald-100/90 border border-emerald-300/90 text-emerald-900' 
                            : 'bg-amber-50 border border-amber-200/40 text-amber-900'
                        }`}>
                          <Folder className={`w-3 h-3 ${isLocked ? 'text-emerald-700 fill-emerald-300' : 'text-amber-600 fill-amber-300'}`} />
                          {contact.barangay || 'Unassigned'}
                        </span>
                        {contact.purok && (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-semibold ${
                            isLocked ? 'bg-emerald-100/60 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            Purok {contact.purok}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                        <span className={`font-mono text-xs flex items-center gap-1.5 ${isLocked ? 'text-emerald-900 font-semibold' : 'text-slate-500'}`}>
                          <Phone className={`w-3 h-3 ${isLocked ? 'text-emerald-600' : 'text-slate-400'}`} />
                          {contact.contact_number || 'N/A'}
                        </span>

                        <div className="flex items-center gap-1">
                          {isLocked ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setAlreadySubmittedModalContact(contact); setHighlightedContactId(contact.id); }}
                                className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-200/80 rounded-lg transition-colors cursor-pointer"
                                title="Contact Submitted & Locked (Click to view details)"
                              >
                                <Lock className="w-4 h-4 text-emerald-700" />
                              </button>
                              <button
                                disabled={true}
                                onClick={(e) => { e.stopPropagation(); showToast('Locked contact cannot be edited.', 'info'); }}
                                className="p-1.5 text-emerald-300/60 cursor-not-allowed rounded-lg"
                                title="Locked record cannot be edited"
                              >
                                <Edit2 className="w-4 h-4 opacity-40" />
                              </button>
                              <button
                                disabled={true}
                                onClick={(e) => { e.stopPropagation(); showToast('Locked contact cannot be deleted.', 'info'); }}
                                className="p-1.5 text-emerald-300/60 cursor-not-allowed rounded-lg"
                                title="Locked record cannot be deleted"
                              >
                                <Trash2 className="w-4 h-4 opacity-40" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setViewContact(contact); }}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="View details & submit files"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
                                className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit contact"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(contact); }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-slate-500">
                  Showing Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong> ({total} total records)
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-white text-slate-700 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-white text-slate-700 transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: View Contact Details */}
      <AnimatePresence>
        {viewContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 relative max-h-[95vh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl overflow-hidden border border-emerald-200/60 shadow-inner shrink-0">
                    {viewContact.photo_url ? (
                      <img src={viewContact.photo_url} alt={viewContact.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      viewContact.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 font-display">
                      {isEditingContactInModal ? 'Edit Member Record' : viewContact.full_name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isEditingContactInModal ? 'Update Barangay, Purok, Contact & GPS coordinates' : 'Directory Member Record Details'}
                    </p>
                  </div>
                </div>
                {!isEditingContactInModal && (
                  <button
                    onClick={() => setIsEditingContactInModal(true)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-indigo-100"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Info
                  </button>
                )}
              </div>

              {isEditingContactInModal ? (
                /* EDIT FORM VIEW */
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                    <input
                      type="text"
                      value={modalEditFullName}
                      onChange={(e) => setModalEditFullName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-semibold text-slate-700 text-xs transition-all"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Barangay</label>
                      <select
                        value={modalEditBarangay}
                        onChange={(e) => setModalEditBarangay(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-semibold text-slate-700 text-xs cursor-pointer transition-all"
                      >
                        <option value="">Select Barangay</option>
                        {allAddresses.filter(a => a && a !== 'All Barangays').map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Purok</label>
                      <input
                        type="text"
                        value={modalEditPurok}
                        onChange={(e) => setModalEditPurok(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-semibold text-slate-700 text-xs transition-all"
                        placeholder="e.g. Purok 1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Number</label>
                    <input
                      type="text"
                      value={modalEditContactNumber}
                      onChange={(e) => setModalEditContactNumber(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-semibold text-slate-700 text-xs transition-all"
                      placeholder="e.g. 09123456789"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      onClick={() => setIsEditingContactInModal(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveContactFromModal}
                      disabled={modalIsSaving}
                      className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px]"
                    >
                      {modalIsSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* READ-ONLY INFORMATION VIEW WITH MANDATORY BARANGAY & PUROK */
                (() => {
                  const currentModalBarangay = (modalEditBarangay || viewContact.barangay || '').trim();
                  const isBarangayMissingInitially = !viewContact.barangay || 
                    viewContact.barangay.trim() === '' || 
                    viewContact.barangay.trim().toLowerCase() === 'not specified' || 
                    viewContact.barangay.trim().toLowerCase() === 'no address' || 
                    viewContact.barangay.trim().toLowerCase() === 'all addresses';

                  const hasModalBarangay = currentModalBarangay !== '' && 
                    currentModalBarangay.toLowerCase() !== 'not specified' && 
                    currentModalBarangay.toLowerCase() !== 'no address' && 
                    currentModalBarangay.toLowerCase() !== 'all addresses';

                  const currentModalPurok = (modalEditPurok || viewContact.purok || '').trim();
                  const hasModalPurok = currentModalPurok !== '' && currentModalPurok.toLowerCase() !== 'not specified';

                  const canSubmitFiles = hasModalBarangay && hasModalPurok;

                  const missingRequirements = [
                    !hasModalBarangay && 'Barangay',
                    !hasModalPurok && 'Purok'
                  ].filter(Boolean) as string[];

                  return (
                    <>
                      <div className="space-y-3 text-sm">
                        {/* Barangay - Dropdown if empty, else static display */}
                        {isBarangayMissingInitially ? (
                          <div className="p-3 bg-slate-50 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                              Barangay <span className="text-red-500 font-bold">*</span>
                            </span>
                            <select
                              value={modalEditBarangay}
                              onChange={(e) => setModalEditBarangay(e.target.value)}
                              className="w-full sm:w-64 px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-800 shadow-xs cursor-pointer"
                            >
                              <option value="">-- Select Barangay * --</option>
                              {availableBarangays.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase">Barangay</span>
                            <span className="font-bold text-slate-800 text-right">{currentModalBarangay}</span>
                          </div>
                        )}

                        {/* Purok Section - Required Text Box only */}
                        <div className="p-3 bg-slate-50 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                            Purok <span className="text-red-500 font-bold">*</span>
                          </span>
                          <input
                            type="text"
                            value={modalEditPurok}
                            onChange={(e) => setModalEditPurok(e.target.value)}
                            placeholder="Type Purok (e.g. Purok 1)..."
                            className="w-full sm:w-64 px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-800 placeholder-slate-400 shadow-xs"
                          />
                        </div>

                        {/* Contact Number */}
                        <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400 uppercase">Contact Number</span>
                          <span className="font-mono font-bold text-slate-800">{viewContact.contact_number}</span>
                        </div>

                        {/* Existing PCU File info if present */}
                        {viewContact.pcu_file_url && (
                          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1 shrink-0">
                              <Check className="w-3.5 h-3.5 text-blue-600 animate-pulse" /> PCU File Saved
                            </span>
                            {viewContact.pcu_file_url.startsWith('http') ? (
                              <a 
                                href={viewContact.pcu_file_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="font-bold text-blue-700 hover:underline text-xs truncate max-w-[150px] sm:max-w-[200px] flex items-center gap-1 cursor-pointer"
                                title="Click to view file"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileText className="w-3.5 h-3.5 shrink-0" /> View File
                              </a>
                            ) : (
                              <span className="font-semibold text-blue-900 text-xs truncate max-w-[150px] sm:max-w-[200px]" title={viewContact.pcu_file_url}>{viewContact.pcu_file_url}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Requirements Checklist Bar */}
                      <div className={`mt-4 p-3 rounded-2xl text-xs border transition-all ${
                        canSubmitFiles 
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                          : 'bg-amber-50/70 border-amber-200 text-amber-900'
                      }`}>
                        <div className="font-bold text-[11px] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span>File Submission Requirements</span>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            canSubmitFiles ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {canSubmitFiles ? 'Ready to Submit' : 'Action Required'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-semibold">
                          <div className="flex items-center gap-1.5">
                            {hasModalBarangay ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                            <span className={hasModalBarangay ? 'text-emerald-800' : 'text-amber-800'}>
                              Barangay: {hasModalBarangay ? currentModalBarangay : 'Required'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {hasModalPurok ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                            <span className={hasModalPurok ? 'text-emerald-800' : 'text-amber-800'}>
                              Purok: {hasModalPurok ? currentModalPurok : 'Required'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* File Upload Zone */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Upload Directory Files</h4>
                        
                        <div>
                          {/* Upload PCU Section */}
                          <label className={`flex flex-col items-center justify-center p-4 sm:p-5 border border-dashed rounded-2xl cursor-pointer transition-all text-center group w-full ${
                            isReadingFiles || pcuUploading
                              ? 'border-blue-400 bg-blue-50/20 pointer-events-none'
                              : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/10'
                          }`}>
                            <input 
                              type="file" 
                              multiple
                              onChange={handlePCUFileChange} 
                              disabled={pcuUploading || isReadingFiles} 
                              className="hidden" 
                            />
                            {isReadingFiles || pcuUploading ? (
                              <Loader2 className="w-5 h-5 text-blue-600 animate-spin mb-1.5" />
                            ) : (
                              <Upload className="w-5 h-5 text-slate-400 mb-1.5 group-hover:text-blue-600 transition-colors" />
                            )}
                            <span className="text-xs font-bold text-slate-700">
                              {isReadingFiles ? (readingFileProgress || 'Staging files...') : 'Select PCU Files'}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              Supports multiple files selection (no limit — 20+ files supported)
                            </span>
                          </label>
                        </div>

                        {/* Staged Files List */}
                        {stagedPcuFiles.length > 0 && (
                          <div className="space-y-2 mt-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                                  Staged for Upload ({stagedPcuFiles.length} {stagedPcuFiles.length === 1 ? 'file' : 'files'})
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100/70 text-emerald-800 font-semibold">
                                  {(stagedPcuFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setStagedPcuFiles([])}
                                disabled={pcuUploading}
                                className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer disabled:opacity-40"
                              >
                                Clear All
                              </button>
                            </div>

                            {stagedPcuFiles.length > 4 && (
                              <div className="p-2 bg-blue-50 border border-blue-200/80 rounded-xl text-[11px] text-blue-900 font-medium flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>Multi-file safe upload: {stagedPcuFiles.length} files will be uploaded in optimized batches ({Math.ceil(stagedPcuFiles.length / 4)} batches).</span>
                              </div>
                            )}

                            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-xl p-1 bg-slate-50/50">
                              {stagedPcuFiles.map((f, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-200/80 rounded-lg text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="text-[10px] font-bold text-slate-400 w-4">{idx + 1}.</span>
                                    <span className="font-medium text-slate-800 truncate font-mono text-[11px]" title={f.fileName}>
                                      {f.fileName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                    <span className="text-[10px] text-slate-500">
                                      {(f.size / 1024).toFixed(1)} KB
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeStagedPcuFile(idx)}
                                      disabled={pcuUploading}
                                      className="text-red-500 hover:text-red-700 font-bold px-1.5 py-0.5 rounded-md hover:bg-red-50 transition-all cursor-pointer disabled:opacity-40"
                                      title="Remove file"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={handlePCUSubmit}
                              disabled={pcuUploading || isReadingFiles}
                              className={`w-full mt-3 py-2.5 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px] flex items-center justify-center gap-2 shadow-sm font-display ${
                                canSubmitFiles
                                  ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
                                  : 'bg-amber-600 hover:bg-amber-700'
                              }`}
                            >
                              {pcuUploading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                  <span className="truncate">{uploadProgressText || 'Saving to Base44 DB...'}</span>
                                </>
                              ) : canSubmitFiles ? (
                                stagedPcuFiles.length > 20
                                  ? `Submit All ${stagedPcuFiles.length} PCU Files`
                                  : `Submit ${stagedPcuFiles.length > 1 ? `${stagedPcuFiles.length} Files` : 'File'}`
                              ) : (
                                `Submit (${missingRequirements.join(' & ')} Required)`
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="pt-5">
                        <button
                          onClick={() => setViewContact(null)}
                          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  );
                })()
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Contact Already Submitted & Locked */}
      <AnimatePresence>
        {alreadySubmittedModalContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 text-left shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto my-auto space-y-4"
            >
              <div className="flex items-center gap-3.5 pb-2 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">Contact Already Submitted</h3>
                  <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider border border-slate-300">
                    <Lock className="w-3 h-3 text-slate-600" />
                    PERMANENTLY LOCKED
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950">
                    This contact has already been submitted to the Base44 database and is permanently locked.
                  </p>
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    Re-submission is prevented to preserve database consistency. Staged uploads, file modifications, and editing for this record are strictly disabled.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Full Name</span>
                  <span className="font-bold text-slate-900">{alreadySubmittedModalContact.full_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Barangay</span>
                  <span className="font-semibold text-slate-800">{alreadySubmittedModalContact.barangay || 'Unassigned'}</span>
                </div>
                {alreadySubmittedModalContact.purok && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Purok</span>
                    <span className="font-semibold text-slate-800">{alreadySubmittedModalContact.purok}</span>
                  </div>
                )}
                {alreadySubmittedModalContact.contact_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Contact Number</span>
                    <span className="font-mono text-slate-800">{alreadySubmittedModalContact.contact_number}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Status</span>
                  <span className="font-extrabold text-slate-800">SUBMITTED (LOCKED)</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setAlreadySubmittedModalContact(null)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delete Confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 text-center shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto my-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 font-display">Delete Household Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to soft-delete <strong className="text-slate-700">{deleteTarget.full_name}</strong> from directory?
              </p>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Record'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delete Folder Confirmation */}
      <AnimatePresence>
        {deleteFolderTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 text-center shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto my-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 font-display">Delete Entire Folder?</h3>
              <p className="text-xs text-slate-500 mt-2">
                Are you sure you want to delete the entire <strong className="text-slate-800">Barangay {deleteFolderTarget}</strong> folder?
              </p>
              <p className="text-[11px] text-rose-600 font-bold mt-3 bg-rose-50 p-3 rounded-2xl border border-rose-100/65 leading-normal">
                ⚠️ This will soft-delete ALL member records associated with this Barangay folder from the clinic directory.
              </p>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => setDeleteFolderTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                  disabled={deletingFolder}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteFolderConfirm}
                  disabled={deletingFolder}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
                >
                  {deletingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Folder'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Designate Barangay Folder to Accounts & Automatic Data Transfer */}
      <AnimatePresence>
        {designateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col my-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 font-display">Designate Barangay Folder</h3>
                    <p className="text-xs text-slate-400 font-medium">Transfer folder data & assign account access</p>
                  </div>
                </div>
                <button
                  onClick={() => setDesignateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-left">
                {/* 1. Source / Previous Barangay Folder */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Previous / Source Barangay Folder (To Transfer From)
                  </label>
                  <select
                    value={sourceDesignateBarangay}
                    onChange={(e) => setSourceDesignateBarangay(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="">None (Do not transfer records from previous folder)</option>
                    {barangayFolders.map(f => (
                      <option key={f.barangay} value={f.barangay}>
                        {f.barangay} ({f.count} Members)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Select the existing folder whose data will automatically be transferred.
                  </p>
                </div>

                {/* 2. Target Designated Barangay Folder */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Selected / Target Designated Folder (Destination)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetDesignateBarangay}
                      onChange={(e) => setTargetDesignateBarangay(e.target.value)}
                      placeholder="e.g. Dampalan, Navalan, SAN JOSE..."
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                    <select
                      value={targetDesignateBarangay}
                      onChange={(e) => {
                        if (e.target.value) setTargetDesignateBarangay(e.target.value);
                      }}
                      className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[150px]"
                    >
                      <option value="">Select Existing</option>
                      {allAddresses.filter(a => a && a !== 'All Barangays').map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Enter or choose the designated Barangay name from Google Sheet database where all data will be moved.
                  </p>
                </div>

                {/* Data Transfer Notice Card */}
                {sourceDesignateBarangay && targetDesignateBarangay && sourceDesignateBarangay.trim().toLowerCase() !== targetDesignateBarangay.trim().toLowerCase() && (() => {
                  const srcFolder = barangayFolders.find(f => f.barangay.trim().toLowerCase() === sourceDesignateBarangay.trim().toLowerCase());
                  const recCount = srcFolder ? srcFolder.count : 0;

                  return (
                    <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl text-left space-y-1.5">
                      <div className="flex items-center gap-2 font-extrabold text-amber-900 text-xs">
                        <FolderOpen className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Automatic Data Transfer & Folder Removal</span>
                      </div>
                      <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        All <strong className="text-amber-950 font-extrabold">{recCount} member record(s)</strong> inside previous folder <strong className="text-amber-950">"{sourceDesignateBarangay}"</strong> will automatically be transferred to <strong className="text-emerald-900 font-extrabold">"{targetDesignateBarangay}"</strong>.
                      </p>
                      <div className="pt-1.5 border-t border-amber-200/70 text-[11px] text-amber-900 font-bold flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>The previous folder "{sourceDesignateBarangay}" will be emptied and automatically removed from Clinic Directory.</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Info panel showing accounts assigned to targetDesignateBarangay */}
                {(() => {
                  const matchingAccounts = userAccounts.filter(
                    u => u.barangay && u.barangay.trim().toLowerCase() === targetDesignateBarangay.trim().toLowerCase()
                  );

                  return (
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-emerald-700" />
                          Accounts Assigned to {targetDesignateBarangay || 'Selected Barangay'} ({matchingAccounts.length})
                        </label>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Automatic Access
                        </span>
                      </div>

                      {matchingAccounts.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {matchingAccounts.map((account) => (
                            <div
                              key={account.username}
                              className="p-2 bg-white rounded-xl border border-emerald-200/60 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-800">{account.fullName || account.username}</span>
                                <span className="text-slate-400 font-normal ml-1">(@{account.username})</span>
                              </div>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-extrabold text-[10px] rounded-md uppercase">
                                {account.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 font-medium italic p-1">
                          No user accounts are currently assigned to "{targetDesignateBarangay}". When accounts are assigned to this Barangay in Account Management, this folder will automatically be visible to them.
                        </p>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-emerald-200/60 text-[11px] font-medium text-emerald-800">
                        ✓ User accounts assigned to <strong>"{targetDesignateBarangay || 'Selected Barangay'}"</strong> will automatically view this folder and its contents.
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="pt-4 mt-2 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDesignateModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer min-h-[42px]"
                  disabled={savingDesignation}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDesignation}
                  disabled={savingDesignation}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
                >
                  {savingDesignation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : sourceDesignateBarangay && sourceDesignateBarangay.trim().toLowerCase() !== targetDesignateBarangay.trim().toLowerCase() ? (
                    'Transfer Data & Designate Folder'
                  ) : (
                    'Save Designated Folder'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
