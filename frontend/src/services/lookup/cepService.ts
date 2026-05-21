import { CepLookupResult, CepNotFoundError } from './types';
import { maskCep, onlyDigits } from './formatters';

const VIACEP_URL = (cep: string) => `https://viacep.com.br/ws/${cep}/json/`;
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Consulta um CEP no ViaCEP.
 * Provedor único — o ViaCEP é especializado em CEP e tem cobertura completa
 * dos Correios; a BrasilAPI cobre CNPJ.
 */
export async function lookupCep(rawCep: string): Promise<CepLookupResult> {
  const cep = onlyDigits(rawCep);
  if (cep.length !== 8) {
    throw new CepNotFoundError('CEP deve conter 8 dígitos');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(VIACEP_URL(cep), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new CepNotFoundError();
    const data = await res.json();
    if (data?.erro) throw new CepNotFoundError();

    return {
      cep,
      cepFormatted: maskCep(cep),
      address: data.logradouro ?? '',
      complement: data.complemento ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
      source: 'viacep',
    };
  } catch (err) {
    if (err instanceof CepNotFoundError) throw err;
    throw new CepNotFoundError();
  } finally {
    clearTimeout(timer);
  }
}
