import {
  builderProblem,
  changeFrequency,
  FREQUENCIES,
  MINUTE_STEPS,
  WEEKDAYS,
  type Frequency,
  type ScheduleBuilder,
} from '../../lib/schedule-builder';

/** How a change should be treated: picking from a list never shows an error on its own. */
export type ScheduleChange = 'choice' | 'typing' | 'commit';

interface Props {
  value: ScheduleBuilder;
  error?: string;
  onChange: (next: ScheduleBuilder, kind: ScheduleChange) => void;
  onBlur: () => void;
}

const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

/** The control an error belongs to, so it gets `aria-invalid` and focus after a failed submit. */
export function scheduleErrorTarget(b: ScheduleBuilder): string {
  if (b.frequency === 'cron') return 'customCron';
  const problem = builderProblem(b);
  if (problem === 'Pick a time.') return 'schedule-time';
  if (problem === 'Pick at least one day.') return `schedule-day-${WEEKDAYS[0]!.value}`;
  return 'schedule-frequency';
}

/**
 * Repeat, then only the choices that repeat needs. Builds the cron for the user; "Advanced"
 * keeps a raw cron field for anything the choices cannot express.
 */
export function ScheduleBuilderFields({ value, error, onChange, onBlur }: Props) {
  const errorId = 'schedule-error';
  const target = error ? scheduleErrorTarget(value) : null;
  const invalid = (id: string) => ({
    'aria-invalid': target === id,
    'aria-describedby': [`${id}-hint`, target === id ? errorId : null].filter(Boolean).join(' ') || undefined,
  });
  const set = (patch: Partial<ScheduleBuilder>, kind: ScheduleChange) => onChange({ ...value, ...patch }, kind);
  const needsTime = value.frequency === 'daily' || value.frequency === 'weekly' || value.frequency === 'monthly';

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="schedule-frequency" className="text-sm font-semibold">
          Repeat
        </label>
        <select
          id="schedule-frequency"
          name="schedule-frequency"
          value={value.frequency}
          aria-invalid={target === 'schedule-frequency'}
          aria-describedby={target === 'schedule-frequency' ? errorId : undefined}
          onChange={(e) => onChange(changeFrequency(value, e.target.value as Frequency), 'choice')}
        >
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {value.frequency === 'minutes' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="schedule-every" className="text-sm font-semibold">
            Every
          </label>
          <select
            id="schedule-every"
            name="schedule-every"
            value={value.everyMinutes}
            onChange={(e) => set({ everyMinutes: Number(e.target.value) }, 'choice')}
          >
            {MINUTE_STEPS.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? '1 minute' : `${n} minutes`}
              </option>
            ))}
          </select>
        </div>
      )}

      {value.frequency === 'hourly' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="schedule-minute" className="text-sm font-semibold">
            At minute
          </label>
          <select
            id="schedule-minute"
            name="schedule-minute"
            value={value.minute}
            aria-describedby="schedule-minute-hint"
            onChange={(e) => set({ minute: Number(e.target.value) }, 'choice')}
          >
            {MINUTES.map((n) => (
              <option key={n} value={n}>
                :{String(n).padStart(2, '0')}
              </option>
            ))}
          </select>
          <p id="schedule-minute-hint" className="text-sm text-muted">
            Minutes past each hour, e.g. :30 runs at 09:30, 10:30, …
          </p>
        </div>
      )}

      {value.frequency === 'weekly' && (
        <fieldset
          className="flex flex-col gap-1.5"
          aria-describedby={target === `schedule-day-${WEEKDAYS[0]!.value}` ? errorId : undefined}
        >
          <legend className="mb-1.5 text-sm font-semibold">On</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day.value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 hover:border-line-strong has-checked:border-ink has-checked:bg-surface-2"
              >
                <input
                  type="checkbox"
                  id={`schedule-day-${day.value}`}
                  name="schedule-days"
                  value={day.value}
                  checked={value.weekdays.includes(day.value)}
                  onChange={(e) =>
                    set(
                      {
                        weekdays: e.target.checked
                          ? [...value.weekdays, day.value]
                          : value.weekdays.filter((d) => d !== day.value),
                      },
                      // A checkbox commits on change; there is no "still typing" state.
                      'commit',
                    )
                  }
                />
                <abbr title={day.long} className="no-underline">
                  {day.short}
                </abbr>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {value.frequency === 'monthly' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="schedule-day-of-month" className="text-sm font-semibold">
            On day
          </label>
          <select
            id="schedule-day-of-month"
            name="schedule-day-of-month"
            value={value.dayOfMonth}
            aria-describedby={value.dayOfMonth > 28 ? 'schedule-day-of-month-hint' : undefined}
            onChange={(e) => set({ dayOfMonth: Number(e.target.value) }, 'choice')}
          >
            {DAYS_OF_MONTH.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {value.dayOfMonth > 28 && (
            <p id="schedule-day-of-month-hint" className="text-sm text-muted">
              Months without day {value.dayOfMonth} are skipped.
            </p>
          )}
        </div>
      )}

      {needsTime && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="schedule-time" className="text-sm font-semibold">
            At
          </label>
          <input
            id="schedule-time"
            name="schedule-time"
            type="time"
            required
            step={60}
            value={value.time}
            {...invalid('schedule-time')}
            onChange={(e) => set({ time: e.target.value }, 'typing')}
            onBlur={onBlur}
          />
          <p id="schedule-time-hint" className="text-sm text-muted">
            In the task timezone, 24-hour clock.
          </p>
        </div>
      )}

      {value.frequency === 'cron' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customCron" className="text-sm font-semibold">
            Cron expression
          </label>
          <input
            id="customCron"
            name="customCron"
            type="text"
            required
            className="font-mono"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={value.cron}
            {...invalid('customCron')}
            onChange={(e) => set({ cron: e.target.value }, 'typing')}
            onBlur={onBlur}
          />
          <p id="customCron-hint" className="text-sm text-muted">
            Five fields: minute, hour, day of month, month, day of week. E.g. <code className="whitespace-nowrap">30 8 * * 1-5</code> is
            08:30 on weekdays.
          </p>
        </div>
      )}

      {error && (
        <p id={errorId} className="field-error flex items-center gap-1.5">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}
