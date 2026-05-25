import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { FileText, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface NFeImportRow {
  id: string;
  chaveAcesso: string | null;
  invoiceNumber: string;
  nfeNumero: string | null;
  issueDate: string;
  importedAt: string;
  totalAmount: string | number;
  supplierName: string;
  supplierDocument: string | null;
  itemsImported: number;
  itemsSkipped: number;
  isReimport: boolean;
  skippedItems: Array<{ codigo: string; descricao: string }>;
  extras: { frete: number; impostos: number; outras: number } | null;
}

const fmtMoney = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const NFeImportsHistory: React.FC = () => {
  const [rows, setRows] = useState<NFeImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/api/nfe/imports');
      setRows(resp.data?.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.chaveAcesso || '').toLowerCase().includes(q) ||
      (r.nfeNumero || '').toLowerCase().includes(q) ||
      (r.supplierName || '').toLowerCase().includes(q) ||
      (r.supplierDocument || '').toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Importações de NF-e
          </CardTitle>
          <CardDescription>
            Histórico de notas processadas. Itens descartados em uma importação podem ser trazidos em uma reimportação posterior.
          </CardDescription>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Recarregar
        </button>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por chave, número, fornecedor ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {search ? 'Nenhuma importação encontrada para essa busca.' : 'Nenhuma NF-e importada ainda.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b">
                  <th className="text-left px-3 py-2">Nº NF-e</th>
                  <th className="text-left px-3 py-2">Fornecedor</th>
                  <th className="text-left px-3 py-2">Data Importação</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="text-center px-3 py-2">Itens</th>
                  <th className="text-center px-3 py-2">Descartados</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isExpanded = expanded === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr className="border-b hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{r.nfeNumero || '—'}</span>
                            {r.chaveAcesso && (
                              <span className="font-mono text-[10px] text-slate-400 truncate max-w-[260px]" title={r.chaveAcesso}>
                                {r.chaveAcesso}
                              </span>
                            )}
                            {r.isReimport && (
                              <span className="text-[9px] font-bold uppercase text-amber-600 tracking-wider mt-0.5">
                                Reimportação
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{r.supplierName}</span>
                            {r.supplierDocument && (
                              <span className="text-[10px] text-slate-400 font-mono">{r.supplierDocument}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 text-xs">{fmtDate(r.importedAt)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">R$ {fmtMoney(r.totalAmount)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                            {r.itemsImported}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {r.itemsSkipped > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold">
                              <AlertTriangle className="w-3 h-3" />
                              {r.itemsSkipped}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {(r.itemsSkipped > 0 || (r.extras && (r.extras.frete || r.extras.impostos || r.extras.outras))) && (
                            <button
                              type="button"
                              onClick={() => setExpanded(isExpanded ? null : r.id)}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              {isExpanded ? 'Ocultar' : 'Detalhes'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/50 border-b">
                          <td colSpan={7} className="px-3 py-3">
                            <div className="space-y-3">
                              {r.extras && (r.extras.frete || r.extras.impostos || r.extras.outras) ? (
                                <div className="flex flex-wrap gap-4 text-xs">
                                  <span className="text-slate-600"><strong>Frete extra:</strong> R$ {fmtMoney(r.extras.frete)}</span>
                                  <span className="text-slate-600"><strong>Impostos extras:</strong> R$ {fmtMoney(r.extras.impostos)}</span>
                                  <span className="text-slate-600"><strong>Outras taxas:</strong> R$ {fmtMoney(r.extras.outras)}</span>
                                </div>
                              ) : null}
                              {r.itemsSkipped > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5">
                                    Itens descartados nesta importação ({r.itemsSkipped})
                                  </p>
                                  <ul className="space-y-1">
                                    {r.skippedItems.map((it, idx) => (
                                      <li key={idx} className="text-xs text-slate-700 flex gap-2">
                                        <span className="font-mono text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{it.codigo}</span>
                                        <span>{it.descricao}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <p className="text-[10px] text-slate-500 italic mt-2">
                                    Reimportar a mesma chave traz automaticamente apenas estes itens (os demais são deduplicados).
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
