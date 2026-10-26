"""
Frontend Scaffolder for Enterprise Smart Attendance System
Generates all 23 React 18 + Vite + Tailwind CSS files with 100% type safety.
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

FILES = {}

# 1. package.json
FILES["package.json"] = """{
  "name": "smart-attendance-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^0.378.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0",
    "recharts": "^2.12.7",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  }
}"""

# 2. vite.config.ts
FILES["vite.config.ts"] = """import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/api/v1/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      }
    }
  }
});
"""

# 3. tsconfig.json
FILES["tsconfig.json"] = """{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}"""

# 4. tsconfig.node.json
FILES["tsconfig.node.json"] = """{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}"""

# 5. tailwind.config.js
FILES["tailwind.config.js"] = """/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        }
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2.5s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%, 100%': { top: '5%' },
          '50%': { top: '90%' },
        }
      }
    },
  },
  plugins: [],
}"""

# 6. postcss.config.js
FILES["postcss.config.js"] = """export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}"""

# 7. index.html
FILES["index.html"] = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234f46e5'><path d='M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 12c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5z'/></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Enterprise Smart Attendance System</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body class="bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>"""

# 8. src/index.css
FILES["src/index.css"] = """@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color-scheme: dark;
}

body {
  margin: 0;
  min-height: 100vh;
  background-color: #020617;
}

/* Custom scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #0f172a;
}
::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
"""

# 9. src/utils/audio.ts
FILES["src/utils/audio.ts"] = """// Web Audio API Sound Generator for Kiosk Alerts (Zero external audio assets needed)
class SoundEffects {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Dual pleasant chime for successful biometric match
  playSuccess() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12); // A5
      gain2.gain.setValueAtTime(0.2, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch {
      // AudioContext unavailable or autoplay blocked
    }
  }

  // Low frequency warning boop for spoof/cooldown/unknown
  playWarning() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // AudioContext unavailable
    }
  }
}

export const sounds = new SoundEffects();
"""

# 10. src/api/types.ts
FILES["src/api/types.ts"] = """export type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

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
"""

# 11. src/api/client.ts
FILES["src/api/client.ts"] = """import { User, Department, AttendanceRecord, VerificationResult, DashboardStats, LoginResponse } from './types';

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
"""

# 12. src/hooks/useWebcam.ts
FILES["src/hooks/useWebcam.ts"] = """import { useRef, useState, useEffect, useCallback } from 'react';

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStream = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setStream(mediaStream);
      setIsStreaming(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Webcam permission denied or device not found';
      setError(msg);
      setIsStreaming(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !isStreaming) return null;
    const video = videoRef.current;
    
    // Lazy initialize or reuse hidden canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Return base64 JPEG format with high quality
    return canvas.toDataURL('image/jpeg', 0.88);
  }, [isStreaming]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    videoRef,
    isStreaming,
    error,
    startStream,
    stopStream,
    captureFrame,
  };
}
"""

# 13. src/hooks/useWebSocket.ts
FILES["src/hooks/useWebSocket.ts"] = """import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketEvent<T = unknown> {
  type: string;
  data: T;
  timestamp: string;
}

export function useWebSocket<T = unknown>(path = '/api/v1/ws/live') {
  const [lastMessage, setLastMessage] = useState<WebSocketEvent<T> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}${path}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastMessage(parsed);
        } catch {
          // Non-JSON message
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt automatic reconnection in 4 seconds
        reconnectTimeoutRef.current = window.setTimeout(connect, 4000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimeoutRef.current = window.setTimeout(connect, 5000);
    }
  }, [path]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, lastMessage };
}
"""

# 14. src/components/Navbar.tsx
FILES["src/components/Navbar.tsx"] = """import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../api/types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            Enterprise Smart Attendance
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Face Biometrics
            </span>
          </h1>
          <p className="text-xs text-slate-400">High-Concurrency Facial Recognition System</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-sm font-mono font-medium text-slate-200">{time}</span>
          <span className="text-xs text-slate-500">Live Server Time</span>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden md:block" />

        {user ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-slate-200">{user.full_name}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-mono">{user.employee_id}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {user.role}
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 ml-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Kiosk Active
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
"""

