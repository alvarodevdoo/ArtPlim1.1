import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Package, Settings, Wrench, ShoppingBag, Briefcase, Warehouse } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ProductComponentManager } from '@/components/catalog/ProductComponentManager';
import { ProductConfigurationManager } from '@/components/catalog/ProductConfigurationManager';
import type { PricingFormulaRule } from '@/components/admin/pricing/PricingRuleEditorModal';
import { evaluateFormula } from '@/lib/pricing/formulaUtils';

const LOCAL_FORMULAS_KEY = 'artplim_pricing_rules';


// Fórmulas locais (salvas em Configurações via localStorage)

interface Produto {
  id: string;
  name: string;
  description?: string;
  productType: 'PRODUCT' | 'SERVICE';
  localFormulaId?: string;
  pricingRuleId?: string;
  pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
  salePrice?: number;
  minPrice?: number;
  costPrice?: number;
  markup: number;
  active: boolean;
  // Controle de estoque
  trackStock?: boolean;
  stockQuantity?: number;
  stockMinQuantity?: number;
  stockUnit?: string;
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
  localFormulaId: string;
  pricingRuleId: string;
  pricingMode: 'SIMPLE_UNIT' | 'SIMPLE_AREA' | 'DYNAMIC_ENGINEER';
  salePrice: number;
  minPrice: number;
  markup: number;
  costPrice: number;
  // Valores das variáveis da fórmula (INPUT)
  formulaVarValues: Record<string, number | string>;
  // Estoque
  trackStock: boolean;
  stockQuantity: number;
  stockMinQuantity: number;
  stockUnit: string;
};

