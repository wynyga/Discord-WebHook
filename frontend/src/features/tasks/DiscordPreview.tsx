import type { DiscordEmbed, DiscordPayload } from '../../api/types';
import { colorToHex } from './payload-builder';

const timeLabel = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dateTimeLabel = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });

/** Loads user-provided image URLs without sending the page address along. */
function RemoteImage({ src, className }: { src: string; className: string }) {
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={className} />;
}

/**
 * Approximates how Discord shows the message: sender, text and embeds. Markdown is shown as typed
 * (Discord renders **bold** and friends); layout, colors and order follow Discord.
 */
export function DiscordPreview({ payload, sentAt }: { payload: DiscordPayload; sentAt: Date }) {
  const name = payload.username || 'Webhook';
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-surface-2 p-3.5" data-testid="discord-preview">
      {payload.avatar_url ? (
        <RemoteImage src={payload.avatar_url} className="size-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#5865f2] font-semibold text-white" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-medium">{name}</span>
          <span className="rounded bg-[#5865f2] px-1 text-[0.625rem] font-semibold leading-4 text-white">APP</span>
          <span className="text-xs text-muted">Today at {timeLabel.format(sentAt)}</span>
        </p>
        {payload.content && <p className="mt-0.5 whitespace-pre-wrap wrap-anywhere">{payload.content}</p>}
        {payload.embeds?.map((embed, i) => <EmbedPreview key={i} embed={embed} />)}
      </div>
    </div>
  );
}

function EmbedPreview({ embed }: { embed: DiscordEmbed }) {
  const accent = embed.color === undefined ? 'var(--line-strong)' : colorToHex(embed.color);
  const timestamp = embed.timestamp && !Number.isNaN(Date.parse(embed.timestamp)) ? new Date(embed.timestamp) : null;
  return (
    <div
      className="mt-1.5 grid max-w-md grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded border-s-4 bg-surface p-3 text-[0.8125rem]"
      style={{ borderInlineStartColor: accent }}
    >
      <div className="min-w-0 space-y-1.5">
        {embed.author?.name && <p className="font-medium">{embed.author.name}</p>}
        {embed.title &&
          (embed.url ? (
            <a href={embed.url} target="_blank" rel="noreferrer" className="block font-semibold text-accent hover:underline">
              {embed.title}
            </a>
          ) : (
            <p className="font-semibold">{embed.title}</p>
          ))}
        {embed.description && <p className="whitespace-pre-wrap wrap-anywhere">{embed.description}</p>}
        {embed.fields && embed.fields.length > 0 && (
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
            {embed.fields.map((field, i) => (
              <div key={i} className={field.inline ? '' : 'col-span-3'}>
                <dt className="font-semibold">{field.name}</dt>
                <dd className="whitespace-pre-wrap wrap-anywhere">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {embed.image?.url && <RemoteImage src={embed.image.url} className="mt-1 max-h-60 rounded object-contain" />}
        {(embed.footer?.text || timestamp) && (
          <p className="text-xs text-muted">
            {[embed.footer?.text, timestamp && dateTimeLabel.format(timestamp)].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>
      {embed.thumbnail?.url && <RemoteImage src={embed.thumbnail.url} className="size-16 rounded object-cover" />}
    </div>
  );
}
