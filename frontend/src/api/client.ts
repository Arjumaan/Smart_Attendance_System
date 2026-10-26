import { User, Department, AttendanceRecord, VerificationResult, DashboardStats, LoginResponse } from './types';

const API_BASE = '/api/v1';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('access_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
      // Optional redirect or event
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Network error occurred' }));
      throw new Error(err.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Authentication
  async login(formData: FormData): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Authentication failed' }));
      throw new Error(err.detail || 'Login failed');
    }
    const data: LoginResponse = await response.json();
    this.setToken(data.access_token);
    return data;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // Biometrics & Live Recognition
  async verifyBiometric(base64Image: string, location = 'Main Entrance Kiosk'): Promise<VerificationResult> {
    return this.request<VerificationResult>('/biometrics/verify', {
      method: 'POST',
      body: JSON.stringify({
        image_base64: base64Image,
        device_location: location,
      }),
    });
  }

  async enrollBiometric(employeeId: string, images: string[]): Promise<{ message: string; enrolled_at: string }> {
    return this.request<{ message: string; enrolled_at: string }>('/biometrics/enroll', {
      method: 'POST',
      body: JSON.stringify({
        employee_id: employeeId,
        face_images: images,
      }),
    });
  }

  // Attendance
  async getAttendanceRecords(params: {
    user_id?: number;
    department_id?: number;
    start_date?: string;
    end_date?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ total: number; records: AttendanceRecord[] }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    return this.request<{ total: number; records: AttendanceRecord[] }>(`/attendance/?${query.toString()}`);
  }

  async manualOverride(recordId: number, payload: { status?: string; notes?: string; check_in?: string; check_out?: string }): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>(`/attendance/${recordId}/override`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Employees & Departments
  async getEmployees(): Promise<User[]> {
    return this.request<User[]>('/employees/');
  }

  async createEmployee(payload: {
    email: string;
    password?: string;
    employee_id: string;
    full_name: string;
    role: string;
    department_id?: number;
  }): Promise<User> {
    return this.request<User>('/employees/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getDepartments(): Promise<Department[]> {
    return this.request<Department[]>('/departments/');
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/attendance/stats/dashboard');
  }

  // Reports Export
  getExportUrl(format: 'csv' | 'excel' | 'pdf', params: Record<string, string> = {}): string {
    const query = new URLSearchParams(params);
    if (this.token) {
      query.append('token', this.token);
    }
    return `${API_BASE}/reports/export/${format}?${query.toString()}`;
  }
}

export const api = new ApiClient();
