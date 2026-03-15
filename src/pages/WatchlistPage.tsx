import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { watchlistApi } from "../lib/api";
import { formatDateLabel } from "../lib/format";
import { getApiErrorMessage } from "../lib/http";
import { useAuth } from "../providers/AuthProvider";
import { useNotice } from "../providers/NoticeProvider";
import { Exchange, WatchlistItem } from "../types/api";

const WATCHLIST_LIMIT = 15;

export function WatchlistPage(): JSX.Element {
  const { user } = useAuth();
  const { showNotice } = useNotice();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState<Exchange>("NSE");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const remainingSlots = WATCHLIST_LIMIT - watchlist.length;
  const isLimitReached = watchlist.length >= WATCHLIST_LIMIT;

  useEffect(() => {
    const abortController = new AbortController();

    void (async () => {
      try {
        const response = await watchlistApi.list(abortController.signal);
        setWatchlist(response.data);
      } catch (error) {
        showNotice(getApiErrorMessage(error), "error");
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [showNotice]);

  async function refreshWatchlist(showSuccess = false): Promise<void> {
    try {
      const response = await watchlistApi.list();
      setWatchlist(response.data);
      if (showSuccess) {
        showNotice(response.message, "success");
      }
    } catch (error) {
      showNotice(getApiErrorMessage(error), "error");
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!symbol.trim()) {
      showNotice("Please enter a stock symbol or company name.", "error");
      return;
    }

    if (isLimitReached) {
      showNotice("You have reached the 15 stock watchlist limit.", "error");
      return;
    }

    setIsAdding(true);

    try {
      const response = await watchlistApi.add({
        symbol: symbol.trim(),
        exchange
      });
      setSymbol("");
      await refreshWatchlist(false);
      showNotice(response.message, "success");
    } catch (error) {
      showNotice(getApiErrorMessage(error), "error");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(stockId: string): Promise<void> {
    setDeletingId(stockId);

    try {
      const response = await watchlistApi.remove(stockId);
      setWatchlist((current) => current.filter((item) => item.id !== stockId));
      showNotice(response.message, "success");
    } catch (error) {
      showNotice(getApiErrorMessage(error), "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2>Build the watchlist your daily context runs against.</h2>
          <p className="muted">Signed in as {user?.email ?? "Unknown user"}.</p>
        </div>
        <div className="page-actions">
          <Link to="/daily-context" className="btn btn-ghost">
            Open daily context
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => void refreshWatchlist(true)} disabled={isLoading}>
            Refresh list
          </button>
        </div>
      </header>

      <section className="page-grid">
        <article className="surface-card summary-panel">
          <div className="metric-block">
            <span>Tracked stocks</span>
            <strong>{watchlist.length}</strong>
          </div>
          <div className="metric-block">
            <span>Remaining slots</span>
            <strong>{Math.max(remainingSlots, 0)}</strong>
          </div>
          <p className="muted">
            Use company names or ticker-like values. The backend resolves symbol format and prevents duplicates.
          </p>
          <p className="muted">Duplicate and validation errors come directly from backend messages.</p>
        </article>

        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Add stock</p>
              <h3>Keep it focused</h3>
            </div>
            <span className={`status-pill ${isLimitReached ? "warn" : ""}`}>
              {isLimitReached ? "Limit reached" : `${remainingSlots} slots left`}
            </span>
          </div>

          <form className="add-form" onSubmit={handleAdd}>
            <div className="field-group">
              <label htmlFor="watchlist-symbol">Symbol or company</label>
              <input
                id="watchlist-symbol"
                type="text"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                placeholder="Tata Motors or TATAMOTORS"
                maxLength={80}
                disabled={isAdding || isLimitReached}
              />
            </div>

            <div className="field-group">
              <label htmlFor="watchlist-exchange">Exchange</label>
              <select
                id="watchlist-exchange"
                value={exchange}
                onChange={(event) => setExchange(event.target.value === "BSE" ? "BSE" : "NSE")}
                disabled={isAdding || isLimitReached}
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isAdding || isLimitReached}>
              {isAdding ? "Adding..." : "Add to watchlist"}
            </button>
          </form>
        </section>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Current holdings</p>
            <h3>Your watchlist</h3>
          </div>
        </div>

        {isLoading ? (
          <div className="inline-loader">
            <div className="spinner" />
            <p>Loading your watchlist...</p>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="empty-panel">
            <h4>No stocks added yet</h4>
            <p>Add your first company to start collecting daily context.</p>
          </div>
        ) : (
          <div className="list-grid">
            {watchlist.map((item) => (
              <article key={item.id} className="watch-card">
                <div className="watch-card-head">
                  <div>
                    <h4>{item.resolved_company_name || item.symbol}</h4>
                    <p className="muted">
                      {item.symbol} <span className="exchange-badge">{item.exchange}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? "Removing..." : "Delete"}
                  </button>
                </div>

                <dl className="info-grid">
                  <div>
                    <dt>Resolved symbol</dt>
                    <dd>{item.resolved_symbol || "Pending resolution"}</dd>
                  </div>
                  <div>
                    <dt>Added on</dt>
                    <dd>{formatDateLabel(item.created_at)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
