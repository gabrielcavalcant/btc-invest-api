import { CircleAlert, CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  tone: 'success' | 'error';
  title: string;
  description?: string;
}

type ShowToast = (toast: Omit<Toast, 'id'>) => void;

const ToastContext = createContext<ShowToast>(() => {});

let nextId = 1;

/** Small notifications in the corner (operation succeeded, request failed...). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback<ShowToast>((toast) => {
    const id = nextId++;
    setToasts((all) => [...all, { ...toast, id }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 6000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:top-5">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CircleCheck : CircleAlert;
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-fade-up gap-3 rounded-2xl border border-line bg-surface/95 p-4 text-sm shadow-2xl shadow-black/20 backdrop-blur-xl"
            >
              <Icon
                className={`mt-0.5 size-5 shrink-0 ${toast.tone === 'success' ? 'text-up' : 'text-down'}`}
              />
              <div>
                <p className="font-semibold text-fg">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-muted">{toast.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
