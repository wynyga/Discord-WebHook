# Design references (Dribbble)

The brief asks for a modern, clean UI inspired by Dribbble. These are the shots the UI is based on,
and what each one shaped in the app.

## Shots

| Shot | Designer | Used for |
|---|---|---|
| [Cron job sheet](https://dribbble.com/shots/27844932-Cron-job-sheet) | Faizal Sukaimi | **Main reference.** Monochrome devtool look in light and dark; task page with Run now and Pause, failure alert, schedule split into fields, details list, next 5 runs, Overview / Runs tabs |
| [Webhooks](https://dribbble.com/shots/26567727-Webhooks) | Prakash Ghodke | Overview page: figure strip with sparklines (sent, delivered, failed, retried), hourly stacked activity chart, recent deliveries with response-code badges |
| [Cron Schedule Screen](https://dribbble.com/shots/24948563-Cron-Schedule-Screen) | MAGIKA | Task form: schedule presets plus a custom cron with a readable preview ("Runs: Every 5 minutes") |

## How they map to the pages

| Page | Taken from the references | Added for this app |
|---|---|---|
| Overview | Figure strip with trends, hourly activity, recent runs with HTTP badges (Webhooks) | Task counts by status (total, active, failed) as the brief requires; a table view of the chart |
| Tasks | Status badges and a monospace cron column with its meaning below (Cron job sheet) | Filter by status; Run now and Pause/Resume per row; table turns into cards on phones |
| Task | Header actions, failure alert, schedule fields, next 5 runs, Overview / Runs tabs (Cron job sheet) | Stored payload template; edit and delete with confirmation |
| New / edit task | Presets plus custom cron with a readable preview (Cron Schedule Screen) | Message as a form or JSON, variable buttons and a Discord-style preview |
| Logs | Response-code badges and durations (Webhooks) | Retry number per attempt; filter by task and status |

## Visual style

- Neutral surfaces, ink-colored primary buttons, hairline borders: the monochrome look of the
  main reference, in a light and a dark theme that follow the system.
- Type: Geist for text, Geist Mono for cron expressions, URLs, response codes and durations.
- Color is kept for status only: green for active and success, amber for retrying, red for
  failed, gray for paused. Charts use the same status colors.

## How they were chosen

The shots were picked after viewing them in a browser. A first set chosen from shot titles alone
looked wrong once built and was replaced. The selection is also recorded in
[PLAN.md](../PLAN.md#design-references-dribbble) and in
[AI session 1](ai-usage/01-initial-setup.md).
