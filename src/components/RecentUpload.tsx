import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  FileCheck,
  Search,
  Folder,
  FolderOpen,
  MapPin,
  User as UserIcon,
  Phone,
  Calendar,
  Download,
  Trash2,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  ShieldCheck,
  Eye,
  AlertCircle,
  ArrowLeft,
  Layers,
  CheckCircle2,
  Globe,
  Hash,
  Share2
} from 'lucide-react';
import { Contact } from '../types';

interface RecentUploadProps {
  authToken: string | null;
  currentUsername: string;
  isAdmin?: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type ActiveFolderType = 
  | { category: 'pcu'; barangay: string }
  | { category: 'existing_account'; barangay?: string }
  | null;

export const RecentUpload: React.FC<RecentUploadProps> = ({
  authToken,
  currentUsername,
  isAdmin = false,
  showToast
}) => {
  // Navigation & View Mode
  const [viewMode, setViewMode] = useState<'folders' | 'all'>('folders');
  const [activeFolder, setActiveFolder] = useState<ActiveFolderType>(null);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [purokFilter, setPurokFilter] = useState('All Puroks');
  const [barangayFilter, setBarangayFilter] = useState('All Barangays');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'barangay' | 'purok'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Data States
  const [allUploads, setAllUploads] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  // Detail Modal & Action States
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [restoringId, setRestoringId] = useState<number | string | null>(null);

  // Fetch all recent uploads for current user
  const fetchRecentUploads = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: '2000',
        page: '1',
        sortBy: 'date',
        sortOrder: 'desc'
      });

      const res = await fetch(`/api/contacts/recent-uploads?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch recent uploads.');
      }

      setAllUploads(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (err: any) {
      showToast(err.message || 'Error fetching uploaded records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentUploads();
  }, [authToken]);

  // Reset page when filters or active folder change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, purokFilter, barangayFilter, sortBy, sortOrder, activeFolder, viewMode]);

  // Partition uploads into PCU Directory and Exist. Acc. Files
  const pcuUploads = useMemo(() => {
    return allUploads.filter(item => !item.isExistingAccount && item.category !== 'existing_account');
  }, [allUploads]);

  const existAccUploads = useMemo(() => {
    return allUploads.filter(item => item.isExistingAccount || item.category === 'existing_account');
  }, [allUploads]);

  // Aggregate PCU Barangay Folders
  const pcuBarangayFolders = useMemo(() => {
    const map: { [bg: string]: { count: number; filesCount: number; list: Contact[]; puroks: Set<string> } } = {};
    
    pcuUploads.forEach(c => {
      const bg = (c.barangay || 'Unknown Barangay').trim().toUpperCase();
      if (!map[bg]) {
        map[bg] = { count: 0, filesCount: 0, list: [], puroks: new Set() };
      }
      map[bg].count += 1;
      const fileNum = (c.uploadedFiles && c.uploadedFiles.length > 0) ? c.uploadedFiles.length : 1;
      map[bg].filesCount += fileNum;
      map[bg].list.push(c);
      if (c.purok) map[bg].puroks.add(c.purok.trim());
    });

    return Object.keys(map).map(bg => ({
      barangay: bg,
      count: map[bg].count,
      filesCount: map[bg].filesCount,
      purokCount: map[bg].puroks.size,
      list: map[bg].list
    })).sort((a, b) => b.count - a.count || a.barangay.localeCompare(b.barangay));
  }, [pcuUploads]);

  // Aggregate Exist. Acc. Folders by Barangay
  const existAccBarangayFolders = useMemo(() => {
    const map: { [bg: string]: { count: number; filesCount: number; list: Contact[]; puroks: Set<string> } } = {};

    existAccUploads.forEach(c => {
      const bg = (c.barangay || 'Unknown Barangay').trim().toUpperCase();
      if (!map[bg]) {
        map[bg] = { count: 0, filesCount: 0, list: [], puroks: new Set() };
      }
      map[bg].count += 1;
      const fileNum = (c.uploadedFiles && c.uploadedFiles.length > 0) ? c.uploadedFiles.length : 1;
      map[bg].filesCount += fileNum;
      map[bg].list.push(c);
      if (c.purok) map[bg].puroks.add(c.purok.trim());
    });

    return Object.keys(map).map(bg => ({
      barangay: bg,
      count: map[bg].count,
      filesCount: map[bg].filesCount,
      purokCount: map[bg].puroks.size,
      list: map[bg].list
    })).sort((a, b) => b.count - a.count || a.barangay.localeCompare(b.barangay));
  }, [existAccUploads]);

  // All unique barangays across uploads
  const allBarangays = useMemo(() => {
    const set = new Set<string>();
    allUploads.forEach(c => {
      if (c.barangay) set.add(c.barangay.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [allUploads]);

  // Available puroks inside the active folder
  const activeFolderPuroks = useMemo(() => {
    if (!activeFolder) return [];
    const set = new Set<string>();
    let targetList: Contact[] = [];
    if (activeFolder.category === 'pcu') {
      targetList = pcuBarangayFolders.find(f => f.barangay === activeFolder.barangay)?.list || [];
    } else {
      if (activeFolder.barangay) {
        targetList = existAccBarangayFolders.find(f => f.barangay === activeFolder.barangay)?.list || [];
      } else {
        targetList = existAccUploads;
      }
    }
    targetList.forEach(c => {
      if (c.purok && c.purok.trim()) set.add(c.purok.trim());
    });
    return Array.from(set).sort();
  }, [activeFolder, pcuBarangayFolders, existAccBarangayFolders, existAccUploads]);

  // Filtered active records based on folder and user search
  const currentViewRecords = useMemo(() => {
    let list: Contact[] = [];

    if (viewMode === 'all' || !activeFolder) {
      list = [...allUploads];
    } else if (activeFolder.category === 'pcu') {
      list = pcuBarangayFolders.find(f => f.barangay === activeFolder.barangay)?.list || [];
    } else if (activeFolder.category === 'existing_account') {
      if (activeFolder.barangay) {
        list = existAccBarangayFolders.find(f => f.barangay === activeFolder.barangay)?.list || [];
      } else {
        list = [...existAccUploads];
      }
    }

    // Apply active filters
    return list.filter(item => {
      const q = search.toLowerCase().trim();
      const matchesSearch = !q ||
        (item.full_name || '').toLowerCase().includes(q) ||
        (item.barangay || '').toLowerCase().includes(q) ||
        (item.purok || '').toLowerCase().includes(q) ||
        (item.contact_number || '').includes(q) ||
        (item.pin || '').toLowerCase().includes(q);

      const matchesBarangay = barangayFilter === 'All Barangays' || 
        (item.barangay || '').trim().toUpperCase() === barangayFilter.trim().toUpperCase();

      const matchesPurok = purokFilter === 'All Puroks' ||
        (item.purok || '').trim().toLowerCase() === purokFilter.trim().toLowerCase();

      return matchesSearch && matchesBarangay && matchesPurok;
    }).sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = (a.full_name || '').localeCompare(b.full_name || '');
      } else if (sortBy === 'barangay') {
        cmp = (a.barangay || '').localeCompare(b.barangay || '');
      } else if (sortBy === 'purok') {
        cmp = (a.purok || '').localeCompare(b.purok || '');
      } else {
        const dateA = new Date(a.pcu_uploaded_at || a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.pcu_uploaded_at || b.updated_at || b.created_at).getTime();
        cmp = dateB - dateA;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [viewMode, activeFolder, allUploads, pcuBarangayFolders, existAccBarangayFolders, existAccUploads, search, barangayFilter, purokFilter, sortBy, sortOrder]);

  // Paginated records for current view
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return currentViewRecords.slice(start, start + itemsPerPage);
  }, [currentViewRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(currentViewRecords.length / itemsPerPage) || 1;

  // Restore record handler
  const handleRestoreRecord = async (record: Contact) => {
    const isExt = record.isExistingAccount || record.category === 'existing_account';
    const targetDirName = isExt ? 'Exist. Acc. Files Directory' : 'Saint Francis Clinic Directory';
    
    if (!window.confirm(`Are you sure you want to restore "${record.full_name}"? This will transfer it back to the ${targetDirName} and remove it from Recent Uploads.`)) {
      return;
    }

    setRestoringId(record.id);
    try {
      const res = await fetch(`/api/contacts/${record.id}/pcu`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to restore record.');
      }

      showToast(`"${record.full_name}" has been restored back to ${targetDirName}.`, 'success');
      if (selectedContact?.id === record.id) {
        setSelectedContact(null);
      }
      fetchRecentUploads();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore record.', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const getFileDisplayName = (fileUrlOrData?: string) => {
    if (!fileUrlOrData) return 'Attached Document';
    if (fileUrlOrData.startsWith('Uploaded:')) {
      return fileUrlOrData;
    }
    if (fileUrlOrData.startsWith('http')) {
      const parts = fileUrlOrData.split('/');
      return (parts[parts.length - 1] || 'Attached Document').replace(/^\d+_/, '');
    }
    if (fileUrlOrData.startsWith('data:image/')) {
      return 'Image Document';
    }
    if (fileUrlOrData.startsWith('data:')) {
      return 'Attached Document';
    }
    return fileUrlOrData;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 sm:p-7 border border-emerald-800/40 shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <UploadCloud className="w-56 h-56 text-emerald-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wide">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Personal Upload Archives</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight">
              Recent Uploads
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              All submitted and completed files transferred from <strong>Saint Francis Clinic Directory</strong> (PCU Folders) and <strong>Exist. Acc. Files</strong>. Browse records by dedicated folders or unified table.
            </p>
          </div>

          {/* Quick Stat Badges & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* PCU Uploads Badge */}
            <div className="bg-emerald-900/60 border border-emerald-700/60 rounded-2xl px-4 py-3 text-center min-w-[110px] shadow-sm">
              <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-bold block">
                PCU Directory
              </span>
              <span className="text-xl sm:text-2xl font-extrabold font-display text-white mt-0.5 block">
                {pcuUploads.length}
              </span>
            </div>

            {/* Exist. Acc. Uploads Badge */}
            <div className="bg-amber-950/60 border border-amber-700/60 rounded-2xl px-4 py-3 text-center min-w-[110px] shadow-sm">
              <span className="text-[10px] text-amber-300 uppercase tracking-wider font-bold block">
                Exist. Acc. Files
              </span>
              <span className="text-xl sm:text-2xl font-extrabold font-display text-amber-100 mt-0.5 block">
                {existAccUploads.length}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchRecentUploads}
              className="p-3.5 bg-emerald-800/40 hover:bg-emerald-800/80 border border-emerald-700/50 rounded-2xl text-emerald-200 hover:text-white transition-all cursor-pointer shadow-sm"
              title="Refresh Recent Uploads"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Directory Mode Selector & Filter Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Breadcrumb or View Mode Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeFolder ? (
              <div className="flex items-center gap-2 text-xs font-bold">
                <button
                  onClick={() => {
                    setActiveFolder(null);
                    setPurokFilter('All Puroks');
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                  <span>Back to Folders</span>
                </button>

                <div className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-900 border border-emerald-200/80 rounded-xl">
                  {activeFolder.category === 'pcu' ? (
                    <>
                      <Folder className="w-4 h-4 text-emerald-600" />
                      <span>PCU Directory &gt; <strong>{activeFolder.barangay}</strong></span>
                    </>
                  ) : (
                    <>
                      <Folder className="w-4 h-4 text-amber-600" />
                      <span>Exist. Acc. Files {activeFolder.barangay ? `> ${activeFolder.barangay}` : ''}</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold gap-1 shadow-inner">
                <button
                  onClick={() => setViewMode('folders')}
                  className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                    viewMode === 'folders'
                      ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/60 font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 text-emerald-600" />
                  <span>Folder Directory View</span>
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                    viewMode === 'all'
                      ? 'bg-white text-emerald-900 shadow-sm border border-slate-200/60 font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span>All Uploads ({allUploads.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Active Uploader Isolation Label */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Isolated Archive for <strong className="text-slate-800">@{currentUsername}</strong></span>
          </div>
        </div>

        {/* Filter Controls (Shown in open folder or All Uploads mode) */}
        {(activeFolder || viewMode === 'all') && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient/household name, purok, or contact #..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Purok Filter (Inside Active Folder) */}
            {activeFolderPuroks.length > 0 && (
              <div className="md:col-span-3">
                <select
                  value={purokFilter}
                  onChange={(e) => setPurokFilter(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
                >
                  <option value="All Puroks">All Puroks ({activeFolderPuroks.length})</option>
                  {activeFolderPuroks.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Barangay Filter (In All Uploads View) */}
            {viewMode === 'all' && (
              <div className="md:col-span-3">
                <select
                  value={barangayFilter}
                  onChange={(e) => setBarangayFilter(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
                >
                  <option value="All Barangays">All Barangays ({allBarangays.length})</option>
                  {allBarangays.map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Selector */}
            <div className="md:col-span-4 flex gap-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
              >
                <option value="date">Sort: Upload Date</option>
                <option value="name">Sort: Full Name</option>
                <option value="barangay">Sort: Barangay</option>
                <option value="purok">Sort: Purok</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                title={`Switch to ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-600">Loading your recent uploads and folders...</p>
        </div>
      ) : viewMode === 'folders' && !activeFolder ? (
        /* FOLDERS OVERVIEW MODE */
        <div className="space-y-8">
          {/* SECTION 1: PCU DIRECTORY FOLDERS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Folder className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-display flex items-center gap-2">
                    <span>PCU DIRECTORY FOLDERS</span>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                      {pcuBarangayFolders.length} Folders • {pcuUploads.length} Households
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Household records from Saint Francis Clinic Directory with completed PCU document uploads
                  </p>
                </div>
              </div>
            </div>

            {pcuBarangayFolders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/70">
                <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">No PCU Directory uploads yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Upload PCU documents from the Saint Francis Clinic Directory to populate these folders.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pcuBarangayFolders.map(folder => (
                  <motion.div
                    key={folder.barangay}
                    whileHover={{ y: -3 }}
                    onClick={() => {
                      setActiveFolder({ category: 'pcu', barangay: folder.barangay });
                    }}
                    className="bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 shadow-xs hover:shadow-md p-4 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                          <Folder className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold text-[10px] rounded-lg border border-emerald-200/60">
                          {folder.count} {folder.count === 1 ? 'Household' : 'Households'}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-800 transition-colors truncate" title={folder.barangay}>
                          {folder.barangay}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                          <span>{folder.purokCount} Puroks</span>
                          <span>•</span>
                          <span>{folder.filesCount} Uploaded Files</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-emerald-700">
                      <span>Open Barangay Folder</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: EXIST. ACC. FILES FOLDERS */}
          <div className="space-y-4 pt-4 border-t border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Folder className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-display flex items-center gap-2">
                    <span>EXIST. ACC. FILES FOLDER</span>
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[11px] font-bold">
                      {existAccUploads.length} Transferred Records
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Records from Exist. Acc. Files page filtered out and transferred with attached documents & geotag location
                  </p>
                </div>
              </div>
            </div>

            {existAccUploads.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/70">
                <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">No Exist. Acc. Files uploaded yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">When you attach files and save on the Exist. Acc. Files page, records will automatically filter out and appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Main All Exist. Acc. Files Folder Card */}
                <motion.div
                  whileHover={{ y: -3 }}
                  onClick={() => {
                    setActiveFolder({ category: 'existing_account' });
                  }}
                  className="bg-gradient-to-br from-amber-50/70 to-white rounded-2xl border-2 border-amber-300 hover:border-amber-400 shadow-xs hover:shadow-md p-4 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                        <Folder className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-950 font-extrabold text-[10px] rounded-lg">
                        All Exist. Acc.
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-amber-900 transition-colors">
                        Exist. Acc. Files (All)
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {existAccUploads.length} total transferred patient records
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-amber-200/80 flex items-center justify-between text-[11px] font-extrabold text-amber-900">
                    <span>View All Transferred Accounts</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>

                {/* Sub Barangay Folders for Exist. Acc. Files */}
                {existAccBarangayFolders.map(folder => (
                  <motion.div
                    key={folder.barangay}
                    whileHover={{ y: -3 }}
                    onClick={() => {
                      setActiveFolder({ category: 'existing_account', barangay: folder.barangay });
                    }}
                    className="bg-white rounded-2xl border border-slate-200/80 hover:border-amber-300 shadow-xs hover:shadow-md p-4 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all shadow-xs">
                          <Folder className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-900 font-bold text-[10px] rounded-lg border border-amber-200/60">
                          {folder.count} Records
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-amber-800 transition-colors truncate" title={folder.barangay}>
                          {folder.barangay}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                          <span>{folder.purokCount} Puroks</span>
                          <span>•</span>
                          <span>{folder.filesCount} Files</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-amber-800">
                      <span>Open Barangay Records</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* INSIDE ACTIVE FOLDER OR ALL UPLOADS VIEW */
        <div className="space-y-5">
          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800">{paginatedRecords.length}</strong> of <strong className="text-slate-800">{currentViewRecords.length}</strong> records
              {activeFolder ? ` inside ${activeFolder.category === 'pcu' ? `PCU Directory: ${activeFolder.barangay}` : `Exist. Acc. Files: ${activeFolder.barangay || 'All'}`}` : ''}
            </span>
            {currentViewRecords.length > 0 && (
              <span className="text-[11px] text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>

          {currentViewRecords.length === 0 ? (
            <div className="py-16 px-6 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800 font-display">No Matching Uploads</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {search || purokFilter !== 'All Puroks' || barangayFilter !== 'All Barangays'
                  ? 'No records match your active search filters.'
                  : 'There are no uploads recorded in this view yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedRecords.map(record => {
                const isExt = record.isExistingAccount || record.category === 'existing_account';
                const fileList = record.uploadedFiles || [];
                const firstFile = fileList[0];
                const hasGeotag = record.geotagged || (record.latitude !== undefined && record.longitude !== undefined);

                return (
                  <motion.div
                    key={record.id}
                    whileHover={{ y: -3 }}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                  >
                    {/* Card Content */}
                    <div className="p-5 space-y-3.5">
                      {/* Category & Status Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <h3 className="font-extrabold text-slate-900 text-sm font-display truncate" title={record.full_name}>
                            {record.full_name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-semibold text-slate-700 truncate">{record.barangay}</span>
                            {record.purok && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0">
                                {record.purok}
                              </span>
                            )}
                          </div>
                        </div>

                        {isExt ? (
                          <span className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg text-[9px] font-extrabold uppercase tracking-wider shrink-0">
                            Exist. Acc.
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg text-[9px] font-extrabold uppercase tracking-wider shrink-0 flex items-center gap-1">
                            <FileCheck className="w-3 h-3 text-emerald-600" />
                            PCU Upload
                          </span>
                        )}
                      </div>

                      {/* PhilHealth PIN Badge if present */}
                      {record.pin && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 font-mono font-medium">
                          <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[10px] text-slate-400 font-sans font-bold">PIN:</span>
                          <span className="truncate">{record.pin}</span>
                        </div>
                      )}

                      {/* GPS Geotag status */}
                      {hasGeotag && record.latitude !== undefined && record.longitude !== undefined && (
                        <div className="flex items-center justify-between text-[10px] bg-emerald-50/70 border border-emerald-200/60 px-2.5 py-1 rounded-xl text-emerald-900 font-semibold">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            <span>GPS: {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}</span>
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:text-emerald-900 underline font-bold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Map
                          </a>
                        </div>
                      )}

                      {/* Attached Documents Box */}
                      <div className={`p-3 rounded-xl border space-y-1.5 ${isExt ? 'bg-amber-50/50 border-amber-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold flex items-center gap-1.5 text-slate-800">
                            <FileText className={`w-3.5 h-3.5 ${isExt ? 'text-amber-700' : 'text-emerald-700'} shrink-0`} />
                            <span className="truncate max-w-[180px]">
                              {fileList.length > 0
                                ? `${fileList.length} Attached File(s)`
                                : getFileDisplayName(record.pcu_file_url)}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {record.pcu_uploaded_at ? new Date(record.pcu_uploaded_at).toLocaleDateString() : 'Recently'}
                          </span>
                          <span className="font-semibold text-slate-700">
                            By @{record.pcu_uploaded_by || currentUsername}
                          </span>
                        </div>
                      </div>

                      {/* Contact Number */}
                      {record.contact_number && (
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{record.contact_number}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedContact(record)}
                        className={`px-3.5 py-1.5 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                          isExt ? 'bg-amber-700 hover:bg-amber-800' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>

                      <button
                        onClick={() => handleRestoreRecord(record)}
                        disabled={restoringId === record.id}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                        title={`Restore back to ${isExt ? 'Exist. Acc. Files Directory' : 'Saint Francis Clinic Directory'}`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${restoringId === record.id ? 'animate-spin' : ''}`} />
                        <span>Restore</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-3.5 border border-slate-200/80 shadow-xs text-xs">
              <span className="text-slate-500">
                Page <strong className="text-slate-900">{currentPage}</strong> of <strong className="text-slate-900">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail & File View Modal */}
      <AnimatePresence>
        {selectedContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className={`p-6 text-white flex items-center justify-between border-b ${
                selectedContact.isExistingAccount || selectedContact.category === 'existing_account'
                  ? 'bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 border-amber-800/40'
                  : 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-emerald-800/40'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold font-display text-base text-white">
                      {selectedContact.full_name}
                    </h3>
                    <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {selectedContact.barangay} {selectedContact.purok ? `• ${selectedContact.purok}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedContact(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Content */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-700 text-xs">
                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Patient / Head</span>
                    <span className="font-bold text-slate-900 text-xs mt-0.5 block">{selectedContact.full_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Source Directory</span>
                    <span className="font-extrabold text-xs mt-0.5 block text-slate-800">
                      {selectedContact.isExistingAccount || selectedContact.category === 'existing_account' ? 'Exist. Acc. Files' : 'Saint Francis Clinic Directory'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Barangay</span>
                    <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedContact.barangay}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Purok</span>
                    <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedContact.purok || 'None'}</span>
                  </div>
                  {selectedContact.contact_number && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Contact #</span>
                      <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{selectedContact.contact_number}</span>
                    </div>
                  )}
                  {selectedContact.pin && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">PhilHealth PIN</span>
                      <span className="font-bold text-slate-900 text-xs mt-0.5 block font-mono">{selectedContact.pin}</span>
                    </div>
                  )}
                  {selectedContact.facebookLink && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Facebook Profile</span>
                      <a
                        href={selectedContact.facebookLink.startsWith('http') ? selectedContact.facebookLink : `https://${selectedContact.facebookLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-blue-600 hover:underline text-xs mt-0.5 flex items-center gap-1 truncate"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="truncate">{selectedContact.facebookLink}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}
                  {selectedContact.latitude !== undefined && selectedContact.longitude !== undefined && (
                    <div className="col-span-2 flex items-center justify-between p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/80">
                      <div>
                        <span className="text-[10px] text-emerald-800 uppercase tracking-wider font-bold block">Geotag Coordinates</span>
                        <span className="font-bold text-emerald-950 text-xs font-mono">
                          {selectedContact.latitude.toFixed(6)}, {selectedContact.longitude.toFixed(6)}
                        </span>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${selectedContact.latitude},${selectedContact.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Open Map</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Uploaded Documents List */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 font-display">
                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                    <span>Uploaded Documents & Files</span>
                  </h4>

                  {selectedContact.uploadedFiles && selectedContact.uploadedFiles.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedContact.uploadedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50/60 rounded-2xl border border-slate-200 text-xs font-semibold group transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-900 font-bold truncate" title={file.name}>
                                {file.name}
                              </p>
                              {file.uploadedAt && (
                                <p className="text-[9px] text-slate-400 mt-0.5">
                                  {new Date(file.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                          {file.url && (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-white hover:bg-emerald-100 border border-slate-200 text-emerald-700 rounded-lg shrink-0 transition-all flex items-center justify-center cursor-pointer ml-2"
                              title="Open File"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                          <div>
                            <span className="font-bold text-emerald-950 text-xs block">
                              {getFileDisplayName(selectedContact.pcu_file_url)}
                            </span>
                            <span className="text-[10px] text-emerald-700">
                              Uploaded by @{selectedContact.pcu_uploaded_by || currentUsername} • {selectedContact.pcu_uploaded_at ? new Date(selectedContact.pcu_uploaded_at).toLocaleString() : 'Recently'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Preview / Download */}
                      {selectedContact.pcu_file_url && (
                        <div className="pt-2 border-t border-emerald-200/60">
                          {selectedContact.pcu_file_url.startsWith('http') ? (
                            <a
                              href={selectedContact.pcu_file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open / Download Document</span>
                            </a>
                          ) : selectedContact.pcu_file_url.startsWith('data:image/') ? (
                            <div className="space-y-2">
                              <img
                                src={selectedContact.pcu_file_url}
                                alt="Document Preview"
                                className="max-h-56 rounded-xl border border-emerald-200 object-contain mx-auto bg-white"
                              />
                              <a
                                href={selectedContact.pcu_file_url}
                                download={`Upload_${selectedContact.full_name.replace(/\s+/g, '_')}.png`}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Image Document</span>
                              </a>
                            </div>
                          ) : selectedContact.pcu_file_url.startsWith('data:') ? (
                            <a
                              href={selectedContact.pcu_file_url}
                              download={`Upload_${selectedContact.full_name.replace(/\s+/g, '_')}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Attachment</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-emerald-800 italic">
                              File stored in database ({selectedContact.pcu_file_url})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => handleRestoreRecord(selectedContact)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restore to Directory</span>
                </button>

                <button
                  onClick={() => setSelectedContact(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
