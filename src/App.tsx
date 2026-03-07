import { FormEvent, useEffect, useMemo, useState } from "react";
import { authApi, watchlistApi } from "./lib/api";
import { ApiClientError, API_BASE_URL } from "./lib/http";
import { clearTokens, getTokens, saveTokens, StoredTokens } from "./lib/storage";
import { AuthTokenData, UserProfile, WatchlistEntry } from "./types/api";

const WATCHLIST_LIMIT = 15;

type AuthMode = "login" | "register";
type Exchange = "NSE" | "BSE";

function asObject(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  return input as Record<string, unknown>;
}

function extractTokens(data: unknown, fallback?: StoredTokens): StoredTokens | null {
  const candidate = asObject(data);
  if (!candidate) {
    return null;
  }

  const accessToken = (candidate.access_token as string | undefined) ?? fallback?.accessToken;
  const refreshToken = (candidate.refresh_token as string | undefined) ?? fallback?.refreshToken;
  const tokenType = ((candidate.token_type as string | undefined) ?? fallback?.tokenType ?? "bearer").toLowerCase();

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    tokenType
  };
}

function parseWatchlist(data: unknown): WatchlistEntry[] {
  if (Array.isArray(data)) {
    return data;
  }

  const candidate = asObject(data);
  if (!candidate) {
    return [];
  }

  if (Array.isArray(candidate.watchlist)) {
    return candidate.watchlist as WatchlistEntry[];
  }
  if (Array.isArray(candidate.items)) {
    return candidate.items as WatchlistEntry[];
  }

  return [];
}

function normalizeEntry(entry: WatchlistEntry, index: number): WatchlistEntry {
  const symbol = (entry.symbol ?? entry.ticker ?? "").toString().trim().toUpperCase();
  const exchange = (entry.exchange ?? "NSE").toString().trim().toUpperCase();
  const companyName = (entry.company_name ?? entry.stock_name ?? "").toString().trim();
  const id = entry.stock_id ?? entry.id ?? `${symbol || "STOCK"}-${index}`;
  return {
    ...entry,
    id,
    stock_id: entry.stock_id ?? id,
    symbol,
    exchange,
    company_name: companyName
  };
}

function getEntryKey(entry: WatchlistEntry, index: number): string {
  return String(entry.stock_id ?? entry.id ?? `${entry.symbol ?? "stock"}-${index}`);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error. Please try again.";
}

