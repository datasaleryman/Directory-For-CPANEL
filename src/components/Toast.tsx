import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full no-print">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const duration = toast.duration ?? 2000;
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const config = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
      label: 'Success'
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
      label: 'Warning'
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      icon: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
      label: 'Error'
    },
    info: {
      bg: 'bg-sky-50 border-sky-200 text-sky-800',
      icon: <Info className="w-5 h-5 text-sky-500 shrink-0" />,
      label: 'Info'
    }
  }[toast.type] || {
    bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    label: 'Success'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${config.bg} w-full`}
    >
      {config.icon}
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider">{config.label}</p>
        <p className="text-sm mt-0.5 leading-relaxed font-medium">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0"
        title="Dismiss notification"
      >
        <X className="w-4 h-4 opacity-70 hover:opacity-100" />
      </button>
    </motion.div>
  );
};
