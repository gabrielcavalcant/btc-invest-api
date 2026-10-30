import { cx } from './ui';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <span className="relative grid size-9 place-items-center">
        <span
          className="absolute inset-0 rounded-full bg-brand-500/30 blur-md"
          aria-hidden="true"
        />
        <img src="/favicon.svg" alt="" className="relative size-9" />
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight text-fg">
          BTC<span className="text-brand-500"> Invest</span>
        </span>
      )}
    </span>
  );
}
