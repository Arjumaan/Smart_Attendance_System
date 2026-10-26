import React, { useState, useEffect, useRef, useCallback } from 'react';
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
