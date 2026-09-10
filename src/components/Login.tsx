import React, { useState, useEffect } from 'react';
import { Lock, User, KeyRound, Loader2, Activity, Mail, MapPin, UserPlus, ArrowRight, ShieldCheck, Clock, X, AlertCircle, Eye, EyeOff, CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (token: string, user: { username: string; role: string; email?: string; fullName?: string; barangay?: string }) => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  siteSettings: {
    title: string;
    faviconTitle: string;
    logoDataUrl: string;
    faviconDataUrl: string;
  };
}

const NON_BARANGAY_VALUES = new Set([
  'ALL',
  'ALL BARANGAYS',
  'ALL ADDRESSES',
  'ALL BARANGAY',
  'ALL ADDRESS',
  'SELECT',
  'SELECT BARANGAY',
  'SELECT ADDRESS',
  'UNKNOWN',
  'N/A',
  'NONE',
  'NULL',
  'UNDEFINED',
  'OTHER',
  'OTHERS',
  'PAGADIAN',
  'PAGADIAN CITY',
  'ZAMBOANGA DEL SUR'
]);

function isRealBarangay(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  if (NON_BARANGAY_VALUES.has(upper)) return false;
  if (upper.startsWith('ALL ') || upper.startsWith('SELECT ') || upper.startsWith('FILTER ')) return false;
  return true;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, showToast, siteSettings }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  // Sign in state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Registration state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBarangay, setRegBarangay] = useState('BARANGAY CENTRAL');

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPin, setForgotPin] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [generatedPinDisplay, setGeneratedPinDisplay] = useState<string | null>(null);
  const [showForgotPassToggle, setShowForgotPassToggle] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Barangays database list
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

  const [barangayList, setBarangayList] = useState<string[]>(DEFAULT_BARANGAYS);
  const [fetchingBarangays, setFetchingBarangays] = useState(false);

  const [loading, setLoading] = useState(false);

  // Fetch Barangays list from server/Google Sheets
  const fetchBarangays = async () => {
    setFetchingBarangays(true);
    try {
      const res = await fetch('/api/public/barangays');
      const data = await res.json();
      if (res.ok && Array.isArray(data.barangays) && data.barangays.length > 0) {
        const filtered = data.barangays.filter((b: string) => isRealBarangay(b));
        if (filtered.length > 0) {
          setBarangayList(filtered);
          if (!regBarangay || !isRealBarangay(regBarangay)) {
            setRegBarangay(filtered[0]);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load barangay list:', err);
    } finally {
      setFetchingBarangays(false);
    }
  };

  useEffect(() => {
    fetchBarangays();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      showToast('Please fill in all credentials.', 'warning');
      return;
    }

    setLoading(true);
    setPendingNotice(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText || 'Unable to parse server response'}`);
      }

      if (!response.ok) {
        if (data.error && (data.error.includes('pending administrator approval') || data.error.includes('pending'))) {
          setPendingNotice(data.error);
        }
        throw new Error(data.error || `Authentication failed (HTTP ${response.status})`);
      }

      showToast('Login successful! Welcome back.', 'success');
      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regFullName.trim()) {
      showToast('Full Name is required.', 'warning');
      return;
    }
    if (!regEmail.trim()) {
      showToast('Email address is required.', 'warning');
      return;
    }
    if (!regPassword.trim()) {
      showToast('Password is required.', 'warning');
      return;
    }
    if (regPassword.trim().length < 4) {
      showToast('Password must be at least 4 characters long.', 'warning');
      return;
    }
    if (!regBarangay.trim()) {
      showToast('Please select your Barangay.', 'warning');
      return;
    }

    setLoading(true);
    setPendingNotice(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName.trim(),
          email: regEmail.trim(),
          password: regPassword.trim(),
          barangay: regBarangay.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      const noticeMsg = data.message || `Account registered successfully for ${regFullName}! Your account is pending administrator approval before you can log in.`;
      setPendingNotice(noticeMsg);
      showToast(`Registration submitted for "${regFullName}"! Account is pending administrator approval.`, 'info');
      
      // Switch to login tab & set username
      setUsername(regEmail.trim());
      setPassword('');
      setRegPassword('');
      setMode('login');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequestPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      showToast('Please enter your email address or username.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: forgotEmail.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to request reset PIN.');
      }

      setGeneratedPinDisplay(data.pin || null);
      if (data.pin) {
        setForgotPin(data.pin);
      }
      setForgotStep(2);
      showToast(`Verification code generated for ${data.email || forgotEmail}!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPin.trim()) {
      showToast('Please enter the 6-digit verification code.', 'warning');
      return;
    }
    if (!forgotNewPassword.trim()) {
      showToast('Please enter a new password.', 'warning');
      return;
    }
    if (forgotNewPassword.trim().length < 4) {
      showToast('Password must be at least 4 characters long.', 'warning');
      return;
    }
    if (forgotNewPassword.trim() !== forgotConfirmPassword.trim()) {
      showToast('Passwords do not match. Please re-enter passwords carefully.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: forgotEmail.trim(),
          pin: forgotPin.trim(),
          newPassword: forgotNewPassword.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      showToast('Password reset successfully! You can now sign in with your new password.', 'success');

      // Pre-fill sign in form
      setUsername(forgotEmail.trim());
      setPassword(forgotNewPassword.trim());

      // Reset state
      setForgotStep(1);
      setForgotPin('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setGeneratedPinDisplay(null);
      setMode('login');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Stagger entry variants
  const formContainerVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const formSwitchVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        staggerChildren: 0.05,
        delayChildren: 0.05
      }
    },
    exit: { opacity: 0, y: -10, transition: { duration: 0.15 } }
  };

  const formItemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: { type: 'spring', stiffness: 120, damping: 14 } 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-50 to-slate-100/60 px-4 py-8 select-none">
      <motion.div
        variants={formContainerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-[0_15px_40px_-15px_rgba(16,185,129,0.12)] overflow-hidden"
      >
        {/* Header Branding */}
        <div className="p-6 sm:p-8 pb-5 border-b border-slate-50 bg-slate-50/50 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-50/25 to-teal-50/20 opacity-60 pointer-events-none" />
          
          <motion.div variants={formItemVariants} className="relative z-10">
            <img 
              src={siteSettings.logoDataUrl || 'https://www.image2url.com/r2/default/images/1785037750375-501bcf0e-4b15-4e0e-8be2-610bc89d072e.png'} 
              alt="Logo" 
              className="mx-auto h-16 w-auto object-contain mb-3 rounded-xl p-1 bg-white border border-slate-200/40 shadow-xs"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          
          <motion.h2 variants={formItemVariants} className="text-xl sm:text-2xl font-extrabold font-display text-slate-800 tracking-tight relative z-10">
            {siteSettings.faviconTitle || 'Saint Francis Clinic'}
          </motion.h2>
          
          <motion.p variants={formItemVariants} className="text-xs font-medium text-slate-400 mt-1 relative z-10">
            {mode === 'login' ? 'Clinic Directory Portal Access' : mode === 'register' ? 'Register New Clinic Account' : 'Account Password Recovery'}
          </motion.p>

          {/* Mode Navigation Switcher Tabs */}
          <div className="mt-5 p-1 bg-slate-200/60 rounded-2xl flex items-center relative z-10">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                fetchBarangays();
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Register Account
            </button>
          </div>
        </div>

        {/* Form Body Container */}
        <AnimatePresence mode="wait">
          {mode === 'login' ? (
            <motion.form
              key="login-form"
              variants={formSwitchVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              onSubmit={handleLoginSubmit}
              className="p-6 sm:p-8 space-y-5"
            >
              {pendingNotice && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-3 shadow-xs"
                >
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <p className="font-extrabold text-amber-900">Pending Administrator Approval</p>
                    <p className="text-[11px] text-amber-800/90 mt-0.5">{pendingNotice}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingNotice(null)}
                    className="text-amber-500 hover:text-amber-800 p-0.5 cursor-pointer rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
              <motion.div variants={formItemVariants}>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                  Email Address
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-semibold text-slate-700 text-sm outline-none placeholder:text-slate-400"
                    placeholder="Enter email address"
                    disabled={loading}
                  />
                </div>
              </motion.div>

              <motion.div variants={formItemVariants}>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Security Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(username || '');
                      setForgotStep(1);
                      setGeneratedPinDisplay(null);
                      setMode('forgot');
                    }}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                    <KeyRound className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-semibold text-slate-700 text-sm outline-none placeholder:text-slate-400"
                    placeholder="Enter secure password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4.5 h-4.5" />
                    ) : (
                      <Eye className="w-4.5 h-4.5" />
                    )}
                  </button>
                </div>
              </motion.div>

              <motion.div variants={formItemVariants} className="pt-2">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 disabled:from-emerald-400 disabled:to-emerald-400 text-white font-bold text-sm rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 shrink-0" />
                      Sign In to Directory
                    </>
                  )}
                </motion.button>
              </motion.div>

              <motion.div variants={formItemVariants} className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  Need an account? Register here <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            </motion.form>
          ) : mode === 'register' ? (
            <motion.form
              key="register-form"
              variants={formSwitchVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              onSubmit={handleRegisterSubmit}
              className="p-6 sm:p-8 space-y-4"
            >
              {/* Approval Warning Banner */}
              <motion.div variants={formItemVariants} className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs">
                <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <p className="font-extrabold text-amber-950">Notice on Account Approval</p>
                  <p className="text-[11px] text-amber-800/90 mt-0.5">Newly registered accounts will require administrator approval before you can sign in to the portal.</p>
                </div>
              </motion.div>

              {/* Full Name */}
              <motion.div variants={formItemVariants}>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                  Full Name <span className="text-emerald-600">*</span>
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-semibold text-slate-700 text-sm outline-none placeholder:text-slate-400"
                    placeholder="e.g. Maria Santos"
                    disabled={loading}
                  />
                </div>
              </motion.div>

              {/* Email */}
              <motion.div variants={formItemVariants}>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                  Email Address <span className="text-emerald-600">*</span>
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                    <Mail className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-semibold text-slate-700 text-sm outline-none placeholder:text-slate-400"
                    placeholder="maria.santos@gmail.com"
                    disabled={loading}
                  />
                </div>
              </motion.div>

              {/* Password */}
              <motion.div variants={formItemVariants}>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                  Password <span className="text-emerald-600">*</span>
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                    <KeyRound className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type={showRegPassword ? "text" : "password"}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-semibold text-slate-700 text-sm outline-none placeholder:text-slate-400"
                    placeholder="Create a password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showRegPassword ? (
                      <EyeOff className="w-4.5 h-4.5" />
                    ) : (
                      <Eye className="w-4.5 h-4.5" />
                    )}
                  </button>
                </div>
              </motion.div>

              {/* Barangay Selection (Fetched from Base44 Database) */}
              <motion.div variants={formItemVariants}>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                  Barangay (Select Address) <span className="text-emerald-600">*</span>
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                    <MapPin className="w-4.5 h-4.5" />
                  </span>
                  <select
                    required
                    value={regBarangay}
                    onChange={(e) => setRegBarangay(e.target.value)}
                    className="w-full pl-11 pr-8 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-semibold text-slate-700 text-sm outline-none appearance-none cursor-pointer"
                    disabled={loading || fetchingBarangays}
                  >
                    {fetchingBarangays ? (
                      <option value="">Loading Barangays...</option>
                    ) : barangayList.length === 0 ? (
                      <option value="Navalan">Navalan</option>
                    ) : (
                      barangayList.filter(isRealBarangay).map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    {fetchingBarangays ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 uppercase">Barangay</span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  Address is automatically matched with official barangay records.
                </p>
              </motion.div>

              {/* Submit Button */}
              <motion.div variants={formItemVariants} className="pt-2">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 disabled:from-emerald-400 disabled:to-emerald-400 text-white font-bold text-sm rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 shrink-0" />
                      Register Account
                    </>
                  )}
                </motion.button>
              </motion.div>

              <motion.div variants={formItemVariants} className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Already registered? Back to Sign In
                </button>
              </motion.div>
            </motion.form>
          ) : (
            <motion.div
              key="forgot-form"
              variants={formSwitchVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="p-6 sm:p-8 space-y-4"
            >
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotRequestPin} className="space-y-4">
                  <div className="text-center mb-1">
                    <h3 className="text-base font-extrabold text-slate-800">Forgot Password?</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-snug">
                      Enter your registered email address or username below to issue a 6-digit verification reset code.
                    </p>
                  </div>

                  <motion.div variants={formItemVariants}>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                      Email Address / Username <span className="text-emerald-600">*</span>
                    </label>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <Mail className="w-4.5 h-4.5" />
                      </span>
                      <input
                        type="text"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-semibold text-slate-700 text-sm outline-none placeholder:text-slate-400"
                        placeholder="e.g. maria.santos@gmail.com or admin"
                        disabled={loading}
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={formItemVariants} className="pt-2">
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 disabled:from-emerald-400 disabled:to-emerald-400 text-white font-bold text-sm rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Issuing Reset Code...
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4 shrink-0" />
                          Request Reset Code
                        </>
                      )}
                    </motion.button>
                  </motion.div>

                  <motion.div variants={formItemVariants} className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                    </button>
                  </motion.div>
                </form>
              ) : (
                <form onSubmit={handleForgotResetPassword} className="space-y-4">
                  {/* Code Notice Banner */}
                  <motion.div variants={formItemVariants} className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900 shadow-2xs">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="leading-snug flex-1">
                      <p className="font-extrabold text-emerald-950">Verification Code Issued</p>
                      <p className="text-[11px] text-emerald-800/90 mt-0.5">
                        A 6-digit security code was generated for <span className="font-bold underline">{forgotEmail}</span>.
                      </p>
                      {generatedPinDisplay && (
                        <div className="mt-2 p-2 bg-white rounded-xl border border-emerald-300 text-center flex items-center justify-center gap-2 shadow-2xs">
                          <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Verification PIN:</span>
                          <span className="text-base font-black tracking-widest text-emerald-700 font-mono">{generatedPinDisplay}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* 6-Digit PIN */}
                  <motion.div variants={formItemVariants}>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                      6-Digit Verification Code <span className="text-emerald-600">*</span>
                    </label>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <KeyRound className="w-4.5 h-4.5" />
                      </span>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={forgotPin}
                        onChange={(e) => setForgotPin(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-mono font-bold tracking-widest text-slate-800 text-base outline-none placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal placeholder:text-xs"
                        placeholder="Enter 6-digit code"
                        disabled={loading}
                      />
                    </div>
                  </motion.div>

                  {/* New Password */}
                  <motion.div variants={formItemVariants}>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                      New Password <span className="text-emerald-600">*</span>
                    </label>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <Lock className="w-4.5 h-4.5" />
                      </span>
                      <input
                        type={showForgotPassToggle ? 'text' : 'password'}
                        required
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        className="w-full pl-11 pr-11 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-semibold text-slate-700 text-sm outline-none placeholder:text-slate-400"
                        placeholder="Enter new password"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotPassToggle(!showForgotPassToggle)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showForgotPassToggle ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>

                  {/* Confirm Password */}
                  <motion.div variants={formItemVariants}>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                      Confirm New Password <span className="text-emerald-600">*</span>
                    </label>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <Lock className="w-4.5 h-4.5" />
                      </span>
                      <input
                        type={showForgotPassToggle ? 'text' : 'password'}
                        required
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl transition-all font-semibold text-slate-700 text-sm outline-none placeholder:text-slate-400"
                        placeholder="Re-enter new password"
                        disabled={loading}
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={formItemVariants} className="pt-2">
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 disabled:from-emerald-400 disabled:to-emerald-400 text-white font-bold text-sm rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Resetting Password...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          Reset Password & Sign In
                        </>
                      )}
                    </motion.button>
                  </motion.div>

                  <motion.div variants={formItemVariants} className="pt-1 flex items-center justify-between text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Request New Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      Back to Sign In <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
