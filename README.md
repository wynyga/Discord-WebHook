# Discord Task Scheduler

A full stack app for creating scheduled tasks that send messages to a Discord channel through a webhook.
Each task can be retried, every execution is logged, and a dashboard shows task totals.

Built for the Insignia Full Stack Developer (R&D) technical test. See [PLAN.md](PLAN.md) for the design
and [TODO.md](TODO.md) for progress.

> Status: work in progress. Sections marked _TBD_ are filled in as their phase lands.

## Stack

| Part | Tech |
|---|---|
| Backend | Node.js 22+, Express 5, TypeScript, Zod, pino |
| Database | PostgreSQL, Drizzle ORM (migrations) |
| Scheduler | BullMQ on Redis |
| Frontend | Vite, React, TypeScript, Tailwind (_TBD_) |
| Tests | Vitest, supertest |
| Deploy | Docker Compose (_TBD_) |

## Repository layout

```
backend/    Express API and worker (clean architecture)
frontend/   Vite + React SPA (TBD)
docker/     Container config (pgAdmin server list)
docs/       AI-usage records
```

## Configuration

All variables are listed in [.env.example](.env.example) with working local values. Copy it to `.env`
only if you want to change something:

```bash
cp .env.example .env
```

## Run locally

Requires Node.js 22+ and running Postgres and Redis.

```bash
cd backend
npm install
npm run dev          # reads ../.env if present
```

The API listens on `http://localhost:3000`. Check it with `curl http://localhost:3000/health`.

## Run in Docker

_TBD_

## Unit tests

```bash
cd backend
npm test             # run once
npm run test:coverage
```

## API endpoints

_TBD_. The planned list is in [PLAN.md](PLAN.md#4-api-all-routes-need-authorization-bearer-jwt-except-health-and-authlogin).

## AI tool usage

This project is developed with Claude Code (CLI). Each session's PLAN/TODO output is saved in
[docs/ai-usage/](docs/ai-usage/).

| # | Session | Record |
|---|---|---|
| 1 | Initial project setup | [01-initial-setup.md](docs/ai-usage/01-initial-setup.md) |
| 2 | Database schema design | _TBD_ |
| 3 | API endpoint planning | _TBD_ |
| 4 | Unit test generation | _TBD_ |

## Design references

UI inspiration from Dribbble, listed in [PLAN.md](PLAN.md#design-references-dribbble).

## Open-source libraries

| Library | Use |
|---|---|
| express | HTTP server |
| zod | Validation of env, request bodies and Discord payloads |
| pino, pino-http | Structured logging |
| helmet, cors, express-rate-limit | HTTP hardening |
| drizzle-orm, drizzle-kit, pg | Database access and migrations |
| bullmq | Cron scheduling and retries on Redis |
| cron-parser | Cron validation and next-run calculation |
| jose | JWT signing and verification |
| vitest, @vitest/coverage-v8, supertest | Unit tests and coverage |
| typescript, tsx, eslint, typescript-eslint | Tooling |
