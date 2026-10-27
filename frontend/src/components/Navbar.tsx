import React, { useState, useEffect } from 'react';
import {
  Clock,
  Radio,
  LogOut,
  LogIn,
  ExternalLink,
  Menu,
  Camera,
  BarChart3,
  Users,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { TabType, User } from '../types';
import wsClient, { ConnectionStatus } from '../services/websocket';

export interface NavbarProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  wsStatus?: ConnectionStatus;
  currentUser?: User | null;
  user?: User | any | null;
  pendingLeavesCount?: number;
  onLogout?: () => void;
  onLoginClick?: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab = 'kiosk',
  wsStatus = 'CONNECTED',
  currentUser,
  user,
  onLogout,
  onLoginClick,
  onToggleSidebar,
}) => {
  const activeUser = currentUser || user;
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString());
  const [dateStr, setDateStr] = useState<string>(
    new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
      setDateStr(now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Title and subtitle mapped to the current active tab
  const getTabHeader = (tab: TabType) => {
    switch (tab) {
      case 'kiosk':
        return {
          title: 'Live Kiosk',
          badge: 'Terminal',
          icon: Camera,
          subtitle: 'Real-time Facial Recognition & Presence Detection',
        };
      case 'dashboard':
        return {
          title: 'Dashboard',
          badge: 'Analytics',
          icon: BarChart3,
          subtitle: 'Enterprise Attendance Trends & Daily Overview',
        };
      case 'employees':
        return {
          title: 'Employees',
          badge: 'Directory',
          icon: Users,
          subtitle: 'Staff Profiles, Biometrics & Department Management',
        };
      case 'reports':
        return {
          title: 'Reports',
          badge: 'Audit Logs',
          icon: FileSpreadsheet,
          subtitle: 'Daily, Weekly & Monthly Attendance Performance',
        };
      case 'leaves':
        return {
          title: 'Leaves & Permissions',
          badge: 'Management',
          icon: FileText,
          subtitle: 'Review, Approve & Track Employee Time-off Requests',
        };
      default:
        return {
          title: 'Enterprise Console',
          badge: 'Management',
          icon: Camera,
          subtitle: 'Smart Biometric Access Platform',
        };
    }
  };

  const currentHeader = getTabHeader(activeTab);
  const CurrentIcon = currentHeader.icon;

  return (
    <header className="sticky top-0 z-20 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Mobile Sidebar Toggle + Active Page Breadcrumb Title */}
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            {/* Hamburger button on mobile */}
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800"
                title="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Current Active Section Badge & Title */}
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CurrentIcon className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                    {currentHeader.title}
                  </h1>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider bg-slate-800 text-slate-300 rounded border border-slate-700">
                    {currentHeader.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate hidden md:block">
                  {currentHeader.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Real-time Clock, Live Sync Status, Employee Portal Link, User Profile */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 shrink-0">
            {/* Real-time Clock */}
            <div className="hidden md:flex items-center space-x-2 text-xs font-mono text-slate-300 bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{time}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">{dateStr}</span>
            </div>

            {/* WebSocket Sync Status Indicator */}
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
              title={
                wsStatus === 'CONNECTED'
                  ? 'Live WebSocket Sync Connected'
                  : wsStatus === 'CONNECTING'
                  ? 'Connecting to Live Sync Gateway...'
                  : 'Live Sync Disconnected — Click to Reconnect'
              }
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
              <span className="hidden sm:inline">
                {wsStatus === 'CONNECTED' ? 'Live Sync' : wsStatus === 'CONNECTING' ? 'Connecting...' : 'Reconnect'}
              </span>
            </div>

            {/* Employee Portal Direct Link */}
            <a
              href="/emp_login"
              className="hidden sm:flex items-center space-x-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/80 px-3 py-1.5 rounded-xl transition-all shadow-sm"
              title="Open Separate Employee Login & Portal"
            >
              <span>Employee Portal</span>
              <ExternalLink className="w-3 h-3 text-emerald-400" />
            </a>

            {/* Management Profile or Sign In */}
            {activeUser ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                <div className="hidden lg:block text-right">
                  <p className="text-xs font-semibold text-slate-200">{activeUser.full_name}</p>
                  <p className="text-[10px] text-emerald-400 font-mono tracking-wider">{activeUser.role}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Sign Out of Console"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-400 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-xl transition-all shadow-md"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Management Sign In</span>
                <span className="sm:hidden">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
