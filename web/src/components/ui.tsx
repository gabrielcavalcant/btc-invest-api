import { Eye, EyeOff } from 'lucide-react';
import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/25 ' +
    'hover:brightness-110 focus-visible:outline-brand-500',
  secondary:
    'bg-surface text-fg ring-1 ring-line hover:bg-surface-2 focus-visible:outline-brand-500',
  danger: 'bg-down text-white hover:brightness-110 focus-visible:outline-down',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-brand-500',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

const FIELD =
  'block w-full rounded-xl border bg-surface-2/60 px-3.5 text-fg outline-none transition ' +
  'placeholder:text-subtle focus:bg-surface focus:ring-4';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Element inside the field, on the left (icon, currency...) */
  leading?: ReactNode;
  inputClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leading, id, className, inputClassName, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-subtle">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cx(
            FIELD,
            'h-11 text-sm',
            leading != null && 'pl-10',
            error
              ? 'border-down/60 focus:border-down focus:ring-down/15'
              : 'border-line focus:border-brand-500 focus:ring-brand-500/15',
            inputClassName,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-down">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-sm text-subtle">{hint}</p>
      )}
    </div>
  );
});

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  function PasswordInput({ label, error, hint, id, className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? props.name;
    return (
      <div className={className}>
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-muted">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cx(
              FIELD,
              'h-11 pr-11 text-sm',
              error
                ? 'border-down/60 focus:border-down focus:ring-down/15'
                : 'border-line focus:border-brand-500 focus:ring-brand-500/15',
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            // the accessible name avoids the word of the label, so "Senha" stays unique
            aria-label={visible ? 'Ocultar caracteres' : 'Mostrar caracteres'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-1.5 my-auto grid size-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-down">
            {error}
          </p>
        ) : (
          hint && <p className="mt-1.5 text-sm text-subtle">{hint}</p>
        )}
      </div>
    );
  },
);

export function Card({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]',
        padded && 'p-5 sm:p-6',
        className,
      )}
    >
      {(title || action) && (
        <header
          className={cx(
            'mb-5 flex items-start justify-between gap-3',
            !padded && 'px-5 pt-5 sm:px-6 sm:pt-6',
          )}
        >
          <div>
            {title && <h2 className="font-display text-base font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Page title, subtitle and optional actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {actions}
    </div>
  );
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'info';
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'rounded-xl border px-3.5 py-2.5 text-sm',
        tone === 'error'
          ? 'border-down/30 bg-down-soft text-down'
          : 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300',
      )}
    >
      {children}
    </div>
  );
}

/** Small colored label (statement entry types, status...). */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Round icon tile used by stat cards and lists. */
export function IconTile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', className)}>
      {children}
    </span>
  );
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      className={cx('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('skeleton rounded-lg', className)} />;
}

export { cx };