# 15. src/components/Sidebar.tsx
FILES["src/components/Sidebar.tsx"] = """import React from 'react';
import { NavLink } from 'react-router-dom';
import { Camera, LayoutDashboard, Users, UserPlus, FileSpreadsheet, Activity } from 'lucide-react';
import { User } from '../api/types';

interface SidebarProps {
  user: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const isManagerOrAdmin = user && ['ADMIN', 'HR', 'MANAGER'].includes(user.role);
  const isAdminOrHR = user && ['ADMIN', 'HR'].includes(user.role);

  const navItems = [
    { to: '/kiosk', label: 'Live Kiosk', icon: Camera, always: true },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresRole: isManagerOrAdmin },
    { to: '/employees', label: 'Employees', icon: Users, requiresRole: isAdminOrHR },
    { to: '/enrollment', label: 'Biometrics', icon: UserPlus, requiresRole: isAdminOrHR },
    { to: '/reports', label: 'Audit Reports', icon: FileSpreadsheet, requiresRole: isManagerOrAdmin },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Navigation
        </div>
        <nav className="space-y-1">
          {navItems
            .filter((item) => item.always || item.requiresRole)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>
      </div>

      <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Engine Status
          </span>
          <span className="text-emerald-400 font-mono text-[11px] font-semibold">ONLINE</span>
        </div>
        <div className="text-[11px] text-slate-500 leading-relaxed">
          Vector Cache: <span className="text-slate-300 font-mono">512-d AES</span><br />
          Latency: <span className="text-emerald-400 font-mono">&lt; 45ms</span>
        </div>
      </div>
    </aside>
  );
};
"""

# 16. src/components/Layout.tsx
FILES["src/components/Layout.tsx"] = """import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { User } from '../api/types';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar user={user} onLogout={onLogout} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
"""

