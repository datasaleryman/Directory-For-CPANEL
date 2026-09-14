import React, { useState, useEffect } from 'react';
import { UserPlus, UserCheck, RefreshCcw, Trash2, HelpCircle } from 'lucide-react';
import { Contact } from '../types.js';

interface ContactFormProps {
  editTarget: Contact | null;
  onSave: (contact: { 
    full_name: string; 
    barangay: string; 
    purok: string; 
    contact_number: string;
    latitude?: number | null;
    longitude?: number | null;
    geotagged?: boolean;
    maintenance?: 'None' | 'Yes' | string;
    maintenance_medicine?: string;
  }) => Promise<boolean>;
  onCancel: () => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

export const ContactForm: React.FC<ContactFormProps> = ({ editTarget, onSave, onCancel, showToast }) => {
  const [fullName, setFullName] = useState('');
  const [barangay, setBarangay] = useState('');
  const [purok, setPurok] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [maintenance, setMaintenance] = useState<'None' | 'Yes'>('None');
  const [maintenanceMedicine, setMaintenanceMedicine] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditingExisting = Boolean(editTarget && editTarget.id);

  useEffect(() => {
    if (editTarget) {
      setFullName(editTarget.full_name || '');
      setBarangay(editTarget.barangay || '');
      setPurok(editTarget.purok || '');
      setContactNumber(editTarget.contact_number || '');
      const maint = (editTarget.maintenance === 'Yes' || (editTarget.maintenance_medicine && editTarget.maintenance !== 'None')) ? 'Yes' : 'None';
      setMaintenance(maint);
      setMaintenanceMedicine(editTarget.maintenance_medicine || '');
    } else {
      clearForm();
    }
  }, [editTarget]);

  const clearForm = () => {
    setFullName('');
    setBarangay('');
    setPurok('');
    setContactNumber('');
    setMaintenance('None');
    setMaintenanceMedicine('');
  };

  const handleCapitalization = (str: string): string => {
    return str
      .trim()
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trim inputs
    const trimmedName = fullName.trim();
    const trimmedBarangay = barangay.trim();
    const trimmedPurok = purok.trim();
    const trimmedNumber = contactNumber.trim();
    const trimmedMedicine = maintenanceMedicine.trim();

    // Validation checks
    if (!trimmedName) {
      showToast('Full Name is required.', 'warning');
      return;
    }
    if (!trimmedBarangay) {
      showToast('Barangay is required.', 'warning');
      return;
    }
    if (!trimmedNumber) {
      showToast('Contact Number is required.', 'warning');
      return;
    }
    if (maintenance === 'Yes' && !trimmedMedicine) {
      showToast('Please specify what medicine they maintained.', 'warning');
      return;
    }

    // Capitalization format
    const formattedName = handleCapitalization(trimmedName);
    const formattedBarangay = handleCapitalization(trimmedBarangay);
    const formattedPurok = trimmedPurok ? handleCapitalization(trimmedPurok) : '';

    setSaving(true);
    try {
      const success = await onSave({
        full_name: formattedName,
        barangay: formattedBarangay,
        purok: formattedPurok,
        contact_number: trimmedNumber,
        maintenance,
        maintenance_medicine: maintenance === 'Yes' ? trimmedMedicine : ''
      });
      if (success && !editTarget) {
        clearForm();
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred while saving.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
        <div className={`p-2 rounded-xl text-white ${isEditingExisting ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
          {isEditingExisting ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-lg font-display">
            {isEditingExisting ? 'Edit Directory Record' : 'Register Individual Contact'}
          </h4>
          <p className="text-xs text-slate-500">
            {isEditingExisting ? `Modifying contact record ID #${editTarget?.id}` : 'Fill in the details to create a new record'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Full Name */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Full Name
            </label>
            <span className="text-red-500 text-xs font-bold">* Required</span>
          </div>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400"
            placeholder="e.g. Juan Dela Cruz"
            disabled={saving}
          />
          <p className="text-[10px] text-slate-400">Will be capitalized properly automatically</p>
        </div>

        {/* Barangay & Purok */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Barangay */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Barangay
              </label>
              <span className="text-red-500 text-xs font-bold">* Required</span>
            </div>
            <input
              type="text"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400"
              placeholder="e.g. Barangay San Jose"
              disabled={saving}
            />
          </div>

          {/* Purok */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Purok
              </label>
              <span className="text-slate-400 text-xs">(Optional)</span>
            </div>
            <input
              type="text"
              value={purok}
              onChange={(e) => setPurok(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400"
              placeholder="e.g. Purok 4"
              disabled={saving}
            />
          </div>
        </div>

        {/* Contact Number */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Contact Number
            </label>
            <span className="text-red-500 text-xs font-bold">* Required</span>
          </div>
          <input
            type="text"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400"
            placeholder="e.g. 09171234567"
            disabled={saving}
          />
        </div>

        {/* Maintenance */}
        <div className="space-y-2 p-4 bg-slate-50/80 border border-slate-200 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Maintenance
              </label>
              <p className="text-[11px] text-slate-400">Does this patient take ongoing maintenance medication?</p>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={maintenance === 'None'}
                  onChange={() => {
                    setMaintenance('None');
                    setMaintenanceMedicine('');
                  }}
                  disabled={saving}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                />
                <span>None</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={maintenance === 'Yes'}
                  onChange={() => setMaintenance('Yes')}
                  disabled={saving}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                />
                <span>Yes</span>
              </label>
            </div>
          </div>

          {maintenance === 'Yes' && (
            <div className="pt-2 border-t border-slate-200/80 transition-all">
              <label className="block text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1.5">
                Maintained Medicine <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                value={maintenanceMedicine}
                onChange={(e) => setMaintenanceMedicine(e.target.value)}
                placeholder="e.g. Losartan 50mg, Metformin 500mg, Amlodipine 10mg..."
                disabled={saving}
                className="w-full px-4 py-2.5 bg-white border border-teal-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 rounded-xl transition-all text-slate-800 text-xs font-medium outline-none placeholder:text-slate-400 shadow-xs"
              />
            </div>
          )}
        </div>

        {/* Actions Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center gap-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className={`w-full sm:w-auto px-6 py-3 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] shadow-lg ${
              editTarget
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-50'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-50'
            }`}
          >
            {editTarget ? 'Update Contact Record' : 'Save New Contact'}
          </button>

          <button
            type="button"
            onClick={clearForm}
            disabled={saving}
            className="w-full sm:w-auto px-5 py-3 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCcw className="w-4 h-4" />
            Clear Form
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="w-full sm:w-auto sm:ml-auto px-5 py-3 text-slate-500 hover:text-slate-700 bg-transparent border border-slate-200 hover:border-slate-300 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
