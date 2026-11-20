import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { Field } from './Field';
import { StatusBadge } from './StatusBadge';
import { ThemeToggle } from './ThemeToggle';
import { ToastProvider, useToast } from './Toasts';

describe('StatusBadge', () => {
  it.each([
    ['active', 'Active'],
    ['paused', 'Paused'],
    ['failed', 'Failed'],
    ['success', 'Success'],
    ['retrying', 'Retrying'],
  ] as const)('shows %s as text, not only color', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="color-scheme" content="light dark">';
  });

  const meta = () => document.querySelector('meta[name="color-scheme"]')?.getAttribute('content');

  it('switches to the opposite of the system, then back to following it', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    // System is light (matchMedia stub), so the first press pins dark.
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(meta()).toBe('dark');
    expect(localStorage.getItem('color-scheme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(meta()).toBe('light dark');
    expect(localStorage.getItem('color-scheme')).toBeNull();
  });

  it('follows an override made in another tab', () => {
    render(<ThemeToggle />);

    act(() => {
      localStorage.setItem('color-scheme', 'dark');
      window.dispatchEvent(new StorageEvent('storage', { key: 'color-scheme', newValue: 'dark' }));
    });

    expect(meta()).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('links hint always and error only while shown', () => {
    const { rerender } = render(
      <Field id="name" label="Name" required hint="Up to 100 characters">
        {(control) => <input {...control} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: /name/i });
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).toHaveAccessibleDescription('Up to 100 characters');

    rerender(
      <Field id="name" label="Name" required hint="Up to 100 characters" error="Enter a name.">
        {(control) => <input {...control} />}
      </Field>,
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/Up to 100 characters.*Enter a name\./);
  });

  it('marks required fields for screen readers', () => {
    render(<Field id="x" label="Webhook" required>{(control) => <input {...control} />}</Field>);
    expect(screen.getByLabelText(/webhook.*required/i)).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  function setup() {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete task?"
        description="This cannot be undone."
        confirmLabel="Delete task"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;
    return { dialog, onConfirm, onClose };
  }

  it('opens as a named modal with the safe action focused', () => {
    const { dialog } = setup();
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleName('Delete task?');
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(screen.getByRole('button', { name: 'Cancel', hidden: true })).toHaveAttribute('autofocus');
  });

  it('confirms only when the confirm button closed it', () => {
    const { dialog, onConfirm, onClose } = setup();

    act(() => dialog.close('confirm'));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(dialog.returnValue).toBe('');
  });

  it('does not confirm on cancel or Esc', () => {
    const { dialog, onConfirm, onClose } = setup();

    act(() => dialog.close());

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('Toasts', () => {
  function Trigger() {
    const { notify } = useToast();
    return (
      <button type="button" onClick={() => notify('Task saved.', 'success')}>
        Save
      </button>
    );
  }

  it('shows a toast in the notifications region and announces it', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region).toHaveTextContent('Task saved.');
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('Task saved.');
  });

  it('can be dismissed with its close button', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // jsdom renders [popover] as hidden; visibility is the browser's job, so include hidden nodes.
    await user.click(screen.getByRole('button', { name: 'Dismiss notification', hidden: true }));

    expect(screen.getByRole('region', { name: 'Notifications' })).toBeEmptyDOMElement();
  });

  it('dismisses itself after a while', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => screen.getByRole('button', { name: 'Save' }).click());

    act(() => vi.advanceTimersByTime(6100));

    expect(screen.getByRole('region', { name: 'Notifications' })).toBeEmptyDOMElement();
    vi.useRealTimers();
  });

  it('uses ariaNotify when the browser has it', async () => {
    const ariaNotify = vi.fn();
    Object.defineProperty(document, 'ariaNotify', { value: ariaNotify, configurable: true });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(ariaNotify).toHaveBeenCalledWith('Task saved.');
    delete (document as { ariaNotify?: unknown }).ariaNotify;
  });
});
