import { chromium, devices, expect as baseExpect, type Locator, type Page } from '@playwright/test';

/**
 * Visual walkthrough of the whole front-end: `npm run demo` (inside web/), or
 * `npm run demo:mobile` for the same 18 steps on a phone screen (touch, bottom bar, cards).
 *
 * Opens a real browser and uses the app like a person would, in 18 steps: sign-up,
 * deposit, purchases, partial sale with reinvestment, statement, CSV, market, themes,
 * phone layout and sign-out. Every step is checked; a banner tells what is happening.
 * Needs the stack running (docker compose up -d --build). A new account is created on
 * every run, so it can be repeated at will.
 *
 * Environment variables:
 *  - DEMO_URL: front-end address (default http://localhost:8080);
 *  - DEMO_PAUSE_MS: time on each result (default 1500);
 *  - DEMO_HEADLESS=true: no window and no pauses (e.g. in CI);
 *  - DEMO_MOBILE=true (or --mobile): phone screen instead of desktop.
 */

const BASE_URL = process.env.DEMO_URL ?? 'http://localhost:8080';
const HEADLESS = process.env.DEMO_HEADLESS === 'true';
const MOBILE = process.env.DEMO_MOBILE === 'true' || process.argv.includes('--mobile');
const PAUSE_MS = HEADLESS ? 0 : Number(process.env.DEMO_PAUSE_MS ?? 1500);
// bcrypt makes sign-up and login slow on purpose: generous waits instead of racing them
const TIMEOUT = 20_000;
const expect = baseExpect.configure({ timeout: TIMEOUT });

const email = `demo-front-${Date.now()}@teste.com`;
const password = 'senha-da-demo-123';

interface Step {
  title: string;
  detail: string;
  run: (page: Page) => Promise<void>;
}

