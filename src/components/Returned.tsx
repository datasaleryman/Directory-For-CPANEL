import React, { useState, useEffect, useMemo } from 'react';
import { 
  RotateCcw, 
  Search, 
  Filter, 
  Building2, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  Download, 
  X, 
  ChevronRight, 
  ExternalLink, 
  UploadCloud, 
  ShieldAlert,
  ShieldCheck,
  FolderOpen,
  Loader2,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReturnedPcuRecord } from '../types.js';

interface ReturnedProps {
  authToken: string;
  currentUser?: {
    username: string;
    role: string;
    displayName?: string;
    barangay?: string;
  } | null;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  onNavigateToSubmitPcu?: () => void;
}

export const Returned: React.FC<ReturnedProps> = ({
  authToken,
  currentUser,
  showToast,
  onNavigateToSubmitPcu
}) => {
  const [records, setRecords] = useState<ReturnedPcuRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState<ReturnedPcuRecord | null>(null);

  // Resubmission Modal State
  const [resubmitTarget, setResubmitTarget] = useState<ReturnedPcuRecord | null>(null);
  const [resubmitFullName, setResubmitFullName] = useState<string>('');
  const [resubmitBarangay, setResubmitBarangay] = useState<string>('');
  const [resubmitPurok, setResubmitPurok] = useState<string>('');
  const [resubmitContactNumber, setResubmitContactNumber] = useState<string>('');
  const [resubmitFiles, setResubmitFiles] = useState<{ fileName: string; fileData: string; size?: number }[]>([]);
  const [isResubmitting, setIsResubmitting] = useState<boolean>(false);

  // File Preview Modal State
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url: string;
    type?: string;
  } | null>(null);

  // Open Resubmission modal pre-populated
  const handleOpenResubmit = (record: ReturnedPcuRecord) => {
    setResubmitTarget(record);
    setResubmitFullName(record.fullName || '');
    setResubmitBarangay(record.barangay || '');
    setResubmitPurok(record.purok || '');
    setResubmitContactNumber(record.contactNumber || '');
    setResubmitFiles([]);
  };

  // Staging new files for resubmission
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    Array.from(fileList).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setResubmitFiles(prev => [
            ...prev,
            {
              fileName: file.name,
              fileData: reader.result as string,
              size: file.size
            }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveStagedFile = (index: number) => {
    setResubmitFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit resubmission to backend
  const handleExecuteResubmit = async () => {
    if (!resubmitTarget) return;
    if (!resubmitFullName.trim()) {
      showToast('Patient full name is required for resubmission.', 'warning');
      return;
    }

    setIsResubmitting(true);
    try {
      const payload = {
        id: resubmitTarget.id,
        contactId: resubmitTarget.contactId,
        fullName: resubmitFullName.trim(),
        barangay: resubmitBarangay.trim(),
        purok: resubmitPurok.trim(),
        contact_number: resubmitContactNumber.trim(),
        files: resubmitFiles
      };

      const res = await fetch('/api/pcu/resubmit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resubmit PCU submission.');
      }

      showToast(`Record "${resubmitFullName}" has been resubmitted successfully to Submit PCU!`, 'success');
      // Immediately remove from returned records list
      setRecords(prev => prev.filter(r => r.id !== resubmitTarget.id));
      if (selectedRecord && selectedRecord.id === resubmitTarget.id) {
        setSelectedRecord(null);
      }
      setResubmitTarget(null);
      setResubmitFiles([]);
    } catch (err: any) {
      showToast(err.message || 'Error resubmitting record', 'error');
    } finally {
      setIsResubmitting(false);
    }
  };

  // Fetch returned files strictly for the logged-in user
  const fetchReturnedRecords = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const res = await fetch('/api/pcu/returned', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch returned files.');
      }

      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
      if (silent) {
        showToast(`Refreshed: ${Array.isArray(data) ? data.length : 0} returned file(s) found.`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading returned files', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReturnedRecords();
  }, [authToken, currentUser?.username]);

  // Extract unique barangays for filter dropdown
  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.barangay) set.add(r.barangay.trim());
    });
    return Array.from(set).sort();
  }, [records]);

  // Filter records based on search and barangay selection
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return records.filter(r => {
      const matchBarangay = selectedBarangay === 'ALL' || (r.barangay || '').toLowerCase() === selectedBarangay.toLowerCase();
      const matchSearch = !q || 
        (r.fullName || '').toLowerCase().includes(q) ||
        (r.barangay || '').toLowerCase().includes(q) ||
        (r.purok || '').toLowerCase().includes(q) ||
        (r.contactNumber || '').toLowerCase().includes(q) ||
        (r.return_reason || '').toLowerCase().includes(q) ||
        (r.returned_by || '').toLowerCase().includes(q);

      return matchBarangay && matchSearch;
    });
  }, [records, searchQuery, selectedBarangay]);

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-display">
                Returned Files
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                {records.length} {records.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Submissions returned by administrators for review and corrections. Strictly user-specific.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => fetchReturnedRecords(true)}
            disabled={loading || refreshing}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh returned records list"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {onNavigateToSubmitPcu && (
            <button
              type="button"
              onClick={onNavigateToSubmitPcu}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Submit PCU</span>
            </button>
          )}
        </div>
      </div>

      {/* User Session Ownership Notice Banner */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-bold">
            Private Account Workspace for: <span className="underline font-mono">{currentUser?.username || 'User'}</span>
          </p>
          <p className="text-amber-800 leading-relaxed">
            This page displays only submissions that <strong>you originally submitted through Submit PCU</strong> and were subsequently returned by an administrator. Other users cannot see your returned files.
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient name, barangay, return reason, or reviewer..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Barangay Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
          >
            <option value="ALL">All Barangays ({records.length})</option>
            {uniqueBarangays.map(bg => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-600">Loading your returned submissions...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <RotateCcw className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-800">
              {searchQuery || selectedBarangay !== 'ALL' ? 'No matching returned files found' : 'No Returned Files'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {searchQuery || selectedBarangay !== 'ALL'
                ? 'Try adjusting your search criteria or clearing your filters.'
                : 'All your submitted PCU files are currently approved, in pending review, or in files. Any files returned by an administrator will appear here.'}
            </p>
          </div>
          {(searchQuery || selectedBarangay !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedBarangay('ALL');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((record) => {
            const files = record.uploadedFiles && record.uploadedFiles.length > 0
              ? record.uploadedFiles
              : (record.fileName ? [{ name: record.fileName, url: record.fileUrl || '' }] : []);

            return (
              <motion.div
                key={record.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
              >
                {/* Top Status Banner */}
                <div className="h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />

                <div className="p-5 space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0 font-black text-sm">
                        {record.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-slate-900 truncate group-hover:text-rose-600 transition-colors">
                          {record.fullName}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{record.barangay}</span>
                          {record.purok && <span>• {record.purok}</span>}
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                      Returned
                    </span>
                  </div>

                  {/* Return Reason Box */}
                  <div className="p-3 bg-rose-50/70 border border-rose-200/70 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-800 font-bold text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Reason for Return:</span>
                    </div>
                    <p className="text-rose-950 font-medium leading-relaxed pl-5 text-[11px]">
                      {record.return_reason ? record.return_reason : 'No specific reason entered by administrator. Please verify information and documents.'}
                    </p>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-3 rounded-2xl border border-slate-100 text-slate-600">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Submitted At</span>
                      <span className="font-semibold text-slate-700 block truncate text-[11px]">
                        {formatTimestamp(record.uploadedAt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Returned At</span>
                      <span className="font-semibold text-rose-700 block truncate text-[11px]">
                        {formatTimestamp(record.returned_at)}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/50 flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-bold">Returned By:</span>
                      <span className="font-black text-slate-800">
                        {record.returned_by || 'Administrator'}
                      </span>
                    </div>
                    {record.contactNumber && (
                      <div className="col-span-2 flex justify-between items-center text-[11px]">
                        <span className="text-slate-400 font-bold">Contact Number:</span>
                        <span className="font-mono font-bold text-slate-800">{record.contactNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Attached Documents Carousel / List */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-rose-500" />
                        <span>Attached Files ({files.length})</span>
                      </span>
                    </div>

                    <div className="space-y-1">
                      {files.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700 truncate text-[11px]">
                              {file.name || `Document #${idx + 1}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {file.url && (
                              <button
                                type="button"
                                onClick={() => setPreviewFile(file)}
                                className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                title="Preview file"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {file.url && (
                              <a
                                href={file.url}
                                download={file.name}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                title="Download file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Details & Resubmit Buttons */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRecord(record)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenResubmit(record)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    title="Resubmit file: Transfer back to Submit PCU"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Resubmit</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Record Details Slide-Over / Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <div 
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
            onClick={() => setSelectedRecord(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black font-display">{selectedRecord.fullName}</h2>
                    <p className="text-xs text-slate-400">Returned PCU Submission Details</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {/* Reason Callout */}
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1.5">
                  <span className="font-black text-rose-800 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    Admin Return Notes
                  </span>
                  <p className="text-rose-950 font-medium pl-5 leading-relaxed text-xs">
                    {selectedRecord.return_reason || 'No specific return reason provided. Please review all details and contact the administrator if needed.'}
                  </p>
                </div>

                {/* Patient Summary */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Patient Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px]">Full Name</span>
                      <span className="font-bold text-slate-800 text-xs">{selectedRecord.fullName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px]">Barangay</span>
                      <span className="font-bold text-slate-800 text-xs">{selectedRecord.barangay}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px]">Purok / Address</span>
                      <span className="font-bold text-slate-800 text-xs">{selectedRecord.purok || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px]">Contact Number</span>
                      <span className="font-bold text-slate-800 font-mono text-xs">{selectedRecord.contactNumber || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Timestamps & Reviewer */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Review Audit</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Originally Submitted:</span>
                      <span className="font-bold text-slate-800">{formatTimestamp(selectedRecord.uploadedAt)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Returned Date:</span>
                      <span className="font-bold text-rose-700">{formatTimestamp(selectedRecord.returned_at)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500">Returned By (Admin):</span>
                      <span className="font-bold text-slate-800">{selectedRecord.returned_by || 'Admin'}</span>
                    </div>
                  </div>
                </div>

                {/* Files Attached */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Attached Files ({selectedRecord.uploadedFiles?.length || 1})
                  </h4>
                  <div className="space-y-1.5">
                    {(selectedRecord.uploadedFiles && selectedRecord.uploadedFiles.length > 0 
                      ? selectedRecord.uploadedFiles 
                      : (selectedRecord.fileName ? [{ name: selectedRecord.fileName, url: selectedRecord.fileUrl || '' }] : [])
                    ).map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800 truncate text-xs">{file.name}</span>
                        </div>
                        {file.url && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-slate-500" />
                              <span>View</span>
                            </button>
                            <a
                              href={file.url}
                              download={file.name}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                            >
                              <Download className="w-3 h-3 text-slate-500" />
                              <span>Save</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rec = selectedRecord;
                    setSelectedRecord(null);
                    handleOpenResubmit(rec);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-xs cursor-pointer shadow-sm hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Resubmit Documentation</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* RESUBMIT PCU DOCUMENTATION MODAL                                          */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {resubmitTarget && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-emerald-200"
            >
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-emerald-700 to-teal-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center shadow-xs">
                    <UploadCloud className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold font-display">Resubmit PCU Documentation</h3>
                    <p className="text-xs text-emerald-100 font-medium">
                      Correct information & upload updated files for verification
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setResubmitTarget(null)}
                  disabled={isResubmitting}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-slate-800">
                {/* Feedback Note from Admin */}
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Admin's Return Feedback (What to Fix):</span>
                  </div>
                  <p className="text-rose-950 font-medium pl-5 leading-relaxed text-[11px]">
                    {resubmitTarget.return_reason || 'Please verify the documents and resubmit corrected files.'}
                  </p>
                </div>

                {/* Form Fields for Patient Correction */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Patient Full Name <span className="text-rose-500">*</span>:
                    </label>
                    <input
                      type="text"
                      value={resubmitFullName}
                      onChange={(e) => setResubmitFullName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Barangay:
                      </label>
                      <input
                        type="text"
                        value={resubmitBarangay}
                        onChange={(e) => setResubmitBarangay(e.target.value)}
                        placeholder="e.g. Central"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Purok / Zone:
                      </label>
                      <input
                        type="text"
                        value={resubmitPurok}
                        onChange={(e) => setResubmitPurok(e.target.value)}
                        placeholder="e.g. Purok 3"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Number:
                    </label>
                    <input
                      type="text"
                      value={resubmitContactNumber}
                      onChange={(e) => setResubmitContactNumber(e.target.value)}
                      placeholder="e.g. 09123456789"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-xs font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Upload New / Corrected Files */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Upload Corrected or Additional Attachments:
                    </label>
                    <span className="text-[10px] text-slate-400 font-bold">Images, PDFs, Docs</span>
                  </div>

                  <div className="relative border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 rounded-2xl p-4 text-center cursor-pointer transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={handleFilesSelected}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <UploadCloud className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-emerald-950">Click or Drag & Drop new files here</p>
                    <p className="text-[10px] text-slate-500">Supports PNG, JPG, JPEG, PDF up to 15MB each</p>
                  </div>

                  {/* List of newly staged files */}
                  {resubmitFiles.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ready to upload ({resubmitFiles.length} new file{resubmitFiles.length > 1 ? 's' : ''}):</span>
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {resubmitFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-emerald-950 truncate text-[11px]">{file.fileName}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveStagedFile(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                              title="Remove file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing Files indicator */}
                  <div className="pt-2 text-[11px] text-slate-500">
                    <span className="font-bold">Existing attachments ({resubmitTarget.uploadedFiles?.length || 1}):</span>
                    <span className="ml-1 text-slate-400">will remain retained alongside any new documents uploaded.</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResubmitTarget(null)}
                  disabled={isResubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteResubmit}
                  disabled={isResubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isResubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                  <span>Resubmit to Submit PCU</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Preview Popup Modal */}
      <AnimatePresence>
        {previewFile && (
          <div 
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold text-xs truncate">{previewFile.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewFile(null)}
                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-100 min-h-[300px]">
                {previewFile.url.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) || previewFile.url.startsWith('data:image/') ? (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-md"
                  />
                ) : (
                  <div className="text-center p-8 space-y-3">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">Document Preview</p>
                    <p className="text-[11px] text-slate-400">{previewFile.name}</p>
                    <a
                      href={previewFile.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Document in New Tab</span>
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
