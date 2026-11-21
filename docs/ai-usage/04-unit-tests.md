# AI session 4: Unit test generation

- **Tool:** Claude Code (CLI)
- **Date:** 2026-11-20 to 2026-11-21
- **Goal:** Cover every area the brief lists, with tests written alongside each phase rather than
  at the end, and prove the retry flow against a real Redis.

## Prompts and outcomes

| Step | Prompt (summary) | Outcome |
|---|---|---|
| 1 | Plan tests per area from PLAN.md section 7 | Fakes for every port (in-memory repositories, fake scheduler, fake Discord), so use cases run without I/O |
| 2 | Generate CRUD and auth tests | Use case, router (supertest) and JWT tests; repositories on PGlite with the real migrations |
| 3 | Generate scheduler and retry tests | `ExecuteTask` outcomes, BullMQ adapter with a mocked queue, worker mapping, an end-to-end retry loop |
| 4 | Generate Discord client tests | Mocked `fetch`: 2xx, 429 with `retry_after`, 5xx, 4xx, network error, timeout |
| 5 | Add integration tests | Real Redis (`TEST_REDIS_URL`): retry timing, 429 wait, give-up, non-retryable stop, cron schedulers with timezone |
| 6 | Generate frontend tests | Form validation and API error mapping, auth and 401, dialogs, toasts, chart table view, pages |
| 7 | Review failures | Tests caught real bugs, fixed in code (see below) |

## Coverage of the brief's list

| Brief requires | Where |
|---|---|
| CRUD operations for tasks | `backend/tests/application/tasks/task-use-cases.test.ts`, `tests/presentation/http/routes/tasks.test.ts`, `tests/infrastructure/database/task-repository.test.ts` |
| Scheduler execution logic | `tests/application/tasks/execute-task.test.ts`, `scheduling-use-cases.test.ts`, `tests/infrastructure/scheduler/bullmq-scheduler.test.ts` |
| Retry mechanism | `execute-task.test.ts` (retry, exhaust, `maxRetry = 0`, 429, non-retryable), `tests/infrastructure/scheduler/task-worker.test.ts` (backoff, end-to-end loop), `tests/integration/bullmq-retry.int.test.ts` |
| API authentication middleware | `tests/presentation/http/middleware/auth.test.ts`, `routes/auth.test.ts`, `tests/infrastructure/auth/*.test.ts` |
| Discord webhook request handling (mocked) | `tests/infrastructure/discord/discord-webhook-client.test.ts` |

## Bugs the tests found

- Accessible names without spaces ("RunDaily report now", "4Total tasks"): spaces moved outside
  hidden spans.
- React `autoFocus` does not set the attribute, so the delete dialog never focused Cancel; the
  real `autofocus` attribute is now set.
- An integration test closed the previous BullMQ worker without awaiting it, so it could take the
  next test's jobs; fixed before it caused flakiness.
- A worker log field named `attempt` held the attempts already made; renamed `attemptsMade`.

## TODO output

```
## Phase 5: Unit tests
- [x] Task CRUD
- [x] Scheduler execution (ExecuteTask, adapter with mocked Queue, boot reconcile)
- [x] Retry mechanism (incl. 429 retry_after, non-retryable 4xx)
- [x] Auth middleware and login
- [x] Discord client (mocked)
- [x] Validation schemas
- [x] Coverage threshold with vitest --coverage
- [x] Record AI session #4 (test generation)
```

## Verification

```
backend   $ npm run test:coverage
 Test Files  28 passed | 1 skipped (29)        # the skipped file needs TEST_REDIS_URL
      Tests  287 passed | 6 skipped (293)
 Lines       : 96.5%   Branches : 91.07%

backend   $ TEST_REDIS_URL=redis://localhost:56379 npx vitest run tests/integration
      Tests  6 passed (6)

frontend  $ npm run test:coverage
 Test Files  7 passed (7)
      Tests  94 passed (94)
 Lines       : 94.33%  Branches : 85.23%
```
