import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../test/render';
import { DashboardPage } from './DashboardPage';

const quote = { buy: '330000.00', sell: '331000.00', date: '2026-10-26T15:00:00Z' };

afterEach(() => vi.unstubAllGlobals());

describe('DashboardPage', () => {
  it('adds the balance and the investments into the total, with the result', async () => {
    mockApi({
      'GET /account/balance': [200, { balance: '1500.10' }],
      'GET /btc/price': [200, quote],
      'GET /history': [200, []],
      'GET /btc': [
        200,
        {
          quote,
          investments: [
            {
              id: 'a',
              purchasedAt: '2026-10-20T13:00:00Z',
              investedAmount: '3000.00',
              btcAmount: '0.01000000',
              btcPriceAtPurchase: '300000.00',
              priceVariationPercent: 10,
              currentGrossAmount: '3300.00',
            },
          ],
          totals: {
            investedAmount: '3000.00',
            btcAmount: '0.01000000',
            currentGrossAmount: '3300.00',
          },
        },
      ],
    });
    renderWithProviders(<DashboardPage />);

    // 1500.10 + 3300.00, summed as cents
    expect(await screen.findByText('R$ 4.800,10')).toBeInTheDocument();
    expect(screen.getByText('+R$ 300,00')).toBeInTheDocument();
    expect(screen.getAllByText('▲ +10,00%').length).toBeGreaterThan(0);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
  });

  it('invites to buy and blocks the sale while there is no BTC', async () => {
    mockApi({
      'GET /account/balance': [200, { balance: '0.00' }],
      'GET /btc/price': [200, quote],
      'GET /history': [200, []],
      'GET /btc': [
        200,
        {
          quote,
          investments: [],
          totals: { investedAmount: '0.00', btcAmount: '0.00000000', currentGrossAmount: '0.00' },
        },
      ],
    });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText(/ainda não tem investimentos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vender' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Comprar BTC' })).toBeEnabled();
  });
});
