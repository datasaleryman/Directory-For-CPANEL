import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileEdit,
  Plus,
  Search,
  X,
  RotateCw,
  Folder,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Edit2,
  ChevronDown,
  UploadCloud,
  Check,
  Eye,
  MapPin,
  Clock,
  AlertCircle,
  Filter,
  CheckCircle2,
  Calendar,
  Send,
  Layers,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { DraftItem, PortalAttachmentFile } from '../types.js';

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

interface MyDraftsProps {
  authToken: string | null;
  currentUser?: { username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigateToPortalAttachment?: () => void;
}

export const MyDrafts: React.FC<MyDraftsProps> = ({
  authToken,
  currentUser,
  showToast,
  onNavigateToPortalAttachment
}) => {
  // View mode: 'list' (drafts list) or 'form' (inline create/edit draft form)
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');

  // Drafts data
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [barangayList, setBarangayList] = useState<string[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('all');

  // Form states
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [barangay, setBarangay] = useState('');
  const [purok, setPurok] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<PortalAttachmentFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Modals & Preview
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DraftItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch drafts
  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/my-drafts?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to load drafts.');
      const data = await res.json();
      setDrafts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch barangay list from Barangay table
  useEffect(() => {
    fetchDrafts();
    fetch(`/api/public/barangays?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.barangays) && data.barangays.length > 0) {
          setBarangayList(data.barangays);
        }
      })
      .catch(() => {});
  }, [authToken]);

  // Combined unique barangays
  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    drafts.forEach(d => {
      if (d.barangay && d.barangay.trim()) set.add(d.barangay.trim());
    });
    barangayList.forEach(b => {
      if (b && b.trim()) set.add(b.trim());
    });
    if (set.size === 0) {
      DEFAULT_BARANGAYS_LIST.forEach(b => set.add(b));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [drafts, barangayList]);

  // Filtered drafts
  const filteredDrafts = useMemo(() => {
    let result = [...drafts];
    if (selectedBarangay !== 'all') {
      result = result.filter(d => (d.barangay || '').toLowerCase() === selectedBarangay.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d =>
        (d.full_name || '').toLowerCase().includes(q) ||
        (d.barangay || '').toLowerCase().includes(q) ||
        (d.purok || '').toLowerCase().includes(q) ||
        (d.notes || '').toLowerCase().includes(q) ||
        (d.attachments || []).some(att => (att.name || '').toLowerCase().includes(q))
      );
    }
    return result;
  }, [drafts, selectedBarangay, searchQuery]);

  // Convert File to Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle multi-file selection (can upload multiple times to append more files!)
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
      showToast(`Added ${newAttachments.length} attachment file(s). You can upload again to append more.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to read file.', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Remove single attachment from form
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== index));
  };

  // Open "Add Drafts" Form View
  const handleOpenAddDraft = () => {
    setEditingDraftId(null);
    setFullName('');
    const userBg = currentUser?.barangay && currentUser.barangay !== 'All Barangays' ? currentUser.barangay : '';
    setBarangay(userBg);
    setPurok('');
    setNotes('');
    setAttachments([]);
    setViewMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Edit Draft Form View
  const handleOpenEditDraft = (draft: DraftItem) => {
    setEditingDraftId(draft.id);
    setFullName(draft.full_name || '');
    setBarangay(draft.barangay || '');
    setPurok(draft.purok || '');
    setNotes(draft.notes || '');
    setAttachments(draft.attachments || []);
    setViewMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save Draft (Button "Saved")
  const handleSaveDraft = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!fullName.trim()) {
      showToast('Full name is required.', 'warning');
      return;
    }
    if (!barangay.trim()) {
      showToast('Please select a Barangay from the list.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        full_name: fullName.trim().toUpperCase(),
        barangay: barangay.trim(),
        purok: purok.trim(),
        notes: notes.trim(),
        attachments
      };

      const endpoint = editingDraftId ? `/api/my-drafts/${editingDraftId}` : '/api/my-drafts';
      const method = editingDraftId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save draft.');

      showToast(`Draft for "${fullName}" saved successfully!`, 'success');
      setViewMode('list');
      fetchDrafts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Draft
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/my-drafts/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to delete draft.');
      showToast(`Draft "${deleteTarget.full_name}" deleted.`, 'info');
      setDeleteTarget(null);
      fetchDrafts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Submit Draft for Verification
  const handleSubmitForVerification = async (draft: DraftItem) => {
    setSubmittingId(draft.id);
    try {
      const res = await fetch(`/api/my-drafts/${draft.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit draft for verification.');

      showToast(
        `"${draft.full_name}" submitted for verification! Removed from My Drafts and transferred to Portal Attachment (VERIFICATION section).`,
        'success'
      );
      // Immediately remove from list
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          VIEW MODE 1: FORM VIEW (Triggered when "Add Drafts" or "Edit" is clicked)
         ========================================================================= */}
      {viewMode === 'form' ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-900 px-6 sm:px-8 py-5 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors cursor-pointer"
                title="Back to drafts list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="font-extrabold text-lg sm:text-xl font-display flex items-center gap-2">
                  <FileEdit className="w-5 h-5 text-emerald-300" />
                  <span>{editingDraftId ? 'Edit Draft Record' : 'Add New Draft'}</span>
                </h2>
                <p className="text-xs text-emerald-200/80 font-medium">
                  Fill in details and upload file attachments. Save as a draft anytime or submit for verification.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveDraft} className="p-6 sm:p-8 space-y-6">
            {/* 1. Full name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. JUAN DELA CRUZ"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none uppercase transition-all shadow-xs"
              />
            </div>

            {/* 2. Barangay & Purok */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Barangay <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] font-medium text-slate-400 lowercase">(from Barangay table)</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={barangay}
                    onChange={e => setBarangay(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none uppercase transition-all appearance-none cursor-pointer shadow-xs"
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
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Purok
                </label>
                <input
                  type="text"
                  value={purok}
                  onChange={e => setPurok(e.target.value)}
                  placeholder="e.g. Purok 1 / Mabuhay"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all shadow-xs"
                />
              </div>
            </div>

            {/* 3. Attachments (Multi-Attachments can upload multiple times) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Attachments (Multi-Attachments can upload multiple times)
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click or drag & drop. You can upload multiple files at once and upload multiple times to append more documents.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-xs rounded-full border border-emerald-200 shrink-0">
                  {attachments.length} file(s) attached
                </span>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-white text-emerald-600 flex items-center justify-center mx-auto shadow-sm group-hover:scale-105 transition-transform border border-emerald-200 mb-3">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="text-xs sm:text-sm font-extrabold text-slate-800 group-hover:text-emerald-800">
                  Click to Browse or Drag & Drop Documents / Photos
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports multiple photos (JPEG, PNG, WEBP) & PDF files. Can upload multiple times.
                </p>
              </div>

              {/* Attachments Preview Grid */}
              {attachments.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                  {attachments.map((file, idx) => {
                    const isImg = file.url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
                    return (
                      <div
                        key={idx}
                        className="relative group bg-slate-50 rounded-2xl border border-slate-200 p-2.5 flex flex-col justify-between hover:border-emerald-300 transition-all shadow-xs"
                      >
                        <div className="relative aspect-video rounded-xl bg-slate-200/60 overflow-hidden flex items-center justify-center mb-2">
                          {isImg ? (
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <FileText className="w-8 h-8 text-slate-400" />
                          )}
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            {isImg && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setPreviewImage({ url: file.url, name: file.name });
                                }}
                                className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow-sm"
                                title="View image"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleRemoveAttachment(idx);
                              }}
                              className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm"
                              title="Remove attachment"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Attached'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Notes / Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Notes / Remarks (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Enter any additional remarks, reference ID, or draft details..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all resize-none shadow-xs"
              />
            </div>

            {/* Bottom Form Action Buttons */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Saving Draft...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        /* =========================================================================
            VIEW MODE 2: DRAFTS LIST VIEW
           ========================================================================= */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-800 to-teal-900 text-white flex items-center justify-center shadow-md shadow-emerald-900/20 shrink-0">
                <FileEdit className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-display">
                    My Drafts
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {drafts.length} {drafts.length === 1 ? 'Draft' : 'Drafts'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Save, stage, and manage your file uploads. Click <strong>Submit</strong> to transfer records to Portal Attachment for verification.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={fetchDrafts}
                disabled={loading}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Refresh drafts"
              >
                <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleOpenAddDraft}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Drafts</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search drafts by patient name, barangay, or attachments..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedBarangay}
                onChange={e => setSelectedBarangay(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Barangays ({drafts.length})</option>
                {uniqueBarangays.map(bg => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Drafts List / Cards */}
          {loading ? (
            <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <RotateCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-600">Loading your saved drafts...</p>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-100">
                <FileEdit className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-800">
                  {searchQuery || selectedBarangay !== 'all' ? 'No matching drafts found' : 'No Drafts Saved Yet'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {searchQuery || selectedBarangay !== 'all'
                    ? 'Try clearing your search filters to see all drafts.'
                    : 'Click "Add Drafts" to stage your files and patient details. When ready, click Submit to transfer them to Portal Attachment.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddDraft}
                className="px-5 py-2.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Drafts</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDrafts.map(draft => {
                const coverImage = (draft.attachments || []).find(
                  f => f.url.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)
                );
                const fileCount = draft.attachments?.length || 0;
                const isSubmittingThis = submittingId === draft.id;

                return (
                  <motion.div
                    key={draft.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    <div>
                      {/* Cover Photo / Top Preview */}
                      <div className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden border-b border-slate-100">
                        {coverImage ? (
                          <img
                            src={coverImage.url}
                            alt={draft.full_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5 p-4 text-center">
                            <Folder className="w-10 h-10 text-emerald-700/60" />
                            <span className="text-[11px] font-bold text-slate-500">Document Files Staged</span>
                          </div>
                        )}

                        <span className="absolute top-3 left-3 px-2.5 py-1 bg-amber-500 text-white text-[10px] font-black uppercase rounded-lg shadow-sm">
                          Draft
                        </span>

                        <span className="absolute top-3 right-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-extrabold rounded-lg shadow-sm flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          <span>{fileCount} {fileCount === 1 ? 'File' : 'Files'}</span>
                        </span>
                      </div>

                      {/* Content Details */}
                      <div className="p-5 space-y-3">
                        <div>
                          <h3 className="font-black text-slate-900 text-base uppercase font-display truncate group-hover:text-emerald-700 transition-colors">
                            {draft.full_name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mt-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{draft.barangay}</span>
                            {draft.purok && <span className="text-slate-400">• {draft.purok}</span>}
                          </div>
                        </div>

                        {draft.notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                            {draft.notes}
                          </p>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Saved: {new Date(draft.saved_at || draft.created_at).toLocaleDateString()}</span>
                          </span>
                          <span className="font-semibold text-slate-600 truncate max-w-[120px]">
                            {draft.saved_by || 'Staff'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions: Edit, Delete, Submit */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDraft(draft)}
                          className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer shadow-xs"
                          title="Edit draft"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(draft)}
                          className="p-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 font-bold text-xs transition-colors cursor-pointer shadow-xs"
                          title="Delete draft"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* SUBMIT BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleSubmitForVerification(draft)}
                        disabled={isSubmittingThis}
                        className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-800 to-teal-800 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-900/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Submit for verification (transfers to Portal Attachment)"
                      >
                        {isSubmittingThis ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Submit</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: IMAGE PREVIEW */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl p-4 flex flex-col items-center"
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[80vh] max-w-full object-contain rounded-2xl"
              />
              <p className="text-white text-xs font-semibold mt-3 text-center">{previewImage.name}</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CONFIRM DELETE */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-slate-900 font-display">Delete Draft?</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete the draft for <strong>{deleteTarget.full_name}</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md transition-colors cursor-pointer"
                >
                  Delete Draft
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
