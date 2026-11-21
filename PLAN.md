# PLAN: Discord Task Scheduler

Technical test: Full Stack Developer (R&D). Users create scheduled tasks that POST a JSON payload to a
Discord webhook, with retries, execution logs and a dashboard.

This plan was produced with a coding-agent CLI (Claude Code) before implementation. See `TODO.md` for
progress and `docs/ai-usage/` for the recorded sessions.

## 1. Decisions

| Area | Choice | Why |
|---|---|---|
| Repo layout | Monorepo: `backend/`, `frontend/`, `docker-compose.yml` | One clone, one command |
| Backend | Express 5 + TypeScript | Lightweight; structure is ours, not the framework's |
| Architecture | Clean architecture (domain, application, infrastructure, presentation) | Testable use cases, adapters are swappable |
| Validation | Zod | One schema for body, cron and webhook URL, types inferred |
| Database | PostgreSQL + Drizzle ORM | Typed JSONB, schema in TS, migrations generated from it |
| Scheduler | BullMQ + Redis (job schedulers) | Cron, per-job retry/backoff, survives restarts |
| Auth | Login with env credentials, JWT bearer token | No public API access |
| Logging | pino | Structured logs |
| Tests | Vitest + supertest, Discord mocked | Covers every area the brief lists |
| Frontend | Vite + React + TypeScript + React Router + TanStack Query + Tailwind | Four routes, SPA is enough |
| Deploy | Docker Compose: `postgres`, `redis`, `backend`, `frontend` (nginx); `pgadmin` under the `tools` profile | `docker compose up` |

## 2. Architecture

```
backend/src/
  domain/          entities, repository interfaces, ports (DiscordPort, SchedulerPort)
  application/     use cases (one class per action), no framework imports
  infrastructure/  drizzle repositories + migrations, BullMQ scheduler and worker, Discord client
  presentation/    http/ (express routers, zod schemas, auth middleware, error handler)
  container.ts     composition root: wires adapters to ports by hand
  server.ts        process entry, graceful shutdown
```

Dependency rule: `presentation -> application -> domain`; `infrastructure -> domain`.
Use cases depend only on interfaces, so tests inject fakes. The BullMQ worker lives in
`infrastructure/` and receives an `ExecutionHandler` (a domain type) from the composition root, which
passes `ExecuteTask`. So `infrastructure/` never imports `application/`, and `presentation/` stays
HTTP only. (Changed in Phase 4; the first draft put the worker in `presentation/worker/`.)

### Execution flow

1. Create or resume a task: `SchedulerPort.upsert(task)` registers a BullMQ job scheduler keyed by the
   task id, with the cron pattern, timezone and `attempts = maxRetry + 1` with backoff.
2. At the scheduled time the worker runs `ExecuteTask(taskId)`.
3. `ExecuteTask` loads the task, POSTs the stored JSONB payload via `DiscordPort`, and writes a
   `task_logs` row for the attempt (`success`, `retrying` or `failed`, with `retry_count`).
4. `ExecuteTask` returns an outcome (`success`, `skipped`, `retry`, `failed`) instead of throwing; the
   worker turns `retry` into a thrown `RetryLaterError` and `failed` into `UnrecoverableError`, so BullMQ
   retries with backoff until `maxRetry` is exhausted.
   - The webhook is called with `?wait=true` so Discord confirms delivery.
   - On HTTP 429, `DiscordPort` throws a `RateLimitedError` carrying `retry_after`; a custom backoff
     strategy waits that long instead of `retry_delay_ms`.
   - 4xx other than 429 (bad payload, deleted webhook) is not retryable: the attempt is logged as
     `failed` and BullMQ retries are skipped (`UnrecoverableError`).
5. Once retries are exhausted the task becomes `failed`. The schedule keeps running, and the next
   success sets it back to `active`.
6. Pause, resume and delete remove or re-register the job scheduler.

### State rules

- `PATCH` on a `paused` task updates the row only; the schedule is registered again on resume.
- `POST /tasks/:id/run` works for any status and does not change `paused`.
- Overlap: validation rejects a task whose worst-case retry window (`maxRetry * retry_delay_ms`) is
  longer than the shortest interval of its cron expression.
- Boot reconcile: register every active task and remove Redis schedulers whose task no longer exists
  or is paused.
- Graceful shutdown on `SIGTERM`: stop the HTTP server, close the worker (finishing the running job),
  the queue, Redis and the DB pool.

## 3. Database schema (Drizzle migrations only, no hand-written SQL)

**tasks**: `id uuid pk`, `name`, `cron_schedule`, `timezone` (default `UTC`), `webhook_url`,
`payload jsonb`, `max_retry int`, `retry_delay_ms int`, `status` (`active|paused|failed`),
`last_run_at`, `created_at`, `updated_at`.

