import React, { useState, useEffect } from 'react';
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
