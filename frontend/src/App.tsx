import React, { useState, useEffect, useCallback } from 'react';
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

      // Auto-authenticate as default Administrator so dashboard and directory are instantly ready
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
    setCurrentUser(null);
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been signed out from the enterprise console.',
    });
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    addToast({
      type: 'success',
      title: 'Welcome Back',
      message: `Signed in as ${user.full_name} (${user.role})`,
    });
  };

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
        {activeTab === 'kiosk' && (
          <Kiosk onNotify={addToast} recentEvents={recentEvents} />
        )}
        {activeTab === 'dashboard' && (
          <Dashboard key={currentUser?.id || 'guest'} />
        )}
        {activeTab === 'employees' && (
          <Employees key={currentUser?.id || 'guest'} onNotify={addToast} />
        )}
        {activeTab === 'reports' && (
          <Reports key={currentUser?.id || 'guest'} onNotify={addToast} />
        )}
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