**task_logs**: `id uuid pk`, `task_id fk -> tasks (cascade)`, `executed_at`, `status`
(`success|retrying|failed`), `retry_count int`, `http_status int null`, `duration_ms int` (time the
webhook call took), `message text`, `created_at`.
Index on `(task_id, created_at desc)`.

Migrations are generated from the schema by drizzle-kit, committed, and applied from backend code at boot.

## 4. API (all routes need `Authorization: Bearer <jwt>` except `/health` and `/auth/login`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Exchange admin credentials for a JWT |
| GET | `/health` | Readiness: pings Postgres and Redis (Docker healthcheck) |
| POST | `/tasks` | Create task |
| GET | `/tasks` | List tasks (filter by status, paginate) |
| GET | `/tasks/:id` | Task detail |
| PATCH | `/tasks/:id` | Update task (re-registers the schedule) |
| DELETE | `/tasks/:id` | Delete task and its schedule |
| POST | `/tasks/:id/pause` | Pause |
| POST | `/tasks/:id/resume` | Resume |
| POST | `/tasks/:id/run` | Trigger an immediate run |
| GET | `/tasks/:id/logs` | Logs of one task |
| GET | `/logs` | All logs (filter by task and status, paginate) |
| GET | `/dashboard/summary` | Task totals by status, executions of the last 24 hours by outcome |

Validation rules:
- `cronSchedule`: valid 5-field cron expression; `timezone`: valid IANA name (`Intl.supportedValuesOf`).
- `webhookUrl`: `https://(discord.com|discordapp.com|ptb.discord.com|canary.discord.com)/api/webhooks/<id>/<token>`
  (also limits SSRF).
- `payload`: Zod schema that follows Discord's webhook limits. It needs `content` or `embeds`;
  `content` is at most 2000 characters, `username` at most 80, `embeds` at most 10, an embed `title` at
  most 256, an embed `description` at most 4096, `fields` at most 25, and `color` 0 to 16777215.
- `maxRetry` 0 to 10; `retryDelayMs` 1000 to 3600000.
- `PATCH` with no `webhookUrl` keeps the stored one, because responses only return the masked URL.

## 5. Security

- JWT signed with `JWT_SECRET`, short expiry; credentials from env, compared in constant time.
- Webhook URLs are masked in API responses and logs.
- Secrets only in `.env` (git-ignored); `.env.example` committed.
- Basic rate limit on `/auth/login`.

### Configuration and minimal setup

- `.env.example` is the single list of variables, with working local values.
- `docker-compose.yml` gives every variable a local default through interpolation
  (`${JWT_SECRET:-dev-only-change-me...}`), so `docker compose up` works on a fresh clone with no extra
  step; a `.env` overrides them. No `env_file`: the host-oriented `DATABASE_URL` in `.env` must not
  leak into the container, which reaches Postgres and Redis by service name.
- Compose runs `NODE_ENV=development` by default; logs are JSON whenever stdout is not a terminal, so
  the production image does not need pino-pretty.
- Config is parsed once at boot with Zod and the process exits on invalid values.
- With `NODE_ENV=production`, the backend refuses to start if `JWT_SECRET` or `ADMIN_PASSWORD` is still
  the dev default; the deploy setup sets real values.

## 6. Frontend pages

- **Login**
- **Dashboard**: total, active and failed task cards, recent executions
- **Tasks**: list with status badges, create/edit form (payload JSON editor with validation), pause,
  resume, run now, delete
- **Logs**: filterable execution log viewer
- Responsive layout; token kept in memory with `localStorage` fallback; 401 redirects to login.
- Edit form shows the masked webhook URL as a placeholder; left empty, the stored URL is kept.

### Design references (Dribbble)

Chosen after viewing the shots in a browser (the first picks were made from titles only and replaced):

