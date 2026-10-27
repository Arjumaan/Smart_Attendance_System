import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, LogIn, ExternalLink } from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Kiosk from '../components/Kiosk';
import Dashboard from '../components/Dashboard';
import Employees from '../components/Employees';
import Reports from '../components/Reports';
import LeaveManagement from '../components/LeaveManagement';
import Toast, { playChime } from '../components/Toast';
import LoginModal from '../components/LoginModal';
import wsClient, { ConnectionStatus } from '../services/websocket';
import api from '../services/api';
import { AttendanceResult, LeaveEventPayload, TabType, ToastNotification, User } from '../types';

export const EnterpriseConsole: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('kiosk');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [recentEvents, setRecentEvents] = useState<AttendanceResult[]>([]);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [pendingLeavesCount, setPendingLeavesCount] = useState<number>(0);

  // Add toast notification helper
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

  // Fetch pending leaves count for Admin & HR badge counter
  const fetchPendingLeavesCount = useCallback(async () => {
    try {
      const data = await api.getPendingLeaveCount();
      const count = data?.total_actionable ?? data?.pending_count ?? 0;
      setPendingLeavesCount(count);
    } catch {
      // Ignore if unauthorized or employee
    }
  }, []);

  // Fetch current authenticated user, or auto-login with seeded admin credentials
  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const user = await api.getMe();
          if (user.role === 'EMPLOYEE') {
            // Decoupled architecture: employees are routed strictly to /employee portal
            navigate('/employee', { replace: true });
            return;
          }
          setCurrentUser(user);
          if (user.role === 'ADMIN' || user.role === 'HR') {
            fetchPendingLeavesCount();
          }
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

      // Auto-authenticate as default Administrator on clean launch if no admin token present
      const adminToken = localStorage.getItem('sat_token');
      if (!adminToken) {
        try {
          await api.login({ email: 'admin@company.com', password: 'Password123!' }, false);
          const user = await api.getMe();
          setCurrentUser(user);
          fetchPendingLeavesCount();
        } catch (err) {
          console.warn('Auto-login notice (server might be starting up):', err);
        }
      }
    };

    initAuth();
  }, [fetchPendingLeavesCount, navigate]);

  // Safe local date formatting (YYYY-MM-DD)
  const getLocalDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const currentDayRef = useRef<string>(getLocalDateStr());

  // Load today's presence activity feed from backend (persisting across page reloads/server restarts)
  const loadTodayPresenceFeed = useCallback(async () => {
    try {
      const todayStr = getLocalDateStr();
      const events = await api.getTodayPresenceFeed(todayStr);
      setRecentEvents(events);
    } catch (err) {
      console.warn('Could not load today presence feed:', err);
    }
  }, []);

  // Fetch initial presence feed on load
  useEffect(() => {
    loadTodayPresenceFeed();
  }, [loadTodayPresenceFeed]);

  // Monitor midnight day roll-over: automatically clear & reset feed when the date changes
  useEffect(() => {
    const timer = setInterval(() => {
      const todayStr = getLocalDateStr();
      if (todayStr !== currentDayRef.current) {
        currentDayRef.current = todayStr;
        loadTodayPresenceFeed(); // Automatically empties feed for the new day
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(timer);
  }, [loadTodayPresenceFeed]);

  // WebSocket Connection and Event Handling
  useEffect(() => {
    wsClient.connect();

    const unsubStatus = wsClient.onStatusChange((status: ConnectionStatus) => {
      setWsStatus(status);
    });

    // Attendance Log Event
    const unsubAttendance = wsClient.onAttendanceEvent((event: AttendanceResult) => {
      setRecentEvents((prev) => {
        // Prevent duplicate events
        const exists = prev.some(
          (p) =>
            p.employee_id === event.employee_id &&
            p.event_result === event.event_result &&
            (p.check_out_time || p.check_in_time) === (event.check_out_time || event.check_in_time)
        );
        if (exists) return prev;
        return [event, ...prev].slice(0, 50);
      });

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

    // Leave & Permission Event (Real-time Broadcast for Admin & HR)
    const unsubLeave = wsClient.onLeaveEvent((event: LeaveEventPayload) => {
      const currentRole = currentUser?.role;

      if (currentRole === 'ADMIN' || currentRole === 'HR') {
        fetchPendingLeavesCount();
        if (event.action === 'CREATED') {
          playChime('late');
          addToast({
            type: 'warning',
            title: `New ${event.leave.request_type} Application`,
            message: `${event.leave.employee_name || 'An employee'} applied for ${event.leave.leave_type}. Immediate review required.`,
            duration: 8000,
          });
        } else if (event.action === 'ENQUIRY_REPLIED') {
          playChime('success');
          addToast({
            type: 'info',
            title: 'Enquiry Clarification Received',
            message: `${event.leave.employee_name || 'Employee'} replied to enquiry for request #${event.leave.id}.`,
            duration: 8000,
          });
        }
      }
    });

    return () => {
      unsubStatus();
      unsubAttendance();
      unsubLeave();
      wsClient.disconnect();
    };
  }, [addToast, currentUser, fetchPendingLeavesCount]);

  const handleLogout = () => {
    api.logout();
    sessionStorage.setItem('sat_logged_out', 'true');
    setCurrentUser(null);
    setPendingLeavesCount(0);
    setActiveTab('kiosk');
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been signed out from the enterprise console.',
    });
  };

  const handleLoginSuccess = (user: User) => {
    sessionStorage.removeItem('sat_logged_out');
    if (user.role === 'EMPLOYEE') {
      // Decoupled architecture: employees belong strictly on /employee
      navigate('/employee', { replace: true });
      return;
    }

    setCurrentUser(user);
    fetchPendingLeavesCount();
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
          Access to the <span className="text-emerald-400 font-medium">{featureName}</span> console requires Administrator or HR management permissions.
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

  const isAdminOrHr = currentUser?.role === 'ADMIN' || currentUser?.role === 'HR';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex antialiased selection:bg-brand-500 selection:text-white">
      {/* Modern Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingLeavesCount={pendingLeavesCount}
        currentUser={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area with Top Bar */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Enterprise Management Navigation / Header */}
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          wsStatus={wsStatus}
          currentUser={currentUser}
          pendingLeavesCount={pendingLeavesCount}
          onLogout={handleLogout}
          onLoginClick={() => setShowLoginModal(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsMobileOpen((prev) => !prev)}
        />

        {/* Floating Notifications */}
        <Toast toasts={toasts} onDismiss={dismissToast} />

        {/* Management Sign-In Modal (NO quick sign-ins) */}
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={handleLoginSuccess}
        />

        {/* Main Tab Views */}
        <main className="flex-1 w-full pb-12 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {/* Live Kiosk Terminal */}
              {activeTab === 'kiosk' && (
                <Kiosk
                  onNotify={addToast}
                  recentEvents={recentEvents}
                  onAttendanceRecorded={(att) =>
                    setRecentEvents((prev) => [att, ...prev])
                  }
                />
              )}

              {/* Admin / HR Leave Review Console */}
              {activeTab === 'leaves' && (
                isAdminOrHr ? (
                  <LeaveManagement
                    key={currentUser?.id}
                    onNotify={addToast}
                    onRefreshPendingCount={fetchPendingLeavesCount}
                  />
                ) : (
                  renderAuthGate('Leave Management Console')
                )
              )}

              {/* Enterprise Dashboard */}
              {activeTab === 'dashboard' && (
                isAdminOrHr ? (
                  <Dashboard key={currentUser?.id} onNavigateTab={(tab) => setActiveTab(tab)} />
                ) : (
                  renderAuthGate('Dashboard Analytics')
                )
              )}

              {/* Employee Directory */}
              {activeTab === 'employees' && (
                isAdminOrHr ? (
                  <Employees key={currentUser?.id} onNotify={addToast} />
                ) : (
                  renderAuthGate('Employee Directory')
                )
              )}

              {/* Reports & Exports */}
              {activeTab === 'reports' && (
                isAdminOrHr ? (
                  <Reports key={currentUser?.id} onNotify={addToast} />
                ) : (
                  renderAuthGate('Attendance Reports')
                )
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
    </div>
  );
};

export default EnterpriseConsole;
