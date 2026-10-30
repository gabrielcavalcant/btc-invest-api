import {
  ArrowDownToLine,
  Download,
  HandCoins,
  Repeat,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useStatement } from '../api/queries';
import type { Transaction, TransactionType } from '../api/types';
import { Alert, Badge, Button, Card, Input, PageHeader, Skeleton, cx } from '../components/ui';
import { daysAgo, formatDateTime, toDateInput } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { formatBrl, formatBtc, toDecimal, toScaled } from '../lib/money';

/** How each entry type reads in the statement; `credit` = money back to the balance. */
const TYPES: Record<
  TransactionType,
  { label: string; credit: boolean; icon: LucideIcon; className: string }
> = {
  DEPOSIT: {
    label: 'Depósito',
    credit: true,
    icon: ArrowDownToLine,
    className: 'bg-sky-500/10 text-sky-500',
  },
  PURCHASE: {
    label: 'Compra',
    credit: false,
    icon: ShoppingCart,
    className: 'bg-brand-500/10 text-brand-500',
  },
  SELL: { label: 'Venda', credit: true, icon: HandCoins, className: 'bg-up-soft text-up' },
  REINVESTMENT: {
    label: 'Reinvestimento',
    credit: false,
    icon: Repeat,
    className: 'bg-violet-500/10 text-violet-500',
  },
};

const PRESETS = [7, 30, 90] as const;

const rangeOf = (days: number) => ({
  from: toDateInput(daysAgo(days)),
  to: toDateInput(new Date()),
});

