/**
 * The single, typed HTTP client for the FastAPI backend.
 *
 * - In the browser, requests go to the same-origin `/api/...` path, which Next.js
 *   rewrites to FastAPI, so cookies stay first-party.
 * - On the server (Server Components), requests go straight to API_ORIGIN.
 *
 * Response types come from the OpenAPI schema once the API exists (Phase 4). Until
 * then callers pass the expected type explicitly.
 */

export type ApiFieldError = { field: string; message: string };

/** Error envelope returned by FastAPI: `{ error: { code, message, fields? } }`. */
type ErrorEnvelope = {
  error?: { code?: unknown; message?: unknown; fields?: unknown };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: ApiFieldError[];
  readonly requestId: string | null;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    fields?: ApiFieldError[];
    requestId?: string | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields ?? [];
    this.requestId = init.requestId ?? null;
  }
}

export type RequestOptions = Omit<RequestInit, "body"> & {
  /** JSON body; serialised and sent with Content-Type: application/json. */
  json?: unknown;
  /** Query string parameters; undefined values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
};

type Fetcher = typeof fetch;

export function resolveBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  return (process.env.API_ORIGIN ?? "http://127.0.0.1:8100").replace(/\/+$/, "");
}

export function buildUrl(path: string, query?: RequestOptions["query"], base = resolveBaseUrl()) {
  if (!path.startsWith("/api/") && path !== "/health" && path !== "/ready") {
    throw new Error(`API paths must start with /api/ (got ${path})`);
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return `${base}${path}${qs ? `?${qs}` : ""}`;
}

function isFieldErrors(value: unknown): value is ApiFieldError[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ApiFieldError).field === "string" &&
        typeof (item as ApiFieldError).message === "string",
    )
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("x-request-id");
  let envelope: ErrorEnvelope | null = null;
  try {
    envelope = (await response.json()) as ErrorEnvelope;
  } catch {
    // Non-JSON error bodies (proxies, gateways) fall through to a generic message.
  }
  const error = envelope?.error;
  return new ApiError({
    status: response.status,
    code: typeof error?.code === "string" ? error.code : "http_error",
    message:
      typeof error?.message === "string"
        ? error.message
        : `The server responded with status ${response.status}.`,
    fields: isFieldErrors(error?.fields) ? error.fields : [],
    requestId,
  });
}

/** Without an explicit fetcher, the global `fetch` is looked up per request, not at import. */
export function createApiClient(fetcher?: Fetcher, baseUrl?: string) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { json, query, headers, ...init } = options;
    const finalHeaders = new Headers(headers);
    finalHeaders.set("Accept", "application/json");
    if (json !== undefined) finalHeaders.set("Content-Type", "application/json");

    let response: Response;
    try {
      response = await (fetcher ?? fetch)(buildUrl(path, query, baseUrl ?? resolveBaseUrl()), {
        ...init,
        headers: finalHeaders,
        body: json === undefined ? undefined : JSON.stringify(json),
      });
    } catch {
      throw new ApiError({
        status: 0,
        code: "network_error",
        message: "The server could not be reached. Check your connection and try again.",
      });
    }

    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    request,
    get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
    post: <T>(path: string, json?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "POST", json }),
    patch: <T>(path: string, json?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "PATCH", json }),
    put: <T>(path: string, json?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "PUT", json }),
    delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
  };
}

export const api = createApiClient();
