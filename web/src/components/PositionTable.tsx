import { Bitcoin } from 'lucide-react';
import type { Position } from '../api/types';
import { formatDateTime } from '../lib/dates';
import { formatBrl, formatBtc, percentChange } from '../lib/money';
import { Button } from './ui';
import { VariationBadge } from './VariationBadge';

/** Every open investment: when it was bought, at what price and how it is doing now. */
export function PositionTable({ position, onBuy }: { position: Position; onBuy?: () => void }) {
  if (position.investments.length === 0) {
    return (
      <div className="mx-5 mb-5 flex flex-col items-center rounded-2xl border border-dashed border-line px-4 py-12 text-center sm:mx-6 sm:mb-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
          <Bitcoin className="size-6" />
        </span>
        <p className="mt-4 font-semibold text-fg">Nenhum investimento por aqui</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Você ainda não tem investimentos. Faça um depósito e compre BTC para começar.
        </p>
        {onBuy && (
          <Button className="mt-5" size="sm" onClick={onBuy}>
            Comprar BTC
          </Button>
        )}
      </div>
    );
  }

  const { totals } = position;
  const totalVariation = percentChange(totals.investedAmount, totals.currentGrossAmount);
  return (
    <>
      {/* Phone: one card per investment, everything readable without side scrolling */}
      <ul aria-label="Investimentos" className="tabular space-y-3 px-5 pb-5 md:hidden">
        {position.investments.map((investment) => (
          <li
            key={investment.id}
            data-investment
            className="rounded-2xl border border-line bg-surface-2/40 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-subtle">{formatDateTime(investment.purchasedAt)}</span>
              <VariationBadge value={investment.priceVariationPercent} />
            </div>
            <p className="mt-2 text-xs text-muted">Valor atual</p>
            <p className="font-display text-2xl font-semibold tracking-tight text-fg">
              {formatBrl(investment.currentGrossAmount)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-xs">
              <div>
                <dt className="text-subtle">Investido</dt>
                <dd className="mt-0.5 font-medium text-fg">
                  {formatBrl(investment.investedAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Cotação na compra</dt>
                <dd className="mt-0.5 font-medium text-fg">
                  {formatBrl(investment.btcPriceAtPurchase)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-subtle">Quantidade</dt>
                <dd className="mt-0.5 font-medium text-fg">{formatBtc(investment.btcAmount)}</dd>
              </div>
            </dl>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 rounded-2xl bg-brand-500/10 p-4 ring-1 ring-brand-500/20">
          <div>
            <p className="text-xs font-semibold text-brand-500">Total</p>
            <p className="font-display text-lg font-semibold text-fg">
              {formatBrl(totals.currentGrossAmount)}
            </p>
            <p className="text-xs text-muted">
              {formatBrl(totals.investedAmount)} investidos · {formatBtc(totals.btcAmount)}
            </p>
          </div>
          <VariationBadge value={totalVariation} />
        </li>
      </ul>

      {/* From md up: a table, to compare the investments side by side */}
      <div className="hidden overflow-x-auto md:block">
        <table className="tabular w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-y border-line bg-surface-2/50 text-left text-[11px] uppercase tracking-wider text-subtle">
              <th className="px-6 py-3 font-semibold">Data da compra</th>
              <th className="px-3 py-3 text-right font-semibold">Investido</th>
              <th className="px-3 py-3 text-right font-semibold">Quantidade</th>
              <th className="px-3 py-3 text-right font-semibold">Cotação na compra</th>
              <th className="px-3 py-3 text-right font-semibold">Variação</th>
              <th className="px-6 py-3 text-right font-semibold">Valor atual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {position.investments.map((investment) => (
              <tr key={investment.id} data-investment className="transition hover:bg-surface-2/50">
                <td className="px-6 py-4 text-muted">{formatDateTime(investment.purchasedAt)}</td>
                <td className="px-3 py-4 text-right text-fg">
                  {formatBrl(investment.investedAmount)}
                </td>
                <td className="px-3 py-4 text-right text-muted">
                  {formatBtc(investment.btcAmount)}
                </td>
                <td className="px-3 py-4 text-right text-muted">
                  {formatBrl(investment.btcPriceAtPurchase)}
                </td>
                <td className="px-3 py-4 text-right">
                  <VariationBadge value={investment.priceVariationPercent} />
                </td>
                <td className="px-6 py-4 text-right font-semibold text-fg">
                  {formatBrl(investment.currentGrossAmount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-surface-2/50 font-semibold text-fg">
              <td className="px-6 py-4">Total</td>
              <td className="px-3 py-4 text-right">{formatBrl(totals.investedAmount)}</td>
              <td className="px-3 py-4 text-right">{formatBtc(totals.btcAmount)}</td>
              <td />
              <td className="px-3 py-4 text-right">
                <VariationBadge value={totalVariation} />
              </td>
              <td className="px-6 py-4 text-right">{formatBrl(totals.currentGrossAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
