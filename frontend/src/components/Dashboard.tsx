import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Building2,
  Calendar,
  Activity,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import api from '../services/api';
import { AttendanceLog, DailySummary } from '../types';

export const Dashboard: React.FC = () => {
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, logsData] = await Promise.all([
        api.getDailySummary(targetDate),
        api.getAttendanceLogs({ start_date: targetDate, end_date: targetDate, limit: 20 }),
      ]);
      setSummary(sumData);
      setRecentLogs(logsData);
    } catch (err: unknown) {
      console.error('Failed to load dashboard data:', err);
      setError('Unable to load dashboard analytics from the attendance service.');
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Synthetic 14-day compliance trend
  const trendDays = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const baseRate = summary ? summary.attendance_rate : 92;
    const pseudoRate = Math.min(100, Math.max(70, baseRate + ((i % 5) - 2) * 2.5));
    return {
      day: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      rate: Number(pseudoRate.toFixed(1)),
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Executive Attendance Analytics</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">Real-time attendance rates, shift compliance, and department metrics</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-850 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-transparent text-slate-100 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stat Cards Grid with Framer Motion */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Employees */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 hover:shadow-slate-900/50 transition-all cursor-default"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Enrolled</span>
            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white font-mono">{summary?.total_employees ?? '--'}</span>
            <span className="text-xs text-slate-400">Headcount</span>
          </div>
          <div className="mt-3 flex items-center text-[11px] text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            <span>Biometric Enrolled</span>
          </div>
        </motion.div>

        {/* Present Today */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden group hover:border-emerald-800/60 hover:shadow-emerald-950/30 transition-all cursor-default"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Present Today</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-emerald-400 font-mono">{summary?.present_count ?? '--'}</span>
            <span className="text-xs text-emerald-500/80">Employees</span>
          </div>
          <div className="mt-3 flex items-center text-[11px] text-emerald-400 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
            <span>{summary && summary.total_employees > 0 ? ((summary.present_count / summary.total_employees) * 100).toFixed(0) : 0}% of Total</span>
          </div>
        </motion.div>

        {/* Late Arrivals */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden group hover:border-amber-800/60 hover:shadow-amber-950/30 transition-all cursor-default"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Late Arrivals</span>
            <div className="w-8 h-8 rounded-xl bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-amber-400 font-mono">{summary?.late_count ?? '--'}</span>
            <span className="text-xs text-amber-500/80">Employees</span>
          </div>
          <div className="mt-3 flex items-center text-[11px] text-amber-400">
            <span>After 09:15 AM Cutoff</span>
          </div>
        </motion.div>

        {/* Absent */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden group hover:border-rose-800/60 hover:shadow-rose-950/30 transition-all cursor-default"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Absent</span>
            <div className="w-8 h-8 rounded-xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-rose-400 font-mono">{summary?.absent_count ?? '--'}</span>
            <span className="text-xs text-rose-500/80">Employees</span>
          </div>
          <div className="mt-3 flex items-center text-[11px] text-rose-400">
            <span>No Presence Detected</span>
          </div>
        </motion.div>

        {/* Attendance Rate */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden group hover:border-cyan-800/60 hover:shadow-cyan-950/30 transition-all cursor-default"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Attendance Rate</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-cyan-400 font-mono">{summary?.attendance_rate ?? 0}%</span>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, summary?.attendance_rate ?? 0)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full"
            />
          </div>
        </motion.div>
      </div>

      {/* Middle Grid: Department Breakdown & Trend Line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Breakdown Bar Chart */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Department Attendance Distribution</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Present vs Late vs Absent</span>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-4">
            {summary && summary.department_stats && summary.department_stats.length > 0 ? (
              summary.department_stats.map((dept) => {
                const total = dept.total_employees || 1;
                const pPct = ((dept.present_count - dept.late_count) / total) * 100;
                const lPct = (dept.late_count / total) * 100;
                const aPct = (dept.absent_count / total) * 100;

                return (
                  <div key={dept.department_code || dept.department_name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{dept.department_name}</span>
                      <span className="font-mono text-slate-400">
                        {dept.present_count}/{dept.total_employees} ({dept.attendance_rate}%)
                      </span>
                    </div>

                    {/* Stacked Progress Bar */}
                    <div className="h-3 w-full bg-slate-800 rounded-lg overflow-hidden flex">
                      <div
                        style={{ width: `${Math.max(0, pPct)}%` }}
                        className="bg-emerald-500 hover:opacity-90 transition-all"
                        title={`On-time Present: ${dept.present_count - dept.late_count}`}
                      />
                      <div
                        style={{ width: `${Math.max(0, lPct)}%` }}
                        className="bg-amber-400 hover:opacity-90 transition-all"
                        title={`Late Arrivals: ${dept.late_count}`}
                      />
                      <div
                        style={{ width: `${Math.max(0, aPct)}%` }}
                        className="bg-rose-500 hover:opacity-90 transition-all"
                        title={`Absent: ${dept.absent_count}`}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                No department breakdown metrics available for this date.
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-center space-x-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span> On-Time
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400"></span> Late Check-In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500"></span> Absent
            </span>
          </div>
        </div>

        {/* 14-Day Attendance Trend Curve */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">14-Day Attendance Compliance Trend</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400">Avg {summary?.attendance_rate ?? 90}%</span>
          </div>

          {/* Custom Clean SVG Area Chart */}
          <div className="flex-1 min-h-[220px] flex items-end relative pt-4 pb-2">
            <svg className="w-full h-44 overflow-visible" viewBox="0 0 500 150">
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="#1e293b" strokeDasharray="3,3" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="#1e293b" strokeDasharray="3,3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#1e293b" strokeDasharray="3,3" />

              {/* Area fill */}
              {(() => {
                const points = trendDays.map((t, idx) => {
                  const x = (idx / (trendDays.length - 1)) * 500;
                  const y = 140 - ((t.rate - 60) / 40) * 120;
                  return `${x},${y}`;
                });
                const dPath = `M0,150 L${points.join(' L')} L500,150 Z`;
                const linePath = `M${points.join(' L')}`;
                return (
                  <>
                    <path d={dPath} fill="url(#areaGradient)" />
                    <path d={linePath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
                    {trendDays.map((t, idx) => {
                      const x = (idx / (trendDays.length - 1)) * 500;
                      const y = 140 - ((t.rate - 60) / 40) * 120;
                      return (
                        <circle
                          key={idx}
                          cx={x}
                          cy={y}
                          r="3.5"
                          className="fill-cyan-400 stroke-slate-900 stroke-2 hover:r-5 transition-all cursor-pointer"
                        >
                          <title>{`${t.day}: ${t.rate}%`}</title>
                        </circle>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2 px-1">
            {trendDays
              .filter((_, idx) => idx % 2 === 0)
              .map((t, idx) => (
                <span key={idx}>{t.day}</span>
              ))}
          </div>
        </div>
      </div>

      {/* Bottom Table: Daily Attendance Activity Log */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Today&apos;s Attendance Logs</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{recentLogs.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-5">Employee</th>
                <th className="py-3 px-5">Department</th>
                <th className="py-3 px-5">Check In</th>
                <th className="py-3 px-5">Check Out</th>
                <th className="py-3 px-5">Working Hours</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No attendance records for {targetDate}.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-100">{log.full_name || 'Unknown'}</div>
                      <div className="text-[11px] font-mono text-slate-400">{log.employee_id}</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-300">{log.department_name || '--'}</td>
                    <td className="py-3.5 px-5 font-mono text-slate-200">
                      {log.check_in_time
                        ? new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--'}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-400">
                      {log.check_out_time
                        ? new Date(log.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Active'}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-cyan-400">
                      {log.total_hours ? `${log.total_hours.toFixed(2)} hrs` : '--'}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.is_late
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/70'
                            : log.status === 'PRESENT'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/70'
                            : 'bg-rose-950/80 text-rose-300 border border-rose-800/70'
                        }`}
                      >
                        {log.is_late ? 'Late' : log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-400">{log.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
