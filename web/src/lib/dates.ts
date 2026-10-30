const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "2026-10-26T22:47:04.591Z" -> "26/10/2026, 19:47" (browser time zone) */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** -> "19:47" */
export const formatTime = (iso: string) => time.format(new Date(iso));

/** Local date as YYYY-MM-DD (value of <input type="date">) */
export function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
