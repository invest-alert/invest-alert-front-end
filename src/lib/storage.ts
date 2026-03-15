import { TokenPair } from "../types/api";

const TOKEN_STORAGE_KEY = "invest_alert.auth.tokens";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredTokens(): TokenPair | null {
  if (!canUseStorage()) {
    return null;
  }

  const value = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as TokenPair;
    if (!parsed.access_token || !parsed.refresh_token) {
      return null;
    }
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      token_type: "bearer"
    };
  } catch {
    return null;
  }
}

export function saveStoredTokens(tokens: TokenPair): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export function clearStoredTokens(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}
