import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  RefreshCw,
  UserCheck,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  ArrowRight,
  Database,
  Search,
  HelpCircle,
  FileCheck2,
  Trash2,
  ChevronRight,
  UserCheck2,
  Users2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Contact, ExistingAccountItem } from '../types.js';

interface MatchingGroup {
  contact: Contact;
  account: ExistingAccountItem;
  matchType: 'perfect' | 'fuzzy';
  reason?: string;
}

interface MatchingAnalysis {
  perfectMatches: MatchingGroup[];
  fuzzyMatches: MatchingGroup[];
  unmatchedContacts: Contact[];
  unmatchedAccounts: ExistingAccountItem[];
  summary: {
    perfectCount: number;
    fuzzyCount: number;
    unmatchedContactsCount: number;
    unmatchedAccountsCount: number;
    totalContacts: number;
    totalAccounts: number;
  };
}

interface DataMatchingProps {
  authToken: string | null;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onSyncComplete?: () => void;
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
  'Muricay'
];

export function DataMatching({ authToken, showToast, onSyncComplete }: DataMatchingProps) {
  const [analysis, setAnalysis] = useState<MatchingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'perfect' | 'unmatched_contacts' | 'unmatched_accounts' | 'bulk_entry'>('perfect');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMatches, setExpandedMatches] = useState<Record<number, boolean>>({});
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ accountId: string; name: string } | null>(null);

  // Bulk Entry states
  const [bulkText, setBulkText] = useState('');
  const [defaultBarangay, setDefaultBarangay] = useState('Navalan');
  const [defaultPurok, setDefaultPurok] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      showToast('Please enter some patient data in the text field.', 'warning');
      return;
    }

    setBulkLoading(true);
    try {
      const lines = bulkText.split('\n').filter(line => line.trim());
      const accountsToInsert: any[] = [];

      for (let line of lines) {
        let parts: string[] = [];
        if (line.includes('|')) {
          parts = line.split('|');
        } else if (line.includes('\t')) {
          parts = line.split('\t');
        } else if (line.includes(';')) {
          parts = line.split(';');
        } else {
          parts = line.split(',');
        }

        const fullName = parts[0]?.trim() || '';
        if (!fullName) continue;

        const barangayVal = (parts[1]?.trim() || defaultBarangay || 'Navalan');
        const purokVal = parts[2]?.trim() || defaultPurok || '';
        const contactVal = parts[3]?.trim() || '';

        accountsToInsert.push({
          full_name: fullName,
          barangay: barangayVal,
          purok: purokVal,
          contact_number: contactVal,
          status: 'approved',
          existingAccVerified: true,
          existingAccVisited: false
        });
      }

      if (accountsToInsert.length === 0) {
        throw new Error('Could not parse any valid names from your input.');
      }

      const response = await fetch('/api/existing-accounts/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ accounts: accountsToInsert })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to submit bulk records');
      }

      showToast(`Successfully registered ${accountsToInsert.length} new records! They are now ready to be matched.`, 'success');
      setBulkText('');
      await fetchAnalysis();
      setActiveTab('perfect'); // Switch back to matching lists
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      showToast(err.message || 'Bulk insertion failed', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/matching/analysis', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!response.ok) throw new Error('Failed to retrieve matching analysis');
      const data = await response.json();
      setAnalysis(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch matching data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchAnalysis();
    }
  }, [authToken]);

  const handleMerge = async (contactId: string | number, accountId: string) => {
    setActionLoadingId(`merge_${contactId}_${accountId}`);
    try {
      const response = await fetch('/api/matching/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ contactId, accountId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Merge failed');
      }
      showToast('Successfully merged profiles and consolidated clinical records!', 'success');
      await fetchAnalysis();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      showToast(err.message || 'Merge operation failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreatePatient = async (accountId: string) => {
    setActionLoadingId(`create_${accountId}`);
    try {
      const response = await fetch('/api/matching/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ accountId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }
      showToast('Successfully created a formal Patient record from online submission!', 'success');
      await fetchAnalysis();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      showToast(err.message || 'Patient creation failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteMatchAccountConfirm = async (accountId: string) => {
    setActionLoadingId(`delete_${accountId}`);
    setDeleteConfirmModal(null);
    try {
      const response = await fetch(`/api/existing-accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete record');
      }
      showToast('Successfully deleted the registration record!', 'success');
      await fetchAnalysis();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      showToast(err.message || 'Deletion failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAutoMergeAll = async () => {
    if (!analysis || analysis.perfectMatches.length === 0) {
      showToast('No perfect matches available for automatic merging.', 'info');
      return;
    }

    if (!window.confirm(`Are you sure you want to automatically merge all ${analysis.perfectMatches.length} perfect matches? This will consolidate coordinates, contact numbers, and file attachments instantly.`)) {
      return;
    }

    setActionLoadingId('auto_merge');
    try {
      const response = await fetch('/api/matching/auto', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!response.ok) throw new Error('Auto merge operations failed');
      const data = await response.json();
      showToast(`Successfully auto-merged ${data.result?.mergedCount || 0} matching records!`, 'success');
      await fetchAnalysis();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      showToast(err.message || 'Auto merge failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtering based on search queries
  const filteredPerfectMatches = analysis?.perfectMatches.filter(item => 
    item.contact.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.contact.barangay.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredFuzzyMatches = analysis?.fuzzyMatches.filter(item => 
    item.contact.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.account.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.contact.barangay.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredUnmatchedContacts = analysis?.unmatchedContacts.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.barangay.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredUnmatchedAccounts = analysis?.unmatchedAccounts.filter(acc => 
    acc.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.barangay.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const displayUnmatchedContactsCount = analysis
    ? Math.max(0, analysis.summary.unmatchedContactsCount - analysis.summary.perfectCount - (analysis.summary.fuzzyCount || 0))
    : 0;

  return (
    <div className="space-y-6" id="data-matching-section">
      {/* Header and Summary Panel */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-900/30 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 animate-pulse" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              Dynamic Reconciliation
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-white">
              Data Matching Engine
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/75 leading-relaxed">
              Consolidate local offline patient files with submissions retrieved online. Deduplicate names, combine digital records, synchronize files, and resolve registration conflicts dynamically.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={fetchAnalysis}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/15 active:scale-95 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 cursor-pointer transition-all focus:outline-none"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Analytics
            </button>
            <button
              onClick={handleAutoMergeAll}
              disabled={loading || actionLoadingId === 'auto_merge' || !analysis || analysis.perfectMatches.length === 0}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-emerald-900/40 disabled:to-teal-900/40 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer border border-emerald-400/20 focus:outline-none"
            >
              <GitMerge className="w-4 h-4" />
              {actionLoadingId === 'auto_merge' ? 'Merging Perfect Matches...' : '⚡ Auto-Merge Perfect Matches'}
            </button>
          </div>
        </div>        {/* Match vs. Unmatch Summary Counters */}
        {analysis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/10">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-300 font-extrabold uppercase tracking-wider">Total Matched Patients</p>
                <p className="text-[10px] text-emerald-100/75 mt-0.5 font-medium">Sum of matched records resolved</p>
              </div>
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-black font-display text-emerald-400">
                  {analysis.summary.perfectCount}
                </span>
                <span className="text-[10px] text-emerald-300/80 block font-bold">records</span>
              </div>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-rose-300 font-extrabold uppercase tracking-wider">Total Unmatched Patients</p>
                <p className="text-[10px] text-rose-100/75 mt-0.5 font-medium">Outstanding local patients without digital records</p>
              </div>
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-black font-display text-rose-400">
                  {displayUnmatchedContactsCount}
                </span>
                <span className="text-[10px] text-rose-300/80 block font-bold">records</span>
              </div>
            </div>
          </div>
        )}


      </div>

      {/* Control Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {[
            { id: 'perfect', label: 'Match Patients', count: (analysis?.summary.perfectCount ?? 0) + (analysis?.summary.fuzzyCount ?? 0) },
            { id: 'unmatched_contacts', label: 'Unmatched Patients', count: displayUnmatchedContactsCount },
            { id: 'unmatched_accounts', label: 'Data No Match Found', count: analysis?.summary.unmatchedAccountsCount ?? 0 },
            { id: 'bulk_entry', label: 'Bulk Entry', count: 0 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer focus:outline-none flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-emerald-900/10 text-emerald-800 border border-emerald-800/35'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              {tab.label}
              {tab.id !== 'bulk_entry' && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records by name or barangay..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Main Reconciliation Window */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-4">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-slate-700 font-extrabold text-sm uppercase tracking-widest font-display">
            Analyzing and Matching Databases...
          </p>
        </div>
      ) : (
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {/* TAB 1: MATCH PATIENTS (PERFECT & FUZZY MATCHES) */}
            {activeTab === 'perfect' && (
              <motion.div
                key="perfect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {filteredPerfectMatches.length === 0 && filteredFuzzyMatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-3xl text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    <p className="text-slate-800 font-extrabold text-sm uppercase tracking-wider">No Matching Patients Found</p>
                    <p className="text-slate-400 text-xs max-w-sm">
                      All local directory patient records and online accounts are already resolved or reconciled.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Perfect Matches Group */}
                    {filteredPerfectMatches.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Perfect Matches ({filteredPerfectMatches.length})
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {filteredPerfectMatches.map((item, index) => {
                            return (
                              <div
                                key={`perfect_${index}`}
                                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex items-center gap-4"
                              >
                                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div>
                                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Submitted Name</span>
                                    <span className="font-extrabold font-display text-slate-800 text-sm tracking-wide uppercase">
                                      {item.account.full_name}
                                    </span>
                                  </div>
                                  <div className="hidden sm:block text-slate-300">
                                    <ArrowRight className="w-4 h-4" />
                                  </div>
                                  <div className="sm:text-right">
                                    <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">PATIENT NAME FROM DATABASE</span>
                                    <span className="font-extrabold font-display text-slate-800 text-sm tracking-wide uppercase">
                                      {item.contact.full_name}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setDeleteConfirmModal({ accountId: item.account.id, name: item.account.full_name })}
                                  disabled={actionLoadingId !== null}
                                  className="p-2.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl cursor-pointer active:scale-95 transition-all focus:outline-none border border-transparent hover:border-rose-100 shrink-0"
                                  title="Delete Registration"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fuzzy / Potential Matches Group */}
                    {filteredFuzzyMatches.length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 px-1">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Potential / Fuzzy Matches ({filteredFuzzyMatches.length})
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {filteredFuzzyMatches.map((item, index) => {
                            return (
                              <div
                                key={`fuzzy_${index}`}
                                className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex items-center gap-4"
                              >
                                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div>
                                    <span className="block text-[9px] font-extrabold text-amber-500 uppercase tracking-wider">Submitted Name</span>
                                    <span className="font-extrabold font-display text-slate-800 text-sm tracking-wide uppercase">
                                      {item.account.full_name}
                                    </span>
                                  </div>
                                  <div className="hidden sm:block text-amber-300">
                                    <ArrowRight className="w-4 h-4" />
                                  </div>
                                  <div className="sm:text-right">
                                    <span className="block text-[9px] font-extrabold text-amber-500 uppercase tracking-wider">PATIENT NAME FROM DATABASE</span>
                                    <span className="font-extrabold font-display text-slate-800 text-sm tracking-wide uppercase">
                                      {item.contact.full_name}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setDeleteConfirmModal({ accountId: item.account.id, name: item.account.full_name })}
                                  disabled={actionLoadingId !== null}
                                  className="p-2.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl cursor-pointer active:scale-95 transition-all focus:outline-none border border-transparent hover:border-rose-100 shrink-0"
                                  title="Delete Registration"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 3: UNMATCHED PATIENTS */}
            {activeTab === 'unmatched_contacts' && (
              <motion.div
                key="unmatched_contacts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {filteredUnmatchedContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-3xl text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    <p className="text-slate-800 font-extrabold text-sm uppercase tracking-wider">All Patients Linked</p>
                    <p className="text-slate-400 text-xs max-w-sm">
                      Outstanding local patient profiles are fully consolidated or linked with digital submissions.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            <th className="py-4 px-6">Patient ID</th>
                            <th className="py-4 px-6">Full Name</th>
                            <th className="py-4 px-6">Barangay Location</th>
                            <th className="py-4 px-6">Purok</th>
                            <th className="py-4 px-6">Contact Number</th>
                            <th className="py-4 px-6 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {filteredUnmatchedContacts.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-6 font-mono font-bold text-[10px] text-slate-400">
                                {c.id}
                              </td>
                              <td className="py-4 px-6 font-extrabold text-slate-800 uppercase">
                                {c.full_name}
                              </td>
                              <td className="py-4 px-6 font-semibold">
                                {c.barangay}
                              </td>
                              <td className="py-4 px-6 text-slate-500">
                                {c.purok || '—'}
                              </td>
                              <td className="py-4 px-6 text-slate-500 font-semibold">
                                {c.contact_number || '—'}
                              </td>
                              <td className="py-4 px-6 text-right">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px] uppercase tracking-wider">
                                  Unlinked Local Record
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB: DATA NO MATCH FOUND */}
            {activeTab === 'unmatched_accounts' && (
              <motion.div
                key="unmatched_accounts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Information Callout */}
                <div className="p-4 bg-emerald-50 border border-emerald-200/50 rounded-2xl flex items-start gap-3">
                  <Database className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                      Unmatched Registrations Engine
                    </h4>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Only displaying records from <strong>Data Inserted to Match</strong> (submitted online registrations) that have absolutely no match found in the Google Sheets database. You can instantly create a formal patient profile for them here.
                    </p>
                  </div>
                </div>

                {filteredUnmatchedAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-3xl text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    <p className="text-slate-800 font-extrabold text-sm uppercase tracking-wider">All Submissions Linked</p>
                    <p className="text-slate-400 text-xs max-w-sm">
                      All online submitted registrations have successfully matched or have been imported into the clinic database.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            <th className="py-4 px-6">Account ID</th>
                            <th className="py-4 px-6">Data Inserted to Match (Full Name)</th>
                            <th className="py-4 px-6">Barangay Location</th>
                            <th className="py-4 px-6">Purok</th>
                            <th className="py-4 px-6">Contact Number</th>
                            <th className="py-4 px-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {filteredUnmatchedAccounts.map((acc) => (
                            <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-6 font-mono font-bold text-[10px] text-slate-400">
                                {acc.id.substring(0, 8)}...
                              </td>
                              <td className="py-4 px-6 font-extrabold text-slate-800 uppercase">
                                {acc.full_name}
                              </td>
                              <td className="py-4 px-6 font-semibold">
                                {acc.barangay}
                              </td>
                              <td className="py-4 px-6 text-slate-500">
                                {acc.purok || '—'}
                              </td>
                              <td className="py-4 px-6 text-slate-500 font-semibold">
                                {acc.contact_number || '—'}
                              </td>
                              <td className="py-4 px-6 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleCreatePatient(acc.id)}
                                  disabled={actionLoadingId !== null}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all focus:outline-none"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  {actionLoadingId === `create_${acc.id}` ? 'Creating...' : 'Create Patient Profile'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 5: BULK ENTRY FORM */}
            {activeTab === 'bulk_entry' && (
              <motion.div
                key="bulk_entry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs max-w-4xl mx-auto space-y-6"
              >
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold font-display text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-600" />
                    Bulk Entry & Reconciliation Panel
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Import multiple records quickly. These entries are immediately stored in the primary Google Sheets linked database and will instantly undergo matching checks.
                  </p>
                </div>

                <form onSubmit={handleBulkSubmit} className="space-y-5">
                  {/* Fallback inputs removed as per request */}

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                        Enter Patient Records to Match
                      </label>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                        1 record per line
                      </span>
                    </div>
                    <textarea
                      rows={8}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="JUAN DELA CRUZ | NAVALAN | Purok 3 | 09171234567&#10;MARIA CLARA | KALINGAYAN | Purok 1&#10;JOSE RIZAL | SAN JOSE"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                    />
                    <div className="text-[10px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 p-3 rounded-xl font-medium">
                      <strong>Supported Format:</strong> <code className="text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded">Full Name | Barangay | Purok | Contact #</code>. If location or contact is omitted, the default values chosen above will automatically be filled.
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setBulkText('')}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all"
                    >
                      Clear
                    </button>
                    <button
                      type="submit"
                      disabled={bulkLoading || !bulkText.trim()}
                      className="flex items-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all"
                    >
                      <GitMerge className="w-4 h-4" />
                      {bulkLoading ? 'Processing...' : 'Submit & Match'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Custom Center Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center"
            >
              <div className="mx-auto w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
                <Trash2 className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h3 className="font-extrabold font-display text-slate-900 text-lg sm:text-xl uppercase tracking-wide">
                  Confirm Deletion
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you absolutely sure you want to delete the submitted registration for <strong className="text-slate-800 font-extrabold uppercase">{deleteConfirmModal.name}</strong>?
                </p>
                <div className="p-3 bg-rose-50/50 border border-rose-100/50 rounded-xl text-[11px] text-rose-700 leading-relaxed text-left">
                  This action is permanent and will completely remove this online submission from the reconciliation registry.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmModal(null)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteMatchAccountConfirm(deleteConfirmModal.accountId)}
                  disabled={actionLoadingId !== null}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all focus:outline-none shadow-md shadow-rose-600/10"
                >
                  {actionLoadingId === `delete_${deleteConfirmModal.accountId}` ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
