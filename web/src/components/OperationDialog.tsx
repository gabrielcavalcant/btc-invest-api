import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownToLine, HandCoins, ShoppingCart, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useBalance, useOperation, usePosition, useQuote, type Operation } from '../api/queries';
import type { DepositResult, PurchaseResult, SellResult } from '../api/types';
import { errorMessage } from '../lib/errors';
import {
  AMOUNT_INPUT_RE,
  estimateBtcForPurchase,
  estimateBtcForSale,
  formatBrl,
  formatBtc,
  isGreater,
  normalizeAmount,
  toDecimal,
  toScaled,
} from '../lib/money';
import { amountSchema, type AmountForm } from '../lib/schemas';
import { Modal } from './Modal';
import { useToast } from './toast';
import { Alert, Button, Input } from './ui';

const TITLES: Record<Operation, string> = {
  deposit: 'Depositar reais',
  purchase: 'Comprar Bitcoin',
  sell: 'Vender Bitcoin',
};

const SUBMIT_LABELS: Record<Operation, string> = {
  deposit: 'Depositar',
  purchase: 'Comprar',
  sell: 'Vender',
};

/** Deposit, purchase or sale form, with a live preview of the result. */
export function OperationDialog({
  operation,
  onClose,
}: {
  operation: Operation | null;
  onClose: () => void;
}) {
  const Icon = operation && ICONS[operation];
  return (
    <Modal
      open={operation !== null}
      title={operation ? TITLES[operation] : ''}
      icon={
        Icon && (
          <span className="grid size-10 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
            <Icon className="size-5" />
          </span>
        )
      }
      onClose={onClose}
    >
      {operation && <OperationForm key={operation} operation={operation} onDone={onClose} />}
    </Modal>
  );
}

const ICONS: Record<Operation, LucideIcon> = {
  deposit: ArrowDownToLine,
  purchase: ShoppingCart,
  sell: HandCoins,
};

/** Shortcuts for common amounts (R$) */
const QUICK_AMOUNTS = ['100', '500', '1000'];

