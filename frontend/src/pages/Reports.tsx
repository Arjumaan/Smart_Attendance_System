import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { AttendanceRecord, Department } from '../api/types';
import { FileSpreadsheet, Download, Filter, Calendar, FileText, FileDown } from 'lucide-react';

export const Reports: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter params
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    loadDepartments();
    loadRecords();
  }, []);

  const loadDepartments = async () => {
    try {
      const depts = await api.getDepartments();
      setDepartments(depts);
    } catch {
      // offline
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const res = await api.getAttendanceRecords({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        department_id: selectedDept ? Number(selectedDept) : undefined,
        status: selectedStatus || undefined,
        limit: 50,
      });
      setRecords(res.records || []);
      setTotal(res.total || 0);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const params: Record<string, string> = {};
    if (startDate) params['start_date'] = startDate;
    if (endDate) params['end_date'] = endDate;
    if (selectedDept) params['department_id'] = selectedDept;
    if (selectedStatus) params['status'] = selectedStatus;

    const url = api.getExportUrl(format, params);
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
            Audit & Compliance Attendance Reports
          </h2>
          <p className="text-sm text-slate-400">
            Export legally compliant attendance logs in CSV, formatted Excel, or signed PDF formats.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-400" />
            Excel (.xlsx)
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            PDF Audit
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <span className="text-xs text-slate-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="PRESENT">PRESENT</option>
          <option value="LATE">LATE</option>
          <option value="HALF_DAY">HALF DAY</option>
          <option value="ABSENT">ABSENT</option>
        </select>

        <button
          onClick={loadRecords}
          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
        >
          Apply Filters
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Employee</th>
                <th className="py-3.5 px-4 font-semibold">Check-In</th>
                <th className="py-3.5 px-4 font-semibold">Check-Out</th>
                <th className="py-3.5 px-4 font-semibold">Duration</th>
                <th className="py-3.5 px-4 font-semibold">Confidence</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    No attendance records match the specified filters.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs">{r.date}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">{r.user?.full_name || `User #${r.user_id}`}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{r.user?.employee_id}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {r.check_in ? r.check_in.split('T')[1]?.substring(0, 8) : '--'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {r.check_out ? r.check_out.split('T')[1]?.substring(0, 8) : '--'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {r.duration_minutes !== undefined && r.duration_minutes > 0
                        ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m`
                        : '--'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {r.check_in_confidence ? `${(r.check_in_confidence * 100).toFixed(1)}%` : '--'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          r.status === 'PRESENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : r.status === 'LATE'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
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
