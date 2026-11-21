import { z } from 'zod';
import { findUnknownVariables, renderTemplate, TEMPLATE_VARIABLES, worstCaseValues } from '../../../domain/payload-template.js';
import { TASK_LIMITS, type DiscordPayload } from '../../../domain/task.js';
import { discordPayloadSchema } from './discord-payload.schema.js';

const KNOWN_LIST = TEMPLATE_VARIABLES.map((v) => `{{${v.name}}}`).join(', ');

/**
 * A stored payload is a template. It is accepted when:
 * 1. every `{{variable}}` is known, and
 * 2. rendered with the longest possible values, it is a valid Discord payload, so no run can
 *    exceed Discord's limits. Rendering first also lets `"timestamp": "{{run.iso}}"` pass the
 *    ISO check. The template itself, not the rendered sample, is what gets stored.
 */
export const payloadTemplateSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    const unknown = findUnknownVariables(value);
    for (const { path, name } of unknown) {
      ctx.addIssue({ code: 'custom', path, message: `Unknown variable {{${name}}}. Use one of: ${KNOWN_LIST}` });
    }
    if (unknown.length > 0) return;

    const rendered = discordPayloadSchema.safeParse(renderTemplate(value, worstCaseValues(TASK_LIMITS)));
    if (rendered.success) return;
    for (const issue of rendered.error.issues) {
      ctx.addIssue({ code: 'custom', path: issue.path as Array<string | number>, message: issue.message });
    }
  })
  .transform((value) => value as DiscordPayload);
