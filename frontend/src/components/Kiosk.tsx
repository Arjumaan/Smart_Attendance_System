import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Camera,
  CameraOff,
  RefreshCw,
  CheckCircle2,
  Clock,
  Scan,
  Sparkles,
  Maximize2,
  Minimize2,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react';
import api from '../services/api';
import { AttendanceResult, BiometricMatchResult } from '../types';
import { playChime } from './Toast';

interface KioskProps {
  onNotify?: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
  recentEvents?: AttendanceResult[];
}

export const Kiosk: React.FC<KioskProps> = ({ onNotify, recentEvents = [] }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [autoScan, setAutoScan] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [localEvents, setLocalEvents] = useState<AttendanceResult[]>(recentEvents);
  const [detectionBox, setDetectionBox] = useState<{
    visible: boolean;
    name: string;
    similarity: number;
    isLate: boolean;
    status: string;
  } | null>(null);

  // Sync external events
  useEffect(() => {
    if (recentEvents && recentEvents.length > 0) {
      setLocalEvents(recentEvents);
    }
  }, [recentEvents]);

  // Enumerate video devices
  const updateDeviceList = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevs[0].deviceId);
        }
      }
    } catch (err) {
      console.warn('Could not enumerate media devices:', err);
    }
  }, [selectedDeviceId]);

  // Start WebRTC camera stream
  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsStreaming(true);
      updateDeviceList();
    } catch (err) {
      console.error('Failed to access camera:', err);
      setIsStreaming(false);
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Camera Access Denied',
          message: 'Could not access web camera. Please verify permissions in your browser.',
        });
      }
    }
  }, [selectedDeviceId, onNotify, updateDeviceList]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setDetectionBox(null);
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Capture frame from video element into base64 JPEG
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !isStreaming || videoRef.current.readyState < 2) {
      return null;
    }

    const video = videoRef.current;
    let canvas = captureCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      captureCanvasRef.current = canvas;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, [isStreaming]);

  // Execute recognition request
  const processRecognition = useCallback(async () => {
    if (isProcessing || !isStreaming) return;

    const frameBase64 = captureFrame();
    if (!frameBase64) return;

    setIsProcessing(true);

    try {
      const res: BiometricMatchResult = await api.recognizeFace({ image_base64: frameBase64 });

      if (res.matched && res.full_name) {
        const att = res.attendance;
        const isLate = att ? att.is_late : false;
        const eventRes = att ? att.event_result : 'CHECKED_IN';
        const statusText =
          eventRes === 'CHECKED_IN'
            ? isLate
              ? 'Checked In (Late)'
              : 'Checked In (On Time)'
            : eventRes === 'CHECKED_OUT'
            ? 'Checked Out'
            : 'Cooldown Active';

        // Set visual detection reticle box
        setDetectionBox({
          visible: true,
          name: res.full_name,
          similarity: res.similarity_score,
          isLate,
          status: statusText,
        });

        // Trigger Audio Chime & Confetti Delight
        if (eventRes === 'COOLDOWN_IGNORED') {
          playChime('info');
        } else if (isLate) {
          playChime('late');
          try {
            confetti({
              particleCount: 30,
              spread: 50,
              origin: { y: 0.65 },
              colors: ['#f59e0b', '#fbbf24', '#d97706'],
              disableForReducedMotion: true,
            });
          } catch {
            // Ignore
          }
        } else {
          playChime('success');
          try {
            confetti({
              particleCount: 45,
              spread: 65,
              origin: { y: 0.65 },
              colors: ['#10b981', '#34d399', '#059669', '#38bdf8'],
              disableForReducedMotion: true,
            });
          } catch {
            // Ignore
          }
        }

        // Trigger Visual Toast
        if (onNotify) {
          onNotify({
            type: isLate ? 'warning' : 'success',
            title: `Welcome ${res.full_name}!`,
            message: `${statusText} • Confidence: ${(res.similarity_score * 100).toFixed(1)}%`,
          });
        }

        // Add to local events feed if attendance present
        if (att) {
          setLocalEvents((prev) => [att, ...prev].slice(0, 20));
        }

        // Auto-clear detection bounding box overlay after 3.5 seconds
        setTimeout(() => {
          setDetectionBox((prev) => (prev?.name === res.full_name ? null : prev));
        }, 3500);
      } else {
        if (res.message && res.message.includes('Liveness check failed')) {
          playChime('error');
          if (onNotify) {
            onNotify({
              type: 'error',
              title: 'Anti-Spoofing Alert',
              message: res.message,
            });
          }
        }
      }
    } catch (err: unknown) {
      console.debug('Frame recognition response:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, isStreaming, captureFrame, onNotify]);

  // Auto scan interval loop
  useEffect(() => {
    let interval: number | null = null;
    if (autoScan && isStreaming) {
      interval = window.setInterval(() => {
        processRecognition();
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoScan, isStreaming, processRecognition]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className={`flex flex-col lg:flex-row gap-6 p-4 md:p-6 max-w-7xl mx-auto ${fullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-6' : ''}`}>
      {/* Primary Video Feed & Scanner Viewport */}
      <div className="flex-1 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden relative">
        {/* Stream Header Controls */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-850/80 border-b border-slate-800 backdrop-blur-sm z-20">
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isStreaming ? 'bg-emerald-400 opacity-75' : 'bg-rose-400 opacity-75'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isStreaming ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Scan className="w-4 h-4 text-emerald-400" />
              Live Biometric Scanner
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            {/* Auto Scanner Toggle */}
            <button
              onClick={() => setAutoScan(!autoScan)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                autoScan
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 shadow-sm shadow-emerald-950'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${autoScan ? 'text-emerald-400 fill-emerald-400/20' : 'text-slate-500'}`} />
              <span>{autoScan ? 'Auto-Scan On' : 'Auto-Scan Paused'}</span>
            </button>

            {/* Camera Switcher Dropdown */}
            {devices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                }}
                className="bg-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
              >
                {devices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}

            {/* Start/Stop Camera */}
            <button
              onClick={isStreaming ? stopCamera : startCamera}
              className={`p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors border ${
                isStreaming ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500'
              }`}
              title={isStreaming ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isStreaming ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen Kiosk'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Video Surface Container */}
        <div className="relative flex-1 min-h-[460px] md:min-h-[540px] bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform ${selectedDeviceId.includes('back') ? '' : '-scale-x-100'}`}
          />
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full" />

          {/* Target Alignment Center Reticle */}
          {isStreaming && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-72 sm:w-72 sm:h-80 border border-emerald-500/20 rounded-3xl relative flex items-center justify-center overflow-hidden">
                {/* Framer Motion Cyber Laser Scan Sweep */}
                {autoScan && (
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399]"
                    animate={{ top: ['4%', '96%', '4%'] }}
                    transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                  />
                )}

                {/* Corner reticle brackets */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-400 rounded-tl-xl -mt-0.5 -ml-0.5" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-400 rounded-tr-xl -mt-0.5 -mr-0.5" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-400 rounded-bl-xl -mb-0.5 -ml-0.5" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-400 rounded-br-xl -mb-0.5 -mr-0.5" />

                {/* Guidance text overlay */}
                <div className="absolute -bottom-10 text-center">
                  <span className="text-xs font-mono tracking-wider text-slate-300 bg-slate-900/90 px-3.5 py-1 rounded-full border border-slate-700/80 shadow-xl backdrop-blur-md">
                    Align Face Within Reticle
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Detection Bounding Box Card with Spring Animation */}
          <AnimatePresence>
            {detectionBox && detectionBox.visible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: -25 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -15 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
              >
                <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-emerald-400 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-emerald-950/60 flex items-center space-x-3.5">
                  <div className="w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                    <UserCheck className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-base text-white tracking-wide">{detectionBox.name}</h3>
                      <span className="text-[11px] font-mono bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                        {(detectionBox.similarity * 100).toFixed(0)}% MATCH
                      </span>
                    </div>
                    <p className="text-xs font-medium text-emerald-300 flex items-center gap-1.5 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      {detectionBox.status}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Offline / Disabled Camera Overlay */}
          {!isStreaming && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 z-20">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 text-slate-400">
                <CameraOff className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-200">Camera Feed Paused</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
                Start the WebRTC camera stream to activate automated facial recognition check-in.
              </p>
              <button
                onClick={startCamera}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-950/40"
              >
                <Camera className="w-4 h-4" />
                <span>Activate Camera Feed</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="px-5 py-3.5 bg-slate-850/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 z-20">
          <div className="flex items-center space-x-3 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Liveness Verification Active
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-mono">Anti-Spoofing: Enforced</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={processRecognition}
              disabled={isProcessing || !isStreaming}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all ${
                isProcessing || !isStreaming
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/40'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Recognizing...' : 'Manual Snapshot'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Attendance Event Ticker / Sidebar */}
      <div className="w-full lg:w-96 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">Live Presence Feed</h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
            {localEvents.length} Recent
          </span>
        </div>

        <div className="flex-1 p-3 overflow-y-auto space-y-2 max-h-[540px]">
          {localEvents.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-slate-400 font-medium">No check-in activity recorded yet.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Real-time recognition events will appear here instantly as employees approach the kiosk.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {localEvents.map((evt, index) => {
                const isCheckedIn = evt.event_result === 'CHECKED_IN';
                const isCheckedOut = evt.event_result === 'CHECKED_OUT';

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: 20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                    key={`${evt.employee_id}-${index}-${evt.check_in_time || evt.check_out_time}`}
                    className="p-3 rounded-xl bg-slate-850/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all flex items-start space-x-3 shadow-sm"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                        isCheckedIn
                          ? evt.is_late
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : isCheckedOut
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {evt.full_name
                        ? evt.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()
                        : 'ID'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-slate-100 truncate">{evt.full_name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 ml-2">
                          {evt.check_out_time
                            ? new Date(evt.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : evt.check_in_time
                            ? new Date(evt.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Now'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{evt.employee_id}</p>

                      <div className="flex items-center space-x-2 mt-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isCheckedIn
                              ? evt.is_late
                                ? 'bg-amber-950/70 text-amber-400 border border-amber-800/60'
                                : 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60'
                              : isCheckedOut
                              ? 'bg-cyan-950/70 text-cyan-400 border border-cyan-800/60'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isCheckedIn ? (evt.is_late ? 'Late Check-In' : 'Checked In') : isCheckedOut ? 'Checked Out' : 'Cooldown'}
                        </span>

                        {evt.total_hours && evt.total_hours > 0 && (
                          <span className="text-[10px] text-cyan-300 font-mono">
                            {evt.total_hours.toFixed(1)} hrs
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

export default Kiosk;
