import { NavLink, Outlet } from 'react-router';
import { session } from '../auth/session';
import { Icon, type IconName } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/', label: 'Overview', icon: 'grid', end: true },
  { to: '/tasks', label: 'Tasks', icon: 'list' },
  { to: '/logs', label: 'Logs', icon: 'logs' },
];

/**
 * One <nav> at every width: a sidebar on wide screens, a top row on narrow ones (three links fit, so
 * there is no drawer). NavLink sets aria-current="page"; the active link also gets a filled
 * background and an inset bar, so color is not the only cue.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_minmax(0,1fr)]">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur md:h-dvh md:border-e md:border-b-0 md:bg-canvas">
        <div className="flex h-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:flex-col md:flex-nowrap md:items-stretch md:px-3 md:py-4">
          <a href="/" className="flex items-center gap-2.5 rounded-md px-1.5 py-1 font-semibold md:mb-5">
            <span className="grid size-7 place-items-center rounded-md bg-ink text-on-ink">
              <Icon name="webhook" className="size-4" />
            </span>
            <span className="tracking-tight">Scheduler</span>
          </a>

          <nav aria-label="Primary" className="order-last w-full md:order-none md:flex-1">
            <p className="eyebrow mb-1.5 hidden px-2 md:block">Workspace</p>
            <ul className="flex gap-1 md:flex-col md:gap-0.5">
              {NAV.map((item) => (
                <li key={item.to} className="flex-1 md:flex-none">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className="relative flex min-h-9 items-center justify-center gap-2.5 rounded-md px-2.5 font-medium text-muted hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:text-fg aria-[current=page]:shadow-sm aria-[current=page]:ring-1 aria-[current=page]:ring-line md:justify-start md:aria-[current=page]:before:absolute md:aria-[current=page]:before:inset-y-2 md:aria-[current=page]:before:-start-3 md:aria-[current=page]:before:w-0.5 md:aria-[current=page]:before:rounded-full md:aria-[current=page]:before:bg-ink"
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
            <button type="button" className="btn btn-ghost btn-sm text-muted" onClick={() => session.clear()}>
              <Icon name="logout" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-10 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
