import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { ToastNotification } from '../types';

interface ToastProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

/**
 * Web Audio API synthesizer for instant audible attendance confirmation without external audio files.
 */
export const playChime = (type: 'success' | 'late' | 'error' | 'info' = 'success'): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    if (type === 'success') {
      // Ascending triumphant dual-chime: C5 (523.25Hz) -> G5 (783.99Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now);
      osc2.frequency.setValueAtTime(783.99, now + 0.1);

      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gainNode);
      osc2.connect(gainNode);

      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.45);
    } else if (type === 'late') {
      // Gentle warning chime: E5 (659.25Hz) -> C5 (523.25Hz)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(523.25, now + 0.15);

      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'error') {
      // Low tone error alert
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(160, now + 0.25);

      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // Subtle info ping
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);

      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.debug('Web Audio API playback not allowed before user interaction:', err);
  }
};

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col space-y-3 max-w-md w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <motion.div
              layout
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.92, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              className={`pointer-events-auto relative overflow-hidden flex items-start p-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${
                isSuccess
                  ? 'bg-slate-900/90 border-emerald-500/40 text-emerald-100 shadow-emerald-950/50'
                  : isError
                  ? 'bg-slate-900/90 border-rose-500/40 text-rose-100 shadow-rose-950/50'
                  : isWarning
                  ? 'bg-slate-900/90 border-amber-500/40 text-amber-100 shadow-amber-950/50'
                  : 'bg-slate-900/90 border-cyan-500/40 text-cyan-100 shadow-cyan-950/50'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5 mr-3">
                {isSuccess && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-cyan-400" />}
              </div>

              <div className="flex-1 mr-2">
                <h4 className="text-sm font-semibold tracking-wide text-white">{toast.title}</h4>
                <p className="text-xs mt-0.5 text-slate-300 leading-relaxed">{toast.message}</p>
                <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                  {toast.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-white transition-colors p-1 -mr-1 -mt-1 rounded-lg hover:bg-slate-800"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Progress countdown indicator */}
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: (toast.duration || 5000) / 1000, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-0.5 ${
                  isSuccess ? 'bg-emerald-400' : isError ? 'bg-rose-400' : isWarning ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
