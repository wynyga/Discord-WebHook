# Discord Task Scheduler

A full stack app for creating scheduled tasks that send messages to a Discord channel through a webhook.
Each task can be retried, every execution is logged, and a dashboard shows task totals.

Built for the Insignia Full Stack Developer (R&D) technical test. See [PLAN.md](PLAN.md) for the design
and [TODO.md](TODO.md) for progress.

**Quick start:** `docker compose up -d --build`, then open http://localhost:8080 and sign in with
`admin` / `admin`.

**Live demo:** https://discordweebhook.tech (see [Deployment](#deployment); credentials are shared
with the submission).

## Stack

| Part | Tech |
|---|---|
| Backend | Node.js 22+, Express 5, TypeScript, Zod, pino |
| Database | PostgreSQL, Drizzle ORM (migrations) |
| Scheduler | BullMQ on Redis |
| Frontend | Vite, React 19, TypeScript, React Router, TanStack Query, Tailwind CSS 4 |
| Tests | Vitest, supertest |
| Deploy | Docker Compose: Postgres 16, Redis 7, backend (Node 24), frontend (nginx) |

## Repository layout

```
backend/    Express API and worker (clean architecture)
frontend/   Vite + React SPA (dashboard, tasks, logs)
docker/     Container config (pgAdmin server list)
docs/       Database notes, design references, Postman collection, AI-usage records
```

## Run in Docker (one command)

Requires Docker with Compose v2.

```bash
docker compose up -d --build
```

Open **http://localhost:8080** and sign in with `admin` / `admin`. That is all: no `.env` is needed,
the database is created on first start and the backend applies migrations at boot.

| Service | URL / port | Notes |
|---|---|---|
| frontend | http://localhost:8080 | nginx serves the SPA and proxies `/api` to the backend |
| backend | http://localhost:3000 | `GET /health` reports Postgres and Redis |
| postgres | localhost:5433 | user `postgres`, password `postgres`, database `scheduler` |
| redis | localhost:6382 | append-only file, so schedules survive restarts |
| pgadmin (optional) | http://localhost:5050 | `docker compose --profile tools up -d`; server is preconfigured |

```bash
docker compose ps                 # all services should be healthy
docker compose logs -f backend    # JSON logs, webhook URLs redacted
docker compose down               # stop (data stays in named volumes)
docker compose down -v            # stop and delete all data
```

If a host port is taken, set `FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT` or `REDIS_PORT` in a
`.env` file (see [.env.example](.env.example)).

The defaults are for local use. For a real deployment set `NODE_ENV=production`, `JWT_SECRET` and
`ADMIN_PASSWORD`; the backend refuses to start in production with the dev defaults.

## Deployment

The app runs on a personal server (VPS) at **https://discordweebhook.tech** with the same Docker
Compose file, plus a server-only `docker-compose.override.yml` that adds Caddy:

- The domain points to the server through DNS. Caddy terminates HTTPS with a Let's Encrypt
  certificate and redirects `http://` and `www.` to `https://discordweebhook.tech`.
- `NODE_ENV=production`, so the backend refuses to start with the dev `JWT_SECRET` or password.
- Only the web server is public. The backend, Postgres and Redis ports are closed from the
  internet; the browser reaches the API through `/api`.

Update it with:

```bash
git pull
docker compose up -d --build
```

Checked after deploying: health reports Postgres and Redis up, the API answers 401 without a token,
"run now" and a per-minute cron both delivered to Discord (HTTP 200), and a wrong webhook token
failed without retries. Details in [AI session 5](docs/ai-usage/05-payload-templates-and-deploy.md).

## Configuration

All variables are listed in [.env.example](.env.example) with working local values. Copy it to `.env`
only if you want to change something:

```bash
cp .env.example .env
```

## Run locally (without Docker for the app)

Requires Node.js 22+. Start only Postgres and Redis in Docker, then run the app on the host:

```bash
docker compose up -d postgres redis
cp .env.example .env   # points the backend at localhost:5433 and :6382

cd backend
npm install
npm run dev          # reads ../.env
```

The API applies pending database migrations at boot, then listens on `http://localhost:3000`. Check
it with `curl http://localhost:3000/health`.

Then the frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /api to the backend
```

Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` (default `admin` / `admin`). Set
`VITE_API_PROXY_TARGET` if the backend is not on `http://localhost:3000`.

### Frontend pages

