import { ArrowLeftRight, Moon, ShieldCheck, Sun, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { Sparkline } from '../components/Sparkline';
import { setTheme, useTheme } from '../lib/theme';

const FEATURES = [
  {
    icon: Zap,
    title: 'Compra na hora',
    text: 'Deposite em reais e compre BTC pela cotação do Mercado Bitcoin.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Resgate parcial',
    text: 'Venda só o que precisa: o troco é reinvestido sem perder a cotação original.',
  },
  {
    icon: ShieldCheck,
    title: 'Valores exatos',
    text: 'Centavos e satoshis inteiros, do banco à tela. Nada de arredondamento.',
  },
];

/**
 * The way to the other auth page, below the form: a full-width button (login → sign-up,
 * the main path for a new visitor) or one line of text (sign-up → login).
 */
export function AuthAlternative({
  question,
  to,
  label,
  prominent = false,
}: {
  question: string;
  to: string;
  label: string;
  prominent?: boolean;
}) {
  if (!prominent) {
    return (
      <p className="mt-5 text-center text-sm text-muted">
        {question}{' '}
        <Link to={to} className="font-semibold text-brand-500 hover:underline">
          {label}
        </Link>
      </p>
    );
  }
  return (
    <div className="mt-6 [@media(max-height:820px)]:mt-4">
      <div className="flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" />
        {question}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Link
        to={to}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-brand-500/40 bg-brand-500/10 text-base font-semibold text-brand-500 transition hover:bg-brand-500/20 [@media(max-height:820px)]:mt-3"
      >
        {label}
      </Link>
    </div>
  );
}

/** Decorative curve (the real quote needs a session) */
const ILLUSTRATION = [31, 33, 32, 36, 35, 39, 38, 42, 41, 45, 44, 49, 47, 52, 55, 53, 58, 61];

/**
 * Split screen used by the login and registration pages. The side panel is pinned to the
 * screen height (it never makes the page taller), and short screens get a compact layout so
 * the whole form fits without scrolling.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <div className="app-backdrop grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface/40 p-12 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col [@media(max-height:820px)]:p-8">
        <div
          className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand-500/20 blur-3xl"
          aria-hidden="true"
        />
        <Logo />

        <div className="relative my-auto max-w-lg">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-500">
            <span className="size-1.5 rounded-full bg-brand-500" /> Cotação em tempo real
          </p>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-fg xl:text-5xl [@media(max-height:820px)]:text-4xl">
            Seu patrimônio em <span className="text-brand-500">Bitcoin</span>, simples e
            transparente.
          </h2>

          <div className="mt-8 rounded-2xl border border-line bg-surface/70 p-5 backdrop-blur [@media(max-height:820px)]:hidden">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">BTC / BRL</span>
              <span className="text-subtle">Gráfico ao vivo depois de entrar</span>
            </div>
            <Sparkline values={ILLUSTRATION} className="mt-3 h-24 w-full" />
          </div>

          <ul className="mt-8 space-y-5 [@media(max-height:820px)]:mt-6 [@media(max-height:820px)]:space-y-4">
            {FEATURES.map(({ icon: Icon, title: featureTitle, text }) => (
              <li key={featureTitle} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-fg">{featureTitle}</p>
                  <p className="text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-subtle">Desafio técnico Eduzz · Full Stack</p>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-12 [@media(max-height:820px)]:py-6">
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          className="absolute right-4 top-4 grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
        >
          {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>

        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="rounded-3xl border border-line bg-surface/80 p-7 shadow-2xl shadow-black/5 backdrop-blur-xl sm:p-9 [@media(max-height:820px)]:p-6 [@media(max-height:820px)]:sm:p-7">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">{title}</h1>
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
            <div className="mt-7 [@media(max-height:820px)]:mt-5">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
