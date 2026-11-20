export const TASK_STATUSES = ['active', 'paused', 'failed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_LOG_STATUSES = ['success', 'retrying', 'failed'] as const;
export type TaskLogStatus = (typeof TASK_LOG_STATUSES)[number];

/** Bounds shared by validation and database check constraints. */
export const TASK_LIMITS = {
  nameMaxLength: 100,
  cronMaxLength: 100,
  timezoneMaxLength: 64,
  maxRetry: { min: 0, max: 10, default: 3 },
  retryDelayMs: { min: 1_000, max: 3_600_000, default: 5_000 },
} as const;

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
  fields?: DiscordEmbedField[];
}

/** Body of a Discord "Execute Webhook" request, stored as JSONB and sent as is. */
export interface DiscordPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  tts?: boolean;
  embeds?: DiscordEmbed[];
  allowed_mentions?: {
    parse?: Array<'roles' | 'users' | 'everyone'>;
    roles?: string[];
    users?: string[];
  };
}
