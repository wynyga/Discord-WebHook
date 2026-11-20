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
  infrastructure/  drizzle repositories + migrations, BullMQ scheduler adapter, Discord client
  presentation/    http/ (express routers, zod schemas, auth middleware, error handler)
                   worker/ (BullMQ worker: inbound adapter that calls ExecuteTask)
  container.ts     composition root: wires adapters to ports by hand
  server.ts        process entry, graceful shutdown
```

Dependency rule: `presentation -> application -> domain`; `infrastructure -> domain`.
Use cases depend only on interfaces, so tests inject fakes. The worker is an inbound adapter, like a
router, so it lives in `presentation/`; `infrastructure/` never imports `application/`.

### Execution flow

1. Create or resume a task: `SchedulerPort.upsert(task)` registers a BullMQ job scheduler keyed by the
   task id, with the cron pattern, timezone and `attempts = maxRetry + 1` with backoff.
2. At the scheduled time the worker runs `ExecuteTask(taskId)`.
3. `ExecuteTask` loads the task, POSTs the stored JSONB payload via `DiscordPort`, and writes a
   `task_logs` row for the attempt (`success`, `retrying` or `failed`, with `retry_count`).
4. A failed attempt throws, so BullMQ retries it with backoff until `maxRetry` is exhausted.
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
| GET | `/dashboard/summary` | Totals: all, active, failed |

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
- `docker-compose.yml` loads `.env` with `env_file: { path: .env, required: false }` and gives every
  variable a local default (`${JWT_SECRET:-dev-only-change-me}`), so `docker compose up` works on a
  fresh clone with no extra step.
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

| Shot | Used for |
|---|---|
| [Bit Cron Dashboard](https://dribbble.com/shots/14694142-Bit-Cron-Dashboard) (Bit Code Technologies) | Main reference: overall layout of a cron-job manager (sidebar, stat cards, job list); its [login page](https://dribbble.com/tags/bit_cron) too |
| [Cron Schedule Screen](https://dribbble.com/shots/24948563-Cron-Schedule-Screen) (MAGIKA) | Schedule input in the task form: presets (hourly, daily, weekly) plus a custom cron field with a human-readable preview |
| [GraphCMS Webhook Logs view](https://dribbble.com/shots/16818051-GraphCMS-Webhook-Logs-view) | Log viewer: table with status code, time and an expandable detail row |
| [Create Webhook](https://dribbble.com/shots/16828466-Create-Webhook) (FineTune) | Form layout for the webhook URL and payload |

Style: light and dark theme, neutral surfaces with Discord blurple (`#5865F2`) as the accent; status
colors green (active/success), amber (paused/retrying), red (failed).

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
9. Optional: deploy to a personal server with DNS; payload template variables (`{{task.name}}`,
   `{{executedAt}}`, `{{attempt}}`)