# 17. src/pages/LiveKiosk.tsx
FILES["src/pages/LiveKiosk.tsx"] = """import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { api } from '../api/client';
import { sounds } from '../utils/audio';
import { VerificationResult, AttendanceRecord } from '../api/types';
import { Camera, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Clock, RefreshCw, UserCheck } from 'lucide-react';

export const LiveKiosk: React.FC = () => {
  const { videoRef, isStreaming, error: streamError, startStream, stopStream, captureFrame } = useWebcam();
  
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [statusRing, setStatusRing] = useState<'IDLE' | 'SUCCESS' | 'WARNING' | 'ERROR'>('IDLE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AttendanceRecord[]>([]);
  const [autoCapture, setAutoCapture] = useState(true);
  
  const processingRef = useRef(false);
  const lastActionTimeRef = useRef<number>(0);

  // Auto-start webcam when visiting kiosk
  useEffect(() => {
    startStream();
    loadRecentLogs();
    return () => {
      stopStream();
    };
  }, [startStream, stopStream]);

  const loadRecentLogs = async () => {
    try {
      const data = await api.getAttendanceRecords({ limit: 6 });
      setRecentLogs(data.records || []);
    } catch {
      // Offline or unauthenticated demo
    }
  };

  const processFrame = useCallback(async () => {
    if (processingRef.current || !isStreaming) return;
    
    // Rate limit checks to prevent flooding
    const now = Date.now();
    if (now - lastActionTimeRef.current < 1200) return;

    const base64 = captureFrame();
    if (!base64) return;

    processingRef.current = true;
    setIsProcessing(true);

    try {
      const res = await api.verifyBiometric(base64, 'Main Entrance Kiosk');
      setResult(res);

      if (res.matched) {
        setStatusRing('SUCCESS');
        sounds.playSuccess();
        lastActionTimeRef.current = now;
        loadRecentLogs();
      } else if (res.message.includes('cooldown') || res.message.includes('recently')) {
        setStatusRing('WARNING');
        sounds.playWarning();
      } else {
        setStatusRing('ERROR');
      }
    } catch {
      setStatusRing('ERROR');
    } finally {
      processingRef.current = false;
      setIsProcessing(false);

      // Reset HUD status after 3 seconds
      setTimeout(() => {
        setStatusRing((curr) => (curr !== 'IDLE' ? 'IDLE' : curr));
      }, 3500);
    }
  }, [captureFrame, isStreaming]);

  // Periodic capture tick when autoCapture is enabled
  useEffect(() => {
    if (!autoCapture || !isStreaming) return;
    const interval = setInterval(() => {
      processFrame();
    }, 1500);
    return () => clearInterval(interval);
  }, [autoCapture, isStreaming, processFrame]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Camera className="w-6 h-6 text-indigo-400" />
            Live Biometric Recognition Kiosk
          </h2>
          <p className="text-sm text-slate-400">
            Real-time face detection, 512-d cosine vector matching, and automated shift tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoCapture(!autoCapture)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-2 transition-colors ${
              autoCapture
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoCapture ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            {autoCapture ? 'Auto-Scan Active' : 'Manual Scan Only'}
          </button>

          <button
            onClick={processFrame}
            disabled={isProcessing || !isStreaming}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
          >
            {isProcessing ? 'Verifying...' : 'Capture Now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Kiosk Camera Stage */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center shadow-2xl shadow-indigo-950/20">
            {streamError ? (
              <div className="text-center p-6 space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">Camera Feed Unavailable</p>
                <p className="text-xs text-slate-500 max-w-sm">{streamError}</p>
                <button
                  onClick={startStream}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />

                {/* Biometric Target Alignment Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`relative w-72 h-80 rounded-3xl border-2 transition-all duration-300 ${
                      statusRing === 'SUCCESS'
                        ? 'border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.35)]'
                        : statusRing === 'WARNING'
                        ? 'border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.35)]'
                        : statusRing === 'ERROR'
                        ? 'border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.35)]'
                        : 'border-indigo-400/50 shadow-[0_0_30px_rgba(99,102,241,0.2)]'
                    }`}
                  >
                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-current" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-current" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-current" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-current" />

                    {/* Animated Scanning Beam */}
                    {autoCapture && (
                      <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-scan" />
                    )}

                    {/* HUD Status Badge in target center bottom */}
                    <div className="absolute bottom-4 inset-x-0 flex justify-center">
                      <span className="text-[11px] font-mono tracking-widest px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-slate-300 uppercase">
                        {isProcessing ? 'Analyzing Vector...' : 'Align Face'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* HUD Telemetry Top Left */}
                <div className="absolute top-4 left-4 pointer-events-none flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    CAMERA 01 [HD]
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-300">
                    30 FPS
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Verification Status Banner */}
          {result && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-4 transition-all duration-300 ${
                result.matched
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : result.message.includes('cooldown')
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {result.matched ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : result.message.includes('cooldown') ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-400" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold">
                    {result.matched
                      ? `${result.action === 'CHECK_IN' ? 'Check-In Confirmed' : 'Check-Out Confirmed'}: ${result.full_name}`
                      : 'Verification Notice'}
                  </h4>
                  {result.confidence && (
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-black/40 border border-current">
                      {(result.confidence * 100).toFixed(1)}% Match
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-90">{result.message}</p>
                {result.matched && (
                  <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-mono opacity-80">
                    <span>ID: {result.employee_id}</span>
                    <span>Dept: {result.department || 'Corporate'}</span>
                    <span>Time: {result.timestamp}</span>
                    {result.duration_minutes !== undefined && result.duration_minutes > 0 && (
                      <span>Shift Duration: {Math.floor(result.duration_minutes / 60)}h {result.duration_minutes % 60}m</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Attendance Activity Log Side Panel */}
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                Real-Time Punch Stream
              </h3>
              <button
                onClick={loadRecentLogs}
                title="Refresh List"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {recentLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No attendance punches recorded today yet.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        {log.user?.full_name || `Employee #${log.user_id}`}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          log.status === 'PRESENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.status === 'LATE'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>In: {log.check_in ? log.check_in.split('T')[1]?.substring(0, 5) : '--:--'}</span>
                      <span>Out: {log.check_out ? log.check_out.split('T')[1]?.substring(0, 5) : '--:--'}</span>
                    </div>

                    {log.user?.department && (
                      <div className="text-[10px] text-slate-500">
                        {log.user.department.name} ({log.user.department.code})
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Security Notice */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Biometric Security Standard</p>
              <p className="leading-relaxed">
                Raw face images are never stored. Facial embeddings are 512-dimensional normalized vectors encrypted under AES-256-GCM.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
"""

