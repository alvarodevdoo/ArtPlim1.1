import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Package, Settings, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ProductComponentManager } from '@/components/catalog/ProductComponentManager';
import { ProductConfigurationManager } from '@/components/catalog/ProductConfigurationManager';

interface Produto {
  id: string;
  name: string;
  description?: string;
  pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
  salePrice?: number;
  minPrice?: number;
  markup: number;
  active: boolean;
  components?: Array<{
    id: string;
    material: {
      id: string;
      name: string;
      format: string;
      costPerUnit: number;
      unit: string;
    };
  }>;
  _count: {
    orderItems: number;
  };
}

const Produtos: React.FC = () => {
  const { settings } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configuringProduct, setConfiguringProduct] = useState<Produto | null>(null);
  const [activeConfigTab, setActiveConfigTab] = useState<'materials' | 'configurations'>('materials');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pricingMode: 'SIMPLE_AREA' as 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER',
    salePrice: '',
    minPrice: '',
    markup: '2.0'
  });

  useEffect(() => {
    loadProdutos();
  }, []);

  // Resetar pricingMode se engenharia for desabilitada
  useEffect(() => {
    if (!settings?.enableEngineering && formData.pricingMode === 'DYNAMIC_ENGINEER') {
      setFormData(prev => ({ ...prev, pricingMode: 'SIMPLE_AREA' as const }));
    }
  }, [settings?.enableEngineering, formData.pricingMode]);

  const loadProdutos = async () => {
    try {
      const response = await api.get('/api/catalog/products');
      console.log('🔍 Produtos carregados:', response.data.data);
      
      // Debug: verificar se há produtos com componentes
      const produtosComComponentes = response.data.data.filter((p: any) => p.components && p.components.length > 0);
      console.log('📦 Produtos com componentes:', produtosComComponentes.length);
      
      // Debug: mostrar cartões de visita especificamente
      const cartoes = response.data.data.filter((p: any) => p.name.toLowerCase().includes('cartão'));
      console.log('🎴 Cartões encontrados:', cartoes);
      
      setProdutos(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      pricingMode: formData.pricingMode,
      salePrice: formData.salePrice !== '' ? parseFloat(formData.salePrice) : undefined,
      minPrice: formData.minPrice ? parseFloat(formData.minPrice) : undefined,
      markup: parseFloat(formData.markup)
    };
    
    try {
      if (editingProduto) {
        await api.put(`/api/catalog/products/${editingProduto.id}`, payload);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await api.post('/api/catalog/products', payload);
        toast.success('Produto criado com sucesso!');
      }
      
      setShowForm(false);
      setEditingProduto(null);
      resetForm();
      loadProdutos();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar produto');
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduto(produto);
    setFormData({
      name: produto.name,
      description: produto.description || '',
      pricingMode: produto.pricingMode,
      salePrice: produto.salePrice?.toString() || '',
      minPrice: produto.minPrice?.toString() || '',
      markup: produto.markup.toString()
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este produto?')) return;
    
    try {
      await api.delete(`/api/catalog/products/${id}`);
      toast.success('Produto removido com sucesso!');
      loadProdutos();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao remover produto');
    }
  };

  const handleConfigure = (produto: Produto) => {
    setConfiguringProduct(produto);
    setActiveConfigTab('materials');
    setShowConfigModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      pricingMode: 'SIMPLE_AREA',
      salePrice: '',
      minPrice: '',
      markup: '2.0'
    });
  };

  const getPricingModeLabel = (mode: string) => {
    switch (mode) {
      case 'SIMPLE_AREA': return 'Preço por m²';
      case 'SIMPLE_UNIT': return 'Preço por unidade';
      case 'DYNAMIC_ENGINEER': return 'Cálculo dinâmico';
      default: return mode;
    }
  };

  const getPricingModeColor = (mode: string) => {
    switch (mode) {
      case 'SIMPLE_AREA': return 'bg-blue-100 text-blue-600';
      case 'SIMPLE_UNIT': return 'bg-green-100 text-green-600';
      case 'DYNAMIC_ENGINEER': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const filteredProdutos = produtos.filter(produto =>
    produto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie seu catálogo de produtos
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingProduto ? 'Editar Produto' : 'Novo Produto'}
              </CardTitle>
              <CardDescription>
                Configure as informações do produto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Produto *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Adesivo Vinil"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional do produto"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Modo de Precificação *</label>
                  <select
                    value={formData.pricingMode}
                    onChange={(e) => setFormData(prev => ({ ...prev, pricingMode: e.target.value as any }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    required
                  >
                    <option value="SIMPLE_AREA">Preço por m²</option>
                    <option value="SIMPLE_UNIT">Preço por unidade</option>
                    {settings?.enableEngineering && (
                      <option value="DYNAMIC_ENGINEER">Cálculo dinâmico (custo + margem)</option>
                    )}
                  </select>
                  
                  {!settings?.enableEngineering && (
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Para usar cálculo dinâmico, ative o módulo de Engenharia de Produto nas configurações
                    </p>
                  )}
                </div>

                {(formData.pricingMode === 'SIMPLE_AREA' || formData.pricingMode === 'SIMPLE_UNIT') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Preço de Venda (R$) *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.salePrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, salePrice: e.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Preço Mínimo (R$)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.minPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, minPrice: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                {formData.pricingMode === 'DYNAMIC_ENGINEER' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Margem de Lucro (multiplicador) *
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.markup}
                      onChange={(e) => setFormData(prev => ({ ...prev, markup: e.target.value }))}
                      placeholder="2.0"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: 2.0 = 100% de margem sobre o custo
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowForm(false);
                      setEditingProduto(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingProduto ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Produtos List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProdutos.map((produto) => {
          // Debug: log do produto sendo renderizado
          if (produto.name.toLowerCase().includes('cartão')) {
            console.log('🎴 Renderizando cartão:', produto.name, 'Componentes:', produto.components?.length || 0);
          }
          
          return (
          <Card key={produto.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{produto.name}</CardTitle>
                  <CardDescription className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPricingModeColor(produto.pricingMode)}`}>
                      {getPricingModeLabel(produto.pricingMode)}
                    </span>
                    {produto.pricingMode === 'DYNAMIC_ENGINEER' && !settings?.enableEngineering && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-600 rounded text-xs font-medium">
                        ⚠️ DESABILITADO
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleConfigure(produto)}
                    title="Configurar materiais e opções"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(produto)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(produto.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {produto.description && (
                  <p className="text-sm text-muted-foreground">
                    {produto.description}
                  </p>
                )}
                
                <div className="space-y-1">
                  {produto.salePrice && (
                    <p className="text-sm">
                      <span className="font-medium">Preço: </span>
                      {formatCurrency(produto.salePrice)}
                      {produto.pricingMode === 'SIMPLE_AREA' && '/m²'}
                    </p>
                  )}
                  
                  {produto.minPrice && (
                    <p className="text-sm">
                      <span className="font-medium">Mínimo: </span>
                      {formatCurrency(produto.minPrice)}
                    </p>
                  )}
                  
                  {produto.pricingMode === 'DYNAMIC_ENGINEER' && (
                    <p className="text-sm">
                      <span className="font-medium">Margem: </span>
                      {produto.markup}x
                    </p>
                  )}
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">
                      {produto._count.orderItems} venda(s)
                    </p>
                    {produto.components && produto.components.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Package className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">
                          {produto.components.length} material{produto.components.length !== 1 ? 'is' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {produto.components && produto.components.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Materiais configurados:</p>
                      <div className="flex flex-wrap gap-1">
                        {produto.components.slice(0, 3).map((comp) => (
                          <span
                            key={comp.id}
                            className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs"
                          >
                            {comp.material.name}
                          </span>
                        ))}
                        {produto.components.length > 3 && (
                          <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded text-xs">
                            +{produto.components.length - 3} mais
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProdutos.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Tente ajustar sua busca' : 'Comece criando seu primeiro produto'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Produto
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration Modal */}
      {showConfigModal && configuringProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Wrench className="w-5 h-5" />
                    <span>Configurar Produto</span>
                  </CardTitle>
                  <CardDescription>
                    {configuringProduct.name} - {getPricingModeLabel(configuringProduct.pricingMode)}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfigModal(false);
                    setConfiguringProduct(null);
                  }}
                >
                  Fechar
                </Button>
              </div>
              
              {/* Tabs */}
              <div className="flex space-x-1 mt-4">
                <Button
                  variant={activeConfigTab === 'materials' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveConfigTab('materials')}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Materiais
                </Button>
                <Button
                  variant={activeConfigTab === 'configurations' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveConfigTab('configurations')}
                  disabled={configuringProduct.pricingMode !== 'DYNAMIC_ENGINEER'}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {activeConfigTab === 'materials' && (
                <ProductComponentManager
                  productId={configuringProduct.id}
                  productName={configuringProduct.name}
                  pricingMode={configuringProduct.pricingMode}
                />
              )}
              
              {activeConfigTab === 'configurations' && (
                <ProductConfigurationManager
                  productId={configuringProduct.id}
                  productName={configuringProduct.name}
                  pricingMode={configuringProduct.pricingMode}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Produtos;