import { z } from 'zod';
import type { DiscordPayload } from '../../../domain/task.js';

/** Limits from Discord's "Execute Webhook" and embed documentation. */
export const DISCORD_LIMITS = {
  content: 2000,
  username: 80,
  embeds: 10,
  embedTitle: 256,
  embedDescription: 4096,
  embedFields: 25,
  fieldName: 256,
  fieldValue: 1024,
  footerText: 2048,
  authorName: 256,
  embedTotalCharacters: 6000,
  maxColor: 0xffffff,
} as const;

const L = DISCORD_LIMITS;
const urlRef = z.strictObject({ url: z.url() });

const embedSchema = z
  .strictObject({
    title: z.string().max(L.embedTitle).optional(),
    description: z.string().max(L.embedDescription).optional(),
    url: z.url().optional(),
    color: z.int().min(0).max(L.maxColor).optional(),
    timestamp: z.iso.datetime({ offset: true }).optional(),
    footer: z.strictObject({ text: z.string().min(1).max(L.footerText), icon_url: z.url().optional() }).optional(),
    image: urlRef.optional(),
    thumbnail: urlRef.optional(),
    author: z
      .strictObject({ name: z.string().min(1).max(L.authorName), url: z.url().optional(), icon_url: z.url().optional() })
      .optional(),
    fields: z
      .array(
        z.strictObject({
          name: z.string().min(1).max(L.fieldName),
          value: z.string().min(1).max(L.fieldValue),
          inline: z.boolean().optional(),
        }),
      )
      .max(L.embedFields)
      .optional(),
  })
  .refine((embed) => Object.keys(embed).some((key) => key !== 'color' && key !== 'url' && key !== 'timestamp'), {
    message: 'Embed needs visible content (title, description, fields, image, author, footer...)',
  });

type Embed = z.infer<typeof embedSchema>;

function embedCharacters(embed: Embed): number {
  return (
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    (embed.author?.name.length ?? 0) +
    (embed.fields ?? []).reduce((sum, field) => sum + field.name.length + field.value.length, 0)
  );
}

export const discordPayloadSchema = z
  .strictObject({
    content: z.string().max(L.content).optional(),
    username: z.string().trim().min(1).max(L.username).optional(),
    avatar_url: z.url().optional(),
    tts: z.boolean().optional(),
    embeds: z.array(embedSchema).max(L.embeds).optional(),
    allowed_mentions: z
      .strictObject({
        parse: z.array(z.enum(['roles', 'users', 'everyone'])).optional(),
        roles: z.array(z.string()).max(100).optional(),
        users: z.array(z.string()).max(100).optional(),
      })
      .optional(),
  })
  .refine((p) => (p.content?.trim().length ?? 0) > 0 || (p.embeds?.length ?? 0) > 0, {
    message: 'Payload needs non-empty content or at least one embed',
    path: ['content'],
  })
  .refine((p) => (p.embeds ?? []).reduce((sum, e) => sum + embedCharacters(e), 0) <= L.embedTotalCharacters, {
    message: `Embeds may hold at most ${L.embedTotalCharacters} characters in total`,
    path: ['embeds'],
  }) satisfies z.ZodType<DiscordPayload>;
