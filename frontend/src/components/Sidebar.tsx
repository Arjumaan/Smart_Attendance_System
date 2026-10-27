import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  BarChart3,
  Users,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Activity,
  X,
} from 'lucide-react';
import { TabType, User } from '../types';

export interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingLeavesCount?: number;
  currentUser?: User | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  pendingLeavesCount = 0,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const navItems: {
    id: TabType;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    description: string;
  }[] = [
    {
      id: 'kiosk',
      label: 'Live Kiosk',
      icon: Camera,
      description: 'Facial recognition terminal',
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      description: 'Enterprise analytics overview',
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: Users,
      description: 'Staff directory & profiles',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileSpreadsheet,
      description: 'Audit logs & analytics',
    },
    {
      id: 'leaves',
      label: 'Leaves & Permissions',
      icon: FileText,
      badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined,
      description: 'Time-off request reviews',
    },
  ];

  const handleItemClick = (tabId: TabType) => {
    onTabChange(tabId);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between select-none">
      {/* Top Header & Branding */}
      <div>
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80">
          <div
            className="flex items-center space-x-3 cursor-pointer overflow-hidden"
            onClick={() => handleItemClick('kiosk')}
            title="ApexAttend Enterprise"
          >
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-bold tracking-tight text-white uppercase whitespace-nowrap">
                    Apex<span className="text-emerald-400">Attend</span>
                  </span>
                  <span className="px-1.5 py-0.2 text-[9px] uppercase font-bold tracking-wider bg-slate-800 text-slate-300 rounded border border-slate-700">
                    Enterprise
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 whitespace-nowrap truncate">
                  Biometric Access Console
                </p>
              </motion.div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800 transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="flex lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Label */}
        {!isCollapsed && (
          <div className="px-5 pt-5 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Main Navigation
          </div>
        )}

        {/* Navigation Items List */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`relative w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-2.5'
                } rounded-xl text-xs font-semibold transition-all duration-200 group ${
                  isActive
                    ? 'bg-slate-850 text-white border border-emerald-500/40 shadow-lg shadow-emerald-950/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-850/50 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {!isCollapsed && (
                    <div className="text-left overflow-hidden">
                      <p className={`font-semibold truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                        {item.label}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate font-normal">{item.description}</p>
                    </div>
                  )}
                </div>

                {/* Notification Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`${
                      isCollapsed
                        ? 'absolute top-1.5 right-1.5 w-4 h-4 text-[9px]'
                        : 'px-2 py-0.5 text-[10px]'
                    } font-bold bg-amber-500 text-slate-950 rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-amber-500/20`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Info & Shortcuts */}
      <div className="p-3 border-t border-slate-800/80 space-y-3">
        {/* Switch to Dedicated Employee Portal */}
        <a
          href="/emp_login"
          title="Open Employee Portal (/emp_login)"
          className={`w-full flex items-center ${
            isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
          } rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 text-emerald-400 transition-all shadow-sm`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <ExternalLink className="w-4 h-4 shrink-0" />
            {!isCollapsed && (
              <div className="text-left">
                <p className="text-xs font-semibold">Employee Portal</p>
                <p className="text-[10px] text-emerald-500/70">Self-Service Access</p>
              </div>
            )}
          </div>
          {!isCollapsed && <span className="text-[10px] text-emerald-400">↗</span>}
        </a>

        {/* Biometric Status Telemetry */}
        {!isCollapsed ? (
          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Biometric Engine
              </span>
              <span className="text-emerald-400 font-mono text-[10px] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
              Vector: <span className="text-slate-300">512-d AES</span> • Match:{' '}
              <span className="text-emerald-400">&lt; 45ms</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Biometric Engine Online">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 h-screen sticky top-0 border-r border-slate-800 bg-slate-900/95 backdrop-blur-md transition-all duration-300 ease-in-out z-30 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Slide-in Sidebar Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="absolute inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 shadow-2xl z-10"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
