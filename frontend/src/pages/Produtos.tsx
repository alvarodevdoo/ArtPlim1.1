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
import { ProductConfigurationManager } from '@/components/catalog/ProductConfigurationManager';
import { ProductFichaTecnicaManager } from '@/components/catalog/ProductFichaTecnicaManager';
import { calculatePricingResult } from '@/lib/pricing/formulaUtils';
import { getProductDisplayInfo } from '@/lib/pricing/displayUtils';
import { InsumoMaterialSelecionado } from '@/features/insumos/types';
import { useInsumos } from '@/features/insumos/useInsumos';

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

type FormData = {
  name: string;
  description: string;
  productType: 'PRODUCT' | 'SERVICE';
  pricingRuleId: string;
  pricingMode: 'SIMPLE_UNIT' | 'SIMPLE_AREA' | 'DYNAMIC_ENGINEER';
  salePrice: number;
  costPrice: number;
  formulaVarValues: Record<string, any>;
  trackStock: boolean;
  stockQuantity: number;
  stockMinQuantity: number;
  stockUnit: string;
  sellWithoutStock: boolean;
  categoryId?: string;
};

const defaultForm: FormData = {
  name: '',
  description: '',
  productType: 'PRODUCT',
  pricingRuleId: '',
  pricingMode: 'SIMPLE_AREA',
  salePrice: 0,
  costPrice: 0,
  formulaVarValues: {},
  trackStock: false,
  stockQuantity: 0,
  stockMinQuantity: 0,
  stockUnit: 'un',
  sellWithoutStock: true,
  categoryId: '',
};

