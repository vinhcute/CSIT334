export interface TokenStore {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  tokenStore?: TokenStore;
  onUnauthorized?: () => void;
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  authenticated?: boolean;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}.`);
    this.name = "ApiError";
  }
}

export class ApiResponseFormatError extends Error {
  constructor(public readonly status: number) {
    super(
      `The API returned an unexpected non-JSON response. Status ${status}. Rebuild and restart the backend server so the latest routes are running, then retry.`,
    );
    this.name = "ApiResponseFormatError";
  }
}

export function createLocalStorageTokenStore(storageKey = "unipark.authToken"): TokenStore {
  return {
    getToken: () => {
      if (typeof window === "undefined") {
        return null;
      }

      return window.localStorage.getItem(storageKey);
    },
    setToken: (token: string) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, token);
      }
    },
    clearToken: () => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(storageKey);
      }
    },
  };
}

export function createApiClient(options: ApiClientOptions = {}) {
  const tokenStore = options.tokenStore ?? createLocalStorageTokenStore();
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? "";

  async function request<T>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
    const headers = new Headers();

    if (requestOptions.body !== undefined) {
      headers.set("content-type", "application/json");
    }

    if (requestOptions.authenticated) {
      const token = tokenStore.getToken();

      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: requestOptions.method ?? "GET",
      headers,
      body:
        requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
    });
    const body = await parseResponseBody(response);

    if (response.status === 401) {
      tokenStore.clearToken();
      options.onUnauthorized?.();
    }

    if (!response.ok) {
      throw new ApiError(response.status, body);
    }

    return body as T;
  }

  return {
    request,
    getToken: () => tokenStore.getToken(),
    setAuthToken: (token: string) => tokenStore.setToken(token),
    clearAuthToken: () => tokenStore.clearToken(),
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiResponseFormatError(response.status);
  }
}
