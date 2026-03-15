import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NoticeTone } from "../types/api";

type Notice = {
  id: number;
  message: string;
  tone: NoticeTone;
};

type NoticeContextValue = {
  notice: Notice | null;
  showNotice: (message: string, tone?: NoticeTone) => void;
  clearNotice: () => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = useCallback((message: string, tone: NoticeTone = "info") => {
    setNotice({
      id: Date.now(),
      message,
      tone
    });
  }, []);

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      clearNotice();
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [clearNotice, notice]);

  const value = useMemo<NoticeContextValue>(
    () => ({
      notice,
      showNotice,
      clearNotice
    }),
    [clearNotice, notice, showNotice]
  );

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <div className={`toast-region ${notice ? "visible" : ""}`} aria-live="polite" aria-atomic="true">
        {notice ? (
          <div className={`toast toast-${notice.tone}`}>
            <p>{notice.message}</p>
            <button type="button" className="toast-dismiss" onClick={value.clearNotice} aria-label="Dismiss message">
              Close
            </button>
          </div>
        ) : null}
      </div>
    </NoticeContext.Provider>
  );
}

export function useNotice(): NoticeContextValue {
  const context = useContext(NoticeContext);
  if (!context) {
    throw new Error("useNotice must be used within NoticeProvider");
  }

  return context;
}
