import { type SdkErrorCode, type SdkErrorResponse, sdkSchemas } from "./schemas";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class RadioToolsApiError extends Error {
  readonly code: SdkErrorCode | null;
  readonly requestId: string | null;
  readonly status: number;
  readonly issues?: SdkErrorResponse["error"]["issues"];

  constructor(status: number, body: SdkErrorResponse | { error: string }) {
    super(typeof body.error === "string" ? body.error : body.error.message);
    this.name = "RadioToolsApiError";
    this.status = status;
    if (typeof body.error === "string") {
      this.code = null;
      this.requestId = null;
      return;
    }
    this.code = body.error.code;
    this.requestId = body.error.requestId;
    this.issues = body.error.issues;
  }
}

export type EtagEntry<T> = { etag: string; data: T };

/** In-memory conditional GET cache. Keys include a hash of the listener token. */
export type EtagCache = Map<string, EtagEntry<unknown>>;

export function createEtagCache(): EtagCache {
  return new Map();
}

export type PublicJsonRequestOptions = {
  fetch?: FetchLike;
  /** Station credential with listener:read. Keep it on the station's server. */
  apiToken?: string;
  etagCache?: EtagCache;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  /** Extra attempts after a 429 or 503. Defaults to 2. */
  retries?: number;
};

const defaultPublicInit = {
  cache: "no-store" as RequestCache,
  credentials: "omit" as RequestCredentials,
};

function throwResponseError(status: number, body: unknown): never {
  const structured = sdkSchemas.ErrorResponse.safeParse(body);
  if (structured.success) throw new RadioToolsApiError(status, structured.data);
  const ingest = sdkSchemas.IngestErrorResponse.safeParse(body);
  if (ingest.success) throw new RadioToolsApiError(status, ingest.data);
  throw new Error(`RadioTools request failed (${status})`);
}

async function readErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`RadioTools request failed (${response.status})`);
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return Math.min(Number(retryAfter) * 1000, 5000);
  return Math.min(250 * 2 ** (attempt - 1), 5000);
}

async function sendWithRetry(
  call: FetchLike,
  url: string,
  init: RequestInit,
  retries: number,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const response = await call(url, init);
    const retryable = response.status === 429 || response.status === 503;
    if (!retryable || attempt >= retries) return response;
    attempt += 1;
    const delay = retryDelayMs(response, attempt);
    await response.body?.cancel().catch(() => undefined);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function tokenDigest(apiToken: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiToken));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readPublicJson<T>(
  url: string,
  schema: { parse: (data: unknown) => T },
  options: PublicJsonRequestOptions = {},
): Promise<{ data: T; etag: string | null; notModified: boolean }> {
  const call = options.fetch ?? fetch;
  const cache = options.etagCache;
  const digest = options.apiToken ? await tokenDigest(options.apiToken) : "";
  const cacheKey = `${url}#${digest}`;
  const cached = cache?.get(cacheKey) as EtagEntry<T> | undefined;
  const headers = new Headers();
  if (options.apiToken) headers.set("authorization", `Bearer ${options.apiToken}`);
  if (cached?.etag) headers.set("if-none-match", cached.etag);

  const response = await sendWithRetry(
    call,
    url,
    {
      method: "GET",
      headers,
      cache: options.cache ?? defaultPublicInit.cache,
      credentials: options.credentials ?? defaultPublicInit.credentials,
    },
    options.retries ?? 2,
  );

  if (response.status === 304 && cached) {
    return { data: cached.data, etag: cached.etag, notModified: true };
  }

  if (!response.ok) throwResponseError(response.status, await readErrorBody(response));

  const data = schema.parse(await response.json());
  const etag = response.headers.get("etag");
  if (cache && etag) cache.set(cacheKey, { etag, data });
  return { data, etag, notModified: false };
}

export async function postJson<T>(
  url: string,
  body: unknown,
  schema: { parse: (data: unknown) => T },
  init: {
    fetch?: FetchLike;
    headers?: HeadersInit;
    cache?: RequestCache;
    credentials?: RequestCredentials;
    retries?: number;
    rawBody?: string;
  } = {},
): Promise<T> {
  const call = init.fetch ?? fetch;
  const payload = init.rawBody ?? JSON.stringify(body);
  const response = await sendWithRetry(
    call,
    url,
    {
      method: "POST",
      headers: (() => {
        const headers = new Headers(init.headers);
        headers.set("content-type", "application/json");
        return headers;
      })(),
      body: payload,
      cache: init.cache ?? "no-store",
      credentials: init.credentials ?? "omit",
    },
    init.retries ?? 2,
  );
  if (!response.ok) throwResponseError(response.status, await readErrorBody(response));
  return schema.parse(await response.json());
}
