# TODO

Legend: `[ ]` open, `[x]` done. Phase details are in `PLAN.md`.

## Phase 1: Setup
- [x] Read the brief and agree on the stack
- [x] Write `PLAN.md` and `TODO.md`
- [x] Review the plan against the brief (worker layer, 429 handling, validation, state rules)
- [x] Pick Dribbble design references
- [x] `git init`, `.gitignore`
- [x] Create `backend/` (Express 5 + TypeScript, Vitest, tsx)
- [x] Add `.env.example`, root `README.md` skeleton
- [x] Record AI session #1 (setup) in `docs/ai-usage/`

## Phase 2: Database
- [x] Draw schema (`tasks`, `task_logs`) and review
- [x] Drizzle schema files
- [x] Generate migrations with drizzle-kit
- [x] `task_logs.duration_ms` for the webhook call time
- [x] Apply migrations from backend code at boot
- [x] Record AI session #2 (schema design)

## Phase 3: Backend core
- [x] Domain entities and repository interfaces
- [x] Use cases: create, update, delete, list, get, pause, resume
- [x] Drizzle repositories (tested on PGlite with the real migrations)
- [x] Zod schemas: cron, IANA timezone, Discord URL hosts, payload limits, retry bounds, overlap rule
- [x] `PATCH` keeps the stored webhook URL when none is sent; mask URLs in responses
- [x] `POST /auth/login` and JWT middleware, login rate limit
- [x] Config module: Zod-parsed env, refuse dev secrets in production
- [x] Routers (error handler and pino logging done in Phase 1)
- [x] Composition root (`container.ts`); scheduler is a logging stand-in until Phase 4
- [x] `/health` pings Postgres and Redis (Redis added in Phase 4, with a 2 s timeout per check)
- [x] Record AI session #3 (API planning)

## Phase 4: Scheduler, retry, Discord
- [x] `DiscordPort` and webhook client (`?wait=true`, 429 carries `retry_after`, 4xx not retryable)
- [x] BullMQ scheduler adapter in `infrastructure/` (register, remove, run now), replacing
      `LoggingScheduler` in `container.ts`
- [x] `POST /tasks/:id/run` route and `RunTaskNow` use case
- [x] Worker in `infrastructure/` with the `ExecuteTask` handler injected (see PLAN section 2)
- [x] Per-attempt `task_logs` rows
- [x] Retry with backoff: custom strategy for 429, `UnrecoverableError` for other 4xx
- [x] Failed-state handling (back to `active` on next success)
- [x] State rules: paused `PATCH` keeps the schedule off, run now on any status
- [x] Boot reconcile: register active tasks, remove orphan and paused schedulers
- [x] Graceful shutdown on `SIGTERM` (worker, queue, Redis, Postgres in order)
- [x] Dashboard summary and logs endpoints
- [x] Integration tests against real Redis (`TEST_REDIS_URL`), smoke test against real Discord

## Phase 5: Unit tests
- [x] Task CRUD
- [x] Scheduler execution (`ExecuteTask`, adapter with mocked `Queue`, boot reconcile)
- [x] Retry mechanism (incl. 429 `retry_after`, non-retryable 4xx)
- [x] Auth middleware and login
- [x] Discord client (mocked)
- [x] Validation schemas
- [x] Coverage threshold with `vitest --coverage`
- [ ] Review the suite for gaps against the brief's list
- [ ] Record AI session #4 (test generation)

## Phase 6: Frontend
- [x] Look up web platform guidance (`modern-web-guidance`) and record the rules in PLAN section 6
- [x] Vite + React + TypeScript + Tailwind scaffold, theme tokens (light/dark, blurple accent)
- [x] Theme: `color-scheme` meta + inline FOUC script, two-state toggle, `:has(meta)` mapping
- [x] Auth flow and API client
- [x] Dashboard page (Bit Cron Dashboard reference)
- [x] Tasks page: list, form with cron presets and preview (MAGIKA reference), actions
- [x] Logs page (GraphCMS Webhook Logs reference)
- [x] Responsive layout: sidebar or top nav, tables stack into cards below 600px (container query)
- [x] Frontend tests (89 tests, 94.7% lines): form validation, API errors, auth and 401, dialogs, toasts
- [x] Visual check in a browser (light, dark, phone) with headless Chromium
- [x] Redesign from Dribbble shots actually viewed: Overview (Prakash), task page (Faizal)
- [x] Hourly activity chart (dataviz rules, table twin, keyboard reading) and per-figure sparklines
- [x] Task detail page with Overview / Runs; backend adds `nextRunAt`, `nextRuns`, `activity24h`

## Phase 7: Docker
- [x] Backend Dockerfile (multi-stage, production deps only, non-root, migrations included)
- [x] Frontend Dockerfile (build + nginx, proxy `/api`, SPA fallback, cached hashed assets)
- [x] `docker-compose.yml` with postgres, redis, backend, frontend and healthchecks
- [x] Local defaults for every variable; `.env` optional
- [x] `pgadmin` service under the `tools` profile (uses `docker/pgadmin/servers.json`)
- [x] Reuse the existing `task-scheduler` project, containers and volumes (Postgres 16 data kept)
- [x] Verify `docker compose up`: all services healthy, data kept, `/api` proxy, SPA deep links,
      JSON logs with redaction, graceful SIGTERM, UI checked in a browser on :8080
- [x] Fix lockfiles: Windows npm left out optional `@emnapi/*` entries, so `npm ci` failed on Linux;
      completed them from a Linux container (both `npm ci` pass on Windows and Linux)

## Phase 8: Documentation
- [ ] README: run locally, run in Docker, tests, API list, libraries
- [ ] README: Dribbble design references
- [ ] Postman / Thunder Client collection
- [ ] AI-usage section with PLAN/TODO outputs
- [ ] Create the GitHub repo and push `main`

## Phase 9: Optional
- [ ] Deploy to personal server with DNS
- [ ] Payload template variables (`{{task.name}}`, `{{executedAt}}`, `{{attempt}}`)
