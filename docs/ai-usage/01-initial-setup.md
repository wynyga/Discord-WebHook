# AI session 1: Initial project setup

- **Tool:** Claude Code (CLI)
- **Date:** 2026-11-20
- **Goal:** Turn the technical-test brief into a plan, then scaffold the backend.

## Prompts and outcomes

| Step | Prompt (summary) | Outcome |
|---|---|---|
| 1 | Read the brief PDF and the existing plan | Gap review: worker in the wrong layer, no 429 handling, weak payload validation, unclear state rules, missing health readiness and graceful shutdown |
| 2 | Apply the review and pick Dribbble references | `PLAN.md` and `TODO.md` updated; four Dribbble shots chosen for dashboard, cron form, logs and webhook form |
| 3 | Check the plan against the PDF | Every requirement mapped; three gaps found: GitHub push step, minimal Docker setup, ambiguous "execution time" |
| 4 | Fix the gaps the best-practice way | Optional `.env` with local defaults in Compose plus a production guard; `task_logs.duration_ms`; `git init` |
| 5 | Scaffold the backend | Express 5 + TypeScript (NodeNext, strict), Zod config, pino, error handler, `/health`, graceful shutdown, Vitest |

## PLAN output

The full plan is [PLAN.md](../../PLAN.md). Changes from this session:

- Worker moved to `presentation/worker/`, so `infrastructure/` never imports `application/`.
- Discord calls use `?wait=true`; 429 honours `retry_after`; other 4xx are not retried.
- State rules: paused `PATCH`, run-now on any status, overlap check, boot reconcile, `SIGTERM` shutdown.
- Discord payload limits enforced with Zod; more webhook hosts allowed; IANA timezone check.
- Config: one `.env.example`, Compose defaults, refuse dev secrets in production.

## TODO output

Phase 1 of [TODO.md](../../TODO.md) after this session:

```
- [x] Read the brief and agree on the stack
- [x] Write PLAN.md and TODO.md
- [x] Review the plan against the brief
- [x] Pick Dribbble design references
- [x] git init, .gitignore
- [x] Create backend/ (Express 5 + TypeScript, Vitest, tsx)
- [x] Add .env.example, root README.md skeleton
- [x] Record AI session #1 (setup) in docs/ai-usage/
```

## Verification

```
$ npm run typecheck   # no errors
$ npm run lint        # no errors
$ npm test
 Test Files  4 passed (4)
      Tests  22 passed (22)
```

Production guard checked by hand: starting with `NODE_ENV=production` and the dev secrets exits with
`dev default in production` for `JWT_SECRET` and `ADMIN_PASSWORD`.
