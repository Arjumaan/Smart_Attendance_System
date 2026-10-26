import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../api/types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            Enterprise Smart Attendance
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Face Biometrics
            </span>
          </h1>
          <p className="text-xs text-slate-400">High-Concurrency Facial Recognition System</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-sm font-mono font-medium text-slate-200">{time}</span>
          <span className="text-xs text-slate-500">Live Server Time</span>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden md:block" />

        {user ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-slate-200">{user.full_name}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-mono">{user.employee_id}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {user.role}
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 ml-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Kiosk Active
            </span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
