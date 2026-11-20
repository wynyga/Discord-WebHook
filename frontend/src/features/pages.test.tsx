import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../app/routes';
import { session } from '../auth/session';
import { log, page, task } from '../test/fixtures';
import { json, mockApi, renderRoutes, signIn } from '../test/utils';

beforeEach(() => {
  session.clear();
  signIn();
});

describe('Dashboard', () => {
  it('shows task and execution totals with recent runs', async () => {
    mockApi({
      'GET /dashboard/summary': () =>
        json(200, {
          data: {
            tasks: { total: 7, active: 4, paused: 2, failed: 1 },
            executions24h: { total: 30, success: 25, retrying: 3, failed: 2 },
          },
        }),
      'GET /logs': () => json(200, page([log()])),
    });
    renderRoutes(routes, '/');

    const tasks = await screen.findByRole('region', { name: 'Tasks' });
    expect(within(tasks).getByRole('link', { name: /7\s*Total tasks/ })).toHaveAttribute('href', '/tasks');
    expect(within(tasks).getByRole('link', { name: /1\s*Failed/ })).toHaveAttribute('href', '/tasks?status=failed');
    const runs = screen.getByRole('region', { name: 'Executions in the last 24 hours' });
    expect(within(runs).getByRole('link', { name: /25\s*Delivered/ })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Five most recent executions' })).toHaveTextContent('Daily report');
  });

  it('marks the current page in the navigation', async () => {
    mockApi({
      'GET /dashboard/summary': () =>
        json(200, {
          data: {
            tasks: { total: 0, active: 0, paused: 0, failed: 0 },
            executions24h: { total: 0, success: 0, retrying: 0, failed: 0 },
          },
        }),
      'GET /logs': () => json(200, page([])),
    });
    renderRoutes(routes, '/');

    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Tasks' })).not.toHaveAttribute('aria-current');
  });
});

describe('Logs page', () => {
  const failed = log({
    id: 'log-2',
    status: 'failed',
    httpStatus: 404,
    retryCount: 2,
    message: 'Discord rejected the request (HTTP 404: Unknown Webhook). Not retryable',
  });

  it('shows attempts and expands a row for the full message', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /logs': () => json(200, page([failed, log()])),
      'GET /tasks': () => json(200, page([task()])),
    });
    renderRoutes(routes, '/logs');

    const table = await screen.findByRole('table', { name: 'Execution logs, newest first' });
    const [first] = within(table).getAllByRole('row').slice(1);
    expect(first).toHaveTextContent('Failed');
    expect(first).toHaveTextContent('Retry 2');
    expect(first).toHaveTextContent('404');

    const toggle = within(first!).getByRole('button', { name: 'Details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toHaveTextContent('Unknown Webhook');
  });

  it('filters by status and task', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /logs': () => json(200, page([log()])),
      'GET /tasks': () => json(200, page([task()])),
    });
    renderRoutes(routes, '/logs');
    await screen.findByRole('table');

    await user.click(screen.getByRole('radio', { name: 'Failed' }));
    await user.selectOptions(screen.getByLabelText('Task'), 'Daily report');

    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/logs').at(-1);
      expect(last?.url.searchParams.get('status')).toBe('failed');
      expect(last?.url.searchParams.get('taskId')).toBe(task().id);
    });
  });

  it('reads the task filter from the URL (link from the task list)', async () => {
    const { calls } = mockApi({
      'GET /logs': () => json(200, page([])),
      'GET /tasks': () => json(200, page([task()])),
    });
    renderRoutes(routes, `/logs?taskId=${task().id}`);

    expect(await screen.findByText('No executions yet')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/logs')?.url.searchParams.get('taskId')).toBe(task().id);
  });

  it('pages through results', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /logs': ({ url }) => json(200, page([log()], { page: Number(url.searchParams.get('page') ?? 1), totalPages: 3, total: 41 })),
      'GET /tasks': () => json(200, page([task()])),
    });
    renderRoutes(routes, '/logs');

    await user.click(await screen.findByRole('button', { name: 'Next' }));

    await waitFor(() => expect(calls.filter((c) => c.path === '/logs').at(-1)?.url.searchParams.get('page')).toBe('2'));
    expect(await screen.findByText(/Page 2 of 3/)).toBeInTheDocument();
  });
});
