export interface ApiErrorPayload {
  code: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: ApiErrorPayload | null;
}

export interface AuthTokenData {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  [key: string]: unknown;
}

export interface UserProfile {
  id?: number | string;
  email?: string;
  full_name?: string;
  name?: string;
  [key: string]: unknown;
}

export interface WatchlistEntry {
  id?: number | string;
  stock_id?: number | string;
  symbol?: string;
  ticker?: string;
  company_name?: string | null;
  stock_name?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}
