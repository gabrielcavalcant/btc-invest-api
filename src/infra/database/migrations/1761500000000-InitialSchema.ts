import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1761500000000 implements MigrationInterface {
  name = 'InitialSchema1761500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE accounts (
        id             uuid PRIMARY KEY,
        name           varchar(100) NOT NULL,
        email          varchar(254) NOT NULL,
        password_hash  varchar(100) NOT NULL,
        balance_cents  bigint       NOT NULL DEFAULT 0,
        created_at     timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT uq_accounts_email UNIQUE (email),
        CONSTRAINT ck_accounts_balance_not_negative CHECK (balance_cents >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE investments (
        id                    uuid PRIMARY KEY,
        account_id            uuid        NOT NULL REFERENCES accounts (id),
        btc_sats              bigint      NOT NULL CHECK (btc_sats > 0),
        invested_cents        bigint      NOT NULL CHECK (invested_cents >= 0),
        price_cents           bigint      NOT NULL CHECK (price_cents > 0),
        purchased_at          timestamptz NOT NULL,
        liquidated_at         timestamptz,
        origin_investment_id  uuid REFERENCES investments (id)
      )
    `);
    // Partial index: the position and the FIFO sale only read open investments.
    await queryRunner.query(`
      CREATE INDEX ix_investments_open
        ON investments (account_id, purchased_at)
        WHERE liquidated_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE transactions (
        id               uuid PRIMARY KEY,
        account_id       uuid        NOT NULL REFERENCES accounts (id),
        type             varchar(20) NOT NULL
                         CHECK (type IN ('DEPOSIT', 'PURCHASE', 'SELL', 'REINVESTMENT')),
        amount_cents     bigint      NOT NULL CHECK (amount_cents >= 0),
        btc_sats         bigint,
        btc_price_cents  bigint,
        investment_id    uuid REFERENCES investments (id),
        created_at       timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_transactions_account_created ON transactions (account_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_transactions_created_type ON transactions (created_at, type)`,
    );

    await queryRunner.query(`
      CREATE TABLE price_history (
        captured_at  timestamptz PRIMARY KEY,
        buy_cents    bigint NOT NULL,
        sell_cents   bigint NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE price_history`);
    await queryRunner.query(`DROP TABLE transactions`);
    await queryRunner.query(`DROP TABLE investments`);
    await queryRunner.query(`DROP TABLE accounts`);
  }
}
