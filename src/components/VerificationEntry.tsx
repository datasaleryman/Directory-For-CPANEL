import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserPlus,
  BadgeCheck,
  Search,
  MapPin,
  Phone,
  X,
  User,
  Loader2,
  Check,
  ChevronRight,
  Database,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  FolderPlus,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { ExistingAccountItem } from '../types.js';

interface VerificationEntryProps {
  authToken: string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: { username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null;
}

interface DraftMember {
  id: string;
  full_name: string;
  barangay: string;
  purok: string;
  contact_number: string;
  created_at: string;
  status: string;
}

export const VerificationEntry: React.FC<VerificationEntryProps> = ({
  authToken,
  showToast,
  currentUser = null
}) => {
  // Draft entries stored in state and persisted in localStorage
  const [drafts, setDrafts] = useState<DraftMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftToDelete, setDraftToDelete] = useState<DraftMember | null>(null);
  const [isClearingAllDrafts, setIsClearingAllDrafts] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when search query changes or drafts list size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, drafts.length]);
  
  // Loading state for submitting individual drafts
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submittingAll, setSubmittingAll] = useState(false);

  // Load drafts from localStorage on mount
  useEffect(() => {
    const savedDrafts = localStorage.getItem('sfc_verification_drafts');
    if (savedDrafts) {
      try {
        setDrafts(JSON.parse(savedDrafts));
      } catch (e) {
        console.error('Error parsing saved drafts', e);
      }
    }
  }, []);

  // Sync drafts to localStorage whenever they change
  const saveDraftsToStorage = (updatedDrafts: DraftMember[]) => {
    setDrafts(updatedDrafts);
    localStorage.setItem('sfc_verification_drafts', JSON.stringify(updatedDrafts));
  };

  // Live parsed preview of what's in the bulk input text
  const parsedPreview = useMemo(() => {
    if (!bulkInputText.trim()) return [];
    
    const lines = bulkInputText.split('\n');
    return lines
      .map((line, index) => {
        const parts = line.split('|').map(p => p.trim());
        // Clean and fallback empty strings
        const full_name = parts[0] || '';
        const barangay = parts[1] || '';
        const purok = parts[2] || '';
        const contact_number = parts[3] || '';
        
        return {
          id: `preview-${index}`,
          full_name,
          barangay,
          purok,
          contact_number,
          isValid: full_name.length > 0 && barangay.length > 0
        };
      })
      .filter(item => item.full_name || item.barangay || item.purok || item.contact_number);
  }, [bulkInputText]);

  // Handle parsing and adding to draft list
  const handleAddBulkMembers = () => {
    if (parsedPreview.length === 0) {
      showToast('Please enter some member data first.', 'error');
      return;
    }

    const validEntries = parsedPreview.filter(item => {
      if (!item.full_name) return false;
      if (!item.barangay) return false;
      return true;
    });

    if (validEntries.length === 0) {
      showToast('No valid entries found. Each line must have at least "Full Name" and "Barangay" separated by pipes (|).', 'error');
      return;
    }

    const newDrafts: DraftMember[] = validEntries.map(item => ({
      id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      full_name: item.full_name,
      barangay: item.barangay,
      purok: item.purok,
      contact_number: item.contact_number,
      created_at: new Date().toISOString(),
      status: 'Residency Check'
    }));

    const updatedDrafts = [...drafts, ...newDrafts];
    saveDraftsToStorage(updatedDrafts);
    setIsModalOpen(false);
    setBulkInputText('');
    showToast(`Successfully added ${newDrafts.length} members to the Draft List below!`, 'success');
  };

  // Delete a draft from the list (triggers confirmation modal)
  const handleDeleteDraft = (id: string) => {
    const draft = drafts.find(item => item.id === id);
    if (draft) {
      setDraftToDelete(draft);
    }
  };

  const handleConfirmDeleteDraft = () => {
    if (!draftToDelete) return;
    const updatedDrafts = drafts.filter(item => item.id !== draftToDelete.id);
    saveDraftsToStorage(updatedDrafts);
    showToast('Member draft removed.', 'info');
    setDraftToDelete(null);
  };

  // Clear all drafts (triggers confirmation modal)
  const handleClearAllDrafts = () => {
    if (drafts.length > 0) {
      setIsClearingAllDrafts(true);
    }
  };

  const handleConfirmClearAllDrafts = () => {
    saveDraftsToStorage([]);
    showToast('Draft list cleared.', 'info');
    setIsClearingAllDrafts(false);
  };

  // Add individual draft to Member Verification database via POST API
  const handleAddSingleToDatabase = async (draft: DraftMember) => {
    setSubmittingId(draft.id);
    try {
      const payload = {
        full_name: draft.full_name,
        barangay: draft.barangay,
        purok: draft.purok,
        contact_number: draft.contact_number,
        existingAcc: true,
        existingAccVerified: false,
        existingAccVisited: false,
        status: draft.status || 'Residency Check',
        pin: ''
      };

      const res = await fetch('/api/existing-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit member to database.');
      }

      const savedAccount = await res.json();
      showToast(`"${savedAccount.full_name}" successfully added to the Member Verification list!`, 'success');

      // Remove from drafts
      const updatedDrafts = drafts.filter(item => item.id !== draft.id);
      saveDraftsToStorage(updatedDrafts);
    } catch (err: any) {
      showToast(err.message || 'Error uploading member record', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  // Upload all drafts in sequence
  const handleUploadAllDrafts = async () => {
    if (drafts.length === 0) return;
    if (!window.confirm(`Are you sure you want to add all ${drafts.length} drafts to the database?`)) return;

    setSubmittingAll(true);
    let successCount = 0;
    let failedCount = 0;
    const remainingDrafts = [...drafts];

    for (const draft of drafts) {
      try {
        const payload = {
          full_name: draft.full_name,
          barangay: draft.barangay,
          purok: draft.purok,
          contact_number: draft.contact_number,
          existingAcc: true,
          existingAccVerified: false,
          existingAccVisited: false,
          status: draft.status || 'Residency Check',
          pin: ''
        };

        const res = await fetch('/api/existing-accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          successCount++;
          // Remove from local tracker
          const index = remainingDrafts.findIndex(d => d.id === draft.id);
          if (index !== -1) {
            remainingDrafts.splice(index, 1);
          }
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }

    saveDraftsToStorage(remainingDrafts);
    setSubmittingAll(false);

    if (successCount > 0) {
      showToast(`Bulk processing complete! Successfully added ${successCount} members to verification directory.`, 'success');
    }
    if (failedCount > 0) {
      showToast(`Failed to upload ${failedCount} draft entries. Please review and try again.`, 'error');
    }
  };

  // Filter drafts based on local search
  const filteredDrafts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return drafts;
    return drafts.filter(d => 
      d.full_name.toLowerCase().includes(query) ||
      d.barangay.toLowerCase().includes(query) ||
      d.purok.toLowerCase().includes(query) ||
      d.contact_number.includes(query)
    );
  }, [drafts, searchQuery]);

  const paginatedDrafts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDrafts.slice(start, start + itemsPerPage);
  }, [filteredDrafts, currentPage]);

  const totalPages = Math.ceil(filteredDrafts.length / itemsPerPage);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Dynamic Background Blur */}
      <div className="absolute right-0 top-0 w-80 h-80 bg-teal-50/40 rounded-full blur-3xl -z-10 opacity-70" />

      {/* Header Widget */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl text-teal-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 font-display">Verification Entry Workspace</h2>
            <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase mt-1">
              Add drafts manually &bull; Upload individual entries to Member Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {drafts.length > 0 && (
            <button
              onClick={handleClearAllDrafts}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Clear Drafts
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-98 flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Add Member
          </button>
        </div>
      </div>

      {/* Main Panel layout for Draft List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
              Pending Draft Members
              <span className="bg-teal-100/60 text-teal-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-teal-200/40">
                {drafts.length} Entries
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">Drafts stored locally until you click &quot;Add List&quot; to commit them to Member Verification.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Search filter for drafts */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search draft entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bulk commit all drafts */}
            {drafts.length > 0 && (
              <button
                onClick={handleUploadAllDrafts}
                disabled={submittingAll}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition-all flex items-center gap-2 justify-center cursor-pointer disabled:opacity-50"
              >
                {submittingAll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-3.5 h-3.5" />
                    Upload All ({drafts.length})
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Draft List Table view */}
        <div className="overflow-x-auto">
          {filteredDrafts.length === 0 ? (
            <div className="py-16 px-4 text-center max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
              <div className="p-4 bg-slate-50 rounded-full text-slate-400 border border-slate-100">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">No Draft Members Found</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {searchQuery 
                    ? 'No drafts match your search query. Try adjusting the filter.'
                    : 'Your draft list is currently empty. Click the &quot;Add Member&quot; button above to input data in bulk format.'
                  }
                </p>
              </div>
              {!searchQuery && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-xs font-bold rounded-xl mt-2 transition-all cursor-pointer"
                >
                  Get Started
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100">
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Member Details</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Barangay</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Purok</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Number</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Classification</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedDrafts.map((item) => {
                    const isUploading = submittingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100/50 flex items-center justify-center text-teal-600 font-extrabold text-xs">
                              {item.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-slate-900 block truncate max-w-[180px]">
                              {item.full_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-700 font-semibold">{item.barangay}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-500 font-medium">{item.purok || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-500 font-medium font-mono">{item.contact_number || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDeleteDraft(item.id)}
                              disabled={isUploading}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            
                            {/* Core Add List button requested by user */}
                            <button
                              onClick={() => handleAddSingleToDatabase(item)}
                              disabled={isUploading}
                              className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-600 hover:text-white border border-teal-200 hover:border-teal-600 text-teal-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isUploading ? (
                                <Loader2 className="w-3 h-3 animate-spin text-teal-600 group-hover:text-white" />
                              ) : (
                                <FolderPlus className="w-3 h-3" />
                              )}
                              Add List
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination Controls bar */}
              {totalPages > 1 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                  <div>
                    Showing page <span className="text-slate-800 font-extrabold">{currentPage}</span> of <span className="text-slate-800 font-extrabold">{totalPages}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg transition-all font-extrabold cursor-pointer disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
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
      </div>

      {/* Bulk Entry Form Dialog Popup Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 rounded-lg text-teal-600 border border-teal-100">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display">Bulk Member Registration</h3>
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Bulk Entry Input</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setBulkInputText('');
                  }}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Core Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {/* Formatting Instructions */}
                <div className="bg-amber-50/70 border border-amber-200/50 rounded-xl p-4 flex gap-3 text-xs text-amber-900">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                  <div className="space-y-1.5 leading-relaxed">
                    <p className="font-bold text-amber-950">Bulk Format Guide:</p>
                    <p>
                      Enter members one per line. Use pipe characters to separate details:
                    </p>
                    <div className="bg-white/80 px-3 py-2 rounded-lg font-mono text-[11px] border border-amber-200/40 text-amber-950">
                      Full Name | Barangay | Purok | Contact #
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-amber-900 text-[10px] uppercase tracking-wider mt-1">Example entries:</p>
                      <p className="font-mono text-[10px] text-slate-600">
                        Maria Clara | San Jose | Purok 1 | 09171234567<br />
                        Juan Dela Cruz | Poblacion | Purok 3 | 09181112222
                      </p>
                    </div>
                  </div>
                </div>

                {/* Input Textarea */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Member Data Entries
                  </label>
                  <textarea
                    rows={6}
                    value={bulkInputText}
                    onChange={(e) => setBulkInputText(e.target.value)}
                    placeholder="Type or paste members here (one per line)...&#10;e.g. Jose Rizal | Calamba | Purok 4 | 09192223333"
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-mono resize-none leading-relaxed"
                  />
                </div>

                {/* Parsed Live Preview Section */}
                {parsedPreview.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Parsed Preview ({parsedPreview.length} lines detected)
                      </span>
                    </div>

                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[180px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wide">
                            <th className="px-3 py-2">Full Name</th>
                            <th className="px-3 py-2">Barangay</th>
                            <th className="px-3 py-2">Purok</th>
                            <th className="px-3 py-2">Contact</th>
                            <th className="px-3 py-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                          {parsedPreview.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="px-3 py-1.5 truncate max-w-[120px]">
                                {item.full_name || <span className="text-rose-400 italic font-medium">Missing</span>}
                              </td>
                              <td className="px-3 py-1.5 truncate max-w-[100px]">
                                {item.barangay || <span className="text-rose-400 italic font-medium">Missing</span>}
                              </td>
                              <td className="px-3 py-1.5 truncate max-w-[80px] text-slate-500 font-medium">
                                {item.purok || <span className="text-slate-300">-</span>}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-slate-500 font-medium">
                                {item.contact_number || <span className="text-slate-300">-</span>}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                {item.isValid ? (
                                  <span className="inline-flex p-0.5 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-600">
                                    <Check className="w-2.5 h-2.5" />
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded-md font-bold">
                                    Invalid
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setBulkInputText('');
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddBulkMembers}
                  disabled={parsedPreview.filter(p => p.isValid).length === 0}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-98 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Load to Draft List
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Draft Confirmation Modal */}
      <AnimatePresence>
        {draftToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDraftToDelete(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 z-10 space-y-6"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-none">
                    Remove Member Draft?
                  </h3>
                  <p className="text-[11px] text-rose-600 font-bold mt-1 uppercase tracking-wider">
                    Delete Draft Confirmation
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  Are you sure you want to remove the draft for <span className="font-extrabold text-slate-950 uppercase">{draftToDelete.full_name}</span>?
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will permanently clear this draft from the local workspace.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setDraftToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteDraft}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Draft
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear All Drafts Confirmation Modal */}
      <AnimatePresence>
        {isClearingAllDrafts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClearingAllDrafts(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 z-10 space-y-6"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-none">
                    Clear Draft List?
                  </h3>
                  <p className="text-[11px] text-rose-600 font-bold mt-1 uppercase tracking-wider">
                    Delete All Confirmation
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  Are you sure you want to clear <span className="font-extrabold text-slate-950 uppercase">{drafts.length} drafts</span> from the list?
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This action cannot be undone and will empty your current workspace list.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsClearingAllDrafts(false)}
                  className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmClearAllDrafts}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
