import { formatBrl, formatBtc } from '../../domain/money';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** 123456789n -> "R$ 1.234.567,89" (string based, no floating point) */
export const brl = (cents: bigint) => {
  const [int = '0', frac = '00'] = formatBrl(cents).split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${frac}`;
};
const btc = (sats: bigint) => `${formatBtc(sats)} BTC`;

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

function build(to: string, subject: string, name: string, lines: string[]): EmailMessage {
  const greeting = `Olá, ${name}!`;
  return {
    to,
    subject,
    text: [greeting, '', ...lines].join('\n'),
    html: `<p>${escapeHtml(greeting)}</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}`,
  };
}

export const emailTemplates = {
  deposit: (i: { to: string; name: string; amountCents: bigint }) =>
    build(i.to, 'Depósito recebido', i.name, [
      `Recebemos seu depósito de ${brl(i.amountCents)}.`,
      'O valor já está disponível no seu saldo.',
    ]),

  purchase: (i: {
    to: string;
    name: string;
    amountCents: bigint;
    btcSats: bigint;
    priceCents: bigint;
  }) =>
    build(i.to, 'Compra de Bitcoin realizada', i.name, [
      `Você investiu ${brl(i.amountCents)} e comprou ${btc(i.btcSats)}.`,
      `Cotação utilizada: ${brl(i.priceCents)} por BTC.`,
    ]),

  sell: (i: {
    to: string;
    name: string;
    btcSats: bigint;
    amountCents: bigint;
    priceCents: bigint;
  }) =>
    build(i.to, 'Venda de Bitcoin realizada', i.name, [
      `Você vendeu ${btc(i.btcSats)} e resgatou ${brl(i.amountCents)}.`,
      `Cotação utilizada: ${brl(i.priceCents)} por BTC.`,
      'O valor já está disponível no seu saldo.',
    ]),
};
