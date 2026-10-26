import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder,
  FolderOpen,
  FolderCheck,
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
  ChevronRight,
  ChevronDown,
  Layers,
  Database,
  FileSpreadsheet,
  Edit2,
  ArrowRight,
  ArrowUpDown
} from 'lucide-react';
import { ExistingAccountItem } from '../types.js';
import { BarangaySummaryAnalytics } from './BarangaySummaryAnalytics.js';

export function cleanBarangayName(raw?: string): string {
  if (!raw) return 'UNASSIGNED';
  let str = raw.trim().toUpperCase();
  str = str.replace(/^(BARANGAY|BRGY\.?)\s+/i, '').trim();
  str = str.replace(/^(BARANGAY|BRGY)/i, '').trim();
  str = str.replace(/\bSTA\b\.?/g, 'STA.').replace(/\s+/g, ' ');
  const compact = str.replace(/[\.\s]/g, '');
  if (compact === 'STALUCIA' || compact === 'SANTALUCIA') return 'STA. LUCIA';
  if (compact === 'STONINO' || compact === 'STONIÑO' || compact === 'SANTONINO' || compact === 'SANTONIÑO') return 'STO. NIÑO';
  if (compact === 'WHITEBEACH') return 'WHITE BEACH';
  if (compact === 'TAWAGANSUR') return 'TAWAGAN SUR';
  if (compact === 'TAWAGANNORTE') return 'TAWAGAN NORTE';
  return str;
}

