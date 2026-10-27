import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  User as UserIcon,
  Shield,
  FileText,
  MessageSquare,
  RefreshCw,
  PlusCircle,
  XCircle,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';
import api from '../services/api';
import {
  AttendanceLog,
  LeaveCreatePayload,
  LeaveRequest,
  LeaveRequestType,
  LeaveType,
  PersonalAttendanceSummary,
  User,
} from '../types';

interface EmployeePortalProps {
  currentUser: User;
  onNotify: (toast: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }) => void;
}

export const EmployeePortal: React.FC<EmployeePortalProps> = ({ currentUser, onNotify }) => {
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'requests' | 'apply'>('attendance');

  // Summary State
  const [summary, setSummary] = useState<PersonalAttendanceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true);

  // Attendance History State
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Leaves & Permissions State
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState<boolean>(false);

  // Leave Form State
  const [requestType, setRequestType] = useState<LeaveRequestType>('LEAVE');
  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL');
  const [reqStartDate, setReqStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reqEndDate, setReqEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reqStartTime, setReqStartTime] = useState<string>('09:00');
  const [reqEndTime, setReqEndTime] = useState<string>('11:00');
  const [reqReason, setReqReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Enquiry Reply State
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [replySubmitting, setReplySubmitting] = useState<boolean>(false);

  // Load Personal Summary
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await api.getMyAttendanceSummary({
        employee_id: currentUser.employee_id,
      });
      setSummary(data);
    } catch (err: unknown) {
      console.error('Failed to load personal attendance summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [currentUser.employee_id]);

  // Load Personal Logs
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await api.getMyAttendance({
        employee_id: currentUser.employee_id,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      const items = Array.isArray(data) ? data : (data?.logs || []);
      setLogs(items);
      setTotalLogs(Array.isArray(data) ? data.length : (data?.total ?? items.length));
    } catch (err: unknown) {
      console.error('Failed to load my attendance:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [currentUser.employee_id, startDate, endDate]);

  // Load My Leave Requests
  const fetchMyRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const data = await api.getMyLeaveRequests({
        employee_id: currentUser.employee_id,
      });
      setMyRequests(data || []);
    } catch (err: unknown) {
      console.error('Failed to load my leave requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  }, [currentUser.employee_id]);

  useEffect(() => {
    fetchSummary();
    fetchLogs();
    fetchMyRequests();
  }, [fetchSummary, fetchLogs, fetchMyRequests]);

  // Handle Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqReason.trim()) {
      onNotify({
        type: 'warning',
        title: 'Reason Required',
        message: 'Please provide a clear justification for your request.',
      });
      return;
    }

    if (requestType === 'LEAVE' && reqEndDate < reqStartDate) {
      onNotify({
        type: 'error',
        title: 'Invalid Dates',
        message: 'End date cannot be earlier than start date.',
      });
      return;
    }

    let calculatedHours: number | undefined = undefined;
    if (requestType === 'PERMISSION') {
      const [sh, sm] = reqStartTime.split(':').map(Number);
      const [eh, em] = reqEndTime.split(':').map(Number);
      const diff = eh * 60 + em - (sh * 60 + sm);
      if (diff <= 0) {
        onNotify({
          type: 'error',
          title: 'Invalid Time Range',
          message: 'Permission end time must be later than start time.',
        });
        return;
      }
      calculatedHours = parseFloat((diff / 60).toFixed(2));
    }

    setSubmitting(true);
    try {
      const payload: LeaveCreatePayload = {
        request_type: requestType,
        leave_type: requestType === 'PERMISSION' ? 'PERMISSION' : leaveType,
        start_date: reqStartDate,
        end_date: requestType === 'LEAVE' ? reqEndDate : reqStartDate,
        start_time: requestType === 'PERMISSION' ? reqStartTime : undefined,
        end_time: requestType === 'PERMISSION' ? reqEndTime : undefined,
        duration_hours: calculatedHours,
        reason: reqReason.trim(),
      };

      await api.submitLeaveRequest(payload);
      onNotify({
        type: 'success',
        title: 'Request Submitted',
        message: `Your ${requestType.toLowerCase()} request has been sent to Management for review.`,
      });

      // Reset form & reload
      setReqReason('');
      setActiveSubTab('requests');
      fetchMyRequests();
      fetchSummary();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        'Failed to submit leave request.';
      onNotify({
        type: 'error',
        title: 'Submission Failed',
        message: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Reply to Enquiry
  const handleReplySubmit = async (requestId: number) => {
    if (!replyText.trim()) {
      onNotify({
        type: 'warning',
        title: 'Response Required',
        message: 'Please enter your clarification message before replying.',
      });
      return;
    }

    setReplySubmitting(true);
    try {
      await api.replyLeaveEnquiry(requestId, replyText.trim());
      onNotify({
        type: 'success',
        title: 'Enquiry Clarification Sent',
        message: 'Your reply has been forwarded back to Management for final determination.',
      });
      setReplyingId(null);
      setReplyText('');
      fetchMyRequests();
      fetchSummary();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        'Failed to send clarification.';
      onNotify({
        type: 'error',
        title: 'Error',
        message: msg,
      });
    } finally {
      setReplySubmitting(false);
    }
  };

  // Handle Cancel Request
  const handleCancelRequest = async (requestId: number) => {
    try {
      await api.cancelLeaveRequest(requestId);
      onNotify({
        type: 'info',
        title: 'Request Cancelled',
        message: 'Your application has been withdrawn.',
      });
      fetchMyRequests();
      fetchSummary();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        'Failed to cancel request.';
      onNotify({
        type: 'error',
        title: 'Error',
        message: msg,
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Top Banner: Employee Profile & Status */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-xl shadow-emerald-950/40">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">{currentUser.full_name}</h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-full">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Employee ID: <span className="text-slate-200 font-semibold">{currentUser.employee_id}</span>
                {currentUser.department?.name && (
                  <>
                    {' '}• Department: <span className="text-slate-200">{currentUser.department.name}</span>
                  </>
                )}
                {' '}• Shift: <span className="text-emerald-400">{currentUser.shift_start || '09:00:00'}</span>
              </p>
            </div>
          </div>

          {/* Today's Presence Live Indicator */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">Today's Presence</p>
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    summary?.today_status === 'PRESENT'
                      ? 'bg-emerald-400 animate-pulse'
                      : summary?.today_status === 'LATE'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-400'
                  }`}
                />
                <span className="text-sm font-bold text-white tracking-wide">
                  {summary?.today_status || 'NOT RECORDED'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                In: {summary?.today_check_in || '—'} • Out: {summary?.today_check_out || '—'}
              </p>
            </div>
            <button
              onClick={() => {
                fetchSummary();
                fetchLogs();
                fetchMyRequests();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-700/60 transition-colors"
              title="Refresh My Portal"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase font-medium text-slate-400">On-Time Rate</p>
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">
              {summaryLoading ? '...' : `${summary?.on_time_rate ?? summary?.attendance_rate ?? 100}%`}
            </p>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase font-medium text-slate-400">Days Present</p>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-white mt-1 font-mono">
              {summaryLoading ? '...' : summary?.present_days ?? summary?.total_days ?? 0}
            </p>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase font-medium text-slate-400">Total Hours</p>
              <TrendingUp className="w-4 h-4 text-teal-400" />
            </div>
            <p className="text-xl font-bold text-white mt-1 font-mono">
              {summaryLoading ? '...' : `${summary?.total_hours_worked ?? summary?.total_hours ?? 0}h`}
            </p>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase font-medium text-slate-400">Pending Requests</p>
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xl font-bold text-amber-400 mt-1 font-mono">
              {summaryLoading ? '...' : summary?.pending_leaves_count ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('attendance')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'attendance'
              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 shadow-md shadow-emerald-950/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>My Attendance History</span>
        </button>

        <button
          onClick={() => setActiveSubTab('requests')}
          className={`relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'requests'
              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 shadow-md shadow-emerald-950/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Leave & Permissions</span>
          {myRequests.some((r) => r.status === 'ENQUIRY_REQUESTED') && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('apply')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'apply'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
              : 'text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 hover:bg-emerald-950/60'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Apply Leave / Permission</span>
        </button>
      </div>

      {/* Subtab Content Area */}
      <div>
        {/* VIEW 1: MY ATTENDANCE HISTORY */}
        {activeSubTab === 'attendance' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <span className="text-xs font-semibold text-slate-300">Date Range:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
                <span className="text-xs text-slate-400 font-mono">
                  Showing {logs.length} record{logs.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Check-In</th>
                      <th className="py-3.5 px-4">Check-Out</th>
                      <th className="py-3.5 px-4">Work Duration</th>
                      <th className="py-3.5 px-4">Presence Status</th>
                      <th className="py-3.5 px-4">Punctuality</th>
                      <th className="py-3.5 px-4">Log Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {logsLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Loading attendance records...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                          No attendance records found for this period.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => {
                        const inTime = log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString() : '—';
                        const outTime = log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString() : '—';
                        const isLate = log.is_late;
                        const status = log.status || (isLate ? 'LATE' : 'PRESENT');

                        return (
                          <tr key={log.id} className="hover:bg-slate-850/60 transition-colors">
                            <td className="py-3 px-4 font-semibold text-white">{log.date}</td>
                            <td className="py-3 px-4 text-emerald-400">{inTime}</td>
                            <td className="py-3 px-4 text-slate-300">{outTime}</td>
                            <td className="py-3 px-4 text-slate-300">
                              {log.total_hours !== null && log.total_hours !== undefined
                                ? `${log.total_hours.toFixed(2)} hrs`
                                : 'In Progress'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${
                                  status === 'PRESENT'
                                    ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-400'
                                    : status === 'LATE'
                                    ? 'bg-amber-950/70 border-amber-800/80 text-amber-400'
                                    : status === 'ON_LEAVE'
                                    ? 'bg-sky-950/70 border-sky-700/80 text-sky-300'
                                    : status === 'HALF_DAY'
                                    ? 'bg-sky-950/70 border-sky-800/80 text-sky-400'
                                    : 'bg-rose-950/70 border-rose-800/80 text-rose-400'
                                }`}
                              >
                                {status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {status === 'ON_LEAVE' ? (
                                <span className="text-sky-400 font-semibold text-[11px]">Excused (Leave)</span>
                              ) : isLate ? (
                                <span className="text-amber-400 font-semibold text-[11px]">Late Check-In</span>
                              ) : (
                                <span className="text-emerald-400 font-semibold text-[11px]">On Time</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-400 uppercase text-[10px] tracking-wider">
                              {log.source || 'BIOMETRIC'}
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
        )}

        {/* VIEW 2: MY LEAVE & PERMISSION REQUESTS */}
        {activeSubTab === 'requests' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Leave & Permission History</h3>
                <p className="text-xs text-slate-400">
                  Track the status of your applications and answer clarification enquiries directly.
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab('apply')}
                className="flex items-center space-x-2 text-xs font-semibold px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-950/40 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Application</span>
              </button>
            </div>

            {requestsLoading ? (
              <div className="py-12 text-center text-slate-500 font-mono text-xs">Loading requests...</div>
            ) : myRequests.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                <FileText className="w-10 h-10 mx-auto text-slate-600" />
                <h4 className="text-sm font-bold text-white">No requests submitted yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Need time off or early leave for personal or medical reasons? Submit an application anytime.
                </p>
                <button
                  onClick={() => setActiveSubTab('apply')}
                  className="mt-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-4 py-2 rounded-xl hover:bg-emerald-900/60 transition-colors"
                >
                  Create Application
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myRequests.map((req) => {
                  const isEnquiry = req.status === 'ENQUIRY_REQUESTED';
                  const isPending = req.status === 'PENDING';
                  const isApproved = req.status === 'APPROVED';
                  const isRejected = req.status === 'REJECTED';
                  const isCancelled = req.status === 'CANCELLED';

                  return (
                    <div
                      key={req.id}
                      className={`relative rounded-2xl border p-5 space-y-4 transition-all shadow-xl ${
                        isEnquiry
                          ? 'bg-amber-950/20 border-amber-500/50 shadow-amber-950/20 ring-1 ring-amber-500/30'
                          : isApproved
                          ? 'bg-slate-900/80 border-emerald-800/60'
                          : isRejected
                          ? 'bg-slate-900/80 border-rose-800/60'
                          : isCancelled
                          ? 'bg-slate-900/40 border-slate-800/60 opacity-70'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              {req.request_type} • {req.leave_type}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">#{req.id}</span>
                          </div>
                          <p className="text-xs text-slate-300 font-mono mt-0.5">
                            {req.start_date}
                            {req.end_date && req.end_date !== req.start_date && ` to ${req.end_date}`}
                            {req.start_time && ` (${req.start_time} - ${req.end_time || '—'})`}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center space-x-1 ${
                            isApproved
                              ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
                              : isRejected
                              ? 'bg-rose-950 border-rose-700 text-rose-400'
                              : isEnquiry
                              ? 'bg-amber-950 border-amber-600 text-amber-300 animate-pulse'
                              : isCancelled
                              ? 'bg-slate-900 border-slate-700 text-slate-500'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {isApproved && <CheckCircle2 className="w-3 h-3" />}
                          {isRejected && <XCircle className="w-3 h-3" />}
                          {isEnquiry && <HelpCircle className="w-3 h-3" />}
                          {isCancelled && <XCircle className="w-3 h-3 text-slate-500" />}
                          {isPending && <Clock className="w-3 h-3" />}
                          <span>{req.status.replace('_', ' ')}</span>
                        </span>
                      </div>

                      {/* Reason */}
                      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300">
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">My Reason:</span>
                        <p className="mt-0.5 leading-relaxed">{req.reason}</p>
                      </div>

                      {/* Admin Notes / Reviewer determination */}
                      {req.admin_notes && (
                        <div
                          className={`p-3 rounded-xl border text-xs space-y-1 ${
                            isEnquiry
                              ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                              : isRejected
                              ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                              : 'bg-slate-950/40 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 font-semibold text-[11px]">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>
                              {isEnquiry ? 'Management Enquiry / Clarification Request:' : 'Management Note:'}
                            </span>
                          </div>
                          <p className="leading-relaxed pl-5">{req.admin_notes}</p>
                        </div>
                      )}

                      {/* Employee's previous reply if present */}
                      {req.employee_reply && (
                        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
                          <span className="text-emerald-400 font-semibold block text-[10px] uppercase">
                            My Clarification Sent:
                          </span>
                          <p className="mt-0.5 leading-relaxed">{req.employee_reply}</p>
                        </div>
                      )}

                      {/* Inline Reply Box for ENQUIRY_REQUESTED */}
                      {isEnquiry && (
                        <div className="pt-2 border-t border-amber-500/30 space-y-2">
                          {replyingId === req.id ? (
                            <div className="space-y-2 animate-fade-in">
                              <textarea
                                rows={2}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Type your response to HR's enquiry..."
                                className="w-full text-xs p-2.5 bg-slate-950 border border-amber-500/50 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingId(null);
                                    setReplyText('');
                                  }}
                                  className="px-3 py-1 text-xs text-slate-400 hover:text-white rounded-lg"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={replySubmitting}
                                  onClick={() => handleReplySubmit(req.id)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>{replySubmitting ? 'Sending...' : 'Send Clarification'}</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingId(req.id);
                                setReplyText('');
                              }}
                              className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Reply to Management Enquiry</span>
                            </button>
                          )}
                        </div>
                      )}
                      {/* Action Bar for Pending/Enquiry items: Allow Withdrawal */}
                      {(isPending || isEnquiry) && (
                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(req.id)}
                            className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors flex items-center space-x-1"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Withdraw Application</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: APPLY LEAVE / PERMISSION FORM */}
        {activeSubTab === 'apply' && (
          <div className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Submit Leave or Permission Request</h3>
              <p className="text-xs text-slate-400 mt-1">
                Requests are routed in real-time to your Administrator and HR management.
              </p>
            </div>

            {/* Toggle Request Type: Full Leave vs Short Permission */}
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setRequestType('LEAVE')}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                  requestType === 'LEAVE'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Full / Multi-Day Leave
              </button>
              <button
                type="button"
                onClick={() => setRequestType('PERMISSION')}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                  requestType === 'PERMISSION'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Short Permission (Hours)
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-5">
              {/* If Request is LEAVE, show Category */}
              {requestType === 'LEAVE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Leave Classification</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CASUAL">Casual Leave (Personal / Urgent Work)</option>
                    <option value="SICK">Medical / Sick Leave</option>
                    <option value="ANNUAL">Annual / Paid Vacation</option>
                    <option value="EMERGENCY">Emergency Leave</option>
                  </select>
                </div>
              )}

              {/* Dates Selection */}
              {requestType === 'LEAVE' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Start Date</label>
                    <input
                      type="date"
                      required
                      value={reqStartDate}
                      onChange={(e) => setReqStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">End Date</label>
                    <input
                      type="date"
                      required
                      value={reqEndDate}
                      onChange={(e) => setReqEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                /* Permission Date & Times */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Permission Date</label>
                    <input
                      type="date"
                      required
                      value={reqStartDate}
                      onChange={(e) => setReqStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">From Time</label>
                      <input
                        type="time"
                        required
                        value={reqStartTime}
                        onChange={(e) => setReqStartTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">To Time</label>
                      <input
                        type="time"
                        required
                        value={reqEndTime}
                        onChange={(e) => setReqEndTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Justification / Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reason & Purpose of Request
                </label>
                <textarea
                  required
                  rows={3}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="Detail the reason for your leave/permission..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('requests')}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/40 flex items-center space-x-2 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Submitting Application...' : 'Send Request to Management'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeePortal;
