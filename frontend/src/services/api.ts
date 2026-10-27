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
  ManualAttendanceCreate,
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
        const token = localStorage.getItem('sat_token') || localStorage.getItem('access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
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
  async login(credentials: UserLogin): Promise<Token> {
    const response: AxiosResponse<Token> = await this.client.post('/auth/login', credentials);
    if (response.data.access_token) {
      localStorage.setItem('sat_token', response.data.access_token);
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('sat_user', JSON.stringify(response.data));
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

  getToken(): string | null {
    return localStorage.getItem('sat_token') || localStorage.getItem('access_token');
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
}

export const api = new ApiClient();
export default api;
