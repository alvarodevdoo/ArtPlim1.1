export interface NFeItem {
  itemNumber: string;
  codigo: string;
  descricao: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  custoEfetivoUnitario?: number;
  custosAcessorios?: {
    frete: number;
    ipi: number;
    st: number;
    difal: number;
  };
  // Estado local para controle da UI
  mappedMaterialId?: string;
  createNew?: boolean;
  skip?: boolean;
}

export interface NFeData {
  chaveAcesso: string;
  dataEmissao: string;
  numero: string;
  valorTotalNota: number;
  valorTotalProdutos: number;
  valorFrete?: number;
  valorOutros?: number;
  valorDesconto?: number;
  costDistributionMode?: 'STRICT' | 'REDISTRIBUTE';
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    endereco: any;
  };
  items: NFeItem[];
}
