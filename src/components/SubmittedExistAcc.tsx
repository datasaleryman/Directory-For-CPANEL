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
  Link as LinkIcon,
  Users,
  BookOpen,
  Banknote
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
  onNavigateToExistDirectory?: () => void;
}

export const SubmittedExistAcc: React.FC<SubmittedExistAccProps> = ({
  authToken,
  currentUser,
  showToast,
  onNavigateToExistDirectory
}) => {
  // Main Data States
  const [records, setRecords] = useState<SubmittedExistAccRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab State: 'files' | 'verified' | 'pending' | 'updated' | 'ledger' | 'settlement-logs'
  const [activeTab, setActiveTab] = useState<'files' | 'verified' | 'pending' | 'updated' | 'ledger' | 'settlement-logs'>('files');

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

  // Print Ledger Modal & Reports
  const [showPrintLedgerModal, setShowPrintLedgerModal] = useState<boolean>(false);
  const [printReportType, setPrintReportType] = useState<'pending' | 'verified' | 'all'>('all');

  // Custom Print Blank Payroll Form States
  const [showCustomPrintModal, setShowCustomPrintModal] = useState<boolean>(false);
  const [blankRowCount, setBlankRowCount] = useState<number>(15);
  const [blankPayrollTitle, setBlankPayrollTitle] = useState<string>('EXIST. ACC. SUBMITTERS PAYROLL REGISTER');
  const [blankBarangay, setBlankBarangay] = useState<string>('');
  const [blankPeriod, setBlankPeriod] = useState<string>(
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );
  const [blankOrientation, setBlankOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Settlement Logs Tab State & Search
  const [settlementSearch, setSettlementSearch] = useState<string>('');
  
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
    if (activeTab === 'ledger' || activeTab === 'settlement-logs') {
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
          verifiedCount: settleModalTarget.verifiedCount,
          pendingCount: settleModalTarget.pendingCount,
          baseRate: baseRate,
          pendingBaseRate: pendingBaseRate,
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

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return ts;
    }
  };

  const formatPrintDate = (d: Date = new Date()) => {
    try {
      const monthDayYear = d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      const timeStr = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${monthDayYear} at ${timeStr}`;
    } catch {
      return d.toLocaleDateString();
    }
  };

  // Filtered settlements for Settlement Logs tab
  const filteredSettlements = useMemo(() => {
    if (!settlementSearch.trim()) return settlements;
    const q = settlementSearch.toLowerCase().trim();
    return settlements.filter((st) =>
      (st.submitter && st.submitter.toLowerCase().includes(q)) ||
      (st.settledBy && st.settledBy.toLowerCase().includes(q)) ||
      (st.paymentMethod && st.paymentMethod.toLowerCase().includes(q)) ||
      (st.referenceNotes && st.referenceNotes.toLowerCase().includes(q)) ||
      (st.settledAt && st.settledAt.toLowerCase().includes(q))
    );
  }, [settlements, settlementSearch]);

  // Aggregate stats for Settlement Logs tab
  const totalSettledAmount = useMemo(() => {
    return settlements.reduce((sum, s) => sum + (Number(s.amountPaid ?? s.totalSalary) || 0), 0);
  }, [settlements]);

  const totalSettledSubmissions = useMemo(() => {
    return settlements.reduce((sum, s) => sum + (Number(s.totalSubmissions) || 0), 0);
  }, [settlements]);

  // Export Settlement Logs to CSV Function
  const exportSettlementsToCsv = () => {
    if (settlements.length === 0) {
      showToast('No settlement logs available to export', 'warning');
      return;
    }
    const headers = [
      'Settlement Date & Time',
      'Submitter Name',
      'Total Accounts',
      'Verified Accounts',
      'Pending Accounts',
      'Settled Salary (PHP)',
      'Amount Paid (PHP)',
      'Payment Status',
      'Disbursement Method',
      'Settled By',
      'Reference Notes'
    ];
    const rows = filteredSettlements.map((st) => [
      `"${formatTimestamp(st.settledAt || st.createdAt || '').replace(/"/g, '""')}"`,
      `"${(st.submitter || '').replace(/"/g, '""')}"`,
      st.totalSubmissions,
      st.verifiedCount ?? '',
      st.pendingCount ?? '',
      (Number(st.totalSalary) || 0).toFixed(2),
      (Number(st.amountPaid ?? st.totalSalary) || 0).toFixed(2),
      `"${(st.paymentStatus || 'SETTLED').replace(/"/g, '""')}"`,
      `"${(st.paymentMethod || 'CASH').replace(/"/g, '""')}"`,
      `"${(st.settledBy || 'Master Admin').replace(/"/g, '""')}"`,
      `"${(st.referenceNotes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `exist_acc_settlement_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Settlement Logs exported to CSV successfully', 'success');
  };

  // Print Ledger Data computation
  const printLedgerData = useMemo(() => {
    let list: {
      name: string;
      households: number;
      payout: number;
    }[] = [];

    let sectionTitle = 'PENDING PAYOUT';
    let reportSubtitle = 'Submitted Exist. Acc. — Pending Payout Report';
    let rateLabel = `Base Rate per Account: PHP ${pendingBaseRate.toFixed(2)}`;
    let householdLabel = 'TOTAL PENDING ACCOUNTS';
    let payoutLabel = 'TOTAL PENDING PAYOUT';

    if (printReportType === 'pending') {
      sectionTitle = 'PENDING PAYOUT';
      reportSubtitle = 'Submitted Exist. Acc. — Pending Payout Report';
      rateLabel = `Base Rate per Account: PHP ${pendingBaseRate.toFixed(2)}`;
      householdLabel = 'TOTAL PENDING ACCOUNTS';
      payoutLabel = 'TOTAL PENDING PAYOUT';
      list = submitterSalaries
        .filter(sub => sub.pendingCount > 0)
        .map(sub => ({
          name: sub.submitter,
          households: sub.pendingCount,
          payout: sub.pendingCount * pendingBaseRate
        }))
        .sort((a, b) => b.households - a.households || b.payout - a.payout);
    } else if (printReportType === 'verified') {
      sectionTitle = 'VERIFIED PAYOUT';
      reportSubtitle = 'Submitted Exist. Acc. — Verified Payout Report';
      rateLabel = `Base Rate per Account: PHP ${baseRate.toFixed(2)}`;
      householdLabel = 'TOTAL VERIFIED ACCOUNTS';
      payoutLabel = 'TOTAL VERIFIED PAYOUT';
      list = submitterSalaries
        .filter(sub => sub.verifiedCount > 0)
        .map(sub => ({
          name: sub.submitter,
          households: sub.verifiedCount,
          payout: sub.verifiedCount * baseRate
        }))
        .sort((a, b) => b.households - a.households || b.payout - a.payout);
    } else {
      sectionTitle = 'COMBINED EXIST. ACC. PAYOUT';
      reportSubtitle = 'Submitted Exist. Acc. — Total Contributor Payroll Ledger';
      rateLabel = `Base Rates: Verified PHP ${baseRate.toFixed(2)} | Pending PHP ${pendingBaseRate.toFixed(2)}`;
      householdLabel = 'TOTAL SUBMITTED ACCOUNTS';
      payoutLabel = 'TOTAL COMPUTED PAYOUT';
      list = submitterSalaries
        .filter(sub => (sub.verifiedCount + sub.pendingCount) > 0)
        .map(sub => ({
          name: sub.submitter,
          households: sub.verifiedCount + sub.pendingCount,
          payout: (sub.verifiedCount * baseRate) + (sub.pendingCount * pendingBaseRate)
        }))
        .sort((a, b) => b.households - a.households || b.payout - a.payout);
    }

    const totalHouseholds = list.reduce((sum, item) => sum + item.households, 0);
    const totalPayout = list.reduce((sum, item) => sum + item.payout, 0);

    return {
      list,
      sectionTitle,
      reportSubtitle,
      rateLabel,
      householdLabel,
      payoutLabel,
      totalHouseholds,
      totalPayout
    };
  }, [submitterSalaries, printReportType, pendingBaseRate, baseRate]);

  // Execute High-Fidelity Print formatted identically to official Saint Francis Clinic PDF
  const handleExecutePrintLedger = () => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-9999px';
    printFrame.style.left = '-9999px';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const formattedDate = formatPrintDate(new Date());

    const rowsHtml = printLedgerData.list.map(item => `
      <tr>
        <td class="col-sub">${item.name}</td>
        <td class="col-hh">${item.households}</td>
        <td class="col-pay">PHP ${item.payout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Submitted Exist. Acc. Files Ledger - ${printLedgerData.sectionTitle}</title>
        <style>
          @page {
            size: portrait;
            margin: 15mm 18mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .ledger-page {
            max-width: 760px;
            margin: 0 auto;
            padding: 8px 0;
          }
          .clinic-brand {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.32em;
            color: #475569;
            text-align: center;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          .main-title {
            font-size: 26px;
            font-weight: 800;
            color: #0f172a;
            text-align: center;
            margin: 0 0 6px 0;
            letter-spacing: -0.02em;
          }
          .subtitle {
            font-size: 13px;
            font-weight: 500;
            color: #475569;
            text-align: center;
            margin: 0 0 28px 0;
          }
          .meta-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            font-weight: 500;
            color: #334155;
            padding-bottom: 12px;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 24px;
          }
          .section-title {
            font-size: 12.5px;
            font-weight: 800;
            letter-spacing: 0.08em;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 14px;
          }
          .summary-cards {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 28px;
          }
          .summary-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px 20px;
            background: #ffffff;
          }
          .card-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.05em;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .card-value {
            font-size: 28px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            line-height: 1.2;
          }
          .card-value.payout {
            color: #059669;
          }
          .ledger-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 32px;
          }
          .ledger-table th {
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: #64748b;
            padding: 12px 4px;
            border-bottom: 1px solid #cbd5e1;
          }
          .ledger-table th.col-sub {
            text-align: left;
            width: 45%;
          }
          .ledger-table th.col-hh {
            text-align: left;
            width: 25%;
            padding-left: 8px;
          }
          .ledger-table th.col-pay {
            text-align: right;
            width: 30%;
            padding-right: 4px;
          }
          .ledger-table td {
            padding: 11px 4px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 12px;
          }
          .ledger-table td.col-sub {
            font-weight: 600;
            color: #0f172a;
            text-align: left;
          }
          .ledger-table td.col-hh {
            font-weight: 500;
            color: #475569;
            text-align: left;
            padding-left: 8px;
          }
          .ledger-table td.col-pay {
            font-weight: 700;
            color: #059669;
            text-align: right;
            padding-right: 4px;
          }
          .ledger-footer {
            font-size: 10.5px;
            color: #94a3b8;
            text-align: center;
            padding-top: 20px;
            margin-top: 24px;
          }
        </style>
      </head>
      <body>
        <div class="ledger-page">
          <div class="clinic-brand">S A I N T &nbsp; F R A N C I S &nbsp; C L I N I C &nbsp; ( S F C )</div>
          <h1 class="main-title">Submitted Exist. Acc. Files Ledger</h1>
          <div class="subtitle">${printLedgerData.reportSubtitle}</div>

          <div class="meta-bar">
            <span>${printLedgerData.rateLabel}</span>
            <span>Generated: ${formattedDate}</span>
          </div>

          <div class="section-title">${printLedgerData.sectionTitle}</div>

          <div class="summary-cards">
            <div class="summary-card">
              <div class="card-label">${printLedgerData.householdLabel}</div>
              <div class="card-value">${printLedgerData.totalHouseholds}</div>
            </div>
            <div class="summary-card">
              <div class="card-label">${printLedgerData.payoutLabel}</div>
              <div class="card-value payout">PHP ${printLedgerData.totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <table class="ledger-table">
            <thead>
              <tr>
                <th class="col-sub">SUBMITTED BY</th>
                <th class="col-hh">ACCOUNTS SUBMITTED</th>
                <th class="col-pay">TOTAL PAYOUT</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="3" style="text-align:center; padding:24px; color:#94a3b8;">No submissions recorded.</td></tr>'}
            </tbody>
          </table>

          <div class="ledger-footer">
            Saint Francis Clinic — Submitted Exist. Acc. Files Ledger &middot; Generated ${formattedDate}
          </div>
        </div>
      </body>
      </html>
    `;

    const doc = printFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 2000);
      }, 300);
    } else {
      window.print();
    }
  };

  // Execute High-Fidelity Custom Print Blank Payroll Form matching Saint Francis Clinic format
  const handleExecutePrintBlankPayroll = () => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-9999px';
    printFrame.style.left = '-9999px';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const rowsCount = Math.max(1, Math.min(100, Number(blankRowCount) || 15));
    const formattedDate = formatPrintDate(new Date());

    let rowsHtml = '';
    for (let i = 1; i <= rowsCount; i++) {
      rowsHtml += `
        <tr>
          <td class="col-num">${i}</td>
          <td class="col-name"><div class="blank-line"></div></td>
          <td class="col-brgy"><div class="blank-line"></div></td>
          <td class="col-v"><div class="blank-line"></div></td>
          <td class="col-p"><div class="blank-line"></div></td>
          <td class="col-amt"><div class="blank-line"></div></td>
          <td class="col-sig"><div class="blank-sig"></div></td>
          <td class="col-rem"><div class="blank-line"></div></td>
        </tr>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${blankPayrollTitle} - Saint Francis Clinic</title>
        <style>
          @page {
            size: ${blankOrientation};
            margin: 10mm 12mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sheet-container {
            width: 100%;
            max-width: 1080px;
            margin: 0 auto;
            padding: 4px 0;
          }
          .header-clinic {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.3em;
            color: #047857;
            text-align: center;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .header-title {
            font-size: 20px;
            font-weight: 900;
            color: #0f172a;
            text-align: center;
            margin: 0 0 3px 0;
            letter-spacing: -0.01em;
            text-transform: uppercase;
          }
          .header-subtitle {
            font-size: 11px;
            font-weight: 600;
            color: #475569;
            text-align: center;
            margin: 0 0 14px 0;
            letter-spacing: 0.05em;
          }
          .meta-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10.5px;
            padding: 6px 12px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            margin-bottom: 12px;
          }
          .meta-item {
            font-weight: 600;
            color: #334155;
          }
          .meta-item strong {
            color: #0f172a;
          }
          .payroll-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .payroll-table th {
            border: 1.5px solid #0f172a;
            background: #f1f5f9;
            color: #0f172a;
            font-size: 9.5px;
            font-weight: 800;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            padding: 7px 4px;
            text-align: center;
          }
          .payroll-table td {
            border: 1px solid #94a3b8;
            padding: 4px 4px;
            height: 32px;
            vertical-align: middle;
            font-size: 11px;
          }
          .col-num { width: 32px; text-align: center; font-weight: 700; color: #475569; }
          .col-name { width: 220px; }
          .col-brgy { width: 140px; }
          .col-v { width: 95px; text-align: center; }
          .col-p { width: 95px; text-align: center; }
          .col-amt { width: 120px; text-align: right; }
          .col-sig { width: 160px; }
          .col-rem { width: 120px; }
          .blank-line {
            width: 100%;
            height: 100%;
            min-height: 16px;
          }
          .blank-sig {
            width: 85%;
            margin: 0 auto;
            border-bottom: 1px dashed #94a3b8;
            height: 14px;
          }
          .totals-row td {
            font-weight: 800;
            background: #f8fafc;
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            font-size: 10px;
            padding: 6px 6px;
          }
          .signatures-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
            padding-top: 4px;
            page-break-inside: avoid;
          }
          .sig-card {
            text-align: center;
          }
          .sig-underline {
            border-bottom: 1.5px solid #0f172a;
            margin: 32px 16px 5px 16px;
          }
          .sig-title {
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .sig-name {
            font-size: 11.5px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
          }
          .footer-note {
            font-size: 9px;
            color: #94a3b8;
            text-align: center;
            margin-top: 18px;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="sheet-container">
          <div class="header-clinic">S A I N T &nbsp; F R A N C I S &nbsp; C L I N I C &nbsp; ( S F C )</div>
          <h1 class="header-title">${blankPayrollTitle}</h1>
          <div class="header-subtitle">Official Submissions Payroll & Disbursement Sheet &bull; Exist. Acc. Division</div>

          <div class="meta-box">
            <div class="meta-item">Coverage / Area: <strong>${blankBarangay || 'All SFC Coverage Areas'}</strong></div>
            <div class="meta-item">Payroll Period: <strong>${blankPeriod}</strong></div>
            <div class="meta-item">Form Rows: <strong>${rowsCount} Line Entries</strong></div>
            <div class="meta-item">Print Date: <strong>${formattedDate}</strong></div>
          </div>

          <table class="payroll-table">
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th class="col-name">Name of Submitter / Worker</th>
                <th class="col-brgy">Barangay / Purok</th>
                <th class="col-v">Verified (Qty)</th>
                <th class="col-p">Pending (Qty)</th>
                <th class="col-amt">Total Salary (PHP)</th>
                <th class="col-sig">Signature of Recipient</th>
                <th class="col-rem">Remarks / Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="totals-row">
                <td colspan="3" style="text-align: right; padding-right: 12px; font-weight: 900; letter-spacing: 0.05em;">BATCH TOTALS:</td>
                <td style="text-align: center; font-weight: 900;">—</td>
                <td style="text-align: center; font-weight: 900;">—</td>
                <td style="text-align: right; font-weight: 900; padding-right: 8px;">PHP &nbsp; ________________</td>
                <td colspan="2" style="text-align: center; font-size: 9px; color: #64748b; font-style: italic;">All disbursed funds verified against official audit</td>
              </tr>
            </tbody>
          </table>

          <div class="signatures-grid">
            <div class="sig-card">
              <div class="sig-underline"></div>
              <div class="sig-title">Prepared & Encoded By</div>
              <div class="sig-name">${currentUser?.username || 'Encoder / Staff'}</div>
            </div>
            <div class="sig-card">
              <div class="sig-underline"></div>
              <div class="sig-title">Certified & Audited By</div>
              <div class="sig-name">Mel Feliciano (Master Admin)</div>
            </div>
            <div class="sig-card">
              <div class="sig-underline"></div>
              <div class="sig-title">Approved for Disbursement</div>
              <div class="sig-name">Clinic Director / Finance Head</div>
            </div>
          </div>

          <div class="footer-note">
            Saint Francis Clinic &bull; Submitted Exist. Acc. Payroll Form &bull; Generated: ${formattedDate} &bull; Confidential & Official Record
          </div>
        </div>
      </body>
      </html>
    `;

    const doc = printFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 2000);
      }, 300);
    } else {
      window.print();
    }
  };

  // Print Official Settlement Voucher
  const handlePrintVoucher = (
    subName: string,
    submissionsCount: number,
    salary: number,
    amount: number,
    method: string,
    notes: string,
    settledAt?: string
  ) => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-9999px';
    printFrame.style.left = '-9999px';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const dateFormatted = formatPrintDate(settledAt ? new Date(settledAt) : new Date());

    const voucherHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Exist. Acc. Settlement Voucher - ${subName}</title>
        <style>
          @page { margin: 15mm; size: auto; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; margin: 0; background: #fff; }
          .voucher-container { border: 2px solid #0f172a; padding: 32px; border-radius: 12px; max-width: 680px; margin: 0 auto; box-sizing: border-box; }
          .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 18px; margin-bottom: 24px; }
          .clinic-name { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; color: #047857; margin-bottom: 4px; }
          .doc-title { font-size: 15px; font-weight: 800; letter-spacing: 1px; color: #0f172a; text-transform: uppercase; margin-bottom: 4px; }
          .meta-info { font-size: 12px; color: #64748b; font-weight: 500; }
          .table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
          .table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
          .table td.label { font-weight: 600; color: #334155; width: 45%; }
          .table td.value { font-weight: 700; color: #0f172a; text-align: right; }
          .highlight-row td { background-color: #ecfdf5; font-size: 15px; color: #065f46; font-weight: 900; border-top: 1px solid #a7f3d0; border-bottom: 1px solid #a7f3d0; }
          .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; color: #475569; margin-bottom: 28px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; }
          .sig-block { text-align: center; width: 42%; }
          .sig-line { border-bottom: 1px solid #0f172a; margin-top: 48px; margin-bottom: 6px; }
          .sig-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; }
          .sig-name { font-size: 13px; font-weight: 800; color: #0f172a; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="voucher-container">
          <div class="header">
            <div class="clinic-name">SAINT FRANCIS CLINIC</div>
            <div class="doc-title">SUBMITTED EXIST. ACC. SALARY SETTLEMENT VOUCHER</div>
            <div class="meta-info">Date Issued: ${dateFormatted} &bull; Official Payroll Record</div>
          </div>

          <table class="table">
            <tr>
              <td class="label">Submitter / Recipient</td>
              <td class="value">${subName}</td>
            </tr>
            <tr>
              <td class="label">Total Accounts Submitted</td>
              <td class="value">${submissionsCount} accounts</td>
            </tr>
            <tr>
              <td class="label">Approved Base Rate</td>
              <td class="value">₱${baseRate.toFixed(2)} (Verified) / ₱${pendingBaseRate.toFixed(2)} (Pending)</td>
            </tr>
            <tr>
              <td class="label">Computed Total Salary</td>
              <td class="value">₱${salary.toFixed(2)}</td>
            </tr>
            <tr class="highlight-row">
              <td class="label">Amount Settled & Disbursed</td>
              <td class="value">₱${amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="label">Disbursement Method</td>
              <td class="value">${(method || 'CASH').toUpperCase()}</td>
            </tr>
            <tr>
              <td class="label">Settlement Status</td>
              <td class="value" style="color: #047857; font-weight: 800;">PAID & SETTLED</td>
            </tr>
          </table>

          ${notes ? `<div class="notes-box"><strong>Remarks / Memo:</strong> ${notes}</div>` : ''}

          <div class="signatures">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-name">${currentUser?.username || 'Master Admin'}</div>
              <div class="sig-title">Disbursing Officer / Master Admin</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-name">${subName}</div>
              <div class="sig-title">Received By (Submitter)</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const doc = printFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(voucherHtml);
      doc.close();
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 2000);
      }, 300);
    } else {
      window.print();
    }
  };

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
                  Submit Exist.
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
            {onNavigateToExistDirectory && (
              <button
                onClick={onNavigateToExistDirectory}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 cursor-pointer shadow-xs border border-emerald-400/30"
                title="Go to Exist. Directory"
              >
                <Folder className="w-3.5 h-3.5 text-emerald-200" />
                <span>Exist. Directory</span>
              </button>
            )}

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
            { id: 'settlement-logs', label: 'Settlement Logs', count: settlements.length, icon: ShieldCheck },
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
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-800 font-display text-sm">Submitter Compensation Tally</h4>
                <p className="text-xs text-slate-500">Summary breakdown of submitted existing accounts by submitter</p>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowCustomPrintModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs transition-all cursor-pointer shadow-md shadow-emerald-600/20 min-h-[38px]"
                  title="Custom Print Blank Payroll Form with custom row count"
                >
                  <Printer className="w-3.5 h-3.5 text-white" />
                  <span>Custom Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintLedgerModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-emerald-950 font-bold text-xs transition-all cursor-pointer shadow-xs min-h-[38px]"
                  title="Print Submitted Exist. Acc. Files Ledger report"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Print Ledger</span>
                </button>

                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                  {submitterSalaries.length} Encoders / Submitters
                </span>
              </div>
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
      ) : activeTab === 'settlement-logs' ? (
        /* ================= SETTLEMENT LOGS TAB ================= */
        <motion.div
          key="settlement-logs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Header & Action Bar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                  <Receipt className="w-5 h-5 text-emerald-700" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 font-display">
                  Settlement Logs & Disbursements
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium pl-8">
                Complete audit trail of processed compensation disbursements, payment vouchers, and settlements
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={exportSettlementsToCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer shadow-xs min-h-[38px]"
                title="Export Settlement Logs to CSV spreadsheet"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer shadow-md shadow-emerald-600/20 min-h-[38px]"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Go to Payroll Ledger</span>
              </button>

              <button
                type="button"
                onClick={() => fetchSettlements()}
                disabled={loadingSettlements}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
                title="Refresh settlements"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSettlements ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Settlement Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Total Settlements */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 flex items-center justify-between border border-slate-200/80 shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Settlements Logged
                </span>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                  {settlements.length}
                </div>
                <span className="text-[11px] text-slate-400 font-medium block">
                  Disbursement records
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
            </div>

            {/* 2. Total Disbursed */}
            <div className="rounded-2xl p-4 sm:p-5 flex items-center justify-between bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-600/15 border-2 border-emerald-500/30 shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-900">
                  Total Disbursed
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-950 font-display">
                  ₱{totalSettledAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-emerald-700 font-medium block">
                  Total payout released
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Banknote className="w-6 h-6" />
              </div>
            </div>

            {/* 3. Total Submissions Settled */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 flex items-center justify-between border border-slate-200/80 shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Accounts Cleared
                </span>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
                  {totalSettledSubmissions}
                </div>
                <span className="text-[11px] text-slate-400 font-medium block">
                  Credits compensated
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <FolderCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Settlement Records Container */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Search Bar & Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={settlementSearch}
                  onChange={(e) => setSettlementSearch(e.target.value)}
                  placeholder="Filter submitter, method, settled by, or notes..."
                  className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white placeholder:text-slate-400 transition-all"
                />
                {settlementSearch && (
                  <button
                    type="button"
                    onClick={() => setSettlementSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-slate-500">
                  Showing {filteredSettlements.length} of {settlements.length} Settlements
                </div>
              </div>
            </div>

            {/* Table or Empty State */}
            {settlements.length === 0 ? (
              <div className="py-16 text-center space-y-3 px-4">
                <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Receipt className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-800">No settlement records found</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    When submitter salaries are settled from the Payroll Ledger, official disbursement records and printable vouchers will appear here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('ledger')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer mt-2"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Go to Payroll Ledger</span>
                </button>
              </div>
            ) : filteredSettlements.length === 0 ? (
              <div className="py-12 text-center space-y-2 px-4">
                <p className="text-sm font-medium text-slate-600">No settlements match "{settlementSearch}"</p>
                <button
                  type="button"
                  onClick={() => setSettlementSearch('')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
                >
                  Clear search filter
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-4">Date / Time</th>
                      <th className="py-3.5 px-4">Submitter</th>
                      <th className="py-3.5 px-4 text-center">Accounts</th>
                      <th className="py-3.5 px-4 text-right">Settled Salary</th>
                      <th className="py-3.5 px-4 text-right">Amount Paid</th>
                      <th className="py-3.5 px-4">Payment Method</th>
                      <th className="py-3.5 px-4">Settled By</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSettlements.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                          {formatTimestamp(st.settledAt || st.createdAt || '')}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {st.submitter}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="font-semibold text-slate-700">
                            {st.verifiedCount !== undefined ? `${st.verifiedCount} v. / ${st.pendingCount || 0} p.` : `${st.totalSubmissions} total`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                          ₱{(Number(st.totalSalary) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                          ₱{(Number(st.amountPaid ?? st.totalSalary) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {st.paymentMethod || 'CASH'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium whitespace-nowrap">
                          {st.settledBy || 'Master Admin'}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <button
                              type="button"
                              onClick={() => handlePrintVoucher(
                                st.submitter,
                                st.totalSubmissions,
                                Number(st.totalSalary) || 0,
                                Number(st.amountPaid ?? st.totalSalary) || 0,
                                st.paymentMethod || 'CASH',
                                st.referenceNotes || '',
                                st.settledAt
                              )}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Print Official Disbursement Voucher"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {isMasterAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSettlement(st.id)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete settlement record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
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

      {/* ========================================================================= */}
      {/* PRINT SUBMITTED EXIST ACC FILES LEDGER MODAL                               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showPrintLedgerModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Modal Header Toolbar */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                    <Printer className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg font-display">
                      Print Exist. Acc. Files Ledger
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Official formatted PDF & Print preview
                    </p>
                  </div>
                </div>

                {/* Report Type Selector Pills */}
                <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPrintReportType('pending')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      printReportType === 'pending'
                        ? 'bg-white text-emerald-950 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pending Payout
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintReportType('verified')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      printReportType === 'verified'
                        ? 'bg-white text-emerald-950 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Verified Payout
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintReportType('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      printReportType === 'all'
                        ? 'bg-white text-emerald-950 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Combined
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleExecutePrintLedger}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrintLedgerModal(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Close Print Preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Printable Document Preview */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100">
                <div className="bg-white rounded-xl shadow-lg border border-slate-200/80 p-6 sm:p-10 md:p-14 max-w-2xl mx-auto space-y-6 text-slate-800">
                  {/* Header Subtitle / Clinic Branding */}
                  <div className="text-center font-semibold text-[11px] sm:text-xs tracking-[0.3em] text-slate-500 uppercase">
                    S A I N T &nbsp; F R A N C I S &nbsp; C L I N I C &nbsp; ( S F C )
                  </div>

                  {/* Document Title */}
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
                      Submitted Exist. Acc. Files Ledger
                    </h2>
                    <p className="text-xs sm:text-sm font-medium text-slate-500">
                      {printLedgerData.reportSubtitle}
                    </p>
                  </div>

                  {/* Metadata Bar */}
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 border-b border-slate-200 pb-3 pt-2">
                    <span>{printLedgerData.rateLabel}</span>
                    <span>Generated: {formatPrintDate(new Date())}</span>
                  </div>

                  {/* Section Title */}
                  <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 pt-1">
                    {printLedgerData.sectionTitle}
                  </div>

                  {/* Two KPI Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl p-4 bg-white">
                      <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        {printLedgerData.householdLabel}
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900">
                        {printLedgerData.totalHouseholds}
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-4 bg-white">
                      <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        {printLedgerData.payoutLabel}
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                        PHP {printLedgerData.totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="pt-2">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold">
                          <th className="py-3 text-left w-1/2">SUBMITTED BY</th>
                          <th className="py-3 text-left w-1/4 pl-2">ACCOUNTS SUBMITTED</th>
                          <th className="py-3 text-right w-1/4">TOTAL PAYOUT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {printLedgerData.list.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                              No submissions found for this report.
                            </td>
                          </tr>
                        ) : (
                          printLedgerData.list.map((item, idx) => (
                            <tr key={`${item.name}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 text-slate-900 font-semibold text-xs sm:text-[13px]">
                                {item.name}
                              </td>
                              <td className="py-3 text-slate-600 font-medium pl-2 text-xs sm:text-[13px]">
                                {item.households}
                              </td>
                              <td className="py-3 text-right font-bold text-emerald-600 text-xs sm:text-[13px]">
                                PHP {item.payout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Centered Document Footer */}
                  <div className="text-[11px] text-slate-400 text-center pt-6 border-t border-slate-100">
                    Saint Francis Clinic — Exist. Acc. Files Ledger &middot; Generated {formatPrintDate(new Date())}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* CUSTOM PRINT BLANK PAYROLL FORM MODAL                                      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showCustomPrintModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs">
                    <Printer className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg font-display">
                      Custom Print Blank Payroll
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Configure custom rows and print official blank clinic payroll forms
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCustomPrintModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body / Settings Form */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* 1. Row Count Selector */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-emerald-950 block">
                        Number of Blank Rows to Print
                      </label>
                      <span className="text-[11px] text-emerald-800">
                        Admin can print custom different number of rows (1 to 100 rows per batch)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={blankRowCount}
                        onChange={(e) => setBlankRowCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                        className="w-24 px-3 py-2 text-center rounded-xl bg-white border border-emerald-300 font-black text-emerald-950 text-base shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-emerald-900">rows</span>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] font-bold text-emerald-800">Presets:</span>
                    {[5, 10, 15, 20, 25, 30, 40, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setBlankRowCount(num)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          blankRowCount === num
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-white text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {num} rows
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Form Customization Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Payroll Form Title
                    </label>
                    <input
                      type="text"
                      value={blankPayrollTitle}
                      onChange={(e) => setBlankPayrollTitle(e.target.value)}
                      placeholder="e.g. EXIST. ACC. SUBMITTERS PAYROLL REGISTER"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  {/* Coverage Area / Barangay */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Barangay / Coverage Area
                    </label>
                    <input
                      type="text"
                      value={blankBarangay}
                      onChange={(e) => setBlankBarangay(e.target.value)}
                      placeholder="e.g. All SFC Coverage Areas or Barangay Name"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  {/* Period */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Payroll Period
                    </label>
                    <input
                      type="text"
                      value={blankPeriod}
                      onChange={(e) => setBlankPeriod(e.target.value)}
                      placeholder="e.g. October 2026 or 1st Half October 2026"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  {/* Paper Orientation */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Print Orientation
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBlankOrientation('landscape')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          blankOrientation === 'landscape'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Landscape (Best)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlankOrientation('portrait')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          blankOrientation === 'portrait'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Portrait
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Form Preview Summary */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Print Specification Preview</span>
                    <span className="text-[11px] font-normal text-slate-500">Same format as Saint Francis Clinic official payroll</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 pt-1">
                    <div>Rows: <strong className="text-emerald-700">{blankRowCount} lines</strong></div>
                    <div>Coverage: <strong>{blankBarangay || 'All SFC'}</strong></div>
                    <div>Period: <strong>{blankPeriod}</strong></div>
                    <div>Layout: <strong className="capitalize">{blankOrientation}</strong></div>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/70">
                    Includes columns: #, Name of Submitter / Worker, Barangay / Purok, Verified (Qty), Pending (Qty), Total Salary (₱), Signature of Recipient, Remarks, plus Batch Totals and official sign-offs.
                  </div>
                </div>
              </div>

              {/* Modal Footer Toolbar */}
              <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCustomPrintModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleExecutePrintBlankPayroll();
                    setShowCustomPrintModal(false);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Blank Payroll ({blankRowCount} Rows)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
