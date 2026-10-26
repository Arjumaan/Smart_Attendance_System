export type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  employee_id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  department_id?: number;
  department?: Department;
  created_at: string;
  has_biometrics?: boolean;
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  date: string;
  check_in?: string;
  check_out?: string;
  status: AttendanceStatus;
  check_in_confidence?: number;
  check_out_confidence?: number;
  liveness_score?: number;
  duration_minutes?: number;
  is_overtime: boolean;
  manual_override: boolean;
  notes?: string;
  user?: User;
}

export interface VerificationResult {
  matched: boolean;
  employee_id?: string;
  full_name?: string;
  department?: string;
  role?: UserRole;
  action?: 'CHECK_IN' | 'CHECK_OUT';
  status?: AttendanceStatus;
  timestamp?: string;
  confidence?: number;
  liveness_score?: number;
  duration_minutes?: number;
  message: string;
  cooldown_remaining?: number;
}

export interface DashboardStats {
  total_employees: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  attendance_rate: number;
  on_time_rate: number;
  recent_logs: AttendanceRecord[];
  department_breakdown: { department: string; count: number; present: number }[];
  weekly_trend: { date: string; present: number; late: number }[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