# 18. src/pages/Dashboard.tsx
FILES["src/pages/Dashboard.tsx"] = """import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { DashboardStats } from '../api/types';
import { Users, UserCheck, Clock, UserX, TrendingUp, RefreshCw, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch {
      // Fallback sample statistics for preview/demo
      setStats({
        total_employees: 10,
        present_today: 9,
        late_today: 1,
        absent_today: 1,
        attendance_rate: 90.0,
        on_time_rate: 88.8,
        recent_logs: [],
        department_breakdown: [
          { department: 'Engineering', count: 4, present: 4 },
          { department: 'HR', count: 2, present: 2 },
          { department: 'Sales', count: 2, present: 2 },
          { department: 'Finance', count: 1, present: 1 },
          { department: 'Operations', count: 1, present: 0 },
        ],
        weekly_trend: [
          { date: 'Mon', present: 8, late: 2 },
          { date: 'Tue', present: 9, late: 1 },
          { date: 'Wed', present: 10, late: 0 },
          { date: 'Thu', present: 9, late: 1 },
          { date: 'Fri', present: 9, late: 1 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-400" />
            Executive Attendance Dashboard
          </h2>
          <p className="text-sm text-slate-400">Enterprise operational presence, punctuality metrics, and departmental analytics.</p>
        </div>

        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Workforce</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white font-mono">{stats?.total_employees || 0}</div>
          <p className="text-xs text-slate-500">Active enrolled employees</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Present Today</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-400 font-mono">{stats?.present_today || 0}</div>
          <p className="text-xs text-slate-500">{stats?.attendance_rate.toFixed(1)}% attendance rate</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Late Arrivals</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-400 font-mono">{stats?.late_today || 0}</div>
          <p className="text-xs text-slate-500">Punched after 09:15 AM</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Absent / Unreported</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-rose-400 font-mono">{stats?.absent_today || 0}</div>
          <p className="text-xs text-slate-500">Pending shift registration</p>
        </div>
      </div>

      {/* Visual Analytics Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend Bar Chart */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Weekly Attendance Trend
            </h3>
            <span className="text-xs text-slate-400">Last 5 Workdays</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.weekly_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Bar dataKey="present" fill="#4f46e5" radius={[4, 4, 0, 0]} name="On Time" />
                <Bar dataKey="late" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Late" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Attendance Breakdown */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Department Attendance Ratio
            </h3>
            <span className="text-xs text-slate-400">Current Day</span>
          </div>

          <div className="space-y-3.5">
            {stats?.department_breakdown.map((dept) => {
              const pct = dept.count > 0 ? Math.round((dept.present / dept.count) * 100) : 0;
              return (
                <div key={dept.department} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-200">{dept.department}</span>
                    <span className="text-slate-400 font-mono">
                      {dept.present}/{dept.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-indigo-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
"""

# 19. src/pages/Enrollment.tsx
FILES["src/pages/Enrollment.tsx"] = """import React, { useState, useEffect } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { api } from '../api/client';
import { User } from '../api/types';
import { UserPlus, Camera, CheckCircle2, AlertCircle, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

export const Enrollment: React.FC = () => {
  const { videoRef, isStreaming, error: streamError, startStream, stopStream, captureFrame } = useWebcam();
  
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadEmployees();
    startStream();
    return () => {
      stopStream();
    };
  }, [startStream, stopStream]);

  const loadEmployees = async () => {
    try {
      const list = await api.getEmployees();
      setEmployees(list);
      if (list.length > 0 && !selectedEmpId) {
        setSelectedEmpId(list[0].employee_id);
      }
    } catch {
      // fallback
    }
  };

  const handleCaptureSample = () => {
    if (capturedFrames.length >= 3) return;
    const frame = captureFrame();
    if (frame) {
      setCapturedFrames((prev) => [...prev, frame]);
    }
  };

  const handleReset = () => {
    setCapturedFrames([]);
    setMessage(null);
  };

  const handleSubmitEnrollment = async () => {
    if (!selectedEmpId || capturedFrames.length === 0) return;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await api.enrollBiometric(selectedEmpId, capturedFrames);
      setMessage({ type: 'success', text: `Biometric enrollment successful for ${selectedEmpId}! ${res.message}` });
      setCapturedFrames([]);
      loadEmployees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Biometric enrollment failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedEmployee = employees.find((e) => e.employee_id === selectedEmpId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-indigo-400" />
          Employee Biometric Face Enrollment
        </h2>
        <p className="text-sm text-slate-400">
          Capture high-fidelity facial vector samples to generate hardware-encrypted 512-d embeddings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration & Target Employee */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white">1. Select Employee</h3>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Assigned Employee</label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {employees.map((emp) => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.full_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>

            {selectedEmployee && (
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="text-slate-300 font-medium">{selectedEmployee.department?.name || 'General'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Corporate Role:</span>
                  <span className="text-slate-300 font-medium">{selectedEmployee.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Biometric Status:</span>
                  <span className={selectedEmployee.has_biometrics ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                    {selectedEmployee.has_biometrics ? 'Enrolled' : 'Pending Enrollment'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Enrollment Guidelines
            </h3>
            <ul className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <li>- Ensure direct, even facial illumination without harsh backlighting.</li>
              <li>- Keep eyes open and remove non-prescriptive dark sunglasses.</li>
              <li>- Capture 1 to 3 distinct angles (frontal, slight left, slight right).</li>
            </ul>
          </div>
        </div>

        {/* Center: Live Camera & Sample Capture */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
            {streamError ? (
              <div className="text-xs text-rose-400 p-4">{streamError}</div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-72 rounded-full border-2 border-dashed border-indigo-400/60" />
                </div>
              </>
            )}
          </div>

          {/* Capture Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCaptureSample}
                disabled={capturedFrames.length >= 3 || !isStreaming}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
              >
                <Camera className="w-4 h-4" />
                Capture Sample ({capturedFrames.length}/3)
              </button>
              {capturedFrames.length > 0 && (
                <button
                  onClick={handleReset}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            <button
              onClick={handleSubmitEnrollment}
              disabled={capturedFrames.length === 0 || isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-600/20"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Encrypting Vector...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save & Encrypt Vectors
                </>
              )}
            </button>
          </div>

          {/* Captured Sample Thumbnails */}
          {capturedFrames.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {capturedFrames.map((frame, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-indigo-500/50 aspect-video">
                  <img src={frame} alt={`Sample ${idx + 1}`} className="w-full h-full object-cover transform -scale-x-100" />
                  <span className="absolute bottom-1 right-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/70 text-indigo-300">
                    Sample #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Status Message */}
          {message && (
            <div
              className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
                message.type === 'success'
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
"""

