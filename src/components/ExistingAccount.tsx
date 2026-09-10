import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder,
  FolderOpen,
  Search,
  MapPin,
  User as UserIcon,
  Phone,
  Calendar,
  Eye,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  X,
  UserCheck,
  Plus,
  RotateCw,
  PlusCircle,
  FileText,
  UploadCloud,
  Trash2,
  Paperclip,
  ExternalLink,
  File,
  Facebook,
  Navigation,
  Crosshair,
  Save,
  Check,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { ExistingAccountItem } from '../types.js';
import { BarangaySummaryAnalytics } from './BarangaySummaryAnalytics.js';

interface ExistingAccountProps {
  authToken: string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  activeTab?: 'existing-account' | 'exist-acc-files';
  currentUser?: { username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null;
}

export const ExistingAccount: React.FC<ExistingAccountProps> = ({
  authToken,
  showToast,
  activeTab = 'existing-account',
  currentUser = null
}) => {
  const userObj = currentUser || (() => {
    try {
      const saved = localStorage.getItem('dir_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();
  const userRole = (userObj?.role || '').toUpperCase().trim();
  const username = (userObj?.username || '').toLowerCase().trim();
  const isMasterAdmin = userRole === 'MASTER ADMIN' || userRole === 'MASTER_ADMIN' || userRole === 'MASTERADMIN' || username === 'admin';
  const [existingAccounts, setExistingAccounts] = useState<ExistingAccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activePurokFolder, setActivePurokFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ExistingAccountItem | null>(null);
  const [selectedBarangay, setSelectedBarangay] = useState<string>('all');
  const [selectedVerification, setSelectedVerification] = useState<string>('all');
  const [addingToFilesMap, setAddingToFilesMap] = useState<{[key: string]: boolean}>({});

  const [stagedFiles, setStagedFiles] = useState<{ fileName: string; fileData: string; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);

  // Editable fields for Selected Account Details Modal
  const [editFullName, setEditFullName] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editPurok, setEditPurok] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editGeotagged, setEditGeotagged] = useState(false);
  const [facebookLink, setFacebookLink] = useState('');
  const [isGpsCapturing, setIsGpsCapturing] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  // Reset folder and searches when active tab changes
  useEffect(() => {
    setActiveFolder(null);
    setActivePurokFolder(null);
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    setActivePurokFolder(null);
    setSearchQuery('');
  }, [activeFolder]);

  // Synchronize modal state whenever a record is selected
  useEffect(() => {
    if (selectedItem) {
      setEditFullName(selectedItem.full_name || '');
      setEditBarangay(selectedItem.barangay || '');
      setEditPurok(selectedItem.purok || '');
      setEditContactNumber(formatDisplayPhone(selectedItem.contact_number));
      setEditPin(selectedItem.pin || '');
      setEditLatitude(selectedItem.latitude !== undefined && selectedItem.latitude !== null ? selectedItem.latitude.toString() : '');
      setEditLongitude(selectedItem.longitude !== undefined && selectedItem.longitude !== null ? selectedItem.longitude.toString() : '');
      setEditGeotagged(!!selectedItem.geotagged);
      setFacebookLink(selectedItem.facebookLink || '');
      setStagedFiles([]);
      setShowManualCoords(false);
    } else {
      setEditFullName('');
      setEditBarangay('');
      setEditPurok('');
      setEditContactNumber('');
      setEditPin('');
      setEditLatitude('');
      setEditLongitude('');
      setEditGeotagged(false);
      setFacebookLink('');
      setStagedFiles([]);
      setShowManualCoords(false);
    }
  }, [selectedItem]);
  
  // Barangay list for Add form dropdown
  const [barangayList, setBarangayList] = useState<string[]>([]);

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete Folder state
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  // Delete Single Account state
  const [accountToDelete, setAccountToDelete] = useState<ExistingAccountItem | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Clear All Accounts state
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  // Pagination states
  const [unifiedPage, setUnifiedPage] = useState(1);
  const [folderPage, setFolderPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setUnifiedPage(1);
  }, [searchQuery, selectedBarangay, selectedVerification]);

  useEffect(() => {
    setFolderPage(1);
  }, [searchQuery, activeFolder, activePurokFolder]);

  const handleConfirmDeleteFolder = async (barangay: string) => {
    setDeletingFolder(true);
    try {
      const res = await fetch(`/api/existing-accounts/folder/${encodeURIComponent(barangay)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete folder.');
      }
      showToast(`Barangay folder "${barangay}" has been successfully deleted.`, 'success');
      await fetchExistingAccounts();
      setFolderToDelete(null);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDeletingFolder(false);
    }
  };

  const handleConfirmDeleteAccount = async (id: string | number) => {
    setDeletingAccount(true);
    try {
      const res = await fetch(`/api/existing-accounts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete record.');
      }
      showToast('Patient record has been successfully deleted.', 'success');
      await fetchExistingAccounts();
      setAccountToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Error deleting account.', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleConfirmClearAllAccounts = async () => {
    setClearingAll(true);
    try {
      const res = await fetch('/api/existing-accounts', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear all existing accounts.');
      }
      showToast('All existing account records have been permanently cleared.', 'success');
      await fetchExistingAccounts();
      setShowClearAllModal(false);
    } catch (err: any) {
      showToast(err.message || 'Error clearing existing accounts.', 'error');
    } finally {
      setClearingAll(false);
    }
  };

  // Format display phone number to guarantee 09... format
  const formatDisplayPhone = (phone?: string) => {
    if (!phone) return '';
    let clean = phone.trim();
    if (clean.startsWith("'")) clean = clean.substring(1).trim();
    if (/^9\d{9}$/.test(clean)) return '0' + clean;
    return clean;
  };

  // Parse bulk text live with multi-delimiter support (tabs, pipes, commas, semicolons)
  const parsedRecords = useMemo(() => {
    if (!bulkText.trim()) return [];
    const lines = bulkText.split('\n');
    return lines
      .map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        
        let parts: string[] = [];
        if (trimmed.includes('\t')) {
          parts = trimmed.split('\t').map(s => s.trim());
        } else if (trimmed.includes('|')) {
          parts = trimmed.split('|').map(s => s.trim());
        } else if (trimmed.includes(';')) {
          parts = trimmed.split(';').map(s => s.trim());
        } else if (trimmed.includes(',')) {
          parts = trimmed.split(',').map(s => s.trim());
        } else {
          parts = [trimmed];
        }

        const fullName = parts[0] || '';
        const barangay = parts[1] || '';
        const purok = parts[2] || '';
        
        let contactNumber = parts[3] || '';
        if (contactNumber.startsWith("'")) contactNumber = contactNumber.substring(1).trim();
        if (/^9\d{9}$/.test(contactNumber)) contactNumber = '0' + contactNumber;

        let pin = parts[4] || '';
        if (pin.startsWith("'")) pin = pin.substring(1).trim();
        
        // Validation check
        const errors: string[] = [];
        if (!fullName) {
          errors.push('Name is required');
        }
        if (!barangay) {
          errors.push('Barangay is required');
        }
        
        return {
          lineIndex: idx + 1,
          raw: trimmed,
          fullName,
          barangay: barangay.toUpperCase(),
          purok,
          contactNumber,
          pin,
          isValid: errors.length === 0,
          errors
        };
      })
      .filter(Boolean) as Array<{
        lineIndex: number;
        raw: string;
        fullName: string;
        barangay: string;
        purok: string;
        contactNumber: string;
        pin: string;
        isValid: boolean;
        errors: string[];
      }>;
  }, [bulkText]);

  // Fetch Existing Accounts from local offline-first API
  const fetchExistingAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/existing-accounts', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch existing accounts from local directory.');
      }
      setExistingAccounts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Barangay List
  const fetchBarangays = async () => {
    try {
      const res = await fetch('/api/public/barangays');
      const data = await res.json();
      if (data && Array.isArray(data.barangays)) {
        setBarangayList(data.barangays);
      }
    } catch (err) {
      console.warn('Failed to load public barangays list:', err);
    }
  };

  useEffect(() => {
    fetchExistingAccounts();
    fetchBarangays();
  }, [authToken]);

  // Aggregate unique barangays for filter dropdown from active unsubmitted accounts
  const unsubmittedAccounts = useMemo(() => {
    return existingAccounts.filter(acc => !acc.uploadedFiles || acc.uploadedFiles.length === 0);
  }, [existingAccounts]);

  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    unsubmittedAccounts.forEach(acc => {
      if (acc.barangay) {
        set.add(acc.barangay.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [unsubmittedAccounts]);

  // Compute dynamic stats for top widgets
  const stats = useMemo(() => {
    const total = unsubmittedAccounts.length;
    const verified = unsubmittedAccounts.filter(a => a.existingAccVerified).length;
    const pending = total - verified;
    const geotagged = unsubmittedAccounts.filter(a => a.geotagged).length;
    return { total, verified, pending, geotagged };
  }, [unsubmittedAccounts]);

  // Filter accounts inside unified list (only unsubmitted accounts)
  const filteredAccounts = useMemo(() => {
    return unsubmittedAccounts.filter(acc => {
      // 1. Search Query
      const lowerQuery = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (acc.full_name || '').toLowerCase().includes(lowerQuery) ||
        (acc.contact_number || '').toLowerCase().includes(lowerQuery) ||
        (acc.purok || '').toLowerCase().includes(lowerQuery) ||
        (acc.pin || '').toLowerCase().includes(lowerQuery) ||
        (acc.barangay || '').toLowerCase().includes(lowerQuery);

      // 2. Barangay Filter
      const matchesBarangay = selectedBarangay === 'all' || 
        (acc.barangay || '').trim().toUpperCase() === selectedBarangay.trim().toUpperCase();

      // 3. Verification Filter
      const matchesVerification = selectedVerification === 'all' ||
        (selectedVerification === 'verified' && acc.existingAccVerified) ||
        (selectedVerification === 'pending' && !acc.existingAccVerified);

      return matchesSearch && matchesBarangay && matchesVerification;
    });
  }, [unsubmittedAccounts, searchQuery, selectedBarangay, selectedVerification]);

  // Aggregate barangay folders from existing accounts where addedToFiles is true and not yet submitted
  const barangayFolders = useMemo(() => {
    const foldersMap: { [key: string]: { count: number; verifiedCount: number; list: ExistingAccountItem[] } } = {};
    
    // Only aggregate accounts that have been added to files and not yet submitted
    const addedAccounts = unsubmittedAccounts.filter(acc => acc.addedToFiles === true);

    addedAccounts.forEach(acc => {
      const bName = acc.barangay || 'Unknown Barangay';
      const normalized = bName.trim().toUpperCase();
      if (!foldersMap[normalized]) {
        foldersMap[normalized] = { count: 0, verifiedCount: 0, list: [] };
      }
      foldersMap[normalized].count += 1;
      if (acc.existingAccVerified) {
        foldersMap[normalized].verifiedCount += 1;
      }
      foldersMap[normalized].list.push(acc);
    });

    return Object.keys(foldersMap).map(name => ({
      barangay: name,
      count: foldersMap[name].count,
      verifiedCount: foldersMap[name].verifiedCount,
      list: foldersMap[name].list
    })).sort((a, b) => b.count - a.count || a.barangay.localeCompare(b.barangay));
  }, [unsubmittedAccounts]);

  // Filter folders in Folder Overview mode
  const filteredFolders = useMemo(() => {
    if (!searchQuery || activeFolder) return barangayFolders;
    return barangayFolders.filter(f => 
      f.barangay.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [barangayFolders, searchQuery, activeFolder]);

  // Aggregate Purok folders inside the active Barangay folder
  const purokFolders = useMemo(() => {
    if (!activeFolder) return [];
    const folderData = barangayFolders.find(f => f.barangay === activeFolder);
    if (!folderData) return [];

    const map: { [key: string]: { purok: string; count: number; verifiedCount: number; list: ExistingAccountItem[] } } = {};

    folderData.list.forEach(acc => {
      const rawP = acc.purok ? acc.purok.trim() : '';
      const pName = rawP ? rawP : 'No Purok';
      const key = pName.toUpperCase();
      if (!map[key]) {
        map[key] = { purok: pName, count: 0, verifiedCount: 0, list: [] };
      }
      map[key].count += 1;
      if (acc.existingAccVerified) {
        map[key].verifiedCount += 1;
      }
      map[key].list.push(acc);
    });

    // Sort patient records inside each purok folder alphabetically by Full Name
    Object.values(map).forEach(p => {
      p.list.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    });

    // Sort purok folders based on patient population (highest population count first)
    return Object.values(map).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      if (a.purok.toLowerCase() === 'no purok') return 1;
      if (b.purok.toLowerCase() === 'no purok') return -1;
      return a.purok.localeCompare(b.purok, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [barangayFolders, activeFolder]);

  // Filter Purok folders when searching inside Barangay (in Purok folder overview)
  const filteredPurokFolders = useMemo(() => {
    if (!searchQuery || activePurokFolder) return purokFolders;
    const lowerQuery = searchQuery.toLowerCase();
    return purokFolders.filter(f =>
      f.purok.toLowerCase().includes(lowerQuery) ||
      f.list.some(acc => (acc.full_name || '').toLowerCase().includes(lowerQuery))
    );
  }, [purokFolders, searchQuery, activePurokFolder]);

  // Filter accounts inside the active Purok folder
  const filteredAccountsInPurok = useMemo(() => {
    if (!activeFolder || !activePurokFolder) return [];
    const pData = purokFolders.find(f => f.purok.toUpperCase() === activePurokFolder.toUpperCase());
    if (!pData) return [];

    let list = [...pData.list];
    if (!searchQuery) return list;

    const lowerQuery = searchQuery.toLowerCase();
    return list.filter(acc => 
      (acc.full_name || '').toLowerCase().includes(lowerQuery) ||
      (acc.contact_number || '').toLowerCase().includes(lowerQuery) ||
      (acc.pin || '').toLowerCase().includes(lowerQuery)
    );
  }, [purokFolders, activeFolder, activePurokFolder, searchQuery]);

  // Filter accounts inside the active folder (fallback or all records)
  const filteredAccountsInFolder = useMemo(() => {
    if (!activeFolder) return [];
    const folderData = barangayFolders.find(f => f.barangay === activeFolder);
    if (!folderData) return [];

    if (!searchQuery) return folderData.list;

    const lowerQuery = searchQuery.toLowerCase();
    return folderData.list.filter(acc => 
      (acc.full_name || '').toLowerCase().includes(lowerQuery) ||
      (acc.contact_number || '').toLowerCase().includes(lowerQuery) ||
      (acc.purok || '').toLowerCase().includes(lowerQuery) ||
      (acc.pin || '').toLowerCase().includes(lowerQuery)
    );
  }, [barangayFolders, activeFolder, searchQuery]);

  // Paginated Unified Accounts
  const paginatedUnifiedAccounts = useMemo(() => {
    const start = (unifiedPage - 1) * itemsPerPage;
    return filteredAccounts.slice(start, start + itemsPerPage);
  }, [filteredAccounts, unifiedPage]);

  const totalUnifiedPages = Math.ceil(filteredAccounts.length / itemsPerPage);

  // Paginated Folder Accounts (Purok View)
  const paginatedPurokAccounts = useMemo(() => {
    const start = (folderPage - 1) * itemsPerPage;
    return filteredAccountsInPurok.slice(start, start + itemsPerPage);
  }, [filteredAccountsInPurok, folderPage]);

  const totalPurokPages = Math.ceil(filteredAccountsInPurok.length / itemsPerPage);

  // Paginated Folder Accounts (Legacy/Direct)
  const paginatedFolderAccounts = useMemo(() => {
    const start = (folderPage - 1) * itemsPerPage;
    return filteredAccountsInFolder.slice(start, start + itemsPerPage);
  }, [filteredAccountsInFolder, folderPage]);

  const totalFolderPages = Math.ceil(filteredAccountsInFolder.length / itemsPerPage);

  // Handle adding/removing from files list
  const toggleAddToList = async (item: ExistingAccountItem) => {
    setAddingToFilesMap(prev => ({ ...prev, [item.id]: true }));
    try {
      const targetState = !item.addedToFiles;
      const res = await fetch(`/api/existing-accounts/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ addedToFiles: targetState })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update account.');
      }
      
      // Update local state
      setExistingAccounts(prev => 
        prev.map(acc => acc.id === item.id ? data : acc)
      );

      showToast(
        targetState 
          ? `Added "${item.full_name}" to files list.` 
          : `Removed "${item.full_name}" from files list.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAddingToFilesMap(prev => ({ ...prev, [item.id]: false }));
    }
  };

  // Handle file selection for upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files) as File[];
    
    filesArray.forEach((file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`File "${file.name}" exceeds the 5MB size limit.`, 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setStagedFiles(prev => [
          ...prev,
          {
            fileName: file.name,
            fileData: reader.result as string,
            size: file.size
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    // Clear input so same file can be selected again
    e.target.value = '';
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  // GPS Live Sensor Capture
  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      showToast('GPS Geolocation is not supported by your browser. You can enter coordinates manually.', 'error');
      setShowManualCoords(true);
      return;
    }

    setIsGpsCapturing(true);
    showToast('Acquiring real-time GPS coordinates from device sensor...', 'info');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setEditLatitude(lat.toFixed(6));
        setEditLongitude(lng.toFixed(6));
        setEditGeotagged(true);
        setIsGpsCapturing(false);
        showToast(`GPS location captured: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'success');
      },
      (error) => {
        console.error('Error capturing GPS:', error);
        setIsGpsCapturing(false);
        setShowManualCoords(true);
        showToast(`Could not acquire GPS: ${error.message}. You can enter coordinates manually.`, 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleClearGPS = () => {
    setEditLatitude('');
    setEditLongitude('');
    setEditGeotagged(false);
    showToast('Geotag coordinates cleared.', 'info');
  };

  // Discard edits in modal
  const handleDiscardChanges = () => {
    if (!selectedItem) return;
    setEditFullName(selectedItem.full_name || '');
    setEditBarangay(selectedItem.barangay || '');
    setEditPurok(selectedItem.purok || '');
    setEditContactNumber(selectedItem.contact_number || '');
    setEditPin(selectedItem.pin || '');
    setEditLatitude(selectedItem.latitude !== undefined && selectedItem.latitude !== null ? selectedItem.latitude.toString() : '');
    setEditLongitude(selectedItem.longitude !== undefined && selectedItem.longitude !== null ? selectedItem.longitude.toString() : '');
    setEditGeotagged(!!selectedItem.geotagged);
    setFacebookLink(selectedItem.facebookLink || '');
    setStagedFiles([]);
    setShowManualCoords(false);
    showToast('Changes discarded.', 'info');
  };

  // Check whether user modified any modal field or staged files
  const isFormChanged = useMemo(() => {
    if (!selectedItem) return false;
    const origLat = selectedItem.latitude !== undefined && selectedItem.latitude !== null ? selectedItem.latitude.toString() : '';
    const origLng = selectedItem.longitude !== undefined && selectedItem.longitude !== null ? selectedItem.longitude.toString() : '';

    return (
      editFullName.trim() !== (selectedItem.full_name || '').trim() ||
      editBarangay.trim() !== (selectedItem.barangay || '').trim() ||
      editPurok.trim() !== (selectedItem.purok || '').trim() ||
      editContactNumber.trim() !== (selectedItem.contact_number || '').trim() ||
      editPin.trim() !== (selectedItem.pin || '').trim() ||
      facebookLink.trim() !== (selectedItem.facebookLink || '').trim() ||
      editLatitude.trim() !== origLat ||
      editLongitude.trim() !== origLng ||
      stagedFiles.length > 0
    );
  }, [selectedItem, editFullName, editBarangay, editPurok, editContactNumber, editPin, facebookLink, editLatitude, editLongitude, stagedFiles]);

  // Save all modified details, geotag telemetry, and attached files
  const handleSaveRecord = async (submitToBase44: boolean = false) => {
    if (!selectedItem) return;
    if (!editFullName.trim()) {
      showToast('Patient full name is required.', 'error');
      return;
    }
    if (!editBarangay.trim()) {
      showToast('Barangay is required.', 'error');
      return;
    }

    setIsSavingRecord(true);
    try {
      const latNum = editLatitude.trim() ? parseFloat(editLatitude.trim()) : undefined;
      const lngNum = editLongitude.trim() ? parseFloat(editLongitude.trim()) : undefined;
      const isGeotagged = !!(latNum !== undefined && !isNaN(latNum) && lngNum !== undefined && !isNaN(lngNum));

      // CRITICAL: Only submit to Base44 if explicitly requested via "Submit to Base44" button
      const isSubmitting = submitToBase44 === true;

      // 1. If files are staged, upload/save them in safe chunks of 3
      if (stagedFiles.length > 0) {
        const BATCH_SIZE = 3;
        let currentTargetId = selectedItem.id;
        for (let i = 0; i < stagedFiles.length; i += BATCH_SIZE) {
          const chunk = stagedFiles.slice(i, i + BATCH_SIZE);
          const isLastBatch = (i + BATCH_SIZE) >= stagedFiles.length;
          const uploadRes = await fetch(`/api/existing-accounts/${currentTargetId}/files`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              files: chunk,
              facebookLink: facebookLink.trim(),
              submitToBase44: isSubmitting && isLastBatch
            })
          });
          if (uploadRes.ok) {
            const updatedData = await uploadRes.json().catch(() => null);
            if (updatedData && updatedData.id) {
              currentTargetId = updatedData.id;
            }
          }
        }
      }

      // 2. Update record details & geotag telemetry
      const updatePayload: Partial<ExistingAccountItem> & { submitToBase44?: boolean } = {
        full_name: editFullName.trim().toUpperCase(),
        barangay: editBarangay.trim().toUpperCase(),
        purok: editPurok.trim(),
        contact_number: editContactNumber.trim(),
        pin: editPin.trim(),
        latitude: isGeotagged ? latNum : undefined,
        longitude: isGeotagged ? lngNum : undefined,
        geotagged: isGeotagged,
        facebookLink: facebookLink.trim(),
        submitToBase44: isSubmitting,
        isSubmitted: isSubmitting ? true : selectedItem.isSubmitted
      };

      const res = await fetch(`/api/existing-accounts/${selectedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updatePayload)
      });

      const updatedData = await res.json();
      if (!res.ok) {
        throw new Error(updatedData.error || 'Failed to update record details.');
      }

      // Update state
      setExistingAccounts(prev => prev.map(acc => acc.id === selectedItem.id ? updatedData : acc));
      setStagedFiles([]);
      
      if (isSubmitting) {
        setSelectedItem(null);
        showToast(`Record for "${updatedData.full_name}" submitted to Base44 database & transferred to "Recent Upload"!`, 'success');
      } else {
        setSelectedItem(updatedData);
        showToast('Patient record details & attached files saved locally (not submitted to Base44 database).', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save changes.', 'error');
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleSaveFiles = async () => {
    await handleSaveRecord(true);
  };

  // Handle adding bulk accounts
  const handleAddAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedRecords.length === 0) {
      showToast('Please enter at least one valid record.', 'error');
      return;
    }

    const invalid = parsedRecords.filter(r => !r.isValid);
    if (invalid.length > 0) {
      showToast(`Please fix formatting errors on line ${invalid[0].lineIndex}.`, 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = parsedRecords.map(r => ({
        full_name: r.fullName,
        barangay: r.barangay,
        purok: r.purok,
        contact_number: r.contactNumber,
        status: 'approved',
        existingAccVerified: true,
        existingAccVisited: true,
        pin: r.pin || ''
      }));

      const res = await fetch('/api/existing-accounts/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ accounts: payload })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register existing accounts in bulk.');
      }

      // Merge newly added records directly into state so they are rendered instantly without bouncing back
      if (data.data && Array.isArray(data.data)) {
        setExistingAccounts(prev => {
          const map = new Map(prev.map(a => [a.id, a]));
          data.data.forEach((acc: ExistingAccountItem) => {
            map.set(acc.id, acc);
          });
          return Array.from(map.values());
        });
      }

      showToast(`Successfully registered ${data.count} existing accounts!`, 'success');
      
      // Reset bulk form and close modal
      setBulkText('');
      setShowAddModal(false);

      // Refresh directory from server
      await fetchExistingAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Redesigned Header Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle background graphics */}
        <div className="absolute -right-24 -top-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-24 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 relative z-10 min-w-0 flex-1">
          {activeTab === 'exist-acc-files' && activeFolder ? (
            <button
              onClick={() => {
                if (activePurokFolder) {
                  setActivePurokFolder(null);
                  setSearchQuery('');
                  setFolderPage(1);
                } else {
                  setActiveFolder(null);
                  setActivePurokFolder(null);
                  setSearchQuery('');
                  setFolderPage(1);
                }
              }}
              className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-emerald-400 font-bold text-xs rounded-2xl transition-all cursor-pointer flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0"
              title={activePurokFolder ? "Back to Purok Folders" : "Back to Barangay Folders"}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-900/20 shrink-0">
              {activeTab === 'exist-acc-files' ? (
                <Folder className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              ) : (
                <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-black text-white font-display tracking-tight flex items-center gap-2 flex-wrap">
              {activeTab === 'exist-acc-files' ? (
                activeFolder ? (
                  activePurokFolder ? (
                    <span className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 fill-emerald-500/10 shrink-0" />
                      <button
                        type="button"
                        onClick={() => {
                          setActivePurokFolder(null);
                          setSearchQuery('');
                          setFolderPage(1);
                        }}
                        className="text-slate-300 hover:text-emerald-300 capitalize transition-colors cursor-pointer"
                      >
                        {activeFolder.toLowerCase()}
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-emerald-300 capitalize font-extrabold">{activePurokFolder.toLowerCase()}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 flex-wrap">
                      <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 fill-emerald-500/10 shrink-0" />
                      <span>Purok Folders in <span className="text-emerald-300 capitalize">{activeFolder.toLowerCase()}</span></span>
                    </span>
                  )
                ) : (
                  'Existing Account Files'
                )
              ) : (
                'Existing Account Directory'
              )}
            </h2>
            <p className="text-xs sm:text-[13px] text-slate-400 font-medium mt-1 leading-relaxed max-w-2xl">
              {activeTab === 'exist-acc-files' ? (
                activeFolder ? (
                  activePurokFolder ? (
                    `Sorted patient profiles under ${activePurokFolder}, Barangay ${activeFolder}`
                  ) : (
                    `Organized into ${purokFolders.length} Purok Folders (Highest Population First) under Barangay ${activeFolder}`
                  )
                ) : (
                  `Offline-first directory grouped into ${barangayFolders.length} secure Barangay folders`
                )
              ) : (
                'Unified directory of registered and bulk-imported existing accounts for quick lookup and verification.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 relative z-10 w-full xl:w-auto shrink-0 justify-start sm:justify-end pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-800/80">
          {isMasterAdmin && existingAccounts.length > 0 && (
            <button
              onClick={() => setShowClearAllModal(true)}
              className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2.5 sm:py-3 bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-300 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 focus:outline-none shadow-sm whitespace-nowrap"
              title="Permanently remove all existing account records"
            >
              <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
              <span>Clear All</span>
            </button>
          )}

          <button
            onClick={fetchExistingAccounts}
            disabled={loading}
            className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 focus:outline-none whitespace-nowrap"
            title="Reload local existing accounts directory"
          >
            <RotateCw className={`w-4 h-4 text-emerald-400 shrink-0 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {activeTab === 'existing-account' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-950/40 transition-all cursor-pointer flex items-center justify-center gap-2 focus:outline-none hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-white font-bold shrink-0" />
              <span>Add Existing Acc.</span>
            </button>
          )}
        </div>
      </div>



      {loading && existingAccounts.length === 0 ? (
        <div className="bg-white border border-slate-200/60 rounded-3xl p-16 text-center shadow-xs">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-800 font-extrabold text-sm font-display">Loading Existing Accounts Directory...</p>
          <p className="text-slate-400 text-xs mt-1">Synchronizing local data files. Please hold on.</p>
        </div>
      ) : (
        <>
          {/* Main Content Area based on activeTab */}
          {activeTab === 'exist-acc-files' ? (
            // FOLDER VIEW MODE
            !activeFolder ? (
              // 1. Folders Grid
              <div className="space-y-6">
                {/* BARANGAY SUMMARY ANALYTICS DASHBOARD */}
                <BarangaySummaryAnalytics
                  barangayFolders={barangayFolders}
                  totalBarangaysInSystem={barangayList.length || 296}
                  onSelectBarangay={(bName) => {
                    setActiveFolder(bName);
                    setActivePurokFolder(null);
                    setSearchQuery('');
                    setFolderPage(1);
                  }}
                  onSelectPurok={(bName, pName) => {
                    setActiveFolder(bName);
                    setActivePurokFolder(pName);
                    setSearchQuery('');
                    setFolderPage(1);
                  }}
                />

                {/* TOOLBAR FOR SEARCH IN FOLDERS */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search folders by Barangay..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <div className="text-xs font-bold text-slate-500 flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-xl">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{filteredFolders.length} Barangay Folders Available</span>
                  </div>
                </div>

                {filteredFolders.length === 0 ? (
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-16 text-center shadow-xs animate-fade-in">
                    <Folder className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-700 font-extrabold text-base font-display">No folders found</p>
                    <p className="text-slate-400 text-xs mt-1">Add patient profiles to files list first from the Existing Account Directory page.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredFolders.map((folder) => (
                      <motion.div
                        key={folder.barangay}
                        whileHover={{ y: -3, shadow: '0 8px 20px -4px rgba(0, 0, 0, 0.05)' }}
                        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all overflow-hidden flex flex-col justify-between group cursor-pointer"
                        onClick={() => {
                          setActiveFolder(folder.barangay);
                          setSearchQuery('');
                        }}
                      >
                        <div className="p-4 sm:p-4.5">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all shadow-xs">
                              <Folder className="w-5 h-5 fill-emerald-100/40 group-hover:fill-white/10 transition-colors" />
                            </div>

                            {isMasterAdmin && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFolderToDelete(folder.barangay);
                                  }}
                                  className="p-1.5 bg-red-50 hover:bg-red-600 border border-red-100 hover:border-red-600 text-red-600 hover:text-white rounded-lg transition-all cursor-pointer shadow-xs focus:outline-none"
                                  title="Delete Barangay Folder"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <h3 className="text-sm sm:text-[15px] font-black text-slate-800 font-display group-hover:text-emerald-700 transition-colors capitalize truncate" title={folder.barangay}>
                            {folder.barangay.toLowerCase()}
                          </h3>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                            BARANGAY DIRECTORY
                          </p>
                        </div>

                        <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs font-black text-emerald-800 group-hover:bg-emerald-50/20 transition-all">
                          <div className="flex items-center gap-2 text-slate-700 font-extrabold text-[11px] px-2.5 py-1 rounded-full bg-emerald-50/90 border border-emerald-200/80 shadow-xs relative overflow-hidden">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                            </span>
                            <span className="text-emerald-900 tracking-tight">{folder.count || folder.verifiedCount} {folder.count === 1 ? 'Patient' : 'Patients'}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : !activePurokFolder ? (
              // 2. Purok Folders Grid inside active Barangay folder
              <div className="space-y-6">
                {/* TOOLBAR FOR SEARCH IN PUROK FOLDERS */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search Purok in ${activeFolder}...`}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFolder(null);
                        setActivePurokFolder(null);
                        setSearchQuery('');
                        setFolderPage(1);
                      }}
                      className="text-xs font-bold text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>All Barangays</span>
                    </button>
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{filteredPurokFolders.length} Purok Folders</span>
                    </div>
                  </div>
                </div>

                {filteredPurokFolders.length === 0 ? (
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-16 text-center shadow-xs animate-fade-in">
                    <Folder className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-700 font-extrabold text-base font-display">No Purok Folders Found</p>
                    <p className="text-slate-400 text-xs mt-1">No patient profiles matching this search under Barangay {activeFolder}.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredPurokFolders.map((pFolder) => (
                      <motion.div
                        key={pFolder.purok}
                        whileHover={{ y: -3, shadow: '0 8px 20px -4px rgba(0, 0, 0, 0.05)' }}
                        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-teal-300 transition-all overflow-hidden flex flex-col justify-between group cursor-pointer"
                        onClick={() => {
                          setActivePurokFolder(pFolder.purok);
                          setSearchQuery('');
                          setFolderPage(1);
                        }}
                      >
                        <div className="p-4 sm:p-4.5">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 border border-teal-100 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-all shadow-xs">
                              <Folder className="w-5 h-5 fill-teal-100/40 group-hover:fill-white/10 transition-colors" />
                            </div>
                          </div>

                          <h3 className="text-sm sm:text-[15px] font-black text-slate-800 font-display group-hover:text-teal-700 transition-colors capitalize truncate" title={pFolder.purok}>
                            {pFolder.purok.toLowerCase()}
                          </h3>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider truncate">
                            PUROK DIRECTORY
                          </p>
                        </div>

                        <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs font-black text-teal-800 group-hover:bg-teal-50/20 transition-all">
                          <div className="flex items-center gap-2 text-slate-700 font-extrabold text-[11px] px-2.5 py-1 rounded-full bg-emerald-50/90 border border-emerald-200/80 shadow-xs relative overflow-hidden">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                            </span>
                            <span className="text-emerald-900 tracking-tight">{pFolder.count} {pFolder.count === 1 ? 'Patient' : 'Patients'}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // 3. Folder Patient Details View (Patients inside the active Purok folder)
              <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePurokFolder(null);
                          setSearchQuery('');
                          setFolderPage(1);
                        }}
                        className="hover:text-emerald-700 underline transition-colors cursor-pointer"
                      >
                        Purok Folders
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-emerald-800 capitalize font-extrabold">{activePurokFolder.toLowerCase()}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-bold capitalize mt-1 block">
                      Barangay: {activeFolder.toLowerCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={`Search inside ${activePurokFolder}...`}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <span className="px-3 py-1.5 text-xs font-extrabold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200/60 whitespace-nowrap">
                      {filteredAccountsInPurok.length} Patients
                    </span>
                  </div>
                </div>

                {filteredAccountsInPurok.length === 0 ? (
                  <div className="p-16 text-center">
                    <UserIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-700 font-extrabold text-base font-display">No patient records found in this Purok</p>
                    <p className="text-slate-400 text-xs mt-1">Try resetting search filters or add more patient profiles to {activePurokFolder}.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold text-[11px] uppercase tracking-wider bg-slate-50/40">
                            <th className="py-4 px-6">Patient Name</th>
                            <th className="py-4 px-4">Purok</th>
                            <th className="py-4 px-4">Mobile</th>
                            <th className="py-4 px-4">PIN Code</th>
                            <th className="py-4 px-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 text-xs font-semibold">
                          {paginatedPurokAccounts.map((item) => (
                            <tr 
                              key={item.id} 
                              onClick={() => setSelectedItem(item)}
                              className="hover:bg-slate-100/60 transition-colors cursor-pointer group"
                            >
                              <td className="py-4 px-6 font-extrabold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <span className="capitalize group-hover:text-emerald-700 transition-colors">{item.full_name.toLowerCase()}</span>
                                  {item.geotagged && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200/40 rounded-sm">
                                      Geotagged
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 text-slate-500 capitalize">
                                {item.purok ? item.purok.toLowerCase() : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-4 px-4 font-mono font-semibold">
                                {formatDisplayPhone(item.contact_number) || <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-4 px-4 font-mono text-slate-500 font-semibold">
                                {item.pin || <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedItem(item);
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> Details
                                  </button>
                                  {isMasterAdmin && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAccountToDelete(item);
                                      }}
                                      className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-200/60 hover:border-red-100 text-slate-500 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                                      title="Delete Patient Record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Folder Patient Directory Pagination bar */}
                    {totalPurokPages > 1 && (
                      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                        <div>
                          Showing page <span className="text-slate-800 font-extrabold">{folderPage}</span> of <span className="text-slate-800 font-extrabold">{totalPurokPages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderPage(p => Math.max(1, p - 1));
                            }}
                            disabled={folderPage === 1}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg transition-all font-extrabold cursor-pointer disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderPage(p => Math.min(totalPurokPages, p + 1));
                            }}
                            disabled={folderPage === totalPurokPages}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg transition-all font-extrabold cursor-pointer disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          ) : (
            // UNIFIED LIST VIEW (Existing Account Directory)
            <>
              {/* TOOLBAR FOR SEARCH AND FILTER */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between animate-fade-in">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by patient name, purok, phone, or PIN..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Barangay filter select dropdown */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Barangay:</span>
                    <select
                      value={selectedBarangay}
                      onChange={(e) => setSelectedBarangay(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 cursor-pointer focus:ring-0 pr-6"
                    >
                      <option value="all">All Barangays</option>
                      {uniqueBarangays.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Verification status dropdown */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Verification:</span>
                    <select
                      value={selectedVerification}
                      onChange={(e) => setSelectedVerification(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 cursor-pointer focus:ring-0 pr-6"
                    >
                      <option value="all">All</option>
                      <option value="verified">Verified Only</option>
                      <option value="pending">Pending Only</option>
                    </select>
                  </div>

                  <div className="text-xs font-bold text-slate-500 flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-4 py-3 rounded-xl whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{filteredAccounts.length} Match{filteredAccounts.length !== 1 ? 'es' : ''}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden animate-fade-in">
                <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                    Existing Patient Profiles
                  </span>
                  <span className="px-3 py-1 text-xs font-extrabold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200/60">
                    {filteredAccounts.length} Total Registered
                  </span>
                </div>

                {filteredAccounts.length === 0 ? (
                  <div className="p-16 text-center">
                    <UserIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-700 font-extrabold text-base font-display">No registered accounts found</p>
                    <p className="text-slate-400 text-xs mt-1">Try resetting the search filters or bulk register some accounts.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold text-[11px] uppercase tracking-wider bg-slate-50/40">
                            <th className="py-4 px-6">Patient Name</th>
                            <th className="py-4 px-4">Barangay</th>
                            <th className="py-4 px-4">Purok</th>
                            <th className="py-4 px-4">Mobile</th>
                            <th className="py-4 px-4">PIN Code</th>
                            <th className="py-4 px-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 text-xs font-semibold">
                          {paginatedUnifiedAccounts.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-6 font-extrabold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <span className="capitalize">{item.full_name.toLowerCase()}</span>
                                  {item.geotagged && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200/40 rounded-sm">
                                      Geotagged
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 uppercase tracking-wide whitespace-nowrap">
                                  {item.barangay ? item.barangay.toUpperCase() : 'UNKNOWN'}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-slate-500 capitalize">
                                {item.purok ? item.purok.toLowerCase() : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-4 px-4 font-mono font-semibold">
                                {formatDisplayPhone(item.contact_number) || <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-4 px-4 font-mono text-slate-500 font-semibold">
                                {item.pin || <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => toggleAddToList(item)}
                                    disabled={addingToFilesMap[item.id]}
                                    className={`px-3 py-1.5 border rounded-xl text-[11px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1 ${
                                      item.addedToFiles
                                        ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-500 hover:border-emerald-600 text-white shadow-xs'
                                        : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                                    }`}
                                  >
                                    {addingToFilesMap[item.id] ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : item.addedToFiles ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                    ) : (
                                      <Plus className="w-3.5 h-3.5 text-slate-500" />
                                    )}
                                    <span>{item.addedToFiles ? 'Added' : 'Add List'}</span>
                                  </button>
                                  <button
                                    onClick={() => setSelectedItem(item)}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200/60 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1.5"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View Details
                                  </button>
                                  {isMasterAdmin && (
                                    <button
                                      onClick={() => setAccountToDelete(item)}
                                      className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-200/60 hover:border-red-100 text-slate-500 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                                      title="Delete Patient Record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Unified Directory Pagination bar */}
                    {totalUnifiedPages > 1 && (
                      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                        <div>
                          Showing page <span className="text-slate-800 font-extrabold">{unifiedPage}</span> of <span className="text-slate-800 font-extrabold">{totalUnifiedPages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setUnifiedPage(p => Math.max(1, p - 1))}
                            disabled={unifiedPage === 1}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg transition-all font-extrabold cursor-pointer disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setUnifiedPage(p => Math.min(totalUnifiedPages, p + 1))}
                            disabled={unifiedPage === totalUnifiedPages}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg transition-all font-extrabold cursor-pointer disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ADD NEW EXISTING ACCOUNT DIALOG MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 px-6 py-5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display">
                      Bulk Register Existing Accounts
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Enter multiple patient profiles at once using the bulk format
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-white transition-colors cursor-pointer"
                  title="Close Dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddAccountSubmit} className="flex-1 flex flex-col min-h-0">
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                  
                  {/* Instructions banner */}
                  <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-4 text-xs text-emerald-900 font-semibold space-y-2">
                    <p className="font-extrabold text-sm flex items-center gap-2">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">FORMAT</span>
                      <span>Full Name | Barangay | Purok | Contact # | PIN Code (optional)</span>
                    </p>
                    <p className="text-emerald-700 font-medium">
                      Enter each patient record on a new line. Supports Pipe ( | ), Tab (Google Sheet/Excel copy-paste), or Comma separation:
                    </p>
                    <pre className="font-mono bg-white/80 p-2.5 rounded-lg border border-emerald-200 text-slate-700 select-all block text-[11px] leading-relaxed">
                      JUAN DELA CRUZ | DAMPALAN | Purok Mabuhay | 09171234567 | 12-345678901-2{"\n"}
                      MARIA SANTIAGO	KALINGAYAN	Narra	09228881122	23-456789012-3
                    </pre>
                  </div>

                  {/* Bulk Input and Preview side-by-side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                        Paste / Type Data Here *
                      </label>
                      <textarea
                        required
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder="Type or paste records here..."
                        rows={10}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all leading-relaxed placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-2 flex flex-col min-h-0">
                      <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                        Live Parsing Verification Preview
                      </label>
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-[240px] overflow-y-auto space-y-3 font-semibold text-xs text-slate-600">
                        {parsedRecords.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-4">
                            <FileText className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
                            <p className="text-xs">No records parsed yet.</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Start typing on the left side.</p>
                          </div>
                        ) : (
                          parsedRecords.map((rec, idx) => (
                            <div 
                              key={idx} 
                              className={`p-3 rounded-xl border transition-all ${
                                rec.isValid 
                                  ? 'bg-white border-emerald-100 hover:border-emerald-300' 
                                  : 'bg-rose-50/50 border-rose-100 hover:border-rose-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-bold text-[10px] text-slate-400">
                                  Line #{rec.lineIndex}
                                </span>
                                {rec.isValid ? (
                                  <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[10px] font-extrabold text-rose-700">
                                    <X className="w-3.5 h-3.5" /> Invalid
                                  </span>
                                )}
                              </div>
                              {rec.isValid ? (
                                <div className="space-y-1 text-[11px]">
                                  <div className="capitalize text-slate-800 font-extrabold">
                                    {rec.fullName.toLowerCase()}
                                  </div>
                                  <div className="text-slate-500 flex flex-wrap gap-x-2 gap-y-1">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-slate-700">
                                      {rec.barangay}
                                    </span>
                                    {rec.purok && <span>Purok: {rec.purok}</span>}
                                    {rec.contactNumber && <span>No: {formatDisplayPhone(rec.contactNumber)}</span>}
                                    {rec.pin && <span className="font-mono">PIN: {rec.pin}</span>}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-rose-600 font-semibold italic">
                                  {rec.errors.join(', ')}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting || parsedRecords.length === 0}
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 focus:outline-none"
                  >
                    {formSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {formSubmitting ? 'Registering...' : `Register Bulk Accounts (${parsedRecords.length})`}
                    </span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILED RECORD DIALOG MODAL */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-emerald-900 to-slate-950 px-6 py-5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <UserIcon className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-base font-display capitalize truncate">
                        {editFullName || selectedItem.full_name.toLowerCase()}
                      </h3>
                      {selectedItem.isSubmitted || (selectedItem.uploadedFiles && selectedItem.uploadedFiles.length > 0) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-300" /> Submitted to Base44
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/30">
                          <Clock className="w-3 h-3 text-amber-300" /> Not Submitted (Local Only)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-300 font-medium truncate mt-0.5">
                      Existing Account Profile • Edit & Telemetry Details
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/25 rounded-lg text-white transition-colors cursor-pointer shrink-0 ml-3"
                  title="Close Dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                {/* 1. Editable Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-600" /> Patient Full Name
                  </label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="e.g. JUAN DELA CRUZ"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs font-bold text-slate-800 outline-none transition-all uppercase"
                  />
                </div>

                {/* 2. Barangay & Purok Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Barangay
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        list="edit-barangay-modal-options"
                        value={editBarangay}
                        onChange={(e) => setEditBarangay(e.target.value)}
                        placeholder="Select or enter barangay"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs font-bold text-slate-800 outline-none transition-all uppercase"
                      />
                      <datalist id="edit-barangay-modal-options">
                        {barangayList.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-emerald-600" /> Purok / Sitio
                    </label>
                    <input
                      type="text"
                      value={editPurok}
                      onChange={(e) => setEditPurok(e.target.value)}
                      placeholder="e.g. Purok 1"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* 3. Mobile Number & PhilHealth PIN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> Mobile Number
                    </label>
                    <input
                      type="text"
                      value={editContactNumber}
                      onChange={(e) => setEditContactNumber(e.target.value)}
                      placeholder="e.g. 09171234567"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs font-mono font-semibold text-slate-800 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> PhilHealth PIN Code
                    </label>
                    <input
                      type="text"
                      value={editPin}
                      onChange={(e) => setEditPin(e.target.value)}
                      placeholder="e.g. 12-345678901-2"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs font-mono font-semibold text-slate-800 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* 4. GPS Geotagging & Telemetry */}
                <div className="p-4 bg-emerald-50/40 border border-emerald-100/80 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Crosshair className="w-4 h-4 text-emerald-700" /> Geographic Tagging & Telemetry
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Capture device sensor GPS coordinates or enter telemetry points manually.
                      </p>
                    </div>
                    <div>
                      {editLatitude && editLongitude ? (
                        <span className="px-2.5 py-1 bg-teal-100 text-teal-800 border border-teal-200 rounded-full text-[10px] font-extrabold flex items-center gap-1 shadow-xs">
                          <Check className="w-3 h-3 text-teal-700" /> Geotagged
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full text-[10px] font-bold">
                          Not Geotagged
                        </span>
                      )}
                    </div>
                  </div>

                  {/* GPS Coordinates Display & Controls */}
                  {editLatitude && editLongitude ? (
                    /* Once captured: Hide buttons and only display the captured coordinates */
                    <div className="bg-white/90 border border-emerald-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Captured Coordinates</span>
                          <span className="font-mono font-black text-sm text-emerald-950 truncate block">
                            {editLatitude}, {editLongitude}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`https://www.google.com/maps?q=${editLatitude},${editLongitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View on Google Maps</span>
                        </a>

                        <button
                          type="button"
                          onClick={handleClearGPS}
                          className="px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title="Remove Geotag Coordinates"
                        >
                          Recapture
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* When not yet captured: Show capture buttons and manual input toggle */
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCaptureGPS}
                          disabled={isGpsCapturing}
                          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isGpsCapturing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Locking GPS Sensor...</span>
                            </>
                          ) : (
                            <>
                              <Crosshair className="w-3.5 h-3.5" />
                              <span>Capture Current GPS</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowManualCoords(!showManualCoords)}
                          className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          {showManualCoords ? 'Hide Manual Inputs' : 'Manual Coordinates'}
                        </button>
                      </div>

                      {showManualCoords && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Latitude</label>
                            <input
                              type="text"
                              value={editLatitude}
                              onChange={(e) => {
                                setEditLatitude(e.target.value);
                                setEditGeotagged(!!(e.target.value.trim() && editLongitude.trim()));
                              }}
                              placeholder="e.g. 7.824123"
                              className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-mono font-bold text-slate-700 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Longitude</label>
                            <input
                              type="text"
                              value={editLongitude}
                              onChange={(e) => {
                                setEditLongitude(e.target.value);
                                setEditGeotagged(!!(editLatitude.trim() && e.target.value.trim()));
                              }}
                              placeholder="e.g. 123.432109"
                              className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-mono font-bold text-slate-700 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Metadata (Registration Info) */}
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registration Date</span>
                    <span className="text-slate-800 font-bold mt-0.5 block">
                      {new Date(selectedItem.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered By</span>
                    <span className="text-slate-800 font-bold mt-0.5 block truncate">
                      {selectedItem.submittedBy || 'Admin'}
                    </span>
                  </div>
                </div>

                {/* 6. Facebook Link Field */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Facebook className="w-3.5 h-3.5 text-blue-600" /> Facebook Link (Optional)
                  </span>
                  <div className="mt-1">
                    <input
                      type="text"
                      value={facebookLink}
                      onChange={(e) => setFacebookLink(e.target.value)}
                      placeholder="e.g. https://facebook.com/username"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                  {facebookLink && facebookLink.startsWith('http') && (
                    <div className="text-[10px] font-bold mt-1">
                      <a 
                        href={facebookLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-emerald-600 hover:underline inline-flex items-center gap-1"
                      >
                        Visit Profile ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* 7. File Upload & Managed Attached Documents Section */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" /> Attached Files & Documents
                    </h4>
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full px-2 py-0.5 font-bold">
                      {(selectedItem.uploadedFiles || []).length} Document(s) Synced
                    </span>
                  </div>

                  {/* Existing Uploaded Files List */}
                  {(!selectedItem.uploadedFiles || selectedItem.uploadedFiles.length === 0) ? (
                    <p className="text-xs text-slate-400 font-medium italic">No files attached to this Existing Account yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedItem.uploadedFiles.map((file, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-xl text-xs font-semibold group transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <File className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-700 font-bold truncate" title={file.name}>
                                {file.name}
                              </p>
                              {file.uploadedAt && (
                                <p className="text-[9px] text-slate-400 mt-0.5">
                                  {new Date(file.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                          <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 text-slate-500 hover:text-emerald-700 rounded-lg shrink-0 transition-all flex items-center justify-center cursor-pointer"
                            title="Open File"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New Files Upload Container */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Upload New Documents</span>
                    
                    {/* Drag & Drop input area */}
                    <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 transition-all bg-slate-50/50 hover:bg-white flex flex-col items-center justify-center text-center group cursor-pointer">
                      <input 
                        type="file" 
                        multiple 
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        title="Choose multiple files"
                      />
                      <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 transition-colors mb-2 stroke-1.5" />
                      <p className="text-xs font-bold text-slate-700">Drag & drop files here, or <span className="text-emerald-700 font-extrabold underline">browse</span></p>
                      <p className="text-[10px] text-slate-400 mt-1">Select multiple files at once. Max 5MB per file.</p>
                    </div>

                    {/* Staged files for upload */}
                    {stagedFiles.length > 0 && (
                      <div className="space-y-2 border border-emerald-100/60 bg-emerald-50/20 rounded-2xl p-3 animate-fade-in">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Staged for Upload ({stagedFiles.length})</span>
                          <button 
                            onClick={() => setStagedFiles([])} 
                            className="text-[10px] font-extrabold text-rose-600 hover:underline cursor-pointer"
                          >
                            Clear All
                          </button>
                        </div>
                        
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                          {stagedFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100 text-[11px] font-semibold">
                              <span className="truncate text-slate-700 max-w-[70%] font-bold" title={file.fileName}>
                                {file.fileName}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {(file.size / 1024).toFixed(1)} KB
                                </span>
                                <button 
                                  onClick={() => removeStagedFile(idx)}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"
                                  title="Remove Staged File"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                <div>
                  {isFormChanged && (
                    <button
                      type="button"
                      onClick={handleDiscardChanges}
                      disabled={isSavingRecord}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer focus:outline-none"
                    >
                      Discard
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    disabled={isSavingRecord}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer focus:outline-none"
                  >
                    Close View
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveRecord(false)}
                    disabled={isSavingRecord}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none"
                    title="Save edits locally without pushing to Base44 database"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-600" />
                    <span>Save Changes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveRecord(true)}
                    disabled={isSavingRecord}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-900/20 transition-all flex items-center gap-2 cursor-pointer focus:outline-none"
                  >
                    {isSavingRecord ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving & Syncing...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>{selectedItem.isSubmitted ? 'Save & Sync to Base44' : 'Submit to Base44'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE FOLDER DIALOG MODAL */}
      <AnimatePresence>
        {folderToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              <div className="bg-gradient-to-r from-red-900 to-slate-950 px-6 py-5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 border border-red-500/30">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display">
                      Delete Barangay Folder
                    </h3>
                    <p className="text-xs text-red-300 font-medium">
                      This action requires Master Admin authorization
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFolderToDelete(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-white transition-colors cursor-pointer"
                  title="Close Dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Are you sure you want to delete the folder <span className="font-black text-slate-800 capitalize">"{folderToDelete.toLowerCase()}"</span>?
                </p>
                <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 text-xs font-semibold text-red-800 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-red-950 text-sm">
                    ⚠️ Warning: Important Action Details
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-red-900">
                    <li>All accounts currently in this folder will have their status updated (removed from files).</li>
                    <li>Any uploaded attachments for these accounts will be cleared.</li>
                    <li>The accounts will be restored and become available again under the <span className="font-bold">Existing Account Directory</span> tab with the <span className="font-bold">Add List</span> button fully active.</li>
                  </ul>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFolderToDelete(null)}
                  disabled={deletingFolder}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmDeleteFolder(folderToDelete)}
                  disabled={deletingFolder}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 focus:outline-none"
                >
                  {deletingFolder ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {deletingFolder ? 'Deleting Folder...' : 'Confirm Delete & Restore'}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE ACCOUNT DIALOG MODAL */}
      <AnimatePresence>
        {accountToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              <div className="bg-gradient-to-r from-red-900 to-slate-950 px-6 py-5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 border border-red-500/30">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display">
                      Delete Patient Profile
                    </h3>
                    <p className="text-xs text-red-300 font-medium">
                      This action will permanently delete this record
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAccountToDelete(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-white transition-colors cursor-pointer"
                  title="Close Dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Are you sure you want to permanently delete <span className="font-black text-slate-800 capitalize">"{accountToDelete.full_name.toLowerCase()}"</span>'s profile from the database?
                </p>

                <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 text-xs font-semibold text-red-800 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-red-950 text-sm">
                    ⚠️ Warning: This action is permanent
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-red-900">
                    <li>This record will be permanently deleted from the local database.</li>
                    <li>If synchronized, the corresponding record on the Base44 database will be removed.</li>
                    <li>Any associated files, verification status, and history will be permanently lost.</li>
                  </ul>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAccountToDelete(null)}
                  disabled={deletingAccount}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmDeleteAccount(accountToDelete.id)}
                  disabled={deletingAccount}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 focus:outline-none"
                >
                  {deletingAccount ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {deletingAccount ? 'Deleting...' : 'Confirm Permanent Delete'}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CLEAR ALL ACCOUNTS DIALOG MODAL */}
      <AnimatePresence>
        {showClearAllModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-md w-full overflow-hidden text-left"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 border border-red-500/30">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display">
                      Clear All Existing Accounts
                    </h3>
                    <p className="text-xs text-red-300 font-medium">
                      This action requires Master Admin authorization
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowClearAllModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-white transition-colors cursor-pointer"
                  title="Close Dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Are you sure you want to permanently delete <span className="font-black text-red-600">ALL {existingAccounts.length}</span> existing account patient records from the database?
                </p>

                <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 text-xs font-semibold text-red-800 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-red-950 text-sm">
                    ⚠️ Warning: This action is permanent and irreversible
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-red-900">
                    <li>All {existingAccounts.length} existing patient account records will be permanently deleted.</li>
                    <li>All associated Barangay folders in this directory will be emptied.</li>
                  </ul>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowClearAllModal(false)}
                  disabled={clearingAll}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearAllAccounts}
                  disabled={clearingAll}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 focus:outline-none"
                >
                  {clearingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {clearingAll ? 'Clearing All Records...' : 'Confirm Clear All'}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
