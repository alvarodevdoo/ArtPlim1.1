import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Trash2, Edit, Package, Info, Calculator, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useInsumos } from '@/features/supplies/useInsumos';
import { InsumoMaterialSelecionado, UNIDADE_BASE_LABELS } from '@/features/supplies/types';
import { Combobox } from '@/components/ui/Combobox';

interface ProductFichaTecnicaManagerProps {
  productId: string;
  productName: string;
  pricingMode: string;
  availableVariables?: string[];
  onUpdate?: () => void;
}

export const ProductFichaTecnicaManager: React.FC<ProductFichaTecnicaManagerProps> = ({
  productId,
  productName,
  availableVariables = [],
  onUpdate
}) => {
  const [items, setItems] = useState<InsumoMaterialSelecionado[]>([]);
  const [loading, setLoading] = useState(true);
  const { insumos } = useInsumos();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InsumoMaterialSelecionado | null>(null);

  // Estados para o formulário de adição/edição
  const [selectedInsumoId, setSelectedInsumoId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [linkedVariable, setLinkedVariable] = useState('');
  const [linkedQuantityVariable, setLinkedQuantityVariable] = useState('');

  useEffect(() => {
    loadFichaTecnica();
  }, [productId]);

  const loadFichaTecnica = async () => {
    try {
      const resp = await api.get(`/api/catalog/products/${productId}/ficha-tecnica`);
      if (resp.data.success) {
        const mappedItems = resp.data.data.map((item: any) => ({
          insumoId: item.insumoId,
          nome: item.insumo?.nome || item.material?.name || 'Insumo não encontrado',
          precoBase: Number(item.insumo?.custoUnitario || item.material?.costPerUnit || 0),
          quantidadeUtilizada: item.quantidade,
          unidadeBase: item.insumo?.unidadeBase || item.material?.unit || 'UN',
          linkedVariable: item.linkedVariable,
          linkedQuantityVariable: item.linkedQuantityVariable
        }));
        setItems(mappedItems);
      }
    } catch (err) {
      console.error('Erro ao carregar ficha técnica:', err);
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Se estiver editando, removemos o antigo e adicionamos o novo na lista local
    // e depois enviamos tudo para o servidor (padrão do endpoint POST /ficha-tecnica)
    
    const insumo = insumos.find(i => i.id === selectedInsumoId);
    if (!insumo && !editingItem) {
      toast.error('Por favor, selecione um insumo antes de confirmar.');
      return;
    }

    const newItem: InsumoMaterialSelecionado = {
      insumoId: selectedInsumoId || editingItem!.insumoId,
      nome: (insumo as any)?.name || insumo?.nome || editingItem!.nome,
      precoBase: Number((insumo as any)?.costPerUnit ?? insumo?.custoUnitario ?? editingItem!.precoBase),
      quantidadeUtilizada: parseFloat(quantidade.replace(',', '.')),
      unidadeBase: (insumo as any)?.unit || insumo?.unidadeBase || editingItem!.unidadeBase,
      linkedVariable: linkedVariable || undefined,
      linkedQuantityVariable: linkedQuantityVariable || undefined
    };

    let newItems = [...items];
    if (editingItem) {
      newItems = newItems.map(item => item.insumoId === editingItem.insumoId ? newItem : item);
    } else {
      // Verifica duplex
      const existIdx = newItems.findIndex(i => i.insumoId === newItem.insumoId);
      if (existIdx >= 0) {
        newItems[existIdx] = newItem;
      } else {
        newItems.push(newItem);
      }
    }

    try {
      const resp = await api.post(`/api/catalog/products/${productId}/ficha-tecnica`, {
        items: newItems.map(item => ({
          insumoId: item.insumoId,
          quantidade: item.quantidadeUtilizada,
          linkedVariable: item.linkedVariable,
          linkedQuantityVariable: item.linkedQuantityVariable
        }))
      });
      
      if (resp.data.success) {
        toast.success(editingItem ? 'Item atualizado!' : 'Item adicionado!');
        setShowAddForm(false);
        setEditingItem(null);
        loadFichaTecnica();
        if (onUpdate) onUpdate();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Erro ao salvar material');
    }
  };

  const handleRemove = async (insumoId: string) => {
    if (!confirm('Remover este material da ficha técnica?')) return;
    
    const newItems = items.filter(i => i.insumoId !== insumoId);
    try {
      const resp = await api.post(`/api/catalog/products/${productId}/ficha-tecnica`, {
        items: newItems.map(item => ({
          insumoId: item.insumoId,
          quantidade: item.quantidadeUtilizada,
          linkedVariable: item.linkedVariable,
          linkedQuantityVariable: item.linkedQuantityVariable
        }))
      });
      if (resp.data.success) {
        toast.success('Item removido!');
        loadFichaTecnica();
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      toast.error('Erro ao remover material');
    }
  };

  const resetForm = () => {
    setSelectedInsumoId('');
    setQuantidade('1');
    setLinkedVariable('');
    setLinkedQuantityVariable('');
    setShowAddForm(false);
    setEditingItem(null);
  };

  const openEdit = (item: InsumoMaterialSelecionado) => {
    setEditingItem(item);
    setSelectedInsumoId(item.insumoId);
    setQuantidade(item.quantidadeUtilizada.toString());
    setLinkedVariable(item.linkedVariable || '');
    setLinkedQuantityVariable(item.linkedQuantityVariable || '');
    setShowAddForm(true);
  };

  const totalCusto = items.reduce((acc, item) => acc + (item.quantidadeUtilizada * item.precoBase), 0);

  if (loading) return <div className="p-8 text-center">Carregando materiais...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Ficha Técnica / BOM
          </h3>
          <p className="text-sm text-muted-foreground">
            Materiais base que compõem o produto {productName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Custo Total Base</p>
            <p className="text-xl font-bold text-green-600">
              {totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Insumo
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">
              {editingItem ? 'Editar Material' : 'Novo Material'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Escolha o Insumo</label>
                  <Combobox
                    value={selectedInsumoId}
                    onChange={(val) => setSelectedInsumoId(val)}
                    placeholder="Selecione ou digite para buscar..."
                    searchPlaceholder="Buscar por nome..."
                    disabled={!!editingItem}
                    allowClear
                    clearLabel="Limpar seleção"
                    options={insumos.map((i: any) => ({
                      id: i.id,
                      label: i.name || i.nome,
                      sublabel: UNIDADE_BASE_LABELS[(i.unit || i.unidadeBase) as keyof typeof UNIDADE_BASE_LABELS] || i.unit || i.unidadeBase,
                      rightLabel: Number(i.costPerUnit ?? i.custoUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Quantidade Base</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      step="0.001"
                      className="flex-1 p-2 border rounded-md bg-white text-sm"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      required
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {selectedInsumoId ? ((insumos.find(i => i.id === selectedInsumoId) as any)?.unit || insumos.find(i => i.id === selectedInsumoId)?.unidadeBase) : ((editingItem as any)?.unit || editingItem?.unidadeBase || '')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-blue-600 flex items-center gap-1 uppercase">
                    <LinkIcon className="w-3 h-3" /> Vínculo de Variável (Quantidade)
                  </label>
                  <select 
                    className="w-full p-2 border rounded-md bg-white text-sm"
                    value={linkedQuantityVariable}
                    onChange={(e) => setLinkedQuantityVariable(e.target.value)}
                  >
                    <option value="">Nenhum (Manual)</option>
                    {availableVariables.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Define qual variável do orçamento preenche a quantidade deste material automaticamente.
                  </p>
                </div>

                <div className="flex items-end justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
                  <Button type="submit">Confirmar</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3">
        {items.length === 0 && !showAddForm && (
          <div className="p-12 border-2 border-dashed rounded-lg text-center bg-muted/20">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground font-medium">Nenhum material base configurado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Insumos adicionados aqui serão incluídos automaticamente em todos os orçamentos deste produto.
            </p>
          </div>
        )}

        {items.map((item) => (
          <Card key={item.insumoId} className="group hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{item.nome}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                      {item.unidadeBase}
                    </span>
                    <span className="text-xs text-slate-400">
                      Custo: {item.precoBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {item.unidadeBase}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-center px-4 border-l border-r">
                  <div className="flex items-center gap-1 justify-center mb-1">
                    {item.linkedQuantityVariable ? (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Calculator className="w-3 h-3" /> AUTO: {item.linkedQuantityVariable}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">MANUAL</span>
                    )}
                  </div>
                  <p className="text-lg font-bold text-slate-700">
                    {item.quantidadeUtilizada} <span className="text-xs font-normal text-slate-400 lowercase">{item.unidadeBase}</span>
                  </p>
                </div>

                <div className="text-right min-w-[120px]">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Subtotal</p>
                  <p className="text-lg font-bold text-slate-900">
                    {(item.quantidadeUtilizada * item.precoBase).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemove(item.insumoId)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-600">
            <p className="font-bold">Como funciona a Ficha Técnica Base?</p>
            <p>
              Estes materiais são o "padrão" do produto. Se você vincular uma quantidade a uma variável 
              (ex: <b>LARGURA</b>), o sistema calculará o consumo automaticamente no orçamento. Caso contrário, 
              ele usará a <b>Quantidade Base</b> fixa definida acima.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
