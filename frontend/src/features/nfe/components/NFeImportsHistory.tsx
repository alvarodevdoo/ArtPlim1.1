import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { FileText, Search, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { NFeDetailModal } from './NFeDetailModal';

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
  importedByName: string | null;
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
  const [detailId, setDetailId] = useState<string | null>(null);

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
          className="text-label flex items-center gap-1.5 text-primary hover:text-primary/80 shrink-0 whitespace-nowrap"
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
          <div className="space-y-2.5">
            {filtered.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setDetailId(r.id)}
                className="w-full text-left rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
                title="Clique para ver a NF-e completa"
              >
                {/* Linha principal: fornecedor + valor */}
                <div className="flex items-start justify-between gap-4 px-4 pt-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 truncate" title={r.supplierName}>{r.supplierName}</span>
                        {r.isReimport && (
                          <span className="inline-flex shrink-0 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded tracking-wider">
                            Reimportação
                          </span>
                        )}
                      </div>
                      <span className="text-caption text-slate-400 font-mono">
                        NF-e {r.nfeNumero || '—'}{r.supplierDocument ? ` · CNPJ ${r.supplierDocument}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-caption uppercase font-bold tracking-wider text-slate-400">Valor</div>
                      <div className="font-bold tabular-nums whitespace-nowrap text-slate-800">R$ {fmtMoney(r.totalAmount)}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                  </div>
                </div>

                {/* Linha de metadados: data, itens, descartados */}
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 mt-2">
                  <div className="flex items-center gap-2 text-caption text-slate-500 min-w-0">
                    <span className="whitespace-nowrap">{fmtDate(r.importedAt)}</span>
                    {r.importedByName && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="truncate" title={r.importedByName}>por {r.importedByName}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-caption font-bold tabular-nums"
                      title={`${r.itemsImported} itens importados`}
                    >
                      {r.itemsImported} itens
                    </span>
                    {r.itemsSkipped > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-caption font-bold tabular-nums"
                        title={`${r.itemsSkipped} itens descartados`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {r.itemsSkipped} descartados
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {detailId && (
        <NFeDetailModal importId={detailId} onClose={() => setDetailId(null)} />
      )}
    </Card>
  );
};
