import { useSyncExternalStore } from 'react';

export interface Session {
  token: string;
  expiresAt: string;
}

const STORAGE_KEY = 'insignia.session';

type Listener = () => void;

/**
 * Holds the login token in memory and mirrors it to localStorage so a reload keeps the user signed
 * in. Storage can be unavailable (private mode, blocked site data); the session then lives in
 * memory only.
 */
export function createSessionStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {
  const listeners = new Set<Listener>();
  let current: Session | null = load();

  function load(): Session | null {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Session;
      return typeof parsed.token === 'string' && typeof parsed.expiresAt === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  function persist(value: Session | null) {
    try {
      if (value) storage?.setItem(STORAGE_KEY, JSON.stringify(value));
      else storage?.removeItem(STORAGE_KEY);
    } catch {
      // Keep working from memory.
    }
  }

  function emit() {
    for (const listener of listeners) listener();
  }

  return {
    /** The session, or null when signed out or expired. */
    get(now = Date.now()): Session | null {
      if (current && Date.parse(current.expiresAt) <= now) return null;
      return current;
    },
    set(value: Session) {
      current = value;
      persist(value);
      emit();
    },
    clear() {
      if (!current) return;
      current = null;
      persist(null);
      emit();
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const session = createSessionStore(browserStorage());

export function useSession(): Session | null {
  return useSyncExternalStore(session.subscribe, () => session.get());
}