const defaultForm: FormData = {
  name: '',
  description: '',
  productType: 'PRODUCT',
  localFormulaId: '',
  pricingRuleId: '',
  pricingMode: 'SIMPLE_AREA',
  salePrice: 0,
  minPrice: 0,
  markup: 2.0,
  costPrice: 0,
  formulaVarValues: {},
  trackStock: false,
  stockQuantity: 0,
  stockMinQuantity: 0,
  stockUnit: 'un',
};

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
  const [localFormulas, setLocalFormulas] = useState<PricingFormulaRule[]>([]);
  const [formData, setFormData] = useState<FormData>(defaultForm);

  useEffect(() => {
    loadProdutos();
    loadLocalFormulas();
  }, []);

  const loadLocalFormulas = () => {
    try {
      const saved = localStorage.getItem(LOCAL_FORMULAS_KEY);
      if (saved) {
        const all: PricingFormulaRule[] = JSON.parse(saved);
        setLocalFormulas(all.filter(r => r.active !== false));
      }
    } catch (e) {
      console.error('Erro ao ler fórmulas locais', e);
    }
  };

  const handleNewProduct = () => {
    setShowForm(true);
  };

  const loadProdutos = async () => {
    try {
      const response = await api.get('/api/catalog/products');
      setProdutos(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();



    const payload: any = {
      name: formData.name,
      description: formData.description || undefined,
      productType: formData.productType,
      localFormulaId: formData.localFormulaId || null,
      pricingRuleId: formData.pricingRuleId || null,
      pricingMode: formData.localFormulaId ? 'SIMPLE_AREA' : formData.pricingMode,
      salePrice: formData.salePrice > 0 ? formData.salePrice : 0,
      minPrice: formData.minPrice > 0 ? formData.minPrice : undefined,
      markup: formData.markup,
      costPrice: formData.costPrice > 0 ? formData.costPrice : undefined,
      formulaData: formData.formulaVarValues || null,
    };

    // Campos de estoque — apenas para produtos
    if (formData.productType === 'PRODUCT') {
      payload.trackStock = formData.trackStock;
      if (formData.trackStock) {
        payload.stockQuantity = formData.stockQuantity;
        payload.stockMinQuantity = formData.stockMinQuantity;
        payload.stockUnit = formData.stockUnit || 'un';
      } else {
        payload.stockQuantity = null;
        payload.stockMinQuantity = null;
        payload.stockUnit = null;
      }
    } else {
      // Serviços não têm estoque
      payload.trackStock = false;
      payload.stockQuantity = null;
      payload.stockMinQuantity = null;
      payload.stockUnit = null;
    }

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
      setFormData(defaultForm);
      loadProdutos();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao salvar produto';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduto(produto);
    // Resgatar valores das variáveis da fórmula associada (se houver)
    const formulaId = produto.localFormulaId || produto.pricingRuleId || '';
    const formula = localFormulas.find(f => f.id === formulaId);
    let initVars: Record<string, number | string> = {};
    
    if (formula) {
      if (produto.formulaData && typeof produto.formulaData === 'object') {
        // Se já temos dados salvos no produto, usamos eles
        initVars = { ...produto.formulaData };
      } else {
        // Caso contrário, inicializamos com os valores padrão da fórmula
        formula.variables.forEach(v => {
          initVars[v.id] = v.type === 'FIXED' ? (v.fixedValue ?? 0) : '';
        });
      }
    }

    setFormData({
      name: produto.name,
      description: produto.description || '',
      productType: produto.productType || 'PRODUCT',
      localFormulaId: produto.localFormulaId || '',
      pricingRuleId: produto.pricingRuleId || '',
      pricingMode: produto.pricingMode,
      salePrice: produto.salePrice || 0,
      minPrice: produto.minPrice || 0,
      markup: produto.markup,
      costPrice: (produto as any).costPrice || 0,
      formulaVarValues: initVars,
      trackStock: produto.trackStock || false,
      stockQuantity: produto.stockQuantity || 0,
      stockMinQuantity: produto.stockMinQuantity || 0,
      stockUnit: produto.stockUnit || 'un',
    });

    // Forçar recálculo imediato após carregar os dados
    setTimeout(() => {
      const formula = localFormulas.find(f => f.id === formulaId);
      if (formula) {
        const scope: Record<string, number> = {};
        formula.variables.forEach(v => {
          if (v.type === 'FIXED') {
            scope[v.id] = v.fixedValue ?? 0;
          } else {
            const raw = String(initVars[v.id] || '').replace(',', '.');
            const num = parseFloat(raw);
            if (isNaN(num)) {
              // Fallback inteligente baseado na unidade para cálculo de referência (1 metro)
              if (v.unit === 'cm') scope[v.id] = 100;
              else if (v.unit === 'mm') scope[v.id] = 1000;
              else scope[v.id] = 1.0;
            } else {
              scope[v.id] = num;
            }
          }
        });
        const result = evaluateFormula(formula.formulaString, scope, formula.variables);
        if (typeof result === 'number' && isFinite(result)) {
          setFormData(prev => ({ ...prev, salePrice: parseFloat(result.toFixed(2)) }));
        }
      }
    }, 50);
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
            Gerencie seu catálogo de produtos e serviços
          </p>
        </div>
        <Button onClick={handleNewProduct}>
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
                Configure as informações do produto ou serviço
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Radio compacto: Produto ou Serviço */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Tipo:</span>
                  <div className="flex rounded-md border border-border overflow-hidden">
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer transition-colors select-none ${
                      formData.productType === 'PRODUCT'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}>
                      <input type="radio" name="productType" value="PRODUCT"
                        checked={formData.productType === 'PRODUCT'}
                        onChange={() => setFormData(prev => ({ ...prev, productType: 'PRODUCT' }))}
                        className="sr-only"
                      />
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Produto
                    </label>
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer transition-colors select-none border-l border-border ${
                      formData.productType === 'SERVICE'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}>
                      <input type="radio" name="productType" value="SERVICE"
                        checked={formData.productType === 'SERVICE'}
                        onChange={() => setFormData(prev => ({ ...prev, productType: 'SERVICE', trackStock: false }))}
                        className="sr-only"
                      />
                      <Briefcase className="w-3.5 h-3.5" />
                      Serviço
                    </label>
                  </div>
                </div>

                {/* Nome */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={formData.productType === 'SERVICE' ? 'Ex: Instalação, Arte Vetorial...' : 'Ex: Adesivo Vinil, Banner...'}
                    required
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional"
                  />
                </div>

                {/* Fórmula de precificação (opcional) — lê do localStorage */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fórmula de Precificação</label>
                  <select
                    value={formData.localFormulaId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      // Zerar os valores de variáveis ao trocar fórmula
                      const next = localFormulas.find(f => f.id === selectedId);
                      const initVars: Record<string, number | string> = {};
                      if (next) {
                        next.variables.forEach(v => {
                          initVars[v.id] = v.type === 'FIXED' ? (v.fixedValue ?? 0) : '';
                        });
                      }
                      setFormData(prev => {
                        const nextState = { ...prev, localFormulaId: selectedId, formulaVarValues: initVars };
                        
                        // Calcular preço inicial com as novas variáveis (vazias tratadas como 1.0)
                        if (next) {
                          const scope: Record<string, number> = {};
                          next.variables.forEach(v => {
                            if (v.type === 'FIXED') {
                              scope[v.id] = v.fixedValue ?? 0;
                            } else {
                              // Fallback inicial para cálculo de referência (1 metro)
                              if (v.unit === 'cm') scope[v.id] = 100;
                              else if (v.unit === 'mm') scope[v.id] = 1000;
                              else scope[v.id] = 1.0;
                            }
                          });
                          const result = evaluateFormula(next.formulaString, scope, next.variables);
                          if (typeof result === 'number' && isFinite(result)) {
                            nextState.salePrice = parseFloat(result.toFixed(2));
                          }
                        }
                        
                        if (!selectedId) {
                          nextState.pricingMode = 'SIMPLE_UNIT';
                        }
                        
                        return nextState;
                      });
                    }}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="">Sem fórmula (preço manual)</option>
                    {localFormulas.map((formula) => (
                      <option key={formula.id} value={formula.id!}>
                        {formula.internalName}
                      </option>
                    ))}
                  </select>
                  {localFormulas.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      💡 Crie fórmulas em <strong>Configurações → Precificação</strong> para cálculo automático
                    </p>
                  )}
                </div>

                {/* Campos editáveis das variáveis da fórmula */}
                {(() => {
                  const selectedFormula = localFormulas.find(f => f.id === formData.localFormulaId);
                  if (!selectedFormula) return null;

                  const inputVars = selectedFormula.variables.filter(v => v.type === 'INPUT');
                  const fixedVars = selectedFormula.variables.filter(v => v.type === 'FIXED');

                  const calculateUpdatedPrice = (currentVars: Record<string, any>) => {
                    const scope: Record<string, number> = {};
                    selectedFormula.variables.forEach(v => {
                      if (v.type === 'FIXED') {
                        scope[v.id] = v.fixedValue ?? 0;
                      } else {
                        const raw = String(currentVars[v.id] || '').replace(',', '.');
                        const num = parseFloat(raw);
                        // Se estiver vazio, usamos fallback de 1 unidade de medida real (ex: 1m, 100cm, 1000mm)
                        if (isNaN(num)) {
                          if (v.unit === 'cm') scope[v.id] = 100;
                          else if (v.unit === 'mm') scope[v.id] = 1000;
                          else scope[v.id] = 1.0;
                        } else {
                          scope[v.id] = num;
                        }
                      }
                    });

                    const result = evaluateFormula(selectedFormula.formulaString, scope, selectedFormula.variables);
                    return typeof result === 'number' && isFinite(result) ? result : formData.salePrice;
                  };

                  const handleVarChange = (varId: string, rawValue: string) => {
                    const updatedVars = { ...formData.formulaVarValues, [varId]: rawValue };
                    const calculatedPrice = calculateUpdatedPrice(updatedVars);

                    setFormData(prev => ({
                      ...prev,
                      formulaVarValues: updatedVars,
                      salePrice: parseFloat(calculatedPrice.toFixed(2))
                    }));
                  };

                  return (
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                          Variáveis da fórmula
                        </p>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground truncate">
                          {selectedFormula.formulaString}
                        </code>
                      </div>

                      {/* Inputs editáveis */}
                      {inputVars.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {inputVars.map(v => (
                            <div key={v.id} className="space-y-1">
                              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                                {v.name}
                                <span className="text-muted-foreground font-normal">({v.unit})</span>
                              </label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={String(formData.formulaVarValues[v.id] ?? '')}
                                onChange={e => handleVarChange(v.id, e.target.value)}
                                placeholder="0"
                                className="h-9 font-mono text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Valores fixos — somente leitura */}
                      {fixedVars.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                          {fixedVars.map(v => (
                            <div key={v.id} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs text-muted-foreground font-mono">
                              <span className="font-semibold text-foreground">{v.name}</span>
                              <span>=</span>
                              <span className="text-emerald-600 font-bold">{v.fixedValue ?? '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Resultado calculado */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                        <span className="text-xs text-muted-foreground">Preço calculado:</span>
                        <span className="text-base font-bold text-primary">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.salePrice)}
                        </span>
                      </div>
                    </div>
                  );
                })()}


                {/* Preços — apenas quando não há fórmula selecionada */}
                {!formData.localFormulaId && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Preço de Venda (R$)</label>
                      <CurrencyInput
                        value={formData.salePrice}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, salePrice: value || 0 }))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Preço Mínimo (R$)</label>
                      <CurrencyInput
                        value={formData.minPrice}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, minPrice: value || 0 }))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Custo (R$)</label>
                      <CurrencyInput
                        value={formData.costPrice}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, costPrice: value || 0 }))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>
                )}


                {/* Controle de estoque — apenas para produtos */}
                {formData.productType === 'PRODUCT' && (
                  <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        id="trackStock"
                        checked={formData.trackStock}
                        onChange={(e) => setFormData(prev => ({ ...prev, trackStock: e.target.checked }))}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                      <div className="flex items-center gap-2">
                        <Warehouse className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Controlar estoque</span>
                      </div>
                    </label>

                    {formData.trackStock && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Quantidade Atual
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.stockQuantity}
                            onChange={(e) => setFormData(prev => ({ ...prev, stockQuantity: parseFloat(e.target.value) || 0 }))}
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Estoque Mínimo
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.stockMinQuantity}
                            onChange={(e) => setFormData(prev => ({ ...prev, stockMinQuantity: parseFloat(e.target.value) || 0 }))}
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Unidade
                          </label>
                          <select
                            value={formData.stockUnit}
                            onChange={(e) => setFormData(prev => ({ ...prev, stockUnit: e.target.value }))}
                            className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm"
                          >
                            <option value="un">un (unidade)</option>
                            <option value="m²">m² (metro quadrado)</option>
                            <option value="m">m (metro linear)</option>
                            <option value="kg">kg (quilograma)</option>
                            <option value="g">g (grama)</option>
                            <option value="l">l (litro)</option>
                            <option value="cx">cx (caixa)</option>
                            <option value="pc">pc (peça)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Markup para modo DYNAMIC_ENGINEER */}
                {formData.pricingMode === 'DYNAMIC_ENGINEER' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Margem de Lucro (multiplicador) *
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.markup}
                      onChange={(e) => setFormData(prev => ({ ...prev, markup: parseFloat(e.target.value) || 2.0 }))}
                      placeholder="2.0"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: 2.0 = 100% de margem sobre o custo
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingProduto(null);
                      setFormData(defaultForm);
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
        {filteredProdutos.map((produto) => (
          <Card key={produto.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {produto.productType === 'SERVICE'
                      ? <Briefcase className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      : <ShoppingBag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    }
                    <CardTitle className="text-lg leading-tight">{produto.name}</CardTitle>
                  </div>
                  <CardDescription className="flex items-center space-x-2 flex-wrap gap-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${produto.productType === 'SERVICE'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                      }`}>
                      {produto.productType === 'SERVICE' ? 'Serviço' : 'Produto'}
                    </span>

                    {(produto.localFormulaId || produto.pricingRuleId) && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium border">
                        {localFormulas.find(f => f.id === (produto.localFormulaId || produto.pricingRuleId))?.internalName || 'Fórmula'}
                      </span>
                    )}

                    {!(produto.localFormulaId || produto.pricingRuleId) && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPricingModeColor(produto.pricingMode)}`}>
                        {getPricingModeLabel(produto.pricingMode)}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex space-x-1 shrink-0 ml-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleConfigure(produto)}
                    title="Configurar materiais e opções"
                    disabled={!settings?.enableEngineering}
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
                  {produto.salePrice !== undefined && (
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(produto.salePrice)}
                    </p>
                  )}

                  {produto.minPrice && (
                    <p className="text-sm">
                      <span className="font-medium">Mínimo: </span>
                      {formatCurrency(produto.minPrice)}
                    </p>
                  )}

                  {produto.costPrice && (
                    <p className="text-sm">
                      <span className="font-medium">Custo: </span>
                      {formatCurrency(produto.costPrice)}
                    </p>
                  )}

                  {produto.pricingMode === 'DYNAMIC_ENGINEER' && (
                    <p className="text-sm">
                      <span className="font-medium">Margem: </span>
                      {produto.markup}x
                    </p>
                  )}

                  {/* Estoque */}
                  {produto.trackStock && produto.productType === 'PRODUCT' && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Warehouse className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Estoque: {produto.stockQuantity ?? 0} {produto.stockUnit || 'un'}
                        {produto.stockMinQuantity != null && (
                          <span className={
                            (produto.stockQuantity ?? 0) <= produto.stockMinQuantity
                              ? ' text-red-500 font-medium'
                              : ''
                          }>
                            {' '}(mín: {produto.stockMinQuantity})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">
                      {produto._count?.orderItems || 0} venda(s)
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
              <Button onClick={handleNewProduct}>
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