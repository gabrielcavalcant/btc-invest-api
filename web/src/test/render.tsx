import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { ToastProvider } from '../components/toast';

/** Renders with the app providers; `routes` lets a test assert navigation. */
export function renderWithProviders(
  ui: ReactElement,
  { path = '/', routes = {} }: { path?: string; routes?: Record<string, string> } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={path} element={ui} />
            {Object.entries(routes).map(([routePath, text]) => (
              <Route key={routePath} path={routePath} element={<p>{text}</p>} />
            ))}
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Fake API: maps "METHOD /path" to [status, body]. Returns the fetch mock. */
export function mockApi(responses: Record<string, [number, unknown]>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const key = `${init?.method ?? 'GET'} ${url.pathname.replace(/^\/api/, '')}`;
    const [status, body] = responses[key] ?? [404, { error: { code: 'NOT_FOUND', message: key } }];
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
