import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../test/render';
import { OperationDialog } from './OperationDialog';

const context = {
  'GET /account/balance': [200, { balance: '5000.00' }],
  'GET /btc/price': [200, { buy: '299000.00', sell: '300000.00', date: '2026-10-26T15:00:00Z' }],
  'GET /btc': [
    200,
    {
      quote: { buy: '299000.00', sell: '300000.00', date: '2026-10-26T15:00:00Z' },
      investments: [],
      totals: { investedAmount: '0.00', btcAmount: '0.00000000', currentGrossAmount: '0.00' },
    },
  ],
} satisfies Record<string, [number, unknown]>;

afterEach(() => vi.unstubAllGlobals());

describe('OperationDialog', () => {
  it('previews the BTC of a purchase and blocks amounts above the balance', async () => {
    const fetchMock = mockApi(context);
    renderWithProviders(<OperationDialog operation="purchase" onClose={() => {}} />);

    const amount = await screen.findByLabelText('Valor em reais');
    await screen.findByText('R$ 5.000,00');
    await userEvent.type(amount, '3000');
    // R$ 3.000 at R$ 300.000/BTC
    expect(await screen.findByTestId('preview')).toHaveTextContent('Você recebe ≈ 0,01000000 BTC');

    await userEvent.clear(amount);
    await userEvent.type(amount, '5000,01');
    await userEvent.click(screen.getByRole('button', { name: 'Comprar' }));

    expect(await screen.findByText('Valor maior que o saldo disponível')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('sends the amount in the API format and closes on success', async () => {
    const onClose = vi.fn();
    const fetchMock = mockApi({
      ...context,
      'POST /account/deposit': [
        201,
        { id: 'x', amount: '1500.50', balance: '6500.50', date: '2026-10-26T15:00:00Z' },
      ],
    });
    renderWithProviders(<OperationDialog operation="deposit" onClose={onClose} />);

    await userEvent.type(await screen.findByLabelText('Valor em reais'), '1500,50');
    await userEvent.click(screen.getByRole('button', { name: 'Depositar' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]?.body))).toEqual({ amount: '1500.50' });
    expect(await screen.findByText('Depósito realizado')).toBeInTheDocument();
  });
});