function getDisplayName(user: UserProfile | null): string {
  if (!user) {
    return "Investor";
  }
  return user.full_name ?? user.name ?? user.email ?? "Investor";
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Recently added";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently added";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function App(): JSX.Element {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [symbolInput, setSymbolInput] = useState("");
  const [selectedExchange, setSelectedExchange] = useState<Exchange>("NSE");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);

  const [isBooting, setIsBooting] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isFetchingWatchlist, setIsFetchingWatchlist] = useState(false);
  const [isMutatingWatchlist, setIsMutatingWatchlist] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const watchlistRemaining = WATCHLIST_LIMIT - watchlist.length;
  const isWatchlistFull = watchlist.length >= WATCHLIST_LIMIT;

  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }, []);

  function resetFeedback(): void {
    setStatusMessage("");
    setErrorMessage("");
  }

  async function loadSessionData(silent = false): Promise<boolean> {
    if (!silent) {
      setIsBooting(true);
    }

    try {
      const [profileResponse, watchlistResponse] = await Promise.all([authApi.me(), watchlistApi.list()]);
      const nextUser = (profileResponse.data ?? null) as UserProfile | null;
      const list = parseWatchlist(watchlistResponse.data).map(normalizeEntry);

      setUser(nextUser);
      setWatchlist(list);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      clearTokens();
      setUser(null);
      setWatchlist([]);
      setIsAuthenticated(false);
      if (!silent) {
        setErrorMessage(getErrorMessage(error));
      }
      return false;
    } finally {
      if (!silent) {
        setIsBooting(false);
      }
    }
  }

  useEffect(() => {
    if (!getTokens()) {
      setIsBooting(false);
      return;
    }

    void loadSessionData();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    resetFeedback();
    setIsAuthSubmitting(true);

    try {
      const response = await authApi.login({
        email: email.trim(),
        username: email.trim(),
        password
      });

      const tokens = extractTokens(response.data as AuthTokenData);
      if (!tokens) {
        throw new Error("Login succeeded but tokens were not returned by the backend.");
      }

      saveTokens(tokens);
      const isSessionLoaded = await loadSessionData(true);
      if (!isSessionLoaded) {
        throw new Error("Login succeeded but loading profile/watchlist failed.");
      }
      setStatusMessage(response.message || "Login successful.");
      setPassword("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    resetFeedback();

    if (password !== confirmPassword) {
      setErrorMessage("Password and confirm password do not match.");
      return;
    }

    setIsAuthSubmitting(true);

    try {
      const response = await authApi.register({
        email: email.trim(),
        password,
        full_name: fullName.trim() || undefined,
        name: fullName.trim() || undefined
      });

      const tokens = extractTokens(response.data as AuthTokenData);
      if (tokens) {
        saveTokens(tokens);
        const isSessionLoaded = await loadSessionData(true);
        if (!isSessionLoaded) {
          throw new Error("Registration succeeded but loading profile/watchlist failed.");
        }
        setStatusMessage(response.message || "Registration successful.");
      } else {
        setStatusMessage(response.message || "Registration successful. Please login.");
        setAuthMode("login");
      }

      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function refreshWatchlist(showMessage = true): Promise<void> {
    setIsFetchingWatchlist(true);
    if (showMessage) {
      resetFeedback();
    }

    try {
      const response = await watchlistApi.list();
      const list = parseWatchlist(response.data).map(normalizeEntry);
      setWatchlist(list);
      if (showMessage) {
        setStatusMessage(response.message || "Watchlist refreshed.");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsFetchingWatchlist(false);
    }
  }

  async function handleAddSymbol(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    resetFeedback();

    const trimmedSymbol = symbolInput.trim();
    if (!trimmedSymbol) {
      setErrorMessage("Please enter a stock symbol or company name.");
      return;
    }

    if (isWatchlistFull) {
      setErrorMessage("Watchlist limit reached (15 stocks). Remove one before adding a new stock.");
      return;
    }

    setIsMutatingWatchlist(true);
    try {
      const response = await watchlistApi.add({
        symbol: trimmedSymbol,
        exchange: selectedExchange
      });
      setSymbolInput("");
      await refreshWatchlist(false);
      setStatusMessage(response.message || `${trimmedSymbol.toUpperCase()} (${selectedExchange}) added to watchlist.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsMutatingWatchlist(false);
    }
  }

  async function handleRemove(stockId: string): Promise<void> {
    resetFeedback();
    setDeletingId(stockId);

    try {
      const response = await watchlistApi.remove(stockId);
      setWatchlist((prev) => prev.filter((entry) => String(entry.stock_id ?? entry.id) !== stockId));
      setStatusMessage(response.message || "Stock removed from watchlist.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogout(): Promise<void> {
    resetFeedback();
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API failure, local cleanup still proceeds.
    }

    clearTokens();
    setUser(null);
    setWatchlist([]);
    setIsAuthenticated(false);
    setStatusMessage("Logged out successfully.");
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <p className="eyebrow">Invest Alert</p>
          <h1>Signal over noise for your portfolio.</h1>
        </div>
        <div className="meta-block">
          <p>{dateLabel}</p>
          <p className="muted">API: {API_BASE_URL}</p>
        </div>
      </header>

      <main className="layout">
        <section className="story-card">
          <p className="eyebrow">USP</p>
          <h2>Do not tell me everything, tell me what matters to my money.</h2>
          <p>
            This MVP is focused on Indian retail investors. Track only what you own, cut market noise, and keep the watchlist
            tight and actionable.
          </p>

          <div className="pill-row">
            <span className="pill">NSE/BSE Focus</span>
            <span className="pill">JWT Auth</span>
            <span className="pill">Watchlist Limit: 15</span>
          </div>
        </section>

        <section className="workspace-card">
          {statusMessage && <div className="alert alert-success">{statusMessage}</div>}
          {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

          {isBooting ? (
            <div className="loader-block">
              <div className="spinner" />
              <p>Connecting to your Invest Alert backend...</p>
            </div>
          ) : !isAuthenticated ? (
            <div className="auth-panel">
              <div className="tabs">
                <button
                  type="button"
                  className={`tab-btn ${authMode === "login" ? "active" : ""}`}
                  onClick={() => {
                    setAuthMode("login");
                    resetFeedback();
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`tab-btn ${authMode === "register" ? "active" : ""}`}
                  onClick={() => {
                    setAuthMode("register");
                    resetFeedback();
                  }}
                >
                  Register
                </button>
              </div>

              {authMode === "login" ? (
                <form className="form" onSubmit={handleLogin}>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />

                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    required
                  />

                  <button className="btn btn-primary" type="submit" disabled={isAuthSubmitting}>
                    {isAuthSubmitting ? "Logging in..." : "Login"}
                  </button>
                </form>
              ) : (
                <form className="form" onSubmit={handleRegister}>
                  <label htmlFor="fullName">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                  />

                  <label htmlFor="registerEmail">Email</label>
                  <input
                    id="registerEmail"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />

                  <label htmlFor="registerPassword">Password</label>
                  <input
                    id="registerPassword"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create password"
                    required
                  />

                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter password"
                    required
                  />

                  <button className="btn btn-primary" type="submit" disabled={isAuthSubmitting}>
                    {isAuthSubmitting ? "Creating account..." : "Create Account"}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="dashboard-panel">
              <div className="dashboard-head">
                <div>
                  <p className="eyebrow">Logged in as</p>
                  <h2>{getDisplayName(user)}</h2>
                  <p className="muted">{user?.email ?? "No email returned by backend"}</p>
                </div>
                <button className="btn btn-ghost" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>

              <div className="stats-grid">
                <article className="stat-card">
                  <p className="stat-label">Tracked Stocks</p>
                  <p className="stat-value">{watchlist.length}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Remaining Slots</p>
                  <p className="stat-value">{Math.max(0, watchlistRemaining)}</p>
                </article>
              </div>

              <form className="inline-form" onSubmit={handleAddSymbol}>
                <input
                  type="text"
                  value={symbolInput}
                  onChange={(event) => setSymbolInput(event.target.value)}
                  placeholder="Add symbol or company name (TCS / Tata Motors)"
                  disabled={isMutatingWatchlist || isWatchlistFull}
                  maxLength={80}
                />
                <select
                  value={selectedExchange}
                  onChange={(event) => setSelectedExchange(event.target.value === "BSE" ? "BSE" : "NSE")}
                  disabled={isMutatingWatchlist || isWatchlistFull}
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
                <button className="btn btn-primary" type="submit" disabled={isMutatingWatchlist || isWatchlistFull}>
                  {isMutatingWatchlist ? "Adding..." : "Add"}
                </button>
              </form>

              <div className="list-header">
                <h3>Your Watchlist</h3>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => void refreshWatchlist()}
                  disabled={isFetchingWatchlist}
                >
                  {isFetchingWatchlist ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {watchlist.length === 0 ? (
                <div className="empty-state">
                  <p>No stocks added yet.</p>
                  <p className="muted">Start by adding one stock you actively hold.</p>
                </div>
              ) : (
                <ul className="watchlist">
                  {watchlist.map((entry, index) => {
                    const id = String(entry.stock_id ?? entry.id);
                    return (
                      <li key={getEntryKey(entry, index)} className="watchlist-item" style={{ animationDelay: `${index * 60}ms` }}>
                        <div>
                          <p className="symbol">
                            {entry.symbol || "N/A"} <span className="exchange-badge">{entry.exchange || "NSE"}</span>
                          </p>
                          <p className="muted small">{entry.company_name || "Company name unavailable"}</p>
                          <p className="muted tiny">{formatDate(entry.created_at)}</p>
                        </div>
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => void handleRemove(id)}
                          disabled={deletingId === id}
                        >
                          {deletingId === id ? "Removing..." : "Remove"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
