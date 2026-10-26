import React from 'react';
import { NavLink } from 'react-router-dom';
import { Camera, LayoutDashboard, Users, UserPlus, FileSpreadsheet, Activity } from 'lucide-react';
import { User } from '../api/types';

interface SidebarProps {
  user: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const isManagerOrAdmin = user && ['ADMIN', 'HR', 'MANAGER'].includes(user.role);
  const isAdminOrHR = user && ['ADMIN', 'HR'].includes(user.role);

  const navItems = [
    { to: '/kiosk', label: 'Live Kiosk', icon: Camera, always: true },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresRole: isManagerOrAdmin },
    { to: '/employees', label: 'Employees', icon: Users, requiresRole: isAdminOrHR },
    { to: '/enrollment', label: 'Biometrics', icon: UserPlus, requiresRole: isAdminOrHR },
    { to: '/reports', label: 'Audit Reports', icon: FileSpreadsheet, requiresRole: isManagerOrAdmin },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Navigation
        </div>
        <nav className="space-y-1">
          {navItems
            .filter((item) => item.always || item.requiresRole)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>
      </div>

      <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Engine Status
          </span>
          <span className="text-emerald-400 font-mono text-[11px] font-semibold">ONLINE</span>
        </div>
        <div className="text-[11px] text-slate-500 leading-relaxed">
          Vector Cache: <span className="text-slate-300 font-mono">512-d AES</span><br />
          Latency: <span className="text-emerald-400 font-mono">&lt; 45ms</span>
        </div>
      </div>
    </aside>
  );
};
