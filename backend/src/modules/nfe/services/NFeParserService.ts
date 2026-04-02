import { XMLParser } from 'fast-xml-parser';

export class NFeParserService {
  constructor() {}

  parse(xmlContent: string) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });

    const jsonObj = parser.parse(xmlContent);
    const nfe = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
    
    if (!nfe) {
      throw new Error('Formato de XML não reconhecido como NFe Válida.');
    }

    const chaveAcesso = nfe["@_Id"]?.replace('NFe', '') || '';

    const emitente = nfe.emit;
    const destinatario = nfe.dest;
    
    // Tratamento de itens
    let det = nfe.det;
    if (!det) det = [];
    if (!Array.isArray(det)) det = [det];

    const items = det.map((item: any) => {
      const prod = item.prod;
      const impostos = item.imposto;
      // Extrair informações do ICMS, IPI etc, caso necessário

      return {
        itemNumber: item["@_nItem"],
        codigo: prod.cProd,
        descricao: prod.xProd,
        ncm: prod.NCM,
        cfop: prod.CFOP,
        unidade: prod.uCom,
        quantidade: parseFloat(prod.qCom),
        valorUnitario: parseFloat(prod.vUnCom),
        valorTotal: parseFloat(prod.vProd),
        // impostos podem ser extraídos aqui se ajudar no custeio
      };
    });

    const total = nfe.total?.ICMSTot;

    return {
      chaveAcesso,
      dataEmissao: nfe.ide?.dhEmi || nfe.ide?.dEmi, // Suporte a versão 4.0 e 3.1
      numero: nfe.ide?.nNF,
      serie: nfe.ide?.serie,
      valorTotalNota: total ? parseFloat(total.vNF) : 0,
      valorTotalProdutos: total ? parseFloat(total.vProd) : 0,
      valorFrete: total ? parseFloat(total.vFrete) : 0,
      valorDesconto: total ? parseFloat(total.vDesc) : 0,
      valorOutros: total ? parseFloat(total.vOutro) : 0,
      emitente: {
        cnpj: emitente.CNPJ || emitente.CPF,
        razaoSocial: emitente.xNome,
        nomeFantasia: emitente.xFant || emitente.xNome,
        inscricaoEstadual: emitente.IE,
        endereco: emitente.enderEmit ? {
          logradouro: emitente.enderEmit.xLgr,
          numero: emitente.enderEmit.nro,
          complemento: emitente.enderEmit.xCpl,
          bairro: emitente.enderEmit.xBairro,
          cidade: emitente.enderEmit.xMun,
          uf: emitente.enderEmit.UF,
          cep: emitente.enderEmit.CEP,
          telefone: emitente.enderEmit.fone
        } : null
      },
      destinatario: {
        cnpj: destinatario.CNPJ || destinatario.CPF,
        razaoSocial: destinatario.xNome,
      },
      items
    };
  }
}
