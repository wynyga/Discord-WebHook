import { useEffect, useState } from 'react';
import { applyStoredScheme, nextStoredScheme, readStoredScheme, systemScheme, watchScheme } from '../lib/theme';
import { Icon } from './Icon';

/** Two states: follow the system, or show the opposite of it. See `nextStoredScheme`. */
export function ThemeToggle() {
  const [stored, setStored] = useState(readStoredScheme);
  const [system, setSystem] = useState(systemScheme);

  useEffect(
    () =>
      watchScheme(() => {
        setSystem(systemScheme());
        setStored(readStoredScheme());
      }),
    [],
  );

  const rendered = stored ?? system;
  const target = rendered === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle btn btn-ghost btn-sm"
      onClick={() => {
        const next = nextStoredScheme(stored, system);
        applyStoredScheme(next);
        setStored(next);
      }}
    >
      <Icon name={rendered === 'dark' ? 'moon' : 'sun'} />
      <span className="sr-only">Switch to {target} theme</span>
    </button>
  );
}
