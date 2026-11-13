import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, sectors, User } from '../services/api';
import { session, setOnUnauthorized } from '../services/http';
import { registerForPush } from '../services/push';
import { Sector } from '../types';

type Ctx = {
  user: User | null;
  ready: boolean;
  sector: Sector;
  setSector: (s: Sector) => void;
  login: (id: string, password: string) => Promise<void>;
  register: (b: { cedula: string; accountNumber: string; password: string; sectorId: string }) => Promise<void>;
  logout: () => Promise<void>;
};
const AppCtx = createContext<Ctx | null>(null);

async function syncPush() {
  try {
    const t = await registerForPush();
    if (t) await api.savePushToken(t);
  } catch {
    // las notificaciones son opcionales; no bloquear el inicio de sesión
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(async () => {
    await session.clear();
    setUser(null);
  }, []);

  const enter = useCallback(async (token: string, u: User) => {
    await session.set(token);
    setUser(u);
    syncPush();
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => { logout(); });
    (async () => {
      try {
        if (await session.load()) {
          const u = await api.me();
          setUser(u);
          syncPush();
        }
      } catch {
        await session.clear();
      } finally {
        setReady(true);
      }
    })();
  }, [logout]);

  const value: Ctx = {
    user,
    ready,
    sector: sectors.find((s) => s.id === user?.sectorId) ?? sectors[0],
    setSector: (s) => {
      setUser((u) => (u ? { ...u, sectorId: s.id } : u));
      api.setSector(s.id).catch(() => {});
    },
    login: async (id, password) => {
      const r = await api.login(id, password);
      await enter(r.token, r.user);
    },
    register: async (b) => {
      const r = await api.register(b);
      await enter(r.token, r.user);
    },
    logout,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp fuera de AppProvider');
  return c;
}