| Page | What it does |
|---|---|
| Overview | Delivery figures of the last 24 h with trends, hourly activity chart (with a table view), task counts by status, recent runs |
| Tasks | List with status, next and last run; filter by status; run now and pause/resume per row |
| Task | Schedule split into fields, details, next 5 runs, payload, last failure; Runs tab; edit and delete (with confirmation) |
| New / edit task | Schedule presets or custom cron with a readable preview, timezone, webhook, retries; message as a form or JSON with variables and a Discord-style preview |
| Logs | Every attempt with status, retry number, HTTP code and duration; filter by task and status |

Light and dark themes follow the system; the toggle in the sidebar overrides it for this browser.

## Message templates

The stored payload is a template: `{{variables}}` in any text are filled in on every run, so the
same task sends a different date each day. The task form edits the common message (text, sender,
one embed with fields) as a form, or any Discord payload as JSON, with a live preview.

| Variable | Example |
|---|---|
| `{{task.name}}`, `{{task.timezone}}` | Daily report, Asia/Jakarta |
| `{{task.schedule}}` | Every 5 minutes; At 09:00, Monday through Friday |
| `{{task.cron}}` | `0 9 * * 1-5` (wrap it in backticks, Discord reads `*` as Markdown) |
| `{{run.date}}`, `{{run.time}}`, `{{run.datetime}}` | 21 Nov 2026, 09:00 (in the task timezone) |
| `{{run.weekday}}` | Friday |
| `{{run.iso}}` | `2026-11-21T02:00:00.000Z`, for an embed `timestamp` |
| `{{run.attempt}}` | 1 for the first try, 2 for the first retry |

```json
{
  "content": "Sales report for {{run.date}} is ready.",
  "embeds": [{ "title": "{{task.name}}", "description": "Generated on {{run.weekday}} at {{run.time}}.",
               "fields": [{ "name": "Attempt", "value": "{{run.attempt}}", "inline": true }],
               "timestamp": "{{run.iso}}" }]
}
```

On save, unknown variables are rejected, and the template is checked with the longest value each
variable can take, so no run can exceed Discord's limits. Values are filled into the parsed JSON,
never into the text, so they cannot break its structure.

## How a task runs

1. Creating or resuming a task registers a BullMQ job scheduler (cron pattern + timezone) in Redis.
2. At each tick the worker fills the payload template's variables and POSTs it to the webhook
   with `?wait=true`.
3. Every attempt writes one `task_logs` row: `success`, `retrying` or `failed`, with `retry_count`,
   HTTP status and duration.
4. Failures retry up to `maxRetry` times, `retryDelayMs` apart:

   | Discord answer | What happens |
   |---|---|
   | 2xx | Logged as `success`; a `failed` task goes back to `active` |
   | 429 | Retried after Discord's `retry_after` (or the task delay, whichever is longer) |
   | 5xx, timeout, network error | Retried after `retryDelayMs` |
   | Other 4xx (bad payload, deleted webhook) | Not retried; retrying cannot fix it |

5. When retries run out the task becomes `failed`; its schedule keeps running, and the next success
   makes it `active` again.
6. At boot, schedules in Redis are reconciled with the database, which is the source of truth.

## Database

Schema diagram and design notes: [docs/database.md](docs/database.md). Migrations are generated by
drizzle-kit into [backend/drizzle/](backend/drizzle/); there is no hand-written SQL.

```bash
cd backend
npm run db:generate   # after changing the schema
npm run db:migrate    # apply migrations without starting the API
```

## Unit tests

```bash
cd backend
npm test             # run once
npm run test:coverage
```

Frontend:

```bash
cd frontend
npm test             # Vitest + Testing Library on jsdom, API mocked
npm run test:coverage
```

The backend unit tests need no database or Redis: Discord is mocked, the queue is mocked, and repositories
run on PGlite (in-process Postgres) with the real migrations.

Integration tests against a real Redis are skipped unless `TEST_REDIS_URL` is set. They flush that
Redis database, so point them at a throwaway one:

```bash
docker run -d --rm --name redis-test -p 56379:6379 redis:8-alpine
TEST_REDIS_URL=redis://localhost:56379 npm test
docker stop redis-test
```

## API endpoints

**Postman / Thunder Client:** import
[docs/postman/task-scheduler.postman_collection.json](docs/postman/task-scheduler.postman_collection.json).
It runs top to bottom: Login stores the token, Create stores the task id, every request checks its
status code, and the last request deletes the demo task. `baseUrl` defaults to the Docker stack
(`http://localhost:8080/api`). From the command line:

