import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Radio, LogOut, ShieldCheck, User } from 'lucide-react';
import EmployeePortal from '../components/EmployeePortal';
import Toast, { playChime } from '../components/Toast';
import api from '../services/api';
import wsClient, { ConnectionStatus } from '../services/websocket';
import { LeaveEventPayload, ToastNotification, User as UserModel } from '../types';

export const EmployeePortalPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString());
  const [dateStr, setDateStr] = useState<string>(
    new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  );

  // Real-time Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
      setDateStr(now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Add toast helper
  const addToast = useCallback(
    (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string; duration?: number }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastNotification = {
        id,
        type: toast.type,
        title: toast.title,
        message: toast.message,
        duration: toast.duration || 6000,
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

  // Verify Employee Authentication
  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getToken();
      if (!token) {
        navigate('/emp_login', { replace: true });
        return;
      }

      try {
        const user = await api.getMe();
        setCurrentUser(user);
      } catch {
        api.logoutEmployee();
        navigate('/emp_login', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // WebSocket Live Updates (for leave approvals, rejections, enquiries)
  useEffect(() => {
    wsClient.connect();

    const unsubStatus = wsClient.onStatusChange((status: ConnectionStatus) => {
      setWsStatus(status);
    });

    const unsubLeave = wsClient.onLeaveEvent((event: LeaveEventPayload) => {
      if (!currentUser) return;
      if (event.leave.user_id !== currentUser.id) return;

      if (event.action === 'APPROVED') {
        playChime('success');
        addToast({
          type: 'success',
          title: 'Leave / Permission Approved! 🎉',
          message: `Your ${event.leave.request_type.toLowerCase()} request for ${event.leave.start_date} was approved by Management.`,
          duration: 9000,
        });
      } else if (event.action === 'REJECTED') {
        addToast({
          type: 'error',
          title: 'Request Declined',
          message: `Your ${event.leave.request_type.toLowerCase()} request was declined: "${event.leave.admin_notes || 'No note provided'}".`,
          duration: 9000,
        });
      } else if (event.action === 'ENQUIRY_REQUESTED') {
        playChime('late');
        addToast({
          type: 'warning',
          title: 'Management Enquiry Received ⚠️',
          message: `HR sent an enquiry on request #${event.leave.id}: "${event.leave.admin_notes}". Please provide clarification below.`,
          duration: 10000,
        });
      }
    });

    return () => {
      unsubStatus();
      unsubLeave();
      wsClient.disconnect();
    };
  }, [addToast, currentUser]);

  const handleLogout = () => {
    api.logoutEmployee();
    sessionStorage.setItem('sat_logged_out', 'true');
    navigate('/emp_login', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-xs">
        Loading Employee Portal...
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-brand-500 selection:text-white">
      {/* Top Dedicated Employee Navbar */}
      <header className="sticky top-0 z-40 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/50">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold tracking-tight text-white uppercase">
                    Apex<span className="text-emerald-400">Attend</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider bg-emerald-950 text-emerald-400 rounded border border-emerald-800">
                    Employee Self-Service
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Personal Attendance Status & Leave Management
                </p>
              </div>
            </div>

            {/* Right Status Controls */}
            <div className="flex items-center space-x-4">
              {/* Real-time Clock */}
              <div className="hidden lg:flex items-center space-x-2 text-xs font-mono text-slate-300 bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{time}</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">{dateStr}</span>
              </div>

              {/* WebSocket Sync Status */}
              <div
                onClick={() => {
                  if (wsStatus === 'DISCONNECTED') {
                    wsClient.connect();
                  }
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  wsStatus === 'CONNECTED'
                    ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400 cursor-default'
                    : wsStatus === 'CONNECTING'
                    ? 'bg-amber-950/60 border-amber-800/60 text-amber-400 cursor-wait'
                    : 'bg-rose-950/60 border-rose-800/60 text-rose-400 hover:bg-rose-900/50 cursor-pointer'
                }`}
                title={wsStatus === 'CONNECTED' ? 'Live System Connected' : 'Sync Disconnected'}
              >
                <Radio
                  className={`w-3.5 h-3.5 ${
                    wsStatus === 'CONNECTED'
                      ? 'animate-pulse text-emerald-400'
                      : wsStatus === 'CONNECTING'
                      ? 'animate-spin text-amber-400'
                      : 'text-rose-400'
                  }`}
                />
                <span className="hidden md:inline">
                  {wsStatus === 'CONNECTED' ? 'Live' : wsStatus === 'CONNECTING' ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>

              {/* Employee Profile & Logout */}
              <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-semibold text-slate-200">{currentUser.full_name}</p>
                  <p className="text-[10px] text-emerald-400 font-mono tracking-wider">{currentUser.employee_id}</p>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-300 hover:text-rose-400 transition-colors"
                  title="Sign Out of Employee Portal"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Main Employee Portal View (strictly self-service, NO Live Kiosk) */}
      <main className="flex-1 w-full pb-12">
        <EmployeePortal currentUser={currentUser} onNotify={addToast} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>ApexAttend Enterprise • Employee Self-Service Portal • Authorized Access Only</p>
      </footer>
    </div>
  );
};

export default EmployeePortalPage;