const steps: Step[] = [
  {
    title: 'Sem sessão, vai para o login',
    detail: 'abre o painel direto e é levado à tela de login',
    run: async (page) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/login$/);
    },
  },
  {
    title: 'Login: validação dos campos',
    detail: 'e-mail inválido e senha vazia não chegam à API',
    run: async (page) => {
      await type(page.getByLabel('E-mail'), 'nao-e-email');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByText('E-mail inválido')).toBeVisible();
      await expect(page.getByText('Informe a senha')).toBeVisible();
    },
  },
  {
    title: 'Login: senha errada',
    detail: 'a API responde 401 e o erro aparece em português',
    run: async (page) => {
      await type(page.getByLabel('E-mail'), 'ninguem@teste.com');
      await type(page.getByLabel('Senha', { exact: true }), 'senha-errada');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
    },
  },
  {
    title: 'Cadastro: senhas diferentes',
    detail: 'a confirmação da senha é conferida antes de enviar',
    run: async (page) => {
      await page.getByRole('link', { name: 'Criar conta' }).click();
      await type(page.getByLabel('Nome'), 'Conta Demo');
      await type(page.getByLabel('E-mail'), email);
      await type(page.getByLabel('Senha', { exact: true }), password);
      await type(page.getByLabel('Confirmar senha'), 'outra-senha-123');
      await page.getByRole('button', { name: 'Criar conta' }).click();
      await expect(page.getByText('As senhas não conferem')).toBeVisible();
    },
  },
  {
    title: 'Cadastro: conta criada',
    detail: 'cria a conta, entra direto e mostra o painel vazio',
    run: async (page) => {
      await type(page.getByLabel('Confirmar senha'), password);
      await page.getByRole('button', { name: 'Criar conta' }).click();
      // the welcome toast lasts a few seconds: checked first, then the dashboard
      await expect(page.getByText('Bem-vindo, Conta!')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Painel' })).toBeVisible();
      await expect(page.getByText('Você ainda não tem investimentos')).toBeVisible();
    },
  },
  {
    title: 'Depósito de R$ 10.000',
    detail: 'o saldo e o patrimônio são atualizados (a API envia um e-mail)',
    run: async (page) => {
      await operate(page, 'Depositar', '10000');
      await expect(page.getByText('Depósito realizado')).toBeVisible();
      await expect(page.getByText('R$ 10.000,00').first()).toBeVisible();
    },
  },
  {
    title: 'Compra acima do saldo',
    detail: 'R$ 20.000 com R$ 10.000 de saldo: bloqueada no próprio formulário',
    run: async (page) => {
      const dialog = await openOperation(page, 'Comprar');
      await type(dialog.getByLabel('Valor em reais'), '20000');
      await dialog.getByRole('button', { name: 'Comprar', exact: true }).click();
      await expect(dialog.getByText('Valor maior que o saldo disponível')).toBeVisible();
      await pause(page);
      await dialog.getByRole('button', { name: 'Fechar' }).click();
    },
  },
  {
    title: 'Compra de R$ 3.000',
    detail: 'a prévia mostra quanto BTC será comprado pela cotação de venda',
    run: async (page) => {
      const dialog = await openOperation(page, 'Comprar');
      await type(dialog.getByLabel('Valor em reais'), '3000');
      await expect(dialog.getByTestId('preview')).toContainText('Você recebe ≈');
      await pause(page);
      await dialog.getByRole('button', { name: 'Comprar', exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: TIMEOUT });
      await expect(page.getByText('Compra realizada')).toBeVisible();
    },
  },
  {
    title: 'Compra de R$ 2.000',
    detail: 'dois investimentos em aberto, saldo de R$ 5.000',
    run: async (page) => {
      await operate(page, 'Comprar', '2000');
      await expect(page.getByText('R$ 5.000,00').first()).toBeVisible();
      // table rows on desktop, cards on the phone: only the visible ones count
      await expect(page.locator('[data-investment]:visible')).toHaveCount(2);
    },
  },
  {
    title: 'Venda acima do disponível',
    detail: 'pedir mais do que valem os investimentos é bloqueado',
    run: async (page) => {
      const dialog = await openOperation(page, 'Vender');
      await type(dialog.getByLabel('Valor em reais'), '99000');
      await dialog.getByRole('button', { name: 'Vender', exact: true }).click();
      await expect(
        dialog.getByText('Valor maior que o total dos seus investimentos'),
      ).toBeVisible();
      await pause(page);
      await dialog.getByRole('button', { name: 'Fechar' }).click();
    },
  },
  {
    title: 'Venda parcial de R$ 3.500 (FIFO)',
    detail: 'o mais antigo sai primeiro e o troco é reinvestido na cotação original',
    run: async (page) => {
      await operate(page, 'Vender', '3500');
      await expect(page.getByText('Venda realizada')).toBeVisible();
      await expect(page.getByText(/reinvestido/)).toBeVisible();
      await expect(page.getByText('R$ 8.500,00').first()).toBeVisible();
    },
  },
  {
    title: 'Extrato: todos os lançamentos',
    detail: 'depósito, 2 compras, 2 vendas e o reinvestimento',
    run: async (page) => {
      await page.getByRole('link', { name: 'Extrato' }).click();
      const entries = page.locator('[data-entry]:visible');
      await expect(entries).toHaveCount(6);
      await expect(entries.filter({ hasText: 'Reinvestimento' })).toHaveCount(1);
      await expect(page.getByText('Resgates (vendas)')).toBeVisible();
    },
  },
  {
    title: 'Extrato: filtros de período',
    detail: 'atalho de 7 dias e um período inválido (início depois do fim)',
    run: async (page) => {
      await page.getByRole('button', { name: '7 dias' }).click();
      await expect(page.getByRole('button', { name: '7 dias' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.getByLabel('De').fill('2030-01-10');
      await page.getByLabel('Até').fill('2030-01-01');
      await page.getByRole('button', { name: 'Filtrar' }).click();
      await expect(page.getByText('A data inicial deve ser anterior à final.')).toBeVisible();
    },
  },
  {
    title: 'Extrato: exportar CSV',
    detail: 'baixa o extrato em CSV, pronto para planilha',
    run: async (page) => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Exportar CSV' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^extrato-.*\.csv$/);
    },
  },
  {
    title: 'Mercado: cotação, spread e volume',
    detail: 'preço ao vivo do Mercado Bitcoin e o volume negociado hoje',
    run: async (page) => {
      await page.getByRole('link', { name: 'Mercado' }).click();
      await expect(page.getByRole('heading', { name: 'Mercado' })).toBeVisible();
      await expect(page.getByText('Spread', { exact: true })).toBeVisible();
      await expect(page.getByText('Comprado hoje na plataforma')).toBeVisible();
    },
  },
  {
    title: 'Tema claro e escuro',
    detail: 'alterna o tema; a escolha fica salva no navegador',
    run: async (page) => {
      await page.getByRole('button', { name: 'Tema claro' }).first().click();
      await expect(page.locator('html')).not.toHaveClass(/dark/);
      await pause(page);
      await page.getByRole('button', { name: 'Tema escuro' }).first().click();
      await expect(page.locator('html')).toHaveClass(/dark/);
    },
  },
  {
    title: MOBILE ? 'Navegação pela barra inferior' : 'Layout de celular',
    detail: 'tela estreita: navegação na barra inferior',
    run: async (page) => {
      if (!MOBILE) await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole('navigation', { name: 'Navegação inferior' })
        .getByRole('link', { name: 'Painel' })
        .click();
      await expect(page.getByRole('heading', { name: 'Painel' })).toBeVisible();
      await pause(page);
      if (!MOBILE) await page.setViewportSize({ width: 1280, height: 800 });
    },
  },
  {
    title: 'Sair',
    detail: 'encerra a sessão e volta ao login',
    run: async (page) => {
      await page.getByRole('button', { name: 'Sair' }).click();
      await expect(page).toHaveURL(/\/login$/);
    },
  },
];

async function main() {
  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: HEADLESS ? 0 : 60,
    args: ['--window-position=0,0'],
  });
  const page = await browser.newPage({
    ...(MOBILE
      ? // a phone (touch, mobile user agent) small enough for the window to fit a laptop screen
        { ...devices['Pixel 7'], viewport: { width: 375, height: 600 } }
      : { viewport: { width: 1280, height: 800 } }),
    baseURL: BASE_URL,
    locale: 'pt-BR',
    acceptDownloads: true,
  });
  page.setDefaultTimeout(TIMEOUT);

  const screen = MOBILE ? 'celular' : 'desktop';
  console.log(`Demonstração do front (${screen}) em ${BASE_URL} (conta ${email})\n`);
  let passed = 0;
  for (const [index, step] of steps.entries()) {
    const label = `${String(index + 1).padStart(2, '0')}/${steps.length} ${step.title}`;
    try {
      await banner(page, label, step.detail);
      await step.run(page);
      passed++;
      console.log(`  ok   ${label}`);
      await banner(page, label, step.detail, 'ok');
      await pause(page);
    } catch (error) {
      console.log(`  FALHOU ${label}\n${String(error)}`);
      await banner(page, label, 'falhou: veja o terminal', 'fail').catch(() => {});
      break; // the next steps depend on this one
    }
  }

  const summary =
    passed === steps.length
      ? `Todos os ${steps.length} passos passaram`
      : `${passed} de ${steps.length} passos passaram`;
  console.log(`\n${summary}`);
  await banner(page, 'Fim da demonstração', summary, passed === steps.length ? 'ok' : 'fail');
  if (!HEADLESS) await page.waitForTimeout(5000);
  await browser.close();
  process.exitCode = passed === steps.length ? 0 : 1;
}

