"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, signOut as apiSignOut, type User } from "./api";

type AuthState = {
  user: User | null;
  /** false until the first /me answer, so pages don't flash the signed-out view */
  ready: boolean;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({ user: null, ready: false, setUser: () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut().catch(() => {});
    setUser(null);
    window.location.href = "/";
  }, []);

  return <AuthContext.Provider value={{ user, ready, setUser, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
