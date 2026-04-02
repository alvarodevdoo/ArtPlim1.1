export interface NFeItem {
  itemNumber: string;
  codigo: string;
  descricao: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  // Estado local para controle da UI
  mappedMaterialId?: string;
  createNew?: boolean;
}

export interface NFeData {
  chaveAcesso: string;
  dataEmissao: string;
  numero: string;
  valorTotalNota: number;
  valorTotalProdutos: number;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    endereco: any;
  };
  items: NFeItem[];
}
