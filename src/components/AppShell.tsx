import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { marketApi } from "../lib/api";
import { useAuth } from "../providers/AuthProvider";
import { MarketOverviewItem } from "../types/api";

const MARKET_POLL_INTERVAL_MS = 60_000;

// NSE/BSE trading hours: 09:00–16:00 IST (UTC+5:30)
function isMarketOpen(): boolean {
  const now = new Date();
  const istOffset = 5.5 * 60; // minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMinutes = (utcMinutes + istOffset) % (24 * 60);
  return istMinutes >= 9 * 60 && istMinutes < 16 * 60;
}

function formatMarketPrice(item: MarketOverviewItem): string {
  if (item.price === null) return "—";
  return item.price.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function MarketStrip(): JSX.Element {
  const [items, setItems] = useState<MarketOverviewItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchOverview(signal?: AbortSignal): Promise<void> {
    try {
      const res = await marketApi.overview(signal);
      setItems(res.data);
      setLastUpdated(new Date());
    } catch {
      // silent — stale data stays visible
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetchOverview(controller.signal);

    timerRef.current = setInterval(() => {
      if (isMarketOpen()) void fetchOverview();
    }, MARKET_POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (items.length === 0) return <></>;

  return (
    <div className="market-strip" aria-label="Live market overview">
      <div className="market-strip-items">
        {items.map((item) => {
          const isNeg = item.change_percent !== null && item.change_percent < 0;
          const isPos = item.change_percent !== null && item.change_percent > 0;
          return (
            <div key={item.ticker} className="market-strip-item">
              <span className="market-strip-label">{item.label}</span>
              <span className="market-strip-price">{formatMarketPrice(item)}</span>
              {item.change_percent !== null && (
                <span className={`market-strip-change ${isNeg ? "negative" : isPos ? "positive" : ""}`}>
                  {isPos ? "+" : ""}{item.change_percent.toFixed(2)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      {lastUpdated && (
        <span className="market-strip-ts" title={lastUpdated.toLocaleTimeString()}>
          {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

export function AppShell(): JSX.Element {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="dashboard-shell">
      <MarketStrip />

      <header className="app-header">
        <div className="app-header-main">
          <NavLink to="/" className="brand-link brand-link-app">
            <span className="brand-mark">IA</span>
            <div>
              <p className="eyebrow">Invest Alert</p>
              <h1>Market intelligence</h1>
            </div>
          </NavLink>

          <nav className="app-tabs" aria-label="Primary">
            <NavLink to="/watchlist" className={({ isActive }) => `app-tab ${isActive ? "active" : ""}`}>
              Watchlist
            </NavLink>
            <NavLink to="/daily-context" className={({ isActive }) => `app-tab ${isActive ? "active" : ""}`}>
              Daily Context
            </NavLink>
          </nav>
        </div>

        <div className="app-header-tools">
          <div className="user-chip">
            <span>{user?.email ?? "—"}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => void handleLogout()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content-shell">
        <div className="page-frame">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
