export type Scheme = 'light' | 'dark';
/** `null` means "follow the system". */
export type StoredScheme = Scheme | null;

export const THEME_STORAGE_KEY = 'color-scheme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Two-state toggle: the user always gets the opposite of what they see. If that matches the system
 * preference they are undoing their override, so nothing is stored and the system is followed again.
 * Only checked when toggling: an override that the system later happens to match is kept.
 */
export function nextStoredScheme(stored: StoredScheme, system: Scheme): StoredScheme {
  const rendered = stored ?? system;
  const target: Scheme = rendered === 'dark' ? 'light' : 'dark';
  return target === system ? null : target;
}

export function systemScheme(): Scheme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

export function readStoredScheme(): StoredScheme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Applies the scheme even when it cannot be saved. */
export function applyStoredScheme(value: StoredScheme): void {
  try {
    if (value) localStorage.setItem(THEME_STORAGE_KEY, value);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Applied for this page only.
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) meta.content = value ?? 'light dark';
}

/** Calls back when the system preference flips or another tab changes the override. */
export function watchScheme(onChange: () => void): () => void {
  const media = window.matchMedia?.(DARK_QUERY);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (meta) meta.content = event.newValue ?? 'light dark';
    onChange();
  };
  media?.addEventListener('change', onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    media?.removeEventListener('change', onChange);
    window.removeEventListener('storage', onStorage);
  };
}
