import { useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import type { DiscordPayload } from '../../api/types';
import { Icon } from '../../components/Icon';
import { SegmentedFilter } from '../../components/Layout';
import { renderTemplate, TEMPLATE_VARIABLES, templateValues, token, type TemplateVariable } from '../../lib/payload-template';
import { DiscordPreview } from './DiscordPreview';
import {
  emptyEmbed,
  formToPayload,
  textToForm,
  type EmbedFieldForm,
  type EmbedForm,
  type PayloadForm,
} from './payload-builder';

type Mode = 'form' | 'json';
type TextControl = HTMLInputElement | HTMLTextAreaElement;

const CONTENT_LIMIT = 2000;
const MAX_FIELDS = 25;
const TEXT_CONTROL = 'textarea, input[type="text"], input[type="url"]';

interface PayloadEditorProps {
  /** JSON text: the single source of truth, also what validation and submit use. */
  value: string;
  onChange: (text: string) => void;
  onBlur: () => void;
  error?: string;
  /** Used for the preview's variable values. */
  task: { name: string; cronSchedule: string; timezone: string };
}

/**
 * Edits the Discord payload either as a form (the common case) or as raw JSON (everything Discord
 * allows). Both views write the same JSON text; switching to the form never drops data.
 */
export function PayloadEditor({ value, onChange, onBlur, error, task }: PayloadEditorProps) {
  // Open in the form when the payload fits it, otherwise in JSON; decided once, on mount.
  const [initial] = useState(() => textToForm(value));
  const [mode, setMode] = useState<Mode>(initial.ok ? 'form' : 'json');
  const [form, setForm] = useState<PayloadForm | null>(initial.ok ? initial.form : null);
  const [notice, setNotice] = useState<string | null>(null);
  /** The text field a variable button inserts into: the last one that had focus. */
  const lastTextControl = useRef<TextControl | null>(null);

  const errorId = error ? 'payload-error' : undefined;

  function updateForm(next: PayloadForm) {
    setForm(next);
    onChange(JSON.stringify(formToPayload(next), null, 2));
  }

  function switchMode(next: Mode) {
    setNotice(null);
    if (next === 'json') return setMode('json');
    const converted = textToForm(value);
    if (!converted.ok) {
      setNotice(`${converted.reason} Keep editing it as JSON, or simplify it to use the form.`);
      return;
    }
    setForm(converted.form);
    setMode('form');
  }

  function rememberTextControl(event: FocusEvent<HTMLDivElement>) {
    if (event.target.matches(TEXT_CONTROL)) lastTextControl.current = event.target as TextControl;
  }

  /**
   * Inserts at the cursor with the browser's own editing (setRangeText) and fires `input`, so the
   * field's normal onChange runs exactly as if the user had typed the variable.
   */
  function insertVariable(name: TemplateVariable) {
    const remembered = lastTextControl.current;
    const el = remembered?.isConnected ? remembered : (document.getElementById('payload') as TextControl | null);
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.focus();
    el.setRangeText(token(name), start, end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const preview = useMemo(() => {
    try {
      const parsed = JSON.parse(value) as DiscordPayload;
      return renderTemplate(parsed, templateValues({ ...task, name: task.name || 'Task name' }, new Date()));
    } catch {
      return null;
    }
  }, [value, task]);

  return (
    <div
      className="flex flex-col gap-4"
      onFocus={rememberTextControl}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && onBlur()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold" id="payload-label">
          Payload <span aria-hidden="true" className="text-danger">*</span>
          <span className="sr-only"> (required)</span>
        </span>
        <SegmentedFilter
          legend="Edit the message as"
          name="payload-mode"
          value={mode}
          options={[
            { value: 'form', label: 'Form' },
            { value: 'json', label: 'JSON' },
          ]}
          onChange={switchMode}
        />
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[0.8125rem]">
          {notice}
        </p>
      )}

      <VariableBar onInsert={insertVariable} />

      {mode === 'form' && form ? (
        <FormFields form={form} update={updateForm} errorId={errorId} invalid={Boolean(error)} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <textarea
            id="payload"
            aria-labelledby="payload-label"
            aria-invalid={Boolean(error)}
            aria-describedby={['payload-json-hint', errorId].filter(Boolean).join(' ')}
            required
            rows={14}
            className="font-mono text-[0.8125rem]"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <p id="payload-json-hint" className="text-[0.8125rem] text-muted">
            Sent to Discord&apos;s{' '}
            <a
              className="text-accent underline"
              href="https://discord.com/developers/docs/resources/webhook#execute-webhook"
              target="_blank"
              rel="noreferrer"
            >
              Execute Webhook
            </a>{' '}
            endpoint after variables are filled in. Needs <code>content</code> or <code>embeds</code>.
          </p>
          <div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                try {
                  onChange(JSON.stringify(JSON.parse(value), null, 2));
                } catch {
                  setNotice('The JSON is not valid yet, so it cannot be formatted.');
                }
              }}
            >
              Format JSON
            </button>
          </div>
        </div>
      )}

      {error && (
        <p id="payload-error" className="field-error flex items-center gap-1.5">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}

      <section aria-label="Preview">
        <p className="eyebrow mb-2">Preview · variables filled for a run right now</p>
        {preview ? (
          <DiscordPreview payload={preview} sentAt={new Date()} />
        ) : (
          <p className="text-muted">Fix the JSON to see the preview.</p>
        )}
      </section>
    </div>
  );
}

