import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Paperclip,
  Plus,
  Search,
  X,
  RotateCw,
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Edit2,
  ChevronDown,
  UploadCloud,
  Database,
  Copy,
  Check,
  Eye,
  MapPin,
  Clock,
  AlertCircle,
  Grid,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  RotateCcw,
  Undo2,
  Layers,
  ArrowLeft,
  Filter
} from 'lucide-react';
import { PortalAttachmentItem, PortalAttachmentFile } from '../types.js';

const DEFAULT_BARANGAYS_LIST = [
  'Balangasan',
  'Banale',
  'Buenavista',
  'Bulatok',
  'Dampalan',
  'Dao',
  'Dumagoc',
  'Dumalinao',
  'Kalingayan',
  'Kawit',
  'Lumbia',
  'Muricay',
  'Napolan',
  'Navalan',
  'San Francisco',
  'San Jose',
  'San Pedro',
  'Santa Maria',
  'Santiago',
  'Santo Niño',
  'Sta. Lucia',
  'Tawagan Sur',
  'Tiguma',
  'Tuburan',
  'White Beach'
];

type SectionTab = 'VERIFICATION' | 'PENDING' | 'APPROVED' | 'RETURNED';

interface PortalAttachmentProps {
  authToken: string | null;
  currentUser?: { username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const PortalAttachment: React.FC<PortalAttachmentProps> = ({
  authToken,
  currentUser,
  showToast
}) => {
  // Data States
  const [items, setItems] = useState<PortalAttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [barangayList, setBarangayList] = useState<string[]>([]);

  // Section Tab State: VERIFICATION | PENDING | APPROVED | RETURNED
  const [activeSection, setActiveSection] = useState<SectionTab>('VERIFICATION');

  // Barangay Folder Navigation State: null = view all folders in section, string = opened folder
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPurok, setSelectedPurok] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name' | 'files'>('newest');

  // Pagination States: 10 rows x 5 columns = 50 records per page
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;
  const gridTopRef = useRef<HTMLDivElement>(null);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [viewItem, setViewItem] = useState<PortalAttachmentItem | null>(null);
  const [editItem, setEditItem] = useState<PortalAttachmentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalAttachmentItem | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Return Action Modal State
  const [returnTarget, setReturnTarget] = useState<PortalAttachmentItem | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [isProcessingStatus, setIsProcessingStatus] = useState(false);

  // Central Confirmation Modal State (Approve, Pending, Return, Delete, RTV)
  const [actionConfirmation, setActionConfirmation] = useState<{
    type: 'APPROVE' | 'PENDING' | 'RETURN' | 'RTV' | 'DELETE';
    item: PortalAttachmentItem;
  } | null>(null);
  const [actionReturnReason, setActionReturnReason] = useState('');

  // Form State for Add / Edit
  const [fullName, setFullName] = useState('');
  const [barangay, setBarangay] = useState('');
  const [purok, setPurok] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<PortalAttachmentFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user is an administrator
  const roleUpper = (currentUser?.role || '').toUpperCase();
  const isMasterAdmin = roleUpper.includes('ADMIN') || roleUpper.includes('LEADER') || roleUpper.includes('IT') || currentUser?.username?.toLowerCase() === 'admin';

  // Fetch portal attachment records
  const fetchPortalAttachments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal-attachments?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to load portal attachments.');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch barangays for dropdown (Barangay Table)
  useEffect(() => {
    fetchPortalAttachments();
    fetch(`/api/public/barangays?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.barangays) && data.barangays.length > 0) {
          setBarangayList(data.barangays);
        }
      })
      .catch(() => {});
  }, [authToken]);

  // Derived unique barangays
  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.barangay && i.barangay.trim()) set.add(i.barangay.trim());
    });
    barangayList.forEach(b => {
      if (b && b.trim()) set.add(b.trim());
    });
    if (set.size === 0) {
      DEFAULT_BARANGAYS_LIST.forEach(b => set.add(b));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, barangayList]);

  // Section Counts
  const sectionCounts = useMemo(() => {
    let verification = 0;
    let pending = 0;
    let approved = 0;
    let returned = 0;

    items.forEach(item => {
      const st = (item.status || 'VERIFICATION').toUpperCase();
      if (st === 'VERIFICATION' || st === 'SUBMITTED') {
        verification++;
      } else if (st === 'PENDING') {
        pending++;
      } else if (st === 'APPROVED' || st === 'VERIFIED') {
        approved++;
      } else if (st === 'RETURNED') {
        returned++;
      }
    });

    return { verification, pending, approved, returned };
  }, [items]);

  // Items filtered strictly by active section tab
  const sectionItems = useMemo(() => {
    return items.filter(item => {
      const st = (item.status || 'VERIFICATION').toUpperCase();
      if (activeSection === 'VERIFICATION') {
        return st === 'VERIFICATION' || st === 'SUBMITTED';
      }
      if (activeSection === 'PENDING') {
        return st === 'PENDING';
      }
      if (activeSection === 'APPROVED') {
        return st === 'APPROVED' || st === 'VERIFIED';
      }
      if (activeSection === 'RETURNED') {
        return st === 'RETURNED';
      }
      return false;
    });
  }, [items, activeSection]);

  // Group section items into Barangay Folders
  const barangayFoldersMap = useMemo(() => {
    const map = new Map<string, PortalAttachmentItem[]>();

    sectionItems.forEach(item => {
      const b = (item.barangay || 'General / Unassigned').trim();
      if (!map.has(b)) {
        map.set(b, []);
      }
      map.get(b)!.push(item);
    });

    return map;
  }, [sectionItems]);

  // Array of folder info for folder cards display
  const barangayFoldersList = useMemo(() => {
    const list: {
      barangay: string;
      itemsCount: number;
      filesCount: number;
      previewImages: string[];
      lastUpdated?: string;
    }[] = [];

    // Prioritize barangays that have items in this section
    barangayFoldersMap.forEach((folderItems, bg) => {
      let totalFiles = 0;
      const images: string[] = [];

      folderItems.forEach(item => {
        const atts = item.attachments || [];
        totalFiles += atts.length;
        atts.forEach(a => {
          if (images.length < 3 && a.url && (a.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)/i.test(a.name || ''))) {
            images.push(a.url);
          }
        });
      });

      list.push({
        barangay: bg,
        itemsCount: folderItems.length,
        filesCount: totalFiles,
        previewImages: images,
        lastUpdated: folderItems[0]?.uploaded_at || folderItems[0]?.created_at
      });
    });

    // Sort folders alphabetically by barangay name
    list.sort((a, b) => a.barangay.localeCompare(b.barangay));
    return list;
  }, [barangayFoldersMap]);

  // Filtered folders by search query (when viewing folder view)
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return barangayFoldersList;
    const q = searchQuery.toLowerCase().trim();
    return barangayFoldersList.filter(f => f.barangay.toLowerCase().includes(q));
  }, [barangayFoldersList, searchQuery]);

  // Items inside currently opened folder (or all section items if searching across all)
  const itemsInCurrentFolder = useMemo(() => {
    if (!selectedFolder) return [];
    return barangayFoldersMap.get(selectedFolder) || [];
  }, [selectedFolder, barangayFoldersMap]);

  // Derived puroks for current folder
  const folderPuroks = useMemo(() => {
    const set = new Set<string>();
    itemsInCurrentFolder.forEach(i => {
      if (i.purok && i.purok.trim()) set.add(i.purok.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [itemsInCurrentFolder]);

  // Filtered & Sorted items inside current folder
  const filteredFolderItems = useMemo(() => {
    let result = [...itemsInCurrentFolder];

    // Purok filter
    if (selectedPurok !== 'all') {
      result = result.filter(i => (i.purok || '').toLowerCase() === selectedPurok.toLowerCase());
    }

    // Search query inside folder
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(i =>
        (i.full_name || '').toLowerCase().includes(q) ||
        (i.purok || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q) ||
        (i.uploaded_by || '').toLowerCase().includes(q) ||
        (i.attachments || []).some(att => (att.name || '').toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortOrder === 'oldest') {
        return new Date(a.created_at || a.uploaded_at || 0).getTime() - new Date(b.created_at || b.uploaded_at || 0).getTime();
      }
      if (sortOrder === 'name') {
        return (a.full_name || '').localeCompare(b.full_name || '');
      }
      if (sortOrder === 'files') {
        return (b.attachments?.length || 0) - (a.attachments?.length || 0);
      }
      return new Date(b.created_at || b.uploaded_at || 0).getTime() - new Date(a.created_at || a.uploaded_at || 0).getTime();
    });

    return result;
  }, [itemsInCurrentFolder, selectedPurok, searchQuery, sortOrder]);

  // Pagination for grid inside folder (10 rows x 5 columns = 50 items/page)
  const totalPages = Math.max(1, Math.ceil(filteredFolderItems.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFolder, activeSection, searchQuery, selectedPurok, sortOrder]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedFolderItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFolderItems.slice(start, start + pageSize);
  }, [filteredFolderItems, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // Convert File to Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle multi-file selection (supports uploading multiple times to append)
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newAttachments: PortalAttachmentFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await readFileAsBase64(file);
        newAttachments.push({
          name: file.name,
          url: base64,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        });
      }
      setAttachments(prev => [...prev, ...newAttachments]);
      showToast(`Added ${newAttachments.length} file(s).`, 'success');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      showToast('Error reading selected file(s).', 'error');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Open Add modal
  const handleOpenAddModal = () => {
    setEditItem(null);
    setFullName('');
    setBarangay(selectedFolder || currentUser?.barangay || '');
    setPurok('');
    setNotes('');
    setAttachments([]);
    setShowAddModal(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (item: PortalAttachmentItem) => {
    setEditItem(item);
    setFullName(item.full_name);
    setBarangay(item.barangay);
    setPurok(item.purok || '');
    setNotes(item.notes || '');
    setAttachments(item.attachments || []);
    setShowAddModal(true);
  };

  // Save / Update Form Submission
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('Full Name is required.', 'warning');
      return;
    }
    if (!barangay.trim()) {
      showToast('Barangay is required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = Boolean(editItem && editItem.id);
      const url = isEdit ? `/api/portal-attachments/${editItem!.id}` : '/api/portal-attachments';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        full_name: fullName.trim().toUpperCase(),
        barangay: barangay.trim(),
        purok: purok.trim(),
        attachments,
        notes: notes.trim(),
        status: editItem?.status || 'VERIFICATION'
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save portal attachment record.');

      showToast(
        isEdit
          ? `Record for "${fullName}" updated successfully.`
          : `Portal attachment for "${fullName}" saved to VERIFICATION section.`,
        'success'
      );

      setShowAddModal(false);
      await fetchPortalAttachments();

      // If created in currently selected folder, keep it open; otherwise open that barangay folder
      setSelectedFolder(barangay.trim());
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Transitions (Approve, Pending, Return, RTV)
  const handleUpdateStatus = async (
    itemId: string,
    targetStatus: 'VERIFICATION' | 'PENDING' | 'APPROVED' | 'RETURNED',
    reasonText?: string
  ) => {
    setIsProcessingStatus(true);
    try {
      const res = await fetch(`/api/portal-attachments/${itemId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          status: targetStatus,
          return_reason: reasonText || ''
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update record status.');

      if (targetStatus === 'APPROVED') {
        showToast('Record approved successfully and transferred to APPROVED section.', 'success');
      } else if (targetStatus === 'PENDING') {
        showToast('Record moved to PENDING section.', 'info');
      } else if (targetStatus === 'RETURNED') {
        showToast('Record returned and sent to Returned page for resubmission.', 'warning');
      } else if (targetStatus === 'VERIFICATION') {
        showToast('Record returned to VERIFICATION section (RTV).', 'success');
      }

      // Close modals if open
      setReturnTarget(null);
      setReturnReason('');
      if (viewItem && viewItem.id === itemId) {
        setViewItem(null);
      }

      await fetchPortalAttachments();
    } catch (err: any) {
      showToast(err.message || 'Error updating status', 'error');
    } finally {
      setIsProcessingStatus(false);
    }
  };

  // Open Confirmation Modal in center of screen for Approve, Pending, Return, Delete, RTV
  const handleOpenConfirmAction = (
    type: 'APPROVE' | 'PENDING' | 'RETURN' | 'RTV' | 'DELETE',
    item: PortalAttachmentItem
  ) => {
    setActionReturnReason(item.return_reason || '');
    setActionConfirmation({ type, item });
  };

  const handleExecuteConfirmedAction = async () => {
    if (!actionConfirmation) return;
    const { type, item } = actionConfirmation;

    if (type === 'DELETE') {
      setIsProcessingStatus(true);
      try {
        const res = await fetch(`/api/portal-attachments/${item.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete record.');

        showToast(`Record "${item.full_name}" deleted permanently.`, 'success');
        setActionConfirmation(null);
        if (viewItem && viewItem.id === item.id) setViewItem(null);
        await fetchPortalAttachments();
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setIsProcessingStatus(false);
      }
    } else if (type === 'RETURN') {
      const finalReason = actionReturnReason.trim() || 'Returned by administrator for corrections / resubmission';
      await handleUpdateStatus(item.id, 'RETURNED', finalReason);
      setActionConfirmation(null);
      setActionReturnReason('');
    } else if (type === 'APPROVE') {
      await handleUpdateStatus(item.id, 'APPROVED');
      setActionConfirmation(null);
    } else if (type === 'PENDING') {
      await handleUpdateStatus(item.id, 'PENDING');
      setActionConfirmation(null);
    } else if (type === 'RTV') {
      await handleUpdateStatus(item.id, 'VERIFICATION');
      setActionConfirmation(null);
    }
  };

  // Open Return Modal
  const handleOpenReturnModal = (item: PortalAttachmentItem) => {
    handleOpenConfirmAction('RETURN', item);
  };

  const handleConfirmReturn = async () => {
    if (!actionConfirmation || actionConfirmation.type !== 'RETURN') return;
    await handleExecuteConfirmedAction();
  };

  // Delete Action
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/portal-attachments/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete record.');

      showToast(`Record "${deleteTarget.full_name}" deleted permanently.`, 'success');
      setDeleteTarget(null);
      if (viewItem && viewItem.id === deleteTarget.id) setViewItem(null);
      await fetchPortalAttachments();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (att: PortalAttachmentFile) => {
    if (att.type?.startsWith('image/')) return true;
    const ext = (att.name || '').split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext || '');
  };

  return (
    <div className="space-y-6">
      {/* 4 SECTION TABS: VERIFICATION, PENDING, APPROVED, RETURNED */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-xs flex flex-wrap items-center gap-1.5">
        {(
          [
            { id: 'VERIFICATION', label: 'VERIFICATION', count: sectionCounts.verification, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
            { id: 'PENDING', label: 'PENDING', count: sectionCounts.pending, color: 'text-amber-700 bg-amber-50 border-amber-200' },
            { id: 'APPROVED', label: 'APPROVED', count: sectionCounts.approved, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { id: 'RETURNED', label: 'RETURNED', count: sectionCounts.returned, color: 'text-rose-700 bg-rose-50 border-rose-200' },
          ] as const
        ).map(tab => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveSection(tab.id);
                setSelectedFolder(null); // Return to folder selection view when changing section tab
                setSearchQuery('');
              }}
              className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  isActive ? 'bg-white/20 text-white border-white/30' : tab.color
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}

        {/* Sync Button */}
        <button
          type="button"
          onClick={fetchPortalAttachments}
          disabled={loading}
          className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200"
          title="Refresh submissions"
        >
          <RotateCw className={`w-4 h-4 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* VIEW LEVEL 1: BARANGAY FOLDERS VIEW (When no specific folder is selected) */}
      {!selectedFolder && (
        <div className="space-y-4">
          {/* Folders Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search barangay folders..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
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

            <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-black">
                {filteredFolders.length} Barangay Folder{filteredFolders.length === 1 ? '' : 's'} in {activeSection}
              </span>
              <span className="text-slate-400 font-medium">
                ({sectionItems.length} total records)
              </span>
            </div>
          </div>

          {/* Barangay Folders Cards Grid */}
          {loading ? (
            <div className="bg-white border border-slate-200/60 rounded-3xl p-16 text-center shadow-xs">
              <RotateCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-3" />
              <p className="text-slate-800 font-extrabold text-sm font-display">Loading Barangay Folders...</p>
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-14 text-center shadow-xs space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center mx-auto">
                <Folder className="w-8 h-8 opacity-60" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">
                  No Submissions in {activeSection}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {activeSection === 'VERIFICATION'
                    ? 'Submissions saved and submitted from "My Drafts" will appear here under their respective Barangay Folders.'
                    : `No records currently in ${activeSection} status.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredFolders.map(folder => (
                <motion.div
                  key={folder.barangay}
                  whileHover={{ y: -4 }}
                  onClick={() => {
                    setSelectedFolder(folder.barangay);
                    setSearchQuery('');
                  }}
                  className="bg-white border border-slate-200/90 hover:border-emerald-500 rounded-2xl p-5 shadow-xs hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    {/* Top Folder Icon & Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-600/20 text-emerald-700 border border-emerald-300/40 flex items-center justify-center group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                        <Folder className="w-6 h-6" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {folder.itemsCount} {folder.itemsCount === 1 ? 'Record' : 'Records'}
                      </span>
                    </div>

                    {/* Barangay Title */}
                    <h3 className="text-base font-black text-slate-800 tracking-tight font-display truncate uppercase group-hover:text-emerald-700 transition-colors">
                      {folder.barangay}
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
                      <Paperclip className="w-3 h-3 text-emerald-600" />
                      <span>{folder.filesCount} attached {folder.filesCount === 1 ? 'file' : 'files'}</span>
                    </p>
                  </div>

                  {/* Bottom Preview & Open Action */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    {/* Quick image thumbnail preview */}
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {folder.previewImages.length > 0 ? (
                        folder.previewImages.map((imgUrl, idx) => (
                          <img
                            key={idx}
                            src={imgUrl}
                            alt=""
                            className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover shadow-xs"
                          />
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Ready</span>
                      )}
                    </div>

                    <span className="text-[11px] font-black text-emerald-700 group-hover:text-emerald-800 flex items-center gap-1">
                      <span>Open Folder</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW LEVEL 2: INSIDE A BARANGAY FOLDER (10 Rows x 5 Columns Grid with Cover Image & Status Actions) */}
      {selectedFolder && (
        <div ref={gridTopRef} className="space-y-4">
          {/* Breadcrumb & Folder Navigation Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedFolder(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Back to all Barangay Folders"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Folders</span>
              </button>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <span>/</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase font-black">
                  {activeSection}
                </span>
                <span>/</span>
                <h2 className="text-slate-800 font-black text-sm uppercase flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-emerald-600" />
                  <span>Barangay {selectedFolder}</span>
                </h2>
              </div>
            </div>

            {/* Folder Filters & Search */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search within this folder */}
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search in folder..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Purok Selector */}
              {folderPuroks.length > 0 && (
                <div className="relative min-w-[110px]">
                  <select
                    value={selectedPurok}
                    onChange={e => setSelectedPurok(e.target.value)}
                    className="w-full appearance-none pl-3 pr-7 py-1.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="all">All Puroks</option>
                    {folderPuroks.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>
              )}

              {/* Sorter */}
              <div className="relative min-w-[120px]">
                <select
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as any)}
                  className="w-full appearance-none pl-3 pr-7 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 focus:border-emerald-500 rounded-xl text-xs font-black outline-none cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="files">Most Files</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-700">
                  <ChevronDown className="w-3 h-3" />
                </div>
              </div>

              <div className="text-xs font-bold text-slate-500 pl-1 shrink-0 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black">
                  {filteredFolderItems.length} Records
                </span>
                {filteredFolderItems.length > 0 && (
                  <span className="text-slate-400 font-semibold text-[11px]">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 5-COLUMN GRID (10 ROWS x 5 COLUMNS) */}
          {filteredFolderItems.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center shadow-xs space-y-3">
              <Paperclip className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-black text-slate-800">No Records Found in this Folder</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No submissions matching your current search or filters inside Barangay {selectedFolder}.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-3.5">
                {paginatedFolderItems.map(item => {
                  const fileCount = item.attachments?.length || 0;
                  const firstImage = (item.attachments || []).find(isImageFile);
                  const coverAttachment = firstImage || item.attachments?.[0];
                  const isCoverImage = coverAttachment ? isImageFile(coverAttachment) : false;

                  return (
                    <motion.div
                      key={item.id}
                      whileHover={{ y: -3, shadow: '0 12px 28px -6px rgba(0, 0, 0, 0.08)' }}
                      className="bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-emerald-400 transition-all overflow-hidden flex flex-col justify-between group"
                    >
                      {/* 1. Cover Image in Front */}
                      <div
                        onClick={() => setViewItem(item)}
                        className="relative h-40 sm:h-44 w-full bg-slate-900 overflow-hidden cursor-pointer group/cover select-none"
                        title="Click to view full submission and all attached files"
                      >
                        {coverAttachment && isCoverImage && coverAttachment.url ? (
                          <img
                            src={coverAttachment.url}
                            alt={coverAttachment.name || item.full_name}
                            className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
                          />
                        ) : coverAttachment ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-950 text-emerald-200">
                            <FileText className="w-10 h-10 text-emerald-400 mb-1.5 opacity-85 group-hover/cover:scale-110 transition-transform" />
                            <p className="text-xs font-bold text-white text-center truncate max-w-[190px]">
                              {coverAttachment.name}
                            </p>
                            <span className="text-[10px] text-emerald-300 font-semibold mt-0.5">
                              {formatFileSize(coverAttachment.size)}
                            </span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-slate-100 text-slate-400">
                            <Paperclip className="w-8 h-8 mb-1 opacity-50" />
                            <span className="text-xs font-semibold">No attachments</span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/35 pointer-events-none" />

                        {/* Top Badges */}
                        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 pointer-events-none">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-white/95 backdrop-blur-md text-slate-900 shadow-sm border border-white/50">
                            {item.status || 'VERIFICATION'}
                          </span>
                          {fileCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-950/85 backdrop-blur-md text-white shadow-sm flex items-center gap-1 border border-white/20">
                              <Paperclip className="w-3 h-3 text-emerald-400" />
                              <span>{fileCount}</span>
                            </span>
                          )}
                        </div>

                        {/* Hover Overlay Hint */}
                        <div className="absolute inset-0 bg-emerald-950/35 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center z-10">
                          <span className="px-3 py-1.5 rounded-xl bg-white text-emerald-900 font-extrabold text-[11px] shadow-xl flex items-center gap-1.5 transform translate-y-1 group-hover/cover:translate-y-0 transition-all">
                            <Eye className="w-3.5 h-3.5 text-emerald-700" />
                            <span>View ({fileCount})</span>
                          </span>
                        </div>
                      </div>

                      {/* 2. Card Content Details */}
                      <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <h3
                            onClick={() => setViewItem(item)}
                            className="font-black text-slate-900 text-sm font-display tracking-tight truncate hover:text-emerald-700 transition-colors uppercase cursor-pointer"
                            title={item.full_name}
                          >
                            {item.full_name}
                          </h3>

                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center gap-1 truncate max-w-full">
                              <MapPin className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              <span className="truncate">{item.barangay}</span>
                            </span>
                            {item.purok && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[100px]">
                                {item.purok}
                              </span>
                            )}
                          </div>

                          {/* Reason for Return if returned */}
                          {item.status === 'RETURNED' && item.return_reason && (
                            <div className="p-2 bg-rose-50 border border-rose-200/80 rounded-xl mt-1.5 text-[10px] text-rose-800 font-medium">
                              <strong className="block font-black uppercase text-[9px] text-rose-900">Return Reason:</strong>
                              <span className="line-clamp-2">{item.return_reason}</span>
                            </div>
                          )}

                          {item.notes && item.status !== 'RETURNED' && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50/80 p-2 rounded-xl border border-slate-100 mt-1.5 font-medium">
                              {item.notes}
                            </p>
                          )}
                        </div>

                        {/* Upload Meta */}
                        <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between pt-1">
                          <span className="truncate max-w-[100px]">by <strong className="text-slate-600">{item.uploaded_by || 'Staff'}</strong></span>
                          {item.uploaded_at && (
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock className="w-2.5 h-2.5 text-slate-400" />
                              {item.uploaded_at.split('T')[0] || item.uploaded_at}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3. Card Action Footer - Specific Buttons Per Section */}
                      <div className="p-2.5 bg-slate-50/90 border-t border-slate-100 space-y-1.5">
                        {/* Section-Specific Action Buttons */}
                        {activeSection === 'VERIFICATION' && (
                          <div className="grid grid-cols-3 gap-1">
                            {/* Approve */}
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmAction('APPROVE', item)}
                              disabled={isProcessingStatus}
                              className="py-1 px-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                              title="Approve submission"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>

                            {/* Pending */}
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmAction('PENDING', item)}
                              disabled={isProcessingStatus}
                              className="py-1 px-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                              title="Mark as Pending"
                            >
                              <Clock className="w-3 h-3" />
                              <span>Pending</span>
                            </button>

                            {/* Return */}
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmAction('RETURN', item)}
                              disabled={isProcessingStatus}
                              className="py-1 px-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                              title="Return record for resubmission"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Return</span>
                            </button>
                          </div>
                        )}

                        {activeSection === 'PENDING' && (
                          <div className="grid grid-cols-3 gap-1">
                            {/* Approve */}
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmAction('APPROVE', item)}
                              disabled={isProcessingStatus}
                              className="py-1 px-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                              title="Approve submission"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>

                            {/* Return */}
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmAction('RETURN', item)}
                              disabled={isProcessingStatus}
                              className="py-1 px-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                              title="Return record for resubmission"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Return</span>
                            </button>

                            {/* RTV (Return to Verification) */}
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmAction('RTV', item)}
                              disabled={isProcessingStatus}
                              className="py-1 px-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                              title="Return to Verification (RTV)"
                            >
                              <Undo2 className="w-3 h-3" />
                              <span>RTV</span>
                            </button>
                          </div>
                        )}

                        {activeSection === 'APPROVED' && (
                          <div className="flex items-center gap-1.5">
                            {/* RTV */}
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmAction('RTV', item)}
                              disabled={isProcessingStatus}
                              className="flex-1 py-1 px-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                              title="Return to Verification (RTV)"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              <span>RTV</span>
                            </button>
                          </div>
                        )}

                        {activeSection === 'RETURNED' && (
                          <div className="flex items-center gap-1.5">
                            {/* RTV */}
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmAction('RTV', item)}
                              disabled={isProcessingStatus}
                              className="flex-1 py-1 px-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                              title="Return to Verification (RTV)"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              <span>RTV</span>
                            </button>
                          </div>
                        )}

                        {/* Secondary View & Edit Options */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => setViewItem(item)}
                            className="text-[11px] font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View All ({fileCount})</span>
                          </button>

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                              title="Edit record"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            {(isMasterAdmin || item.submitted_by === currentUser?.username) && (
                              <button
                                type="button"
                                onClick={() => handleOpenConfirmAction('DELETE', item)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                title="Delete portal attachment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* NUMBERED PAGINATION BAR (10 rows x 5 columns = 50 per page) */}
              {filteredFolderItems.length > 0 && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-500 font-medium text-center md:text-left">
                    Showing <strong className="text-slate-800 font-black">{Math.min((currentPage - 1) * pageSize + 1, filteredFolderItems.length)}</strong> to{' '}
                    <strong className="text-slate-800 font-black">{Math.min(currentPage * pageSize, filteredFolderItems.length)}</strong> of{' '}
                    <strong className="text-slate-800 font-black">{filteredFolderItems.length}</strong> records
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md font-bold ml-2 inline-block">
                      10 rows × 5 cols · Page {currentPage} of {totalPages}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer"
                      title="First Page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    {getPageNumbers().map((p, idx) => {
                      if (p === '...') {
                        return (
                          <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-400 font-extrabold text-xs select-none">
                            ...
                          </span>
                        );
                      }
                      const pageNum = Number(p);
                      const isActive = pageNum === currentPage;
                      return (
                        <button
                          key={`page-${pageNum}`}
                          type="button"
                          onClick={() => handlePageChange(pageNum)}
                          className={`min-w-[34px] h-[34px] px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-800 text-white shadow-sm border border-emerald-900 scale-105'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="Next Page"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer"
                      title="Last Page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: RETURN REASON PROMPT */}
      <AnimatePresence>
        {returnTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-8"
            >
              <div className="bg-rose-700 px-6 py-4.5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display">Return Submission</h3>
                    <p className="text-xs text-rose-100 font-medium">
                      Will transfer to Returned section and reflect on Returned page
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 text-xs space-y-1">
                  <p className="font-bold text-rose-900">
                    Returning: <span className="font-black text-rose-950 uppercase">{returnTarget.full_name}</span>
                  </p>
                  <p className="text-rose-700 text-[11px]">
                    Barangay {returnTarget.barangay} {returnTarget.purok ? `· ${returnTarget.purok}` : ''}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Reason for Return <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    placeholder="Enter clear remarks why this submission is being returned for corrections..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all resize-none"
                  />
                </div>

                {/* Quick suggestions */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Suggestions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Incomplete document / missing ID page',
                      'Blurry or unreadable photo',
                      'Wrong Barangay or Purok entry',
                      'Duplicate submission'
                    ].map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setReturnReason(sug)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setReturnTarget(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReturn}
                    disabled={isProcessingStatus}
                    className="px-5 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isProcessingStatus ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Returning...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Confirm Return</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 1: ADD / EDIT PORTAL ATTACHMENT */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-8"
            >
              <div className="bg-gradient-to-r from-emerald-800 to-teal-900 px-6 py-4.5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-200 border border-white/10">
                    <Paperclip className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display">
                      {editItem ? 'Edit Portal Attachment' : 'New Attach.'}
                    </h3>
                    <p className="text-xs text-emerald-200/80 font-medium">
                      Submit record with multi-file attachment upload
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. JUAN DELA CRUZ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-semibold text-slate-800 outline-none uppercase transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Barangay <span className="text-rose-500">*</span></span>
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={barangay}
                        onChange={e => setBarangay(e.target.value)}
                        className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-semibold text-slate-800 outline-none uppercase transition-all appearance-none cursor-pointer"
                      >
                        <option value="">-- Select Barangay --</option>
                        {barangay && !uniqueBarangays.includes(barangay) && (
                          <option value={barangay} className="uppercase">
                            {barangay}
                          </option>
                        )}
                        {uniqueBarangays.map(b => (
                          <option key={b} value={b} className="uppercase">
                            {b}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Purok
                    </label>
                    <input
                      type="text"
                      value={purok}
                      onChange={e => setPurok(e.target.value)}
                      placeholder="e.g. Purok 1 / Mabuhay"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Multi-Attachments */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Attachments (Upload multiple times to append)
                    </label>
                    <span className="text-[11px] font-bold text-emerald-700">
                      {attachments.length} file(s) selected
                    </span>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFilesSelected}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-2xl bg-white text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform shadow-xs">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="font-extrabold text-xs text-slate-800">
                      Click to browse or drop multiple files here
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Supports images (JPG, PNG), PDF, spreadsheets &amp; documents simultaneously
                    </p>
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isImageFile(att) ? (
                              <div className="w-7 h-7 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                                <ImageIcon className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate text-[11px]">
                                {att.name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {formatFileSize(att.size) || 'Ready to upload'}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Remove file"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Notes / Remarks (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Enter any additional remarks, reference ID, or submission details..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all resize-none"
                  />
                </div>

                <div className="px-6 py-4 bg-slate-50 -mx-6 -mb-6 mt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{editItem ? 'Save Changes' : 'Submit to Verification'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: VIEW DETAILS & RESPONSIVE GRID GALLERY */}
      <AnimatePresence>
        {viewItem && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-8"
            >
              {/* Header */}
              <div className="bg-slate-900 px-6 py-5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Paperclip className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display uppercase tracking-tight flex items-center gap-2">
                      <span>{viewItem.full_name}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {viewItem.attachments?.length || 0} Files
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Barangay {viewItem.barangay} {viewItem.purok ? `· ${viewItem.purok}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewItem(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Action Buttons Bar right inside Modal Header */}
              <div className="px-6 py-3 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between gap-3 text-xs flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold text-[11px]">Current Status:</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {viewItem.status || 'VERIFICATION'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Approve */}
                  {(viewItem.status === 'VERIFICATION' || viewItem.status === 'SUBMITTED' || viewItem.status === 'PENDING') && (
                    <button
                      type="button"
                      onClick={() => handleOpenConfirmAction('APPROVE', viewItem)}
                      disabled={isProcessingStatus}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}

                  {/* Pending */}
                  {(viewItem.status === 'VERIFICATION' || viewItem.status === 'SUBMITTED') && (
                    <button
                      type="button"
                      onClick={() => handleOpenConfirmAction('PENDING', viewItem)}
                      disabled={isProcessingStatus}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs uppercase flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pending</span>
                    </button>
                  )}

                  {/* Return */}
                  {(viewItem.status === 'VERIFICATION' || viewItem.status === 'SUBMITTED' || viewItem.status === 'PENDING') && (
                    <button
                      type="button"
                      onClick={() => handleOpenConfirmAction('RETURN', viewItem)}
                      disabled={isProcessingStatus}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Return</span>
                    </button>
                  )}

                  {/* RTV (Return to Verification) */}
                  {(viewItem.status === 'PENDING' || viewItem.status === 'APPROVED' || viewItem.status === 'VERIFIED' || viewItem.status === 'RETURNED') && (
                    <button
                      type="button"
                      onClick={() => handleOpenConfirmAction('RTV', viewItem)}
                      disabled={isProcessingStatus}
                      className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs uppercase flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>RTV</span>
                    </button>
                  )}

                  {/* Delete (Admin only) */}
                  {isMasterAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenConfirmAction('DELETE', viewItem)}
                      disabled={isProcessingStatus}
                      className="px-3 py-1.5 rounded-xl bg-rose-700/80 hover:bg-rose-700 text-white font-extrabold text-xs uppercase flex items-center gap-1 shadow-xs cursor-pointer"
                      title="Delete record permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                {/* Meta details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Barangay</span>
                    <span className="font-black text-slate-800 text-sm">{viewItem.barangay}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Purok</span>
                    <span className="font-bold text-slate-700 text-sm">{viewItem.purok || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Section</span>
                    <span className="font-bold text-teal-800 text-sm">{viewItem.status || 'VERIFICATION'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Uploaded By</span>
                    <span className="font-bold text-slate-700 text-sm">{viewItem.uploaded_by || 'Staff'}</span>
                  </div>
                </div>

                {viewItem.return_reason && (
                  <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl space-y-1">
                    <span className="text-[10px] text-rose-800 font-extrabold uppercase tracking-wider block">Return Reason</span>
                    <p className="text-xs text-rose-950 font-medium">{viewItem.return_reason}</p>
                  </div>
                )}

                {viewItem.notes && (
                  <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-1">
                    <span className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wider block">Notes</span>
                    <p className="text-xs text-slate-700 font-medium">{viewItem.notes}</p>
                  </div>
                )}

                {/* Attachments Section - Grid Style View */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5 text-emerald-600" />
                      <span>All Attached Files ({viewItem.attachments?.length || 0})</span>
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">Click any image to enlarge</span>
                  </div>

                  {(!viewItem.attachments || viewItem.attachments.length === 0) ? (
                    <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                      <p className="text-slate-400 italic">No attachments for this submission.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
                      {viewItem.attachments.map((att, i) => {
                        const isImg = isImageFile(att);
                        return (
                          <div
                            key={i}
                            className="bg-slate-50 hover:bg-emerald-50/40 border border-slate-200/90 hover:border-emerald-300 rounded-2xl overflow-hidden flex flex-col justify-between transition-all group/item shadow-2xs hover:shadow-md"
                          >
                            <div
                              onClick={() => {
                                if (isImg && att.url) {
                                  setPreviewImage({ url: att.url, name: att.name });
                                } else if (att.url) {
                                  window.open(att.url, '_blank');
                                }
                              }}
                              className="relative aspect-square w-full bg-slate-100 overflow-hidden cursor-pointer flex items-center justify-center group/thumb"
                              title={isImg ? 'Click to view full image lightbox' : 'Click to open / view file'}
                            >
                              {isImg && att.url ? (
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-slate-400 bg-gradient-to-br from-slate-100 to-slate-200">
                                  <FileText className="w-10 h-10 text-indigo-500 mb-1" />
                                  <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                    {(att.name || '').split('.').pop() || 'FILE'}
                                  </span>
                                </div>
                              )}

                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                <span className="p-2 rounded-xl bg-white text-slate-800 shadow-md transform scale-90 group-hover/thumb:scale-100 transition-transform">
                                  <Eye className="w-4 h-4 text-emerald-700" />
                                </span>
                              </div>

                              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-slate-900/75 backdrop-blur-xs text-white text-[10px] font-mono font-bold">
                                #{i + 1}
                              </span>
                            </div>

                            <div className="p-2.5 space-y-1.5 bg-white border-t border-slate-100">
                              <p
                                className="font-bold text-slate-800 text-[11px] truncate group-hover/item:text-emerald-700 transition-colors"
                                title={att.name}
                              >
                                {att.name}
                              </p>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                <span>{formatFileSize(att.size) || 'File'}</span>
                                {att.url && (
                                  <a
                                    href={att.url}
                                    download={att.name || 'attachment'}
                                    onClick={e => e.stopPropagation()}
                                    className="p-1 rounded-md text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition-colors cursor-pointer"
                                    title={`Download ${att.name}`}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const item = viewItem;
                      setViewItem(null);
                      handleOpenEditModal(item);
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Record</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewItem(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: FULLSCREEN IMAGE LIGHTBOX PREVIEW */}
      <AnimatePresence>
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col cursor-default"
            >
              <div className="px-5 py-3.5 bg-slate-950/80 flex items-center justify-between text-white border-b border-white/10">
                <span className="font-bold text-xs truncate">{previewImage.name}</span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewImage.url}
                    download={previewImage.name}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                    title="Download image"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewImage(null)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950">
                <img
                  src={previewImage.url}
                  alt={previewImage.name}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL 4: CONFIRMATION POPUP IN CENTER OF SCREEN (Approve, Pending, Return, Delete, RTV)
         ========================================================================= */}
      <AnimatePresence>
        {actionConfirmation && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ duration: 0.16 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200/90 flex flex-col items-center text-center space-y-4"
            >
              {/* Action Icon Header */}
              {actionConfirmation.type === 'APPROVE' && (
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-md shadow-emerald-600/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              )}
              {actionConfirmation.type === 'PENDING' && (
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-md shadow-amber-600/20">
                  <Clock className="w-8 h-8" />
                </div>
              )}
              {actionConfirmation.type === 'RETURN' && (
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-md shadow-rose-600/20">
                  <RotateCcw className="w-8 h-8" />
                </div>
              )}
              {actionConfirmation.type === 'RTV' && (
                <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shadow-md shadow-teal-700/20">
                  <Undo2 className="w-8 h-8" />
                </div>
              )}
              {actionConfirmation.type === 'DELETE' && (
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-md shadow-rose-600/20">
                  <Trash2 className="w-8 h-8" />
                </div>
              )}

              {/* Title & Description */}
              <div className="space-y-1.5 w-full">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 font-display">
                  {actionConfirmation.type === 'APPROVE' && 'Approve Submission?'}
                  {actionConfirmation.type === 'PENDING' && 'Mark Record as Pending?'}
                  {actionConfirmation.type === 'RETURN' && 'Return Submission for Resubmission?'}
                  {actionConfirmation.type === 'RTV' && 'Return to Verification (RTV)?'}
                  {actionConfirmation.type === 'DELETE' && 'Permanently Delete Record?'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  {actionConfirmation.type === 'APPROVE' && 'This submission will be approved and transferred immediately to the APPROVED section.'}
                  {actionConfirmation.type === 'PENDING' && 'This submission will be placed on hold and moved to the PENDING section.'}
                  {actionConfirmation.type === 'RETURN' && 'This submission will be moved to the RETURNED section and reflected on the Returned page for user resubmission.'}
                  {actionConfirmation.type === 'RTV' && 'This record will be transferred back to the VERIFICATION section for review.'}
                  {actionConfirmation.type === 'DELETE' && 'This record and all its uploaded attachments will be deleted permanently. This action cannot be undone.'}
                </p>
              </div>

              {/* Patient and Record Summary Box */}
              <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-left space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Patient Name</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm uppercase">{actionConfirmation.item.full_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Barangay & Purok</span>
                  <span className="font-bold text-slate-700 text-xs">
                    {actionConfirmation.item.barangay} {actionConfirmation.item.purok ? `· ${actionConfirmation.item.purok}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Current Status / Files</span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800">
                      {actionConfirmation.item.status || 'VERIFICATION'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {actionConfirmation.item.attachments?.length || 0} file(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Return Reason Field (Only When action is RETURN) */}
              {actionConfirmation.type === 'RETURN' && (
                <div className="w-full text-left space-y-1.5">
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Reason for Return <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={actionReturnReason}
                    onChange={e => setActionReturnReason(e.target.value)}
                    placeholder="Provide specific details why this file is returned (e.g. Please re-upload clearer copy of valid ID or complete proof of residency)..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white rounded-xl text-xs font-medium text-slate-800 outline-none transition-all resize-none shadow-xs"
                  />
                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'Incomplete attachments',
                      'Blurry/unreadable image',
                      'Wrong barangay selected',
                      'Needs updated ID'
                    ].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setActionReturnReason(preset)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-600 transition-colors cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Confirmation Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 w-full">
                <button
                  type="button"
                  disabled={isProcessingStatus}
                  onClick={() => {
                    setActionConfirmation(null);
                    setActionReturnReason('');
                  }}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingStatus}
                  onClick={handleExecuteConfirmedAction}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-extrabold text-xs text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    actionConfirmation.type === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                      : actionConfirmation.type === 'PENDING'
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                      : actionConfirmation.type === 'RETURN'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                      : actionConfirmation.type === 'RTV'
                      ? 'bg-teal-700 hover:bg-teal-800 shadow-teal-800/30'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  }`}
                >
                  {isProcessingStatus ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      {actionConfirmation.type === 'APPROVE' && (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm Approve</span>
                        </>
                      )}
                      {actionConfirmation.type === 'PENDING' && (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Confirm Pending</span>
                        </>
                      )}
                      {actionConfirmation.type === 'RETURN' && (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Confirm Return</span>
                        </>
                      )}
                      {actionConfirmation.type === 'RTV' && (
                        <>
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Confirm RTV</span>
                        </>
                      )}
                      {actionConfirmation.type === 'DELETE' && (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Record</span>
                        </>
                      )}
                    </>
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
