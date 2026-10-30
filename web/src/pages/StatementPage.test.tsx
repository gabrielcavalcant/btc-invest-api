import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../test/render';
import { StatementPage } from './StatementPage';

const items = [
  {
    id: '1',
    type: 'DEPOSIT',
    date: '2026-10-20T10:00:00Z',
    amount: '10000.00',
    btcAmount: null,
    btcPrice: null,
    investmentId: null,
  },
  {
    id: '2',
    type: 'PURCHASE',
    date: '2026-10-20T11:00:00Z',
    amount: '3000.00',
    btcAmount: '0.01000000',
    btcPrice: '300000.00',
    investmentId: 'a',
  },
  {
    id: '3',
    type: 'SELL',
    date: '2026-10-21T11:00:00Z',
    amount: '1650.00',
    btcAmount: '0.00500000',
    btcPrice: '330000.00',
    investmentId: 'a',
  },
  {
    id: '4',
    type: 'REINVESTMENT',
    date: '2026-10-21T11:00:00Z',
    amount: '1500.00',
    btcAmount: '0.00500000',
    btcPrice: '300000.00',
    investmentId: 'b',
  },
];

afterEach(() => vi.unstubAllGlobals());

describe('StatementPage', () => {
  it('lists every entry and sums deposits, purchases and sales', async () => {
    mockApi({ 'GET /extract': [200, { from: '', to: '', items }] });
    renderWithProviders(<StatementPage />);

    expect(await screen.findByText('4 lançamento(s)')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(5); // header + 4
    expect(screen.getByText('R$ 10.000,00')).toBeInTheDocument(); // deposits card
    expect(screen.getByText('R$ 3.000,00')).toBeInTheDocument(); // purchases card
    expect(screen.getByText('R$ 1.650,00')).toBeInTheDocument(); // sales card
    expect(within(screen.getByRole('table')).getByText('Reinvestimento')).toBeInTheDocument();
    // the phone list has the same entries
    expect(
      within(screen.getByRole('list', { name: 'Lançamentos' })).getAllByRole('listitem'),
    ).toHaveLength(4);
  });

  it('asks the API again when a quick range is picked', async () => {
    const fetchMock = mockApi({ 'GET /extract': [200, { from: '', to: '', items: [] }] });
    renderWithProviders(<StatementPage />);

    expect(await screen.findByText('Nenhum lançamento neste período.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 dias' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: '7 dias' }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const url = new URL(String(fetchMock.mock.calls[1]![0]), 'http://localhost');
    const days =
      (Date.parse(url.searchParams.get('to')!) - Date.parse(url.searchParams.get('from')!)) /
      86_400_000;
    expect(days).toBe(7);
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  });
});
