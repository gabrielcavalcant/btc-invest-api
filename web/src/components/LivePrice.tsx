import { useState } from 'react';
import { useQuote } from '../api/queries';
import { formatBrl, toScaled } from '../lib/money';
import { Skeleton, cx } from './ui';

type Direction = 'up' | 'down' | null;

/**
 * Remembers the last value and whether the new one went up or down, so a changed price
 * can flash. Derived during render (no effect): `tick` restarts the CSS animation.
 */
export function usePriceDirection(value: string | undefined) {
  const [state, setState] = useState<{ value?: string; direction: Direction; tick: number }>({
    value,
    direction: null,
    tick: 0,
  });
  if (value !== state.value) {
    let direction: Direction = null;
    if (value && state.value) {
      const diff = toScaled(value, 2) - toScaled(state.value, 2);
      direction = diff > 0n ? 'up' : diff < 0n ? 'down' : null;
    }
    setState({ value, direction, tick: state.tick + 1 });
  }
  return state;
}

/** A price that glows green/red for a moment whenever it changes. */
export function FlashingPrice({ value, className }: { value: string; className?: string }) {
  const { direction, tick } = usePriceDirection(value);
  return (
    <span
      key={tick}
      className={cx(
        'tabular inline-block',
        direction === 'up' && 'animate-flash-up',
        direction === 'down' && 'animate-flash-down',
        className,
      )}
    >
      {formatBrl(value)}
    </span>
  );
}

/** Pill in the top bar: live BTC price (what the market pays), refreshed every 10 s. */
export function LivePrice() {
  const quote = useQuote();
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-line bg-surface/80 py-1.5 pl-2 pr-3.5 backdrop-blur">
      <span className="grid size-6 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">
        ₿
      </span>
      {quote.data ? (
        <span className="text-sm font-semibold text-fg">
          <FlashingPrice value={quote.data.buy} />
        </span>
      ) : (
        <Skeleton className="h-4 w-24" />
      )}
      <span
        className="size-2 rounded-full bg-emerald-400 animate-pulse-dot"
        title="Ao vivo: atualiza a cada 10 segundos"
        aria-hidden="true"
      />
      <span className="sr-only">Cotação ao vivo</span>
    </div>
  );
}
