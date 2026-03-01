import { ApiEnvelope } from "../types/api";
import { getTokens, saveTokens, StoredTokens } from "./storage";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://127.0.0.1:8000";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  retry?: boolean;
  form?: URLSearchParams;
}

interface ApiErrorShape {
  code?: string;
  details?: unknown;
}

interface EnvelopeShape {
  success?: boolean;
  message?: string;
  data?: unknown;
  error?: ApiErrorShape | null;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details ?? null;
  }
}

function asObject(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  return input as Record<string, unknown>;
}

function asEnvelope(input: unknown): EnvelopeShape | null {
  const candidate = asObject(input);
  if (!candidate) {
    return null;
  }
  if (!("success" in candidate) || !("message" in candidate)) {
    return null;
  }
  return candidate as EnvelopeShape;
}

function extractTokens(input: unknown, fallback?: StoredTokens): StoredTokens | null {
  const candidate = asObject(input);
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

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function refreshAccessToken(tokens: StoredTokens): Promise<StoredTokens | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: tokens.refreshToken })
  });

  const parsed = await parseJson(response);
  const envelope = asEnvelope(parsed);

  if (!response.ok || !envelope || !envelope.success) {
    return null;
  }

  const nextTokens = extractTokens(envelope.data, tokens);
  if (!nextTokens) {
    return null;
  }

  saveTokens(nextTokens);
  return nextTokens;
}

function toApiClientError(payload: unknown, status: number, statusText: string): ApiClientError {
  const envelope = asEnvelope(payload);

  if (envelope) {
    const code = envelope.error?.code ?? "API_ERROR";
    const message = envelope.message ?? "Request failed";
    return new ApiClientError(message, code, status, envelope.error?.details);
  }

  if (typeof payload === "string") {
    return new ApiClientError(payload, "HTTP_ERROR", status, null);
  }

  return new ApiClientError(statusText || "Request failed", "HTTP_ERROR", status, payload);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers ?? {});
  const tokens = getTokens();

  if (options.auth && tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  let body: string | undefined;
  if (options.form) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    body = options.form.toString();
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body
  });

  const payload = await parseJson(response);

  if (response.status === 401 && options.auth && !options.retry && tokens?.refreshToken) {
    const nextTokens = await refreshAccessToken(tokens);
    if (nextTokens) {
      return request<T>(path, { ...options, retry: true });
    }
  }

  if (!response.ok) {
    throw toApiClientError(payload, response.status, response.statusText);
  }

  const envelope = asEnvelope(payload);
  if (!envelope) {
    throw new ApiClientError("Unexpected response envelope", "BAD_RESPONSE", response.status, payload);
  }

  if (!envelope.success) {
    throw new ApiClientError(
      envelope.message ?? "Request failed",
      envelope.error?.code ?? "API_ERROR",
      response.status,
      envelope.error?.details
    );
  }

  return envelope as ApiEnvelope<T>;
}
