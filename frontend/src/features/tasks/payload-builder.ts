import type { DiscordEmbed, DiscordPayload } from '../../api/types';
import { token } from '../../lib/payload-template';

/**
 * Form model for the common Discord message: text, sender, and at most one embed. Anything richer
 * (several embeds, mentions control, footer icons...) stays in the JSON editor.
 */
export interface EmbedFieldForm {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedForm {
  title: string;
  url: string;
  description: string;
  /** #rrggbb; Discord wants an integer. */
  color: string;
  authorName: string;
  thumbnailUrl: string;
  imageUrl: string;
  footerText: string;
  /** Shows the run time under the embed (`{{run.iso}}`). */
  timestamp: boolean;
  fields: EmbedFieldForm[];
}

export interface PayloadForm {
  content: string;
  username: string;
  avatarUrl: string;
  embed: EmbedForm | null;
}

export const DISCORD_BLURPLE = '#5865f2';

export function emptyEmbed(): EmbedForm {
  return {
    title: '',
    url: '',
    description: '',
    color: DISCORD_BLURPLE,
    authorName: '',
    thumbnailUrl: '',
    imageUrl: '',
    footerText: '',
    timestamp: false,
    fields: [],
  };
}

export const colorToHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
export const hexToColor = (hex: string) => Number.parseInt(hex.replace('#', ''), 16);

const nonEmpty = (text: string) => (text.trim() === '' ? undefined : text);

/** Builds the payload, leaving out empty optional parts. */
export function formToPayload(form: PayloadForm): DiscordPayload {
  const payload: DiscordPayload = {};
  if (nonEmpty(form.content)) payload.content = form.content;
  if (nonEmpty(form.username)) payload.username = form.username.trim();
  if (nonEmpty(form.avatarUrl)) payload.avatar_url = form.avatarUrl.trim();
  if (form.embed) {
    const e = form.embed;
    const embed: DiscordEmbed = {};
    if (nonEmpty(e.authorName)) embed.author = { name: e.authorName };
    if (nonEmpty(e.title)) embed.title = e.title;
    if (nonEmpty(e.url)) embed.url = e.url.trim();
    if (nonEmpty(e.description)) embed.description = e.description;
    embed.color = hexToColor(e.color);
    const fields = e.fields.filter((f) => f.name.trim() || f.value.trim());
    if (fields.length > 0) embed.fields = fields.map((f) => (f.inline ? { ...f } : { name: f.name, value: f.value }));
    if (nonEmpty(e.thumbnailUrl)) embed.thumbnail = { url: e.thumbnailUrl.trim() };
    if (nonEmpty(e.imageUrl)) embed.image = { url: e.imageUrl.trim() };
    if (nonEmpty(e.footerText)) embed.footer = { text: e.footerText };
    if (e.timestamp) embed.timestamp = token('run.iso');
    payload.embeds = [embed];
  }
  return payload;
}

type Converted = { ok: true; form: PayloadForm } | { ok: false; reason: string };

const onlyKeys = (value: object, allowed: string[]) => Object.keys(value).every((k) => allowed.includes(k));
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Reads a payload back into the form, or explains why it cannot without losing something.
 * Never drops data silently: anything the form cannot show keeps the user in the JSON editor.
 */
export function payloadToForm(payload: unknown): Converted {
  if (!isObject(payload)) return { ok: false, reason: 'The payload is not a JSON object.' };
  if (!onlyKeys(payload, ['content', 'username', 'avatar_url', 'embeds'])) {
    return { ok: false, reason: 'It uses options the form does not have (for example allowed_mentions or tts).' };
  }
  const embeds = payload.embeds ?? [];
  if (!Array.isArray(embeds)) return { ok: false, reason: '"embeds" is not a list.' };
  if (embeds.length > 1) return { ok: false, reason: `It has ${embeds.length} embeds; the form edits one.` };

  const form: PayloadForm = {
    content: str(payload.content),
    username: str(payload.username),
    avatarUrl: str(payload.avatar_url),
    embed: null,
  };

  const raw = embeds[0];
  if (raw === undefined) return { ok: true, form };
  const fail = { ok: false as const, reason: 'Its embed uses options the form does not have.' };
  if (
    !isObject(raw) ||
    !onlyKeys(raw, ['title', 'url', 'description', 'color', 'author', 'thumbnail', 'image', 'footer', 'timestamp', 'fields'])
  ) {
    return fail;
  }
  if (raw.author !== undefined && !(isObject(raw.author) && onlyKeys(raw.author, ['name']))) return fail;
  if (raw.footer !== undefined && !(isObject(raw.footer) && onlyKeys(raw.footer, ['text']))) return fail;
  for (const key of ['thumbnail', 'image'] as const) {
    if (raw[key] !== undefined && !(isObject(raw[key]) && onlyKeys(raw[key], ['url']))) return fail;
  }
  if (raw.timestamp !== undefined && raw.timestamp !== token('run.iso')) {
    return { ok: false, reason: 'Its embed has a fixed timestamp; the form only offers the run time.' };
  }
  if (raw.color !== undefined && typeof raw.color !== 'number') return fail;
  const fields = raw.fields ?? [];
  if (!Array.isArray(fields) || !fields.every((f) => isObject(f) && onlyKeys(f, ['name', 'value', 'inline']))) {
    return fail;
  }

  form.embed = {
    title: str(raw.title),
    url: str(raw.url),
    description: str(raw.description),
    color: typeof raw.color === 'number' ? colorToHex(raw.color) : DISCORD_BLURPLE,
    authorName: isObject(raw.author) ? str(raw.author.name) : '',
    thumbnailUrl: isObject(raw.thumbnail) ? str(raw.thumbnail.url) : '',
    imageUrl: isObject(raw.image) ? str(raw.image.url) : '',
    footerText: isObject(raw.footer) ? str(raw.footer.text) : '',
    timestamp: raw.timestamp !== undefined,
    fields: (fields as Array<Record<string, unknown>>).map((f) => ({
      name: str(f.name),
      value: str(f.value),
      inline: f.inline === true,
    })),
  };
  return { ok: true, form };
}

/** Parses JSON text and converts it; invalid JSON is reported, not thrown. */
export function textToForm(text: string): Converted {
  try {
    return payloadToForm(JSON.parse(text));
  } catch {
    return { ok: false, reason: 'The JSON is not valid yet.' };
  }
}