| Shot | Used for |
|---|---|
| [Cron job sheet](https://dribbble.com/shots/27844932-Cron-job-sheet) (Faizal Sukaimi) | Main reference: monochrome devtool look in light and dark; task page with Run now / Pause, failure alert, schedule split into fields, details list, next 5 runs, Overview / Runs tabs |
| [Webhooks](https://dribbble.com/shots/26567727-Webhooks) (Prakash Ghodke) | Overview page: figure strip with sparklines (sent, delivered, failed, retried), hourly stacked activity, recent deliveries with response-code badges |
| [Cron Schedule Screen](https://dribbble.com/shots/24948563-Cron-Schedule-Screen) (MAGIKA) | Schedule presets plus custom cron with a readable preview in the task form |

Style: neutral surfaces, ink-colored primary actions, hairline borders, Geist and Geist Mono (mono for
cron, URLs, response codes and durations). Color is reserved for status: green (active/success),
amber (retrying), red (failed); paused is neutral gray. Chart fills use the dataviz status palette.

### Web platform rules (from `modern-web-guidance`)

Browser target: Baseline widely available; newer features only with the fallback the guide gives.

| Area | Rule |
|---|---|
| Theme | `<meta name="color-scheme" content="light dark">` plus `color-scheme: light dark` on `:root`. Color tokens as custom properties, switched with `prefers-color-scheme`, upgraded to `light-dark()` inside `@supports` (only newly available). |
| Theme toggle | Allowed because this is a developer tool. Two states: "system" (nothing stored) and the opposite of what is shown (stored in `localStorage`). Applied through the `<meta>` by a tiny inline script right after it (no FOUC). CSS maps the `<meta>` back with `:root:has(meta[content="dark"])`; the Tailwind `dark:` variant keys off that and the media query, never a JS-only `.dark` class. |
| Navigation | One `<nav aria-label="Primary">` tree: sidebar when wide, a top row when narrow (three links fit, so no drawer). Current page via `aria-current="page"` (React Router `NavLink`) plus a non-color marker. |
| Tables (tasks, logs) | Real `<table>` with `<caption>`, `<thead>`, row `<th>`. Wrapper is `role="region"`, `tabindex="0"`, `aria-labelledby` the caption; sticky header; `@container (width < 600px)` turns rows into stacked cards with labels from `::before`. |
| Forms | Visible labels above fields; `required`, `maxlength` and friends. Same timing as `:user-invalid`: an error appears when an edited field loses focus or on submit, and clears while typing once fixed. React forms use `noValidate` and keep errors in state, so `aria-invalid` (starting at `false`) is the styling hook and the error is in `aria-describedby` only while shown; blur errors go to one polite live region. API errors (`details[].path`) land on the matching field. After a failed submit, focus the first invalid field (or the form-level alert). Never disable submit to block validation; disable only while a valid submit is in flight. Inputs use `font-size: max(1rem, 1em)` and a 48px tap target. Login uses `autocomplete="username"` / `"current-password"`; the webhook URL and the payload editor turn off autocorrect and spellcheck. |
| Confirm delete | Native `<dialog>` opened with `showModal()`, `aria-labelledby` its title, `autofocus` on Cancel, buttons in `<form method="dialog">`; no `role="dialog"`, `aria-modal`, focus trap or Esc handler. Read and reset `returnValue` on close. `overscroll-behavior: contain` on `dialog:modal` and `::backdrop`. |
| Notifications | Used sparingly (saved, run queued); the outcome is also visible in the list or logs. One `role="region" aria-label="Notifications"` container of `popover="manual"` toasts, each with a close button. Announced via `ariaNotify()` when present, otherwise a polite live region. Not shown while a modal is open. Auto-dismiss pauses while focus is inside. |
| Status badges | Text and icon, never color alone; text at 4.5:1 and borders at 3:1 in both themes; visible under `forced-colors: active`. |
| Color tints | `color-mix(in oklab, ...)` against white or black; never `in oklch` with neutrals. |

## 7. Testing strategy (Vitest)

| Area | Test |
|---|---|
| Task CRUD | Use cases with in-memory fake repository; router tests with supertest |
| Scheduler execution | `ExecuteTask` writes the right log and status; scheduler adapter with mocked `Queue` (upsert, remove, run now); boot reconcile |
| Retry | Failure then success, failure until exhausted, `maxRetry = 0`, 429 uses `retry_after`, non-retryable 4xx |
| Auth | Middleware rejects missing, invalid and expired tokens; login |
| Discord | Client with mocked `fetch`: 2xx, 4xx, 429, network error |
| Validation | Payload schema limits, webhook URL hosts, cron and timezone, overlap rule |
| Frontend | Vitest + Testing Library: task form validation, status badge, API client 401 handling |

Coverage via `vitest --coverage` (v8) with a threshold in the config.

## 8. AI tool usage (evidence required by the brief)

At least three recorded Claude Code CLI sessions, each with its PLAN/TODO output saved to
`docs/ai-usage/`:

1. Initial project setup
2. Database schema design
3. API endpoint planning
4. Unit test generation

## 9. Phases

1. Setup: monorepo, backend scaffold, tooling, `.env.example`
2. Database: Drizzle schema and migrations
3. Backend core: CRUD, auth, validation, error handling
4. Scheduler, retry and Discord client
5. Unit tests
6. Frontend
7. Docker Compose and healthchecks
8. README and AI-usage documentation; push to a public GitHub repo
9. Optional: deploy to a personal server with DNS; payload templates (done: `{{task.*}}` and
   `{{run.*}}` variables filled at send time, form editor with JSON fallback and live preview)
