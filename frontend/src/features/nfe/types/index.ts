export interface NFeItem {
  itemNumber: string;
  codigo: string;
  descricao: string;
  ncm: string;
  ean?: string;
  unidade: string;
  quantidade: number;
  quantidadeOriginal?: number;
  unidadeTributavel?: string;
  quantidadeTributavel?: number;
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
  // Campos para criação de novo material
  categoryId?: string;
  materialTypeId?: string;
  inventoryAccountId?: string;
  expenseAccountId?: string;
  minStockQuantity?: number;
  width?: number;
  height?: number;
  dimensionUnit?: 'm' | 'cm' | 'mm';
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
  extraFreightCost?: number;
  extraTaxesCost?: number;
  extraOtherCost?: number;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    endereco: any;
  };
  items: NFeItem[];
  /** XML bruto da NF-e, retornado por /parse e /fetch e reenviado no import para persistência */
  rawXml?: string;
  /** Totais fiscais da NF-e (frete, impostos, descontos), capturados no parse e persistidos no import */
  totaisFiscais?: {
    produtos?: number;
    frete?: number;
    seguro?: number;
    desconto?: number;
    outros?: number;
    ipi?: number;
    icms?: number;
    icmsST?: number;
    pis?: number;
    cofins?: number;
    ii?: number;
  } | null;
}
