import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import type { Task } from '../../api/types';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { ErrorState, LoadingState, PageHeader } from '../../components/Layout';
import { useToast } from '../../components/Toasts';
import { cronForPreset, CUSTOM_PRESET, describeCron, SCHEDULE_PRESETS } from '../../lib/cron';
import { cronToBuilder, type ScheduleBuilder } from '../../lib/schedule-builder';
import { ScheduleBuilderFields, scheduleErrorTarget, type ScheduleChange } from './ScheduleBuilderFields';
import { PayloadEditor } from './PayloadEditor';
import { useTask, useTaskActions } from './queries';
import {
  cronOf,
  emptyValues,
  errorsFromApi,
  FIELD_ORDER,
  type FormMode,
  type TaskFormErrors,
  type TaskFormField,
  type TaskFormValues,
  toTaskInput,
  toTaskUpdate,
  validateAll,
  validateField,
  valuesFromTask,
} from './task-form';

export function NewTaskPage() {
  return <TaskFormScreen mode="create" />;
}

export function EditTaskPage() {
  const { id } = useParams();
  const { data: task, isPending, error, refetch } = useTask(id);
  if (isPending) return <LoadingState label="Loading task…" />;
  if (error || !task) return <ErrorState message={error?.message ?? 'Task not found.'} onRetry={() => refetch()} />;
  return <TaskFormScreen mode="edit" task={task} />;
}

function TaskFormScreen({ mode, task }: { mode: FormMode; task?: Task }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const actions = useTaskActions();

  const submit = async (values: TaskFormValues) => {
    // Land on the task itself, where its schedule and next runs confirm what was saved.
    if (mode === 'create') {
      const created = await actions.create.mutateAsync(toTaskInput(values));
      notify(`Task "${created.name}" created and scheduled.`, 'success');
      navigate(`/tasks/${created.id}`);
    } else {
      const updated = await actions.update.mutateAsync({ id: task!.id, changes: toTaskUpdate(values) });
      notify(`Task "${updated.name}" saved.`, 'success');
      navigate(`/tasks/${updated.id}`);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to={task ? `/tasks/${task.id}` : '/tasks'} className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
            <Icon name="back" className="size-3.5" /> {task ? task.name : 'Tasks'}
          </Link>
        }
        title={mode === 'create' ? 'New task' : 'Edit task'}
        description="Send a message to a Discord channel on a schedule."
      />
      <TaskForm
        mode={mode}
        initial={task ? valuesFromTask(task) : emptyValues()}
        maskedWebhook={task?.webhookUrl}
        cancelTo={task ? `/tasks/${task.id}` : '/tasks'}
        onSubmit={submit}
      />
    </>
  );
}

const FIELD_ID: Record<TaskFormField, string> = {
  name: 'name',
  schedule: 'schedule-frequency',
  timezone: 'timezone',
  webhookUrl: 'webhookUrl',
  payload: 'payload',
  maxRetry: 'maxRetry',
  retryDelay: 'retryDelay',
};

const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC'];
  }
})();

interface TaskFormProps {
  mode: FormMode;
  initial: TaskFormValues;
  maskedWebhook?: string;
  cancelTo: string;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}

