import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../../app/routes';
import { session } from '../../auth/session';
import { page } from '../../test/fixtures';
import { json, mockApi, renderRoutes, signIn } from '../../test/utils';

const dashboardApis = {
  'GET /dashboard/summary': () =>
    json(200, {
      data: {
        tasks: { total: 0, active: 0, paused: 0, failed: 0 },
        executions24h: { total: 0, success: 0, retrying: 0, failed: 0 },
      },
    }),
  'GET /logs': () => json(200, page([])),
};

describe('authentication flow', () => {
  beforeEach(() => session.clear());

  it('sends signed-out users to the login page', async () => {
    renderRoutes(routes, '/tasks');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signs in and returns to the page that was asked for', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'POST /auth/login': () =>
        json(200, { data: { token: 'jwt', tokenType: 'Bearer', expiresAt: '2999-01-01T00:00:00.000Z' } }),
      ...dashboardApis,
    });
    const { router } = renderRoutes(routes, '/');

    await user.type(await screen.findByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(calls[0]?.body).toEqual({ username: 'admin', password: 'secret' });
    expect(session.get()?.token).toBe('jwt');
  });

  it('shows a focused alert for wrong credentials', async () => {
    const user = userEvent.setup();
    mockApi({
      'POST /auth/login': () => json(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' } }),
    });
    renderRoutes(routes, '/login');

    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Wrong username or password.');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('explains rate limiting', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /auth/login': () => json(429, { error: { code: 'RATE_LIMITED', message: 'Too many' } }) });
    renderRoutes(routes, '/login');

    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });

  it('validates empty fields before calling the API and focuses the first', async () => {
    const user = userEvent.setup();
    const { fetchMock } = mockApi({});
    renderRoutes(routes, '/login');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const username = screen.getByLabelText(/username/i);
    expect(username).toHaveAttribute('aria-invalid', 'true');
    // The warning icon is aria-hidden, so only the text is read.
    expect(username).toHaveAccessibleDescription('Enter your username.');
    await waitFor(() => expect(username).toHaveFocus());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('goes back to login when the API answers 401', async () => {
    signIn();
    mockApi({
      'GET /dashboard/summary': () => json(401, { error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
      'GET /logs': () => json(401, { error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
    });
    renderRoutes(routes, '/');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signs out from the shell', async () => {
    signIn();
    mockApi(dashboardApis);
    const user = userEvent.setup();
    renderRoutes(routes, '/');

    await user.click(await screen.findByRole('button', { name: /sign out/i }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(session.get()).toBeNull();
  });
});
