import React, { useEffect, useState } from 'react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Button } from '@/components/ui/Button';
import {
  X, FileText, Building2, Calendar, User, Hash, Download, Loader2, AlertTriangle, Package
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface NFeDetailItem {
  id: string;
  codigo: string | null;
  descricaoNFe: string | null;
  materialName: string;
  unit: string | null;
  quantity: string | number;
  unitPrice: string | number;
  totalPrice: string | number;
}

interface NFeDetail {
  id: string;
  chaveAcesso: string | null;
  invoiceNumber: string;
  nfeNumero: string | null;
  issueDate: string;
  importedAt: string;
  totalAmount: string | number;
  status: string;
  supplier: { name: string; document: string | null; email: string | null; phone: string | null };
  importedByName: string | null;
  isReimport: boolean;
  extras: { frete: number; impostos: number; outras: number } | null;
  totaisFiscais: {
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
  skippedItems: Array<{ codigo: string; descricao: string }>;
  hasXml: boolean;
  xmlContent: string | null;
  items: NFeDetailItem[];
}

const fmtMoney = (v: any) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (v: any) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const fmtDate = (s: string) => {
  if (!s) return '—';
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

interface NFeDetailModalProps {
  importId: string;
  onClose: () => void;
}

export const NFeDetailModal: React.FC<NFeDetailModalProps> = ({ importId, onClose }) => {
  const [data, setData] = useState<NFeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const resp = await api.get(`/api/nfe/imports/${importId}`);
        if (active) setData(resp.data?.data || null);
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Não foi possível carregar a NF-e.');
        if (active) onClose();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [importId, onClose]);

  const downloadXml = () => {
    if (!data?.xmlContent) return;
    const blob = new Blob([data.xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe-${data.nfeNumero || data.chaveAcesso || data.id}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalPortal onBackdropClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-h3">
                NF-e {data?.nfeNumero || (loading ? '...' : '—')}
              </h3>
              <p className="text-caption text-muted-foreground truncate">
                {data?.supplier.name || 'Detalhe da importação'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {data?.hasXml && (
              <Button variant="outline" size="sm" type="button" onClick={downloadXml}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar XML
              </Button>
            )}
            <Button variant="ghost" size="icon" type="button" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando NF-e...
            </div>
          ) : !data ? (
            <div className="text-center py-16 text-muted-foreground">NF-e não encontrada.</div>
          ) : (
            <>
              {/* Cabeçalho de dados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoBlock icon={<Building2 className="w-4 h-4" />} label="Fornecedor">
                  <span className="font-medium text-slate-800">{data.supplier.name}</span>
                  {data.supplier.document && (
                    <span className="block text-caption text-slate-400 font-mono">CNPJ {data.supplier.document}</span>
                  )}
                </InfoBlock>
                <InfoBlock icon={<Calendar className="w-4 h-4" />} label="Emissão / Importação">
                  <span className="text-slate-700">{fmtDate(data.issueDate)}</span>
                  <span className="block text-caption text-slate-400">importada em {fmtDate(data.importedAt)}</span>
                </InfoBlock>
                <InfoBlock icon={<User className="w-4 h-4" />} label="Importada por">
                  <span className="text-slate-700">{data.importedByName || '—'}</span>
                  {data.isReimport && (
                    <span className="inline-flex w-fit mt-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded tracking-wider">
                      Reimportação
                    </span>
                  )}
                </InfoBlock>
                {data.chaveAcesso && (
                  <InfoBlock icon={<Hash className="w-4 h-4" />} label="Chave de acesso" className="sm:col-span-2 lg:col-span-3">
                    <span className="font-mono text-caption text-slate-600 break-all">{data.chaveAcesso}</span>
                  </InfoBlock>
                )}
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-primary" />
                  <h4 className="text-h3">Itens ({data.items.length})</h4>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-body">
                    <thead>
                      <tr className="text-caption uppercase font-bold tracking-wider text-slate-500 bg-slate-50 border-b">
                        <th className="text-left px-3 py-2 w-[12%]">Código</th>
                        <th className="text-left px-3 py-2">Material</th>
                        <th className="text-right px-3 py-2 w-[12%]">Qtd</th>
                        <th className="text-right px-3 py-2 w-[16%]">Vlr. Unit.</th>
                        <th className="text-right px-3 py-2 w-[16%]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map(it => (
                        <tr key={it.id} className="border-b border-slate-100 last:border-0 align-top">
                          <td className="px-3 py-2.5 font-mono text-caption text-slate-500">{it.codigo || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-slate-700">{it.materialName}</span>
                            {it.descricaoNFe && it.descricaoNFe !== it.materialName && (
                              <span className="block text-caption text-slate-400">NF-e: {it.descricaoNFe}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                            {fmtNum(it.quantity)} {it.unit || ''}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">R$ {fmtMoney(it.unitPrice)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-medium">R$ {fmtMoney(it.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totais: frete, impostos e total da nota */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Composição do total + tributos inclusos */}
                {data.totaisFiscais ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    <div>
                      <p className="text-caption uppercase font-bold tracking-wider text-slate-400 mb-2">Composição do total</p>
                      <dl className="space-y-1 text-body">
                        <TotalRow label="Produtos" value={data.totaisFiscais.produtos} />
                        <TotalRow label="Frete" value={data.totaisFiscais.frete} />
                        <TotalRow label="Seguro" value={data.totaisFiscais.seguro} />
                        <TotalRow label="IPI" value={data.totaisFiscais.ipi} />
                        <TotalRow label="ICMS ST" value={data.totaisFiscais.icmsST} />
                        <TotalRow label="II (Importação)" value={data.totaisFiscais.ii} />
                        <TotalRow label="Outras despesas" value={data.totaisFiscais.outros} />
                        <TotalRow label="Desconto" value={data.totaisFiscais.desconto} negative />
                      </dl>
                    </div>
                    {/* Tributos embutidos no preço — apenas referência, não somam */}
                    {(Number(data.totaisFiscais.icms) || Number(data.totaisFiscais.pis) || Number(data.totaisFiscais.cofins)) ? (
                      <div className="pt-3 border-t border-slate-200">
                        <p className="text-caption uppercase font-bold tracking-wider text-slate-400 mb-2">
                          Tributos inclusos no preço <span className="normal-case font-normal">(referência, não somam)</span>
                        </p>
                        <dl className="space-y-1 text-body">
                          <TotalRow label="ICMS" value={data.totaisFiscais.icms} muted />
                          <TotalRow label="PIS" value={data.totaisFiscais.pis} muted />
                          <TotalRow label="COFINS" value={data.totaisFiscais.cofins} muted />
                        </dl>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-4 flex items-center text-caption text-slate-400 italic">
                    Frete e impostos detalhados não disponíveis para esta nota (importada antes do registro fiscal completo).
                  </div>
                )}

                {/* Custos adicionais (pagos fora da NF-e) + Total */}
                <div className="flex flex-col justify-between gap-4">
                  {data.extras && (data.extras.frete || data.extras.impostos || data.extras.outras) ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <p className="text-caption uppercase font-bold tracking-wider text-slate-400 mb-2">Custos adicionais (pagos à parte)</p>
                      <dl className="space-y-1 text-body">
                        <TotalRow label="Frete extra" value={data.extras.frete} />
                        <TotalRow label="Impostos extras" value={data.extras.impostos} />
                        <TotalRow label="Outras taxas" value={data.extras.outras} />
                      </dl>
                    </div>
                  ) : null}
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-right">
                    <div className="text-caption uppercase font-bold tracking-wider text-slate-400">Valor total da nota</div>
                    <div className="text-h2 tabular-nums text-slate-800">R$ {fmtMoney(data.totalAmount)}</div>
                  </div>
                </div>
              </div>

              {/* Descartados */}
              {data.skippedItems.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <p className="text-caption font-bold uppercase tracking-wider text-amber-700">
                      Itens descartados nesta importação ({data.skippedItems.length})
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {data.skippedItems.map((it, idx) => (
                      <li key={idx} className="text-body text-slate-700 flex gap-2">
                        <span className="font-mono text-caption bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{it.codigo}</span>
                        <span>{it.descricao}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!data.hasXml && (
                <p className="text-caption text-slate-400 italic">
                  O XML original não está disponível para esta nota (importada antes do recurso de armazenamento de XML).
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

const TotalRow: React.FC<{ label: React.ReactNode; value?: number; negative?: boolean; muted?: boolean }> = ({ label, value, negative, muted }) => {
  const v = Number(value || 0);
  if (!v) return null; // não polui com linhas zeradas
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? 'text-slate-400' : 'text-slate-500'}>{label}</dt>
      <dd className={`tabular-nums ${muted ? 'text-slate-400' : 'text-slate-700'}`}>{negative ? '- ' : ''}R$ {fmtMoney(v)}</dd>
    </div>
  );
};

const InfoBlock: React.FC<{
  icon: React.ReactNode;
  label: string;
  className?: string;
  children: React.ReactNode;
}> = ({ icon, label, className, children }) => (
  <div className={`rounded-xl border border-slate-200 bg-slate-50/50 p-3 ${className || ''}`}>
    <div className="flex items-center gap-1.5 text-caption uppercase font-bold tracking-wider text-slate-400 mb-1">
      <span className="text-slate-400">{icon}</span> {label}
    </div>
    <div className="min-w-0">{children}</div>
  </div>
);

export default NFeDetailModal;
