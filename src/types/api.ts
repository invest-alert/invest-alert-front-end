export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  error: null;
};

export type ApiError = {
  success: false;
  message: string;
  data: null;
  error: {
    code: string;
    details: unknown;
  } | null;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
};

export type UserProfile = {
  id: string;
  email: string;
  created_at: string;
};

export type Exchange = "NSE" | "BSE";

export type WatchlistItem = {
  id: string;
  symbol: string;
  exchange: Exchange;
  resolved_symbol: string | null;
  resolved_company_name: string | null;
  created_at: string;
};

export type DailyContextHeadline = {
  title: string;
  url: string | null;
  source: string | null;
  published_at: string | null;
  snippet: string | null;
  summary: string | null;
  summary_status: string | null;
  summary_error: string | null;
  summary_source: string | null;
  summary_generated_at: string | null;
  content_excerpt: string | null;
};

export type DailyContextItem = {
  id: string;
  context_date: string;
  price_date: string | null;
  company_name: string;
  input_symbol: string;
  resolved_symbol: string | null;
  exchange: string;
  close_price: number | null;
  previous_close: number | null;
  price_change_percent: number | null;
  currency: string | null;
  top_headlines: DailyContextHeadline[] | null;
  article_count: number;
  summary_job_id: string | null;
  summary_status: string;
  summary_error: string | null;
  summary_requested_at: string | null;
  summary_completed_at: string | null;
  fetched_at: string;
};

export type DailyContextHarvestSummary = {
  target_date: string;
  processed_count: number;
  saved_count: number;
  contexts: DailyContextItem[];
};

export type SummaryTaskStatus = {
  task_id: string;
  status: string;
  ready: boolean;
  successful: boolean;
  failed: boolean;
  result: Record<string, unknown> | null;
  error: string | null;
};

export type NoticeTone = "success" | "error" | "info";
