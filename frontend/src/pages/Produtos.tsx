import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { 
  Plus, Search, Edit, Trash2, Package, Settings, Wrench, Lock, Unlock, 
  ShoppingBag, Briefcase, Warehouse, Calculator, Info
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getProductDisplayInfo } from '@/lib/pricing/displayUtils';
import { InsumoMaterialSelecionado } from '@/features/insumos/types';
import { useInsumos } from '@/features/insumos/useInsumos';
import { ProductModalContainer } from '@/features/catalog/components/ProductModal/ProductModalContainer';

interface Produto {
  id: string;
  name: string;
  description?: string;
  productType: 'PRODUCT' | 'SERVICE';
  localFormulaId?: string;
  pricingRuleId?: string;
  pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
  salePrice: number;
  costPrice: number;
  active: boolean;
  trackStock?: boolean;
  stockQuantity?: number;
  stockMinQuantity?: number;
  stockUnit?: string;
  sellWithoutStock?: boolean;
  formulaData?: any;
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
  _count?: {
    orderItems: number;
  };
}

const Produtos: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  useInsumos();
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/catalog/products');
      setProdutos(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleNewProduct = () => {
    setEditingId(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (produto: Produto) => {
    setEditingId(produto.id);
    setIsEditorOpen(true);
  };

  const handleConfigure = (produto: Produto) => {
    setEditingId(produto.id);
    setIsEditorOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este produto?')) return;
    try {
      await api.delete(`/api/catalog/products/${id}`);
      toast.success('Produto removido!');
      loadProdutos();
    } catch (error: any) {
      toast.error('Erro ao remover produto');
    }
  };

  const filteredProdutos = useMemo(() => {
    return produtos.filter(produto =>
      produto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, produtos]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Catálogo de Produtos</h1>
            <p className="text-muted-foreground">Gerencie seus produtos, serviços e regras de precificação.</p>
          </div>
          <Button onClick={handleNewProduct}>
            <Plus className="w-4 h-4 mr-2" /> Novo Produto
          </Button>
        </div>

        <div className="flex items-center space-x-4 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProdutos.map((produto) => (
            <Card key={produto.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {produto.productType === 'SERVICE' ? <Briefcase className="w-3.5 h-3.5 text-amber-500" /> : <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />}
                      <CardTitle className="text-lg leading-tight truncate">{produto.name}</CardTitle>
                    </div>
                    <CardDescription className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${produto.productType === 'SERVICE' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {produto.productType === 'SERVICE' ? 'Serviço' : 'Produto'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getPricingModeColor(produto.pricingMode)}`}>
                        {getPricingModeLabel(produto.pricingMode)}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleConfigure(produto)} title="Configurar"><Wrench className="w-4 h-4 text-slate-500" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(produto)} title="Editar"><Edit className="w-4 h-4 text-slate-500" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(produto.id)} title="Excluir"><Trash2 className="w-4 h-4 text-slate-400" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {produto.description && <p className="text-xs text-muted-foreground line-clamp-2">{produto.description}</p>}
                  
                  {(() => {
                    const info = getProductDisplayInfo(produto);
                    return (
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1.5">
                          {info.isStarting && <span className="text-[10px] font-bold text-slate-400 uppercase">A partir de</span>}
                          <p className="text-xl font-bold text-primary">{info.price}</p>
                        </div>
                        {info.cost && <p className="text-[10px] font-medium text-slate-400 italic">Custo: {info.cost}</p>}
                      </div>
                    );
                  })()}

                  {produto.trackStock && (
                    <div className="flex items-center gap-1.5 pt-2 border-t text-[10px] font-bold text-slate-500">
                      <Warehouse className="w-3 h-3" />
                      Estoque: {produto.stockQuantity} {produto.stockUnit}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProdutos.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-slate-50/50">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-600">Nenhum item encontrado</h3>
            <p className="text-slate-400 text-sm">{searchTerm ? 'Tente outros termos de busca' : 'Acesse o botão "Novo Produto" para começar'}</p>
          </div>
        )}
      </div>

      {isEditorOpen && (
        <ProductModalContainer 
          productId={editingId || undefined} 
          onClose={() => setIsEditorOpen(false)}
          onSave={loadProdutos}
        />
      )}
    </>
  );
};

export default Produtos;