export function StatementPage() {
  const [range, setRange] = useState(() => rangeOf(90));
  const [draft, setDraft] = useState(range);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const statement = useStatement(range.from, range.to);
  const items = statement.data?.items;

  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setRangeError('A data inicial deve ser anterior à final.');
      return;
    }
    setRangeError(null);
    setRange(draft);
  };

  const pickPreset = (days: number) => {
    const next = rangeOf(days);
    setRangeError(null);
    setDraft(next);
    setRange(next);
  };
  const activePreset = PRESETS.find((days) => {
    const preset = rangeOf(days);
    return preset.from === range.from && preset.to === range.to;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extrato"
        description="Depósitos, compras, vendas e reinvestimentos. Por padrão, os últimos 90 dias."
        actions={
          <Button
            variant="secondary"
            onClick={() => items && downloadCsv(items, range)}
            disabled={!items?.length}
          >
            <Download className="size-4" />
            Exportar CSV
          </Button>
        }
      />

      <Card className="animate-fade-up">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div
            role="group"
            aria-label="Período rápido"
            className="flex gap-1 rounded-xl bg-surface-2 p-1"
          >
            {PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => pickPreset(days)}
                aria-pressed={activePreset === days}
                className={cx(
                  'rounded-lg px-3.5 py-1.5 text-sm font-medium transition',
                  activePreset === days
                    ? 'bg-surface text-fg shadow-sm ring-1 ring-line'
                    : 'text-muted hover:text-fg',
                )}
              >
                {days} dias
              </button>
            ))}
          </div>
          <form
            noValidate
            onSubmit={apply}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Input
              label="De"
              type="date"
              name="from"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
            <Input
              label="Até"
              type="date"
              name="to"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
            <Button type="submit" variant="secondary" className="h-11">
              Filtrar
            </Button>
          </form>
        </div>
        {rangeError && (
          <div className="mt-3">
            <Alert>{rangeError}</Alert>
          </div>
        )}
      </Card>

      {items && items.length > 0 && <Summary items={items} />}

      <Card
        title={items ? `${items.length} lançamento(s)` : 'Lançamentos'}
        padded={false}
        className="animate-fade-up"
      >
        {statement.isPending && (
          <div className="space-y-2 px-5 pb-5 sm:px-6 sm:pb-6">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}
        {statement.isError && (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <Alert>{errorMessage(statement.error)}</Alert>
          </div>
        )}
        {items?.length === 0 && (
          <p className="mx-5 mb-5 rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted sm:mx-6 sm:mb-6">
            Nenhum lançamento neste período.
          </p>
        )}
        {items && items.length > 0 && (
          // Phone: a list of entries; from md up: a table with every column
          <ul
            aria-label="Lançamentos"
            className="tabular divide-y divide-line border-t border-line md:hidden"
          >
            {[...items].reverse().map((item) => {
              const type = TYPES[item.type];
              const Icon = type.icon;
              return (
                <li key={item.id} data-entry className="flex items-center gap-3 px-5 py-3.5">
                  <span
                    className={cx(
                      'grid size-10 shrink-0 place-items-center rounded-xl',
                      type.className,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-fg">{type.label}</p>
                    <p className="text-xs text-subtle">{formatDateTime(item.date)}</p>
                    {item.btcPrice && (
                      <p className="text-xs text-subtle">Cotação {formatBrl(item.btcPrice)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={cx('text-sm font-semibold', type.credit ? 'text-up' : 'text-fg')}>
                      {`${type.credit ? '+' : '−'} ${formatBrl(item.amount)}`}
                    </p>
                    {item.btcAmount && (
                      <p className="text-xs text-subtle">{formatBtc(item.btcAmount)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {items && items.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="tabular w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-y border-line bg-surface-2/50 text-left text-[11px] uppercase tracking-wider text-subtle">
                  <th className="px-6 py-3 font-semibold">Tipo</th>
                  <th className="px-3 py-3 font-semibold">Data</th>
                  <th className="px-3 py-3 text-right font-semibold">Valor</th>
                  <th className="px-3 py-3 text-right font-semibold">Quantidade</th>
                  <th className="px-6 py-3 text-right font-semibold">Cotação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {/* newest first */}
                {[...items].reverse().map((item) => {
                  const type = TYPES[item.type];
                  const Icon = type.icon;
                  return (
                    <tr key={item.id} data-entry className="transition hover:bg-surface-2/50">
                      <td className="px-6 py-3">
                        <span className="flex items-center gap-3">
                          <span
                            className={cx(
                              'grid size-9 place-items-center rounded-xl',
                              type.className,
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <Badge className={type.className}>{type.label}</Badge>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted">{formatDateTime(item.date)}</td>
                      <td
                        className={cx(
                          'px-3 py-3 text-right font-semibold',
                          type.credit ? 'text-up' : 'text-fg',
                        )}
                      >
                        {type.credit ? '+' : '−'} {formatBrl(item.amount)}
                      </td>
                      <td className="px-3 py-3 text-right text-muted">
                        {item.btcAmount ? formatBtc(item.btcAmount) : '—'}
                      </td>
                      <td className="px-6 py-3 text-right text-muted">
                        {item.btcPrice ? formatBrl(item.btcPrice) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Money in, money out and BTC moved in the period (bigint sums, no floats). */
function Summary({ items }: { items: Transaction[] }) {
  const sum = (types: TransactionType[]) =>
    items
      .filter((item) => types.includes(item.type))
      .reduce((total, item) => total + toScaled(item.amount, 2), 0n);
  const deposits = sum(['DEPOSIT']);
  const sales = sum(['SELL']);
  const purchases = sum(['PURCHASE']);
  const cards = [
    { label: 'Depósitos', value: deposits, className: 'text-sky-500' },
    { label: 'Compras de BTC', value: purchases, className: 'text-brand-500' },
    { label: 'Resgates (vendas)', value: sales, className: 'text-up' },
  ];
  return (
    <div className="stagger grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{card.label}</p>
          <p
            className={cx(
              'tabular mt-2 font-display text-2xl font-semibold tracking-tight',
              card.className,
            )}
          >
            {formatBrl(toDecimal(card.value, 2))}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Statement as CSV (values in the API format, ready for a spreadsheet). */
function downloadCsv(items: Transaction[], range: { from: string; to: string }) {
  const header = ['data', 'tipo', 'valor_brl', 'quantidade_btc', 'cotacao_brl'];
  const rows = items.map((item) => [
    item.date,
    TYPES[item.type].label,
    item.amount,
    item.btcAmount ?? '',
    item.btcPrice ?? '',
  ]);
  const csv = [header, ...rows].map((row) => row.join(';')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `extrato-${range.from}-a-${range.to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
