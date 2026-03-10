import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';
import { Plus, Calculator, Eye, Search, Pencil } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';
import { BudgetDetailsModal } from '@/components/sales/BudgetDetailsModal';

const Orcamentos: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

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

  const abrirDetalhes = (orcamento: any) => {
    setSelectedBudget(orcamento);
    setIsDetailsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Orçamento Criado</span>;
      case 'SENT': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Enviado</span>;
      case 'APPROVED': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Aprovado</span>;
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
          <h1 className="text-3xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-muted-foreground">
            Gerencie orçamentos e simulações
          </p>
        </div>
        <Button onClick={() => navigate('/orcamentos/criar')}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow bg-blue-50 border-blue-200"
          onClick={() => navigate('/orcamentos/criar')}
        >
          <CardContent className="p-6 text-center">
            <Calculator className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="font-bold text-blue-800 mb-2">Simular Preço</h3>
            <p className="text-sm text-blue-600">
              Faça simulações rápidas sem compromisso
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow bg-green-50 border-green-200"
          onClick={() => navigate('/orcamentos/criar')}
        >
          <CardContent className="p-6 text-center">
            <Plus className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="font-bold text-green-800 mb-2">Novo Orçamento</h3>
            <p className="text-sm text-green-600">
              Criar proposta completa para cliente
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <Search className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Buscar</h3>
            <p className="text-sm text-muted-foreground">
              Localizar orçamentos antigos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent List */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Orçamentos</CardTitle>
          <CardDescription>
            Últimos orçamentos gerados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : orcamentos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhum orçamento encontrado.</p>
                <Button variant="link" onClick={() => navigate('/orcamentos/criar')}>
                  Criar meu primeiro orçamento
                </Button>
              </div>
            ) : (
              orcamentos.map((orcamento) => (
                <div key={orcamento.id} className="border border-border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-lg hover:text-primary cursor-pointer transition-colors" onClick={() => abrirDetalhes(orcamento)}>
                        {orcamento.budgetNumber || 'SEM NÚMERO'}
                      </h4>
                      <p className="text-sm text-muted-foreground font-medium">Cliente: {orcamento.customer?.name || 'Cliente Removido'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {orcamento.items?.length || 0} itens • {orcamento.items?.[0]?.product?.name || 'Item'} ...
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-primary">{formatCurrency(Number(orcamento.total))}</p>
                      <div className="mt-2">
                        {getStatusBadge(orcamento.status)}
                      </div>
                    </div>
                  </div>

                  <DatasOrcamento
                    criadoEm={orcamento.createdAt}
                    validadeEm={orcamento.validUntil}
                    className="mb-4 p-2 bg-muted/50 rounded"
                  />

                  <div className="flex space-x-2 justify-end border-t pt-3">
                    <Button size="sm" variant="outline" onClick={() => abrirDetalhes(orcamento)}>
                      <Eye className="w-4 h-4 mr-1" />
                      Visualizar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/orcamentos/criar?edit=${orcamento.id}`)}>
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button size="sm" onClick={() => navigate(`/pedidos/criar?fromBudget=${orcamento.id}`)}>
                      Gerar Pedido
                    </Button>
                  </div>
                </div>
              ))
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