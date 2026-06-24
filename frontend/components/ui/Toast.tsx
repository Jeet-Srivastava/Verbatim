/**
 * Toast Notification System
 * ==========================
 * A lightweight, self-contained toast system. No external libraries needed.
 * Toasts auto-dismiss after a few seconds, stack from the top-right,
 * and can be manually dismissed by clicking the X.
 *
 * Usage anywhere in the app:
 *   import { useToast, ToastProvider } from "@/components/ui/Toast";
 *
 *   // wrap your app (or page) with <ToastProvider>
 *   // then in any child component:
 *   const { toast } = useToast();
 *   toast.error("Something broke");
 *   toast.success("File uploaded!");
 *   toast.info("Processing started...");
 *
 * The provider renders the toast container — all the positioning
 * and animation is handled internally. You just call toast.error()
 * and forget about it.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// each toast has a type, message, and unique id for keying
interface ToastItem {
  id: string;
  type: "error" | "success" | "info" | "warning";
  message: string;
  duration: number; // ms before auto-dismiss
}

interface ToastContextValue {
  toast: {
    error: (message: string, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

// hook to access toasts from any component — just call useToast()
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return context;
}

// the provider component — wrap your page or layout with this
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // generate a quick unique id — crypto.randomUUID is overkill for toasts
  const makeId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // add a toast to the stack
  const addToast = useCallback(
    (type: ToastItem["type"], message: string, duration = 5000) => {
      const id = makeId();
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    []
  );

  // remove a toast by id — called on dismiss or auto-timeout
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // the public API — what components actually call
  const toast = {
    error: (message: string, duration?: number) => addToast("error", message, duration),
    success: (message: string, duration?: number) => addToast("success", message, duration),
    info: (message: string, duration?: number) => addToast("info", message, duration),
    warning: (message: string, duration?: number) => addToast("warning", message, duration),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* toast container — fixed to top-right, stacks downward */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => (
          <SingleToast key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// individual toast component — handles its own auto-dismiss timer
function SingleToast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);

  // auto-dismiss after the specified duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      // wait for the exit animation to finish before actually removing
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  // manual dismiss on click
  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  // style variants — each toast type gets its own color scheme
  const styles = {
    error: {
      bg: "bg-red-500/10 border-red-500/30",
      icon: "text-red-400",
      text: "text-red-300",
      bar: "bg-red-500",
    },
    success: {
      bg: "bg-emerald-500/10 border-emerald-500/30",
      icon: "text-emerald-400",
      text: "text-emerald-300",
      bar: "bg-emerald-500",
    },
    info: {
      bg: "bg-cyan-500/10 border-cyan-500/30",
      icon: "text-cyan-400",
      text: "text-cyan-300",
      bar: "bg-cyan-500",
    },
    warning: {
      bg: "bg-amber-500/10 border-amber-500/30",
      icon: "text-amber-400",
      text: "text-amber-300",
      bar: "bg-amber-500",
    },
  };

  const s = styles[toast.type];

  // icon for each type
  const icons = {
    error: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
    success: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  };

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-xl border backdrop-blur-xl
        ${s.bg} shadow-2xl shadow-black/20
        transition-all duration-300 ease-out
        ${isExiting ? "opacity-0 translate-x-8 scale-95" : "opacity-100 translate-x-0 scale-100"}
        animate-toast-in`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* icon */}
        <div className={`shrink-0 mt-0.5 ${s.icon}`}>
          {icons[toast.type]}
        </div>

        {/* message */}
        <p className={`flex-1 text-sm leading-relaxed ${s.text}`}>
          {toast.message}
        </p>

        {/* dismiss button */}
        <button
          onClick={handleDismiss}
          className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* progress bar — shows how much time is left before auto-dismiss */}
      <div className="h-0.5 w-full bg-zinc-800/50">
        <div
          className={`h-full ${s.bar} opacity-60`}
          style={{
            animation: `toast-progress ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
