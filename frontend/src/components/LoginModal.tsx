import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, LogIn, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { User } from '../types';
import { validateLoginIdentifier, validateLoginPassword } from '../utils/validation';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field validation and touch states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const handleLogin = async () => {
    setEmailTouched(true);
    setPasswordTouched(true);

    const emailCheck = validateLoginIdentifier(email);
    const passCheck = validateLoginPassword(password);

    setEmailError(emailCheck.isValid ? null : emailCheck.message);
    setPasswordError(passCheck.isValid ? null : passCheck.message);

    if (!emailCheck.isValid || !passCheck.isValid) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.login({ email: email.trim(), password });
      const user = await api.getMe();
      onSuccess(user);
      onClose();
    } catch (err: unknown) {
      const errMsg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        'Authentication failed. Please verify credentials.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/40">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Management Console Sign In</h3>
                <p className="text-xs text-slate-400">Authenticate with Administrator or HR corporate credentials</p>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300 flex items-center space-x-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                handleLogin();
              }}
              className="space-y-4"
              noValidate
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Corporate Email or Employee ID
                </label>
                <div className="relative">
                  <Mail className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                    emailTouched && emailError ? 'text-rose-400' : 'text-slate-500'
                  }`} />
                  <input
                    type="text"
                    value={email}
                    onBlur={() => {
                      setEmailTouched(true);
                      const res = validateLoginIdentifier(email);
                      setEmailError(res.isValid ? null : res.message);
                    }}
                    onChange={(ev) => {
                      const val = ev.target.value;
                      setEmail(val);
                      if (error) setError(null);
                      if (emailTouched) {
                        const res = validateLoginIdentifier(val);
                        setEmailError(res.isValid ? null : res.message);
                      }
                    }}
                    placeholder="e.g. admin@company.com or EMP001"
                    className={`w-full pl-9 pr-3 py-2.5 text-sm bg-slate-950 border rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all ${
                      emailTouched && emailError
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-950/10'
                        : 'border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>
                {emailTouched && emailError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] text-rose-400 mt-1 flex items-center space-x-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{emailError}</span>
                  </motion.p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                    passwordTouched && passwordError ? 'text-rose-400' : 'text-slate-500'
                  }`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onBlur={() => {
                      setPasswordTouched(true);
                      const res = validateLoginPassword(password);
                      setPasswordError(res.isValid ? null : res.message);
                    }}
                    onChange={(ev) => {
                      const val = ev.target.value;
                      setPassword(val);
                      if (error) setError(null);
                      if (passwordTouched) {
                        const res = validateLoginPassword(val);
                        setPasswordError(res.isValid ? null : res.message);
                      }
                    }}
                    placeholder="••••••••••••"
                    className={`w-full pl-9 pr-10 py-2.5 text-sm bg-slate-950 border rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all ${
                      passwordTouched && passwordError
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-950/10'
                        : 'border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordTouched && passwordError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] text-rose-400 mt-1 flex items-center space-x-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordError}</span>
                  </motion.p>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 mt-6"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Authenticating...' : 'Sign In to Console'}</span>
              </motion.button>
            </form>

            <div className="pt-3 text-center border-t border-slate-800/80">
              <p className="text-xs text-slate-400">
                Are you an employee?{' '}
                <a
                  href="/emp_login"
                  className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline"
                >
                  Go to Employee Portal Login (/emp_login) →
                </a>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;
