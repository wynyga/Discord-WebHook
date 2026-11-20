import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom lacks parts of <dialog>, the Popover API and matchMedia; give them minimal stand-ins.
const dialogProto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>;
if (typeof dialogProto.showModal !== 'function') {
  dialogProto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
}
if (typeof dialogProto.close !== 'function') {
  dialogProto.close = function (this: HTMLDialogElement, value?: string) {
    if (value !== undefined) this.returnValue = value;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

// jsdom does not implement <form method="dialog">: in browsers its submit closes the dialog with the
// submitter's value as returnValue.
document.addEventListener(
  'submit',
  (event) => {
    const form = event.target as HTMLFormElement;
    if (form.getAttribute('method') !== 'dialog') return;
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    form.closest('dialog')?.close(submitter?.value ?? '');
  },
  true,
);

const elementProto = HTMLElement.prototype as HTMLElement & Record<string, unknown>;
if (typeof elementProto.showPopover !== 'function') {
  elementProto.showPopover = function () {};
  elementProto.hidePopover = function () {};
}

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
