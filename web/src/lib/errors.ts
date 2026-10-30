import { ApiError } from '../api/client';

/** Messages shown to the user, by API error code. */
const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Não foi possível conectar à API. Ela está no ar?',
  SERVICE_UNAVAILABLE: 'O serviço está indisponível no momento. Tente de novo em instantes.',
  INTERNAL_ERROR: 'Erro inesperado no servidor. Tente de novo em instantes.',
  VALIDATION_ERROR: 'Confira os dados informados.',
  UNAUTHORIZED: 'E-mail ou senha inválidos.',
  CONFLICT: 'Este e-mail já está cadastrado.',
  INSUFFICIENT_FUNDS: 'Saldo insuficiente para esta operação.',
  QUOTE_UNAVAILABLE: 'Cotação indisponível no momento. Tente de novo em alguns segundos.',
  TOO_MANY_REQUESTS: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
};

/** Specific messages for business errors that share a code. */
const BY_API_MESSAGE: Record<string, string> = {
  'Requested amount is greater than the current value of your investments':
    'O valor pedido é maior que o valor atual dos seus investimentos.',
  'Amount is too small to buy any satoshi': 'Valor pequeno demais para comprar BTC.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Never show raw technical text (e.g. "Bad Gateway") to the user
    return (
      BY_API_MESSAGE[error.message] ?? MESSAGES[error.code] ?? 'Algo deu errado. Tente novamente.'
    );
  }
  return 'Algo deu errado. Tente novamente.';
}
