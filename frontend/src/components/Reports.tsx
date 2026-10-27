import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  RotateCcw,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import api from '../services/api';
import { AttendanceLog, Department } from '../types';

interface ReportsProps {
  onNotify?: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
}

interface FilterState {
  startDate: string;
  endDate: string;
  departmentId: number | undefined;
  employeeSearch: string;
  status: string;
}

export const Reports: React.FC<ReportsProps> = ({ onNotify }) => {
  // Safe local date formatting (YYYY-MM-DD)
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPresetRange = (days: number): { start: string; end: string } => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return {
      start: formatLocalDate(start),
      end: formatLocalDate(end),
    };
  };

  const initialRange = getPresetRange(30);

  // Draft filters (what the user is currently editing in the form)
  const [draftFilters, setDraftFilters] = useState<FilterState>({
    startDate: initialRange.start,
    endDate: initialRange.end,
    departmentId: undefined,
    employeeSearch: '',
    status: '',
  });

  // Applied filters (what was submitted and is actively driving the preview & exports)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    startDate: initialRange.start,
    endDate: initialRange.end,
    departmentId: undefined,
    employeeSearch: '',
    status: '',
  });

  const [activePreset, setActivePreset] = useState<'today' | '7days' | '30days' | 'custom'>('30days');
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [previewLogs, setPreviewLogs] = useState<AttendanceLog[]>([]);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  // Check if draft has unsaved changes compared to applied
  const isDirty =
    draftFilters.startDate !== appliedFilters.startDate ||
    draftFilters.endDate !== appliedFilters.endDate ||
    draftFilters.departmentId !== appliedFilters.departmentId ||
    draftFilters.employeeSearch !== appliedFilters.employeeSearch ||
    draftFilters.status !== appliedFilters.status;

  // Load department options on mount
  useEffect(() => {
    api.listDepartments()
      .then((data: Department[]) => setDepartments(data))
      .catch((err: unknown) => console.warn('Could not load departments:', err));
  }, []);

  // Fetch Attendance Log Previews using applied filters
  const fetchPreviewData = useCallback(async (filtersToUse: FilterState) => {
    setLoadingPreview(true);
    try {
      const logs = await api.getAttendanceLogs({
        start_date: filtersToUse.startDate || undefined,
        end_date: filtersToUse.endDate || undefined,
        department_id: filtersToUse.departmentId,
        employee_id: filtersToUse.employeeSearch.trim() ? filtersToUse.employeeSearch.trim() : undefined,
        status: filtersToUse.status || undefined,
        limit: 100,
      });
      setPreviewLogs(logs);
      return logs;
    } catch (err: unknown) {
      console.error('Failed to preview report logs:', err);
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Query Failed',
          message: 'Unable to retrieve attendance records with specified filters.',
        });
      }
      return [];
    } finally {
      setLoadingPreview(false);
    }
  }, [onNotify]);

  // Initial load
  useEffect(() => {
    fetchPreviewData(appliedFilters);
  }, []); // Run on mount

  // Apply filters action
  const handleApplyFilters = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedFilters(draftFilters);
    const logs = await fetchPreviewData(draftFilters);
    if (onNotify) {
      onNotify({
        type: 'success',
        title: 'Filters Applied',
        message: `Found ${logs.length} matching attendance record${logs.length === 1 ? '' : 's'}.`,
      });
    }
  };

  // Reset all filters to default 30-day range
  const handleResetFilters = async () => {
    const defRange = getPresetRange(30);
    const resetState: FilterState = {
      startDate: defRange.start,
      endDate: defRange.end,
      departmentId: undefined,
      employeeSearch: '',
      status: '',
    };
    setDraftFilters(resetState);
    setAppliedFilters(resetState);
    setActivePreset('30days');
    const logs = await fetchPreviewData(resetState);
    if (onNotify) {
      onNotify({
        type: 'info',
        title: 'Filters Reset',
        message: `Restored default parameters (${logs.length} records).`,
      });
    }
  };

  // Quick preset ranges handler
  const handleSelectPreset = (days: number, presetKey: 'today' | '7days' | '30days') => {
    const range = getPresetRange(days);
    const updatedDraft: FilterState = {
      ...draftFilters,
      startDate: range.start,
      endDate: range.end,
    };
    setDraftFilters(updatedDraft);
    setAppliedFilters(updatedDraft);
    setActivePreset(presetKey);
    fetchPreviewData(updatedDraft);
    if (onNotify) {
      onNotify({
        type: 'info',
        title: 'Date Scope Updated',
        message: `Applied ${presetKey === 'today' ? 'Today' : `${days} Days`} preset.`,
      });
    }
  };

  // Remove a specific active filter tag
  const handleRemoveFilterTag = (key: keyof FilterState) => {
    let updated: FilterState;
    if (key === 'startDate' || key === 'endDate') {
      const defRange = getPresetRange(30);
      updated = {
        ...appliedFilters,
        startDate: defRange.start,
        endDate: defRange.end,
      };
      setActivePreset('30days');
    } else {
      updated = {
        ...appliedFilters,
        [key]: key === 'departmentId' ? undefined : '',
      };
    }
    setDraftFilters(updated);
    setAppliedFilters(updated);
    fetchPreviewData(updated);
  };

  // Execute export download using the APPLIED filters
  const handleExportDownload = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await api.exportReport({
        format,
        start_date: appliedFilters.startDate,
        end_date: appliedFilters.endDate,
        department_id: appliedFilters.departmentId,
        employee_id: appliedFilters.employeeSearch.trim() ? appliedFilters.employeeSearch.trim() : undefined,
        status: appliedFilters.status || undefined,
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

  const selectedDepartmentName = departments.find((d) => d.id === appliedFilters.departmentId)?.name;

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
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExportDownload}
          disabled={downloading}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50"
        >
          <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
          <span>{downloading ? 'Generating Report...' : `Export as .${format.toUpperCase()}`}</span>
        </motion.button>
      </div>

      {/* Filter Parameters Form Card */}
      <form
        onSubmit={handleApplyFilters}
        className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Report Scope & Filters</span>
            {isDirty && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800/80 animate-pulse">
                Unapplied Changes
              </span>
            )}
          </div>

          {/* Quick presets */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-500 mr-1 text-[11px]">Presets:</span>
            <button
              type="button"
              onClick={() => handleSelectPreset(0, 'today')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                activePreset === 'today'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset(7, '7days')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                activePreset === '7days'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset(30, '30days')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                activePreset === '30days'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Filter Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Start Date</label>
            <div
              onClick={() => startDateRef.current?.showPicker?.()}
              className="flex items-center space-x-2 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white cursor-pointer hover:border-emerald-500/60 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <input
                ref={startDateRef}
                type="date"
                value={draftFilters.startDate}
                onChange={(e) => {
                  setDraftFilters({ ...draftFilters, startDate: e.target.value });
                  setActivePreset('custom');
                }}
                className="bg-transparent text-white focus:outline-none w-full cursor-pointer"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">End Date</label>
            <div
              onClick={() => endDateRef.current?.showPicker?.()}
              className="flex items-center space-x-2 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white cursor-pointer hover:border-emerald-500/60 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <input
                ref={endDateRef}
                type="date"
                value={draftFilters.endDate}
                onChange={(e) => {
                  setDraftFilters({ ...draftFilters, endDate: e.target.value });
                  setActivePreset('custom');
                }}
                className="bg-transparent text-white focus:outline-none w-full cursor-pointer"
              />
            </div>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Department</label>
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white">
              <Building className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                value={draftFilters.departmentId === undefined ? '' : draftFilters.departmentId}
                onChange={(e) =>
                  setDraftFilters({
                    ...draftFilters,
                    departmentId: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="bg-transparent text-slate-200 text-xs focus:outline-none w-full cursor-pointer"
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
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                value={draftFilters.status}
                onChange={(e) => setDraftFilters({ ...draftFilters, status: e.target.value })}
                className="bg-transparent text-slate-200 text-xs focus:outline-none w-full cursor-pointer"
              >
                <option value="" className="bg-slate-900">All Statuses</option>
                <option value="PRESENT" className="bg-slate-900">PRESENT (On-Time)</option>
                <option value="LATE" className="bg-slate-900">LATE</option>
                <option value="ABSENT" className="bg-slate-900">ABSENT</option>
                <option value="ON_LEAVE" className="bg-slate-900">ON LEAVE (Approved)</option>
              </select>
            </div>
          </div>

          {/* Employee ID / Name Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Search Employee</label>
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus-within:border-emerald-500 transition-colors">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="ID, name, or email..."
                value={draftFilters.employeeSearch}
                onChange={(e) => setDraftFilters({ ...draftFilters, employeeSearch: e.target.value })}
                className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full text-xs"
              />
            </div>
          </div>
        </div>

        {/* Bottom Bar: Export Format & Apply / Reset Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-slate-800 gap-3">
          {/* Format Selector Pills */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Export Format:</span>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  format === 'csv'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700 shadow-sm shadow-emerald-950/40'
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
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700 shadow-sm shadow-emerald-950/40'
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
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700 shadow-sm shadow-emerald-950/40'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>PDF Document</span>
              </button>
            </div>
          </div>

          {/* Action Buttons: Reset & Apply Filters */}
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={loadingPreview}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset</span>
            </button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loadingPreview}
              className="flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPreview ? 'animate-spin' : ''}`} />
              <span>{loadingPreview ? 'Applying...' : 'Apply Filters'}</span>
            </motion.button>
          </div>
        </div>

        {/* Active Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
          <span className="text-[11px] text-slate-500 font-medium">Active Criteria:</span>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px]">
            <Calendar className="w-3 h-3 text-emerald-400" />
            <span>{appliedFilters.startDate} → {appliedFilters.endDate}</span>
          </span>

          {appliedFilters.departmentId && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-[11px]">
              <Building className="w-3 h-3 text-emerald-400" />
              <span>Dept: {selectedDepartmentName || `ID ${appliedFilters.departmentId}`}</span>
              <button
                type="button"
                onClick={() => handleRemoveFilterTag('departmentId')}
                className="hover:text-white ml-1"
                title="Remove department filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {appliedFilters.status && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-[11px]">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>Status: {appliedFilters.status}</span>
              <button
                type="button"
                onClick={() => handleRemoveFilterTag('status')}
                className="hover:text-white ml-1"
                title="Remove status filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {appliedFilters.employeeSearch && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-[11px]">
              <Search className="w-3 h-3 text-emerald-400" />
              <span>Query: &quot;{appliedFilters.employeeSearch}&quot;</span>
              <button
                type="button"
                onClick={() => handleRemoveFilterTag('employeeSearch')}
                className="hover:text-white ml-1"
                title="Remove employee search query"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      </form>

      {/* Live Preview Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Filtered Records Preview</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {previewLogs.length} record{previewLogs.length === 1 ? '' : 's'} matching filter
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
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-600 mb-1" />
                      <p className="text-sm font-medium text-slate-400">No records found for the selected filter range.</p>
                      <p className="text-xs text-slate-600 max-w-sm">
                        Try adjusting your start and end dates, or click Reset to restore default parameters.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                previewLogs.map((log) => (
                  <tr key={`${log.id}-${log.employee_id}-${log.date}`} className="hover:bg-slate-850/50 transition-colors">
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
                          log.status === 'ABSENT'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/70'
                            : log.status === 'ON_LEAVE'
                            ? 'bg-sky-950/80 text-sky-300 border border-sky-800/70'
                            : log.is_late || log.status === 'LATE'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800/70'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/70'
                        }`}
                      >
                        {log.status === 'ABSENT'
                          ? 'Absent'
                          : log.status === 'ON_LEAVE'
                          ? 'On Leave'
                          : log.is_late || log.status === 'LATE'
                          ? 'Late'
                          : 'On-Time'}
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
