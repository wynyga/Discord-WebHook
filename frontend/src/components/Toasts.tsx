import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type Tone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  notify: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const AUTO_DISMISS_MS = 6000;
const TOAST_GAP_REM = 4.5;

type AriaNotifyDocument = Document & { ariaNotify?: (message: string) => void };

/**
 * Toasts confirm results that are also visible elsewhere (the task list, the logs), so missing one
 * loses nothing. They live in one named region and are announced to screen readers.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: Tone = 'info') => {
    setToasts((current) => [...current, { id: nextId.current++, message, tone }]);
    const doc = document as AriaNotifyDocument;
    if (typeof doc.ariaNotify === 'function') doc.ariaNotify(message);
    else setAnnouncement(message);
  }, []);

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="region" aria-label="Notifications">
        {toasts.map((toast, index) => (
          <ToastItem key={toast.id} toast={toast} offset={index} onDismiss={dismiss} />
        ))}
      </div>
      {/* Fallback announcer where ariaNotify() is missing; present from page load. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, offset, onDismiss }: { toast: Toast; offset: number; onDismiss: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    ref.current?.showPopover?.();
  }, []);

  // Auto-dismiss, but never while focus is inside the toast.
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, onDismiss]);

  const toneClass =
    toast.tone === 'success' ? 'text-success' : toast.tone === 'error' ? 'text-danger' : 'text-accent';
  const icon = toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'x' : 'clock';

  return (
    <div
      ref={ref}
      popover="manual"
      className="toast"
      style={{ insetBlockEnd: `${1 + offset * TOAST_GAP_REM}rem` }}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 ${toneClass}`}>
          <Icon name={icon} />
        </span>
        <p className="flex-1 text-sm">{toast.message}</p>
        <button type="button" className="btn btn-ghost btn-sm -my-1 -me-2" onClick={() => onDismiss(toast.id)}>
          <Icon name="x" />
          <span className="sr-only">Dismiss notification</span>
        </button>
      </div>
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