export function TaskForm({ mode, initial, maskedWebhook, cancelTo, onSubmit }: TaskFormProps) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const edited = useRef(new Set<TaskFormField>());
  const formErrorRef = useRef<HTMLDivElement>(null);
  const announceTimer = useRef<number | undefined>(undefined);
  const timezoneListId = useId();

  useEffect(() => () => window.clearTimeout(announceTimer.current), []);

  const cron = cronOf(values);
  const schedulePreview = useMemo(() => describeCron(cron), [cron]);

  function update<K extends keyof TaskFormValues>(
    key: K,
    value: TaskFormValues[K],
    field: TaskFormField,
    { markEdited = true }: { markEdited?: boolean } = {},
  ) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (markEdited) edited.current.add(field);
    // While typing, only clear an error once it is fixed; never add one.
    if (errors[field] && !validateField(field, next, mode)) {
      setErrors(({ [field]: _removed, ...rest }) => rest);
    }
    return next;
  }

  /** Picking a preset only chooses; Custom starts from the preset's schedule so nothing resets. */
  function choosePreset(presetId: string) {
    if (presetId === CUSTOM_PRESET && values.schedulePreset !== CUSTOM_PRESET) {
      const from = cronForPreset(values.schedulePreset);
      if (from) {
        setValues((current) => ({ ...current, schedulePreset: presetId, schedule: cronToBuilder(from) }));
        return;
      }
    }
    update('schedulePreset', presetId, 'schedule', { markEdited: false });
  }

  function updateSchedule(next: ScheduleBuilder, kind: ScheduleChange) {
    const updated = update('schedule', next, 'schedule', { markEdited: kind !== 'choice' });
    // Checkboxes commit on change, so their error shows at once instead of on blur.
    if (kind === 'commit') {
      const message = validateField('schedule', updated, mode);
      setErrors(({ schedule: _old, ...rest }) => (message ? { ...rest, schedule: message } : rest));
      if (message) setAnnouncement(message);
    }
  }

  function handleBlur(field: TaskFormField) {
    if (!edited.current.has(field)) return;
    const message = validateField(field, values, mode);
    if (message === errors[field]) return;
    setErrors((current) => ({ ...current, [field]: message }));
    if (message) {
      // One polite announcement, after the screen reader has read the next focused field.
      window.clearTimeout(announceTimer.current);
      announceTimer.current = window.setTimeout(() => setAnnouncement(message), 500);
    }
  }

  function focusFirstError(found: TaskFormErrors) {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (!first) return;
    const id =
      first !== 'schedule'
        ? FIELD_ID[first]
        : values.schedulePreset === CUSTOM_PRESET
          ? scheduleErrorTarget(values.schedule)
          : `schedule-${values.schedulePreset}`;
    document.getElementById(id)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const found = validateAll(values, mode);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      // Focus lands after React renders the messages, so the field's error is read with it.
      requestAnimationFrame(() => focusFirstError(found));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 400) {
        const { fields, other } = errorsFromApi(err.fieldIssues);
        setErrors(fields);
        if (Object.keys(fields).length > 0) {
          if (other.length > 0) setFormError(other.join(' '));
          requestAnimationFrame(() => focusFirstError(fields));
          return;
        }
        setFormError([err.message, ...other].join(' '));
      } else {
        setFormError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      }
      requestAnimationFrame(() => formErrorRef.current?.focus());
    }
  }


  return (
    <form noValidate onSubmit={handleSubmit} aria-label={mode === 'create' ? 'New task' : 'Edit task'}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card flex flex-col gap-5 p-5" aria-labelledby="section-basics">
          <h2 id="section-basics" className="font-medium">
            Task
          </h2>

          {formError && (
            <div
              ref={formErrorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger"
            >
              <span aria-hidden="true">⚠ </span>
              {formError}
            </div>
          )}

          <Field id="name" label="Name" required error={errors.name}>
            {(control) => (
              <input
                {...control}
                type="text"
                required
                maxLength={100}
                autoComplete="off"
                value={values.name}
                onChange={(e) => update('name', e.target.value, 'name')}
                onBlur={() => handleBlur('name')}
              />
            )}
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-sm font-semibold">Schedule</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...SCHEDULE_PRESETS, { id: CUSTOM_PRESET, label: 'Custom', cron: '' }].map((preset) => (
                <label
                  key={preset.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 hover:border-line-strong has-checked:border-ink has-checked:bg-surface-2"
                >
                  <input
                    type="radio"
                    id={`schedule-${preset.id}`}
                    name="schedulePreset"
                    value={preset.id}
                    checked={values.schedulePreset === preset.id}
                    onChange={() => choosePreset(preset.id)}
                  />
                  {preset.label}
                </label>
              ))}
            </div>

            {values.schedulePreset === CUSTOM_PRESET && (
              <ScheduleBuilderFields
                value={values.schedule}
                error={errors.schedule}
                onChange={updateSchedule}
                onBlur={() => handleBlur('schedule')}
              />
            )}

            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <span className="text-muted">Runs: </span>
              {schedulePreview ? `${schedulePreview} (${values.timezone || 'UTC'})` : '—'}
              {schedulePreview && (
                <span className="block text-muted">
                  Cron: <code className="text-fg">{cron}</code>
                </span>
              )}
            </p>
          </fieldset>

          <Field id="timezone" label="Timezone" required error={errors.timezone} hint="IANA name; the schedule follows it, including daylight saving.">
            {(control) => (
              <>
                <input
                  {...control}
                  type="text"
                  list={timezoneListId}
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={values.timezone}
                  onChange={(e) => update('timezone', e.target.value, 'timezone')}
                  onBlur={() => handleBlur('timezone')}
                />
                <datalist id={timezoneListId}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
              </>
            )}
          </Field>

          <Field
            id="webhookUrl"
            label="Discord webhook URL"
            required={mode === 'create'}
            error={errors.webhookUrl}
            hint={
              mode === 'edit'
                ? `Leave empty to keep the current webhook (${maskedWebhook ?? 'hidden'}).`
                : 'Channel settings → Integrations → Webhooks → Copy Webhook URL.'
            }
          >
            {(control) => (
              <input
                {...control}
                type="url"
                inputMode="url"
                required={mode === 'create'}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={mode === 'edit' ? maskedWebhook : 'https://discord.com/api/webhooks/…'}
                value={values.webhookUrl}
                onChange={(e) => update('webhookUrl', e.target.value, 'webhookUrl')}
                onBlur={() => handleBlur('webhookUrl')}
              />
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="maxRetry" label="Max retries" required error={errors.maxRetry} hint="0 to 10 extra attempts.">
              {(control) => (
                <input
                  {...control}
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  required
                  value={values.maxRetry}
                  onChange={(e) => update('maxRetry', e.target.value, 'maxRetry')}
                  onBlur={() => handleBlur('maxRetry')}
                />
              )}
            </Field>
            <Field
              id="retryDelay"
              label="Delay between retries (seconds)"
              required
              error={errors.retryDelay}
              hint="Discord's rate-limit wait wins if longer."
            >
              {(control) => (
                <input
                  {...control}
                  type="number"
                  min={1}
                  max={3600}
                  step={1}
                  required
                  value={values.retryDelay}
                  onChange={(e) => update('retryDelay', e.target.value, 'retryDelay')}
                  onBlur={() => handleBlur('retryDelay')}
                />
              )}
            </Field>
          </div>
        </section>

        <section className="card flex flex-col gap-5 self-start p-5" aria-labelledby="section-message">
          <h2 id="section-message" className="font-medium">
            Message
          </h2>
          <PayloadEditor
            value={values.payload}
            onChange={(text) => update('payload', text, 'payload')}
            onBlur={() => handleBlur('payload')}
            error={errors.payload}
            task={{ name: values.name, cronSchedule: cronOf(values), timezone: values.timezone }}
          />
        </section>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Link to={cancelTo} className="btn">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create task' : 'Save changes'}
        </button>
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </form>
  );
}
