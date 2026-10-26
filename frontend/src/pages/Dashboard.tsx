import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { DashboardStats } from '../api/types';
import { Users, UserCheck, Clock, UserX, TrendingUp, RefreshCw, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch {
      // Fallback sample statistics for preview/demo
      setStats({
        total_employees: 10,
        present_today: 9,
        late_today: 1,
        absent_today: 1,
        attendance_rate: 90.0,
        on_time_rate: 88.8,
        recent_logs: [],
        department_breakdown: [
          { department: 'Engineering', count: 4, present: 4 },
          { department: 'HR', count: 2, present: 2 },
          { department: 'Sales', count: 2, present: 2 },
          { department: 'Finance', count: 1, present: 1 },
          { department: 'Operations', count: 1, present: 0 },
        ],
        weekly_trend: [
          { date: 'Mon', present: 8, late: 2 },
          { date: 'Tue', present: 9, late: 1 },
          { date: 'Wed', present: 10, late: 0 },
          { date: 'Thu', present: 9, late: 1 },
          { date: 'Fri', present: 9, late: 1 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-400" />
            Executive Attendance Dashboard
          </h2>
          <p className="text-sm text-slate-400">Enterprise operational presence, punctuality metrics, and departmental analytics.</p>
        </div>

        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Workforce</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white font-mono">{stats?.total_employees || 0}</div>
          <p className="text-xs text-slate-500">Active enrolled employees</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Present Today</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-400 font-mono">{stats?.present_today || 0}</div>
          <p className="text-xs text-slate-500">{stats?.attendance_rate.toFixed(1)}% attendance rate</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Late Arrivals</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-400 font-mono">{stats?.late_today || 0}</div>
          <p className="text-xs text-slate-500">Punched after 09:15 AM</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Absent / Unreported</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-rose-400 font-mono">{stats?.absent_today || 0}</div>
          <p className="text-xs text-slate-500">Pending shift registration</p>
        </div>
      </div>

      {/* Visual Analytics Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend Bar Chart */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Weekly Attendance Trend
            </h3>
            <span className="text-xs text-slate-400">Last 5 Workdays</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.weekly_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Bar dataKey="present" fill="#4f46e5" radius={[4, 4, 0, 0]} name="On Time" />
                <Bar dataKey="late" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Late" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Attendance Breakdown */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Department Attendance Ratio
            </h3>
            <span className="text-xs text-slate-400">Current Day</span>
          </div>

          <div className="space-y-3.5">
            {stats?.department_breakdown.map((dept) => {
              const pct = dept.count > 0 ? Math.round((dept.present / dept.count) * 100) : 0;
              return (
                <div key={dept.department} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-200">{dept.department}</span>
                    <span className="text-slate-400 font-mono">
                      {dept.present}/{dept.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-indigo-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
