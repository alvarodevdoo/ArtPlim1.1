import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Package, Settings, Wrench, Lock, Unlock, ShoppingBag, Briefcase, Warehouse } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ProductComponentManager } from '@/components/catalog/ProductComponentManager';
import { ProductConfigurationManager } from '@/components/catalog/ProductConfigurationManager';
import { evaluateFormula, validateFormulaSyntax, calculatePricingResult } from '@/lib/pricing/formulaUtils';
import { SeletorInsumos } from '@/features/insumos/SeletorInsumos';
import { useInsumos } from '@/features/insumos/useInsumos';
import { InsumoMaterialSelecionado } from '@/features/insumos/types';
import type { PricingFormulaRule } from '@/components/admin/pricing/PricingRuleEditorModal';

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
  salePrice: number;
  costPrice: number;
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
  costPrice: number;
  // Valores das variáveis da fórmula (INPUT)
  formulaVarValues: Record<string, number | string | boolean>;
  // Híbrido: Global vs Custom
  pricingSource: 'GLOBAL' | 'CUSTOM';
  customFormula: string;
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
  pricingSource: 'GLOBAL',
  customFormula: '',
  pricingMode: 'SIMPLE_AREA',
  salePrice: 0,
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
  const [globalRules, setGlobalRules] = useState<any[]>([]);
  const { insumos } = useInsumos();
  const [fichaBase, setFichaBase] = useState<InsumoMaterialSelecionado[]>([]);
  const [formData, setFormData] = useState<FormData>(defaultForm);

  useEffect(() => {
    loadProdutos();
    loadLocalFormulas();
    loadGlobalRules();
  }, []);

  const formulaObj = useMemo(() => {
    if (formData.pricingSource === 'GLOBAL' && formData.pricingRuleId) {
      const rule = globalRules.find(r => r.id === formData.pricingRuleId);
      if (rule) return typeof rule.formula === 'string' ? JSON.parse(rule.formula) : rule.formula;
    } else if (formData.pricingSource !== 'CUSTOM' && formData.localFormulaId) {
      return localFormulas.find(f => f.id === formData.localFormulaId);
    } else if (formData.pricingSource === 'CUSTOM' && formData.customFormula) {
      return { formulaString: formData.customFormula, variables: [] };
    }
    return null;
  }, [formData.pricingSource, formData.pricingRuleId, formData.localFormulaId, formData.customFormula, globalRules, localFormulas]);

  const calculatedPrices = useMemo(() => {
    const sale = calculatePricingResult(formulaObj?.formulaString, formulaObj?.variables, formData.formulaVarValues);
    const cost = calculatePricingResult(formulaObj?.costFormulaString, formulaObj?.variables, formData.formulaVarValues);

    return { sale: sale.value, cost: cost.value };
  }, [formulaObj, formData.formulaVarValues, formData.salePrice, formData.costPrice]);

  const loadGlobalRules = async () => {
    try {
      const resp = await api.get('/api/catalog/pricing-rules');
      setGlobalRules(resp.data.data);
    } catch (error) {
      console.error('Erro ao carregar regras globais', error);
    }
  };

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
      setLoading(true);
      const response = await api.get(`/api/catalog/products?_t=${Date.now()}`);
      // Normalizar campos Decimal (que vêm como string ou null) para number
      const normalizedData = (response.data.data || []).map((p: any) => ({
        ...p,
        salePrice: p.salePrice ? Number(p.salePrice) : 0,
        costPrice: p.costPrice ? Number(p.costPrice) : 0
      }));
      setProdutos(normalizedData);
    } catch (error) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação de sintaxe MathJS se for fórmula customizada
    if (formData.pricingSource === 'CUSTOM' && formData.customFormula) {
      try {
        // Mock CUSTO_MATERIAIS para validação
        const scope = { CUSTO_MATERIAIS: 1 };
        // Testar se mathjs consegue dar parse/evaluate
        const validation = validateFormulaSyntax(formData.customFormula);
        if (validation !== true) {
          toast.error(`Erro de sintaxe na fórmula: ${validation}`);
          return;
        }

        // Testar execução simples
        evaluateFormula(formData.customFormula, scope);
      } catch (err: any) {
        toast.error(`Fórmula inválida: ${err.message}`);
        return;
      }
    }

    const payload: any = {
      name: formData.name,
      description: formData.description || undefined,
      productType: formData.productType,
      localFormulaId: formData.localFormulaId || null,
      pricingRuleId: (formData.pricingSource === 'GLOBAL' && formData.pricingRuleId) ? formData.pricingRuleId : null,
      customFormula: formData.pricingSource === 'CUSTOM' ? (formData.customFormula || null) : null,
      pricingMode: (formData.localFormulaId || formData.pricingRuleId || formData.customFormula) ? 'DYNAMIC_ENGINEER' : formData.pricingMode,
      salePrice: formulaObj ? calculatedPrices.sale : (formData.salePrice > 0 ? formData.salePrice : 0),
      costPrice: formulaObj ? calculatedPrices.cost : (formData.costPrice > 0 ? formData.costPrice : undefined),
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
      let productId = editingProduto?.id;

      if (editingProduto) {
        await api.put(`/api/catalog/products/${editingProduto.id}`, payload);
        toast.success('Produto atualizado com sucesso!');
      } else {
        const resp = await api.post('/api/catalog/products', payload);
        productId = resp.data.data.id;
        toast.success('Produto criado com sucesso!');
      }

      // Salvar Ficha Técnica Base se houver itens ou se o produto foi editado (limpar se estiver vazio)
      if (productId) {
        await api.post(`/api/catalog/products/${productId}/ficha-tecnica`, {
          items: fichaBase.map(i => ({
            insumoId: i.insumoId,
            quantidade: i.quantidadeUtilizada
          }))
        });
      }

      setShowForm(false);
      setEditingProduto(null);
      setFormData(defaultForm);
      setFichaBase([]);
      loadProdutos();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao salvar produto';
      toast.error(errorMessage);
    }
  };

  const handleEdit = async (produto: Produto) => {
    setEditingProduto(produto);

    // Buscar Ficha Técnica Base do backend
    try {
      const ftResp = await api.get(`/api/catalog/products/${produto.id}/ficha-tecnica`);
      if (ftResp.data.success) {
        const items = ftResp.data.data.map((item: any) => ({
          insumoId: item.insumoId,
          nome: item.insumo.nome,
          precoBase: Number(item.insumo.custoUnitario),
          quantidadeUtilizada: Number(item.quantidade),
          unidadeBase: item.insumo.unidadeBase
        }));
        setFichaBase(items);
      }
    } catch (err) {
      console.error('Erro ao carregar ficha técnica:', err);
      setFichaBase([]);
    }

    // Resgatar valores das variáveis da fórmula associada (se houver)
    let formulaObj = null;

    if (produto.pricingRuleId) {
      const rule = globalRules.find(r => r.id === produto.pricingRuleId);
      if (rule) {
        formulaObj = typeof rule.formula === 'string' ? JSON.parse(rule.formula) : rule.formula;
      }
    } else if (produto.localFormulaId) {
      formulaObj = localFormulas.find(f => f.id === produto.localFormulaId);
    }

    let initVars: Record<string, number | string> = {};

    if (formulaObj) {
      if (produto.formulaData && typeof produto.formulaData === 'object') {
        // Se já temos dados salvos no produto, usamos eles
        initVars = { ...produto.formulaData };
      }

      // Garantir que todas as variáveis da fórmula tenham um valor/unidade inicial se faltarem
      if (formulaObj.variables) {
        formulaObj.variables.forEach((v: any) => {
          if (v.type === 'FIXED') {
            if (initVars[v.id] === undefined) initVars[v.id] = v.fixedValue ?? 0;
          } else {
            if (initVars[v.id] === undefined) initVars[v.id] = '';
            // Inicializar unidade se não existir
            if (!initVars[`${v.id}_unit`]) {
              initVars[`${v.id}_unit`] = v.defaultUnit || v.unit || 'm';
            }
          }
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
      costPrice: (produto as any).costPrice || 0,
      formulaVarValues: initVars,
      pricingSource: produto.pricingRuleId ? 'GLOBAL' : (produto as any).customFormula ? 'CUSTOM' : 'GLOBAL',
      customFormula: (produto as any).customFormula || '',
      trackStock: produto.trackStock || false,
      stockQuantity: produto.stockQuantity || 0,
      stockMinQuantity: produto.stockMinQuantity || 0,
      stockUnit: produto.stockUnit || 'un',
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
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer transition-colors select-none ${formData.productType === 'PRODUCT'
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
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer transition-colors select-none border-l border-border ${formData.productType === 'SERVICE'
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
                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional"
                  />
                </div>

                {/* FICHA TÉCNICA BASE */}
                <div className="space-y-4 pt-2 border-t border-border">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Ficha Técnica (Insumos Base)
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <SeletorInsumos
                      insumos={insumos}
                      materiaisIniciais={fichaBase}
                      onMaterialsChange={(mats) => setFichaBase(mats)}
                    />
                    <p className="text-[10px] text-slate-500 mt-2 italic">
                      Estes insumos serão somados ao custo de qualquer pedido deste produto (ex: embalagem, setup fixo).
                    </p>
                  </div>
                </div>

                {/* PREÇO E ESTOQUE (HÍBRIDO) */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Regra de Precificação
                  </h3>

                  <div className="bg-indigo-50/30 p-4 rounded-lg border border-indigo-100 space-y-4">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="pricingSource"
                          value="GLOBAL"
                          checked={formData.pricingSource === 'GLOBAL'}
                          onChange={() => setFormData(p => ({ ...p, pricingSource: 'GLOBAL' }))}
                          className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-slate-700">Regra Global</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="pricingSource"
                          value="CUSTOM"
                          checked={formData.pricingSource === 'CUSTOM'}
                          onChange={() => setFormData(p => ({ ...p, pricingSource: 'CUSTOM' }))}
                          className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-slate-700">Fórmula Direta</span>
                      </label>
                    </div>

                    {formData.pricingSource === 'GLOBAL' ? (
                      <div className="space-y-2">
                        <select
                          value={formData.pricingRuleId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setFormData(prev => ({ ...prev, pricingRuleId: selectedId, localFormulaId: '' }));
                          }}
                          className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm"
                        >
                          <option value="">Sem regra (preço manual)</option>
                          {globalRules.map((rule) => (
                            <option key={rule.id} value={rule.id}>
                              {rule.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          className="w-full p-3 border rounded-lg font-mono text-sm h-24 focus:ring-2 focus:ring-indigo-400 bg-white"
                          placeholder="Ex: (CUSTO_MATERIAIS * 2.5) + 50"
                          value={formData.customFormula}
                          onChange={(e) => setFormData(p => ({ ...p, customFormula: e.target.value }))}
                        />
                        <p className="text-[10px] text-indigo-600 mt-1">
                          Use <b>CUSTO_MATERIAIS</b> como variável para somar a ficha técnica.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Campos editáveis das variáveis da fórmula */}
                {(() => {
                  if (!formulaObj || !formulaObj.variables) return null;


                  const inputVars = (formulaObj.variables || []).filter((v: any) => v.type === 'INPUT');
                  const fixedVars = (formulaObj.variables || []).filter((v: any) => v.type === 'FIXED');


                  const handleVarChange = (varId: string, rawValue: string) => {
                    const updatedVars = { ...formData.formulaVarValues, [varId]: rawValue };
                    setFormData(prev => ({
                      ...prev,
                      formulaVarValues: updatedVars
                    }));
                  };

                  const toggleVarLock = (varId: string) => {
                    const lockKey = `${varId}_locked`;
                    const isLocked = formData.formulaVarValues[lockKey] === true;
                    const updatedVars = { ...formData.formulaVarValues, [lockKey]: !isLocked };
                    setFormData(prev => ({
                      ...prev,
                      formulaVarValues: updatedVars
                    }));
                  };

                  return (
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                            Variáveis da Fórmula
                            ({formData.pricingSource === 'GLOBAL' ? 'Global' : 'Local'})
                          </p>
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground truncate">
                            {formulaObj.formulaString}
                          </code>
                        </div>
                        <p className="text-[10px] text-amber-600 leading-tight">
                          💡 <b>Dica:</b> Variáveis que ficarem em <b>branco</b> ou <b>0</b> serão solicitadas ao vendedor no momento do pedido.
                          Valores preenchidos aqui serão fixos e não aparecerão na venda.
                        </p>
                      </div>

                      {/* Inputs editáveis */}
                      {inputVars.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {inputVars.map((v: any) => (
                            <div key={v.id} className="space-y-1">
                              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                                {v.name}
                              </label>
                              <div className="flex items-center gap-0.5">
                                <div className="relative flex-1 flex items-center">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={String(formData.formulaVarValues[v.id] ?? '')}
                                    onChange={e => handleVarChange(v.id, e.target.value)}
                                    placeholder="0"
                                    className={`h-9 font-mono text-sm rounded-r-none ${formData.formulaVarValues[`${v.id}_locked`] ? 'bg-amber-50 border-amber-200' : ''}`}
                                  />
                                  {v.allowedUnits && v.allowedUnits.length > 0 ? (
                                    <select
                                      value={String(formData.formulaVarValues[`${v.id}_unit`] || v.defaultUnit || v.unit || '')}
                                      onChange={(e) => handleVarChange(`${v.id}_unit`, e.target.value)}
                                      className="h-9 px-1 bg-muted border-y border-r rounded-r text-[10px] font-bold uppercase focus:ring-0 focus:outline-none min-w-[45px] appearance-none text-center cursor-pointer hover:bg-slate-200 transition-colors"
                                    >
                                      {v.allowedUnits.map((u: string) => (
                                        <option key={u} value={u}>{u}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="h-9 px-2 bg-muted border-y border-r rounded-r flex items-center text-[10px] font-bold uppercase text-muted-foreground min-w-[40px] justify-center">
                                      {v.unit || '—'}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleVarLock(v.id)}
                                  className={`p-1.5 h-9 rounded border transition-colors ${formData.formulaVarValues[`${v.id}_locked`]
                                      ? 'bg-amber-100 border-amber-300 text-amber-700'
                                      : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600'
                                    }`}
                                  title={formData.formulaVarValues[`${v.id}_locked`] ? "Valor travado (vendedor não edita)" : "Valor aberto (vendedor pode editar)"}
                                >
                                  {formData.formulaVarValues[`${v.id}_locked`] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Valores fixos — somente leitura */}
                      {fixedVars.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                          {fixedVars.map((v: any) => (
                            <div key={v.id} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs text-muted-foreground font-mono">
                              <span className="font-semibold text-foreground">{v.name}</span>
                              <span>=</span>
                              <span className="text-emerald-600 font-bold">{v.fixedValue ?? '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Resultado calculado */}
                      <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 pt-1 border-t border-border">
                        {calculatedPrices.cost > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Custo Estimado:</span>
                            <span className="text-sm font-semibold text-orange-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedPrices.cost)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground italic">Venda:</span>
                          <span className="text-base font-bold text-blue-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedPrices.sale)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Preços Manuais - Apenas quando NÃO há fórmula */}
                {!formulaObj && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Preço do Card / Vitrine (R$)</label>
                      <CurrencyInput
                        value={formData.salePrice}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, salePrice: value || 0 }))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Custo Base (R$)</label>
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



                  {produto.costPrice !== undefined && (
                    <p className="text-sm font-medium text-slate-500">
                      Custo: {formatCurrency(produto.costPrice)}
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