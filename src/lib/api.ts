import {
  DailyContextHarvestSummary,
  DailyContextItem,
  Exchange,
  MarketOverviewItem,
  SummaryTaskStatus,
  TokenPair,
  UserProfile,
  WatchlistItem
} from "../types/api";
import { getStoredTokens } from "./storage";
import { request } from "./http";

type AuthPayload = {
  email: string;
  password: string;
};

type AddWatchlistPayload = {
  symbol: string;
  exchange: Exchange;
};

export const authApi = {
  register(payload: AuthPayload) {
    return request<TokenPair>("/auth/register", {
      method: "POST",
      body: payload
    });
  },

  login(payload: AuthPayload) {
    return request<TokenPair>("/auth/login", {
      method: "POST",
      body: payload
    });
  },

  refresh() {
    const tokens = getStoredTokens();
    return request<TokenPair>("/auth/refresh", {
      method: "POST",
      body: {
        refresh_token: tokens?.refresh_token ?? ""
      }
    });
  },

  logout() {
    const tokens = getStoredTokens();
    return request<null>("/auth/logout", {
      method: "POST",
      auth: true,
      body: {
        refresh_token: tokens?.refresh_token ?? ""
      }
    });
  },

  me(signal?: AbortSignal) {
    return request<UserProfile>("/auth/me", {
      auth: true,
      signal
    });
  }
};

export const watchlistApi = {
  list(signal?: AbortSignal) {
    return request<WatchlistItem[]>("/watchlist", {
      auth: true,
      signal
    });
  },

  add(payload: AddWatchlistPayload) {
    return request<WatchlistItem>("/watchlist", {
      method: "POST",
      auth: true,
      body: payload
    });
  },

  remove(stockId: string) {
    return request<null>(`/watchlist/${stockId}`, {
      method: "DELETE",
      auth: true
    });
  }
};

export const dailyContextApi = {
  list(date: string, signal?: AbortSignal) {
    return request<DailyContextItem[]>(`/daily-context?date=${encodeURIComponent(date)}`, {
      auth: true,
      signal
    });
  },

  harvest(date: string) {
    return request<DailyContextHarvestSummary>(`/daily-context/harvest?date=${encodeURIComponent(date)}`, {
      method: "POST",
      auth: true
    });
  },

  requeueSummaries(contextId: string) {
    return request<Record<string, unknown> | null>(`/daily-context/${contextId}/summaries`, {
      method: "POST",
      auth: true
    });
  },

  taskStatus(taskId: string, signal?: AbortSignal) {
    return request<SummaryTaskStatus>(`/daily-context/tasks/${taskId}`, {
      auth: true,
      signal
    });
  }
};

export const marketApi = {
  overview(signal?: AbortSignal) {
    return request<MarketOverviewItem[]>("/market-overview", {
      auth: true,
      signal
    });
  }
};