function VariableBar({ onInsert }: { onInsert: (name: TemplateVariable) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted" id="variables-hint">
        Insert a variable at the cursor; it is filled in on every run.
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="variables-hint">
        {TEMPLATE_VARIABLES.map((v) => (
          <button
            key={v.name}
            type="button"
            className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-xs hover:border-line-strong"
            title={v.description}
            // Keep focus (and the cursor) in the text field while clicking.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsert(v.name)}
          >
            {token(v.name)}
            <span className="sr-only">: {v.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Labeled({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[0.8125rem] font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const compact = 'min-h-10! py-1.5!';

function FormFields({
  form,
  update,
  errorId,
  invalid,
}: {
  form: PayloadForm;
  update: (next: PayloadForm) => void;
  errorId: string | undefined;
  invalid: boolean;
}) {
  const set =
    <K extends keyof PayloadForm>(key: K) =>
    (value: PayloadForm[K]) =>
      update({ ...form, [key]: value });
  const setEmbed =
    <K extends keyof EmbedForm>(key: K) =>
    (value: EmbedForm[K]) =>
      update({ ...form, embed: { ...form.embed!, [key]: value } });

  return (
    <div className="flex flex-col gap-4">
      <Labeled id="payload" label="Text" hint={`${form.content.length} / ${CONTENT_LIMIT} characters. Discord Markdown works.`}>
        <textarea
          id="payload"
          rows={4}
          aria-invalid={invalid}
          aria-describedby={errorId}
          value={form.content}
          onChange={(e) => set('content')(e.target.value)}
        />
      </Labeled>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled id="payload-username" label="Sender name" hint="Optional; replaces the webhook's name.">
          <input
            id="payload-username"
            type="text"
            className={compact}
            autoComplete="off"
            maxLength={80}
            value={form.username}
            onChange={(e) => set('username')(e.target.value)}
          />
        </Labeled>
        <Labeled id="payload-avatar" label="Avatar URL" hint="Optional image for the sender.">
          <input
            id="payload-avatar"
            type="url"
            inputMode="url"
            className={compact}
            spellCheck={false}
            value={form.avatarUrl}
            onChange={(e) => set('avatarUrl')(e.target.value)}
          />
        </Labeled>
      </div>

      <label className="flex items-center gap-2 text-[0.8125rem] font-medium">
        <input
          type="checkbox"
          checked={form.embed !== null}
          onChange={(e) => update({ ...form, embed: e.target.checked ? emptyEmbed() : null })}
        />
        Add an embed (card with title, color and fields)
      </label>

      {form.embed && (
        <fieldset
          className="flex flex-col gap-4 rounded-lg border border-line p-4"
          style={{ borderInlineStartWidth: 4, borderInlineStartColor: form.embed.color }}
        >
          <legend className="px-1 text-[0.8125rem] font-medium">Embed</legend>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Labeled id="embed-title" label="Title">
              <input
                id="embed-title"
                type="text"
                className={compact}
                autoComplete="off"
                maxLength={256}
                value={form.embed.title}
                onChange={(e) => setEmbed('title')(e.target.value)}
              />
            </Labeled>
            <Labeled id="embed-color" label="Color">
              <input
                id="embed-color"
                type="color"
                className="h-10! min-h-0! w-16! cursor-pointer p-1!"
                value={form.embed.color}
                onChange={(e) => setEmbed('color')(e.target.value)}
              />
            </Labeled>
          </div>

          <Labeled id="embed-description" label="Description">
            <textarea
              id="embed-description"
              rows={3}
              maxLength={4096}
              value={form.embed.description}
              onChange={(e) => setEmbed('description')(e.target.value)}
            />
          </Labeled>

          <FieldsEditor fields={form.embed.fields} onChange={setEmbed('fields')} />

          <details className="text-[0.8125rem]">
            <summary className="cursor-pointer font-medium text-muted hover:text-fg">
              More: author, link, images, footer
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Labeled id="embed-author" label="Author">
                <input id="embed-author" type="text" className={compact} autoComplete="off" maxLength={256} value={form.embed.authorName} onChange={(e) => setEmbed('authorName')(e.target.value)} />
              </Labeled>
              <Labeled id="embed-url" label="Title link">
                <input id="embed-url" type="url" className={compact} spellCheck={false} value={form.embed.url} onChange={(e) => setEmbed('url')(e.target.value)} />
              </Labeled>
              <Labeled id="embed-thumbnail" label="Thumbnail URL">
                <input id="embed-thumbnail" type="url" className={compact} spellCheck={false} value={form.embed.thumbnailUrl} onChange={(e) => setEmbed('thumbnailUrl')(e.target.value)} />
              </Labeled>
              <Labeled id="embed-image" label="Image URL">
                <input id="embed-image" type="url" className={compact} spellCheck={false} value={form.embed.imageUrl} onChange={(e) => setEmbed('imageUrl')(e.target.value)} />
              </Labeled>
              <Labeled id="embed-footer" label="Footer">
                <input id="embed-footer" type="text" className={compact} autoComplete="off" maxLength={2048} value={form.embed.footerText} onChange={(e) => setEmbed('footerText')(e.target.value)} />
              </Labeled>
              <label className="flex items-center gap-2 self-end pb-2 font-medium">
                <input type="checkbox" checked={form.embed.timestamp} onChange={(e) => setEmbed('timestamp')(e.target.checked)} />
                Show the run time in the footer
              </label>
            </div>
          </details>
        </fieldset>
      )}
    </div>
  );
}

function FieldsEditor({ fields, onChange }: { fields: EmbedFieldForm[]; onChange: (fields: EmbedFieldForm[]) => void }) {
  const edit = (index: number, patch: Partial<EmbedFieldForm>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[0.8125rem] font-medium">Fields</legend>
      {fields.map((field, i) => (
        <div
          key={i}
          className="grid gap-2 rounded-md bg-surface-2 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto_auto] sm:items-center"
        >
          <input
            type="text"
            aria-label={`Field ${i + 1} name`}
            placeholder="Name"
            className={compact}
            autoComplete="off"
            maxLength={256}
            value={field.name}
            onChange={(e) => edit(i, { name: e.target.value })}
          />
          <input
            type="text"
            aria-label={`Field ${i + 1} value`}
            placeholder="Value"
            className={compact}
            autoComplete="off"
            maxLength={1024}
            value={field.value}
            onChange={(e) => edit(i, { value: e.target.value })}
          />
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={field.inline} onChange={(e) => edit(i, { inline: e.target.checked })} />
            Inline
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => onChange(fields.filter((_, j) => j !== i))}
          >
            <Icon name="trash" />
            <span className="sr-only">Remove field {i + 1}</span>
          </button>
        </div>
      ))}
      <div>
        <button
          type="button"
          className="btn btn-sm"
          disabled={fields.length >= MAX_FIELDS}
          onClick={() => onChange([...fields, { name: '', value: '', inline: true }])}
        >
          <Icon name="plus" /> Add field
        </button>
      </div>
    </fieldset>
  );
}
