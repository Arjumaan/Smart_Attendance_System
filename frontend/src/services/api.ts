import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  AttendanceLog,
  AttendanceResult,
  BiometricEnrollRequest,
  BiometricMatchResult,
  BiometricVerifyRequest,
  CheckInStatusResponse,
  DailySummary,
  Department,
  DepartmentCreate,
  FaceEmbeddingOut,
  LeaveActionPayload,
  LeaveCreatePayload,
  LeaveRequest,
  ManualAttendanceCreate,
  PersonalAttendanceSummary,
  ReportFilterParams,
  Token,
  User,
  UserCreate,
  UserLogin,
  UserUpdate,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to automatically add Authorization token
    this.client.interceptors.request.use(
      (config) => {
        // Is this an employee-portal specific page/request?
        const isEmployeeContext =
          typeof window !== 'undefined' &&
          (window.location.pathname.startsWith('/employee') ||
            window.location.pathname.startsWith('/emp_login'));

        const empToken = localStorage.getItem('sat_employee_token');
        const adminToken = localStorage.getItem('sat_token') || localStorage.getItem('access_token');

        const activeToken = isEmployeeContext
          ? empToken || adminToken
          : adminToken || empToken;

        if (activeToken && config.headers) {
          config.headers.Authorization = `Bearer ${activeToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to catch 401 and handle token expiry
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.warn('API returned 401 Unauthorized.');
        }
        return Promise.reject(error);
      }
    );
  }

  // --- Auth Endpoints ---
  async login(credentials: UserLogin, isEmployeePortal: boolean = false): Promise<Token> {
    const response: AxiosResponse<Token> = await this.client.post('/auth/login', credentials);
    if (response.data.access_token) {
      if (isEmployeePortal || response.data.role === 'EMPLOYEE') {
        localStorage.setItem('sat_employee_token', response.data.access_token);
        localStorage.setItem('sat_employee_user', JSON.stringify(response.data));
      } else {
        localStorage.setItem('sat_token', response.data.access_token);
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('sat_user', JSON.stringify(response.data));
      }
    }
    return response.data;
  }

  async getMe(): Promise<User> {
    const response: AxiosResponse<User> = await this.client.get('/auth/me');
    return response.data;
  }

  logout(): void {
    localStorage.removeItem('sat_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('sat_user');
  }

  logoutEmployee(): void {
    localStorage.removeItem('sat_employee_token');
    localStorage.removeItem('sat_employee_user');
  }

  getToken(): string | null {
    const isEmployeeContext =
      typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/employee') ||
        window.location.pathname.startsWith('/emp_login'));

    if (isEmployeeContext) {
      return localStorage.getItem('sat_employee_token') || localStorage.getItem('sat_token');
    }
    return localStorage.getItem('sat_token') || localStorage.getItem('access_token');
  }

  getEmployeeToken(): string | null {
    return localStorage.getItem('sat_employee_token');
  }

  setEmployeeToken(token: string | null): void {
    if (token) {
      localStorage.setItem('sat_employee_token', token);
    } else {
      localStorage.removeItem('sat_employee_token');
    }
  }

  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem('sat_token', token);
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('sat_token');
      localStorage.removeItem('access_token');
    }
  }

  // --- Employees CRUD ---
  async listEmployees(params?: {
    department_id?: number;
    search?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<User[]> {
    const response: AxiosResponse<User[]> = await this.client.get('/employees/', { params });
    return response.data;
  }

  async createEmployee(data: UserCreate): Promise<User> {
    const response: AxiosResponse<User> = await this.client.post('/employees/', data);
    return response.data;
  }

  async getEmployee(id: string | number): Promise<User> {
    const response: AxiosResponse<User> = await this.client.get(`/employees/${id}`);
    return response.data;
  }

  async updateEmployee(id: string | number, data: UserUpdate): Promise<User> {
    const response: AxiosResponse<User> = await this.client.put(`/employees/${id}`, data);
    return response.data;
  }

  async deleteEmployee(id: string | number): Promise<void> {
    await this.client.delete(`/employees/${id}`);
  }

  // --- Departments CRUD ---
  async listDepartments(): Promise<Department[]> {
    const response: AxiosResponse<Department[]> = await this.client.get('/departments/');
    return response.data;
  }

  async createDepartment(data: DepartmentCreate): Promise<Department> {
    const response: AxiosResponse<Department> = await this.client.post('/departments/', data);
    return response.data;
  }

  async getDepartment(id: number): Promise<Department> {
    const response: AxiosResponse<Department> = await this.client.get(`/departments/${id}`);
    return response.data;
  }

  async updateDepartment(id: number, data: DepartmentCreate): Promise<Department> {
    const response: AxiosResponse<Department> = await this.client.put(`/departments/${id}`, data);
    return response.data;
  }

  async deleteDepartment(id: number): Promise<void> {
    await this.client.delete(`/departments/${id}`);
  }

  // --- Biometrics Endpoints ---
  async enrollFace(data: BiometricEnrollRequest): Promise<FaceEmbeddingOut> {
    const response: AxiosResponse<FaceEmbeddingOut> = await this.client.post('/biometrics/enroll', data);
    return response.data;
  }

  async recognizeFace(data: BiometricVerifyRequest): Promise<BiometricMatchResult> {
    const response: AxiosResponse<BiometricMatchResult> = await this.client.post('/biometrics/recognize', data);
    return response.data;
  }

  // --- Attendance Endpoints ---
  async getAttendanceLogs(params?: {
    start_date?: string;
    end_date?: string;
    department_id?: number;
    employee_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<AttendanceLog[]> {
    const response: AxiosResponse<AttendanceLog[]> = await this.client.get('/attendance/logs', { params });
    return response.data;
  }

  async getDailySummary(targetDate?: string): Promise<DailySummary> {
    const params = targetDate ? { target_date: targetDate } : undefined;
    const response: AxiosResponse<DailySummary> = await this.client.get('/attendance/summary', { params });
    return response.data;
  }

  async getEmployeeStatus(employeeId: string, targetDate?: string): Promise<CheckInStatusResponse> {
    const params = targetDate ? { target_date: targetDate } : undefined;
    const response: AxiosResponse<CheckInStatusResponse> = await this.client.get(
      `/attendance/status/${encodeURIComponent(employeeId)}`,
      { params }
    );
    return response.data;
  }

  async recordAttendanceEvent(data: {
    employee_id: string;
    timestamp?: string;
    source?: string;
  }): Promise<AttendanceResult> {
    const response: AxiosResponse<AttendanceResult> = await this.client.post('/attendance/events', data);
    return response.data;
  }

  async getTodayPresenceFeed(targetDate?: string): Promise<AttendanceResult[]> {
    const params = targetDate ? { target_date: targetDate } : undefined;
    const response: AxiosResponse<AttendanceResult[]> = await this.client.get('/attendance/live-feed', { params });
    return response.data;
  }

  async markManualAttendance(data: ManualAttendanceCreate): Promise<AttendanceLog> {
    const response: AxiosResponse<AttendanceLog> = await this.client.post('/attendance/mark', data);
    return response.data;
  }

  // --- Reports & Export Endpoints ---
  async exportReport(params: ReportFilterParams): Promise<{ blob: Blob; filename: string }> {
    const format = params.format || 'csv';
    const response = await this.client.get('/reports/export', {
      params: {
        format,
        start_date: params.start_date,
        end_date: params.end_date,
        department_id: params.department_id,
        employee_id: params.employee_id,
        status: params.status,
      },
      responseType: 'blob',
    });

    let filename = `attendance_report_${new Date().toISOString().slice(0, 10)}.${format}`;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
    return {
      blob: new Blob([response.data], { type: contentType }),
      filename,
    };
  }

  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  // --- Employee Self-Service & Personal Attendance ---
  async getMyAttendance(params?: {
    employee_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; logs: AttendanceLog[] }> {
    const response = await this.client.get('/attendance/my-attendance', { params });
    const raw = response.data;
    const items: AttendanceLog[] = Array.isArray(raw) ? raw : (raw?.logs || []);
    const totalCount: number = Array.isArray(raw) ? raw.length : (raw?.total ?? items.length);
    return {
      total: totalCount,
      logs: items,
    };
  }

  async getMyAttendanceSummary(params?: { employee_id?: string }): Promise<PersonalAttendanceSummary> {
    const response: AxiosResponse<PersonalAttendanceSummary> = await this.client.get('/attendance/my-summary', { params });
    return response.data;
  }

  // --- Leaves & Permissions Endpoints ---
  async submitLeaveRequest(data: LeaveCreatePayload): Promise<LeaveRequest> {
    const response: AxiosResponse<LeaveRequest> = await this.client.post('/leaves/', data);
    return response.data;
  }

  async getMyLeaveRequests(params?: { employee_id?: string }): Promise<LeaveRequest[]> {
    const response: AxiosResponse<LeaveRequest[]> = await this.client.get('/leaves/my-requests', { params });
    return response.data;
  }

  async replyLeaveEnquiry(requestId: number, reply: string): Promise<LeaveRequest> {
    const response: AxiosResponse<LeaveRequest> = await this.client.put(
      `/leaves/my-requests/${requestId}/reply`,
      { reply }
    );
    return response.data;
  }

  async cancelLeaveRequest(requestId: number): Promise<LeaveRequest> {
    const response: AxiosResponse<LeaveRequest> = await this.client.post(
      `/leaves/my-requests/${requestId}/cancel`
    );
    return response.data;
  }

  async getAllLeaveRequests(params?: {
    status?: string;
    request_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; requests: LeaveRequest[] }> {
    const response = await this.client.get('/leaves/', { params });
    const raw = response.data;
    const items: LeaveRequest[] = Array.isArray(raw) ? raw : (raw?.requests || []);
    const totalCount: number = Array.isArray(raw) ? raw.length : (raw?.total ?? items.length);
    return {
      total: totalCount,
      requests: items,
    };
  }

  async getPendingLeaveCount(): Promise<{ pending_count: number; enquiry_count: number; total_actionable: number }> {
    const response = await this.client.get('/leaves/pending-count');
    const data = response.data || {};
    const pending = typeof data.pending_count === 'number' ? data.pending_count : 0;
    const enquiry = typeof data.enquiry_count === 'number' ? data.enquiry_count : 0;
    const total = typeof data.total_actionable === 'number' ? data.total_actionable : (pending + enquiry);
    return {
      pending_count: pending,
      enquiry_count: enquiry,
      total_actionable: total,
    };
  }

  async reviewLeaveRequest(requestId: number, data: LeaveActionPayload): Promise<LeaveRequest> {
    const response: AxiosResponse<LeaveRequest> = await this.client.post(`/leaves/${requestId}/action`, data);
    return response.data;
  }
}

export const api = new ApiClient();
export default api;
