import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../auth/session';

/** Sends signed-out users to /login and brings them back afterwards. Also reacts to a 401 sign-out. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const current = useSession();
  const location = useLocation();
  if (!current) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return children;
}
