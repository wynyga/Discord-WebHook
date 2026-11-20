import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1 text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Scrollable, keyboard-focusable table container named by its caption. */
export function TableRegion({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <div className="table-region" role="region" aria-labelledby={labelledBy} tabIndex={0}>
      {children}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="p-8 text-center text-muted" role="status">
      {label}
    </p>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
      <p className="text-danger">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          <Icon name="retry" /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="text-muted">{children}</div>}
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
      <p className="text-xs text-muted">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button type="button" className="btn btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** 2 to 5 exclusive choices stay visible as radio buttons, styled as a segmented control. */
export function SegmentedFilter<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer rounded-md px-2.5 py-1 text-[0.8125rem] font-medium text-muted hover:text-fg has-checked:bg-surface has-checked:text-fg has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
            {option.count !== undefined && <span className="ms-1.5 text-xs text-muted tabular-nums">{option.count}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Label / value rows, as in the reference sheet's "Details" block. */
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,9rem)_1fr] gap-x-4 gap-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted">{item.label}</dt>
          <dd className="min-w-0 wrap-break-word">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
