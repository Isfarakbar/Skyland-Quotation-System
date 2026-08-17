import * as Toast from '@radix-ui/react-toast';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Tone = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; tone: Tone }
interface ToastValue { notify: (message: string, tone?: Tone) => void }
const Context = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback((message: string, tone: Tone = 'info') => setItems(current => [...current, { id: Date.now() + Math.random(), message, tone }]), []);
  const value = useMemo(() => ({ notify }), [notify]);
  return <Context.Provider value={value}><Toast.Provider swipeDirection="right">{children}{items.map(item => {
    const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertCircle : Info;
    return <Toast.Root key={item.id} className={`toast toast--${item.tone}`} defaultOpen duration={4200} onOpenChange={open => !open && setItems(current => current.filter(row => row.id !== item.id))}>
      <Icon size={19} aria-hidden="true"/><Toast.Description>{item.message}</Toast.Description><Toast.Close aria-label="Dismiss notification"><X size={17}/></Toast.Close>
    </Toast.Root>;
  })}<Toast.Viewport className="toast-viewport"/></Toast.Provider></Context.Provider>;
}

export function useToast() {
  const value = useContext(Context);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
