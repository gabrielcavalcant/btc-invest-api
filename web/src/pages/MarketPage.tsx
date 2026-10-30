import { ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useHistory, useQuote, useVolume } from '../api/queries';
import { FlashingPrice } from '../components/LivePrice';
import { Alert, Card, IconTile, PageHeader, Skeleton } from '../components/ui';
import { VariationBadge } from '../components/VariationBadge';
import { formatTime } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { formatBrl, formatBtc, percentChange, toDecimal, toScaled } from '../lib/money';

const compactBrl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function MarketPage() {
  const history = useHistory();
  const volume = useVolume();
  const quote = useQuote();

  // Chart coordinates only: the money values shown as text never go through floats
  const points = (history.data ?? []).map((p) => ({
    time: formatTime(p.date),
    buy: Number(p.buy),
    sell: Number(p.sell),
    buyLabel: p.buy,
    sellLabel: p.sell,
  }));
  const first = history.data?.[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mercado"
        description="Cotações das últimas 24 horas (uma a cada 10 minutos) e o volume negociado hoje."
      />

      {(history.isError || volume.isError || quote.isError) && (
        <Alert>{errorMessage(history.error ?? volume.error ?? quote.error)}</Alert>
      )}

      <div className="stagger grid gap-4 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6">
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand-500/15 blur-3xl"
            aria-hidden="true"
          />
          <p className="text-sm text-muted">BTC / BRL agora</p>
          {quote.data ? (
            <>
              <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-fg">
                <FlashingPrice value={quote.data.buy} />
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                {first && (
                  <>
                    <VariationBadge value={percentChange(first.buy, quote.data.buy)} />
                    <span>desde {formatTime(first.date)}</span>
                  </>
                )}
              </div>
              <dl className="tabular mt-5 space-y-2 text-sm">
                <Row label="Você compra por (ask)" value={formatBrl(quote.data.sell)} />
                <Row label="Você vende por (bid)" value={formatBrl(quote.data.buy)} />
                <Row
                  label="Spread"
                  value={formatBrl(
                    toDecimal(toScaled(quote.data.sell, 2) - toScaled(quote.data.buy, 2), 2),
                  )}
                />
              </dl>
            </>
          ) : (
            <>
              <Skeleton className="mt-3 h-10 w-56" />
              <Skeleton className="mt-5 h-20 w-full" />
            </>
          )}
        </section>

        <VolumeCard
          label="Comprado hoje na plataforma"
          value={volume.data?.buy}
          icon={<ArrowDownRight className="size-5" />}
          tone="bg-up-soft text-up"
        />
        <VolumeCard
          label="Vendido hoje na plataforma"
          value={volume.data?.sell}
          icon={<ArrowUpRight className="size-5" />}
          tone="bg-down-soft text-down"
        />
      </div>

      <Card
        title="Cotação do BTC · últimas 24h"
        description="Gravada pelo worker a cada 10 minutos (08:00, 08:10, 08:20…)."
        className="animate-fade-up"
      >
        {history.isPending && <Skeleton className="h-80" />}
        {history.data && points.length < 2 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line text-center">
            <IconTile className="bg-brand-500/10 text-brand-500">
              <Clock className="size-5" />
            </IconTile>
            <p className="max-w-sm text-sm text-muted">
              O histórico é gravado a cada 10 minutos. Em breve o gráfico aparece aqui
              {points.length === 1 && ` (primeiro registro às ${points[0]!.time})`}.
            </p>
          </div>
        )}
        {points.length >= 2 && (
          <div className="h-80" data-testid="price-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="buyFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f7931a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f7931a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12, fill: 'var(--subtle)' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={32}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 12, fill: 'var(--subtle)' }}
                  axisLine={false}
                  tickLine={false}
                  width={76}
                  tickFormatter={(v: number) => compactBrl.format(v)}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--line)' }}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    color: 'var(--fg)',
                  }}
                  labelStyle={{ color: 'var(--muted)' }}
                  formatter={(_value, name, item) => [
                    formatBrl(
                      name === 'Venda (bid)' ? item.payload.buyLabel : item.payload.sellLabel,
                    ),
                    name,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="sell"
                  name="Compra (ask)"
                  stroke="var(--muted)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="buy"
                  name="Venda (bid)"
                  stroke="#f7931a"
                  strokeWidth={2.5}
                  fill="url(#buyFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {points.length >= 2 && (
          <p className="mt-3 text-xs text-subtle">
            Laranja: quanto o mercado paga (bid). Tracejado: quanto o mercado cobra (ask). A
            distância entre elas é o spread.
          </p>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-fg">{value}</dd>
    </div>
  );
}

function VolumeCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value?: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center gap-3">
        <IconTile className={tone}>{icon}</IconTile>
        <p className="text-sm text-muted">{label}</p>
      </div>
      {value !== undefined ? (
        <p className="tabular mt-auto pt-6 font-display text-3xl font-semibold tracking-tight text-fg">
          {formatBtc(value)}
        </p>
      ) : (
        <Skeleton className="mt-auto h-9 w-48" />
      )}
      <p className="mt-1 text-xs text-subtle">Desde 00:00 (horário de Brasília)</p>
    </section>
  );
}
