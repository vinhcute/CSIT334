import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createApiClient, createLocalStorageTokenStore, type TokenStore } from "../../services/apiClient.js";
import { createAuthApi, type ApiClient } from "../../services/authApi.js";
import type {
  LoginRequest,
  RegisterDriverRequest,
  SafeUser,
} from "./authTypes.js";

export type AuthStatus = "idle" | "loading" | "authenticated" | "anonymous" | "error";

export interface AuthStateValue {
  user: SafeUser | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
  register(input: RegisterDriverRequest): Promise<void>;
  login(input: LoginRequest): Promise<void>;
  logout(): Promise<void>;
  refreshCurrentUser(): Promise<void>;
  updateCurrentUser(user: SafeUser): void;
}

interface AuthProviderProps {
  children: ReactNode;
  apiClient?: ApiClient;
  tokenStore?: TokenStore;
}

const AuthStateContext = createContext<AuthStateValue | null>(null);

export function AuthProvider({ children, apiClient, tokenStore }: AuthProviderProps) {
  const store = useMemo(() => tokenStore ?? createLocalStorageTokenStore(), [tokenStore]);
  const client = useMemo(
    () =>
      apiClient ??
      createApiClient({
        tokenStore: store,
        onUnauthorized: () => {
          store.clearToken();
        },
      }),
    [apiClient, store],
  );
  const authApi = useMemo(() => createAuthApi(client), [client]);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(() => client.getToken());
  const [status, setStatus] = useState<AuthStatus>(token ? "idle" : "anonymous");
  const [error, setError] = useState<string | null>(null);

  const syncToken = useCallback(() => {
    setToken(client.getToken());
  }, [client]);

  const register = useCallback(
    async (input: RegisterDriverRequest) => {
      setStatus("loading");
      setError(null);

      try {
        const result = await authApi.register(input);
        setUser(result.user);
        setStatus("anonymous");
      } catch (registrationError) {
        setError(getErrorMessage(registrationError));
        setStatus("error");
        throw registrationError;
      }
    },
    [authApi],
  );

  const login = useCallback(
    async (input: LoginRequest) => {
      setStatus("loading");
      setError(null);

      try {
        const result = await authApi.login(input);
        setUser(result.user);
        syncToken();
        setStatus("authenticated");
      } catch (loginError) {
        setError(getErrorMessage(loginError));
        setStatus("error");
        throw loginError;
      }
    },
    [authApi, syncToken],
  );

  const logout = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      await authApi.logout();
    } finally {
      setUser(null);
      syncToken();
      setStatus("anonymous");
    }
  }, [authApi, syncToken]);

  const refreshCurrentUser = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const result = await authApi.getCurrentUser();
      setUser(result.user);
      syncToken();
      setStatus("authenticated");
    } catch (currentUserError) {
      syncToken();
      setUser(null);
      setError(getErrorMessage(currentUserError));
      setStatus(client.getToken() ? "error" : "anonymous");
      throw currentUserError;
    }
  }, [authApi, client, syncToken]);

  const updateCurrentUser = useCallback((nextUser: SafeUser) => {
    setUser(nextUser);
  }, []);

  useEffect(() => {
    if (!token || user || status !== "idle") {
      return;
    }

    void refreshCurrentUser().catch(() => {
      // Auth state is updated inside refreshCurrentUser.
    });
  }, [refreshCurrentUser, status, token, user]);

  const value = useMemo(
    () => ({
      user,
      token,
      status,
      error,
      register,
      login,
      logout,
      refreshCurrentUser,
      updateCurrentUser,
    }),
    [error, login, logout, refreshCurrentUser, register, status, token, updateCurrentUser, user],
  );

  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>;
}

export function useAuthState(): AuthStateValue {
  const value = useContext(AuthStateContext);

  if (!value) {
    throw new Error("useAuthState must be used within AuthProvider.");
  }

  return value;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication request failed.";
}
