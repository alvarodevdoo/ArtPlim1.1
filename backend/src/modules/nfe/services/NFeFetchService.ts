import forge from 'node-forge';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';
import { BackupCryptoService } from '../../backup/infrastructure/crypto/BackupCryptoService';
import { NFeParserService } from './NFeParserService';
import { XMLParser } from 'fast-xml-parser';
import zlib from 'zlib';
import { SignedXml } from 'xml-crypto';

export class NFeFetchService {
  private parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

  constructor(private prisma: PrismaClient) {}

  async fetchByChave(organizationId: string, chaveAcesso: string) {
    // 1. Obter configurações do certificado
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId },
      include: { organization: true }
    });

    if (!settings?.nfeCertificate || !settings?.nfeCertificatePassword) {
      throw new AppError('Certificado Digital não configurado. Vá em Configurações > Sistema.');
    }

    const org = settings.organization;
    if (!org.cnpj) {
      throw new AppError('CNPJ da organização não cadastrado.');
    }

    // 2. Descriptografar a senha
    const certPassword = BackupCryptoService.decryptMasterPassword(settings.nfeCertificatePassword);
    
    // 3. Preparar o Certificado (PFX -> PEM para o axios)
    const p12Der = forge.util.decode64(settings.nfeCertificate);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPassword);

    // Extrair chave privada e certificado com busca recursiva (suporta SafeContents)
    let privateKeyPem = '';
    let certPem = '';

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keysArray = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    if (keysArray.length > 0 && keysArray[0].key) {
      privateKeyPem = forge.pki.privateKeyToPem(keysArray[0].key);
    }

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certsArray = certBags[forge.pki.oids.certBag] || [];
    
    // Filtramos o certificado do titular (menor validade) para assinar
    let bestCert: any = null;
    let minExpiry: Date | null = null;

    for (const bag of certsArray) {
      if (bag.cert) {
        const notAfter = bag.cert.validity.notAfter;
        if (!minExpiry || notAfter < minExpiry) {
          minExpiry = notAfter;
          bestCert = bag.cert;
        }
      }
    }

    if (bestCert) {
      certPem = forge.pki.certificateToPem(bestCert);
    }

    if (!privateKeyPem || !certPem) {
      throw new AppError('Não foi possível extrair a chave privada ou o certificado do arquivo PFX. Verifique a senha.');
    }

    // 4. Montar XML de Distribuição de DF-e (Consulta por Chave)
    const cnpjLimpo = org.cnpj.replace(/\D/g, '');
    const cuf = this.getCUF(org.state || 'SP');
    // versao e namespace devem estar no elemento raiz conforme manual SEFAZ
    const xmlDist = `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>1</tpAmb><cUFAutor>${cuf}</cUFAutor><CNPJ>${cnpjLimpo}</CNPJ><consChNFe><chNFe>${chaveAcesso}</chNFe></consChNFe></distDFeInt>`;

    // 5. Chamar Web Service da SEFAZ (Produção)
    // NOTA: NFeDistribuicaoDFe autentica via mTLS (certificado no HTTPS), não usa XML assinado
    const url = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

    console.log(`[NFeFetch] CNPJ=${cnpjLimpo} | UF=${org.state} | cUF=${cuf} | Chave=${chaveAcesso}`);

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>${xmlDist}</nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;

    try {
      const response = await axios.post(url, soapEnvelope, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
        },
        httpsAgent: new (require('https').Agent)({
          cert: certPem,
          key: privateKeyPem,
          rejectUnauthorized: false
        })
      });

      // 6. Processar Resposta — fast-xml-parser já retorna tudo como objeto
      const responseData = response.data;
      const soapResp = this.parser.parse(responseData);

      const envelope = soapResp['soap:Envelope'] || soapResp['soap12:Envelope'] || soapResp['s:Envelope'] || Object.values(soapResp)[0] as any;
      const body = envelope?.['soap:Body'] || envelope?.['soap12:Body'] || envelope?.['s:Body'] || Object.values(envelope || {})[0] as any;
      const responseNode = body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult || Object.values(body || {}).flatMap((v: any) => Object.values(v || {})).find(Boolean) as any;

      // retDistDFe pode estar direto no objeto parseado ou dentro de uma string XML aninhada
      let retDistDFe: any = null;
      if (responseNode && typeof responseNode === 'object') {
        retDistDFe = responseNode.retDistDFeInt ?? responseNode;
      } else if (typeof responseNode === 'string') {
        const inner = this.parser.parse(responseNode);
        retDistDFe = inner.retDistDFeInt;
      }

      if (!retDistDFe) {
        console.error('[NFeFetch] Estrutura SOAP inesperada:', JSON.stringify(soapResp).substring(0, 600));
        throw new Error('Resposta inesperada da SEFAZ. Verifique os logs do servidor.');
      }

      const cStat = Number(retDistDFe.cStat);
      console.log(`[NFeFetch] cStat: ${cStat} | xMotivo: ${retDistDFe.xMotivo}`);

      if (cStat === 137) {
        throw new Error('Nenhum documento localizado para esta chave. A nota ainda não foi disponibilizada para o seu CNPJ.');
      }

      // Tratar códigos de rejeição conhecidos com mensagens amigáveis
      if (cStat === 653) {
        throw new Error('Esta NF-e foi cancelada pelo fornecedor. O XML não está disponível via API. Utilize o "Download do documento" no portal da SEFAZ e importe o XML manualmente.');
      }
      if (cStat === 632) {
        throw new Error('Esta NF-e está fora do prazo de download automático (mais de 90 dias). Acesse o portal SEFAZ, baixe o XML e importe manualmente.');
      }
      if (cStat === 618) {
        throw new Error('Chave inválida: esta é uma NFC-e (cupom fiscal, modelo 65). O sistema aceita apenas NF-e modelo 55.');
      }

      if (cStat !== 138) {
        throw new Error(`SEFAZ rejeitou a consulta: ${retDistDFe.xMotivo} (Código: ${cStat})`);
      }
      // 8. Localizar o XML da Nota no lote retornado
      const lote = retDistDFe.loteDistDFeInt;
      if (!lote || !lote.docZip) {
        throw new Error(`Nota não encontrada na SEFAZ para esta chave. Verifique se ela foi emitida recentemente. (Status: ${retDistDFe.xMotivo})`);
      }

      const docs = Array.isArray(lote.docZip) ? lote.docZip : [lote.docZip];
      let fullXml = '';

      for (const doc of docs) {
        // Procure por procNFe (XML Completo) ou resNFe (Resumo)
        if (doc['@_schema']?.includes('resNFe') || doc['@_schema']?.includes('procNFe')) {
          const buffer = Buffer.from(doc['#text'], 'base64');
          const decompressed = zlib.gunzipSync(buffer);
          fullXml = decompressed.toString('utf-8');
          
          // Se for resumo, avisamos que precisa de manifestação
          if (doc['@_schema']?.includes('resNFe')) {
             console.log('Recebido apenas o resumo da nota. A SEFAZ exige manifestação para liberar o XML completo.');
          }
          break;
        }
      }

      if (!fullXml) {
        throw new Error('A SEFAZ ainda não disponibilizou o XML completo para esta consulta. Tente novamente mais tarde.');
      }

      // 9. Parsear o XML final
      const parserService = new NFeParserService();
      return parserService.parse(fullXml);

    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('Erro HTTP SEFAZ:', error.response.status, error.response.data);
        throw new AppError(`Erro de comunicação com SEFAZ (HTTP ${error.response.status}). Verifique sua conexão e se o certificado está ativo.`);
      }
      
      console.error('Erro na consulta SEFAZ:', error.message);
      // Se a mensagem já for amigável (vinda dos nossos throws), repassar ela
      throw error instanceof AppError ? error : new AppError(`Erro ao consultar SEFAZ: ${error.message}`);
    }
  }

  private signXml(xml: string, certPem: string, keyPem: string): string {
    const sig = new SignedXml({
      privateKey: keyPem,
      signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
      canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#"
    });
    sig.addReference({
      xpath: "//*[local-name(.)='distDFeInt']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/2001/10/xml-exc-c14n#"
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
    });
    sig.computeSignature(xml);
    return sig.getSignedXml();
  }

  private getCUF(uf: string): string {
    const ufs: Record<string, string> = {
      'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29', 'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52',
      'MA': '21', 'MT': '51', 'MS': '50', 'MG': '31', 'PA': '15', 'PB': '25', 'PR': '41', 'PE': '26', 'PI': '22',
      'RJ': '33', 'RN': '24', 'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42', 'SP': '35', 'SE': '28', 'TO': '17'
    };
    return ufs[uf.toUpperCase()] || '35';
  }
}
