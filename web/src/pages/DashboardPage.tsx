import { ArrowDownToLine, Bitcoin, PiggyBank, ShoppingCart, Wallet, HandCoins } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useBalance, useHistory, usePosition, useQuote, type Operation } from '../api/queries';
import { FlashingPrice } from '../components/LivePrice';
import { OperationDialog } from '../components/OperationDialog';
import { PositionTable } from '../components/PositionTable';
import { Sparkline } from '../components/Sparkline';
import { Alert, Button, Card, IconTile, PageHeader, Skeleton, cx } from '../components/ui';
import { VariationBadge } from '../components/VariationBadge';
import { formatTime } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { formatBrl, formatBtc, percentChange, toDecimal, toScaled } from '../lib/money';

export function DashboardPage() {
  const [operation, setOperation] = useState<Operation | null>(null);
  const balance = useBalance();
  const quote = useQuote();
  const position = usePosition();
  const totals = position.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel"
        description="Seu patrimônio, a cotação do BTC e seus investimentos."
        actions={
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Button variant="secondary" onClick={() => setOperation('deposit')}>
              <ArrowDownToLine className="hidden size-4 sm:block" />
              Depositar
            </Button>
            <Button onClick={() => setOperation('purchase')}>
              <ShoppingCart className="hidden size-4 sm:block" />
              Comprar
            </Button>
            <Button
              variant="secondary"
              onClick={() => setOperation('sell')}
              disabled={!totals || totals.btcAmount === '0.00000000'}
            >
              <HandCoins className="hidden size-4 sm:block" />
              Vender
            </Button>
          </div>
        }
      />

      {(balance.isError || quote.isError || position.isError) && (
        <Alert>{errorMessage(balance.error ?? quote.error ?? position.error)}</Alert>
      )}

      <div className="stagger grid gap-4 xl:grid-cols-3">
        <PatrimonyCard
          balance={balance.data?.balance}
          invested={totals?.investedAmount}
          current={totals?.currentGrossAmount}
        >
          <MiniStat
            icon={<Wallet className="size-4" />}
            tone="bg-sky-500/10 text-sky-500"
            label="Saldo disponível"
            loading={balance.isPending}
          >
            {balance.data && formatBrl(balance.data.balance)}
          </MiniStat>
          <MiniStat
            icon={<PiggyBank className="size-4" />}
            tone="bg-violet-500/10 text-violet-500"
            label="Total investido"
            loading={position.isPending}
            footer={totals && `${position.data!.investments.length} investimento(s) em aberto`}
          >
            {totals && formatBrl(totals.investedAmount)}
          </MiniStat>
          <MiniStat
            icon={<Bitcoin className="size-4" />}
            tone="bg-brand-500/10 text-brand-500"
            label="Valor atual em BTC"
            loading={position.isPending}
            footer={
              totals && (
                <span className="flex flex-wrap items-center gap-2">
                  {formatBtc(totals.btcAmount)}
                  {totals.investedAmount !== '0.00' && (
                    <VariationBadge
                      value={percentChange(totals.investedAmount, totals.currentGrossAmount)}
                    />
                  )}
                </span>
              )
            }
          >
            {totals && formatBrl(totals.currentGrossAmount)}
          </MiniStat>
        </PatrimonyCard>
        <BitcoinCard />
      </div>

      <Card
        title="Meus investimentos"
        description="Os mais antigos são vendidos primeiro (FIFO)."
        padded={false}
        className="animate-fade-up"
      >
        {position.isPending ? (
          <div className="space-y-2 px-5 pb-5 sm:px-6 sm:pb-6">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          position.data && (
            <PositionTable position={position.data} onBuy={() => setOperation('purchase')} />
          )
        )}
      </Card>

      <OperationDialog operation={operation} onClose={() => setOperation(null)} />
    </div>
  );
}

