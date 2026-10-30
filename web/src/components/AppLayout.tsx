import { CandlestickChart, LayoutDashboard, LogOut, Moon, ReceiptText, Sun } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { signOut, useSession } from '../auth/session';
import { setTheme, useTheme } from '../lib/theme';
import { LivePrice } from './LivePrice';
import { Logo } from './Logo';
import { cx } from './ui';

const LINKS = [
  { to: '/', label: 'Painel', end: true, icon: LayoutDashboard },
  { to: '/mercado', label: 'Mercado', end: false, icon: CandlestickChart },
  { to: '/extrato', label: 'Extrato', end: false, icon: ReceiptText },
];

export function AppLayout() {
  const session = useSession();
  const { pathname } = useLocation();

  return (
    <div className="app-backdrop min-h-dvh">
      {/* Desktop: side bar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/70 px-4 py-6 backdrop-blur-xl lg:flex">
        <Logo className="px-2" />
        <nav className="mt-10 flex flex-col gap-1" aria-label="Principal">
          {LINKS.map(({ icon: Icon, ...link }) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cx(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/20'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <Icon className="size-[18px]" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <ThemeToggle wide />
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
            <Avatar email={session?.email} />
            <p className="min-w-0 flex-1 truncate text-sm text-muted" title={session?.email}>
              {session?.email}
            </p>
            <button
              type="button"
              onClick={() => signOut()}
              className="grid size-8 place-items-center rounded-lg text-subtle transition hover:bg-down-soft hover:text-down"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <Logo className="lg:hidden" compact />
            <div className="ml-auto flex items-center gap-2">
              <LivePrice />
              <div className="flex items-center gap-1 lg:hidden">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
                  aria-label="Sair"
                >
                  <LogOut className="size-[18px]" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* key: each page fades in when navigating */}
        <main
          key={pathname}
          className="mx-auto max-w-6xl animate-fade-up px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-12"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border border-line bg-surface/85 p-1.5 shadow-2xl shadow-black/20 backdrop-blur-xl lg:hidden"
      >
        {LINKS.map(({ icon: Icon, ...link }) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cx(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition',
                isActive ? 'bg-brand-500/10 text-brand-500' : 'text-muted',
              )
            }
          >
            <Icon className="size-5" />
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Avatar({ email }: { email?: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold uppercase text-white">
      {email?.[0] ?? '?'}
    </span>
  );
}

function ThemeToggle({ wide = false }: { wide?: boolean }) {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = theme === 'dark' ? 'Tema claro' : 'Tema escuro';
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={cx(
        'flex items-center gap-3 rounded-xl text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-fg',
        wide ? 'w-full px-3 py-2.5' : 'size-10 justify-center',
      )}
    >
      <Icon className="size-[18px]" />
      {wide && label}
    </button>
  );
}
