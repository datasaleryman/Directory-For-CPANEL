import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  User, 
  Lock, 
  Upload, 
  Loader2, 
  Save,
  MapPin,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  'Muricay',
  'Santiago',
  'Santo Niño',
  'Sta. Lucia',
  'Tawagan Sur',
  'Tiguma',
  'White Beach',
  'Dao',
  'SAN PEDRO',
  'Buenavista',
  'SFC'
];

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
  adminUser: { username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null;
  onAdminUserUpdated: (user: any, token?: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  authToken,
  adminUser,
  onAdminUserUpdated,
  showToast
}) => {
  const [profileUsername, setProfileUsername] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileBarangay, setProfileBarangay] = useState('');
  const [barangayList, setBarangayList] = useState<string[]>(DEFAULT_BARANGAYS);
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/public/barangays')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.barangays) && data.barangays.length > 0) {
          const unique = Array.from(new Set([...data.barangays, ...DEFAULT_BARANGAYS])).filter(Boolean);
          setBarangayList(unique);
        }
      })
      .catch((err) => console.warn('Failed to load barangays:', err));
  }, []);

  useEffect(() => {
    if (adminUser) {
      setProfileUsername(adminUser.username);
      setProfileDisplayName(adminUser.displayName || '');
      setAvatarDataUrl(adminUser.avatarDataUrl || '');
      setProfileBarangay(adminUser.barangay || '');
    }
  }, [adminUser, isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', 'error');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showToast('Image size should be less than 50MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarDataUrl(base64String);
      showToast('Profile photo updated in preview!', 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !adminUser) return;

    if (!profileUsername.trim()) {
      showToast('Username cannot be empty.', 'warning');
      return;
    }

    setProfileSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          username: profileUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
          displayName: profileDisplayName.trim(),
          avatarDataUrl,
          password: profilePassword ? profilePassword.trim() : undefined,
          barangay: profileBarangay.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile settings.');
      }

      showToast('Profile settings saved successfully!', 'success');
      setProfilePassword('');
      onAdminUserUpdated(data.user, data.token);
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 text-slate-800"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer active:scale-90"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-base font-display">My Profile Settings</h4>
                <p className="text-[11px] text-slate-500">Update your credentials, avatar, and security password</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Profile Avatar Upload */}
              <div className="flex flex-col items-center text-center p-3 border border-slate-100 bg-slate-50/50 rounded-xl">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full border border-slate-200 overflow-hidden bg-white flex items-center justify-center shadow-md">
                    {avatarDataUrl ? (
                      <img src={avatarDataUrl} alt="Avatar Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xl font-bold text-slate-400 font-mono">
                        {profileUsername ? profileUsername.charAt(0).toUpperCase() : 'A'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-md active:scale-95 transition-all cursor-pointer"
                    title="Upload profile picture"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                </div>
                
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                
                <span className="text-[10px] font-bold text-slate-400 mt-2 block">
                  Profile Photo (Max 50MB)
                </span>
                {avatarDataUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarDataUrl('')}
                    className="text-[10px] text-rose-500 hover:underline mt-1 font-semibold cursor-pointer"
                  >
                    Remove photo
                  </button>
                )}
              </div>

              {/* Display Name Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Display Name / Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={profileDisplayName}
                    onChange={(e) => setProfileDisplayName(e.target.value)}
                    placeholder="e.g. Dr. Francis"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl transition-all text-xs outline-none text-slate-700 font-medium"
                  />
                </div>
              </div>

              {/* Barangay Address Selection Dropdown */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Barangay Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none z-10">
                    <MapPin className="w-3.5 h-3.5" />
                  </span>
                  <select
                    value={profileBarangay}
                    onChange={(e) => setProfileBarangay(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl transition-all text-xs outline-none text-slate-700 font-medium appearance-none cursor-pointer"
                  >
                    <option value="">-- Select Barangay Address --</option>
                    {Array.from(
                      new Set([...barangayList, ...(profileBarangay ? [profileBarangay] : [])].filter(Boolean))
                    ).map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Username Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Username (For Login)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-semibold text-xs font-mono">
                    @
                  </span>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder="administrator"
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl transition-all text-xs outline-none text-slate-700 font-medium"
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1">Lowercase letters, numbers, and underscores only</p>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Change Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="•••••••• (leave blank to keep current)"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl transition-all text-xs outline-none text-slate-700 font-medium"
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1">Minimum 4 characters</p>
              </div>

              {/* Save Profile Button */}
              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl active:scale-[0.99] transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-100 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