/** Balance + investments now, the profit/loss and how the money is split. */
function PatrimonyCard({
  balance,
  invested,
  current,
  children,
}: {
  balance?: string;
  invested?: string;
  current?: string;
  children: ReactNode;
}) {
  const ready = balance !== undefined && invested !== undefined && current !== undefined;
  const balanceCents = ready ? toScaled(balance, 2) : 0n;
  const currentCents = ready ? toScaled(current, 2) : 0n;
  const totalCents = balanceCents + currentCents;
  const profitCents = ready ? currentCents - toScaled(invested, 2) : 0n;
  // share of the money that is in BTC, in tenths of a percent (bigint, then a CSS width)
  const btcShare = totalCents > 0n ? Number((currentCents * 1000n) / totalCents) / 10 : 0;

  return (
    <section className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 xl:col-span-2">
      <div
        className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-brand-500/15 blur-3xl"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-muted">Patrimônio total</p>
      {ready ? (
        <>
          <p className="tabular mt-2 font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            {formatBrl(toDecimal(totalCents, 2))}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            {invested !== '0.00' ? (
              <>
                <span
                  className={cx(
                    'tabular font-semibold',
                    profitCents >= 0n ? 'text-up' : 'text-down',
                  )}
                >
                  {profitCents >= 0n ? '+' : ''}
                  {formatBrl(toDecimal(profitCents, 2))}
                </span>
                <VariationBadge value={percentChange(invested, current)} />
                <span>de resultado nos investimentos</span>
              </>
            ) : (
              <span>Compre BTC para começar a acompanhar o resultado.</span>
            )}
          </p>

          <div className="mt-6">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="bg-sky-500 transition-all" style={{ width: `${100 - btcShare}%` }} />
              <div className="bg-brand-500 transition-all" style={{ width: `${btcShare}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <Legend
                color="bg-sky-500"
                label="Em reais"
                value={formatBrl(balance)}
                share={100 - btcShare}
              />
              <Legend
                color="bg-brand-500"
                label="Em Bitcoin"
                value={formatBrl(current)}
                share={btcShare}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <Skeleton className="mt-3 h-12 w-64" />
          <Skeleton className="mt-3 h-4 w-48" />
          <Skeleton className="mt-8 h-2.5 w-full" />
        </>
      )}
      <div className="relative mt-auto grid gap-2 pt-6 sm:grid-cols-3 sm:gap-3">{children}</div>
    </section>
  );
}

function Legend({
  color,
  label,
  value,
  share,
}: {
  color: string;
  label: string;
  value: string;
  share: number;
}) {
  return (
    <span className="tabular flex items-center gap-2 text-muted">
      <span className={cx('size-2.5 rounded-full', color)} />
      {label}
      <span className="font-semibold text-fg">{value}</span>
      <span className="text-subtle">{share.toFixed(1).replace('.', ',')}%</span>
    </span>
  );
}

/** Live price, spread and a sparkline of the last hours. */
function BitcoinCard() {
  const quote = useQuote();
  const history = useHistory();
  const values = (history.data ?? []).map((p) => Number(p.buy));

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-brand-500 text-lg font-bold text-white shadow-lg shadow-brand-500/30">
          ₿
        </span>
        <div>
          <p className="font-semibold text-fg">Bitcoin agora</p>
          <p className="text-xs text-subtle">Mercado Bitcoin · BTC/BRL</p>
        </div>
      </div>
      {quote.data ? (
        <>
          <p className="mt-5 font-display text-3xl font-semibold tracking-tight text-fg">
            <FlashingPrice value={quote.data.buy} />
          </p>
          <dl className="tabular mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-surface-2/70 px-2.5 py-2">
              <dt className="text-subtle">Você vende por</dt>
              <dd className="mt-0.5 font-semibold text-fg">{formatBrl(quote.data.buy)}</dd>
            </div>
            <div className="rounded-lg bg-surface-2/70 px-2.5 py-2">
              <dt className="text-subtle">Você compra por</dt>
              <dd className="mt-0.5 font-semibold text-fg">{formatBrl(quote.data.sell)}</dd>
            </div>
          </dl>
          <Sparkline values={values} className="mt-4 h-14 w-full" />
          <p className="mt-auto pt-3 text-xs text-subtle">
            Atualizado às {formatTime(quote.data.date)} · a cada 10 s
          </p>
        </>
      ) : (
        <>
          <Skeleton className="mt-5 h-9 w-48" />
          <Skeleton className="mt-3 h-12 w-full" />
        </>
      )}
    </section>
  );
}

function MiniStat({
  icon,
  tone,
  label,
  loading,
  footer,
  children,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  loading: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    // phone: one compact row (label left, value right); from sm up: a small tile
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/50 p-3.5 sm:block sm:p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconTile className={cx('size-8 rounded-lg', tone)}>{icon}</IconTile>
        <p className="text-xs font-medium text-muted">{label}</p>
      </div>
      <div className="text-right sm:text-left">
        {loading ? (
          <Skeleton className="h-6 w-24 sm:mt-3 sm:w-28" />
        ) : (
          <p className="tabular whitespace-nowrap font-display text-lg font-semibold tracking-tight text-fg sm:mt-3 sm:text-xl">
            {children}
          </p>
        )}
        {footer && <div className="tabular mt-1.5 hidden text-xs text-muted sm:flex">{footer}</div>}
      </div>
    </div>
  );
}
