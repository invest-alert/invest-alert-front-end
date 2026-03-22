import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { watchlistApi } from "../lib/api";
import { formatDateLabel } from "../lib/format";
import { getApiErrorMessage, isAbortError } from "../lib/http";
import { useAuth } from "../providers/AuthProvider";
import { useNotice } from "../providers/NoticeProvider";
import { WatchlistItem } from "../types/api";

const WATCHLIST_LIMIT = 15;

export function WatchlistPage(): JSX.Element {
  const { user } = useAuth();
  const { showNotice } = useNotice();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [companyName, setCompanyName] = useState("");
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
        if (!isAbortError(error)) {
          showNotice(getApiErrorMessage(error), "error");
        }
      } finally {
        setIsLoading(false);
      }
    })();

    return () => { abortController.abort(); };
  }, [showNotice]);

  async function refreshWatchlist(showSuccess = false): Promise<void> {
    try {
      const response = await watchlistApi.list();
      setWatchlist(response.data);
      if (showSuccess) showNotice(response.message, "success");
    } catch (error) {
      showNotice(getApiErrorMessage(error), "error");
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!companyName.trim()) {
      showNotice("Please enter the company name.", "error");
      return;
    }

    if (isLimitReached) {
      showNotice("You have reached the 15 stock limit.", "error");
      return;
    }

    setIsAdding(true);

    try {
      const response = await watchlistApi.add({ company_name: companyName.trim() });
      setCompanyName("");
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
          <h2>Your watchlist</h2>
          <p className="muted">Signed in as {user?.email ?? "—"}</p>
        </div>
        <div className="page-actions">
          <Link to="/daily-context" className="btn btn-ghost">
            Daily context →
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => void refreshWatchlist(true)} disabled={isLoading}>
            {isLoading ? <><span className="btn-spinner" /> Refreshing...</> : "Refresh"}
          </button>
        </div>
      </header>

      <section className="page-grid">
        {/* Side panel */}
        <aside>
          <div className="surface-card summary-panel">
            <div className="metric-block">
              <span>Tracking</span>
              <strong>{watchlist.length}</strong>
            </div>
            <div className="metric-block">
              <span>Slots left</span>
              <strong>{Math.max(remainingSlots, 0)}</strong>
            </div>
            <p className="muted" style={{ fontSize: "0.84rem", lineHeight: "1.65" }}>
              Enter the full company name. The ticker is detected automatically. Duplicates are blocked.
            </p>
          </div>
        </aside>

        {/* Add form */}
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Add stock</p>
              <h3>Track a new company</h3>
            </div>
            <span className={`status-pill ${isLimitReached ? "warn" : ""}`}>
              {isLimitReached ? "Limit reached" : `${remainingSlots} slots left`}
            </span>
          </div>

          <form className="add-form" onSubmit={handleAdd}>
            <div className="field-group">
              <label htmlFor="watchlist-company">Company name <span style={{ color: "var(--color-danger, #e55)" }}>*</span></label>
              <input
                id="watchlist-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Tata Motors Limited"
                maxLength={100}
                required
                disabled={isAdding || isLimitReached}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isAdding || isLimitReached}>
              {isAdding ? <><span className="btn-spinner" /> Adding...</> : "Add"}
            </button>
          </form>
        </section>
      </section>

      {/* Stock list */}
      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Holdings</p>
            <h3>Current watchlist</h3>
          </div>
        </div>

        {isLoading ? (
          <div className="inline-loader">
            <div className="spinner" />
            <p>Loading watchlist...</p>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="empty-panel">
            <h4>No stocks yet</h4>
            <p>Add your first company above to start collecting daily context.</p>
          </div>
        ) : (
          <div className="list-grid">
            {watchlist.map((item) => (
              <article key={item.id} className="watch-card">
                <div className="watch-card-head">
                  <div>
                    <h4>{item.company_name}</h4>
                    {item.symbol && (
                      <p className="muted" style={{ marginTop: "0.2rem", fontSize: "0.85rem" }}>
                        {item.symbol} {item.exchange && <span className="exchange-badge">{item.exchange}</span>}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? <><span className="btn-spinner" /> Removing...</> : "Remove"}
                  </button>
                </div>

                <dl className="info-grid">
                  <div>
                    <dt>Added</dt>
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
