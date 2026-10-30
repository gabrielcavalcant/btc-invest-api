import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Position } from '../api/types';
import { PositionTable } from './PositionTable';

const position: Position = {
  quote: { buy: '331100.00', sell: '332000.00', date: '2026-10-26T15:00:00.000Z' },
  investments: [
    {
      id: 'a',
      purchasedAt: '2026-10-20T13:12:45.000Z',
      investedAmount: '3010.00',
      btcAmount: '0.01000000',
      btcPriceAtPurchase: '301000.00',
      priceVariationPercent: 10,
      currentGrossAmount: '3311.00',
    },
    {
      id: 'b',
      purchasedAt: '2026-10-21T10:00:00.000Z',
      investedAmount: '1000.00',
      btcAmount: '0.00250000',
      btcPriceAtPurchase: '400000.00',
      priceVariationPercent: -17.23,
      currentGrossAmount: '827.75',
    },
  ],
  totals: { investedAmount: '4010.00', btcAmount: '0.01250000', currentGrossAmount: '4138.75' },
};

describe('PositionTable', () => {
  it('lists each investment with its values and a colored variation', () => {
    render(<PositionTable position={position} />);
    const [, up, down, total] = screen.getAllByRole('row');

    expect(within(up!).getByText('R$ 3.010,00')).toBeInTheDocument();
    expect(within(up!).getByText('0,01000000 BTC')).toBeInTheDocument();
    expect(within(up!).getByText('▲ +10,00%')).toHaveAttribute('data-tone', 'up');

    expect(within(down!).getByText('▼ -17,23%')).toHaveAttribute('data-tone', 'down');
    expect(within(down!).getByText('R$ 827,75')).toBeInTheDocument();

    // totals: (4138.75 - 4010) / 4010 = +3.21%
    expect(within(total!).getByText('R$ 4.138,75')).toBeInTheDocument();
    expect(within(total!).getByText('▲ +3,21%')).toBeInTheDocument();

    // phone: one card per investment + the totals card
    const cards = within(screen.getByRole('list', { name: 'Investimentos' })).getAllByRole(
      'listitem',
    );
    expect(cards).toHaveLength(3);
    expect(within(cards[1]!).getByText('▼ -17,23%')).toBeInTheDocument();
  });

  it('shows a hint when there are no investments', () => {
    render(<PositionTable position={{ ...position, investments: [] }} />);
    expect(screen.getByText(/ainda não tem investimentos/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
