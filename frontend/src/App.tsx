import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, LogIn } from 'lucide-react';
import Navbar from './components/Navbar';
import Kiosk from './components/Kiosk';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Reports from './components/Reports';
import Toast, { playChime } from './components/Toast';
import LoginModal from './components/LoginModal';
import wsClient, { ConnectionStatus } from './services/websocket';
import api from './services/api';
import { AttendanceResult, TabType, ToastNotification, User } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('kiosk');
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [recentEvents, setRecentEvents] = useState<AttendanceResult[]>([]);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Add toast helper
  const addToast = useCallback(
    (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string; duration?: number }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastNotification = {
        id,
        type: toast.type,
        title: toast.title,
        message: toast.message,
        duration: toast.duration || 5000,
        timestamp: new Date(),
      };

      setToasts((prev) => [newToast, ...prev].slice(0, 5));

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch current authenticated user, or auto-login with seeded admin credentials
  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const user = await api.getMe();
          setCurrentUser(user);
          return;
        } catch {
          api.logout();
        }
      }

      // Check if user explicitly logged out in this session
      const hasLoggedOut = sessionStorage.getItem('sat_logged_out');
      if (hasLoggedOut === 'true') {
        return; // Do not auto-login if user explicitly logged out
      }

      // Auto-authenticate as default Administrator on clean launch
      try {
        await api.login({ email: 'admin@company.com', password: 'Password123!' });
        const user = await api.getMe();
        setCurrentUser(user);
      } catch (err) {
        console.warn('Auto-login notice (server might be starting up):', err);
      }
    };

    initAuth();
  }, []);

  // WebSocket Connection and Event Handling
  useEffect(() => {
    wsClient.connect();

    const unsubStatus = wsClient.onStatusChange((status: ConnectionStatus) => {
      setWsStatus(status);
    });

    const unsubAttendance = wsClient.onAttendanceEvent((event: AttendanceResult) => {
      setRecentEvents((prev) => [event, ...prev].slice(0, 25));

      if (event.event_result !== 'COOLDOWN_IGNORED') {
        if (event.is_late) {
          playChime('late');
        } else {
          playChime('success');
        }

        addToast({
          type: event.is_late ? 'warning' : 'success',
          title: `Attendance Event: ${event.full_name}`,
          message: `${event.message} (${event.status})`,
        });
      }
    });

    return () => {
      unsubStatus();
      unsubAttendance();
      wsClient.disconnect();
    };
  }, [addToast]);

  const handleLogout = () => {
    api.logout();
    sessionStorage.setItem('sat_logged_out', 'true');
    setCurrentUser(null);
    setActiveTab('kiosk');
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been signed out from the enterprise console.',
    });
  };

  const handleLoginSuccess = (user: User) => {
    sessionStorage.removeItem('sat_logged_out');
    setCurrentUser(user);
    addToast({
      type: 'success',
      title: 'Welcome Back',
      message: `Signed in as ${user.full_name} (${user.role})`,
    });
  };

  const renderAuthGate = (featureName: string) => (
    <div className="max-w-md mx-auto my-16 p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-5 animate-fade-in">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
        <Shield className="w-7 h-7" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-white tracking-tight">Corporate Authentication Required</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Access to the <span className="text-emerald-400 font-medium">{featureName}</span> console requires authenticated Administrator or HR permissions.
        </p>
      </div>
      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => setShowLoginModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 transition-all"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In to Console</span>
        </button>
        <button
          onClick={() => setActiveTab('kiosk')}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-all"
        >
          Return to Live Kiosk
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-brand-500 selection:text-white">
      {/* Top Enterprise Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        wsStatus={wsStatus}
        currentUser={currentUser}
        onLogout={handleLogout}
        onLoginClick={() => setShowLoginModal(true)}
      />

      {/* Floating Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Sign-In Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Main Tab Views */}
      <main className="flex-1 w-full pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {activeTab === 'kiosk' && (
              <Kiosk onNotify={addToast} recentEvents={recentEvents} />
            )}
            {activeTab === 'dashboard' && (
              currentUser ? <Dashboard key={currentUser.id} /> : renderAuthGate('Dashboard Analytics')
            )}
            {activeTab === 'employees' && (
              currentUser ? <Employees key={currentUser.id} onNotify={addToast} /> : renderAuthGate('Employee Directory')
            )}
            {activeTab === 'reports' && (
              currentUser ? <Reports key={currentUser.id} onNotify={addToast} /> : renderAuthGate('Attendance Reports')
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Enterprise Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>
          Enterprise Smart Attendance System • AES-256 Biometric Vector Encryption • Sub-50ms Neural Facial Matching
        </p>
      </footer>
    </div>
  );
};

export default App;
