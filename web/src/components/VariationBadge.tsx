import { formatPercent } from '../lib/money';
import { cx } from './ui';

/** Green when up, red when down, gray when flat. */
export function VariationBadge({ value, className }: { value: number; className?: string }) {
  const tone = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return (
    <span
      data-tone={tone}
      className={cx(
        'tabular inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
        tone === 'up' && 'bg-up-soft text-up',
        tone === 'down' && 'bg-down-soft text-down',
        tone === 'flat' && 'bg-surface-2 text-muted',
        className,
      )}
    >
      {tone === 'up' ? '▲' : tone === 'down' ? '▼' : '•'} {formatPercent(value)}
    </span>
  );
}
