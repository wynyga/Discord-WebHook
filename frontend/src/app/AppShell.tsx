import { NavLink, Outlet } from 'react-router';
import { session } from '../auth/session';
import { Icon, type IconName } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/', label: 'Dashboard', icon: 'grid', end: true },
  { to: '/tasks', label: 'Tasks', icon: 'list' },
  { to: '/logs', label: 'Logs', icon: 'logs' },
];

/**
 * One <nav> at every width: a sidebar on wide screens, a top row on narrow ones (three links fit, so
 * there is no drawer). NavLink sets aria-current="page"; the active link also gets a filled
 * background and a bar, so color is not the only cue.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <header className="sticky top-0 z-10 border-b border-line bg-surface md:h-dvh md:border-e md:border-b-0">
        <div className="flex h-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:flex-col md:flex-nowrap md:items-stretch md:px-3 md:py-5">
          <a href="/" className="flex items-center gap-2.5 font-bold md:mb-6 md:px-2">
            <span className="grid size-9 place-items-center rounded-lg bg-accent text-on-accent">
              <Icon name="clock" className="size-5" />
            </span>
            <span>Task Scheduler</span>
          </a>

          <nav aria-label="Primary" className="order-last w-full md:order-none md:flex-1">
            <ul className="flex gap-1 md:flex-col">
              {NAV.map((item) => (
                <li key={item.to} className="flex-1 md:flex-none">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className="relative flex min-h-11 items-center justify-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:text-fg md:justify-start aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2 aria-[current=page]:before:start-0 aria-[current=page]:before:w-1 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-accent"
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ms-auto flex items-center gap-1 md:ms-0 md:border-t md:border-line md:pt-3">
            <ThemeToggle />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => session.clear()}>
              <Icon name="logout" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
