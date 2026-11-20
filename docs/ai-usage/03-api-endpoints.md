# AI session 3: API endpoint planning

- **Tool:** Claude Code (CLI)
- **Date:** 2026-11-20
- **Goal:** Build the backend core from PLAN.md section 4: task CRUD, pause/resume, login and JWT auth,
  validation, following clean architecture.

## Prompts and outcomes

| Step | Prompt (summary) | Outcome |
|---|---|---|
| 1 | Plan the layers for the endpoints | Ports in `domain/` (`TaskRepository`, `SchedulerPort`, `TokenService`, `CredentialsVerifier`); one use case class per action |
| 2 | Write domain rules | Cron and timezone checks, overlap rule, Discord webhook URL check and masking |
| 3 | Write use cases | Create (rolls back if scheduling fails), update (merged overlap check, paused stays unscheduled), delete, get, list, idempotent pause/resume, login |
| 4 | Write adapters | Drizzle repository, jose JWT service, constant-time credential check, logging scheduler stand-in |
| 5 | Write HTTP layer | Zod schemas (Discord limits, no defaults on PATCH), presenter that masks webhooks, bearer middleware, rate-limited login, routers |
| 6 | Generate unit tests | 210 tests, 97.6% line coverage; repository tested on PGlite with the committed migrations |

## PLAN output

Endpoint decisions made in this session (full list in [PLAN.md](../../PLAN.md) section 4):

| Method | Path | Auth | Success | Errors |
|---|---|---|---|---|
| POST | `/auth/login` | no | 200 `{ data: { token, tokenType, expiresAt } }` | 400, 401, 429 |
| GET | `/health` | no | 200 `{ status, checks }` | 503 |
| POST | `/tasks` | yes | 201 + `Location` | 400, 401 |
| GET | `/tasks?status&page&pageSize` | yes | 200 `{ data, meta }` | 400, 401 |
| GET | `/tasks/:id` | yes | 200 | 400, 401, 404 |
| PATCH | `/tasks/:id` | yes | 200 | 400, 401, 404 |
| DELETE | `/tasks/:id` | yes | 204 | 400, 401, 404 |
| POST | `/tasks/:id/pause` | yes | 200 (idempotent) | 401, 404 |
| POST | `/tasks/:id/resume` | yes | 200 (idempotent) | 401, 404 |

- Errors share one shape: `{ error: { code, message, details? } }`; validation `details` lists
  `{ path, message }` per field.
- `status` cannot be set through POST/PATCH; only pause/resume and the scheduler change it.
- Unknown routes return 401 without a token, so the API surface is not discoverable.
- `/tasks/:id/run`, `/logs`, `/tasks/:id/logs` and `/dashboard/summary` move to Phase 4, where the
  scheduler and log writer exist.

## TODO output

```
## Phase 3: Backend core
- [x] Domain entities and repository interfaces
- [x] Use cases: create, update, delete, list, get, pause, resume
- [x] Drizzle repositories (tested on PGlite with the real migrations)
- [x] Zod schemas: cron, IANA timezone, Discord URL hosts, payload limits, retry bounds, overlap rule
- [x] PATCH keeps the stored webhook URL when none is sent; mask URLs in responses
- [x] POST /auth/login and JWT middleware, login rate limit
- [x] Config module: Zod-parsed env, refuse dev secrets in production
- [x] Routers (error handler and pino logging done in Phase 1)
- [x] Composition root (container.ts); scheduler is a logging stand-in until Phase 4
- [ ] /health pings Postgres and Redis (Postgres done; Redis in Phase 4)
- [x] Record AI session #3 (API planning)
```

## Verification

```
$ npm run typecheck && npm run lint   # clean
$ npm run test:coverage
 Test Files  21 passed (21)
      Tests  210 passed (210)
 Lines        : 97.61% ( 287/294 )
```
