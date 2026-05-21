import {
  CnpjLookupResult,
  CnpjInvalidError,
  CnpjNotFoundError,
} from './types';
import { maskCep, maskCnpj, maskPhone, onlyDigits } from './formatters';

const CNPJWS_URL = (cnpj: string) => `https://publica.cnpj.ws/cnpj/${cnpj}`;
const BRASILAPI_URL = (cnpj: string) =>
  `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;

const DEFAULT_TIMEOUT_MS = 8000;

async function httpJson(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<{
  ok: boolean;
  status: number;
  body: any;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

const isInvalidMessage = (message: unknown): boolean => {
  if (!message || typeof message !== 'string') return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('inválido') ||
    normalized.includes('invalido') ||
    normalized.includes('invalid')
  );
};

function mapCnpjWs(raw: any, cnpjDigits: string): CnpjLookupResult {
  const est = raw?.estabelecimento ?? {};
  const tipo = est.tipo_logradouro ? `${est.tipo_logradouro} ` : '';
  const logradouro = est.logradouro ? `${tipo}${est.logradouro}` : '';
  const ddd = est.ddd1 ?? '';
  const telefone = est.telefone1 ?? '';
  const phoneRaw = ddd && telefone ? `${ddd}${telefone}` : telefone || '';

  return {
    cnpj: cnpjDigits,
    cnpjFormatted: maskCnpj(cnpjDigits),
    razaoSocial: raw?.razao_social ?? '',
    nomeFantasia: est.nome_fantasia ?? '',
    email: est.email ? String(est.email).toLowerCase() : '',
    phone: phoneRaw ? maskPhone(phoneRaw) : '',
    zipCode: est.cep ? maskCep(est.cep) : '',
    address: logradouro,
    addressNumber: est.numero ?? '',
    complement: est.complemento ?? '',
    neighborhood: est.bairro ?? '',
    city: est.cidade?.nome ?? '',
    state: est.estado?.sigla ?? '',
    situacao: est.situacao_cadastral ?? '',
    source: 'cnpj.ws',
  };
}

function mapBrasilApi(raw: any, cnpjDigits: string): CnpjLookupResult {
  return {
    cnpj: cnpjDigits,
    cnpjFormatted: maskCnpj(cnpjDigits),
    razaoSocial: raw?.razao_social ?? '',
    nomeFantasia: raw?.nome_fantasia ?? '',
    email: raw?.email ? String(raw.email).toLowerCase() : '',
    phone: raw?.ddd_telefone_1 ? maskPhone(raw.ddd_telefone_1) : '',
    zipCode: raw?.cep ? maskCep(raw.cep) : '',
    address: raw?.logradouro ?? '',
    addressNumber: raw?.numero ?? '',
    complement: raw?.complemento ?? '',
    neighborhood: raw?.bairro ?? '',
    city: raw?.municipio ?? '',
    state: raw?.uf ?? '',
    situacao: raw?.descricao_situacao_cadastral ?? '',
    source: 'brasilapi',
  };
}

async function tryCnpjWs(cnpj: string): Promise<CnpjLookupResult> {
  const { ok, status, body } = await httpJson(CNPJWS_URL(cnpj));

  if (ok && body) return mapCnpjWs(body, cnpj);

  const message =
    body?.detalhes ||
    body?.titulo ||
    body?.message ||
    body?.erro ||
    '';

  if (status === 400 || isInvalidMessage(message)) {
    throw new CnpjInvalidError(typeof message === 'string' && message ? message : 'CNPJ inválido');
  }
  throw new CnpjNotFoundError(
    typeof message === 'string' && message ? message : 'CNPJ não encontrado na cnpj.ws'
  );
}

async function tryBrasilApi(cnpj: string): Promise<CnpjLookupResult> {
  const { ok, status, body } = await httpJson(BRASILAPI_URL(cnpj));

  if (ok && body) return mapBrasilApi(body, cnpj);

  const message = body?.message || body?.detalhes || '';

  if (status === 400 || isInvalidMessage(message)) {
    throw new CnpjInvalidError(typeof message === 'string' && message ? message : 'CNPJ inválido');
  }
  throw new CnpjNotFoundError(
    typeof message === 'string' && message ? message : 'CNPJ não encontrado na BrasilAPI'
  );
}

/**
 * Consulta um CNPJ usando a cadeia de provedores:
 *   1. publica.cnpj.ws  → fonte primária
 *   2. brasilapi.com.br → fallback automático
 *
 * Se o provedor primário responder explicitamente que o CNPJ é inválido,
 * o fallback NÃO é acionado (lança CnpjInvalidError direto).
 */
export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupResult> {
  const cnpj = onlyDigits(rawCnpj);
  if (cnpj.length !== 14) {
    throw new CnpjInvalidError('CNPJ deve conter 14 dígitos');
  }

  try {
    return await tryCnpjWs(cnpj);
  } catch (err) {
    if (err instanceof CnpjInvalidError) throw err;
    // qualquer outro erro (não encontrado, rate-limit, rede, etc.) → fallback
    try {
      return await tryBrasilApi(cnpj);
    } catch (fallbackErr) {
      if (fallbackErr instanceof CnpjInvalidError) throw fallbackErr;
      throw fallbackErr instanceof Error
        ? fallbackErr
        : new CnpjNotFoundError();
    }
  }
}
