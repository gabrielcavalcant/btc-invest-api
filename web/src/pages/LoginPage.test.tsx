import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signOut } from '../auth/session';
import { mockApi, renderWithProviders } from '../test/render';
import { LoginPage } from './LoginPage';

afterEach(() => {
  signOut();
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('validates the fields before calling the API', async () => {
    const fetchMock = mockApi({});
    renderWithProviders(<LoginPage />, { path: '/login' });

    await userEvent.type(screen.getByLabelText('E-mail'), 'nao-e-email');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens the session and goes to the dashboard on success', async () => {
    const fetchMock = mockApi({ 'POST /login': [200, { token: 'jwt-token' }] });
    renderWithProviders(<LoginPage />, { path: '/login', routes: { '/': 'painel' } });

    await userEvent.type(screen.getByLabelText('E-mail'), 'Maria@Example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'super-secret');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('painel')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'maria@example.com',
      password: 'super-secret',
    });
    expect(sessionStorage.getItem('btc-invest.session')).toContain('jwt-token');
  });

  it('shows the API error in Portuguese on wrong credentials', async () => {
    mockApi({
      'POST /login': [
        401,
        { error: { code: 'UNAUTHORIZED', message: 'Invalid e-mail or password' } },
      ],
    });
    renderWithProviders(<LoginPage />, { path: '/login' });

    await userEvent.type(screen.getByLabelText('E-mail'), 'maria@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
    expect(sessionStorage.getItem('btc-invest.session')).toBeNull();
  });
});
