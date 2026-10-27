import { EntitySchema, type ValueTransformer } from 'typeorm';
import type { Account, Investment, PriceSnapshot, Transaction } from '../../domain/entities';

/**
 * Persistence mapping with EntitySchema: the domain entities stay as plain interfaces,
 * with no ORM decorators (the domain does not know the ORM exists).
 *
 * Postgres `bigint` comes back from the driver as string -> converted to JS bigint.
 */
const bigint: ValueTransformer = {
  to: (value: bigint | null | undefined) =>
    value === null || value === undefined ? value : value.toString(),
  from: (value: string | null) => (value === null ? null : BigInt(value)),
};

export const AccountSchema = new EntitySchema<Account>({
  name: 'Account',
  tableName: 'accounts',
  columns: {
    id: { type: 'uuid', primary: true },
    name: { type: 'varchar', length: 100 },
    email: { type: 'varchar', length: 254, unique: true },
    passwordHash: { type: 'varchar', length: 100, name: 'password_hash' },
    balanceCents: { type: 'bigint', name: 'balance_cents', transformer: bigint },
    createdAt: { type: 'timestamptz', name: 'created_at' },
  },
});

export const InvestmentSchema = new EntitySchema<Investment>({
  name: 'Investment',
  tableName: 'investments',
  columns: {
    id: { type: 'uuid', primary: true },
    accountId: { type: 'uuid', name: 'account_id' },
    btcSats: { type: 'bigint', name: 'btc_sats', transformer: bigint },
    investedCents: { type: 'bigint', name: 'invested_cents', transformer: bigint },
    priceCents: { type: 'bigint', name: 'price_cents', transformer: bigint },
    purchasedAt: { type: 'timestamptz', name: 'purchased_at' },
    liquidatedAt: { type: 'timestamptz', name: 'liquidated_at', nullable: true },
    originInvestmentId: { type: 'uuid', name: 'origin_investment_id', nullable: true },
  },
});

export const TransactionSchema = new EntitySchema<Transaction>({
  name: 'Transaction',
  tableName: 'transactions',
  columns: {
    id: { type: 'uuid', primary: true },
    accountId: { type: 'uuid', name: 'account_id' },
    type: { type: 'varchar', length: 20 },
    amountCents: { type: 'bigint', name: 'amount_cents', transformer: bigint },
    btcSats: { type: 'bigint', name: 'btc_sats', nullable: true, transformer: bigint },
    btcPriceCents: { type: 'bigint', name: 'btc_price_cents', nullable: true, transformer: bigint },
    investmentId: { type: 'uuid', name: 'investment_id', nullable: true },
    createdAt: { type: 'timestamptz', name: 'created_at' },
  },
});

export const PriceSnapshotSchema = new EntitySchema<PriceSnapshot>({
  name: 'PriceSnapshot',
  tableName: 'price_history',
  columns: {
    capturedAt: { type: 'timestamptz', name: 'captured_at', primary: true },
    buyCents: { type: 'bigint', name: 'buy_cents', transformer: bigint },
    sellCents: { type: 'bigint', name: 'sell_cents', transformer: bigint },
  },
});

export const schemas = [AccountSchema, InvestmentSchema, TransactionSchema, PriceSnapshotSchema];
