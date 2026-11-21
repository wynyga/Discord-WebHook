import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PayloadEditor } from './PayloadEditor';

const TASK = { name: 'Daily report', cronSchedule: '0 9 * * 1-5', timezone: 'UTC' };

/** Holds the JSON text like TaskForm does, and exposes it for assertions. */
function Harness({ initial }: { initial: unknown }) {
  const [text, setText] = useState(JSON.stringify(initial, null, 2));
  return (
    <>
      <PayloadEditor value={text} onChange={setText} onBlur={() => {}} task={TASK} />
      <pre data-testid="json">{text}</pre>
    </>
  );
}

const json = () => JSON.parse(screen.getByTestId('json').textContent!);

describe('PayloadEditor', () => {
  it('opens a simple payload in the form and writes edits back as JSON', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ content: 'Hello' }} />);

    expect(screen.getByRole('radio', { name: 'Form' })).toBeChecked();
    const text = screen.getByRole('textbox', { name: 'Text' });
    await user.clear(text);
    await user.type(text, 'Standup now');
    await user.type(screen.getByRole('textbox', { name: 'Sender name' }), 'Bot');

    expect(json()).toEqual({ content: 'Standup now', username: 'Bot' });
  });

  it('adds an embed with fields from the form', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ content: 'Hi' }} />);

    await user.click(screen.getByRole('checkbox', { name: /add an embed/i }));
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Report');
    await user.click(screen.getByRole('button', { name: /add field/i }));
    await user.type(screen.getByRole('textbox', { name: 'Field 1 name' }), 'Orders');
    await user.type(screen.getByRole('textbox', { name: 'Field 1 value' }), '12');

    expect(json().embeds).toEqual([
      { title: 'Report', color: 5793266, fields: [{ name: 'Orders', value: '12', inline: true }] },
    ]);
  });

  it('inserts a variable at the cursor of the last focused field', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ content: 'Report for ' }} />);

    const text = screen.getByRole('textbox', { name: 'Text' });
    await user.click(text); // cursor at the end
    await user.click(screen.getByRole('button', { name: /\{\{run\.date\}\}/ }));

    expect(json().content).toBe('Report for {{run.date}}');
    expect(text).toHaveFocus();
  });

  it('opens a payload the form cannot hold in JSON and refuses to switch, without losing data', async () => {
    const user = userEvent.setup();
    const rich = { embeds: [{ title: 'a' }, { title: 'b' }] };
    render(<Harness initial={rich} />);

    expect(screen.getByRole('radio', { name: 'JSON' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Form' }));

    expect(screen.getByRole('status')).toHaveTextContent('It has 2 embeds');
    expect(screen.getByRole('radio', { name: 'JSON' })).toBeChecked();
    expect(json()).toEqual(rich);
  });

  it('switches between views with the same content', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ content: 'Hi' }} />);

    await user.click(screen.getByRole('radio', { name: 'JSON' }));
    const editor = screen.getByRole('textbox', { name: /^payload/i });
    expect(JSON.parse((editor as HTMLTextAreaElement).value)).toEqual({ content: 'Hi' });

    await user.click(screen.getByRole('radio', { name: 'Form' }));
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('Hi');
  });

  it('previews the message with variables filled in', () => {
    render(<Harness initial={{ username: 'Bot', content: 'Report: {{task.name}}', embeds: [{ title: '{{task.name}}', fields: [{ name: 'Try', value: '{{run.attempt}}' }] }] }} />);

    const preview = screen.getByTestId('discord-preview');
    expect(preview).toHaveTextContent('Bot');
    expect(preview).toHaveTextContent('Report: Daily report');
    expect(within(preview).getByText('Try').nextElementSibling).toHaveTextContent('1');
  });

  it('asks to fix invalid JSON before previewing', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ content: 'x' }} />);
    await user.click(screen.getByRole('radio', { name: 'JSON' }));

    const editor = screen.getByRole('textbox', { name: /^payload/i });
    await user.clear(editor);
    await user.type(editor, '{{oops');

    expect(screen.getByText('Fix the JSON to see the preview.')).toBeInTheDocument();
  });
});
