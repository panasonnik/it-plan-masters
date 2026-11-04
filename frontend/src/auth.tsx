import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import type { User } from './types';

interface AuthValue {
  user: User | null;
  ready: boolean;
  signIn: (path: '/auth/login' | '/auth/register', body: object) => Promise<User>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<User>('GET', '/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  async function signIn(path: '/auth/login' | '/auth/register', body: object) {
    const result = await api<{ token: string; user: User }>('POST', path, body);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }

  function signOut() {
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, ready, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  return useContext(AuthContext)!;
}