interface ExistDirectoryProps {
  authToken: string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  currentUser?: { username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null;
  onNavigateToSubmitExist?: () => void;
}

export const ExistDirectory: React.FC<ExistDirectoryProps> = ({
  authToken,
  showToast,
  currentUser = null,
  onNavigateToSubmitExist
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
  const userEmail = ((userObj as any)?.email || '').toLowerCase().trim();
  const isMasterAdmin =
    userRole === 'MASTER ADMIN' ||
    userRole === 'MASTER_ADMIN' ||
    userRole === 'MASTERADMIN' ||
    username === 'admin' ||
    username === 'melfeliciano85' ||
    userEmail === 'melfeliciano85@gmail.com';

  const [existingAccounts, setExistingAccounts] = useState<ExistingAccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activePurokFolder, setActivePurokFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderGrouping, setFolderGrouping] = useState<'barangay' | 'purok' | 'table'>('barangay');

  // Modals
  const [selectedItem, setSelectedItem] = useState<ExistingAccountItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSingleAddModal, setShowSingleAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState<ExistingAccountItem | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<ExistingAccountItem | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  // Filters & Pagination & Sorting
  const [selectedBarangay, setSelectedBarangay] = useState<string>('all');
  const [selectedPurokFilter, setSelectedPurokFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'highest' | 'lowest' | 'az'>('highest');
  const [folderPage, setFolderPage] = useState(1);
  const itemsPerPage = 20;

  // Single Add / Edit Form State
  const [editFullName, setEditFullName] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editPurok, setEditPurok] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editAlternateContactNumber, setEditAlternateContactNumber] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editGeotagged, setEditGeotagged] = useState(false);
  const [isGpsCapturing, setIsGpsCapturing] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  // Transfer / Upload State
  const [transferFiles, setTransferFiles] = useState<{ fileName: string; fileData: string; size: number; fileType?: string }[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);

  // Bulk Registration State
  const [bulkText, setBulkText] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Available Barangays list
  const [barangayList, setBarangayList] = useState<string[]>([]);

  // Fetch Existing Accounts
  const fetchExistingAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/existing-accounts?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setExistingAccounts(data);
      } else {
        throw new Error(data.error || 'Failed to load existing accounts directory');
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExistingAccounts();
    fetch(`/api/public/barangays?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.barangays)) {
          setBarangayList(data.barangays);
        }
      })
      .catch(() => {});
  }, [authToken]);

  // Unique Barangays - Sorted by population (highest to lowest by default), then alphabetical
  const uniqueBarangays = useMemo(() => {
    const popMap = new Map<string, number>();
    existingAccounts.forEach(acc => {
      const b = cleanBarangayName(acc.barangay);
      popMap.set(b, (popMap.get(b) || 0) + 1);
    });
    const set = new Set<string>();
    existingAccounts.forEach(acc => {
      if (acc.barangay) set.add(cleanBarangayName(acc.barangay));
    });
    barangayList.forEach(b => set.add(cleanBarangayName(b)));
    return Array.from(set).sort((a, b) => {
      if (sortOrder === 'lowest') {
        const diff = (popMap.get(a) || 0) - (popMap.get(b) || 0);
        if (diff !== 0) return diff;
        return a.localeCompare(b);
      }
      if (sortOrder === 'az') {
        return a.localeCompare(b);
      }
      const diff = (popMap.get(b) || 0) - (popMap.get(a) || 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
  }, [existingAccounts, barangayList, sortOrder]);

  // Barangay Folders - Sorted strictly from highest data population to lowest
  const barangayFolders = useMemo(() => {
    const map = new Map<string, { barangay: string; count: number; puroks: Set<string>; verifiedCount: number; list: ExistingAccountItem[] }>();
    existingAccounts.forEach(acc => {
      const b = cleanBarangayName(acc.barangay);
      if (!map.has(b)) {
        map.set(b, { barangay: b, count: 0, puroks: new Set(), verifiedCount: 0, list: [] });
      }
      const entry = map.get(b)!;
      entry.count++;
      entry.list.push(acc);
      if (acc.purok) entry.puroks.add(acc.purok.trim().toUpperCase());
      if (acc.existingAccVerified || acc.status === 'approved') entry.verifiedCount++;
    });

    return Array.from(map.values())
      .map(item => ({
        barangay: item.barangay,
        count: item.count,
        purokCount: item.puroks.size,
        verifiedCount: item.verifiedCount,
        list: item.list
      }))
      .sort((a, b) => {
        if (sortOrder === 'lowest') {
          return a.count - b.count || a.purokCount - b.purokCount || a.barangay.localeCompare(b.barangay);
        }
        if (sortOrder === 'az') {
          return a.barangay.localeCompare(b.barangay);
        }
        // default 'highest': Highest data population first
        return b.count - a.count || b.purokCount - a.purokCount || a.barangay.localeCompare(b.barangay);
      });
  }, [existingAccounts, sortOrder]);

  // Purok Folders for Active Barangay Folder - Sorted strictly from highest to lowest data population
  const purokFolders = useMemo(() => {
    if (!activeFolder) return [];
    const accountsInBarangay = existingAccounts.filter(
      acc => cleanBarangayName(acc.barangay) === cleanBarangayName(activeFolder)
    );

    const map = new Map<string, { count: number; rawPurok: string }>();
    accountsInBarangay.forEach(acc => {
      const p = (acc.purok || 'No Purok').trim();
      const pKey = p.toUpperCase();
      if (!map.has(pKey)) {
        map.set(pKey, { count: 0, rawPurok: p });
      }
      map.get(pKey)!.count++;
    });

    return Array.from(map.values())
      .map(item => ({ purok: item.rawPurok, count: item.count }))
      .sort((a, b) => {
        if (sortOrder === 'lowest') {
          return a.count - b.count || a.purok.localeCompare(b.purok, undefined, { numeric: true, sensitivity: 'base' });
        }
        if (sortOrder === 'az') {
          return a.purok.localeCompare(b.purok, undefined, { numeric: true, sensitivity: 'base' });
        }
        // default 'highest': Highest data population first
        return b.count - a.count || a.purok.localeCompare(b.purok, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [existingAccounts, activeFolder, sortOrder]);

  // Accounts inside active Barangay folder - Sorted based on Purok folder population (highest to lowest), then Full Name
  const accountsInActiveFolder = useMemo(() => {
    if (!activeFolder) return [];
    const list = existingAccounts.filter(
      acc => cleanBarangayName(acc.barangay) === cleanBarangayName(activeFolder)
    );

    const purokCountMap = new Map<string, number>();
    list.forEach(acc => {
      const p = (acc.purok || 'No Purok').trim().toUpperCase();
      purokCountMap.set(p, (purokCountMap.get(p) || 0) + 1);
    });

    return list.slice().sort((a, b) => {
      const pA = (a.purok || 'No Purok').trim().toUpperCase();
      const pB = (b.purok || 'No Purok').trim().toUpperCase();
      if (sortOrder === 'lowest') {
        const countDiff = (purokCountMap.get(pA) || 0) - (purokCountMap.get(pB) || 0);
        if (countDiff !== 0) return countDiff;
      } else {
        const countDiff = (purokCountMap.get(pB) || 0) - (purokCountMap.get(pA) || 0);
        if (countDiff !== 0) return countDiff;
      }
      const pCmp = pA.localeCompare(pB, undefined, { numeric: true, sensitivity: 'base' });
      if (pCmp !== 0) return pCmp;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [existingAccounts, activeFolder, sortOrder]);

  // Filtered accounts inside folder (by search & purok) - preserves sorting based on Purok
  const filteredAccountsInFolder = useMemo(() => {
    let result = accountsInActiveFolder;
    if (activePurokFolder && activePurokFolder !== 'all' && activePurokFolder !== 'All Puroks' && activePurokFolder !== 'ALL') {
      result = result.filter(
        acc => (acc.purok || 'No Purok').trim().toUpperCase() === activePurokFolder.trim().toUpperCase()
      );
    } else if (selectedPurokFilter !== 'all' && selectedPurokFilter !== 'All Puroks' && selectedPurokFilter !== 'ALL') {
      result = result.filter(
        acc => (acc.purok || 'No Purok').trim().toUpperCase() === selectedPurokFilter.trim().toUpperCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        acc =>
          (acc.full_name || '').toLowerCase().includes(q) ||
          (acc.barangay || '').toLowerCase().includes(q) ||
          (acc.purok || '').toLowerCase().includes(q) ||
          (acc.contact_number || '').includes(q) ||
          (acc.alternate_contact_number || '').includes(q) ||
          (acc.pin || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [accountsInActiveFolder, activePurokFolder, selectedPurokFilter, searchQuery]);

  // Paginated accounts in folder
  const paginatedFolderAccounts = useMemo(() => {
    const start = (folderPage - 1) * itemsPerPage;
    return filteredAccountsInFolder.slice(start, start + itemsPerPage);
  }, [filteredAccountsInFolder, folderPage]);

  const totalPages = Math.ceil(filteredAccountsInFolder.length / itemsPerPage);

  // Bulk parser logic
  const parsedRecords = useMemo(() => {
    if (!bulkText.trim()) return [];
    const lines = bulkText.split('\n');
    return lines
      .map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        let parts: string[] = [];
        if (trimmed.includes('\t')) parts = trimmed.split('\t').map(s => s.trim());
        else if (trimmed.includes('|')) parts = trimmed.split('|').map(s => s.trim());
        else if (trimmed.includes(';')) parts = trimmed.split(';').map(s => s.trim());
        else if (trimmed.includes(',')) parts = trimmed.split(',').map(s => s.trim());
        else parts = [trimmed];

        const fullName = parts[0] || '';
        const b = parts[1] || '';
        const p = parts[2] || '';
        let contact = parts[3] || '';
        if (contact.startsWith("'")) contact = contact.substring(1).trim();
        if (/^9\d{9}$/.test(contact)) contact = '0' + contact;
        let pin = parts[4] || '';
        if (pin.startsWith("'")) pin = pin.substring(1).trim();

        const errors: string[] = [];
        if (!fullName) errors.push('Name is required');
        if (!b) errors.push('Barangay is required');

        return {
          lineIndex: idx + 1,
          raw: trimmed,
          fullName,
          barangay: b.toUpperCase(),
          purok: p,
          contactNumber: contact,
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

  // Handle Bulk submit
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedRecords.length === 0) {
      showToast('Please enter at least one valid record.', 'error');
      return;
    }
    const invalid = parsedRecords.filter(r => !r.isValid);
    if (invalid.length > 0) {
      showToast(`Please fix formatting error on line ${invalid[0].lineIndex}: ${invalid[0].errors.join(', ')}`, 'error');
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
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ accounts: payload })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register bulk accounts.');

      showToast(`Successfully registered ${data.count || parsedRecords.length} patient(s) to Exist. Directory!`, 'success');
      setBulkText('');
      setShowAddModal(false);
      await fetchExistingAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Edit Modal for an item
  const handleOpenEdit = (item: ExistingAccountItem) => {
    setSelectedItem(item);
    setEditFullName(item.full_name || '');
    setEditBarangay(item.barangay || '');
    setEditPurok(item.purok || '');
    setEditContactNumber(item.contact_number || '');
    setEditAlternateContactNumber(item.alternate_contact_number || (item as any).alternateContactNumber || '');
    setEditPin(item.pin || '');
    setEditLatitude(item.latitude !== undefined && item.latitude !== null ? item.latitude.toString() : '');
    setEditLongitude(item.longitude !== undefined && item.longitude !== null ? item.longitude.toString() : '');
    setEditGeotagged(Boolean(item.geotagged));
    setShowManualCoords(Boolean(item.latitude || item.longitude));
    setShowSingleAddModal(true);
  };

  // Open New Single Account Modal
  const handleOpenSingleNew = () => {
    setSelectedItem(null);
    setEditFullName('');
    setEditBarangay(activeFolder || uniqueBarangays[0] || '');
    setEditPurok(activePurokFolder || '');
    setEditContactNumber('');
    setEditAlternateContactNumber('');
    setEditPin('');
    setEditLatitude('');
    setEditLongitude('');
    setEditGeotagged(false);
    setShowManualCoords(false);
    setShowSingleAddModal(true);
  };

  // Save Single Add / Edit
  const handleSaveSingleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim()) {
      showToast('Patient full name is required.', 'error');
      return;
    }
    if (!editBarangay.trim()) {
      showToast('Barangay is required.', 'error');
      return;
    }
    if (!editContactNumber.trim()) {
      showToast('Primary Contact # is required.', 'error');
      return;
    }
    if (!editAlternateContactNumber.trim()) {
      showToast('Alternate Contact # is required.', 'error');
      return;
    }

    setIsSavingRecord(true);
    try {
      const latNum = editLatitude.trim() ? parseFloat(editLatitude.trim()) : undefined;
      const lngNum = editLongitude.trim() ? parseFloat(editLongitude.trim()) : undefined;
      const isGeotagged = Boolean(latNum !== undefined && !isNaN(latNum) && lngNum !== undefined && !isNaN(lngNum));

      const payload = {
        full_name: editFullName.trim().toUpperCase(),
        barangay: editBarangay.trim().toUpperCase(),
        purok: editPurok.trim(),
        contact_number: editContactNumber.trim(),
        alternate_contact_number: editAlternateContactNumber.trim(),
        pin: editPin.trim(),
        latitude: isGeotagged ? latNum : undefined,
        longitude: isGeotagged ? lngNum : undefined,
        geotagged: isGeotagged
      };

      if (selectedItem) {
        // Update
        const res = await fetch(`/api/existing-accounts/${selectedItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update record.');
        setExistingAccounts(prev => prev.map(a => a.id === selectedItem.id ? data : a));
        showToast(`Record for "${data.full_name}" successfully updated!`, 'success');
      } else {
        // Add new
        const res = await fetch('/api/existing-accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create record.');
        setExistingAccounts(prev => [data, ...prev]);
        showToast(`Patient "${data.full_name}" registered to Exist. Directory!`, 'success');
      }

      setShowSingleAddModal(false);
      setSelectedItem(null);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingRecord(false);
    }
  };

  // GPS Sensor Capture
  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      showToast('GPS Geolocation is not supported by your browser.', 'error');
      setShowManualCoords(true);
      return;
    }
    setIsGpsCapturing(true);
    showToast('Acquiring real-time GPS coordinates...', 'info');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setEditLatitude(lat.toFixed(6));
        setEditLongitude(lng.toFixed(6));
        setEditGeotagged(true);
        setIsGpsCapturing(false);
        showToast(`GPS location captured: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'success');
      },
      err => {
        setIsGpsCapturing(false);
        setShowManualCoords(true);
        showToast(`Could not acquire GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Transfer to Submit Exist.
  const handleTransferSubmit = async () => {
    if (!showTransferModal) return;
    setIsTransferring(true);
    try {
      const updatePayload = {
        isSubmitted: true,
        submitToSubmittedExistAcc: true,
        files: transferFiles.map(f => ({
          fileName: f.fileName,
          fileData: f.fileData,
          fileType: f.fileType,
          size: f.size
        })),
        addedToFiles: true
      };

      const res = await fetch(`/api/existing-accounts/${showTransferModal.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(updatePayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to transfer to Submit Exist.');

      setExistingAccounts(prev => prev.map(a => a.id === showTransferModal.id ? data : a));
      showToast(`Successfully submitted "${showTransferModal.full_name}" with ${transferFiles.length} file(s) to Submit Exist.!`, 'success');
      setShowTransferModal(null);
      setTransferFiles([]);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  // Handle transfer file attachment
  const handleTransferFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files) as File[];
    const valid = filesArray.filter(f => f.size <= 25 * 1024 * 1024);
    if (valid.length < filesArray.length) {
      showToast('Some files exceed the 25MB limit and were skipped.', 'warning');
    }

    try {
      const results = await Promise.all(
        valid.map(file => {
          return new Promise<{ fileName: string; fileData: string; size: number; fileType: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                resolve({
                  fileName: file.name,
                  fileData: reader.result,
                  size: file.size,
                  fileType: file.type || 'application/octet-stream'
                });
              } else reject(new Error('Failed reading file'));
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
        })
      );
      setTransferFiles(prev => [...prev, ...results]);
      if (results.length > 0) {
        showToast(`${results.length} document(s) attached for transfer.`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading files', 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Delete Account
  const handleDeleteAccount = async (id: string) => {
    try {
      const res = await fetch(`/api/existing-accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete record.');
      setExistingAccounts(prev => prev.filter(a => a.id !== id));
      showToast('Patient record permanently deleted.', 'success');
      setAccountToDelete(null);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Delete Folder
  const handleDeleteFolder = async (barangay: string) => {
    try {
      const res = await fetch(`/api/existing-accounts/folder/${encodeURIComponent(barangay)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete folder.');
      setExistingAccounts(prev => prev.filter(a => cleanBarangayName(a.barangay) !== cleanBarangayName(barangay)));
      showToast(`Barangay folder "${barangay}" has been deleted.`, 'success');
      setFolderToDelete(null);
      if (activeFolder === barangay) setActiveFolder(null);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar matching PCU Directory */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {activePurokFolder ? (
            <button
              onClick={() => {
                setActivePurokFolder(null);
                setSelectedPurokFilter('all');
                setFolderPage(1);
              }}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Purok Folders
            </button>
          ) : activeFolder ? (
            <button
              onClick={() => {
                setActiveFolder(null);
                setActivePurokFolder(null);
                setSelectedPurokFilter('all');
                setSelectedBarangay('all');
                setSearchQuery('');
                setFolderPage(1);
              }}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Barangay Folders
            </button>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FolderCheck className="w-5 h-5 text-emerald-700" />
            </div>
          )}

          <div>
            <h2 className="text-lg font-extrabold text-slate-800 font-display flex items-center gap-2">
              {activePurokFolder ? (
                <>
                  <FolderOpen className="w-5 h-5 text-emerald-600" />
                  <span>{activeFolder}</span>
                  <span className="text-slate-400 font-normal">/</span>
                  <span className="text-emerald-700">{activePurokFolder} Folder</span>
                </>
              ) : activeFolder ? (
                <>
                  <FolderOpen className="w-5 h-5 text-emerald-600" />
                  {activeFolder} Folder
                </>
              ) : (
                'Exist. Directory (Barangay Folders)'
              )}
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {activePurokFolder
                ? `Showing existing patient records in ${activeFolder} > ${activePurokFolder} (${filteredAccountsInFolder.length} Patients)`
                : activeFolder
                ? `Showing ${purokFolders.length} Purok Folders in ${activeFolder} (Highest to Lowest, ${accountsInActiveFolder.length} Total Patients)`
                : `Organized into ${barangayFolders.length} Barangay Folders (Highest to Lowest Population, ${existingAccounts.length} Total Patients)`}
            </p>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
          {/* Add Single Patient Button */}
          <button
            onClick={handleOpenSingleNew}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            title="Register new single patient"
          >
            <Plus className="w-4 h-4 text-emerald-200" />
            <span>+ Add Patient</span>
          </button>

          {/* Bulk Register Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-teal-700 to-emerald-800 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-500/30"
            title="Bulk register existing patients"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>Bulk Patients</span>
          </button>

          {/* Sync / Refresh Button */}
          <button
            onClick={fetchExistingAccounts}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 border border-slate-700"
            title="Refresh from database"
          >
            <RotateCw className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: BARANGAY FOLDERS OVERVIEW GRID */}
      {!activeFolder && (
        <div className="space-y-6">
          {/* Summary Analytics Dashboard */}
          <BarangaySummaryAnalytics
            barangayFolders={barangayFolders}
            totalBarangaysInSystem={barangayList.length || 296}
            onSelectBarangay={bName => {
              setActiveFolder(bName);
              setSelectedBarangay(bName);
              setActivePurokFolder(null);
              setSearchQuery('');
              setFolderPage(1);
            }}
            onSelectPurok={(bName, pName) => {
              setActiveFolder(bName);
              setSelectedBarangay(bName);
              setActivePurokFolder(pName);
              setSearchQuery('');
              setFolderPage(1);
            }}
          />

          {/* Search & Folder Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative w-full md:max-w-xs lg:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Barangay Folder name or patient..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative min-w-[150px]">
                <select
                  value={selectedBarangay}
                  onChange={e => {
                    const selected = e.target.value;
                    setSelectedBarangay(selected);
                    if (selected === 'all') {
                      setActiveFolder(null);
                      setActivePurokFolder(null);
                    } else {
                      setActiveFolder(selected);
                      setActivePurokFolder(null);
                      setFolderPage(1);
                    }
                  }}
                  className="w-full appearance-none pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl transition-all text-slate-700 font-semibold text-xs outline-none cursor-pointer"
                >
                  <option value="all">All Barangays ({uniqueBarangays.length})</option>
                  {uniqueBarangays.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Sort Order Selector Button */}
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'highest' ? 'lowest' : prev === 'lowest' ? 'az' : 'highest')}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 text-emerald-900 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                title="Change sorting order of folders"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  {sortOrder === 'highest' ? 'Highest Population' : sortOrder === 'lowest' ? 'Lowest Population' : 'Alphabetical (A-Z)'}
                </span>
              </button>

              <div className="text-xs font-bold text-slate-500 flex items-center gap-2 shrink-0">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>{barangayFolders.length} Folders</span>
              </div>
            </div>
          </div>

          {/* Grid of Barangay Folders */}
          {loading && existingAccounts.length === 0 ? (
            <div className="bg-white border border-slate-200/60 rounded-3xl p-16 text-center shadow-xs">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-800 font-extrabold text-sm font-display">Loading Exist. Directory...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {barangayFolders
                .filter(f => !searchQuery.trim() || f.barangay.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((folder, folderIdx) => (
                  <motion.div
                    key={folder.barangay}
                    whileHover={{ y: -3, shadow: '0 8px 20px -4px rgba(0, 0, 0, 0.05)' }}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all overflow-hidden flex flex-col justify-between group cursor-pointer"
                    onClick={() => {
                      setActiveFolder(folder.barangay);
                      setSelectedBarangay(folder.barangay);
                      setActivePurokFolder(null);
                      setSearchQuery('');
                      setFolderPage(1);
                    }}
                  >
                    <div className="p-4 sm:p-4.5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all shadow-xs">
                            <Folder className="w-5 h-5 fill-emerald-100/40 group-hover:fill-white/10 transition-colors" />
                          </div>
                          {sortOrder === 'highest' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200/80 shadow-2xs">
                              #{folderIdx + 1}
                            </span>
                          )}
                        </div>

                        {isMasterAdmin && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setFolderToDelete(folder.barangay);
                            }}
                            className="p-1.5 bg-red-50 hover:bg-red-600 border border-red-100 hover:border-red-600 text-red-600 hover:text-white rounded-lg transition-all cursor-pointer shadow-xs"
                            title="Delete Barangay Folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <h3
                        className="text-sm sm:text-[15px] font-black text-slate-800 font-display group-hover:text-emerald-700 transition-colors capitalize truncate"
                        title={folder.barangay}
                      >
                        {folder.barangay.toLowerCase()}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                        {folder.purokCount} Puroks {sortOrder === 'highest' ? `· Rank #${folderIdx + 1}` : ''}
                      </p>
                    </div>

                    <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs font-black text-emerald-800 group-hover:bg-emerald-50/20 transition-all">
                      <div className="flex items-center gap-2 text-slate-700 font-extrabold text-[11px] px-2.5 py-1 rounded-full bg-emerald-50/90 border border-emerald-200/80 shadow-xs relative overflow-hidden">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-emerald-900 tracking-tight font-black">
                          {folder.count} {folder.count === 1 ? 'Patient' : 'Patients'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </motion.div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: INSIDE ACTIVE BARANGAY FOLDER - PUROK FOLDERS OVERVIEW */}
      {activeFolder && !activePurokFolder && (
        <div className="space-y-4">
          {/* Folder Toolbar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setFolderPage(1);
                }}
                placeholder={`Search inside ${activeFolder} by Purok or patient name...`}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Sort Order Selector Button */}
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'highest' ? 'lowest' : prev === 'lowest' ? 'az' : 'highest')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 text-emerald-900 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                title="Change sorting order of Purok folders"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  {sortOrder === 'highest' ? 'Highest Population' : sortOrder === 'lowest' ? 'Lowest Population' : 'Alphabetical (A-Z)'}
                </span>
              </button>

              {/* Patient Count Badge */}
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 font-extrabold text-xs rounded-xl border border-emerald-200">
                {accountsInActiveFolder.length} Total Patients
              </span>

              {/* Add Patient Button */}
              <button
                onClick={handleOpenSingleNew}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                title={`Add new patient into ${activeFolder}`}
              >
                <Plus className="w-4 h-4 text-emerald-200" />
                <span>+ Add Patient</span>
              </button>

              {isMasterAdmin && (
                <button
                  onClick={() => setFolderToDelete(activeFolder)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Delete this entire Barangay folder"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Folder</span>
                </button>
              )}
            </div>
          </div>

          {/* Purok Folders Grid inside Barangay Folder */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-4.5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Folder className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-display flex items-center gap-1.5">
                    <span>Purok Folders ({purokFolders.length})</span>
                    {activePurokFolder && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-tight">
                        Active: {activePurokFolder}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Click any Purok Folder to open it and view patient records. Folders are sorted from highest to lowest population.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {/* All Puroks Folder Tile */}
              <button
                type="button"
                onClick={() => {
                  setActivePurokFolder('All Puroks');
                  setSelectedPurokFilter('all');
                  setFolderPage(1);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  !activePurokFolder && selectedPurokFilter === 'all'
                    ? 'bg-gradient-to-r from-[#064e3b] to-[#047857] text-white border-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-white hover:bg-emerald-50/50 text-slate-800 border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <FolderOpen className={`w-4 h-4 ${!activePurokFolder && selectedPurokFilter === 'all' ? 'text-emerald-100' : 'text-emerald-600'}`} />
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    !activePurokFolder && selectedPurokFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    ALL
                  </span>
                </div>
                <div className="font-extrabold text-xs truncate">All Puroks</div>
                <div className={`text-[10px] font-medium mt-0.5 ${!activePurokFolder && selectedPurokFilter === 'all' ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {accountsInActiveFolder.length} total
                </div>
              </button>

              {/* Individual Purok Folder Tiles */}
              {purokFolders.map((p, pIdx) => {
                const isActive = (activePurokFolder && activePurokFolder.toUpperCase() === p.purok.toUpperCase()) ||
                  (selectedPurokFilter !== 'all' && selectedPurokFilter.toUpperCase() === p.purok.toUpperCase());
                return (
                  <button
                    key={p.purok}
                    type="button"
                    onClick={() => {
                      setActivePurokFolder(p.purok);
                      setSelectedPurokFilter(p.purok.toUpperCase());
                      setFolderPage(1);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                      isActive
                        ? 'bg-gradient-to-r from-[#064e3b] to-[#047857] text-white border-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white hover:bg-emerald-50/50 text-slate-800 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Folder className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-emerald-100' : 'text-emerald-600'}`} />
                        {sortOrder === 'highest' && (
                          <span className={`text-[9px] font-black px-1 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            #{pIdx + 1}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums ${
                        isActive ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                      }`}>
                        {p.count}
                      </span>
                    </div>
                    <div className="font-extrabold text-xs truncate capitalize" title={p.purok}>
                      {p.purok}
                    </div>
                    <div className={`text-[10px] font-medium mt-0.5 ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {p.count} {p.count === 1 ? 'patient' : 'patients'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: INSIDE ACTIVE PUROK FOLDER - DATA TABLE & RECORDS */}
      {activeFolder && activePurokFolder && (
        <div className="space-y-4">
          {/* Inner Purok Folder Toolbar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => {
                  setActivePurokFolder(null);
                  setSelectedPurokFilter('all');
                  setFolderPage(1);
                }}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border border-emerald-200/80"
                title="Back to Purok Folders"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Purok Folders</span>
              </button>

              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setFolderPage(1);
                  }}
                  placeholder={`Search inside ${activePurokFolder} by name, phone, PIN...`}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Quick Switch Purok Dropdown */}
              <div className="relative min-w-[150px]">
                <select
                  value={activePurokFolder}
                  onChange={e => {
                    const val = e.target.value;
                    setActivePurokFolder(val);
                    setSelectedPurokFilter(val === 'All Puroks' ? 'all' : val.toUpperCase());
                    setFolderPage(1);
                  }}
                  className="w-full appearance-none pl-3.5 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="All Puroks">All Puroks ({accountsInActiveFolder.length})</option>
                  {purokFolders.map(p => (
                    <option key={p.purok} value={p.purok}>
                      {p.purok} ({p.count})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Sort Order Selector Button */}
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'highest' ? 'lowest' : prev === 'lowest' ? 'az' : 'highest')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 text-emerald-900 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                title="Change sorting order"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  {sortOrder === 'highest' ? 'Highest Pop.' : sortOrder === 'lowest' ? 'Lowest Pop.' : 'A - Z'}
                </span>
              </button>

              {/* Patient Count Badge */}
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 font-extrabold text-xs rounded-xl border border-emerald-200">
                {filteredAccountsInFolder.length} Patients
              </span>

              {/* Add Patient into current Purok */}
              <button
                onClick={handleOpenSingleNew}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                title="Register new patient in this Purok"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-200" />
                <span>+ Add Patient</span>
              </button>
            </div>
          </div>

          {/* Patients Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 select-none">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">Full Name</th>
                    <th className="py-3.5 px-4">Barangay</th>
                    <th className="py-3.5 px-4">Purok</th>
                    <th className="py-3.5 px-4">Primary Contact # / Alt #</th>
                    <th className="py-3.5 px-4">PIN Code</th>
                    <th className="py-3.5 px-4 text-center w-52">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedFolderAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <UserIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="font-extrabold text-slate-700 text-sm">No patients found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Add patients using the buttons above.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedFolderAccounts.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center font-bold text-slate-400">
                          {(folderPage - 1) * itemsPerPage + idx + 1}
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{item.full_name}</span>
                            {item.geotagged && (
                              <span className="px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 text-[9px] font-black rounded-sm">
                                Geotagged
                              </span>
                            )}
                            {item.isSubmitted && (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-black rounded-sm">
                                Submitted
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-700">{item.barangay}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold text-xs">
                            <Folder className="w-3 h-3 text-emerald-600" />
                            {item.purok || 'No Purok'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold uppercase text-slate-400">Pri:</span>
                              <span className="font-semibold text-slate-800">{item.contact_number || '—'}</span>
                            </div>
                            {item.alternate_contact_number && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <span className="text-[10px] font-bold uppercase text-slate-400">Alt:</span>
                                <span className="font-medium text-slate-600">{item.alternate_contact_number}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">{item.pin || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Details */}
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            {/* Edit Data */}
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              title="Edit Data"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {/* Confirm Submit to Submit Exist. */}
                            <button
                              onClick={() => {
                                setShowTransferModal(item);
                                setTransferFiles([]);
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Confirm Submit to Submit Exist."
                            >
                              <UploadCloud className="w-3.5 h-3.5 text-emerald-200" />
                              <span>Confirm Submit</span>
                            </button>

                            {/* Delete */}
                            {isMasterAdmin && (
                              <button
                                onClick={() => setAccountToDelete(item)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="Delete Account"
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                <div>
                  Page <span className="text-slate-800 font-extrabold">{folderPage}</span> of{' '}
                  <span className="text-slate-800 font-extrabold">{totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFolderPage(p => Math.max(1, p - 1))}
                    disabled={folderPage === 1}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFolderPage(p => Math.min(totalPages, p + 1))}
                    disabled={folderPage === totalPages}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: BULK REGISTER ACCOUNTS */}
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
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display">Bulk Register Existing Accounts</h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Enter multiple patient profiles at once to save into Exist. Directory
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleBulkSubmit} className="flex-1 flex flex-col min-h-0">
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-4 text-xs text-emerald-900 font-semibold space-y-2">
                    <p className="font-extrabold text-sm flex items-center gap-2">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">FORMAT</span>
                      <span>Full Name | Barangay | Purok | Contact # | PIN Code (optional)</span>
                    </p>
                    <p className="text-emerald-700 font-medium">
                      Supports Pipe (|), Tab (Excel/Google Sheets copy paste), or Comma separation:
                    </p>
                    <pre className="font-mono bg-white/80 p-2.5 rounded-lg border border-emerald-200 text-slate-700 select-all block text-[11px]">
                      JUAN DELA CRUZ | DAMPALAN | Purok Mabuhay | 09171234567 | 12-345678901-2{'\n'}
                      MARIA SANTIAGO	KALINGAYAN	Narra	09228881122	23-456789012-3
                    </pre>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                        Paste / Type Data Here *
                      </label>
                      <textarea
                        required
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                        placeholder="Paste records here..."
                        rows={9}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all leading-relaxed"
                      />
                    </div>

                    <div className="space-y-1.5 flex flex-col min-h-0">
                      <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                        Live Parsing Preview ({parsedRecords.length})
                      </label>
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-[220px] overflow-y-auto space-y-2 text-xs">
                        {parsedRecords.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-4">
                            <FileText className="w-6 h-6 mb-1 text-slate-300" />
                            <p className="text-xs">No records parsed yet.</p>
                          </div>
                        ) : (
                          parsedRecords.map((rec, idx) => (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-xl border ${
                                rec.isValid ? 'bg-white border-emerald-100' : 'bg-rose-50 border-rose-100'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                <span className="text-slate-400">Line #{rec.lineIndex}</span>
                                {rec.isValid ? (
                                  <span className="text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Valid
                                  </span>
                                ) : (
                                  <span className="text-rose-600 flex items-center gap-1">
                                    <X className="w-3 h-3" /> Error
                                  </span>
                                )}
                              </div>
                              <p className="font-extrabold text-slate-800 mt-0.5">{rec.fullName}</p>
                              <p className="text-[10px] text-slate-500">
                                {rec.barangay} · {rec.purok || 'No Purok'} · {rec.contactNumber || 'No Phone'}
                              </p>
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
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting || parsedRecords.length === 0}
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    {formSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{formSubmitting ? 'Registering...' : `Register Bulk Accounts (${parsedRecords.length})`}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: SINGLE ADD / EDIT MODAL */}
      <AnimatePresence>
        {showSingleAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm font-display">
                      {selectedItem ? 'Edit Account Data' : 'Add New Account'}
                    </h3>
                    <p className="text-xs text-slate-400">Save permanently to Exist. Directory</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSingleAddModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveSingleAccount} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={e => setEditFullName(e.target.value)}
                    placeholder="e.g. JUAN DELA CRUZ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-semibold text-slate-800 outline-none uppercase"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Barangay *
                    </label>
                    <input
                      type="text"
                      required
                      value={editBarangay}
                      onChange={e => setEditBarangay(e.target.value)}
                      placeholder="e.g. DAMPALAN"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-semibold text-slate-800 outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Purok
                    </label>
                    <input
                      type="text"
                      value={editPurok}
                      onChange={e => setEditPurok(e.target.value)}
                      placeholder="e.g. Purok 1"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Primary Contact # <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editContactNumber}
                      onChange={e => setEditContactNumber(e.target.value)}
                      placeholder="e.g. 09171234567"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-mono font-semibold text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      PhilHealth / PIN
                    </label>
                    <input
                      type="text"
                      value={editPin}
                      onChange={e => setEditPin(e.target.value)}
                      placeholder="e.g. 12-345678901-2"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-mono font-semibold text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Alternate Contact # <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editAlternateContactNumber}
                    onChange={e => setEditAlternateContactNumber(e.target.value)}
                    placeholder="e.g. 09987654321"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-mono font-semibold text-slate-800 outline-none"
                  />
                </div>

                {/* Geotag GPS */}
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Geotag Coordinates
                    </span>
                    <button
                      type="button"
                      onClick={handleCaptureGPS}
                      disabled={isGpsCapturing}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {isGpsCapturing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
                      <span>Acquire Device GPS</span>
                    </button>
                  </div>
                  {(showManualCoords || editLatitude || editLongitude) && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Latitude"
                        value={editLatitude}
                        onChange={e => setEditLatitude(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Longitude"
                        value={editLongitude}
                        onChange={e => setEditLongitude(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowSingleAddModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRecord}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    {isSavingRecord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSavingRecord ? 'Saving...' : 'Save Permanently'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: TRANSFER TO SUBMIT EXIST. (WITH DOCUMENT ATTACHMENTS) */}
      <AnimatePresence>
        {showTransferModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              <div className="bg-gradient-to-r from-emerald-800 to-teal-900 px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm font-display">Confirm Submit</h3>
                    <p className="text-xs text-emerald-200/80">Submit record and upload medical attachments to Submit Exist.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTransferModal(null)}
                  className="p-1.5 bg-black/20 hover:bg-black/40 rounded-lg text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <h4 className="font-black text-slate-800 text-sm">{showTransferModal.full_name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Barangay: <strong className="text-emerald-800">{showTransferModal.barangay}</strong> · Purok:{' '}
                    {showTransferModal.purok || 'N/A'}
                  </p>
                </div>

                {/* Upload attachments input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Attach Documents / Proof (PDF, Images)
                  </label>
                  <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50">
                    <Paperclip className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-700">Click to Browse Files</span>
                    <span className="text-[10px] text-slate-400">PDF, JPG, PNG up to 25MB each</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,application/pdf"
                      onChange={handleTransferFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Staged files list */}
                {transferFiles.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {transferFiles.map((f, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-slate-700 truncate max-w-[280px]">{f.fileName}</span>
                        <button
                          onClick={() => setTransferFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setShowTransferModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTransferSubmit}
                    disabled={isTransferring}
                    className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md"
                  >
                    {isTransferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    <span>{isTransferring ? 'Submitting...' : 'Confirm Submit'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: VIEW DETAILS MODAL */}
      <AnimatePresence>
        {selectedItem && !showSingleAddModal && !showTransferModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              <div className="bg-slate-900 px-6 py-5 flex items-center justify-between text-white">
                <div>
                  <h3 className="font-extrabold text-base font-display">{selectedItem.full_name}</h3>
                  <p className="text-xs text-slate-400">Account Details & Telemetry</p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Barangay</span>
                    <span className="font-black text-slate-800 text-sm">{selectedItem.barangay}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Purok</span>
                    <span className="font-bold text-slate-700 text-sm">{selectedItem.purok || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Primary Contact #</span>
                    <span className="font-mono font-bold text-slate-700">{selectedItem.contact_number || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Alternate Contact #</span>
                    <span className="font-mono font-bold text-slate-700">{selectedItem.alternate_contact_number || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">PhilHealth / PIN</span>
                    <span className="font-mono font-bold text-slate-700">{selectedItem.pin || '—'}</span>
                  </div>
                  {selectedItem.facebookLink && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Facebook</span>
                      <a
                        href={selectedItem.facebookLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 underline font-semibold flex items-center gap-1"
                      >
                        <Facebook className="w-3.5 h-3.5" />
                        {selectedItem.facebookLink}
                      </a>
                    </div>
                  )}
                  {selectedItem.latitude && selectedItem.longitude && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Coordinates</span>
                      <span className="font-mono text-slate-700">
                        {selectedItem.latitude}, {selectedItem.longitude}
                      </span>
                    </div>
                  )}
                </div>

                {/* Uploaded files if any */}
                {selectedItem.uploadedFiles && selectedItem.uploadedFiles.length > 0 && (
                  <div>
                    <h5 className="font-extrabold text-slate-700 mb-2">Attached Documents ({selectedItem.uploadedFiles.length})</h5>
                    <div className="space-y-1.5">
                      {selectedItem.uploadedFiles.map((file, i) => (
                        <div
                          key={i}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                        >
                          <span className="font-semibold text-slate-800 truncate">{file.name || file.fileName}</span>
                          <a
                            href={file.url || file.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold flex items-center gap-1 text-[11px]"
                          >
                            <ExternalLink className="w-3 h-3" /> View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      const item = selectedItem;
                      setSelectedItem(null);
                      handleOpenEdit(item);
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Data</span>
                  </button>
                  <button
                    onClick={() => {
                      const item = selectedItem;
                      setSelectedItem(null);
                      setShowTransferModal(item);
                      setTransferFiles([]);
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Confirm Submit</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATIONS */}
      {accountToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h4 className="font-black text-slate-800 text-base">Delete Account Record?</h4>
            <p className="text-xs text-slate-500">
              Are you sure you want to permanently delete "{accountToDelete.full_name}" from Exist. Directory?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setAccountToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAccount(accountToDelete.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {folderToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h4 className="font-black text-slate-800 text-base">Delete Barangay Folder?</h4>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete folder "{folderToDelete}" and all its existing accounts?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteFolder(folderToDelete)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
