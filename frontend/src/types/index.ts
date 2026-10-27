/**
 * TypeScript Data Models matching Backend Schemas
 */

export type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  created_at?: string;
}

export interface DepartmentCreate {
  name: string;
  code: string;
  description?: string;
}

export interface User {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  role: UserRole | string;
  department_id?: number | null;
  department?: Department | null;
  is_active: boolean;
  shift_start: string;
  has_face_enrolled: boolean;
  created_at: string;
}

export interface UserCreate {
  employee_id: string;
  full_name: string;
  email: string;
  password: string;
  role?: string;
  department_id?: number | null;
  is_active?: boolean;
  shift_start?: string;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  role?: string;
  department_id?: number | null;
  is_active?: boolean;
  shift_start?: string;
  password?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  role: string;
  employee_id: string;
  user_id: number;
  full_name: string;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';

export type AttendanceEventResult =
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'COOLDOWN_IGNORED'
  | 'UNRECOGNIZED';

export interface AttendanceResult {
  event_result: AttendanceEventResult;
  message: string;
  status: string;
  is_late: boolean;
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_hours?: number | null;
  duration_hours?: number | null;
  employee_id: string;
  full_name: string;
}

export interface AttendanceLog {
  id: number;
  user_id: number;
  employee_id?: string | null;
  full_name?: string | null;
  department_name?: string | null;
  date: string;
  check_in_time: string;
  check_out_time?: string | null;
  total_hours?: number | null;
  status: string;
  is_late: boolean;
  source: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepartmentSummary {
  department_id?: number | null;
  department_name: string;
  department_code: string;
  total_employees: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_rate: number;
}

export interface DailySummary {
  date: string;
  total_employees: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_rate: number;
  department_stats: DepartmentSummary[];
}

export interface CheckInStatusResponse {
  employee_id: string;
  full_name: string;
  date: string;
  is_checked_in: boolean;
  is_checked_out: boolean;
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_hours?: number | null;
  status: string;
  is_late: boolean;
}

export interface ManualAttendanceCreate {
  employee_id: string;
  date: string;
  check_in_time: string;
  check_out_time?: string | null;
  status?: string;
  is_late?: boolean;
  notes?: string;
}

export interface BiometricEnrollRequest {
  employee_id: string;
  image_base64?: string;
  embedding?: number[];
}

export interface BiometricVerifyRequest {
  image_base64?: string;
  embedding?: number[];
}

export interface BiometricMatchResult {
  matched: boolean;
  user_id?: number | null;
  employee_id?: string | null;
  full_name?: string | null;
  similarity_score: number;
  threshold: number;
  liveness_verified: boolean;
  message?: string | null;
  attendance?: AttendanceResult | null;
}

export interface FaceEmbeddingOut {
  id: number;
  user_id: number;
  embedding_version: string;
  created_at: string;
  updated_at: string;
}

export interface ReportFilterParams {
  format?: 'csv' | 'xlsx' | 'pdf';
  start_date?: string;
  end_date?: string;
  department_id?: number;
  employee_id?: string;
  status?: string;
}

export type ToastNotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ToastNotification {
  id: string;
  type: ToastNotificationType;
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

export type TabType = 'kiosk' | 'dashboard' | 'employees' | 'reports' | 'leaves' | 'my-portal';

// --- Leave & Permission Types ---
export type LeaveRequestType = 'LEAVE' | 'PERMISSION';
export type LeaveType = 'CASUAL' | 'SICK' | 'ANNUAL' | 'EMERGENCY' | 'PERMISSION';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ENQUIRY_REQUESTED' | 'CANCELLED';

export interface LeaveRequest {
  id: number;
  user_id: number;
  request_type: LeaveRequestType;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_hours?: number | null;
  reason: string;
  status: LeaveStatus;
  reviewer_id?: number | null;
  admin_notes?: string | null;
  employee_reply?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string | null;
  employee_code?: string | null;
  full_name?: string | null;
  employee_id?: string | null;
  department_name?: string | null;
  reviewer_name?: string | null;
}

export interface LeaveCreatePayload {
  request_type: LeaveRequestType;
  leave_type: LeaveType;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  duration_hours?: number;
  reason: string;
}

export interface LeaveActionPayload {
  action: 'APPROVE' | 'REJECT' | 'ENQUIRE';
  admin_notes?: string;
}

export interface LeaveEnquiryReplyPayload {
  reply: string;
}

export interface PersonalAttendanceSummary {
  employee_id: string;
  full_name: string;
  department?: string | null;
  shift_start: string;
  total_days_logged: number;
  total_days?: number;
  present_days: number;
  late_days: number;
  absent_days: number;
  total_hours_worked: number;
  total_hours?: number;
  on_time_rate: number;
  attendance_rate?: number;
  today_status: string;
  today_check_in?: string | null;
  today_check_out?: string | null;
  pending_leaves_count: number;
}

export interface LeaveEventPayload {
  action: string;
  leave: LeaveRequest;
}
