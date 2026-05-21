export interface CnpjLookupResult {
  cnpj: string;
  cnpjFormatted: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  phone: string;
  zipCode: string;
  address: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  situacao: string;
  source: 'cnpj.ws' | 'brasilapi';
}

export interface CepLookupResult {
  cep: string;
  cepFormatted: string;
  address: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  source: 'viacep';
}

export class CnpjInvalidError extends Error {
  readonly code = 'CNPJ_INVALID' as const;
  constructor(message = 'CNPJ inválido') {
    super(message);
    this.name = 'CnpjInvalidError';
  }
}

export class CnpjNotFoundError extends Error {
  readonly code = 'CNPJ_NOT_FOUND' as const;
  constructor(message = 'CNPJ não encontrado') {
    super(message);
    this.name = 'CnpjNotFoundError';
  }
}

export class CepNotFoundError extends Error {
  readonly code = 'CEP_NOT_FOUND' as const;
  constructor(message = 'CEP não encontrado') {
    super(message);
    this.name = 'CepNotFoundError';
  }
}
