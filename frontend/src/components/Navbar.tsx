import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  BarChart3,
  Users,
  FileSpreadsheet,
  Radio,
  Clock,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  LogIn,
} from 'lucide-react';
import { TabType, User } from '../types';
import wsClient, { ConnectionStatus } from '../services/websocket';

export interface NavbarProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  wsStatus?: ConnectionStatus;
  currentUser?: User | null;
  user?: User | any | null;
  onLogout?: () => void;
  onLoginClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab = 'kiosk',
  onTabChange,
  wsStatus = 'CONNECTED',
  currentUser,
  user,
  onLogout,
  onLoginClick,
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

  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'kiosk', label: 'Live Kiosk', icon: Camera },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => onTabChange && onTabChange('kiosk')}
          >
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
                <span className="px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider bg-slate-800 text-slate-300 rounded border border-slate-700">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Biometric Access & Presence Tracking</p>
            </div>
          </div>

          {/* Navigation Links */}
          {onTabChange && (
            <nav className="flex items-center space-x-1 sm:space-x-1.5 p-1 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className="relative flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-200"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 bg-slate-850 border border-emerald-500/40 rounded-xl shadow-lg shadow-emerald-950/30"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center space-x-2">
                      <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span className={isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}>{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

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
              <span className="hidden md:inline">
                {wsStatus === 'CONNECTED' ? 'Live Sync' : wsStatus === 'CONNECTING' ? 'Connecting...' : 'Reconnect Sync'}
              </span>
            </div>

            {/* User Profile / Admin Menu */}
            {activeUser ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-semibold text-slate-200">{activeUser.full_name}</p>
                  <p className="text-[10px] text-emerald-400 font-mono tracking-wider">{activeUser.role}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-600/50 px-3 py-1.5 rounded-lg transition-all shadow-md shadow-emerald-950/40"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign In (Admin / HR)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
