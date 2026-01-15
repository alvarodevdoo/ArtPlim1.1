import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DatasOrcamento } from '@/components/ui/DatasOrcamento';
import { Plus, Search, Calculator, Eye, Edit } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Produto {
  id: string;
  name: string;
}

interface Cliente {
  id: string;
  name: string;
}

interface SimulationResult {
  productId: string;
  productName: string;
  specifications: {
    width: number;
    height: number;
    quantity: number;
    area: number;
  };
  pricing: {
    costPerUnit: number;
    calculatedPerUnit: number;
    unitPrice: number;
    totalCost: number;
    totalCalculated: number;
    totalPrice: number;
    margin: number;
  };
  breakdown: string[];
}

const Orcamentos: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [simulatorData, setSimulatorData] = useState({
    productId: '',
    width: '',
    height: '',
    quantity: '1'
  });

  useEffect(() => {
    loadProdutos();
    loadClientes();
  }, []);

  const loadProdutos = async () => {
    try {
      const response = await api.get('/api/catalog/products');
      setProdutos(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar produtos');
    }
  };

  const loadClientes = async () => {
    try {
      const response = await api.get('/api/profiles/customers/list');
      setClientes(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/api/sales/simulate', {
        productId: simulatorData.productId,
        width: parseFloat(simulatorData.width),
        height: parseFloat(simulatorData.height),
        quantity: parseInt(simulatorData.quantity)
      });

      setSimulation(response.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao simular orçamento');
    } finally {
      setLoading(false);
    }
  };

  const resetSimulator = () => {
    setSimulatorData({
      productId: '',
      width: '',
      height: '',
      quantity: '1'
    });
    setSimulation(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-muted-foreground">
            Simule preços e crie orçamentos
          </p>
        </div>
        <Button onClick={() => setShowSimulator(true)}>
          <Calculator className="w-4 h-4 mr-2" />
          Simular Preço
        </Button>
      </div>

      {/* Simulator Modal */}
      {showSimulator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Simulador de Preços</CardTitle>
              <CardDescription>
                Configure as especificações para calcular o preço
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form */}
                <div>
                  <form onSubmit={handleSimulate} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Produto *</label>
                      <select
                        value={simulatorData.productId}
                        onChange={(e) => setSimulatorData(prev => ({ ...prev, productId: e.target.value }))}
                        className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                        required
                      >
                        <option value="">Selecione um produto</option>
                        {produtos.map(produto => (
                          <option key={produto.id} value={produto.id}>
                            {produto.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Largura (mm) *</label>
                        <Input
                          type="number"
                          value={simulatorData.width}
                          onChange={(e) => setSimulatorData(prev => ({ ...prev, width: e.target.value }))}
                          placeholder="1000"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Altura (mm) *</label>
                        <Input
                          type="number"
                          value={simulatorData.height}
                          onChange={(e) => setSimulatorData(prev => ({ ...prev, height: e.target.value }))}
                          placeholder="1000"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Quantidade *</label>
                      <Input
                        type="number"
                        min="1"
                        value={simulatorData.quantity}
                        onChange={(e) => setSimulatorData(prev => ({ ...prev, quantity: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="flex space-x-2">
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Calculando...' : 'Calcular Preço'}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetSimulator}>
                        Limpar
                      </Button>
                    </div>
                  </form>
                </div>

                {/* Results */}
                <div>
                  {simulation && (
                    <div className="space-y-4">
                      <div className="border border-border rounded-lg p-4">
                        <h3 className="font-semibold mb-3">{simulation.productName}</h3>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Dimensões:</span>
                            <span>{simulation.specifications.width} × {simulation.specifications.height} mm</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Área:</span>
                            <span>{simulation.specifications.area.toFixed(3)} m²</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quantidade:</span>
                            <span>{simulation.specifications.quantity} un</span>
                          </div>
                        </div>
                      </div>

                      <div className="border border-border rounded-lg p-4">
                        <h4 className="font-semibold mb-3">Precificação</h4>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Custo unitário:</span>
                            <span>{formatCurrency(simulation.pricing.costPerUnit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Preço sugerido:</span>
                            <span>{formatCurrency(simulation.pricing.calculatedPerUnit)}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span>Preço final:</span>
                            <span>{formatCurrency(simulation.pricing.unitPrice)}</span>
                          </div>
                          <hr className="my-2" />
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total:</span>
                            <span>{formatCurrency(simulation.pricing.totalPrice)}</span>
                          </div>
                          <div className="flex justify-between text-green-600">
                            <span>Margem:</span>
                            <span>{simulation.pricing.margin.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>

                      {simulation.breakdown.length > 0 && (
                        <div className="border border-border rounded-lg p-4">
                          <h4 className="font-semibold mb-3">Detalhamento</h4>
                          <div className="space-y-1 text-sm">
                            {simulation.breakdown.map((item, index) => (
                              <div key={index} className="text-muted-foreground">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <Button className="flex-1">
                          Criar Orçamento
                        </Button>
                        <Button variant="outline" className="flex-1">
                          Salvar Simulação
                        </Button>
                      </div>
                    </div>
                  )}

                  {!simulation && (
                    <div className="border border-dashed border-border rounded-lg p-8 text-center">
                      <Calculator className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Preencha os dados e clique em "Calcular Preço" para ver o resultado
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowSimulator(false);
                    resetSimulator();
                  }}
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowSimulator(true)}>
          <CardContent className="p-6 text-center">
            <Calculator className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Simular Preço</h3>
            <p className="text-sm text-muted-foreground">
              Calcule preços rapidamente
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <Plus className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Novo Orçamento</h3>
            <p className="text-sm text-muted-foreground">
              Criar orçamento completo
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center">
            <Eye className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Orçamentos Salvos</h3>
            <p className="text-sm text-muted-foreground">
              Ver orçamentos anteriores
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Orçamentos Salvos</CardTitle>
          <CardDescription>
            Últimos orçamentos criados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Exemplo de orçamento salvo */}
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold">Orçamento #000123</h4>
                  <p className="text-sm text-muted-foreground">Cliente: Gráfica Viana</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">{formatCurrency(2450.00)}</p>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                    Orçamento
                  </span>
                </div>
              </div>
              
              {/* Datas do Orçamento */}
              <DatasOrcamento 
                criadoEm="2026-01-05T23:58:00Z" 
                validadeEm="2026-01-12T23:58:00Z"
                className="mb-3 p-3 bg-muted rounded-lg"
              />
              
              <div className="flex space-x-2">
                <Button size="sm" variant="outline">
                  <Eye className="w-4 h-4 mr-1" />
                  Ver Detalhes
                </Button>
                <Button size="sm">
                  Converter em Pedido
                </Button>
              </div>
            </div>
          </div>
          
          <div className="text-center py-8 text-muted-foreground mt-6">
            <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Use o simulador acima para criar orçamentos</p>
            <p className="text-sm">Os orçamentos salvos aparecerão aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Orcamentos;