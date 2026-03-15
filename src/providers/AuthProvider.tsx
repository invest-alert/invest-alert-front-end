import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../lib/api";
import { getApiErrorMessage, setUnauthorizedHandler } from "../lib/http";
import { clearStoredTokens, getStoredTokens, saveStoredTokens } from "../lib/storage";
import { TokenPair, UserProfile } from "../types/api";
import { useNotice } from "./NoticeProvider";

type AuthStatus = "loading" | "authenticated" | "guest";

type AuthContextValue = {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: UserProfile | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const { showNotice } = useNotice();

  const clearSession = useCallback(
    (showExpiredMessage = false): void => {
      clearStoredTokens();
      setUser(null);
      setStatus("guest");

      if (showExpiredMessage) {
        showNotice("Session expired. Please log in again.", "error");
      }
    },
    [showNotice]
  );

  const syncUserProfile = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const response = await authApi.me(signal);
    setUser(response.data);
    setStatus("authenticated");
  }, []);

  const storeTokensAndLoadUser = useCallback(
    async (tokens: TokenPair): Promise<void> => {
      saveStoredTokens(tokens);

      try {
        await syncUserProfile();
      } catch (error) {
        clearSession(false);
        throw new Error(getApiErrorMessage(error));
      }
    },
    [clearSession, syncUserProfile]
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession(true);
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!tokens) {
      setStatus("guest");
      return;
    }

    const abortController = new AbortController();

    void (async () => {
      try {
        await syncUserProfile(abortController.signal);
      } catch {
        clearSession(false);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [clearSession, syncUserProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: status === "authenticated",
      user,
      async login(credentials) {
        const response = await authApi.login(credentials);
        await storeTokensAndLoadUser(response.data);
        showNotice(response.message, "success");
      },
      async register(credentials) {
        const response = await authApi.register(credentials);
        await storeTokensAndLoadUser(response.data);
        showNotice(response.message, "success");
      },
      async logout() {
        try {
          const response = await authApi.logout();
          showNotice(response.message, "success");
        } catch {
          // Local cleanup should still happen even if the backend call fails.
        } finally {
          clearSession(false);
        }
      },
      async refreshUser() {
        try {
          await syncUserProfile();
        } catch (error) {
          clearSession(false);
          throw new Error(getApiErrorMessage(error));
        }
      }
    }),
    [clearSession, showNotice, status, storeTokensAndLoadUser, syncUserProfile, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