```bash
npx newman run docs/postman/task-scheduler.postman_collection.json
```

Every route except `/health` and `/auth/login` needs `Authorization: Bearer <token>`. Get a token
from `/auth/login` with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Exchange admin credentials for a JWT (rate limited) |
| GET | `/health` | Readiness of the API and its dependencies |
| POST | `/tasks` | Create a task |
| GET | `/tasks?status=&page=&pageSize=` | List tasks, newest first |
| GET | `/tasks/:id` | Task detail, including its next five run times |
| PATCH | `/tasks/:id` | Update a task; omit `webhookUrl` to keep the stored one |
| DELETE | `/tasks/:id` | Delete a task, its schedule and its logs |
| POST | `/tasks/:id/pause` | Pause the schedule |
| POST | `/tasks/:id/resume` | Resume the schedule |
| POST | `/tasks/:id/run` | Queue one run now (202); works on paused tasks too |
| GET | `/tasks/:id/logs?status=&page=&pageSize=` | Execution logs of one task |
| GET | `/logs?taskId=&status=&page=&pageSize=` | All execution logs, newest first |
| GET | `/dashboard/summary` | Task counts by status; executions of the last 24 h by outcome, also per hour |

Webhook URLs are masked in responses (`.../webhooks/<id>/****abcd`). Errors use one shape:

```json
{ "error": { "code": "VALIDATION", "message": "Request validation failed",
  "details": [{ "path": "cronSchedule", "message": "Must be a 5-field cron expression" }] } }
```

Quick try:

```bash
TOKEN=$(curl -s localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | jq -r .data.token)

curl -s localhost:3000/tasks -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "name": "Ping every 5 minutes",
  "cronSchedule": "*/5 * * * *",
  "timezone": "Asia/Jakarta",
  "webhookUrl": "https://discord.com/api/webhooks/<id>/<token>",
  "payload": { "content": "Task executed successfully!", "username": "Task Bot" },
  "maxRetry": 3,
  "retryDelayMs": 5000
}'
```

## AI tool usage

This project is developed with Claude Code (CLI). Each session's PLAN/TODO output is saved in
[docs/ai-usage/](docs/ai-usage/).

| # | Session | Record |
|---|---|---|
| 1 | Initial project setup | [01-initial-setup.md](docs/ai-usage/01-initial-setup.md) |
| 2 | Database schema design | [02-database-schema.md](docs/ai-usage/02-database-schema.md) |
| 3 | API endpoint planning | [03-api-endpoints.md](docs/ai-usage/03-api-endpoints.md) |
| 4 | Unit test generation | [04-unit-tests.md](docs/ai-usage/04-unit-tests.md) |
| 5 | Payload templates, form editor, deployment check | [05-payload-templates-and-deploy.md](docs/ai-usage/05-payload-templates-and-deploy.md) |

## Design references

UI inspiration from Dribbble: the shots, what each one shaped and the visual style are in
[docs/design-references.md](docs/design-references.md).

## Open-source libraries

| Library | Use |
|---|---|
| express | HTTP server |
| zod | Validation of env, request bodies and Discord payloads |
| pino, pino-http | Structured logging |
| helmet, cors, express-rate-limit | HTTP hardening |
| drizzle-orm, drizzle-kit, pg | Database access and migrations |
| bullmq | Cron scheduling and retries on Redis |
| ioredis | Redis client used by BullMQ and the health check |
| cron-parser | Cron validation and next-run calculation |
| jose | JWT signing and verification |
| vitest, @vitest/coverage-v8, supertest | Unit tests and coverage |
| @electric-sql/pglite | In-process Postgres for repository tests |
| typescript, tsx, eslint, typescript-eslint | Tooling |
| react, react-dom, react-router | UI and routing |
| @tanstack/react-query | Server state, caching and background refresh |
| tailwindcss, @tailwindcss/vite | Styling |
| cronstrue | Cron expressions in plain words (form preview and `{{task.schedule}}`) |
| @fontsource-variable/geist, geist-mono | Self-hosted UI and monospace fonts |
| @oddbird/popover-polyfill | Popover API, loaded only in browsers that lack it |
| vite, @vitejs/plugin-react | Dev server and build |
| @testing-library/react, user-event, jest-dom, jsdom | Frontend tests |
