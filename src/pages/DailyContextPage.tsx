import { useEffect, useRef, useState } from "react";
import { dailyContextApi } from "../lib/api";
import { formatCurrency, formatDateLabel, formatPercent, getTodayInputValue, toHeadlineSourceLabel } from "../lib/format";
import { getApiErrorMessage, isAbortError } from "../lib/http";
import { useNotice } from "../providers/NoticeProvider";
import { DailyContextItem } from "../types/api";

/** Returns true only when snippet adds real information beyond the headline title. */
function snippetIsDistinct(snippet: string | null, title: string): boolean {
  if (!snippet) return false;
  const s = snippet.toLowerCase().trim();
  const t = title.toLowerCase().trim();
  // Snippet is useless if it starts with the first 30 chars of the title (title + source name pattern)
  if (t.length >= 10 && s.startsWith(t.substring(0, Math.min(t.length, 40)))) return false;
  return true;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ContextDetail({ ctx }: { ctx: DailyContextItem }): JSX.Element {
  const isNegative = ctx.price_change_percent !== null && ctx.price_change_percent < 0;

  return (
    <article className={`surface-card context-card ${isNegative ? "context-card-negative" : "context-card-positive"}`}>
      <div className="context-head">
        <div className="context-identity">
          <p className="context-title">{ctx.company_name || ctx.input_symbol}</p>
          <div className="context-subline">
            {ctx.input_symbol && <span>{ctx.input_symbol}</span>}
            {ctx.exchange && <span className="exchange-badge">{ctx.exchange}</span>}
          </div>
        </div>
        <div className={`move-badge ${isNegative ? "negative" : "positive"}`}>
          {formatPercent(ctx.price_change_percent)}
        </div>
      </div>

      <div className="context-price-row">
        <div className="price-metric">
          <span className="price-metric-label">Close</span>
          <span className="price-metric-value">{formatCurrency(ctx.close_price, ctx.currency)}</span>
        </div>
        <div className="price-metric">
          <span className="price-metric-label">Prev close</span>
          <span className="price-metric-value">{formatCurrency(ctx.previous_close, ctx.currency)}</span>
        </div>
        <div className="price-metric">
          <span className="price-metric-label">Change</span>
          <span className={`price-metric-value ${isNegative ? "negative" : "positive"}`}>
            {formatPercent(ctx.price_change_percent)}
          </span>
        </div>
        {ctx.price_date && (
          <div className="price-metric">
            <span className="price-metric-label">Price date</span>
            <span className="price-metric-value">{formatDateLabel(ctx.price_date)}</span>
          </div>
        )}
      </div>

      {ctx.article_count === 0 ? (
        <div className="headline-empty">
          <p>No relevant headlines found for this date.</p>
        </div>
      ) : (
        <div className="headline-section">
          <p className="headline-section-label">
            {ctx.article_count} headline{ctx.article_count === 1 ? "" : "s"}
          </p>
          <div className="headline-stack">
            {(ctx.top_headlines ?? []).map((headline, i) => (
              <div key={`${ctx.id}-${i}`} className="news-card">
                <div className="news-card-meta">
                  <div className="news-card-meta-left">
                    <span className="news-source-badge">
                      {toHeadlineSourceLabel(headline.source)}
                    </span>
                    <span className="news-time">{timeAgo(headline.published_at)}</span>
                  </div>
                  {headline.url && (
                    <a href={headline.url} target="_blank" rel="noreferrer" className="news-read-link">
                      Read →
                    </a>
                  )}
                </div>
                <p className="news-title">{headline.title}</p>
                {headline.summary_status === "completed" && headline.summary ? (
                  <p className="news-summary">{headline.summary}</p>
                ) : (headline.summary_status === "pending" || headline.summary_status === "processing") ? (
                  <p className="news-summary-pending">Generating summary…</p>
                ) : snippetIsDistinct(headline.snippet, headline.title) ? (
                  <p className="news-snippet">{headline.snippet}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

const HARVEST_STEPS = [
  "Connecting to market data services…",
  "Phase 1 — Resolving ticker symbols…",
  "Phase 2 — Fetching prices & headlines in parallel…",
  "Phase 3 — Generating article summaries…",
];


export function DailyContextPage(): JSX.Element {
  const { showNotice } = useNotice();

  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [contexts, setContexts] = useState<DailyContextItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingStored, setIsRefreshingStored] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [harvestStep, setHarvestStep] = useState(0);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);
  const POLL_MAX_ATTEMPTS = 18; // ~90s at 5s intervals

  function hasPendingSummaries(ctxList: DailyContextItem[]): boolean {
    return ctxList.some(
      (c) =>
        c.summary_status === "queued" ||
        c.summary_status === "processing" ||
        (c.top_headlines ?? []).some(
          (h) => h.summary_status === "pending" || h.summary_status === "processing"
        )
    );
  }

  function stopPolling(): void {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }

  async function loadStoredContexts(options?: { silent?: boolean; showSuccess?: boolean; signal?: AbortSignal }): Promise<DailyContextItem[]> {
    const silent = options?.silent ?? false;
    if (!silent) setIsLoading(true);

    try {
      const response = await dailyContextApi.list(selectedDate, options?.signal);
      setContexts(response.data);
      if (options?.showSuccess) showNotice(response.message, "success");
      return response.data;
    } catch (error) {
      if (!isAbortError(error)) {
        showNotice(getApiErrorMessage(error), "error");
      }
      return [];
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsRefreshingStored(false);
      }
    }
  }

  useEffect(() => {
    const abortController = new AbortController();
    stopPolling();
    setContexts([]);
    setSelectedId(null);
    void loadStoredContexts({ signal: abortController.signal });
    return () => { abortController.abort(); stopPolling(); };
  }, [selectedDate]);

  async function handleLoadStored(): Promise<void> {
    setIsRefreshingStored(true);
    await loadStoredContexts({ showSuccess: true });
  }

  async function handleHarvest(): Promise<void> {
    setIsHarvesting(true);
    setHarvestStep(0);
    stopPolling();

    // Advance through steps while waiting for the response
    let step = 0;
    stepTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, HARVEST_STEPS.length - 1);
      setHarvestStep(step);
    }, 4000);

    try {
      const response = await dailyContextApi.harvest(selectedDate);
      setContexts(response.data.contexts);
      showNotice(response.message, "success");

      // Poll for summary updates if any summaries are still being generated
      if (hasPendingSummaries(response.data.contexts)) {
        pollAttemptsRef.current = 0;
        pollTimerRef.current = setInterval(() => {
          pollAttemptsRef.current += 1;
          if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
            stopPolling();
            return;
          }
          void loadStoredContexts({ silent: true }).then((latest) => {
            if (!hasPendingSummaries(latest)) stopPolling();
          });
        }, 5000);
      }
    } catch (error) {
      showNotice(getApiErrorMessage(error), "error");
    } finally {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setIsHarvesting(false);
    }
  }

  const totalArticles = contexts.reduce((n, c) => n + c.article_count, 0);
  const selectedContext = contexts.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Daily Context</p>
          <h2>Market news by company</h2>
          <p className="muted">Select a company to view its prices and headlines.</p>
        </div>
        <div className="page-actions" />
      </header>

      <section className="insight-grid">
        <article className="surface-card insight-card insight-card-primary">
          <span>Date</span>
          <strong>{formatDateLabel(selectedDate)}</strong>
          <small>{contexts.length} companies loaded</small>
        </article>
        <article className="surface-card insight-card">
          <span>Headlines</span>
          <strong>{totalArticles}</strong>
          <small>Across all companies</small>
        </article>
      </section>

      {isHarvesting && <div className="progress-bar" />}

      <section className="surface-card controls-card">
        <div className="controls-bar">
          <div className="field-group date-field">
            <label htmlFor="context-date">Date</label>
            <input
              id="context-date"
              type="date"
              value={selectedDate}
              max={getTodayInputValue()}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="button-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void handleLoadStored()}
              disabled={isLoading || isRefreshingStored || isHarvesting}
            >
              {isRefreshingStored ? (
                <><span className="btn-spinner" /> Loading...</>
              ) : "Load stored"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleHarvest()}
              disabled={isHarvesting || isLoading}
            >
              {isHarvesting ? (
                <><span className="btn-spinner" /> Fetching...</>
              ) : "Fetch latest"}
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="surface-card inline-loader">
          <div className="spinner" />
          <p>Loading context for {formatDateLabel(selectedDate)}...</p>
        </div>
      ) : isHarvesting ? (
        <div className="surface-card harvest-log-panel">
          <p className="harvest-log-title">Harvest in progress</p>
          <div className="harvest-log-steps">
            {HARVEST_STEPS.map((step, i) => {
              const done = i < harvestStep;
              const active = i === harvestStep;
              return (
                <div key={step} className={`harvest-log-step ${done ? "done" : active ? "active" : "pending"}`}>
                  <span className="harvest-log-icon">
                    {done ? "✓" : active ? <span className="btn-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : "·"}
                  </span>
                  <span className="harvest-log-text">{step}</span>
                </div>
              );
            })}
          </div>
          <p className="harvest-log-hint">This may take a moment for larger watchlists.</p>
        </div>
      ) : contexts.length === 0 ? (
        <div className="surface-card empty-panel">
          <h3>No context for {formatDateLabel(selectedDate)}</h3>
          <p>Hit "Fetch latest" to harvest fresh prices and news for your watchlist.</p>
        </div>
      ) : (
        <div className="page-grid">
          <aside className="company-sidebar surface-card">
            <p className="sidebar-label">Companies · {contexts.length}</p>
            {contexts.map((ctx) => {
              const isNeg = ctx.price_change_percent !== null && ctx.price_change_percent < 0;
              return (
                <button
                  key={ctx.id}
                  type="button"
                  className={`company-item ${ctx.id === selectedId ? "active" : ""}`}
                  onClick={() => setSelectedId(ctx.id)}
                >
                  <div className="company-item-info">
                    <p className="company-item-name">{ctx.company_name || ctx.input_symbol}</p>
                    <span className="company-item-ticker">{[ctx.input_symbol, ctx.exchange].filter(Boolean).join(" · ")}</span>
                  </div>
                  <span className={`move-badge ${isNeg ? "negative" : "positive"}`}>
                    {formatPercent(ctx.price_change_percent)}
                  </span>
                </button>
              );
            })}
          </aside>

          <div className="company-detail">
            {selectedContext === null ? (
              <div className="surface-card empty-panel context-select-prompt">
                <p className="prompt-arrow">←</p>
                <h3>Select a company</h3>
                <p>Choose a company from the list to view its price data and headlines.</p>
              </div>
            ) : (
              <ContextDetail ctx={selectedContext} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
