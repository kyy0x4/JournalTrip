import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { playAlertSound } from '../utils/alertSound';

export interface DelayNotification {
  id: string;
  driverName: string;
  nopol: string;
  ritase: number;
  area?: string;
  time: string;
  createdAt: number;
}

const HISTORY_KEY = 'delay_notification_history';
const MAX_HISTORY = 50;

function loadHistory(): DelayNotification[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

interface NotificationContextValue {
  toasts: DelayNotification[];
  history: DelayNotification[];
  unreadCount: number;
  pushNotification: (n: Omit<DelayNotification, 'id' | 'createdAt'>) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
  clearHistory: () => void;
  markAllSeen: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<DelayNotification[]>([]);
  const [history, setHistory] = useState<DelayNotification[]>(loadHistory);
  const [seenCount, setSeenCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem('delay_notification_seen') || '0', 10);
    } catch {
      return 0;
    }
  });
  const timersRef = useRef<Map<string, number>>(new Map());

  const persistHistory = (h: DelayNotification[]) => {
    setHistory(h);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
    } catch {
      // abaikan
    }
  };

  const pushNotification = useCallback((n: Omit<DelayNotification, 'id' | 'createdAt'>) => {
    const notif: DelayNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };

    setToasts(prev => [notif, ...prev].slice(0, 5));

    setHistory(prev => {
      const next = [notif, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // abaikan
      }
      return next;
    });
    setSeenCount(prev => prev + 1);

    playAlertSound();

    const timer = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== notif.id));
      timersRef.current.delete(notif.id);
    }, 12000);
    timersRef.current.set(notif.id, timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const clearAllToasts = useCallback(() => {
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const clearHistory = useCallback(() => {
    persistHistory([]);
    setSeenCount(0);
    try {
      localStorage.setItem('delay_notification_seen', '0');
    } catch {
      // abaikan
    }
  }, [persistHistory]);

  const markAllSeen = useCallback(() => {
    setSeenCount(0);
    try {
      localStorage.setItem('delay_notification_seen', String(history.length));
    } catch {
      // abaikan
    }
  }, [history.length]);

  const value = useMemo<NotificationContextValue>(() => ({
    toasts,
    history,
    unreadCount: Math.max(0, seenCount),
    pushNotification,
    dismissToast,
    clearAllToasts,
    clearHistory,
    markAllSeen,
  }), [toasts, history, seenCount, pushNotification, dismissToast, clearAllToasts, clearHistory, markAllSeen]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
