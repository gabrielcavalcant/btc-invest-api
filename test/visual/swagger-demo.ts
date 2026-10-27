/// <reference lib="dom" />
import { chromium, type Locator, type Page } from 'playwright';

/**
 * Visual walkthrough of the whole API through the Swagger UI: `npm run demo:swagger`.
 *
 * Opens a real browser, and for every endpoint fills the form, clicks "Execute", shows the
 * response and checks the HTTP status. Needs the API running (docker compose up -d).
 * A new account is created on every run, so it can be repeated at will.
 *
 * Environment variables:
 *  - DEMO_URL: API address (default http://localhost:3000);
 *  - DEMO_PAUSE_MS: time on each response (default 1800);
 *  - DEMO_HEADLESS=true: no window and no pauses (e.g. in CI);
 *  - DEMO_VIDEO_DIR=<dir>: no window, records a .webm video at a watchable pace.
 */

const BASE_URL = process.env.DEMO_URL ?? 'http://localhost:3000';
const VIDEO_DIR = process.env.DEMO_VIDEO_DIR;
const HEADLESS = process.env.DEMO_HEADLESS === 'true' || Boolean(VIDEO_DIR);
/** Human pace (typing, scrolling, pauses): on screen or on video, never in CI */
const PACED = !HEADLESS || Boolean(VIDEO_DIR);
const PAUSE_MS = PACED ? Number(process.env.DEMO_PAUSE_MS ?? 1800) : 100;
const VIDEO_SIZE = { width: 1280, height: 800 };

interface Step {
  title: string;
  /** Swagger UI operation id: `<tag>-<method>_<path>` */
  op: string;
  /** Request body fields (form inputs) */
  body?: Record<string, string>;
  expect: number;
  /** Runs after the response, with its parsed body */
  after?: (page: Page, body: unknown) => Promise<void>;
}

const email = `demo-${Date.now()}@teste.com`;
const password = 'senha-da-demo-123';

const steps: Step[] = [
  { title: 'Health check: banco e Redis no ar', op: 'system-get_health', expect: 200 },
  {
    title: 'Cria uma conta nova',
    op: 'account-post_account',
    body: { name: 'Conta Demo', email, password },
    expect: 201,
  },
  {
    title: 'Mesmo e-mail de novo: conflito',
    op: 'account-post_account',
    body: { name: 'Conta Demo', email, password },
    expect: 409,
  },
  {
    title: 'Dados inválidos: erro de validação',
    op: 'account-post_account',
    body: { name: 'A', email: 'nao-e-email', password: '123' },
    expect: 400,
  },
  {
    title: 'Login: devolve o token JWT',
    op: 'account-post_login',
    body: { email, password },
    expect: 200,
    after: (page, body) => authorize(page, (body as { token: string }).token),
  },
  { title: 'Saldo inicial (zero)', op: 'account-get_account_balance', expect: 200 },
  {
    title: 'Depósito de R$ 10.000 (dispara e-mail)',
    op: 'account-post_account_deposit',
    body: { amount: '10000' },
    expect: 201,
  },
  {
    title: 'Depósito com valor inválido',
    op: 'account-post_account_deposit',
    body: { amount: 'abc' },
    expect: 400,
  },
  { title: 'Cotação atual do Mercado Bitcoin', op: 'btc-get_btc_price', expect: 200 },
  {
    title: 'Compra de R$ 3.000 em BTC',
    op: 'btc-post_btc_purchase',
    body: { amount: '3000' },
    expect: 201,
  },
  {
    title: 'Compra de R$ 2.000 em BTC',
    op: 'btc-post_btc_purchase',
    body: { amount: '2000' },
    expect: 201,
  },
  {
    title: 'Compra sem saldo suficiente',
    op: 'btc-post_btc_purchase',
    body: { amount: '999999' },
    expect: 422,
  },
  { title: 'Posição: variação de cada investimento', op: 'btc-get_btc', expect: 200 },
  {
    title: 'Venda de R$ 3.500: FIFO + reinvestimento do troco',
    op: 'btc-post_btc_sell',
    body: { amount: '3500' },
    expect: 201,
  },
  { title: 'Saldo depois da venda', op: 'account-get_account_balance', expect: 200 },
  { title: 'Extrato dos últimos 90 dias', op: 'reports-get_extract', expect: 200 },
  { title: 'Volume de BTC comprado e vendido hoje', op: 'reports-get_volume', expect: 200 },
  { title: 'Histórico de cotações (10 em 10 min)', op: 'reports-get_history', expect: 200 },
];

