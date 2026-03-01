export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

const TOKEN_KEY = "invest_alert_tokens";

function isBrowserReady(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getTokens(): StoredTokens | null {
  if (!isBrowserReady()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(TOKEN_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredTokens;
    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  if (!isBrowserReady()) {
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  if (!isBrowserReady()) {
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
}
