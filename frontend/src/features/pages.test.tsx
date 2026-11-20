import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../app/routes';
import { session } from '../auth/session';
import { log, page, summary, task, taskDetail } from '../test/fixtures';
import { json, mockApi, renderRoutes, signIn } from '../test/utils';

beforeEach(() => {
  session.clear();
  signIn();
});

describe('Dashboard', () => {
  const busy = () =>
    summary({ total: 7, active: 4, paused: 2, failed: 1 }, { success: 25, retrying: 3, failed: 2 });

  it('shows execution figures, task counts and recent runs', async () => {
    mockApi({
      'GET /dashboard/summary': () => json(200, { data: busy() }),
      'GET /logs': () => json(200, page([log({ httpStatus: 404, status: 'failed' })])),
    });
    renderRoutes(routes, '/');

    const runs = await screen.findByRole('region', { name: 'Executions in the last 24 hours' });
    expect(within(runs).getByRole('link', { name: 'Attempts 30' })).toHaveAttribute('href', '/logs');
    expect(within(runs).getByRole('link', { name: 'Delivered 25' })).toHaveAttribute('href', '/logs?status=success');
    expect(within(runs).getByText('83%')).toBeInTheDocument();

    const tasks = screen.getByRole('region', { name: 'Tasks' });
    expect(within(tasks).getByRole('link', { name: '7 Total tasks' })).toHaveAttribute('href', '/tasks');
    expect(within(tasks).getByRole('link', { name: '1 Failed' })).toHaveAttribute('href', '/tasks?status=failed');

    const recent = await screen.findByRole('list', { name: 'Six most recent executions' });
    expect(within(recent).getByRole('link')).toHaveTextContent('404');
    expect(within(recent).getByRole('link')).toHaveAttribute('href', `/tasks/${task().id}?tab=runs`);
  });

  it('draws the hourly chart with a table twin', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /dashboard/summary': () => json(200, { data: busy() }),
      'GET /logs': () => json(200, page([])),
    });
    renderRoutes(routes, '/');

    const chart = await screen.findByRole('group', { name: /Hourly activity\. 30 attempts/ });
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveTextContent(/Delivered.*Retried.*Failed/);

    await user.click(screen.getByText('View as table'));
    const table = screen.getByRole('table');
    const lastRow = within(table).getAllByRole('row').at(-1)!;
    expect(within(lastRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['25', '3', '2']);

    // Keyboard reading: End jumps to the last hour and announces its values.
    chart.focus();
    await user.keyboard('{End}');
    expect(chart.querySelector('[aria-live]')).toHaveTextContent('25 delivered, 3 retried, 2 failed');
  });

  it('marks the current page in the navigation', async () => {
    mockApi({
      'GET /dashboard/summary': () => json(200, { data: summary() }),
      'GET /logs': () => json(200, page([])),
    });
    renderRoutes(routes, '/');

    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Tasks' })).not.toHaveAttribute('aria-current');
  });
});

describe('Task detail page', () => {
  const failed = log({
    id: 'log-9',
    status: 'failed',
    httpStatus: 404,
    message: 'Discord rejected the request (HTTP 404: Unknown Webhook). Not retryable',
  });

  function mockDetail(overrides: Parameters<typeof taskDetail>[0] = {}) {
    const detail = taskDetail(overrides);
    return mockApi({
      [`GET /tasks/${detail.id}`]: () => json(200, { data: detail }),
      'GET /logs': ({ url }) =>
        json(200, url.searchParams.get('status') === 'failed' ? page([failed]) : page([failed, log()], { total: 2 })),
      [`DELETE /tasks/${detail.id}`]: () => new Response(null, { status: 204 }),
      'GET /tasks': () => json(200, page([])),
    });
  }

  it('shows the schedule split into fields, details and the next runs', async () => {
    mockDetail();
    renderRoutes(routes, `/tasks/${task().id}`);

    expect(await screen.findByRole('heading', { name: /Daily report/ })).toHaveTextContent('Active');
    const schedule = screen.getByRole('region', { name: 'Schedule' });
    expect(within(schedule).getByText('Weekday').nextElementSibling).toHaveTextContent('1-5');
    const details = screen.getByRole('region', { name: 'Details' });
    expect(details).toHaveTextContent('At 09:00, Monday through Friday');
    expect(details).toHaveTextContent('****wxyz');
    expect(within(screen.getByRole('region', { name: 'Next 5 runs' })).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('link', { name: /Runs\s*2/ })).toBeInTheDocument();
  });

  it('explains the last failure of a failed task', async () => {
    mockDetail({ status: 'failed' });
    renderRoutes(routes, `/tasks/${task().id}`);

    expect(await screen.findByText(/Unknown Webhook\)\. Not retryable/)).toBeInTheDocument();
    expect(screen.getByText('HTTP 404')).toBeInTheDocument();
  });

  it('lists runs on the Runs tab', async () => {
    mockDetail();
    renderRoutes(routes, `/tasks/${task().id}?tab=runs`);

    const table = await screen.findByRole('table', { name: 'Runs of this task, newest first' });
    // Header + two runs; the collapsed detail rows are hidden, so they are not in the accessibility tree.
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Runs/ })).toHaveAttribute('aria-current', 'page');
  });

  it('deletes only after confirming, then returns to the list', async () => {
    const user = userEvent.setup();
    const { calls } = mockDetail();
    const { router } = renderRoutes(routes, `/tasks/${task().id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete Daily report' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete task' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/tasks'));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('keeps the task when deletion is cancelled', async () => {
    const user = userEvent.setup();
    const { calls } = mockDetail();
    const { router } = renderRoutes(routes, `/tasks/${task().id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete Daily report' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(router.state.location.pathname).toBe(`/tasks/${task().id}`);
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
