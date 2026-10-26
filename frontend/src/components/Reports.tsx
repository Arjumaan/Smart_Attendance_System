import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Building,
  Filter,
  FileText,
  FileCheck,
  Search,
  RefreshCw,
  Clock,
} from 'lucide-react';
import api from '../services/api';
import { AttendanceLog, Department } from '../types';

interface ReportsProps {
  onNotify?: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
}

export const Reports: React.FC<ReportsProps> = ({ onNotify }) => {
  // Filters
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultStartStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState<string>(defaultStartStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [previewLogs, setPreviewLogs] = useState<AttendanceLog[]>([]);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  // Load department options
  useEffect(() => {
    api.listDepartments()
      .then((data: Department[]) => setDepartments(data))
      .catch((err: unknown) => console.warn('Could not load departments:', err));
  }, []);

  // Fetch Attendance Log Previews
  const fetchPreviewData = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const logs = await api.getAttendanceLogs({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        department_id: departmentId,
        employee_id: employeeId.trim() ? employeeId.trim() : undefined,
        status: status || undefined,
        limit: 50,
      });
      setPreviewLogs(logs);
    } catch (err: unknown) {
      console.error('Failed to preview report logs:', err);
    } finally {
      setLoadingPreview(false);
    }
  }, [startDate, endDate, departmentId, employeeId, status]);

  useEffect(() => {
    fetchPreviewData();
  }, [fetchPreviewData]);

  // Execute export download
  const handleExportDownload = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await api.exportReport({
        format,
        start_date: startDate,
        end_date: endDate,
        department_id: departmentId,
        employee_id: employeeId.trim() ? employeeId.trim() : undefined,
        status: status || undefined,
      });

      api.downloadBlob(blob, filename);

      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Report Downloaded',
          message: `Successfully exported ${filename}`,
        });
      }
    } catch (err: unknown) {
      console.error('Report export error:', err);
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Export Failed',
          message: 'Could not generate report file. Please verify parameters.',
        });
      }
    } finally {
      setDownloading(false);
    }
  };

  // Quick preset ranges
  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Enterprise Attendance Reports</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">Export filtered audit logs in CSV, Microsoft Excel (.xlsx), or PDF format</p>
        </div>

        {/* Download Action Button */}
        <button
          onClick={handleExportDownload}
          disabled={downloading}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50"
        >
          <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
          <span>{downloading ? 'Generating Report...' : `Export as .${format.toUpperCase()}`}</span>
        </button>
      </div>

      {/* Filter Parameters Card */}
      <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Report Scope & Filters</span>
          </div>

          {/* Quick presets */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-500 mr-1 text-[11px]">Presets:</span>
            <button
              onClick={() => setPresetRange(0)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
            >
              Today
            </button>
            <button
              onClick={() => setPresetRange(7)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
            >
              7 Days
            </button>
            <button
              onClick={() => setPresetRange(30)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
            >
              30 Days
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Start Date</label>
            <div className="flex items-center space-x-2 bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-white focus:outline-none w-full"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">End Date</label>
            <div className="flex items-center space-x-2 bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-white focus:outline-none w-full"
              />
            </div>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Department</label>
            <div className="flex items-center space-x-2 bg-slate-850 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white">
              <Building className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={departmentId === undefined ? '' : departmentId}
                onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : undefined)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none w-full"
              >
                <option value="" className="bg-slate-900">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900">
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="" className="bg-slate-900">All Statuses</option>
              <option value="PRESENT" className="bg-slate-900">PRESENT (On-Time)</option>
              <option value="LATE" className="bg-slate-900">LATE</option>
              <option value="ABSENT" className="bg-slate-900">ABSENT</option>
            </select>
          </div>

          {/* Employee ID Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Employee ID</label>
            <div className="flex items-center space-x-2 bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. EMP101"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full font-mono"
              />
            </div>
          </div>
        </div>

        {/* Format Selector Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-slate-800 gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Export Format:</span>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  format === 'csv'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  format === 'xlsx'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  format === 'pdf'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>PDF Document</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchPreviewData}
              disabled={loadingPreview}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPreview ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Filtered Records Preview</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Showing up to 50 records matching filter
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Employee ID</th>
                <th className="py-3 px-5">Full Name</th>
                <th className="py-3 px-5">Department</th>
                <th className="py-3 px-5">Check In</th>
                <th className="py-3 px-5">Check Out</th>
                <th className="py-3 px-5">Hours</th>
                <th className="py-3 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {previewLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No records found for the selected filter range.
                  </td>
                </tr>
              ) : (
                previewLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-5 font-mono text-slate-300">{log.date}</td>
                    <td className="py-3 px-5 font-mono text-emerald-400">{log.employee_id}</td>
                    <td className="py-3 px-5 font-medium text-white">{log.full_name}</td>
                    <td className="py-3 px-5 text-slate-400">{log.department_name || '--'}</td>
                    <td className="py-3 px-5 font-mono text-slate-300">
                      {log.check_in_time
                        ? new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--'}
                    </td>
                    <td className="py-3 px-5 font-mono text-slate-400">
                      {log.check_out_time
                        ? new Date(log.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--'}
                    </td>
                    <td className="py-3 px-5 font-mono text-cyan-400">
                      {log.total_hours ? `${log.total_hours.toFixed(2)}h` : '--'}
                    </td>
                    <td className="py-3 px-5">
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

export default Reports;
