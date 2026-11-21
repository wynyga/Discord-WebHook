# AI session 5: Payload templates, form editor and deployment check

- **Tool:** Claude Code (CLI)
- **Date:** 2026-11-21
- **Goal:** Make the payload easier to write than raw JSON, let one task send a different message
  on every run, and verify the deployed app end to end.

## Prompts and outcomes

| Step | Prompt (summary) | Outcome |
|---|---|---|
| 1 | Does the brief require JSON input in the form? | No: it asks for a payload template stored as JSONB. Plan: a form for the common message, JSON for the rest |
| 2 | Can the message be dynamic? | Design for `{{task.*}}` and `{{run.*}}` variables, filled at send time in the task timezone |
| 3 | Implement both | Domain module for variables (backend), mirror for the preview (frontend), form editor, Discord-style preview |
| 4 | Keep data safe when switching views | The form refuses payloads it cannot hold (several embeds, `allowed_mentions`, ...) and stays in JSON, saying why |
| 5 | Keep runs within Discord limits | On save, unknown variables are rejected and the template is validated with the longest value each variable can take |
| 6 | `{{task.schedule}}` shows `*/5 * * * *` | It now reads "Every 5 minutes" (cronstrue in the backend too); `{{task.cron}}` keeps the raw expression |
| 7 | Check the deployed app | HTTPS, redirects, health, auth, closed database ports, then real runs against a Discord webhook |

## Design decisions

- **The stored payload is the template.** Variables are filled into the parsed JSON on every run,
  never into the JSON text, so a task name with quotes or braces cannot break the payload.
- **One source of truth in the editor.** The form edits the same JSON text the API receives;
  nothing is converted on save.
- **Worst-case validation.** A template that fits today could exceed 2000 characters once a long
  task name is filled in, so validation renders it with maximum-length values first.

## TODO output

```
## Phase 9: Optional
- [x] Deploy to personal server with DNS (https://discordweebhook.tech)
- [x] Payload template variables ({{task.*}}, {{run.*}}): filled at send time, unknown ones
      rejected, worst-case length checked against Discord limits on save
- [x] Payload editor: form for the common message, JSON for the rest, never drops data on switch
- [x] Variable insert buttons (at the cursor) and a Discord-style live preview
- [x] {{task.schedule}} in words, {{task.cron}} for the raw expression
- [x] Record AI session #5
```

## Verification on the deployed app

| Check | Result |
|---|---|
| `http://` and `www.` | Redirect to `https://discordweebhook.tech/` |
| `/api/health` | Database and Redis `up` |
| API without a token | 401 |
| Ports 3000, 5432, 6379, 5050 from the internet | Closed; only nginx is public |
| Unknown variable `{{run.tanggal}}` | 400 with the list of valid variables |
| Run now with an embed and variables | `success`, HTTP 200, about 440 ms |
| Cron `* * * * *` | Sent at :00 of two consecutive minutes, both `success` |
| Webhook with a wrong token | Discord 401, task `failed` without retries (4xx is not retryable) |

## Tests

```
backend   $ npm run test:coverage
      Tests  309 passed | 6 skipped (315)
 Lines       : 96.77%  Branches : 92.01%

frontend  $ npm run test:coverage
      Tests  116 passed (116)
 Lines       : 93.75%  Branches : 84.3%
```
