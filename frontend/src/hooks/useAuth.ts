import { useCallback, useEffect, useState } from "react";

import { ApiError, authApi, getAuthToken, setAuthToken } from "../lib/api";
import type { AuthCredentials, AuthUser } from "../lib/types";

interface AuthState {
  user: AuthUser | null;
  /** True while validating saved token on app launch. */
  loading: boolean;
}

/**
 * User authentication session hook.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setState({ user: null, loading: false });
      return;
    }

    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then((user) => setState({ user, loading: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAuthToken(null);
        setState({ user: null, loading: false });
      });

    return () => controller.abort();
  }, []);

  const login = useCallback(async (credentials: AuthCredentials) => {
    const result = await authApi.login(credentials);
    setAuthToken(result.access_token);
    setState({ user: result.user, loading: false });
  }, []);

  const register = useCallback(async (credentials: AuthCredentials) => {
    const result = await authApi.register(credentials);
    setAuthToken(result.access_token);
    setState({ user: result.user, loading: false });
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setState({ user: null, loading: false });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    isAuthenticated: state.user !== null,
    login,
    register,
    logout,
  };
}

export { ApiError };
