import { expect, test, type Page } from '@playwright/test';

/** Opens an operation from the dashboard, types the amount and confirms. */
async function operate(page: Page, button: 'Depositar' | 'Comprar' | 'Vender', amount: string) {
  await page.getByRole('main').getByRole('button', { name: button, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor em reais').fill(amount);
  await dialog.getByRole('button', { name: button, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('a new customer deposits, buys, sells part and sees it all in the statement', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.com`;

  // private pages require a session
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('link', { name: 'Criar conta' }).click();
  await page.getByLabel('Nome').fill('Cliente E2E');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-e2e-123');
  await page.getByLabel('Confirmar senha').fill('senha-e2e-123');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByRole('heading', { name: 'Painel' })).toBeVisible();
  await expect(page.getByText('Você ainda não tem investimentos')).toBeVisible();

  await operate(page, 'Depositar', '10000');
  await expect(page.getByText('R$ 10.000,00').first()).toBeVisible();

  await operate(page, 'Comprar', '3000');
  await operate(page, 'Comprar', '2000');
  await expect(page.getByText('R$ 5.000,00').first()).toBeVisible();
  // table rows on desktop, cards on the phone: only the visible ones count
  const investments = page.locator('[data-investment]:visible');
  await expect(investments).toHaveCount(2);

  // partial sale: both investments are liquidated and the change is reinvested
  await operate(page, 'Vender', '3500');
  await expect(page.getByText('Venda realizada')).toBeVisible();
  await expect(page.getByText(/reinvestido/)).toBeVisible();
  await expect(page.getByText('R$ 8.500,00').first()).toBeVisible();
  await expect(investments).toHaveCount(1);

  await page.getByRole('link', { name: 'Extrato' }).click();
  const entries = page.locator('[data-entry]:visible');
  await expect(entries).toHaveCount(6);
  await expect(entries.filter({ hasText: 'Depósito' })).toHaveCount(1);
  await expect(entries.filter({ hasText: 'Compra' })).toHaveCount(2);
  await expect(entries.filter({ hasText: 'Venda' })).toHaveCount(2);
  await expect(entries.filter({ hasText: 'Reinvestimento' })).toHaveCount(1);

  await page.getByRole('link', { name: 'Mercado' }).click();
  await expect(page.getByRole('heading', { name: 'Mercado' })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('shows a friendly error on wrong credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('ninguem@teste.com');
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
});
