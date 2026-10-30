import { useSyncExternalStore } from 'react';
import { configureClient } from '../api/client';
import { queryClient } from '../lib/query-client';

/**
 * Session store outside React: the API client must have the token before the first
 * request after a page reload (child effects run before parent effects, so a provider
 * with useEffect would be too late). sessionStorage: the session ends with the tab.
 */

export interface Session {
  token: string;
  email: string;
}

export type SignOutReason = 'expired' | 'user';

const STORAGE_KEY = 'btc-invest.session';
const listeners = new Set<() => void>();
let current: Session | null = load();
let lastSignOutReason: SignOutReason | null = null;

function load(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function apply(session: Session | null) {
  current = session;
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the session still lives in memory
  }
  configureClient({ token: session?.token ?? null, onUnauthorized: () => signOut('expired') });
  listeners.forEach((listener) => listener());
}

export function signIn(session: Session) {
  lastSignOutReason = null;
  apply(session);
}

export function signOut(reason: SignOutReason = 'user') {
  if (!current) return;
  lastSignOutReason = reason;
  apply(null);
  queryClient.clear(); // no data of the previous account stays in memory
}

/** Why the last session ended (read once by the login page). */
export function takeSignOutReason(): SignOutReason | null {
  const reason = lastSignOutReason;
  lastSignOutReason = null;
  return reason;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSession = () => useSyncExternalStore(subscribe, () => current);

apply(current);
