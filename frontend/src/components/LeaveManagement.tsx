import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  User,
  Building,
  Filter,
  RefreshCw,
  Send,
  MessageSquare,
  AlertTriangle,
  Search,
  Check,
  X,
  Download,
  FileSpreadsheet,
  Printer,
  BarChart3,
  PieChart,
  Calendar,
  TrendingUp,
  Percent,
} from 'lucide-react';
import api from '../services/api';
import { LeaveActionPayload, LeaveRequest, LeaveStatus } from '../types';

interface LeaveManagementProps {
  onNotify: (toast: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }) => void;
  onRefreshPendingCount?: () => void;
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({ onNotify, onRefreshPendingCount }) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Action Modal State (Approve, Reject, Enquire)
  const [activeModal, setActiveModal] = useState<{
    request: LeaveRequest;
    action: 'APPROVE' | 'REJECT' | 'ENQUIRE';
  } | null>(null);
  const [modalNotes, setModalNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Report Audit Filters State
  const [reportSearch, setReportSearch] = useState<string>('');
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('ALL');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('ALL');
  const [reportDeptFilter, setReportDeptFilter] = useState<string>('ALL');

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAllLeaveRequests();
      const items = Array.isArray(data) ? data : (data?.requests || []);
      setRequests(items);
      setTotalCount(Array.isArray(data) ? data.length : (data?.total ?? items.length));
      if (onRefreshPendingCount) {
        onRefreshPendingCount();
      }
    } catch (err: unknown) {
      console.error('Failed to load leave requests:', err);
    } finally {
      setLoading(false);
    }
  }, [onRefreshPendingCount]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Handle Action Submit (Approve, Reject, Enquire)
  const handleActionSubmit = async () => {
    if (!activeModal) return;

    if (activeModal.action === 'REJECT' && !modalNotes.trim()) {
      onNotify({
        type: 'warning',
        title: 'Rejection Reason Required',
        message: 'Please provide a reason to inform the employee why the request was declined.',
      });
      return;
    }

    if (activeModal.action === 'ENQUIRE' && !modalNotes.trim()) {
      onNotify({
        type: 'warning',
        title: 'Enquiry Message Required',
        message: 'Please specify the question or additional details required from the employee.',
      });
      return;
    }

    setActionLoading(true);
    try {
      const payload: LeaveActionPayload = {
        action: activeModal.action,
        admin_notes: modalNotes.trim() || undefined,
      };

      await api.reviewLeaveRequest(activeModal.request.id, payload);

      const actionPast =
        activeModal.action === 'APPROVE'
          ? 'Approved'
          : activeModal.action === 'REJECT'
          ? 'Rejected'
          : 'Clarification Enquired';

      onNotify({
        type: activeModal.action === 'APPROVE' ? 'success' : activeModal.action === 'REJECT' ? 'error' : 'info',
        title: `Request #${activeModal.request.id} ${actionPast}`,
        message: `Status updated for ${activeModal.request.employee_name || 'Employee'}.`,
      });

      setActiveModal(null);
      setModalNotes('');
      fetchRequests();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        'Failed to submit review action.';
      onNotify({
        type: 'error',
        title: 'Action Error',
        message: msg,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered by Status, Type, and Search Query
  const filteredRequests = requests.filter((r) => {
    // 1. Status Tab Filter
    if (statusFilter !== 'ALL' && r.status !== statusFilter) {
      return false;
    }
    // 2. Request Type Filter
    if (typeFilter !== 'ALL' && r.request_type !== typeFilter) {
      return false;
    }
    // 3. Search Query Filter
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = r.full_name || r.employee_name || '';
    const code = r.employee_id || r.employee_code || '';
    return (
      name.toLowerCase().includes(query) ||
      code.toLowerCase().includes(query) ||
      (r.reason && r.reason.toLowerCase().includes(query)) ||
      (r.department_name && r.department_name.toLowerCase().includes(query))
    );
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const enquiryCount = requests.filter((r) => r.status === 'ENQUIRY_REQUESTED').length;

  // Report Calculations & Analytics
  const totalRequests = requests.length;
  const approvedList = requests.filter((r) => r.status === 'APPROVED');
  const rejectedList = requests.filter((r) => r.status === 'REJECTED');
  const pendingList = requests.filter((r) => r.status === 'PENDING');
  const enquiryList = requests.filter((r) => r.status === 'ENQUIRY_REQUESTED');

  const approvalRate = totalRequests > 0 ? Math.round((approvedList.length / totalRequests) * 100) : 0;
  const rejectionRate = totalRequests > 0 ? Math.round((rejectedList.length / totalRequests) * 100) : 0;

  const totalPermissionHours = requests
    .filter((r) => r.request_type === 'PERMISSION' && r.status === 'APPROVED')
    .reduce((sum, r) => sum + (r.duration_hours || 0), 0);

  const totalLeaveDays = requests
    .filter((r) => r.request_type === 'LEAVE' && r.status === 'APPROVED')
    .reduce((sum, r) => {
      try {
        const s = new Date(r.start_date);
        const e = new Date(r.end_date || r.start_date);
        const d = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
        return sum + (isNaN(d) ? 1 : d);
      } catch {
        return sum + 1;
      }
    }, 0);

  // Type Distribution
  const casualCount = requests.filter((r) => r.leave_type === 'CASUAL').length;
  const sickCount = requests.filter((r) => r.leave_type === 'SICK').length;
  const annualCount = requests.filter((r) => r.leave_type === 'ANNUAL').length;
  const permissionsCount = requests.filter((r) => r.request_type === 'PERMISSION').length;

  // Department Breakdown
  const deptMap: { [key: string]: { total: number; approved: number } } = {};
  requests.forEach((r) => {
    const dept = r.department_name || 'General';
    if (!deptMap[dept]) deptMap[dept] = { total: 0, approved: 0 };
    deptMap[dept].total += 1;
    if (r.status === 'APPROVED') deptMap[dept].approved += 1;
  });
  const deptList = Object.keys(deptMap).sort();

  // Filtered Report Requests for Table
  const filteredReportRequests = requests.filter((r) => {
    if (reportStatusFilter !== 'ALL' && r.status !== reportStatusFilter) return false;
    if (reportTypeFilter !== 'ALL' && r.request_type !== reportTypeFilter) return false;
    if (reportDeptFilter !== 'ALL' && (r.department_name || 'General') !== reportDeptFilter) return false;

    if (!reportSearch.trim()) return true;
    const query = reportSearch.toLowerCase();
    const name = r.full_name || r.employee_name || '';
    const code = r.employee_id || r.employee_code || '';
    return (
      name.toLowerCase().includes(query) ||
      code.toLowerCase().includes(query) ||
      (r.reason && r.reason.toLowerCase().includes(query)) ||
      (r.department_name && r.department_name.toLowerCase().includes(query)) ||
      (r.reviewer_name && r.reviewer_name.toLowerCase().includes(query)) ||
      (r.admin_notes && r.admin_notes.toLowerCase().includes(query))
    );
  });

  // Export CSV Report
  const exportToCSV = () => {
    if (requests.length === 0) {
      onNotify({
        type: 'warning',
        title: 'No Records',
        message: 'No leave or permission records available to export.',
      });
      return;
    }

    const headers = [
      'Record ID',
      'Employee ID',
      'Employee Name',
      'Department',
      'Category',
      'Type',
      'Start Date',
      'End Date',
      'Start Time',
      'End Time',
      'Duration Hours',
      'Status',
      'Reviewer',
      'Reason',
      'Admin Notes',
      'Date Submitted',
    ];

    const targetList = filteredReportRequests.length > 0 ? filteredReportRequests : requests;

    const rows = targetList.map((r) => [
      r.id,
      `"${r.employee_id || r.employee_code || ''}"`,
      `"${(r.full_name || r.employee_name || '').replace(/"/g, '""')}"`,
      `"${(r.department_name || 'General').replace(/"/g, '""')}"`,
      r.request_type,
      r.leave_type,
      r.start_date,
      r.end_date,
      r.start_time || '',
      r.end_time || '',
      r.duration_hours || '',
      r.status,
      `"${(r.reviewer_name || '').replace(/"/g, '""')}"`,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      `"${(r.admin_notes || '').replace(/"/g, '""')}"`,
      r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `ApexAttend_Leave_Permissions_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onNotify({
      type: 'success',
      title: 'Report Downloaded',
      message: `Exported ${targetList.length} leave & permission records successfully.`,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-lg shadow-emerald-950/40">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold tracking-tight text-white">Leave & Permission Management</h1>
              {(pendingCount > 0 || enquiryCount > 0) && (
                <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-950 text-amber-400 border border-amber-800/80 rounded-full animate-pulse">
                  {pendingCount + enquiryCount} Actionable
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Review, approve, reject, or request enquiry clarification for employee time-off and permission requests.
            </p>
          </div>
        </div>

        <button
          onClick={fetchRequests}
          className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-4 rounded-2xl">
        {/* Status Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: 'ALL', label: 'All Requests' },
            { id: 'PENDING', label: `Pending (${pendingCount})` },
            { id: 'ENQUIRY_REQUESTED', label: `Enquiries (${enquiryCount})` },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'REJECTED', label: 'Rejected' },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80 shadow-md shadow-emerald-950/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Search & Request Type */}
        <div className="flex items-center space-x-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Types</option>
            <option value="LEAVE">Leaves Only</option>
            <option value="PERMISSION">Permissions Only</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, reason..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Requests Grid / Table */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 font-mono text-xs">Loading leave requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <Clock className="w-10 h-10 mx-auto text-slate-600" />
          <h4 className="text-sm font-bold text-white">No requests found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are currently no employee leave or permission requests matching the active filter criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((req) => {
            const isPending = req.status === 'PENDING';
            const isEnquiry = req.status === 'ENQUIRY_REQUESTED';
            const isApproved = req.status === 'APPROVED';
            const isRejected = req.status === 'REJECTED';

            return (
              <div
                key={req.id}
                className={`relative rounded-3xl border p-5 space-y-4 shadow-xl transition-all ${
                  isPending
                    ? 'bg-slate-900/90 border-slate-700 hover:border-slate-600'
                    : isEnquiry
                    ? 'bg-amber-950/20 border-amber-500/40 ring-1 ring-amber-500/20'
                    : isApproved
                    ? 'bg-slate-900/60 border-emerald-900/40'
                    : 'bg-slate-900/60 border-rose-900/40'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-850 border border-slate-700/80 flex items-center justify-center text-emerald-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{req.full_name || req.employee_name || `User #${req.user_id}`}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {req.employee_id || req.employee_code || 'EMP'} • {req.department_name || 'General Operations'}
                      </p>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center space-x-1 ${
                      isApproved
                        ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
                        : isRejected
                        ? 'bg-rose-950 border-rose-700 text-rose-400'
                        : isEnquiry
                        ? 'bg-amber-950 border-amber-600 text-amber-300'
                        : 'bg-amber-950/80 border-amber-700/80 text-amber-400'
                    }`}
                  >
                    {isApproved && <CheckCircle2 className="w-3 h-3" />}
                    {isRejected && <XCircle className="w-3 h-3" />}
                    {isEnquiry && <HelpCircle className="w-3 h-3" />}
                    {isPending && <Clock className="w-3 h-3" />}
                    <span>{req.status.replace('_', ' ')}</span>
                  </span>
                </div>

                {/* Details Banner */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-emerald-400 font-bold uppercase">
                      {req.request_type} • {req.leave_type}
                    </span>
                    <span className="text-slate-400">
                      Applied on: {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-slate-200 font-mono text-xs">
                    📅 <span className="font-semibold">{req.start_date}</span>
                    {req.end_date && req.end_date !== req.start_date && (
                      <>
                        {' '}to <span className="font-semibold">{req.end_date}</span>
                      </>
                    )}
                    {req.start_time && (
                      <span className="text-emerald-400 font-semibold ml-2">
                        ⏰ {req.start_time} - {req.end_time || '—'} ({req.duration_hours || 0} hrs)
                      </span>
                    )}
                  </div>

                  <div className="pt-1 text-slate-300">
                    <span className="text-slate-500 font-semibold text-[10px] uppercase block">Reason:</span>
                    <p className="mt-0.5 leading-relaxed">{req.reason}</p>
                  </div>
                </div>

                {/* Management Clarification / Admin Notes */}
                {req.admin_notes && (
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      isEnquiry
                        ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-amber-400 block">
                      Enquiry / Decision Note:
                    </span>
                    <p className="leading-relaxed">{req.admin_notes}</p>
                  </div>
                )}

                {/* Employee Response to Enquiry (Crucial for Admin to see the answer!) */}
                {req.employee_reply && (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-600/40 text-xs text-emerald-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center space-x-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>Employee's Clarification Reply:</span>
                    </span>
                    <p className="leading-relaxed font-mono">{req.employee_reply}</p>
                  </div>
                )}

                {/* Action Buttons: Available for PENDING and ENQUIRY_REQUESTED */}
                {(isPending || isEnquiry) && (
                  <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal({ request: req, action: 'ENQUIRE' });
                        setModalNotes('');
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/70 text-amber-300 text-xs font-semibold rounded-xl transition-all shadow-sm"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Enquire</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal({ request: req, action: 'REJECT' });
                        setModalNotes('');
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-700/70 text-rose-300 text-xs font-semibold rounded-xl transition-all shadow-sm"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal({ request: req, action: 'APPROVE' });
                        setModalNotes('');
                      }}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* LEAVE & PERMISSIONS REPORTS & AUDIT LEDGER (BOTTOM SECTION)    */}
      {/* ============================================================== */}
      <div className="border-t-2 border-slate-800/80 pt-10 mt-12 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/40">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Leave & Permissions Reports & Audit Ledger
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Audit Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comprehensive leave audit trail, approval velocity, department patterns, and compliance reporting.
              </p>
            </div>
          </div>

          {/* Action Buttons: Export CSV & Print */}
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <button
              onClick={() => window.print()}
              className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all shadow-sm"
              title="Print Summary Report"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Print Report</span>
            </button>

            <button
              onClick={exportToCSV}
              className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/50"
              title="Download Full Leave & Permissions Report as CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV Report</span>
              <Download className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>

        {/* 5-Column Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Applications */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Applications</span>
              <FileText className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">{totalRequests}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {requests.filter((r) => r.request_type === 'LEAVE').length} Leaves •{' '}
                {requests.filter((r) => r.request_type === 'PERMISSION').length} Permissions
              </p>
            </div>
          </div>

          {/* Card 2: Approval Rate */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Approval Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-400">{approvalRate}%</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {approvedList.length} of {totalRequests} Approved
              </p>
            </div>
          </div>

          {/* Card 3: Rejection Rate */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Rejections</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-rose-400">{rejectedList.length}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {rejectionRate}% Declined Rate
              </p>
            </div>
          </div>

          {/* Card 4: Permission Hours Granted */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Permission Hours</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-amber-400">{totalPermissionHours.toFixed(1)} <span className="text-xs font-normal text-slate-400">hrs</span></div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Approved Short Absences
              </p>
            </div>
          </div>

          {/* Card 5: Total Leave Days Taken */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between text-sky-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Leave Days Taken</span>
              <Calendar className="w-4 h-4 text-sky-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-sky-400">{totalLeaveDays} <span className="text-xs font-normal text-slate-400">days</span></div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Full-Day Absences Covered
              </p>
            </div>
          </div>
        </div>

        {/* 2-Column Analytics Distribution Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Box 1: Classification & Type Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Request Type Distribution
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">{totalRequests} Total Records</span>
            </div>

            <div className="space-y-3 pt-1">
              {/* Casual Leave */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Casual Leave</span>
                  <span className="text-slate-400 font-mono">
                    {casualCount} ({totalRequests > 0 ? Math.round((casualCount / totalRequests) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalRequests > 0 ? (casualCount / totalRequests) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Sick Leave */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Sick Leave</span>
                  <span className="text-slate-400 font-mono">
                    {sickCount} ({totalRequests > 0 ? Math.round((sickCount / totalRequests) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalRequests > 0 ? (sickCount / totalRequests) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Annual Leave */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Annual Leave / Vacation</span>
                  <span className="text-slate-400 font-mono">
                    {annualCount} ({totalRequests > 0 ? Math.round((annualCount / totalRequests) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalRequests > 0 ? (annualCount / totalRequests) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Permissions */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Permissions / Hourly Outings</span>
                  <span className="text-slate-400 font-mono">
                    {permissionsCount} ({totalRequests > 0 ? Math.round((permissionsCount / totalRequests) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalRequests > 0 ? (permissionsCount / totalRequests) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Box 2: Department Utilization */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Building className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Department Utilization & Approval Velocity
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">{deptList.length} Departments</span>
            </div>

            <div className="space-y-3 pt-1">
              {deptList.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No department activity recorded.</p>
              ) : (
                deptList.map((dept) => {
                  const data = deptMap[dept];
                  const deptApprRate = data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0;
                  return (
                    <div key={dept} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">{dept}</span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {data.total} requests • <span className="text-emerald-400 font-semibold">{deptApprRate}% approved</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-teal-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${deptApprRate}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Audit Ledger Table Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden space-y-4 p-6">
          {/* Table Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Historical Audit Ledger</h3>
              <p className="text-xs text-slate-400">
                Showing {filteredReportRequests.length} of {requests.length} records. Filter and inspect all employee requests and approvals.
              </p>
            </div>

            {/* Filter Pills / Search */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  placeholder="Search name, ID, notes..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PENDING">Pending</option>
                <option value="ENQUIRY_REQUESTED">Under Enquiry</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              {/* Category Filter */}
              <select
                value={reportTypeFilter}
                onChange={(e) => setReportTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Categories</option>
                <option value="LEAVE">Leave Only</option>
                <option value="PERMISSION">Permission Only</option>
              </select>

              {/* Department Filter */}
              {deptList.length > 0 && (
                <select
                  value={reportDeptFilter}
                  onChange={(e) => setReportDeptFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Depts</option>
                  {deptList.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}

              {(reportSearch || reportStatusFilter !== 'ALL' || reportTypeFilter !== 'ALL' || reportDeptFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setReportSearch('');
                    setReportStatusFilter('ALL');
                    setReportTypeFilter('ALL');
                    setReportDeptFilter('ALL');
                  }}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-800/80 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Ref #</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Schedule & Duration</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Decision / Reviewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredReportRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No records match the selected report filters.
                    </td>
                  </tr>
                ) : (
                  filteredReportRequests.map((r) => {
                    const isPermission = r.request_type === 'PERMISSION';
                    return (
                      <tr key={r.id} className="hover:bg-slate-850/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          #{r.id}
                          <span className="block text-[10px] text-slate-500 font-sans">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">
                            {r.full_name || r.employee_name || 'Employee'}
                          </div>
                          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
                            <span className="text-emerald-400">{r.employee_id || r.employee_code || 'EMP'}</span>
                            <span>•</span>
                            <span>{r.department_name || 'General'}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isPermission
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                                : 'bg-brand-950/80 text-brand-300 border border-brand-800/80'
                            }`}
                          >
                            {r.leave_type}
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">{r.request_type}</span>
                        </td>

                        <td className="py-3 px-4 font-mono">
                          {isPermission ? (
                            <div>
                              <div className="text-slate-200">{r.start_date}</div>
                              <div className="text-[11px] text-amber-400">
                                {r.start_time} - {r.end_time} ({r.duration_hours || 0} hrs)
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-slate-200">
                                {r.start_date}
                                {r.end_date && r.end_date !== r.start_date && ` → ${r.end_date}`}
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <p className="line-clamp-2 text-slate-300">{r.reason}</p>
                          {r.employee_reply && (
                            <p className="text-[10px] text-amber-300/90 mt-1 italic">
                              Reply: {r.employee_reply}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              r.status === 'APPROVED'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                                : r.status === 'REJECTED'
                                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                                : r.status === 'ENQUIRY_REQUESTED'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                                : r.status === 'CANCELLED'
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-sky-950/80 text-sky-300 border border-sky-800/80'
                            }`}
                          >
                            {r.status === 'APPROVED' && <Check className="w-3 h-3 text-emerald-400" />}
                            {r.status === 'REJECTED' && <X className="w-3 h-3 text-rose-400" />}
                            {r.status === 'ENQUIRY_REQUESTED' && <HelpCircle className="w-3 h-3 text-amber-400" />}
                            <span>{r.status.replace('_', ' ')}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          {r.reviewer_name ? (
                            <div>
                              <span className="font-semibold text-slate-200">{r.reviewer_name}</span>
                              {r.admin_notes && (
                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 italic">
                                  "{r.admin_notes}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Pending Decision</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action Review Modal (Approve / Reject / Enquire) */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      activeModal.action === 'APPROVE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : activeModal.action === 'REJECT'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {activeModal.action === 'APPROVE' ? (
                      <Check className="w-5 h-5" />
                    ) : activeModal.action === 'REJECT' ? (
                      <X className="w-5 h-5" />
                    ) : (
                      <HelpCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {activeModal.action === 'APPROVE'
                        ? 'Approve Request'
                        : activeModal.action === 'REJECT'
                        ? 'Reject Request'
                        : 'Clarification Enquiry'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Request #{activeModal.request.id} for {activeModal.request.employee_name}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Request Details Preview */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                <p>
                  <span className="text-slate-500 font-semibold">Type:</span> {activeModal.request.request_type} •{' '}
                  {activeModal.request.leave_type}
                </p>
                <p>
                  <span className="text-slate-500 font-semibold">Duration:</span> {activeModal.request.start_date}
                  {activeModal.request.end_date !== activeModal.request.start_date &&
                    ` to ${activeModal.request.end_date}`}
                  {activeModal.request.start_time && ` (${activeModal.request.start_time} - ${activeModal.request.end_time})`}
                </p>
                <p>
                  <span className="text-slate-500 font-semibold">Reason:</span> {activeModal.request.reason}
                </p>
              </div>

              {/* Note / Enquiry Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {activeModal.action === 'APPROVE'
                    ? 'Approval Note (Optional):'
                    : activeModal.action === 'REJECT'
                    ? 'Rejection Reason (Required):'
                    : 'Enquiry / Question for Employee (Required):'}
                </label>
                <textarea
                  rows={3}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder={
                    activeModal.action === 'APPROVE'
                      ? 'e.g. Approved. Please coordinate handover.'
                      : activeModal.action === 'REJECT'
                      ? 'e.g. Critical deployment scheduled on this date.'
                      : 'e.g. Please provide doctor prescription or indicate who will cover your shift.'
                  }
                  className="w-full text-xs p-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleActionSubmit}
                  className={`px-4 py-2 text-xs font-bold rounded-xl text-white shadow-lg flex items-center space-x-1.5 transition-all disabled:opacity-50 ${
                    activeModal.action === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                      : activeModal.action === 'REJECT'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
                      : 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/40'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {actionLoading
                      ? 'Processing...'
                      : activeModal.action === 'APPROVE'
                      ? 'Confirm Approval'
                      : activeModal.action === 'REJECT'
                      ? 'Confirm Rejection'
                      : 'Send Enquiry'}
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaveManagement;
