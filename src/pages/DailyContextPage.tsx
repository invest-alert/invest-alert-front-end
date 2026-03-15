import { useEffect, useState } from "react";
import { dailyContextApi } from "../lib/api";
import {
  formatCurrency,
  formatDateLabel,
  formatDateTime,
  formatPercent,
  formatSummarySource,
  getTodayInputValue,
  toHeadlineSourceLabel
} from "../lib/format";
import { getApiErrorMessage } from "../lib/http";
import { useNotice } from "../providers/NoticeProvider";
import { DailyContextHeadline, DailyContextItem } from "../types/api";

function hasPendingSummary(context: DailyContextItem): boolean {
  const status = context.summary_status.toLowerCase();
  return status === "queued" || status === "processing";
}

function hasCompletedSummary(headline: DailyContextHeadline): boolean {
  return Boolean(headline.summary && headline.summary.trim());
}

function getStatusTone(status: string): "info" | "warn" | "" {
  const normalized = status.toLowerCase();
  if (normalized === "queued" || normalized === "processing" || normalized === "pending") {
    return "info";
  }
  if (normalized === "failed" || normalized === "partial") {
    return "warn";
  }
  return "";
}

export function DailyContextPage(): JSX.Element {
  const { showNotice } = useNotice();

  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [contexts, setContexts] = useState<DailyContextItem[]>([]);
  const [harvestSummary, setHarvestSummary] = useState<{
    targetDate: string;
    processedCount: number;
    savedCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingStored, setIsRefreshingStored] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [requeuingId, setRequeuingId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  async function loadStoredContexts(options?: { silent?: boolean; showSuccess?: boolean; signal?: AbortSignal }): Promise<void> {
    const silent = options?.silent ?? false;

    if (silent) {
      setIsPolling(true);
    } else if (!options?.showSuccess || contexts.length === 0) {
      setIsLoading(true);
    }

    try {
      const response = await dailyContextApi.list(selectedDate, options?.signal);
      setContexts(response.data);

      if (options?.showSuccess) {
        showNotice(response.message, "success");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        showNotice(getApiErrorMessage(error), "error");
      }
    } finally {
      if (silent) {
        setIsPolling(false);
      } else {
        setIsRefreshingStored(false);
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const abortController = new AbortController();
    setHarvestSummary(null);
    setContexts([]);
    void loadStoredContexts({ signal: abortController.signal });

    return () => {
      abortController.abort();
    };
  }, [selectedDate]);

  const hasPending = contexts.some(hasPendingSummary);
  const totalArticles = contexts.reduce((count, context) => count + context.article_count, 0);
  const pendingCount = contexts.filter(hasPendingSummary).length;

  useEffect(() => {
    if (!hasPending) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadStoredContexts({ silent: true });
    }, 6000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasPending, selectedDate]);

  async function handleLoadStored(): Promise<void> {
    setIsRefreshingStored(true);
    await loadStoredContexts({ showSuccess: true });
  }

  async function handleHarvest(): Promise<void> {
    setIsHarvesting(true);

    try {
      const response = await dailyContextApi.harvest(selectedDate);
      setContexts(response.data.contexts);
      setHarvestSummary({
        targetDate: response.data.target_date,
        processedCount: response.data.processed_count,
        savedCount: response.data.saved_count
      });
      showNotice(response.message, "success");
    } catch (error) {
      showNotice(getApiErrorMessage(error), "error");
    } finally {
      setIsHarvesting(false);
    }
  }

  async function handleRequeue(contextId: string): Promise<void> {
    setRequeuingId(contextId);

    try {
      const response = await dailyContextApi.requeueSummaries(contextId);
      showNotice(response.message, "success");
      await loadStoredContexts({ silent: true });
    } catch (error) {
      showNotice(getApiErrorMessage(error), "error");
    } finally {
      setRequeuingId(null);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Daily Context</p>
          <h2>Review saved price moves and stock-specific headlines for one date at a time.</h2>
          <p className="muted">Stored data loads by date. Fresh harvest only runs when you explicitly request it.</p>
        </div>
        <div className="page-actions">
          {hasPending ? <span className="status-pill info">{isPolling ? "Polling summaries..." : "Summary updates pending"}</span> : null}
        </div>
      </header>

      <section className="insight-grid">
        <article className="surface-card insight-card insight-card-primary">
          <span>Selected date</span>
          <strong>{formatDateLabel(selectedDate)}</strong>
          <small>{contexts.length} saved contexts currently loaded</small>
        </article>
        <article className="surface-card insight-card">
          <span>Total headlines</span>
          <strong>{totalArticles}</strong>
          <small>Across all companies for {selectedDate}</small>
        </article>
        <article className="surface-card insight-card">
          <span>Pending summaries</span>
          <strong>{pendingCount}</strong>
          <small>{pendingCount > 0 ? "Auto-refresh is active" : "Everything is up to date"}</small>
        </article>
        <article className="surface-card insight-card">
          <span>Last harvest</span>
          <strong>{harvestSummary ? `${harvestSummary.savedCount}/${harvestSummary.processedCount}` : "Not run"}</strong>
          <small>{harvestSummary ? `Saved vs processed for ${harvestSummary.targetDate}` : "Run Fetch latest to generate new context"}</small>
        </article>
      </section>

      <section className="surface-card controls-card">
        <div className="toolbar-row">
          <div className="field-group">
            <label htmlFor="context-date">Context date</label>
            <input
              id="context-date"
              type="date"
              value={selectedDate}
              max={getTodayInputValue()}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>

          <div className="button-row">
            <button type="button" className="btn btn-ghost" onClick={() => void handleLoadStored()} disabled={isLoading || isRefreshingStored}>
              {isRefreshingStored ? "Loading..." : "Load stored"}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void handleHarvest()} disabled={isHarvesting}>
              {isHarvesting ? "Fetching latest..." : "Fetch latest"}
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="surface-card inline-loader">
          <div className="spinner" />
          <p>Loading stored daily context for {selectedDate}...</p>
        </div>
      ) : contexts.length === 0 ? (
        <div className="surface-card empty-panel">
          <h3>No stored context for {selectedDate}</h3>
          <p>Use Fetch latest to harvest fresh market context for every stock in the watchlist.</p>
        </div>
      ) : (
        <div className="context-grid">
          {contexts.map((context) => (
            <article
              key={context.id}
              className={`surface-card context-card ${
                context.price_change_percent !== null && context.price_change_percent < 0 ? "context-card-negative" : "context-card-positive"
              }`}
            >
              <div className="context-head">
                <div className="context-identity">
                  <p className="context-title">{context.company_name || context.input_symbol}</p>
                  <div className="context-subline">
                    <span>{context.input_symbol}</span>
                    <span className="exchange-badge">{context.exchange}</span>
                    {context.resolved_symbol ? <span className="soft-tag">{context.resolved_symbol}</span> : null}
                  </div>
                </div>

                <div className="context-actions">
                  <div
                    className={`move-badge ${
                      context.price_change_percent !== null && context.price_change_percent < 0 ? "negative" : "positive"
                    }`}
                  >
                    {formatPercent(context.price_change_percent)}
                  </div>
                  <span className={`status-pill ${getStatusTone(context.summary_status)}`}>
                    {context.summary_status}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void handleRequeue(context.id)}
                    disabled={requeuingId === context.id}
                  >
                    {requeuingId === context.id ? "Retrying..." : "Retry summaries"}
                  </button>
                </div>
              </div>

              <dl className="context-metrics">
                <div>
                  <dt>Context date</dt>
                  <dd>{formatDateLabel(context.context_date)}</dd>
                </div>
                <div>
                  <dt>Price date</dt>
                  <dd>{formatDateLabel(context.price_date)}</dd>
                </div>
                <div>
                  <dt>Close price</dt>
                  <dd>{formatCurrency(context.close_price, context.currency)}</dd>
                </div>
                <div>
                  <dt>Previous close</dt>
                  <dd>{formatCurrency(context.previous_close, context.currency)}</dd>
                </div>
                <div>
                  <dt>Move</dt>
                  <dd className={context.price_change_percent !== null && context.price_change_percent < 0 ? "negative" : "positive"}>{formatPercent(context.price_change_percent)}</dd>
                </div>
                <div>
                  <dt>Fetched at</dt>
                  <dd>{formatDateTime(context.fetched_at)}</dd>
                </div>
              </dl>

              {hasPendingSummary(context) ? (
                <div className="summary-note">
                  Summaries are still being generated for this context. The page will keep polling the stored data until they complete.
                </div>
              ) : null}

              <div className="context-meta-row">
                <span className="soft-tag">Articles: {context.article_count}</span>
                {context.summary_requested_at ? <span className="soft-tag">Requested: {formatDateTime(context.summary_requested_at)}</span> : null}
                {context.summary_completed_at ? <span className="soft-tag">Completed: {formatDateTime(context.summary_completed_at)}</span> : null}
              </div>

              {context.summary_error ? <p className="inline-error">Summary error: {context.summary_error}</p> : null}

              {context.article_count === 0 ? (
                <div className="headline-empty">
                  <h4>No relevant headlines found</h4>
                  <p>The backend did not find articles worth attaching to this company for the selected date.</p>
                </div>
              ) : (
                <div className="headline-section">
                  <div className="headline-section-head">
                    <div>
                      <p className="eyebrow">Relevant headlines</p>
                      <h4>{context.article_count} matched article{context.article_count === 1 ? "" : "s"}</h4>
                    </div>
                  </div>

                  <div className="headline-stack">
                  {(context.top_headlines ?? []).map((headline, index) => (
                    <article key={`${context.id}-${headline.title}-${index}`} className="headline-card">
                      <div className="headline-top">
                        <div>
                          <div className="headline-meta-row">
                            <span className="headline-source">{toHeadlineSourceLabel(headline.source)}</span>
                            {headline.published_at ? <span>{formatDateTime(headline.published_at)}</span> : null}
                            <span className={`summary-chip ${getStatusTone(headline.summary_status || "pending")}`}>{headline.summary_status || "pending"}</span>
                          </div>
                          <p className="headline-title">{headline.title}</p>
                        </div>
                        {headline.url ? (
                          <a href={headline.url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                            Open article
                          </a>
                        ) : null}
                      </div>

                      {hasCompletedSummary(headline) ? (
                        <div className="headline-summary">
                          <p>{headline.summary}</p>
                          <div className="headline-tags">
                            <span className="soft-tag">{formatSummarySource(headline.summary_source)}</span>
                            {headline.summary_generated_at ? <span className="soft-tag">{formatDateTime(headline.summary_generated_at)}</span> : null}
                          </div>
                        </div>
                      ) : (
                        <div className="headline-fallback">
                          <p>{headline.snippet || headline.content_excerpt || "Summary not available yet."}</p>
                          <div className="headline-tags">
                            <span className="soft-tag">{formatSummarySource(headline.summary_source)}</span>
                            {headline.summary_error ? <span className="soft-tag soft-tag-warn">{headline.summary_error}</span> : null}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
