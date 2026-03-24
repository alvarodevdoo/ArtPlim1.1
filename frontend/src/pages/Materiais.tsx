import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Search, Edit, Trash2, Layers, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Material {
  id: string;
  name: string;
  category: string;
  description?: string;
  format: 'ROLL' | 'SHEET' | 'UNIT';
  costPerUnit: number;
  unit: string;
  standardWidth?: number;
  standardLength?: number;
  active: boolean;
  defaultConsumptionRule?: string;
  defaultConsumptionFactor?: number;
  inventoryAccountId?: string;
  expenseAccountId?: string;
  inventoryAccount?: { name: string; code: string };
  expenseAccount?: { name: string; code: string };
  minStockQuantity?: number | null;
  sellWithoutStock?: boolean;
  suppliers?: { supplierId: string; costPrice: number | string; supplierCode?: string }[];
  receiptItems?: {
    id: string;
    createdAt: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    receipt: {
      supplier: { name: string };
    };
  }[];
  _count: {
    components: number;
    inventoryItems: number;
  };
}

const Materiais: React.FC = () => {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Outros',
    description: '',
    format: 'SHEET' as Material['format'],
    costPerUnit: '',
    unit: 'm²',
    standardWidth: '',
    standardLength: '',
    defaultConsumptionRule: 'FIXED',
    defaultConsumptionFactor: '1',
    inventoryAccountId: '',
    expenseAccountId: '',
    minStockQuantity: '',
    sellWithoutStock: true,
    suppliers: [] as { supplierId: string; costPrice: string | number; supplierCode: string }[]
  });

  useEffect(() => {
    loadMateriais();
    loadChartOfAccounts();
    loadFornecedores();
  }, []);

  const loadChartOfAccounts = async () => {
    try {
      const resp = await api.get('/api/finance/chart-of-accounts');
      setChartOfAccounts(resp.data.data);
    } catch (e) {
      console.error('Erro ao carregar plano de contas', e);
    }
  };

  const loadFornecedores = async () => {
    try {
      const resp = await api.get('/api/profiles/suppliers/list');
      setFornecedores(resp.data.data);
    } catch (e) {
      console.error('Erro ao carregar fornecedores', e);
    }
  };

  const loadMateriais = async () => {
    try {
      const response = await api.get('/api/catalog/materials');
      setMateriais(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      category: formData.category,
      description: formData.description || undefined,
      format: formData.format,
      costPerUnit: parseFloat(formData.costPerUnit),
      unit: formData.unit,
      standardWidth: formData.standardWidth ? parseFloat(formData.standardWidth) : undefined,
      standardLength: formData.standardLength ? parseFloat(formData.standardLength) : undefined,
      defaultConsumptionRule: formData.defaultConsumptionRule,
      defaultConsumptionFactor: formData.defaultConsumptionFactor ? parseFloat(formData.defaultConsumptionFactor) : 1,
      inventoryAccountId: formData.inventoryAccountId || null,
      expenseAccountId: formData.expenseAccountId || null,
      minStockQuantity: formData.minStockQuantity ? parseFloat(formData.minStockQuantity) : null,
      sellWithoutStock: formData.sellWithoutStock,
      suppliers: formData.suppliers.map(s => ({
        supplierId: s.supplierId,
        costPrice: parseFloat(formData.costPerUnit),
        supplierCode: undefined
      }))
    };

    try {
      if (editingMaterial) {
        await api.put(`/api/catalog/materials/${editingMaterial.id}`, payload);
        toast.success('Material atualizado com sucesso!');
      } else {
        await api.post('/api/catalog/materials', payload);
        toast.success('Material criado com sucesso!');
      }

      setShowForm(false);
      setEditingMaterial(null);
      resetForm();
      loadMateriais();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar material');
    }
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      category: material.category || 'Outros',
      description: material.description || '',
      format: material.format,
      costPerUnit: material.costPerUnit.toString(),
      unit: material.unit,
      standardWidth: material.standardWidth?.toString() || '',
      standardLength: material.standardLength?.toString() || '',
      defaultConsumptionRule: material.defaultConsumptionRule || 'FIXED',
      defaultConsumptionFactor: material.defaultConsumptionFactor?.toString() || '1',
      inventoryAccountId: material.inventoryAccountId || '',
      expenseAccountId: material.expenseAccountId || '',
      minStockQuantity: material.minStockQuantity?.toString() || '',
      sellWithoutStock: material.sellWithoutStock ?? true,
      suppliers: material.suppliers?.map(s => ({
        supplierId: s.supplierId,
        costPrice: s.costPrice.toString(),
        supplierCode: s.supplierCode || ''
      })) || []
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este material?')) return;

    try {
      await api.delete(`/api/catalog/materials/${id}`);
      toast.success('Material removido com sucesso!');
      loadMateriais();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao remover material');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Outros',
      description: '',
      format: 'SHEET',
      costPerUnit: '',
      unit: 'm²',
      standardWidth: '',
      standardLength: '',
      defaultConsumptionRule: 'FIXED',
      defaultConsumptionFactor: '1',
      inventoryAccountId: '',
      expenseAccountId: '',
      minStockQuantity: '',
      sellWithoutStock: true,
      suppliers: []
    });
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'ROLL': return 'Rolo';
      case 'SHEET': return 'Chapa';
      case 'UNIT': return 'Unidade';
      default: return format;
    }
  };

  const handleFormatChange = (format: string) => {
    let unit = 'm²';
    if (format === 'ROLL') unit = 'ml';
    if (format === 'UNIT') unit = 'un';

    setFormData(prev => ({ ...prev, format: format as any, unit }));
  };

  const filteredMateriais = materiais.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.description?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold text-foreground">Materiais</h1>
          <p className="text-muted-foreground">
            Gerencie matérias-primas e insumos (Partidas Dobradas)
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Material
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nome ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <Card className="modal-content-card max-w-2xl">
            <CardHeader>
              <CardTitle>
                {editingMaterial ? 'Editar Material' : 'Novo Material'}
              </CardTitle>
              <div className="text-sm text-muted-foreground space-y-2 mt-2">
                <p>Configure as informações do material e vínculos contábeis.</p>
                <details className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-md text-sm cursor-pointer group">
                  <summary className="font-semibold flex items-center outline-none">
                    ⚠️ Importante: Informações de Aquisição / Custo
                  </summary>
                  <div className="mt-2 text-amber-700 leading-relaxed border-t border-amber-200 pt-2 cursor-text">
                    As informações cadastradas aqui referem-se aos <strong>dados de aquisição (compra)</strong> do insumo. O sistema usará este valor como <strong>CUSTO</strong>.<br />
                    As regras de venda (preço final para o cliente) devem ser configuradas nas <strong>Fórmulas de Precificação</strong> dentro do cadastro de Produtos.
                  </div>
                </details>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome do Material *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Lona 440g Branca"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categoria *</label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="Ex: Chapas, Tintas..."
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional do material"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center mb-1">
                      Formato *
                      <span title={'Como o insumo é comprado no fornecedor (Chapa, Rolo, Unidade).\nFundamental para calcular o aproveitamento correto no produto.'}>
                        <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                      </span>
                    </label>
                    <select
                      value={formData.format}
                      onChange={(e) => handleFormatChange(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                      required
                    >
                      <option value="SHEET">Chapa (área)</option>
                      <option value="ROLL">Rolo (comprimento)</option>
                      <option value="UNIT">Unidade (quantidade)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center mb-1">
                      Unidade *
                      <span title="A unidade base do custo inserido abaixo (ex: se o preço é por m², informe 'm²').">
                        <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                      </span>
                    </label>
                    <Input
                      value={formData.unit}
                      onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="m², ml, un"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center mb-1">
                    Custo por Unidade (R$) *
                    <span title="O valor pago (custo) na aquisição de 1 unidade deste material no formato escolhido.">
                      <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                    </span>
                  </label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData(prev => ({ ...prev, costPerUnit: e.target.value }))}
                    placeholder="0.0000"
                    required
                  />
                </div>

                {(formData.format === 'ROLL' || formData.format === 'SHEET') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center mb-1">
                        Largura Padrão (mm)
                        <span title={'A largura de fábrica (bobina ou chapa).\nUsado para distribuir as peças a serem produzidas\nna Ficha Técnica (calcular refugo).'}>
                          <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                        </span>
                      </label>
                      <Input
                        type="number"
                        value={formData.standardWidth}
                        onChange={(e) => setFormData(prev => ({ ...prev, standardWidth: e.target.value }))}
                        placeholder="1000"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center mb-1">
                        {formData.format === 'ROLL' ? 'Comprimento Padrão (mm)' : 'Altura Padrão (mm)'}
                        <span title={'O comprimento total do material em rolo ou altura da chapa.\nTambém vital para aproveitamento produtivo.'}>
                          <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                        </span>
                      </label>
                      <Input
                        type="number"
                        value={formData.standardLength}
                        onChange={(e) => setFormData(prev => ({ ...prev, standardLength: e.target.value }))}
                        placeholder="1000"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 border-t pt-4">
                  <h4 className="text-sm font-semibold mb-4 text-primary">Inteligência de Consumo & Contabilidade</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center mb-1">
                        Regra de Consumo Padrão
                        <span title={'Qual será o cálculo padrão usado para saber a quantidade gasta\ndeste insumo quando ele fizer parte de um novo produto.\nEx: Adesivos/Chapas usam Área (m²). Fita adesiva usa Perímetro (ml).'}>
                          <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                        </span>
                      </label>
                      <select
                        value={formData.defaultConsumptionRule}
                        onChange={(e) => setFormData(prev => ({ ...prev, defaultConsumptionRule: e.target.value }))}
                        className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm"
                      >
                        <option value="FIXED">Fixo (Quantidade)</option>
                        <option value="AREA">Área (m²)</option>
                        <option value="PERIMETER">Perímetro (ml)</option>
                        <option value="SPACING">Espaçamento</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center mb-1">
                        Fator/Quant. Padrão
                        <span title={'Para adicionar refugo (perda) padrão de fábrica neste insumo.\nEx: 1.1 significa 10% extra.'}>
                          <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                        </span>
                      </label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={formData.defaultConsumptionFactor}
                        onChange={(e) => setFormData(prev => ({ ...prev, defaultConsumptionFactor: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center mb-1">
                        Conta de Estoque (Ativo)
                        <span title={'A conta contábil Patrimonial (Ativo) onde o custo reside\nenquanto o material está no Setor de Estoque.'}>
                          <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                        </span>
                      </label>
                      <select
                        value={formData.inventoryAccountId}
                        onChange={(e) => setFormData(prev => ({ ...prev, inventoryAccountId: e.target.value }))}
                        className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm"
                      >
                        <option value="">— Selecione uma conta de Ativo —</option>
                        {chartOfAccounts.filter(c => c.type === 'ASSET').map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center mb-1">
                        Conta de CPV/Despesa
                        <span title={'A conta de Resultado (Despesa) para a qual o custo é transferido\nautomaticamente quando a OP (Ordem de Produção) baixar consumo.'}>
                          <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                        </span>
                      </label>
                      <select
                        value={formData.expenseAccountId}
                        onChange={(e) => setFormData(prev => ({ ...prev, expenseAccountId: e.target.value }))}
                        className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm"
                      >
                        <option value="">— Selecione uma conta de Despesa —</option>
                        {chartOfAccounts.filter(c => c.type === 'EXPENSE').map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t pt-4">
                  <h4 className="text-sm font-semibold mb-4 text-primary">Parâmetros de Estoque</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center mb-1">
                        Estoque Mínimo (Alerta)
                        <span title={'Se o estoque cair abaixo deste valor, o sistema irá alertar o setor de\ncompras para reabastecer. Deixe em branco para desabilitar o alerta.'}>
                          <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                        </span>
                      </label>
                      <Input
                        type="number"
                        step="0.001"
                        value={formData.minStockQuantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, minStockQuantity: e.target.value }))}
                        placeholder="Ex: 5 (unidades / m²)"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center mb-1">
                        Vender com Estoque Zerado?
                        <span title={'Se DESLIGADO, o sistema BLOQUEIA a confirmação de qualquer pedido que\nexija este material quando o estoque estiver zerado.\nSe LIGADO, o pedido é aceito e o estoque pode ficar negativo.'}>
                          <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                        </span>
                      </label>
                      <div className="flex items-center gap-3 h-10">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={formData.sellWithoutStock}
                          onClick={() => setFormData(prev => ({ ...prev, sellWithoutStock: !prev.sellWithoutStock }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.sellWithoutStock ? 'bg-green-500' : 'bg-red-500'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.sellWithoutStock ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <span className={`text-sm font-medium ${formData.sellWithoutStock ? 'text-green-600' : 'text-red-600'}`}>
                          {formData.sellWithoutStock ? 'Sim — permite venda no negativo' : 'Não — bloqueia pedido sem estoque'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t pt-4">
                  <h4 className="text-sm font-semibold mb-4 text-primary">Fornecedores e Histórico</h4>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center">
                        Fornecedores Vinculados
                        <span title={'Você pode adicionar vários fornecedores para este mesmo material,\nincluindo os preços praticados por cada um e seus códigos internos.'}>
                          <Info className="w-4 h-4 ml-1 text-muted-foreground cursor-help" />
                        </span>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            // @ts-ignore
                            suppliers: [...prev.suppliers, { supplierId: '', costPrice: '', supplierCode: '' }]
                          }));
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Adicionar Fornecedor
                      </Button>
                    </div>
                    {formData.suppliers.map((s, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-end gap-2 border p-3 rounded-md bg-muted/20">
                        <div className="flex-1 w-full space-y-1">
                          <label className="text-xs">Fornecedor</label>
                          <select
                            value={s.supplierId}
                            onChange={e => {
                              const newSuppliers = [...formData.suppliers];
                              newSuppliers[idx].supplierId = e.target.value;
                              setFormData(prev => ({ ...prev, suppliers: newSuppliers }));
                            }}
                            className="w-full h-9 px-3 border border-input rounded-md bg-background text-sm"
                          >
                            <option value="">Selecione...</option>
                            {fornecedores.map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                        </div>
                        <Button
                          type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0"
                          onClick={() => {
                            const newSuppliers = formData.suppliers.filter((_, i) => i !== idx);
                            setFormData(prev => ({ ...prev, suppliers: newSuppliers }));
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {editingMaterial?.receiptItems && editingMaterial.receiptItems.length > 0 && (
                    <div className="space-y-4 mt-6">
                      <label className="text-sm font-medium border-b pb-1 flex w-full">Histórico de Compras Recentes</label>
                      <div className="rounded-md border overflow-x-auto text-sm">
                        <table className="w-full text-left">
                          <thead className="bg-muted text-xs">
                            <tr>
                              <th className="px-3 py-2">Data</th>
                              <th className="px-3 py-2">Fornecedor</th>
                              <th className="px-3 py-2 text-right">Qtd</th>
                              <th className="px-3 py-2 text-right">Valor Unit.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editingMaterial.receiptItems.map(item => (
                              <tr key={item.id} className="border-t">
                                <td className="px-3 py-2">{new Date(item.createdAt).toLocaleDateString()}</td>
                                <td className="px-3 py-2">{item.receipt.supplier.name}</td>
                                <td className="px-3 py-2 text-right">{item.quantity}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingMaterial(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingMaterial ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Materiais List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMateriais.map((material) => (
          <Card key={material.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] rounded-full uppercase font-bold">
                    {material.category || 'Outros'}
                  </span>
                  <CardTitle className="text-lg mt-1">{material.name}</CardTitle>
                  <CardDescription>
                    {getFormatLabel(material.format)} • {material.unit}
                  </CardDescription>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(material)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(material.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {material.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {material.description}
                  </p>
                )}

                <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-100">
                  <p className="text-sm">
                    <span className="font-medium">Custo: </span>
                    {formatCurrency(Number(material.costPerUnit))}/{material.unit}
                  </p>

                  {(material.standardWidth || material.standardLength) && (
                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">Dimensões: </span>
                      {material.standardWidth && `${material.standardWidth}mm`}
                      {material.standardWidth && material.standardLength && ' × '}
                      {material.standardLength && `${material.standardLength}mm`}
                    </p>
                  )}
                </div>

                {/* Vínculos Contábeis */}
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] uppercase font-semibold text-slate-400">Plano de Contas</p>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="font-medium text-blue-600">📦 Ativo:</span>
                    <span className="truncate">{material.inventoryAccount ? `${material.inventoryAccount.code} - ${material.inventoryAccount.name}` : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="font-medium text-red-600">📉 Custo:</span>
                    <span className="truncate">{material.expenseAccount ? `${material.expenseAccount.code} - ${material.expenseAccount.name}` : 'N/A'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t flex justify-between text-[11px] text-muted-foreground">
                  <span>Uso em {material._count?.components || 0} produto(s)</span>
                  <span className={material._count?.inventoryItems === 0 ? 'text-red-500 font-bold' : ''}>
                    {material._count?.inventoryItems || 0} em estoque
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMateriais.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum material encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Tente ajustar sua busca' : 'Comece criando seu primeiro material'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Material
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Materiais;