# AI session 2: Database schema design

- **Tool:** Claude Code (CLI)
- **Date:** 2026-11-20
- **Goal:** Turn the brief's table list into a Drizzle schema, generate migrations, apply them at boot.

## Prompts and outcomes

| Step | Prompt (summary) | Outcome |
|---|---|---|
| 1 | Plan the schema from PLAN.md section 3 | Shared limits and statuses in `domain/task.ts`, used by both the schema and (later) validation |
| 2 | Write the Drizzle schema | `tasks` and `task_logs` with enums, JSONB payload, check constraints, cascade FK and indexes |
| 3 | Generate the migration | `drizzle/0000_init.sql` reviewed: matches the plan |
| 4 | Apply migrations from code | `runMigrations()` runs at boot; `npm run db:migrate` runs it alone |
| 5 | Generate unit tests | Schema shape, FK cascade, enum sync, migration drift check, migrator, DB client |
| 6 | Verify on a real database | Postgres 18 container: migrations apply, re-run is a no-op, constraints and cascade hold |

## PLAN output

From [PLAN.md](../../PLAN.md) section 3, refined in this session:

- One `task_logs` row per attempt, with `retrying` as its own status.
- `duration_ms` added so "execution time" covers both the timestamp and the duration.
- Bounds for `max_retry` and `retry_delay_ms` live in one place (`TASK_LIMITS`) and become DB checks.
- Migrations live in `backend/drizzle/`, outside `src/`, so the same path works from `src` and `dist`.

The diagram and design notes are in [docs/database.md](../database.md).

## TODO output

```
## Phase 2: Database
- [x] Draw schema (tasks, task_logs) and review
- [x] Drizzle schema files
- [x] Generate migrations with drizzle-kit
- [x] task_logs.duration_ms for the webhook call time
- [x] Apply migrations from backend code at boot
- [x] Record AI session #2 (schema design)
```

## Verification

```
$ npm test
 Test Files  8 passed (8)
      Tests  38 passed (38)
```
