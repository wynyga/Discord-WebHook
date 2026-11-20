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
- [ ] Domain entities and repository interfaces
- [ ] Use cases: create, update, delete, list, get, pause, resume
- [ ] Drizzle repositories
- [ ] Zod schemas: cron, IANA timezone, Discord URL hosts, payload limits, retry bounds, overlap rule
- [ ] `PATCH` keeps the stored webhook URL when none is sent; mask URLs in responses
- [ ] `POST /auth/login` and JWT middleware, login rate limit
- [x] Config module: Zod-parsed env, refuse dev secrets in production
- [ ] Routers (error handler and pino logging done in Phase 1)
- [ ] `/health` pings Postgres and Redis
- [ ] Record AI session #3 (API planning)

## Phase 4: Scheduler, retry, Discord
- [ ] `DiscordPort` and webhook client (`?wait=true`, `RateLimitedError` with `retry_after`)
- [ ] BullMQ scheduler adapter in `infrastructure/` (register, remove, run now)
- [ ] Worker in `presentation/worker/` calling the `ExecuteTask` use case
- [ ] Per-attempt `task_logs` rows
- [ ] Retry with backoff: custom strategy for 429, `UnrecoverableError` for other 4xx
- [ ] Failed-state handling (back to `active` on next success)
- [ ] State rules: paused `PATCH` keeps the schedule off, run now on any status
- [ ] Boot reconcile: register active tasks, remove orphan and paused schedulers
- [ ] Graceful shutdown on `SIGTERM`
- [ ] Dashboard summary and logs endpoints

## Phase 5: Unit tests
- [ ] Task CRUD
- [ ] Scheduler execution (`ExecuteTask`, adapter with mocked `Queue`, boot reconcile)
- [ ] Retry mechanism (incl. 429 `retry_after`, non-retryable 4xx)
- [ ] Auth middleware and login
- [ ] Discord client (mocked)
- [ ] Validation schemas
- [ ] Coverage threshold with `vitest --coverage`
- [ ] Record AI session #4 (test generation)

## Phase 6: Frontend
- [ ] Vite + React + TypeScript + Tailwind scaffold, theme tokens (light/dark, blurple accent)
- [ ] Auth flow and API client
- [ ] Dashboard page (Bit Cron Dashboard reference)
- [ ] Tasks page: list, form with cron presets and preview (MAGIKA reference), actions
- [ ] Logs page (GraphCMS Webhook Logs reference)
- [ ] Responsive pass
- [ ] Frontend tests (form validation, status badge, 401 handling)

## Phase 7: Docker
- [ ] Backend Dockerfile (multi-stage)
- [ ] Frontend Dockerfile (build + nginx, proxy `/api`)
- [ ] `docker-compose.yml` with postgres, redis, healthchecks (draft with postgres, redis, pgadmin
      exists locally, not committed or tested yet)
- [ ] Optional `.env` (`required: false`) and local defaults for every variable
- [ ] `pgadmin` service under the `tools` profile (uses `docker/pgadmin/servers.json`)
- [ ] Verify clean `docker compose up`

## Phase 8: Documentation
- [ ] README: run locally, run in Docker, tests, API list, libraries
- [ ] README: Dribbble design references
- [ ] Postman / Thunder Client collection
- [ ] AI-usage section with PLAN/TODO outputs
- [ ] Create the GitHub repo and push `main`

## Phase 9: Optional
- [ ] Deploy to personal server with DNS
- [ ] Payload template variables (`{{task.name}}`, `{{executedAt}}`, `{{attempt}}`)
