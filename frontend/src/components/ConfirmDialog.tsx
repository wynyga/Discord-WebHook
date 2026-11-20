import { useEffect, useId, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Called on every close: confirm, cancel, Esc or back gesture. */
  onClose: () => void;
}

/**
 * Native modal <dialog>: the browser makes the page inert, traps focus, handles Esc and returns focus
 * to the button that opened it, so none of that is re-implemented here.
 */
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      const choice = dialog.returnValue;
      // Esc sets no value and browsers differ on clearing the last one, so reset it every time.
      dialog.returnValue = '';
      if (choice === 'confirm') onConfirm();
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onConfirm, onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="card m-auto w-[min(28rem,calc(100dvw-2rem))] p-6 text-fg shadow-xl"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <p id={descriptionId} className="mt-2 text-muted">
        {description}
      </p>
      <form method="dialog" className="mt-6 flex flex-wrap justify-end gap-3">
        {/*
          The safe choice gets focus, so Enter never destroys anything by accident. React's autoFocus
          only focuses once on mount, while the dialog is still closed; the real attribute makes
          showModal() focus it every time.
        */}
        <button value="cancel" className="btn" ref={(el) => el?.setAttribute('autofocus', '')}>
          Cancel
        </button>
        <button value="confirm" className="btn btn-danger">
          {confirmLabel}
        </button>
      </form>
    </dialog>
  );
}