const Produtos: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [globalRules, setGlobalRules] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  useInsumos();
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<'geral' | 'pricing' | 'materials' | 'configurations'>('geral');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [fichaBase, setFichaBase] = useState<InsumoMaterialSelecionado[]>([]);
  
  useEffect(() => {
    loadProdutos();
    loadGlobalRules();
    loadCategories();
  }, []);

  const refreshFichaTecnica = async (id: string) => {
    try {
      const ftResp = await api.get(`/api/catalog/products/${id}/ficha-tecnica`);
      if (ftResp.data.success) {
        const items = ftResp.data.data.map((item: any) => ({
          insumoId: item.insumoId,
          nome: item.material?.name || item.insumo?.nome || '',
          precoBase: Number(item.material?.costPerUnit ?? item.insumo?.custoUnitario ?? 0),
          quantidadeUtilizada: Number(item.quantidade),
          unidadeBase: item.material?.unit || item.insumo?.unidadeBase || 'un',
          linkedVariable: item.linkedVariable || undefined,
          linkedQuantityVariable: item.linkedQuantityVariable || undefined
        }));
        setFichaBase(items);
      }
    } catch (err) {
      console.error("Erro ao recarregar ficha técnica:", err);
      setFichaBase([]);
    }
  };

  const formulaObj = useMemo(() => {
    if (formData.pricingRuleId) {
      const rule = globalRules.find(r => r.id === formData.pricingRuleId);
      if (rule) {
        try {
          return typeof rule.formula === 'string' ? JSON.parse(rule.formula) : rule.formula;
        } catch (e) {
          console.error("Erro ao processar JSON da fórmula:", e);
          return null;
        }
      }
    }
    return null;
  }, [formData.pricingRuleId, globalRules]);

  const calculatedPrices = useMemo(() => {
    const activeValues: Record<string, any> = { QTDE: 1, QUANTIDADE: 1 };
    const evaluationLogs: string[] = [];
    
    if (formulaObj?.variables) {
      formulaObj.variables.forEach((v: any) => {
        activeValues[v.id.toUpperCase()] = v.fixedValue || (formulaObj.referenceValues?.[v.id] ?? 0);
      });
    }

    if (formData.formulaVarValues) {
      Object.keys(formData.formulaVarValues).forEach(k => {
        const val = formData.formulaVarValues[k];
        if (val !== '' && val !== null && val !== undefined) {
          activeValues[k.toUpperCase()] = val;
        }
      });
    }

    // 2. Execução da Fórmula de Venda (A primeira chamada unifica a normalização para todo o bloco)
    const ruleVars = formulaObj?.variables || [];
    const resultSale = calculatePricingResult(formulaObj?.formulaString || '0', ruleVars, activeValues, evaluationLogs);
    const normalizedScope = resultSale.scope;

    // 3. Cálculo de Medidas Físicas Auxiliares para o BOM (Ficha Técnica)
    const widthMm = Number(normalizedScope['LARGURA'] || normalizedScope['WIDTH'] || 0);
    const heightMm = Number(normalizedScope['ALTURA'] || normalizedScope['HEIGHT'] || 0);
    
    let areaM2 = 0;
    let linearM = 0;

    if (widthMm > 0 && heightMm > 0) {
      areaM2 = (widthMm * heightMm) / 1000000;
      linearM = (widthMm + heightMm) * 2 / 1000;
    } else if (widthMm > 0 || heightMm > 0) {
      linearM = (widthMm || heightMm) / 1000;
    }

    // Injeta variáveis mágicas de auxílio (usadas na Ficha Técnica)
    normalizedScope['AREA_M2'] = areaM2 || (Number(normalizedScope['AREA_M2']) || 0);
    normalizedScope['LINEAR_M'] = linearM || (Number(normalizedScope['LINEAR_M']) || 0);
    normalizedScope['LARGURA_MM'] = widthMm;
    normalizedScope['ALTURA_MM'] = heightMm;

    // 4. Execução da Fórmula de Custo Base
    const resultCost = calculatePricingResult(formulaObj?.costFormulaString || '0', ruleVars, normalizedScope);
    
    // 5. Integração com Custo da Ficha Técnica (BOM)
    const bomLogs: string[] = [];
    const costBOM = fichaBase.reduce((acc, item) => {
      let qtd = item.quantidadeUtilizada;
      const unit = (item.unidadeBase || '').toLowerCase().trim();
      const unitLabel = item.unidadeBase || 'un';
      
      let method = 'MANUAL';
      if (item.linkedVariable) {
        const varVal = Number(normalizedScope[item.linkedVariable.toUpperCase()]);
        if (!isNaN(varVal) && varVal > 0) {
          qtd = varVal;
          method = `LINK: ${item.linkedVariable}`;
        }
      } else if (unit === 'm2' || unit === 'm²') {
        if (areaM2 > 0) {
          qtd = areaM2;
          method = 'AUTO: ÁREA';
        }
      } else if (unit === 'm' || unit === 'ml' || unit === 'linearm') {
        if (linearM > 0) {
          qtd = linearM;
          method = 'AUTO: LINEAR';
        }
      }

      const itemCost = qtd * item.precoBase;
      bomLogs.push(`${item.nome}: ${qtd.toFixed(2)}${unitLabel} (${method}) = R$ ${itemCost.toFixed(2)}`);
      return acc + itemCost;
    }, 0);
    
    const sale = resultSale.value;
    const cost = resultCost.value + costBOM;

    if (bomLogs.length > 0) {
      evaluationLogs.push("--- Materiais (BOM) ---");
      evaluationLogs.push(...bomLogs);
    }
    evaluationLogs.push(`Custo Final: R$ ${cost.toFixed(2)}`);

    return { sale, cost, activeValues: normalizedScope, logs: evaluationLogs };
  }, [formData.formulaVarValues, formulaObj, fichaBase]);

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

  const loadGlobalRules = async () => {
    try {
      const response = await api.get('/api/catalog/pricing-rules?active=true');
      setGlobalRules(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/finance/categories');
      setCategories(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const resetForm = () => {
    setFormData(defaultForm);
    setFichaBase([]);
    setEditingId(null);
  };

  const handleNewProduct = () => {
    resetForm();
    setIsEditorOpen(true);
    setActiveEditorTab('geral');
  };

  const handleEdit = async (produto: Produto) => {
    setEditingId(produto.id);
    setIsEditorOpen(true);
    setActiveEditorTab('geral');

    // Carrega a ficha técnica imediatamente
    refreshFichaTecnica(produto.id);

    let initVars: Record<string, any> = {};
    const formulaDataRaw = produto.formulaData;
    if (formulaDataRaw) {
      initVars = typeof formulaDataRaw === 'string' ? JSON.parse(formulaDataRaw) : formulaDataRaw;
    }

    setFormData({
      name: produto.name,
      description: produto.description || '',
      productType: produto.productType || 'PRODUCT',
      pricingRuleId: produto.pricingRuleId || '',
      pricingMode: produto.pricingMode,
      salePrice: produto.salePrice || 0,
      costPrice: (produto as any).costPrice || 0,
      formulaVarValues: initVars,
      trackStock: produto.trackStock || false,
      stockQuantity: produto.stockQuantity || 0,
      stockMinQuantity: produto.stockMinQuantity || 0,
      stockUnit: produto.stockUnit || 'un',
      sellWithoutStock: produto.sellWithoutStock ?? true,
      categoryId: (produto as any).categoryId || '',
    });
  };

  const handleConfigure = async (produto: Produto) => {
    await handleEdit(produto);
    setActiveEditorTab('materials');
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const payload: any = {
      name: formData.name,
      description: formData.description,
      productType: formData.productType,
      pricingRuleId: formData.pricingRuleId || null,
      pricingMode: formData.pricingMode,
      formulaData: formData.formulaVarValues,
      salePrice: calculatedPrices.sale,
      costPrice: calculatedPrices.cost,
      categoryId: formData.categoryId || null,
      active: true
    };

    if (formData.productType === 'PRODUCT') {
      payload.trackStock = formData.trackStock;
      if (formData.trackStock) {
        payload.stockQuantity = formData.stockQuantity;
        payload.stockMinQuantity = formData.stockMinQuantity;
        payload.stockUnit = formData.stockUnit || 'un';
        payload.sellWithoutStock = formData.sellWithoutStock;
      }
    }

    try {
      if (editingId) {
        await api.put(`/api/catalog/products/${editingId}`, payload);
        toast.success('Produto atualizado!');
      } else {
        await api.post('/api/catalog/products', payload);
        toast.success('Produto criado!');
      }
      setIsEditorOpen(false);
      resetForm();
      loadProdutos();
    } catch (error: any) {
      toast.error('Erro ao salvar produto');
    }
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

  const filteredProdutos = useMemo(() => {
    return produtos.filter(produto =>
      produto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, produtos]);

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
                    <Button size="icon" variant="ghost" onClick={() => handleConfigure(produto)} title="Materiais"><Wrench className="w-4 h-4 text-slate-500" /></Button>
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
        <div className="modal-overlay">
          <Card className={cn("modal-content-card max-w-6xl", activeEditorTab === 'materials' && "max-w-7xl")}>

            <CardHeader className="border-b bg-slate-50/50 pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    {editingId ? <Edit className="w-6 h-6 text-primary" /> : <Plus className="w-6 h-6 text-primary" />}
                    {editingId ? 'Editar Produto' : 'Novo Produto'}
                  </CardTitle>
                  <CardDescription className="text-slate-500 font-medium font-sans">
                    {formData.name || 'Sem nome'} — {getPricingModeLabel(formData.pricingMode)}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsEditorOpen(false)} className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
                  <Plus className="w-5 h-5 rotate-45" />
                  <span className="sr-only">Fechar</span>
                </Button>
              </div>

              <div className="flex gap-1 mt-6 bg-slate-100 p-1 rounded-lg w-fit border shadow-sm">
                <Button 
                  variant={activeEditorTab === 'geral' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setActiveEditorTab('geral')}
                  className={`rounded-md px-6 font-bold transition-all ${activeEditorTab === 'geral' ? 'shadow-md' : 'text-slate-600 hover:text-primary'}`}
                >
                  <Package className="w-4 h-4 mr-2" /> Dados Gerais
                </Button>
                <Button 
                  variant={activeEditorTab === 'pricing' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setActiveEditorTab('pricing')}
                  className={`rounded-md px-6 font-bold transition-all ${activeEditorTab === 'pricing' ? 'shadow-md' : 'text-slate-600 hover:text-primary'}`}
                >
                   <Calculator className="w-4 h-4 mr-2" /> Precificação
                </Button>
                <Button 
                  variant={activeEditorTab === 'materials' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setActiveEditorTab('materials')}
                  className={`rounded-md px-6 font-bold transition-all ${activeEditorTab === 'materials' ? 'shadow-md' : 'text-slate-600 hover:text-primary'}`}
                  disabled={!editingId}
                >
                   <Wrench className="w-4 h-4 mr-2" /> Ficha Técnica
                </Button>
                <Button 
                  variant={activeEditorTab === 'configurations' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setActiveEditorTab('configurations')}
                  className={`rounded-md px-6 font-bold transition-all ${activeEditorTab === 'configurations' ? 'shadow-md' : 'text-slate-600 hover:text-primary'}`}
                  disabled={!editingId || formData.pricingMode !== 'DYNAMIC_ENGINEER'}
                >
                   <Settings className="w-4 h-4 mr-2" /> Opções / Variações
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-0 bg-white">
              <div className="flex flex-col min-h-full">
                <div className="p-8 space-y-8">
                  {activeEditorTab === 'geral' && (
                    <div className="max-w-4xl space-y-8 animate-in slide-in-from-left-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Cadastro</label>
                            <div className="flex rounded-lg border p-1 bg-slate-50">
                              <button type="button" onClick={() => setFormData(prev => ({ ...prev, productType: 'PRODUCT' }))}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${formData.productType === 'PRODUCT' ? 'bg-white shadow-sm text-primary border' : 'text-slate-500 hover:text-slate-700'}`}>
                                <ShoppingBag className="w-4 h-4" /> Produto
                              </button>
                              <button type="button" onClick={() => setFormData(prev => ({ ...prev, productType: 'SERVICE', trackStock: false }))}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${formData.productType === 'SERVICE' ? 'bg-white shadow-sm text-primary border' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Briefcase className="w-4 h-4" /> Serviço
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome do Item *</label>
                            <Input
                              value={formData.name}
                              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Título visual do produto ou serviço"
                              className="h-11 font-medium"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição Detalhada</label>
                            <textarea
                              value={formData.description}
                              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Opcional: Detalhes extras para o catálogo"
                              className="w-full min-h-[100px] p-3 rounded-md border text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            />
                            <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria Financeira</label>
                            <select
                              value={formData.categoryId}
                              onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                              className="w-full h-11 px-3 border rounded-md text-sm font-medium bg-white"
                            >
                              <option value="">Nenhuma categoria</option>
                              {categories
                                .filter(cat => cat.type === 'INCOME')
                                .map(cat => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-muted-foreground">Classifica vendas deste item automaticamente no DRE/Fluxo.</p>
                          </div>
                        </div>
                        </div>
                        <div className="space-y-6">
                          {formData.productType === 'PRODUCT' ? (
                            <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                  <Warehouse className="w-4 h-4 text-blue-500" /> Controle de Inventário
                                </h4>
                                <div onClick={() => setFormData(prev => ({ ...prev, trackStock: !prev.trackStock }))}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors ${formData.trackStock ? 'bg-primary' : 'bg-slate-300'}`}>
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.trackStock ? 'translate-x-6' : 'translate-x-1'}`} />
                                </div>
                              </div>
                              {formData.trackStock && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd. Atual</label>
                                      <Input
                                        type="number"
                                        value={formData.stockQuantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, stockQuantity: parseFloat(e.target.value) || 0 }))}
                                        className="h-10 font-bold"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Qtd. Mínima</label>
                                      <Input
                                        type="number"
                                        value={formData.stockMinQuantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, stockMinQuantity: parseFloat(e.target.value) || 0 }))}
                                        className="h-10 font-bold"
                                      />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Unidade de Medida</label>
                                      <select
                                        value={formData.stockUnit}
                                        onChange={(e) => setFormData(prev => ({ ...prev, stockUnit: e.target.value }))}
                                        className="w-full h-10 px-3 border rounded-md text-sm font-medium bg-white"
                                      >
                                        <option value="un">Unidade (un)</option>
                                        <option value="m²">Metro Quadrado (m²)</option>
                                        <option value="m">Metro Linear (m)</option>
                                        <option value="kg">Quilograma (kg)</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="pt-4 border-t border-slate-200">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                      <span className="text-xs font-bold text-slate-600">Venda sem estoque?</span>
                                      <div onClick={() => setFormData(prev => ({ ...prev, sellWithoutStock: !prev.sellWithoutStock }))}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.sellWithoutStock ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${formData.sellWithoutStock ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                      </div>
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center p-8 border border-dashed rounded-xl bg-slate-50 text-center opacity-60">
                              <Info className="w-8 h-8 text-slate-400 mb-2" />
                              <p className="text-sm font-medium text-slate-500">Serviços não possuem controle de estoque físico.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeEditorTab === 'pricing' && (
                    <div className="max-w-4xl space-y-8 animate-in slide-in-from-left-2 duration-300">
                      <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Calculator className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">Modelo de Precificação</h4>
                            <p className="text-xs text-slate-500">Escolha como o sistema deve calcular o preço deste item</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Regra do Catálogo</label>
                            <select
                              value={formData.pricingRuleId}
                              onChange={(e) => {
                                const newRuleId = e.target.value;
                                const rule = globalRules.find(r => r.id === newRuleId);
                                let autoMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER' = 'SIMPLE_AREA'; // default fallback
                                
                                if (rule && rule.formula?.pricingMode) {
                                  autoMode = rule.formula.pricingMode as 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
                                }

                                setFormData(prev => ({ 
                                  ...prev, 
                                  pricingRuleId: newRuleId,
                                  pricingMode: autoMode
                                }));
                              }}
                              className="w-full h-11 px-4 border-2 border-indigo-200 rounded-lg text-sm font-bold bg-white focus:border-primary focus:ring-0 transition-all shadow-sm"
                              required
                            >
                              <option value="" disabled>Selecione uma regra...</option>
                              {globalRules.map((rule) => (
                                <option key={rule.id} value={rule.id}>{rule.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {formulaObj && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                           <div className="flex items-center justify-between border-b pb-2">
                             <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Configuração das Variáveis</h4>
                             <code className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono italic">
                                Ref: {formulaObj.formulaString}
                             </code>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             {(formulaObj.variables || []).filter((v: any) => v.type === 'INPUT').map((v: any) => {
                               const isLocked = formData.formulaVarValues[`${v.id}_locked`] === true;
                               return (
                                 <div key={v.id} className="space-y-2 group">
                                   <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-slate-700">{v.name}</label>
                                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, formulaVarValues: { ...prev.formulaVarValues, [`${v.id}_locked`]: !isLocked } }))}
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${isLocked ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-400 border border-transparent opacity-40 group-hover:opacity-100'}`}>
                                        {isLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                                        {isLocked ? 'TRAVADO' : 'ABERTO'}
                                      </button>
                                   </div>
                                   <div className="flex">
                                     <Input type="text" inputMode="decimal" value={String(formData.formulaVarValues[v.id] ?? '')}
                                       onChange={e => setFormData(prev => ({ ...prev, formulaVarValues: { ...prev.formulaVarValues, [v.id]: e.target.value } }))}
                                       className={`rounded-r-none h-10 font-bold border-r-0 focus:z-10 ${isLocked ? 'bg-amber-50/50' : ''}`} placeholder="0" />
                                     
                                     {v.allowedUnits && v.allowedUnits.length > 0 ? (
                                       <select
                                         value={formData.formulaVarValues[`${v.id}_unit`] || v.defaultUnit || v.unit || ''}
                                         onChange={e => setFormData(prev => ({ 
                                           ...prev, 
                                           formulaVarValues: { ...prev.formulaVarValues, [`${v.id}_unit`]: e.target.value } 
                                         }))}
                                         className="h-10 px-2 bg-slate-100 border text-[10px] font-black text-slate-500 rounded-r-md min-w-[50px] outline-none hover:bg-slate-200 transition-colors uppercase cursor-pointer"
                                       >
                                         {v.allowedUnits.map((u: string) => (
                                           <option key={u} value={u}>{u}</option>
                                         ))}
                                       </select>
                                     ) : (
                                       <div className="h-10 px-3 bg-slate-100 border flex items-center text-[10px] font-black text-slate-500 rounded-r-md min-w-[50px] justify-center uppercase">
                                         {v.unit || '—'}
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                           <div className="mt-8 bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 border-4 border-slate-800">
                             <div className="flex items-center gap-6">
                               <div className="text-center p-3 border-r border-slate-700 pr-8">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Base</p>
                                 <p className="text-2xl font-bold text-orange-400">
                                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedPrices.cost)}
                                 </p>
                               </div>
                               <div className="text-center">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Venda Simulada</p>
                                 <p className="text-4xl font-black text-emerald-400">
                                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedPrices.sale)}
                                 </p>
                               </div>
                             </div>
                             <div className="bg-slate-800/50 p-4 rounded-xl max-w-sm border border-slate-700 text-[10px] space-y-1 font-mono text-slate-400 overflow-y-auto max-h-24 min-w-[250px]">
                               <div className="flex items-center gap-1 text-slate-300 font-bold mb-1 uppercase tracking-tighter">
                                 <Info className="w-3 h-3 text-emerald-400" /> Diagnóstico Engine
                                </div>
                                {calculatedPrices.logs && calculatedPrices.logs.length > 0 ? (
                                  calculatedPrices.logs.map((log, i) => <div key={i} className="whitespace-nowrap">{log}</div>)
                                ) : (
                                  <div className="opacity-50 italic">Calculando...</div>
                                )}
                              </div>
                           </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeEditorTab === 'materials' && editingId && (
                    <div className="animate-in slide-in-from-left-2 duration-300 p-4">
                      <ProductFichaTecnicaManager 
                        productId={editingId}
                        productName={formData.name}
                        pricingMode={formData.pricingMode}
                        availableVariables={Object.keys(calculatedPrices.activeValues || {}).filter(k => typeof calculatedPrices.activeValues[k] === 'number')}
                        onUpdate={() => refreshFichaTecnica(editingId)}
                      />
                    </div>
                  )}

                  {activeEditorTab === 'configurations' && editingId && (
                    <div className="animate-in slide-in-from-left-2 duration-300 p-4">
                      <ProductConfigurationManager 
                        productId={editingId}
                        productName={formData.name}
                        pricingMode={formData.pricingMode}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-auto p-6 border-t bg-slate-50 flex justify-end items-center gap-4 sticky bottom-0">
                  <Button type="button" variant="ghost" className="font-bold text-slate-500" onClick={() => setIsEditorOpen(false)}>Cancelar</Button>
                  <Button type="button" size="lg" className="px-12 font-black shadow-lg shadow-primary/20" onClick={handleSubmit}>
                    {editingId ? 'SALVAR ALTERAÇÕES' : 'CRIAR PRODUTO'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default Produtos;