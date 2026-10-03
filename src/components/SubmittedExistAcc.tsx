import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FolderTree,
  FolderCheck,
  UploadCloud,
  User,
  Phone,
  MapPin,
  FileText,
  Clock,
  ShieldCheck,
  RefreshCw,
  Search,
  Eye,
  ExternalLink,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  Receipt,
  Wallet,
  Coins,
  History,
  TrendingUp,
  Database,
  Calendar,
  Layers,
  CheckCheck,
  RotateCcw,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SubmittedExistAccRecord, SubmittedExistAccHistoryItem, SubmittedExistAccSettlement } from '../types';

interface SubmittedExistAccProps {
  authToken: string;
  currentUser?: {
    username: string;
    role: string;
    barangay?: string;
  } | null;
  showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

export const SubmittedExistAcc: React.FC<SubmittedExistAccProps> = ({
  authToken,
  currentUser,
  showToast
}) => {
  // Main Data States
  const [records, setRecords] = useState<SubmittedExistAccRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab State: 'files' | 'verified' | 'pending' | 'updated' | 'ledger'
  const [activeTab, setActiveTab] = useState<'files' | 'verified' | 'pending' | 'updated' | 'ledger'>('files');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('ALL');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Folder vs Grid mode inside tabs
  const [folderViewMode, setFolderViewMode] = useState<'folders' | 'all'>('folders');

  // Modals & Lightbox
  const [selectedRecord, setSelectedRecord] = useState<SubmittedExistAccRecord | null>(null);
  const [activeLightboxFile, setActiveLightboxFile] = useState<{ url: string; name: string; type?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ record: SubmittedExistAccRecord; fileIndex?: number; isFileOnly?: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<SubmittedExistAccHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Ledger & Payroll States
  const [baseRate, setBaseRate] = useState<number>(50);
  const [pendingBaseRate, setPendingBaseRate] = useState<number>(20);
  const [savingRates, setSavingRates] = useState(false);
  const [settlements, setSettlements] = useState<SubmittedExistAccSettlement[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  
  // Settle Payroll Modal
  const [settleModalTarget, setSettleModalTarget] = useState<{
    submitter: string;
    totalSubmissions: number;
    verifiedCount: number;
    pendingCount: number;
    totalSalary: number;
    unpaidAmount: number;
  } | null>(null);
  const [settlePaymentAmount, setSettlePaymentAmount] = useState<string>('');
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<'CASH' | 'GCASH' | 'BANK_TRANSFER' | 'CHECK'>('CASH');
  const [settleReferenceNotes, setSettleReferenceNotes] = useState<string>('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  // Receipt Modal
  const [viewingReceipt, setViewingReceipt] = useState<SubmittedExistAccSettlement | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const isMasterAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toUpperCase().trim();
    const username = (currentUser.username || '').toLowerCase().trim();
    const email = ((currentUser as any).email || '').toLowerCase().trim();
    return role === 'MASTER ADMIN' || role === 'MASTER_ADMIN' || role === 'MASTERADMIN' || username === 'admin' || username === 'melfeliciano85' || email === 'melfeliciano85@gmail.com';
  }, [currentUser]);

  // Fetch Submitted Exist Accounts
  const fetchRecords = async (showNotification = false) => {
    try {
      if (showNotification) setRefreshing(true);
      else setLoading(true);

      const res = await fetch('/api/submitted-exist-acc', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setRecords(data);
        if (showNotification) {
          showToast(`Refreshed ${data.length} submitted existing account records.`, 'success');
        }
      } else {
        throw new Error(data.error || 'Failed to load records.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error fetching records.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch Base Rates
  const fetchBaseRates = async () => {
    try {
      const res = await fetch('/api/submitted-exist-acc/base-rates', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.baseRate !== undefined) setBaseRate(Number(data.baseRate));
        if (data.pendingBaseRate !== undefined) setPendingBaseRate(Number(data.pendingBaseRate));
      }
    } catch (err: any) {
      console.warn('Error loading base rates:', err);
    }
  };

  // Save Base Rates
  const handleSaveBaseRates = async () => {
    if (!isMasterAdmin) return;
    setSavingRates(true);
    try {
      const res = await fetch('/api/submitted-exist-acc/base-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ baseRate, pendingBaseRate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update base rates.');
      showToast('Submitted Exist. Acc. base rates successfully saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error saving rates.', 'error');
    } finally {
      setSavingRates(false);
    }
  };

  // Fetch History Logs
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/submitted-exist-acc/history', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setHistoryLogs(data);
      }
    } catch (err: any) {
      console.warn('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch Settlements
  const fetchSettlements = async () => {
    setLoadingSettlements(true);
    try {
      const res = await fetch('/api/submitted-exist-acc/settlements', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSettlements(data);
      }
    } catch (err: any) {
      console.warn('Error fetching settlements:', err);
    } finally {
      setLoadingSettlements(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchBaseRates();
    fetchSettlements();
  }, [authToken]);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchSettlements();
      fetchBaseRates();
    }
    setSelectedFolder(null);
    setCurrentPage(1);
  }, [activeTab]);

  // Update Status
  const handleUpdateStatus = async (record: SubmittedExistAccRecord, newStatus: string) => {
    setUpdatingStatusId(record.id);
    try {
      const res = await fetch(`/api/submitted-exist-acc/${record.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status.');

      setRecords(prev => prev.map(r => r.id === record.id ? data.record : r));
      if (selectedRecord && selectedRecord.id === record.id) {
        setSelectedRecord(data.record);
      }
      showToast(data.message || `Status updated to ${newStatus}.`, 'success');
      fetchSettlements();
    } catch (err: any) {
      showToast(err.message || 'Error updating status.', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Delete Action (Record or File)
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteTarget.isFileOnly && deleteTarget.fileIndex !== undefined) {
        // Delete single file
        const res = await fetch(`/api/submitted-exist-acc/${deleteTarget.record.id}/files/${deleteTarget.fileIndex}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove file.');

        setRecords(prev => prev.map(r => r.id === deleteTarget.record.id ? data : r));
        if (selectedRecord && selectedRecord.id === deleteTarget.record.id) {
          setSelectedRecord(data);
        }
        showToast('Document removed successfully.', 'success');
      } else {
        // Delete entire record
        const res = await fetch(`/api/submitted-exist-acc/${deleteTarget.record.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete record.');

        setRecords(prev => prev.filter(r => r.id !== deleteTarget.record.id));
        if (selectedRecord && selectedRecord.id === deleteTarget.record.id) {
          setSelectedRecord(null);
        }
        showToast(`Record for "${deleteTarget.record.fullName}" deleted.`, 'success');
      }
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(err.message || 'Deletion failed.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Record Settlement
  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleModalTarget) return;

    const amountNum = parseFloat(settlePaymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    setSettleSubmitting(true);
    try {
      const res = await fetch('/api/submitted-exist-acc/settlements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          submitter: settleModalTarget.submitter,
          totalSubmissions: settleModalTarget.totalSubmissions,
          baseRate: baseRate,
          totalSalary: settleModalTarget.totalSalary,
          amountPaid: amountNum,
          paymentStatus: amountNum >= settleModalTarget.unpaidAmount ? 'SETTLED' : 'PARTIALLY_PAID',
          paymentMethod: settlePaymentMethod,
          referenceNotes: settleReferenceNotes.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record settlement.');

      setSettlements(prev => [data, ...prev]);
      setSettleModalTarget(null);
      setSettlePaymentAmount('');
      setSettleReferenceNotes('');
      showToast(`Settlement recorded for ${data.submitter}!`, 'success');
      setViewingReceipt(data);
    } catch (err: any) {
      showToast(err.message || 'Error recording settlement.', 'error');
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Delete Settlement
  const handleDeleteSettlement = async (settlementId: string) => {
    if (!isMasterAdmin) return;
    if (!window.confirm('Are you sure you want to delete this settlement record?')) return;

    try {
      const res = await fetch(`/api/submitted-exist-acc/settlements/${settlementId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete settlement.');

      setSettlements(prev => prev.filter(s => s.id !== settlementId));
      showToast('Settlement record removed.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete settlement.', 'error');
    }
  };

  // Filtered Records based on Tab & Search
  const tabFilteredRecords = useMemo(() => {
    return records.filter(record => {
      const status = (record.status || 'FILES').toUpperCase();
      if (activeTab === 'verified') return status === 'VERIFIED';
      if (activeTab === 'pending') return status === 'PENDING';
      if (activeTab === 'updated') return status === 'UPDATED';
      return true; // 'files' or 'ledger'
    });
  }, [records, activeTab]);

  const displayRecords = useMemo(() => {
    return tabFilteredRecords.filter(record => {
      const matchesBarangay = selectedBarangay === 'ALL' || (record.barangay || '').toUpperCase() === selectedBarangay.toUpperCase();
      const matchesFolder = !selectedFolder || (record.barangay || '').toUpperCase() === selectedFolder.toUpperCase();
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (record.fullName || '').toLowerCase().includes(q) ||
        (record.barangay || '').toLowerCase().includes(q) ||
        (record.purok || '').toLowerCase().includes(q) ||
        (record.contactNumber || '').toLowerCase().includes(q) ||
        (record.pin || '').toLowerCase().includes(q) ||
        (record.uploadedBy || '').toLowerCase().includes(q)
      );

      return matchesBarangay && matchesFolder && matchesSearch;
    });
  }, [tabFilteredRecords, selectedBarangay, selectedFolder, searchQuery]);

  // Group Records into Barangay Folders
  const barangayFolders = useMemo(() => {
    const map: Record<string, {
      barangay: string;
      count: number;
      filesCount: number;
      verifiedCount: number;
      pendingCount: number;
      updatedCount: number;
      latestUpload: string;
    }> = {};

    tabFilteredRecords.forEach(r => {
      const bg = (r.barangay || 'General / Unassigned').trim().toUpperCase();
      if (!map[bg]) {
        map[bg] = {
          barangay: bg,
          count: 0,
          filesCount: 0,
          verifiedCount: 0,
          pendingCount: 0,
          updatedCount: 0,
          latestUpload: r.uploadedAt || ''
        };
      }
      map[bg].count += 1;
      map[bg].filesCount += (r.uploadedFiles?.length || r.filesCount || 0);
      const st = (r.status || 'FILES').toUpperCase();
      if (st === 'VERIFIED') map[bg].verifiedCount += 1;
      else if (st === 'PENDING') map[bg].pendingCount += 1;
      else if (st === 'UPDATED') map[bg].updatedCount += 1;

      if (r.uploadedAt && (!map[bg].latestUpload || new Date(r.uploadedAt) > new Date(map[bg].latestUpload))) {
        map[bg].latestUpload = r.uploadedAt;
      }
    });

    const folders = Object.values(map);
    folders.sort((a, b) => b.count - a.count);
    return folders;
  }, [tabFilteredRecords]);

  // Submitter Payroll Calculations
  const submitterSalaries = useMemo(() => {
    const map: Record<string, {
      submitter: string;
      totalSubmissions: number;
      verifiedCount: number;
      pendingCount: number;
      updatedCount: number;
      filesCount: number;
      totalEarned: number;
      paidAmount: number;
      balance: number;
    }> = {};

    records.forEach(r => {
      const submitter = (r.uploadedBy || 'Admin').trim();
      if (!map[submitter]) {
        map[submitter] = {
          submitter,
          totalSubmissions: 0,
          verifiedCount: 0,
          pendingCount: 0,
          updatedCount: 0,
          filesCount: 0,
          totalEarned: 0,
          paidAmount: 0,
          balance: 0
        };
      }
      map[submitter].totalSubmissions += 1;
      const st = (r.status || 'FILES').toUpperCase();
      if (st === 'VERIFIED') {
        map[submitter].verifiedCount += 1;
        map[submitter].totalEarned += baseRate;
      } else if (st === 'PENDING') {
        map[submitter].pendingCount += 1;
        map[submitter].totalEarned += pendingBaseRate;
      } else if (st === 'UPDATED') {
        map[submitter].updatedCount += 1;
      } else {
        map[submitter].filesCount += 1;
      }
    });

    // Deduct recorded settlements
    settlements.forEach(s => {
      const submitter = (s.submitter || '').trim();
      if (map[submitter]) {
        map[submitter].paidAmount += (Number(s.amountPaid) || 0);
      }
    });

    // Compute balance
    Object.values(map).forEach(item => {
      item.balance = Math.max(0, item.totalEarned - item.paidAmount);
    });

    return Object.values(map).sort((a, b) => b.totalSubmissions - a.totalSubmissions);
  }, [records, settlements, baseRate, pendingBaseRate]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalFiles = 0;
    let verified = 0;
    let pending = 0;
    let updated = 0;
    let filesOnly = 0;

    records.forEach(r => {
      totalFiles += (r.uploadedFiles?.length || r.filesCount || 0);
      const st = (r.status || 'FILES').toUpperCase();
      if (st === 'VERIFIED') verified++;
      else if (st === 'PENDING') pending++;
      else if (st === 'UPDATED') updated++;
      else filesOnly++;
    });

    const totalEarned = submitterSalaries.reduce((acc, s) => acc + s.totalEarned, 0);
    const totalPaid = submitterSalaries.reduce((acc, s) => acc + s.paidAmount, 0);
    const totalBalance = Math.max(0, totalEarned - totalPaid);

    return {
      totalRecords: records.length,
      totalFiles,
      verified,
      pending,
      updated,
      filesOnly,
      totalEarned,
      totalPaid,
      totalBalance
    };
  }, [records, submitterSalaries]);

  // Paginated display records
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [displayRecords, currentPage]);

  const totalPages = Math.ceil(displayRecords.length / ITEMS_PER_PAGE) || 1;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner & Control Header */}
      <div className="bg-gradient-to-r from-[#051f15] via-[#064e3b] to-[#047857] text-white rounded-2xl p-6 shadow-md border border-[#0a3826]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <FolderCheck className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
                  Submitted Exist. Acc.
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  {stats.totalRecords} Accounts · {stats.totalFiles} Documents
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-1">
                Barangay folders archive, patient attachments, verification audit, and salary ledger
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchRecords(true)}
              disabled={refreshing}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 cursor-pointer border border-white/10"
              title="Refresh Records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                fetchHistory();
                setIsHistoryModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-400/20 hover:bg-emerald-400/30 rounded-xl text-xs font-bold text-emerald-100 transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/30"
              title="View History Audit Trail"
            >
              <History className="w-3.5 h-3.5 text-emerald-300" />
              <span>History Logs</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 border-b border-emerald-700/50">
          {[
            { id: 'files', label: 'All Files', count: stats.totalRecords, icon: Folder },
            { id: 'verified', label: 'Verified', count: stats.verified, icon: CheckCircle2 },
            { id: 'pending', label: 'Pending', count: stats.pending, icon: Clock },
            { id: 'updated', label: 'Updated', count: stats.updated, icon: RotateCcw },
            { id: 'ledger', label: 'Ledger & Payroll', count: submitterSalaries.length, icon: Receipt },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-emerald-950 shadow-md font-extrabold'
                    : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-emerald-300'}`} />
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-black/20 text-emerald-200'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'ledger' ? (
        /* ================= LEDGER & PAYROLL TAB ================= */
        <div className="space-y-6">
          {/* Top Ledger Financial Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Submissions Value</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1 font-display">
                  ₱{stats.totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {stats.verified} Verified (₱{baseRate}) + {stats.pending} Pending (₱{pendingBaseRate})
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Coins className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Paid Out</p>
                <h3 className="text-2xl font-black text-blue-600 mt-1 font-display">
                  ₱{stats.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Across {settlements.length} settlement payouts
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding Balance</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1 font-display">
                  ₱{stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pending payroll disbursement
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Base Rate Configuration Card (Master Admin Only) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-bold text-slate-800 font-display flex items-center gap-2 text-sm">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  Submitted Exist. Acc. Rate Configuration
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set baseline compensation rate per verified and pending account submission
                </p>
              </div>

              {isMasterAdmin && (
                <button
                  onClick={handleSaveBaseRates}
                  disabled={savingRates}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {savingRates ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Save Rates</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Verified Submission Rate (₱)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!isMasterAdmin}
                    value={baseRate}
                    onChange={(e) => setBaseRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900 text-sm focus:outline-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Applied to each account verified in Submitted Exist. Acc.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pending Submission Rate (₱)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={!isMasterAdmin}
                    value={pendingBaseRate}
                    onChange={(e) => setPendingBaseRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900 text-sm focus:outline-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Applied to each account placed in Pending status
                </p>
              </div>
            </div>
          </div>

          {/* Submitter Summary Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 font-display text-sm">Submitter Compensation Tally</h4>
                <p className="text-xs text-slate-500">Summary breakdown of submitted existing accounts by submitter</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                {submitterSalaries.length} Encoders / Submitters
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Submitter</th>
                    <th className="py-3 px-4 text-center">Total Accounts</th>
                    <th className="py-3 px-4 text-center">Verified</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-4 text-right">Total Earned</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submitterSalaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                        No submissions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    submitterSalaries.map(sub => (
                      <tr key={sub.submitter} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                              {sub.submitter.charAt(0).toUpperCase()}
                            </div>
                            <span>{sub.submitter}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                          {sub.totalSubmissions}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            {sub.verifiedCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                            {sub.pendingCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          ₱{sub.totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-blue-600">
                          ₱{sub.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-amber-600">
                          ₱{sub.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isMasterAdmin ? (
                            <button
                              onClick={() => {
                                setSettleModalTarget({
                                  submitter: sub.submitter,
                                  totalSubmissions: sub.totalSubmissions,
                                  verifiedCount: sub.verifiedCount,
                                  pendingCount: sub.pendingCount,
                                  totalSalary: sub.totalEarned,
                                  unpaidAmount: sub.balance
                                });
                                setSettlePaymentAmount(sub.balance > 0 ? String(sub.balance) : '0');
                                setSettleReferenceNotes('');
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Settle Payroll</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">View Only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlement Payout History */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 font-display text-sm">Disbursement & Settlement History</h4>
                <p className="text-xs text-slate-500">Official log of completed compensation disbursements</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                {settlements.length} Transactions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Submitter</th>
                    <th className="py-3 px-4 text-center">Submissions</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Settled By</th>
                    <th className="py-3 px-4 text-center">Receipt</th>
                    {isMasterAdmin && <th className="py-3 px-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settlements.length === 0 ? (
                    <tr>
                      <td colSpan={isMasterAdmin ? 8 : 7} className="py-8 text-center text-slate-400 font-medium">
                        No settlements disbursed yet.
                      </td>
                    </tr>
                  ) : (
                    settlements.map(settle => (
                      <tr key={settle.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(settle.settledAt || settle.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {settle.submitter}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-600">
                          {settle.totalSubmissions}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700">
                          ₱{Number(settle.amountPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {settle.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {settle.settledBy || 'Master Admin'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setViewingReceipt(settle)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Print / View Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                        {isMasterAdmin && (
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteSettlement(settle.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Settlement"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= FOLDERS / FILES TABS ================= */
        <div className="space-y-6">
          {/* Search, Filter & Mode Switcher Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search patient, barangay, purok, or submitter..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {/* Barangay Filter Dropdown */}
              <select
                value={selectedBarangay}
                onChange={(e) => {
                  setSelectedBarangay(e.target.value);
                  setSelectedFolder(null);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">All Barangays</option>
                {barangayFolders.map(f => (
                  <option key={f.barangay} value={f.barangay}>
                    {f.barangay} ({f.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Folder Mode Switcher */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              {selectedFolder && (
                <button
                  onClick={() => setSelectedFolder(null)}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>All Folders</span>
                </button>
              )}

              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => {
                    setFolderViewMode('folders');
                    setSelectedFolder(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    folderViewMode === 'folders' && !selectedFolder
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Folders View
                </button>
                <button
                  onClick={() => {
                    setFolderViewMode('all');
                    setSelectedFolder(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    folderViewMode === 'all'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Grid View ({displayRecords.length})
                </button>
              </div>
            </div>
          </div>

          {/* FOLDERS VIEW (When not inside a specific folder and mode is 'folders') */}
          {folderViewMode === 'folders' && !selectedFolder ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 font-display flex items-center gap-2 text-sm">
                  <FolderTree className="w-4 h-4 text-emerald-600" />
                  Barangay Folders ({barangayFolders.length} Folders)
                </h3>
                <span className="text-xs text-slate-400">
                  Click a folder to view all submitted contacts & attached files
                </span>
              </div>

              {barangayFolders.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                  <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-700">No submitted existing account records</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    When contacts are submitted from the Existing Account Files page, they will appear here grouped by Barangay.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {barangayFolders.map(folder => (
                    <motion.div
                      key={folder.barangay}
                      whileHover={{ y: -2 }}
                      onClick={() => {
                        setSelectedFolder(folder.barangay);
                        setCurrentPage(1);
                      }}
                      className="bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          <Folder className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                          {folder.count} {folder.count === 1 ? 'Record' : 'Records'}
                        </span>
                      </div>

                      <div className="mt-4">
                        <h4 className="font-black text-slate-900 text-sm group-hover:text-emerald-700 transition-colors truncate">
                          {folder.barangay}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {folder.filesCount} Total Attached Document(s)
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-emerald-700">
                          ✓ {folder.verifiedCount} Verified
                        </span>
                        {folder.pendingCount > 0 && (
                          <span className="font-bold text-amber-600">
                            ⏳ {folder.pendingCount} Pending
                          </span>
                        )}
                        <span className="text-slate-400 font-medium">Open &rarr;</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ================= CONTACT CARDS GRID VIEW ================= */
            <div className="space-y-4">
              {/* Folder Breadcrumb / Active Header */}
              {selectedFolder && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/80 rounded-2xl px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <FolderOpen className="w-5 h-5 text-emerald-700" />
                    <div>
                      <h4 className="font-extrabold text-emerald-950 text-sm">
                        Barangay {selectedFolder}
                      </h4>
                      <p className="text-[11px] text-emerald-700">
                        Showing {displayRecords.length} submitted contact record(s)
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedFolder(null)}
                    className="px-3 py-1.5 bg-white text-emerald-800 font-bold text-xs rounded-xl border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    &larr; Back to All Folders
                  </button>
                </div>
              )}

              {/* Cards Grid */}
              {displayRecords.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-700">No matching submitted records found</h4>
                  <p className="text-xs text-slate-400 mt-1">Try refining your search keyword or selected filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedRecords.map(record => {
                    const st = (record.status || 'FILES').toUpperCase();
                    let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (st === 'VERIFIED') badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    else if (st === 'PENDING') badgeBg = 'bg-amber-100 text-amber-800 border-amber-200';
                    else if (st === 'UPDATED') badgeBg = 'bg-blue-100 text-blue-800 border-blue-200';

                    const files = record.uploadedFiles || [];

                    return (
                      <div
                        key={record.id}
                        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        {/* Header Details */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                                <User className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-black text-slate-900 text-sm truncate uppercase font-display">
                                  {record.fullName}
                                </h4>
                                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{record.barangay}{record.purok ? ` · Purok ${record.purok}` : ''}</span>
                                </p>
                              </div>
                            </div>

                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeBg} shrink-0`}>
                              {st}
                            </span>
                          </div>

                          {/* Contact & Telemetry metadata */}
                          <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                            {record.contactNumber && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-semibold">{record.contactNumber}</span>
                              </div>
                            )}

                            {record.pin && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PIN:</span>
                                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                  {record.pin}
                                </span>
                              </div>
                            )}

                            {record.geotagged && (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                                <MapPin className="w-3 h-3 text-emerald-600" />
                                <span>Geotagged ({record.latitude?.toFixed(4)}, {record.longitude?.toFixed(4)})</span>
                              </div>
                            )}

                            {record.facebookLink && (
                              <div className="flex items-center gap-1.5">
                                <LinkIcon className="w-3 h-3 text-blue-500" />
                                <a
                                  href={record.facebookLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-bold text-blue-600 hover:underline truncate"
                                >
                                  Facebook Profile
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Attached Documents Preview Section */}
                          <div className="mt-4 pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                Attached Documents ({files.length})
                              </span>
                            </div>

                            {files.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">No attachments uploaded.</p>
                            ) : (
                              <div className="grid grid-cols-3 gap-2">
                                {files.slice(0, 3).map((f, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() => setActiveLightboxFile({ url: f.url || (f as any).fileUrl || '', name: f.name || 'document' })}
                                    className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video flex items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors"
                                  >
                                    {f.url?.startsWith('data:image') || f.url?.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                                      <img
                                        src={f.url}
                                        alt={f.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                    ) : (
                                      <FileText className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
                                    )}
                                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Eye className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Submitter info and Status Actions */}
                        <div className="mt-5 pt-3.5 border-t border-slate-100 space-y-3">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>By: <strong className="text-slate-700">{record.uploadedBy || 'Admin'}</strong></span>
                            <span>{new Date(record.uploadedAt).toLocaleDateString()}</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleUpdateStatus(record, 'VERIFIED')}
                              disabled={updatingStatusId === record.id || st === 'VERIFIED'}
                              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                                st === 'VERIFIED'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verify</span>
                            </button>

                            <button
                              onClick={() => handleUpdateStatus(record, 'PENDING')}
                              disabled={updatingStatusId === record.id || st === 'PENDING'}
                              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                                st === 'PENDING'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>Pending</span>
                            </button>

                            <button
                              onClick={() => setSelectedRecord(record)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              title="Full Details"
                            >
                              <Eye className="w-3 h-3" />
                            </button>

                            <button
                              onClick={() => setDeleteTarget({ record, isFileOnly: false })}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                  <p className="text-xs text-slate-500 font-medium">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, displayRecords.length)} of {displayRecords.length} records
                  </p>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-800">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= DETAILS MODAL ================= */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 my-8 flex flex-col"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#051f15] to-[#047857] px-6 py-5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base font-display capitalize">
                      {selectedRecord.fullName}
                    </h3>
                    <p className="text-xs text-emerald-200">
                      {selectedRecord.barangay}{selectedRecord.purok ? ` · Purok ${selectedRecord.purok}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Contact Number</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedRecord.contactNumber || 'None'}</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Validation PIN</span>
                    <p className="font-bold font-mono text-slate-800 mt-0.5">{selectedRecord.pin || 'None'}</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                    <p className="font-bold text-emerald-700 mt-0.5 uppercase">{selectedRecord.status || 'FILES'}</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Submitted By</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedRecord.uploadedBy || 'Admin'}</p>
                  </div>
                </div>

                {selectedRecord.facebookLink && (
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs">
                    <span className="text-[10px] font-bold text-blue-500 uppercase">Facebook Account Link</span>
                    <p className="mt-0.5">
                      <a
                        href={selectedRecord.facebookLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-blue-700 hover:underline break-all"
                      >
                        {selectedRecord.facebookLink}
                      </a>
                    </p>
                  </div>
                )}

                {/* Attachments List */}
                <div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5">
                    Attached Files & Documents ({selectedRecord.uploadedFiles?.length || 0})
                  </h4>

                  {(!selectedRecord.uploadedFiles || selectedRecord.uploadedFiles.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">No attachments found.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedRecord.uploadedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{file.name}</p>
                              {file.uploadedAt && (
                                <p className="text-[10px] text-slate-400">{new Date(file.uploadedAt).toLocaleString()}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setActiveLightboxFile({ url: file.url || (file as any).fileUrl || '', name: file.name })}
                              className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg text-[11px] hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>

                            <button
                              onClick={() => setDeleteTarget({ record: selectedRecord, fileIndex: idx, isFileOnly: true })}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete File"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => setDeleteTarget({ record: selectedRecord, isFileOnly: false })}
                  className="px-4 py-2 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Record</span>
                </button>

                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= LIGHTBOX PREVIEW ================= */}
      <AnimatePresence>
        {activeLightboxFile && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="max-w-4xl w-full flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-white pb-3">
                <p className="font-bold text-sm truncate">{activeLightboxFile.name}</p>
                <div className="flex items-center gap-2">
                  <a
                    href={activeLightboxFile.url}
                    download={activeLightboxFile.name}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white"
                    title="Download File"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setActiveLightboxFile(null)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-black/60 rounded-2xl overflow-hidden border border-white/10 p-2 max-h-[80vh] flex items-center justify-center">
                <img
                  src={activeLightboxFile.url}
                  alt={activeLightboxFile.name}
                  className="max-h-[75vh] max-w-full object-contain rounded-xl"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="bg-gradient-to-r from-rose-900 to-slate-950 px-6 py-5 text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center border border-rose-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-display">Confirm Deletion</h3>
                  <p className="text-xs text-rose-200">This action is permanent and cannot be undone</p>
                </div>
              </div>

              <div className="p-6 text-xs text-slate-600 space-y-2">
                <p>
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-slate-900">
                    {deleteTarget.isFileOnly ? 'this document attachment' : `"${deleteTarget.record.fullName}"`}
                  </strong>
                  ?
                </p>
                <p className="text-[11px] text-slate-400">
                  The record will be removed from local storage and cPanel MySQL database.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= SETTLE PAYROLL MODAL ================= */}
      <AnimatePresence>
        {settleModalTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="bg-gradient-to-r from-emerald-900 to-slate-950 px-6 py-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base font-display">Record Payroll Settlement</h3>
                    <p className="text-xs text-emerald-200">Encoder / Submitter: {settleModalTarget.submitter}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettleModalTarget(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordSettlement} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Submissions</span>
                    <p className="font-bold text-slate-800">{settleModalTarget.totalSubmissions} Total ({settleModalTarget.verifiedCount} Verified, {settleModalTarget.pendingCount} Pending)</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Outstanding Balance</span>
                    <p className="font-black text-amber-600 text-sm">₱{settleModalTarget.unpaidAmount.toFixed(2)}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Disbursement Payment Amount (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={settlePaymentAmount}
                    onChange={(e) => setSettlePaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={settlePaymentMethod}
                    onChange={(e) => setSettlePaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 text-xs outline-none focus:border-emerald-500"
                  >
                    <option value="CASH">Cash Payment</option>
                    <option value="GCASH">GCash Transfer</option>
                    <option value="BANK_TRANSFER">Bank Deposit / Transfer</option>
                    <option value="CHECK">Check Disbursement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reference Notes / Voucher ID
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Voucher #1042 - Paid in full for March batch"
                    value={settleReferenceNotes}
                    onChange={(e) => setSettleReferenceNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSettleModalTarget(null)}
                    disabled={settleSubmitting}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={settleSubmitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    {settleSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
                    <span>Confirm & Generate Receipt</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= PRINTABLE RECEIPT MODAL ================= */}
      <AnimatePresence>
        {viewingReceipt && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>Official Disbursement Receipt</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={() => setViewingReceipt(null)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Receipt Body */}
              <div className="p-8 space-y-5 text-slate-800 text-xs bg-white font-mono">
                <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-4">
                  <h3 className="font-black text-base font-display">SAINT FRANCIS CLINIC</h3>
                  <p className="text-[11px] text-slate-500">Submitted Exist. Acc. Compensation Voucher</p>
                  <p className="text-[10px] text-slate-400">Transaction ID: {viewingReceipt.id}</p>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date:</span>
                    <span className="font-bold">{new Date(viewingReceipt.settledAt || viewingReceipt.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Submitter:</span>
                    <span className="font-bold">{viewingReceipt.submitter}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Method:</span>
                    <span className="font-bold">{viewingReceipt.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Disbursed By:</span>
                    <span className="font-bold">{viewingReceipt.settledBy || 'Master Admin'}</span>
                  </div>
                </div>

                <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-2">
                  <div className="flex justify-between">
                    <span>Total Submissions Count:</span>
                    <span className="font-bold">{viewingReceipt.totalSubmissions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base Rate Applied:</span>
                    <span className="font-bold">₱{Number(viewingReceipt.baseRate).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-900">Total Amount Paid:</span>
                    <span className="font-black text-emerald-700">₱{Number(viewingReceipt.amountPaid).toFixed(2)}</span>
                  </div>
                </div>

                {viewingReceipt.referenceNotes && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <strong>Notes:</strong> {viewingReceipt.referenceNotes}
                  </div>
                )}

                <div className="pt-6 grid grid-cols-2 gap-6 text-center text-[10px] text-slate-500">
                  <div>
                    <div className="border-b border-slate-400 pb-8"></div>
                    <p className="mt-1 font-bold">Disbursing Officer</p>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 pb-8"></div>
                    <p className="mt-1 font-bold">Recipient Signature</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= HISTORY AUDIT MODAL ================= */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]"
            >
              <div className="bg-gradient-to-r from-[#051f15] to-[#047857] px-6 py-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <History className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base font-display">Submitted Exist. Acc. Action Audit Log</h3>
                    <p className="text-xs text-emerald-200">Chronological history of verification, movements, and settlements</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar in Modal */}
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search history by patient name, action, or submitter..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 font-semibold"
                  />
                </div>
              </div>

              {/* Logs Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-2.5">
                {loadingHistory ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <p className="text-xs">Loading audit trail logs...</p>
                  </div>
                ) : historyLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No history log entries recorded yet.
                  </div>
                ) : (
                  historyLogs
                    .filter(h => {
                      const q = historySearch.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (h.patientName || '').toLowerCase().includes(q) ||
                        (h.action || '').toLowerCase().includes(q) ||
                        (h.submitter || '').toLowerCase().includes(q) ||
                        (h.performedBy || '').toLowerCase().includes(q) ||
                        (h.barangay || '').toLowerCase().includes(q) ||
                        (h.details || '').toLowerCase().includes(q)
                      );
                    })
                    .map(item => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 uppercase">
                              {item.action}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="font-bold text-emerald-800">
                              {item.patientName}
                            </span>
                            {item.barangay && (
                              <span className="px-2 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-md font-semibold">
                                {item.barangay}
                              </span>
                            )}
                          </div>
                          {item.details && (
                            <p className="text-slate-600 text-[11px]">{item.details}</p>
                          )}
                          <p className="text-[10px] text-slate-400">
                            By: <strong>{item.performedBy}</strong> · Submitter: {item.submitter || 'None'}
                          </p>
                        </div>

                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
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
