import { AttendanceResult, LeaveEventPayload } from '../types';

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

type AttendanceCallback = (data: AttendanceResult) => void;
type LeaveEventCallback = (data: LeaveEventPayload) => void;
type StatusCallback = (status: ConnectionStatus) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  private attendanceListeners: Set<AttendanceCallback> = new Set();
  private leaveListeners: Set<LeaveEventCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private pingIntervalId: number | null = null;
  private reconnectTimeoutId: number | null = null;
  private explicitDisconnect = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.status === 'DISCONNECTED') {
          this.connect();
        }
      });
      window.addEventListener('focus', () => {
        if (this.status === 'DISCONNECTED') {
          this.connect();
        }
      });
    }
  }

  private getWebSocketUrl(): string {
    if (import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }
    const isHttps = window.location.protocol === 'https:';
    const protocol = isHttps ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.explicitDisconnect = false;
    this.setStatus('CONNECTING');

    const url = this.getWebSocketUrl();

    try {
      // Detach handlers from any existing socket
      if (this.socket) {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        try {
          this.socket.close();
        } catch {
          // Ignore close error on stale socket
        }
        this.socket = null;
      }

      const ws = new WebSocket(url);
      this.socket = ws;

      ws.onopen = () => {
        if (this.socket !== ws) return;
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        this.send({
          type: 'SUBSCRIBE',
          channel: 'attendance',
        });
      };

      ws.onmessage = (event: MessageEvent) => {
        if (this.socket !== ws) return;
        try {
          const payload = JSON.parse(event.data);
          this.handleMessage(payload);
        } catch {
          if (event.data === 'PONG') {
            // Heartbeat ack
          }
        }
      };

      ws.onclose = () => {
        if (this.socket !== ws) return;
        this.stopHeartbeat();
        this.setStatus('DISCONNECTED');
        this.socket = null;
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        if (this.socket !== ws) return;
        try {
          ws.close();
        } catch {
          // Ignore error on close
        }
      };
    } catch {
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.explicitDisconnect = true;
    this.stopHeartbeat();
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('DISCONNECTED');
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public onAttendanceEvent(callback: AttendanceCallback): () => void {
    this.attendanceListeners.add(callback);
    return () => {
      this.attendanceListeners.delete(callback);
    };
  }

  public onLeaveEvent(callback: LeaveEventCallback): () => void {
    this.leaveListeners.add(callback);
    return () => {
      this.leaveListeners.delete(callback);
    };
  }

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => listener(newStatus));
    }
  }

  private handleMessage(payload: { type: string; data?: unknown }): void {
    if (payload.type === 'ATTENDANCE_EVENT' && payload.data) {
      const attendanceData = payload.data as AttendanceResult;
      this.attendanceListeners.forEach((callback) => {
        try {
          callback(attendanceData);
        } catch (err) {
          console.error('Error invoking attendance listener:', err);
        }
      });
    } else if (payload.type === 'LEAVE_EVENT' && payload.data) {
      const leaveData = payload.data as LeaveEventPayload;
      this.leaveListeners.forEach((callback) => {
        try {
          callback(leaveData);
        } catch (err) {
          console.error('Error invoking leave listener:', err);
        }
      });
    }
  }

  private send(data: unknown): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalId = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'PING' }));
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectTimeoutId = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export const wsClient = new WebSocketClient();
export default wsClient;