function OperationForm({ operation, onDone }: { operation: Operation; onDone: () => void }) {
  const toast = useToast();
  const balanceQuery = useBalance();
  const positionQuery = usePosition();
  const balance = balanceQuery.data?.balance;
  const position = positionQuery.data;
  const quote = useQuote().data;
  const mutation = useOperation(operation);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setFocus,
    setError,
    formState: { errors },
  } = useForm<AmountForm>({ resolver: zodResolver(amountSchema), defaultValues: { amount: '' } });

  useEffect(() => setFocus('amount'), [setFocus]);

  // What can be used in this operation (undefined = no limit, e.g. deposits)
  const limit =
    operation === 'purchase'
      ? balance
      : operation === 'sell'
        ? position?.totals.currentGrossAmount
        : undefined;

  const amount = watch('amount');
  const validAmount = AMOUNT_INPUT_RE.test(amount.trim()) && /[1-9]/.test(amount);

  // A value being refreshed may be stale (e.g. right after another operation): then the
  // API, which is the source of truth, decides instead of blocking with an old number
  const limitIsFresh = !(operation === 'purchase' ? balanceQuery : positionQuery).isFetching;

  const submit = handleSubmit((data) => {
    if (limit !== undefined && limitIsFresh && isGreater(data.amount, limit)) {
      setError('amount', {
        message:
          operation === 'purchase'
            ? 'Valor maior que o saldo disponível'
            : 'Valor maior que o total dos seus investimentos',
      });
      return;
    }
    mutation.mutate(normalizeAmount(data.amount), {
      onSuccess: (result) => {
        toast({ tone: 'success', ...successMessage(operation, result) });
        onDone();
      },
    });
  });

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 text-sm">
        <div>
          <dt className="text-subtle">
            {operation === 'sell' ? 'Disponível para resgate' : 'Saldo disponível'}
          </dt>
          <dd className="tabular mt-0.5 font-semibold text-fg">
            {operation === 'sell'
              ? position && formatBrl(position.totals.currentGrossAmount)
              : balance && formatBrl(balance)}
          </dd>
        </div>
        {operation !== 'deposit' && (
          <div>
            <dt className="text-subtle">
              {operation === 'purchase' ? 'Preço de venda (ask)' : 'Preço de compra (bid)'}
            </dt>
            <dd className="tabular mt-0.5 font-semibold text-fg">
              {quote && formatBrl(operation === 'purchase' ? quote.sell : quote.buy)}
            </dd>
          </div>
        )}
      </dl>

      {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}

      <Input
        label="Valor em reais"
        inputMode="decimal"
        placeholder="0,00"
        autoComplete="off"
        leading={<span className="text-sm font-semibold">R$</span>}
        inputClassName="h-14 text-xl font-semibold tabular"
        error={errors.amount?.message}
        {...register('amount')}
      />

      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setValue('amount', value, { shouldValidate: true })}
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted transition hover:border-brand-500/50 hover:text-brand-500"
          >
            {formatBrl(`${value}.00`).replace(',00', '')}
          </button>
        ))}
        {limit && toScaled(limit, 2) > 0n && (
          <button
            type="button"
            onClick={() => setValue('amount', limit.replace('.', ','), { shouldValidate: true })}
            className="rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-500 transition hover:bg-brand-500/20"
          >
            Tudo
          </button>
        )}
      </div>

      {validAmount && (
        <p
          className="tabular rounded-xl border border-brand-500/30 bg-brand-500/10 px-3.5 py-2.5 text-sm font-medium text-brand-500"
          data-testid="preview"
        >
          {preview(operation, normalizeAmount(amount), {
            balance,
            buy: quote?.buy,
            sell: quote?.sell,
          })}
        </p>
      )}

      {operation === 'sell' && (
        <p className="text-xs leading-relaxed text-subtle">
          Os investimentos mais antigos são vendidos primeiro. Se um deles for vendido em parte, ele
          é liquidado e o troco é reinvestido mantendo a cotação original.
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>
        {SUBMIT_LABELS[operation]}
      </Button>
    </form>
  );
}

function preview(
  operation: Operation,
  amount: string,
  context: { balance?: string; buy?: string; sell?: string },
): string {
  if (operation === 'deposit') {
    if (!context.balance) return '';
    const after = toDecimal(toScaled(context.balance, 2) + toScaled(amount, 2), 2);
    return `Saldo após o depósito: ${formatBrl(after)}`;
  }
  if (operation === 'purchase') {
    return context.sell
      ? `Você recebe ≈ ${formatBtc(estimateBtcForPurchase(amount, context.sell))}`
      : 'Carregando cotação…';
  }
  return context.buy
    ? `Serão vendidos ≈ ${formatBtc(estimateBtcForSale(amount, context.buy))}`
    : 'Carregando cotação…';
}

function successMessage(
  operation: Operation,
  result: DepositResult | PurchaseResult | SellResult,
): { title: string; description: string } {
  if (operation === 'deposit') {
    const r = result as DepositResult;
    return {
      title: 'Depósito realizado',
      description: `${formatBrl(r.amount)} adicionados. Você recebe um e-mail de confirmação.`,
    };
  }
  if (operation === 'purchase') {
    const r = result as PurchaseResult;
    return {
      title: 'Compra realizada',
      description: `${formatBtc(r.btcAmount)} por ${formatBrl(r.amount)}.`,
    };
  }
  const r = result as SellResult;
  const change = r.reinvestment ? ` Troco de ${formatBrl(r.reinvestment.amount)} reinvestido.` : '';
  return {
    title: 'Venda realizada',
    description: `${formatBtc(r.btcAmount)} vendidos, ${formatBrl(r.amount)} resgatados.${change}`,
  };
}
