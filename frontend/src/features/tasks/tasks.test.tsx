import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../../app/routes';
import { session } from '../../auth/session';
import { page, task, taskDetail } from '../../test/fixtures';
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

  it('offers Resume instead of Pause on a paused task, and links each task to its page', async () => {
    mockApi({ 'GET /tasks': () => json(200, page([task({ status: 'paused', nextRunAt: null })])) });
    renderRoutes(routes, '/tasks');

    expect(await screen.findByRole('button', { name: 'Resume Daily report' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause Daily report' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Daily report' })).toHaveAttribute('href', `/tasks/${task().id}`);
    expect(screen.getByRole('row', { name: /Daily report/ })).toHaveTextContent(/Next run.*Paused|Paused/);
  });
});

describe('Task form', () => {
  it('creates a task from a preset and opens it', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'POST /tasks': ({ body }) => json(201, { data: task({ ...(body as object), id: 'c1' }) }),
      'GET /tasks/c1': () => json(200, { data: taskDetail({ id: 'c1', name: 'Standup reminder' }) }),
      'GET /logs': () => json(200, page([])),
    });
    const { router } = renderRoutes(routes, '/tasks/new');

    await user.type(await screen.findByLabelText(/^name/i), 'Standup reminder');
    await user.click(screen.getByRole('radio', { name: /weekdays at 09:00/i }));
    await user.clear(screen.getByLabelText(/timezone/i));
    await user.type(screen.getByLabelText(/timezone/i), 'Asia/Jakarta');
    await user.type(screen.getByLabelText(/discord webhook url/i), WEBHOOK);
    expect(screen.getByText(/At 09:00, Monday through Friday \(Asia\/Jakarta\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/tasks/c1'));
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

    await user.click(await screen.findByRole('radio', { name: 'JSON' }));
    const payload = screen.getByRole('textbox', { name: /^payload/i });
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

    // In the form view the message text is the payload's first control, so it takes the focus.
    const text = screen.getByRole('textbox', { name: 'Text' });
    await waitFor(() => expect(text).toHaveFocus());
    expect(text).toHaveAccessibleDescription(/embeds\.0\.title: Too big/);
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

  it('builds a custom schedule from choices instead of cron', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'POST /tasks': ({ body }) => json(201, { data: task({ ...(body as object), id: 'c2' }) }),
      'GET /tasks/c2': () => json(200, { data: taskDetail({ id: 'c2' }) }),
      'GET /logs': () => json(200, page([])),
    });
    renderRoutes(routes, '/tasks/new');

    await user.type(await screen.findByLabelText(/^name/i), 'Twice a week');
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Repeat' }), 'weekly');
    for (const day of ['Tue', 'Wed', 'Fri']) await user.click(screen.getByRole('checkbox', { name: day }));
    const time = screen.getByLabelText('At');
    await user.clear(time);
    await user.type(time, '14:30');
    await user.type(screen.getByLabelText(/discord webhook url/i), WEBHOOK);

    expect(screen.getByText(/At 14:30, only on Monday and Thursday/)).toBeInTheDocument();
    expect(screen.getByText('30 14 * * 1,4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ cronSchedule: '30 14 * * 1,4' }));
  });

  it('flags a week with no days at once, and does not flag a schedule just for picking Custom', async () => {
    const user = userEvent.setup();
    mockApi({});
    renderRoutes(routes, '/tasks/new');

    await user.click(await screen.findByRole('radio', { name: 'Custom' }));
    await user.tab();
    expect(screen.queryByText(/Pick|Enter a cron/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Repeat' }), 'weekly');
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) await user.click(screen.getByRole('checkbox', { name: day }));

    expect(screen.getByText('Pick at least one day.', { selector: '.field-error' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Sat' }));
    expect(screen.queryByText('Pick at least one day.', { selector: '.field-error' })).not.toBeInTheDocument();
  });

  it('opens a cron the builder cannot show in Advanced, unchanged', async () => {
    const existing = taskDetail({ cronSchedule: '*/7 9-17 * * 1-5' });
    mockApi({
      [`GET /tasks/${existing.id}`]: () => json(200, { data: existing }),
      'GET /logs': () => json(200, page([])),
    });
    renderRoutes(routes, `/tasks/${existing.id}/edit`);

    expect(await screen.findByRole('combobox', { name: 'Repeat' })).toHaveValue('cron');
    expect(screen.getByLabelText(/cron expression/i)).toHaveValue('*/7 9-17 * * 1-5');
  });

  it('edits a task and keeps the stored webhook when left empty', async () => {
    const user = userEvent.setup();
    const existing = taskDetail({ cronSchedule: '15 3 * * *' });
    const { calls } = mockApi({
      [`GET /tasks/${existing.id}`]: () => json(200, { data: existing }),
      [`PATCH /tasks/${existing.id}`]: ({ body }) => json(200, { data: { ...existing, ...(body as object) } }),
      'GET /logs': () => json(200, page([])),
    });
    renderRoutes(routes, `/tasks/${existing.id}/edit`);

    const name = await screen.findByLabelText(/^name/i);
    // A cron the builder can show opens in it, not as raw text.
    expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveValue('daily');
    expect(screen.getByLabelText('At')).toHaveValue('03:15');
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
