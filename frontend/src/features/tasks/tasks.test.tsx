import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../../app/routes';
import { session } from '../../auth/session';
import { page, task } from '../../test/fixtures';
import { json, mockApi, renderRoutes, signIn } from '../../test/utils';

const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';

beforeEach(() => {
  session.clear();
  signIn();
});

/** Toast text also sits in the live region, so read it from the notifications region only. */
const notifications = () => screen.findByRole('region', { name: 'Notifications' });

describe('Tasks page', () => {
  it('lists tasks with status, schedule in words and actions', async () => {
    mockApi({
      'GET /tasks': () =>
        json(200, page([task(), task({ id: 'b', name: 'Nightly backup', status: 'failed', cronSchedule: '0 2 * * *' })])),
    });
    renderRoutes(routes, '/tasks');

    const table = await screen.findByRole('table', { name: 'Tasks, newest first' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent('Daily report');
    expect(rows[0]).toHaveTextContent('At 09:00, Monday through Friday');
    expect(rows[0]).toHaveTextContent('Active');
    expect(rows[1]).toHaveTextContent('Failed');
    expect(within(rows[1]!).getByRole('button', { name: 'Run Nightly backup now' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tasks, newest first' })).toHaveAttribute('tabindex', '0');
  });

  it('filters by status through the URL', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({ 'GET /tasks': () => json(200, page([task()])) });
    const { router } = renderRoutes(routes, '/tasks');
    await screen.findByRole('table');

    await user.click(screen.getByRole('radio', { name: 'Paused' }));

    await waitFor(() => expect(calls.at(-1)?.url.searchParams.get('status')).toBe('paused'));
    expect(router.state.location.search).toContain('status=paused');
  });

  it('shows an empty state with a call to action', async () => {
    mockApi({ 'GET /tasks': () => json(200, page([])) });
    renderRoutes(routes, '/tasks');

    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create your first task' })).toHaveAttribute('href', '/tasks/new');
  });

  it('shows an error with a retry button', async () => {
    mockApi({ 'GET /tasks': () => json(500, { error: { code: 'INTERNAL', message: 'Internal server error' } }) });
    renderRoutes(routes, '/tasks');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Internal server error');
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('runs a task now and confirms it', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /tasks': () => json(200, page([task()])),
      [`POST /tasks/${task().id}/run`]: () => json(202, { data: { taskId: task().id, status: 'queued' } }),
    });
    renderRoutes(routes, '/tasks');

    await user.click(await screen.findByRole('button', { name: 'Run Daily report now' }));

    await waitFor(async () => expect(await notifications()).toHaveTextContent(/Run of "Daily report" queued/));
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/run'))).toBe(true);
  });

  it('pauses an active task', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /tasks': () => json(200, page([task()])),
      [`POST /tasks/${task().id}/pause`]: () => json(200, { data: task({ status: 'paused' }) }),
    });
    renderRoutes(routes, '/tasks');

    await user.click(await screen.findByRole('button', { name: 'Pause Daily report' }));

    await waitFor(async () => expect(await notifications()).toHaveTextContent('Task "Daily report" paused.'));
    expect(calls.some((c) => c.path.endsWith('/pause'))).toBe(true);
  });

  it('deletes only after confirming in the dialog', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /tasks': () => json(200, page([task()])),
      [`DELETE /tasks/${task().id}`]: () => new Response(null, { status: 204 }),
    });
    renderRoutes(routes, '/tasks');

    await user.click(await screen.findByRole('button', { name: 'Delete Daily report' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete "Daily report"?' });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: 'Delete task' }));

    await waitFor(async () => expect(await notifications()).toHaveTextContent('Task "Daily report" deleted.'));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('does not delete when cancelled', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({ 'GET /tasks': () => json(200, page([task()])) });
    renderRoutes(routes, '/tasks');

    await user.click(await screen.findByRole('button', { name: 'Delete Daily report' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
});

describe('Task form', () => {
  it('creates a task from a preset and goes back to the list', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'POST /tasks': ({ body }) => json(201, { data: task({ ...(body as object), id: 'new' }) }),
      'GET /tasks': () => json(200, page([task()])),
    });
    const { router } = renderRoutes(routes, '/tasks/new');

    await user.type(await screen.findByLabelText(/^name/i), 'Standup reminder');
    await user.click(screen.getByRole('radio', { name: /weekdays at 09:00/i }));
    await user.clear(screen.getByLabelText(/timezone/i));
    await user.type(screen.getByLabelText(/timezone/i), 'Asia/Jakarta');
    await user.type(screen.getByLabelText(/discord webhook url/i), WEBHOOK);
    expect(screen.getByText(/At 09:00, Monday through Friday \(Asia\/Jakarta\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/tasks'));
    const body = calls.find((c) => c.method === 'POST')?.body;
    expect(body).toMatchObject({
      name: 'Standup reminder',
      cronSchedule: '0 9 * * 1-5',
      timezone: 'Asia/Jakarta',
      webhookUrl: WEBHOOK,
      maxRetry: 3,
      retryDelayMs: 5000,
      payload: { content: 'Task executed successfully!' },
    });
    expect(await notifications()).toHaveTextContent(/created and scheduled/);
  });

  it('blocks submit, marks invalid fields and focuses the first one', async () => {
    const user = userEvent.setup();
    const { fetchMock } = mockApi({});
    renderRoutes(routes, '/tasks/new');

    const payload = await screen.findByLabelText(/payload/i);
    await user.clear(payload);
    await user.type(payload, '{{not json');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const name = screen.getByLabelText(/^name/i);
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/discord webhook url/i)).toHaveAttribute('aria-invalid', 'true');
    expect(payload).toHaveAccessibleDescription(/Payload must be valid JSON/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an error after leaving an edited field, and clears it once fixed', async () => {
    const user = userEvent.setup();
    mockApi({});
    renderRoutes(routes, '/tasks/new');

    const retries = await screen.findByLabelText(/max retries/i);
    await user.clear(retries);
    await user.type(retries, '12');
    expect(retries).toHaveAttribute('aria-invalid', 'false');
    await user.tab();
    expect(retries).toHaveAttribute('aria-invalid', 'true');

    await user.clear(retries);
    await user.type(retries, '2');
    expect(retries).toHaveAttribute('aria-invalid', 'false');
  });

  it('shows API field errors on the matching fields', async () => {
    const user = userEvent.setup();
    mockApi({
      'POST /tasks': () =>
        json(400, {
          error: {
            code: 'VALIDATION',
            message: 'Request validation failed',
            details: [{ path: 'payload.embeds.0.title', message: 'Too big: expected string to have <=256 characters' }],
          },
        }),
    });
    renderRoutes(routes, '/tasks/new');

    await user.type(await screen.findByLabelText(/^name/i), 'Ping');
    await user.type(screen.getByLabelText(/discord webhook url/i), WEBHOOK);
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const payload = screen.getByLabelText(/payload/i);
    await waitFor(() => expect(payload).toHaveFocus());
    expect(payload).toHaveAccessibleDescription(/embeds\.0\.title: Too big/);
  });

  it('shows form-level API errors such as overlapping retries', async () => {
    const user = userEvent.setup();
    mockApi({
      'POST /tasks': () =>
        json(400, {
          error: {
            code: 'VALIDATION',
            message: 'Retries would overlap the next scheduled run',
            details: { retryWindowMs: 600000, shortestIntervalMs: 300000 },
          },
        }),
    });
    renderRoutes(routes, '/tasks/new');

    await user.type(await screen.findByLabelText(/^name/i), 'Ping');
    await user.type(screen.getByLabelText(/discord webhook url/i), WEBHOOK);
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Retries would overlap the next scheduled run');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('edits a task and keeps the stored webhook when left empty', async () => {
    const user = userEvent.setup();
    const existing = task({ cronSchedule: '15 3 * * *' });
    const { calls } = mockApi({
      [`GET /tasks/${existing.id}`]: () => json(200, { data: existing }),
      [`PATCH /tasks/${existing.id}`]: ({ body }) => json(200, { data: { ...existing, ...(body as object) } }),
      'GET /tasks': () => json(200, page([existing])),
    });
    renderRoutes(routes, `/tasks/${existing.id}/edit`);

    const name = await screen.findByLabelText(/^name/i);
    expect(screen.getByLabelText(/cron expression/i)).toHaveValue('15 3 * * *');
    expect(screen.getByLabelText(/discord webhook url/i)).toHaveAttribute('placeholder', existing.webhookUrl);
    await user.clear(name);
    await user.type(name, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(async () => expect(await notifications()).toHaveTextContent('Task "Renamed" saved.'));
    const body = calls.find((c) => c.method === 'PATCH')?.body as Record<string, unknown>;
    expect(body).toMatchObject({ name: 'Renamed', cronSchedule: '15 3 * * *' });
    expect(body).not.toHaveProperty('webhookUrl');
  });
});
