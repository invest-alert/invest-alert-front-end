import { ApiEnvelope, AuthTokenData, UserProfile, WatchlistEntry } from "../types/api";
import { request } from "./http";
import { getTokens } from "./storage";

interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
  name?: string;
}

interface LoginPayload {
  email: string;
  password: string;
  username?: string;
}

type Exchange = "NSE" | "BSE";

interface AddWatchlistPayload {
  symbol: string;
  exchange: Exchange;
}

export const authApi = {
  register(payload: RegisterPayload): Promise<ApiEnvelope<AuthTokenData | UserProfile>> {
    return request<AuthTokenData | UserProfile>("/api/v1/auth/register", {
      method: "POST",
      body: payload
    });
  },

  login(payload: LoginPayload): Promise<ApiEnvelope<AuthTokenData>> {
    return request<AuthTokenData>("/api/v1/auth/login", {
      method: "POST",
      body: payload
    });
  },

  tokenLogin(username: string, password: string): Promise<ApiEnvelope<AuthTokenData>> {
    const form = new URLSearchParams({
      username,
      password
    });

    return request<AuthTokenData>("/api/v1/auth/token", {
      method: "POST",
      form
    });
  },

  refresh(): Promise<ApiEnvelope<AuthTokenData>> {
    const tokens = getTokens();
    return request<AuthTokenData>("/api/v1/auth/refresh", {
      method: "POST",
      body: {
        refresh_token: tokens?.refreshToken ?? ""
      }
    });
  },

  me(): Promise<ApiEnvelope<UserProfile>> {
    return request<UserProfile>("/api/v1/auth/me", {
      auth: true
    });
  },

  logout(): Promise<ApiEnvelope<null>> {
    const tokens = getTokens();
    return request<null>("/api/v1/auth/logout", {
      method: "POST",
      auth: true,
      body: tokens?.refreshToken ? { refresh_token: tokens.refreshToken } : {}
    });
  }
};

export const watchlistApi = {
  list(): Promise<ApiEnvelope<WatchlistEntry[] | { watchlist: WatchlistEntry[] } | { items: WatchlistEntry[] }>> {
    return request<WatchlistEntry[] | { watchlist: WatchlistEntry[] } | { items: WatchlistEntry[] }>("/api/v1/watchlist", {
      auth: true
    });
  },

  add(payload: AddWatchlistPayload): Promise<ApiEnvelope<WatchlistEntry | { item: WatchlistEntry } | { entry: WatchlistEntry }>> {
    return request<WatchlistEntry | { item: WatchlistEntry } | { entry: WatchlistEntry }>("/api/v1/watchlist", {
      method: "POST",
      auth: true,
      body: payload
    });
  },

  remove(stockId: string | number): Promise<ApiEnvelope<null>> {
    return request<null>(`/api/v1/watchlist/${stockId}`, {
      method: "DELETE",
      auth: true
    });
  }
};
