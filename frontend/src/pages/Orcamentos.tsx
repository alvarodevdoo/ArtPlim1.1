import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Plus, Eye, Search, Pencil, Printer, FileText, Receipt, FileDown, ClipboardCopy, Phone, CheckCircle2, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';
import { BudgetDetailsModal } from '@/components/sales/BudgetDetailsModal';
import { printBudget, generateBudgetPdf, copyBudgetToClipboard } from '@/lib/printOrder';

const Orcamentos: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'valido' | 'pedido' | 'expirado'>('valido');

  useEffect(() => {
    loadOrcamentos();
  }, []);

  const loadOrcamentos = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/sales/budgets');
      setOrcamentos(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
      toast.error('Erro ao carregar lista de orçamentos');
    } finally {
      setLoading(false);
    }
  };

  // Garante que o orçamento tenha os itens completos antes de imprimir.
  const getFullBudget = async (orcamento: any) => {
    if (orcamento.items && orcamento.items.length > 0) return orcamento;
    const r = await api.get(`/api/sales/budgets/${orcamento.id}`);
    return r.data?.success ? r.data.data : orcamento;
  };

  // Classifica cada orçamento em: 'pedido' (já gerou pedido), 'expirado' (validade vencida) ou 'valido'.
  const getCategoria = (orc: any): 'pedido' | 'expirado' | 'valido' => {
    if (orc.status === 'APPROVED') return 'pedido';
    if (orc.validUntil && new Date(orc.validUntil) < new Date()) return 'expirado';
    return 'valido';
  };

  const matchesSearch = (orc: any) => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return true;

    const budgetNumberMatch = orc.budgetNumber?.toLowerCase().includes(searchLower);
    const customerMatch = orc.customer?.name?.toLowerCase().includes(searchLower);

    // Busca por telefone (original ou apenas números)
    const rawPhone = orc.customer?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const cleanSearch = searchLower.replace(/\D/g, '');

    const phoneMatch = rawPhone.toLowerCase().includes(searchLower) || (cleanSearch !== '' && cleanPhone.includes(cleanSearch));

    return budgetNumberMatch || customerMatch || phoneMatch;
  };

  const orcamentosBuscados = orcamentos.filter(matchesSearch);

  const counts = {
    todos: orcamentosBuscados.length,
    valido: orcamentosBuscados.filter(o => getCategoria(o) === 'valido').length,
    pedido: orcamentosBuscados.filter(o => getCategoria(o) === 'pedido').length,
    expirado: orcamentosBuscados.filter(o => getCategoria(o) === 'expirado').length,
  };

  const filteredOrcamentos = orcamentosBuscados.filter(o => activeTab === 'todos' || getCategoria(o) === activeTab);

  const abrirDetalhes = (orcamento: any) => {
    setSelectedBudget(orcamento);
    setIsDetailsModalOpen(true);
  };

  const gerarPedido = (orcamento: any) => {
    // status APPROVED indica que este orçamento já foi convertido em pedido.
    if (orcamento.status === 'APPROVED') {
      const ok = window.confirm(
        `O orçamento #${orcamento.budgetNumber} já gerou um pedido. Deseja gerar outro pedido a partir dele?`
      );
      if (!ok) return;
    }
    navigate(`/pedidos/criar?fromBudget=${orcamento.id}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return null;
      case 'SENT': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Enviado</span>;
      case 'APPROVED': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Pedido Gerado</span>;
      case 'REJECTED': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Rejeitado</span>;
      case 'EXPIRED': return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">Vencido</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-display">Orçamentos</h1>
          <p className="text-muted-foreground">
            Gerencie orçamentos e simulações
          </p>
        </div>
        <Button onClick={() => navigate('/orcamentos/criar')}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      {/* Recent List */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b mb-4 pb-px">
            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: 'valido', label: 'Válidos', count: counts.valido },
                { key: 'pedido', label: 'Pedido Gerado', count: undefined },
                { key: 'expirado', label: 'Expirados', count: undefined },
                { key: 'todos', label: 'Todos', count: counts.todos },
              ] as const).map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className={`text-xs rounded-full px-1.5 py-0.5 ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="relative w-full md:w-96 mb-2 md:mb-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pesquisar por cliente, número ou telefone..."
                className="w-full pl-10 pr-4 py-2 bg-muted rounded-md border border-input focus:ring-1 focus:ring-primary outline-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : filteredOrcamentos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>
                  {searchTerm
                    ? `Nenhum orçamento encontrado para "${searchTerm}".`
                    : 'Nenhum orçamento nesta categoria.'}
                </p>
                {searchTerm && (
                  <Button variant="link" onClick={() => setSearchTerm('')}>
                    Limpar busca
                  </Button>
                )}
              </div>
            ) : (
              filteredOrcamentos.map((orcamento) => {
                const isConvertido = orcamento.status === 'APPROVED';
                const isVencido = !isConvertido && orcamento.validUntil && new Date(orcamento.validUntil) < new Date();
                const borderLeftColor = isConvertido ? '#10B981' : isVencido ? '#EF4444' : '#3B82F6';

                return (
                <div
                  key={orcamento.id}
                  className={`rounded-lg border border-border border-l-[6px] p-4 shadow-sm hover:shadow-lg transition-all cursor-pointer ${isConvertido ? 'bg-green-50/40' : isVencido ? 'bg-red-50/40' : 'bg-card'}`}
                  style={{ borderLeftColor }}
                  onClick={() => abrirDetalhes(orcamento)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-lg leading-tight flex items-center flex-wrap gap-2">
                        <span>{orcamento.customer?.name || 'Cliente Removido'}</span>
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">#{orcamento.budgetNumber || 'SEM NÚMERO'}</span>
                        {isConvertido && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">
                            <CheckCircle2 className="w-3 h-3" /> Pedido Gerado
                          </span>
                        )}
                        {isVencido && <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-[10px] font-bold uppercase">Vencido</span>}
                      </h4>
                      {orcamento.customer?.phone && (
                        <p className="text-sm font-semibold text-blue-700 flex items-center mt-1">
                          <Phone className="w-3.5 h-3.5 mr-1.5" />{orcamento.customer.phone}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-muted-foreground">{orcamento.items?.length || 0} itens</span>
                        <p className="font-bold text-xl text-primary">{formatCurrency(Number(orcamento.total))}</p>
                      </div>
                      {getStatusBadge(orcamento.status)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-1.5 pt-1.5 border-t">
                    <DatasOrcamento
                      criadoEm={orcamento.createdAt}
                      validadeEm={orcamento.validUntil}
                      compact
                    />
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" title="Visualizar" onClick={() => abrirDetalhes(orcamento)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Editar" onClick={() => navigate(`/orcamentos/criar?edit=${orcamento.id}`)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" title="Imprimir">
                              <Printer className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="end">
                        <button
                          className="flex items-start gap-3 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                          onClick={async () => {
                            try {
                              const full = await getFullBudget(orcamento);
                              await printBudget(full, 'A4');
                            } catch {
                              toast.error('Erro ao preparar impressão.');
                            }
                          }}
                        >
                          <FileText className="w-4 h-4 mt-0.5 text-slate-700 shrink-0" />
                          <span>
                            <span className="font-medium block">Folha A4</span>
                            <span className="text-xs text-muted-foreground">Impressora comum</span>
                          </span>
                        </button>
                        <button
                          className="flex items-start gap-3 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                          onClick={async () => {
                            try {
                              const full = await getFullBudget(orcamento);
                              await printBudget(full, 'THERMAL_80');
                            } catch {
                              toast.error('Erro ao preparar impressão.');
                            }
                          }}
                        >
                          <Receipt className="w-4 h-4 mt-0.5 text-slate-700 shrink-0" />
                          <span>
                            <span className="font-medium block">Térmica 80mm</span>
                            <span className="text-xs text-muted-foreground">Cupom / bobina</span>
                          </span>
                        </button>
                        <button
                          className="flex items-start gap-3 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                          onClick={async () => {
                            const loadingToast = toast.loading('Gerando PDF...');
                            try {
                              const full = await getFullBudget(orcamento);
                              await generateBudgetPdf(full);
                              toast.success('PDF gerado com sucesso!', { id: loadingToast });
                            } catch (err) {
                              console.error(err);
                              toast.error('Erro ao gerar PDF.', { id: loadingToast });
                            }
                          }}
                        >
                          <FileDown className="w-4 h-4 mt-0.5 text-slate-700 shrink-0" />
                          <span>
                            <span className="font-medium block">Gerar PDF</span>
                          </span>
                        </button>
                        <button
                          className="flex items-start gap-3 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors border-t mt-1 pt-2"
                          onClick={async () => {
                            try {
                              const full = await getFullBudget(orcamento);
                              await copyBudgetToClipboard(full);
                              toast.success('Orçamento copiado para a área de transferência!');
                            } catch (err) {
                              console.error(err);
                              toast.error('Não foi possível copiar. Verifique as permissões do navegador.');
                            }
                          }}
                        >
                          <ClipboardCopy className="w-4 h-4 mt-0.5 text-slate-700 shrink-0" />
                          <span>
                            <span className="font-medium block">Área de Transferência</span>
                          </span>
                        </button>
                      </PopoverContent>
                    </Popover>
                        <Button
                          size="icon"
                          variant={orcamento.status === 'APPROVED' ? 'outline' : 'default'}
                          title={orcamento.status === 'APPROVED' ? 'Gerar Novamente' : 'Gerar Pedido'}
                          onClick={() => gerarPedido(orcamento)}
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <BudgetDetailsModal
        budget={selectedBudget}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
      />
    </div>
  );
};

export default Orcamentos;