/** Opens an operation from the dashboard and returns its dialog. */
async function openOperation(page: Page, button: 'Depositar' | 'Comprar' | 'Vender') {
  await page.getByRole('main').getByRole('button', { name: button, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Deposit, purchase or sale: types the amount, confirms and waits for the dialog to close. */
async function operate(page: Page, button: 'Depositar' | 'Comprar' | 'Vender', amount: string) {
  const dialog = await openOperation(page, button);
  await type(dialog.getByLabel('Valor em reais'), amount);
  await pause(page, 0.5);
  await dialog.getByRole('button', { name: button, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: TIMEOUT });
}

/** Types like a person, so the filling is visible. */
async function type(input: Locator, value: string) {
  await input.fill('');
  await input.pressSequentially(value, { delay: HEADLESS ? 0 : 45 });
}

const pause = (page: Page, factor = 1) => page.waitForTimeout(PAUSE_MS * factor);

/**
 * Fixed banner telling what is happening. It lives in a closed shadow root, so the
 * checks of the steps (getByText...) never find the banner's own words.
 */
async function banner(page: Page, title: string, subtitle: string, state?: 'ok' | 'fail') {
  await page.evaluate(
    ({ title, subtitle, state, bottom }) => {
      const store = window as unknown as { demoBanner?: HTMLElement };
      let el = store.demoBanner;
      if (!el || !el.isConnected) {
        const host = document.createElement('div');
        document.body.appendChild(host);
        el = document.createElement('div');
        host.attachShadow({ mode: 'closed' }).appendChild(el);
        store.demoBanner = el;
        el.style.cssText =
          `position:fixed;left:50%;bottom:${bottom}px;transform:translateX(-50%);z-index:99999;` +
          'max-width:560px;width:calc(100% - 32px);padding:12px 16px;border-radius:14px;' +
          'font:600 15px/1.35 system-ui,sans-serif;color:#fff;pointer-events:none;' +
          'box-shadow:0 10px 30px rgba(0,0,0,.4);transition:background .2s';
      }
      el.style.background = state === 'ok' ? '#15803d' : state === 'fail' ? '#b91c1c' : '#c2410c';
      el.innerHTML = '';
      const strong = document.createElement('div');
      strong.textContent = (state === 'ok' ? '✓ ' : state === 'fail' ? '✗ ' : '▶ ') + title;
      const small = document.createElement('div');
      small.textContent = subtitle;
      small.style.cssText = 'font-weight:400;font-size:13px;opacity:.92;margin-top:2px';
      el.append(strong, small);
    },
    // on the phone, above the bottom navigation bar
    { title, subtitle, state, bottom: MOBILE ? 104 : 20 },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