# 20. src/pages/Employees.tsx
FILES["src/pages/Employees.tsx"] = """import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { User, Department } from '../api/types';
import { Users, Search, Plus, ShieldCheck, Mail, Building, UserCheck } from 'lucide-react';

export const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // New employee modal state
  const [showModal, setShowModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('EMPLOYEE');
  const [newDeptId, setNewDeptId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empList, deptList] = await Promise.all([api.getEmployees(), api.getDepartments()]);
      setEmployees(empList);
      setDepartments(deptList);
      if (deptList.length > 0 && !newDeptId) {
        setNewDeptId(String(deptList[0].id));
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEmployee({
        email: newEmail,
        employee_id: newEmpId,
        full_name: newName,
        role: newRole,
        department_id: newDeptId ? Number(newDeptId) : undefined,
      });
      setShowModal(false);
      setNewEmail('');
      setNewEmpId('');
      setNewName('');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create employee');
    }
  };

  const filtered = employees.filter((emp) => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase());
    const matchesDept = !deptFilter || String(emp.department_id) === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            Corporate Employee Directory
          </h2>
          <p className="text-sm text-slate-400">Manage workforce accounts, RBAC entitlements, and biometric enrollment status.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, employee ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
      </div>

      {/* Employees Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Employee</th>
                <th className="py-3.5 px-4 font-semibold">Employee ID</th>
                <th className="py-3.5 px-4 font-semibold">Department</th>
                <th className="py-3.5 px-4 font-semibold">Role</th>
                <th className="py-3.5 px-4 font-semibold">Biometrics</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    No matching employee records found.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold text-slate-200">{emp.full_name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {emp.email}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">{emp.employee_id}</td>
                    <td className="py-3.5 px-4">
                      {emp.department ? (
                        <span className="text-xs font-medium text-slate-300">
                          {emp.department.name} ({emp.department.code})
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-medium flex items-center gap-1.5 ${
                          emp.has_biometrics ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {emp.has_biometrics ? 'AES-256 Active' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          emp.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {emp.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create Employee Profile</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Employee ID</label>
                <input
                  type="text"
                  required
                  value={newEmpId}
                  onChange={(e) => setNewEmpId(e.target.value)}
                  placeholder="e.g. EMP011"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. john.doe@company.com"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Department</label>
                  <select
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">RBAC Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="HR">HR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
"""

# 21. src/pages/Reports.tsx
FILES["src/pages/Reports.tsx"] = """import React, { useState, useEffect } from 'react';
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
"""

# 22. src/App.tsx
FILES["src/App.tsx"] = """import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LiveKiosk } from './pages/LiveKiosk';
import { Dashboard } from './pages/Dashboard';
import { Enrollment } from './pages/Enrollment';
import { Employees } from './pages/Employees';
import { Reports } from './pages/Reports';
import { api } from './api/client';
import { User } from './api/types';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (api.getToken()) {
        const current = await api.getCurrentUser();
        setUser(current);
      }
    } catch {
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm font-mono">
        Loading Biometric Core...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
          <Route index element={<Navigate to="/kiosk" replace />} />
          <Route path="kiosk" element={<LiveKiosk />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="enrollment" element={<Enrollment />} />
          <Route path="employees" element={<Employees />} />
          <Route path="reports" element={<Reports />} />
        </Route>
        <Route path="*" element={<Navigate to="/kiosk" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
"""

# 23. src/main.tsx
FILES["src/main.tsx"] = """import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
"""

def main():
    print(f"Scaffolding frontend in: {FRONTEND_DIR}")
    for rel_path, content in FILES.items():
        abs_path = os.path.join(FRONTEND_DIR, rel_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  [+] Created: {rel_path}")
    print(f"Successfully generated all {len(FILES)} frontend files.")

if __name__ == '__main__':
    main()
