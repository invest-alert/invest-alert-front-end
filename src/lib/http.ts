import { ApiResponse, ApiSuccess, TokenPair } from "../types/api";
import { clearStoredTokens, getStoredTokens, saveStoredTokens } from "./storage";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://127.0.0.1:8000";

export const API_PREFIX = "/api/v1";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  retry?: boolean;
  signal?: AbortSignal;
};

type ApiErrorShape = {
  code: string;
  details: unknown;
} | null;

let unauthorizedHandler: (() => void) | null = null;

export class ApiClientError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(message: string, code: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function toApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${API_PREFIX}${normalizedPath}`;
}

function isApiResponse<T>(payload: unknown): payload is ApiResponse<T> {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return "success" in candidate && "message" in candidate && "data" in candidate && "error" in candidate;
}

async function parseResponseBody(response: Response): Promise<unknown> {
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

function getErrorShape(payload: unknown): ApiErrorShape {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as Record<string, unknown>;
  return {
    code: typeof candidate.code === "string" ? candidate.code : "API_ERROR",
    details: candidate.details ?? null
  };
}

function toApiClientError(payload: unknown, status: number, fallbackMessage: string): ApiClientError {
  if (isApiResponse(payload)) {
    const error = getErrorShape(payload);
    return new ApiClientError(payload.message, error?.code ?? "API_ERROR", status, error?.details ?? null);
  }

  if (typeof payload === "string" && payload.trim()) {
    return new ApiClientError(payload, "HTTP_ERROR", status, null);
  }

  return new ApiClientError(fallbackMessage, "HTTP_ERROR", status, payload);
}

async function refreshAccessToken(tokens: TokenPair): Promise<TokenPair | null> {
  const response = await fetch(toApiUrl("/auth/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refresh_token: tokens.refresh_token
    })
  });

  const payload = await parseResponseBody(response);
  if (!response.ok || !isApiResponse<TokenPair>(payload) || !payload.success) {
    return null;
  }

  const nextTokens = payload.data;
  saveStoredTokens(nextTokens);
  return nextTokens;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  const tokens = getStoredTokens();
  const headers = new Headers(options.headers ?? {});

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth && tokens?.access_token) {
    headers.set("Authorization", `Bearer ${tokens.access_token}`);
  }

  const response = await fetch(toApiUrl(path), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  });

  const payload = await parseResponseBody(response);

  if (response.status === 401 && options.auth && !options.retry && tokens?.refresh_token) {
    const nextTokens = await refreshAccessToken(tokens);
    if (nextTokens) {
      return request<T>(path, { ...options, retry: true });
    }

    clearStoredTokens();
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    throw toApiClientError(payload, response.status, response.statusText || "Request failed");
  }

  if (!isApiResponse<T>(payload)) {
    throw new ApiClientError("Unexpected API response format", "BAD_RESPONSE", response.status, payload);
  }

  if (!payload.success) {
    const error = getErrorShape(payload);
    throw new ApiClientError(payload.message, error?.code ?? "API_ERROR", response.status, error?.details ?? null);
  }

  return payload;
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