async function main() {
  const browser = await chromium.launch({
    headless: HEADLESS,
    // Windows throttles rendering of covered windows, which stalls every action
    args: ['--start-maximized', '--disable-features=CalculateNativeWinOcclusion'],
  });
  const context = await browser.newContext({
    viewport: HEADLESS ? VIDEO_SIZE : null,
    ...(VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: VIDEO_SIZE } } : {}),
  });
  const page = await context.newPage();
  await page.bringToFront();
  await page.goto(`${BASE_URL}/docs`);
  await page.locator('.opblock').first().waitFor();

  const results: { step: Step; status: number }[] = [];
  for (const [index, step] of steps.entries()) {
    await banner(
      page,
      `${index + 1}/${steps.length} · ${step.title}`,
      `esperado: HTTP ${step.expect}`,
    );
    const { status, body } = await execute(page, step);
    const ok = status === step.expect;
    results.push({ step, status });
    console.log(
      `${ok ? '✔' : '✘'} ${status} ${step.title}${ok ? '' : ` (esperado ${step.expect})`}`,
    );
    await banner(
      page,
      `${index + 1}/${steps.length} · ${step.title}`,
      `${ok ? '✔' : '✘'} HTTP ${status}${ok ? '' : ` (esperado ${step.expect})`}`,
      ok ? 'ok' : 'fail',
    );
    await page.waitForTimeout(PAUSE_MS);
    if (ok) await step.after?.(page, body);
  }

  const failed = results.filter((r) => r.status !== r.step.expect);
  const summary = failed.length
    ? `${failed.length} de ${results.length} passos falharam`
    : `Todos os ${results.length} passos passaram`;
  console.log(`\n${summary}`);
  await banner(page, 'Fim da demonstração', summary, failed.length ? 'fail' : 'ok');
  if (PACED) await page.waitForTimeout(5000);
  await context.close(); // also finishes writing the video
  if (VIDEO_DIR) console.log(`Vídeo salvo em: ${await page.video()?.path()}`);
  await browser.close();
  process.exitCode = failed.length ? 1 : 0;
}

/** Opens the operation, fills its form, clicks Execute and returns the live response. */
async function execute(page: Page, step: Step): Promise<{ status: number; body: unknown }> {
  const op = page.locator(`#operations-${step.op}`);
  const panel = op.locator('.opblock-body');
  if (!(await panel.isVisible())) await press(op.locator('.opblock-summary-path'));
  await reveal(op);

  // Once in "try it out" mode the button becomes "Cancel" + "Reset"
  const tryOut = op.getByRole('button', { name: 'Try it out' });
  if (await tryOut.isVisible()) await press(tryOut);

  for (const [name, value] of Object.entries(step.body ?? {})) {
    await typeInto(op.locator(`tr[data-property-name="${name}"] input`), value);
  }

  // A previous run of the same operation leaves its response on screen
  const clear = op.locator('.btn-clear');
  if (await clear.isVisible()) await press(clear);

  await press(op.locator('button.execute'));
  const live = op.locator('.live-responses-table');
  const statusCell = live.locator('tbody .response-col_status').first();
  await statusCell.waitFor();
  await reveal(live);

  const status = Number(/\d{3}/.exec((await statusCell.textContent()) ?? '')?.[0] ?? 0);
  const raw = (await live.locator('.response-col_description pre').first().textContent()) ?? '';
  let body: unknown = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    // not JSON: keep the text
  }
  return { status, body };
}

/**
 * Smooth-scrolls the element to the middle of the screen. Done in the page on purpose:
 * Playwright's own scroll waits for the element to stop moving, which the Swagger UI
 * expand animations keep delaying.
 */
async function reveal(target: Locator) {
  await target.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await target.page().waitForTimeout(PACED ? 400 : 0);
}

/** Shows the button and clicks it through the DOM (no wait for the page to stop animating). */
async function press(button: Locator) {
  await reveal(button);
  await button.dispatchEvent('click');
}

/** Types like a person, so the filling is visible. */
async function typeInto(input: Locator, value: string) {
  await reveal(input);
  await input.fill('');
  await input.pressSequentially(value, { delay: PACED ? 35 : 0 });
  // Swagger UI debounces typing; leaving the field commits the value right away
  await input.press('Tab');
}

/** Clicks "Authorize", pastes the JWT and closes the dialog: protected routes unlock. */
async function authorize(page: Page, token: string) {
  await banner(page, 'Authorize: colando o token JWT', 'as rotas protegidas são liberadas');
  await press(page.locator('.auth-wrapper button.authorize'));
  const modal = page.locator('.modal-ux');
  await modal.locator('input').first().fill(token);
  await press(modal.locator('button.authorize'));
  await page.waitForTimeout(PAUSE_MS / 2);
  await press(modal.locator('button.btn-done'));
}

/** Fixed banner on top of the page telling what is happening. */
async function banner(page: Page, title: string, subtitle: string, state?: 'ok' | 'fail') {
  await page.evaluate(
    ({ title, subtitle, state }) => {
      let el = document.getElementById('demo-banner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-banner';
        el.style.cssText =
          'position:fixed;top:12px;right:12px;z-index:99999;max-width:460px;padding:14px 18px;' +
          'border-radius:10px;font:600 16px/1.35 system-ui,sans-serif;color:#fff;' +
          'box-shadow:0 6px 24px rgba(0,0,0,.35);transition:background .2s';
        document.body.appendChild(el);
      }
      el.style.background = state === 'ok' ? '#15803d' : state === 'fail' ? '#b91c1c' : '#1e3a8a';
      el.innerHTML = '';
      const strong = document.createElement('div');
      strong.textContent = title;
      const small = document.createElement('div');
      small.textContent = subtitle;
      small.style.cssText = 'font-weight:400;font-size:14px;opacity:.9;margin-top:4px';
      el.append(strong, small);
    },
    { title, subtitle, state },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
