import React, { useState, useEffect } from 'react';
import { 
  Package, Plus, Trash2, Info, 
  Link as LinkIcon, Layers, Settings 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useInsumos } from '@/features/insumos/useInsumos';
import { Combobox } from '@/components/ui/Combobox';
import { ProductDraft } from '../../types';

interface BOMTabProps {
  productId: string;
  draft: ProductDraft;
}

interface BOMItemData {
  id: string;
  insumoId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
  subtotal: number;
  isFixed: boolean;
  variationGroupId?: string;
  linkedVariable?: string;
}

export const BOMTab: React.FC<BOMTabProps> = ({ productId, draft }) => {
  const [items, setItems] = useState<BOMItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const { insumos } = useInsumos();
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [selectedInsumoId, setSelectedInsumoId] = useState('');
  const [qty, setQty] = useState('1');
  const [isSlot, setIsSlot] = useState(false);
  const [variationGroupId, setVariationGroupId] = useState('');

  useEffect(() => {
    if (productId) loadBOM();
    else setLoading(false);
  }, [productId]);

  const loadBOM = async () => {
    try {
      const resp = await api.get(`/api/catalog/products/${productId}/ficha-tecnica`);
      if (resp.data.success) {
        const mapped = resp.data.data.map((item: any) => ({
          id: item.id,
          insumoId: item.insumoId,
          nome: item.material?.name || 'Material não encontrado',
          quantidade: Number(item.quantidade),
          unidade: item.material?.unit || 'un',
          custoUnitario: Number(item.material?.averageCost || 0),
          subtotal: Number(item.quantidade) * Number(item.material?.averageCost || 0),
          isFixed: !item.configurationOptionId,
          variationGroupId: item.configurationOptionId ? 'EXISTING_SLOT' : undefined, // Simplificação para visual
        }));
        setItems(mapped);
      }
    } catch (err) {
      toast.error('Erro ao carregar ficha técnica');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const insumo = insumos.find(i => i.id === selectedInsumoId);
    if (!insumo) {
      toast.error('Selecione um insumo');
      return;
    }

    const newItem: BOMItemData = {
      id: Math.random().toString(36).substr(2, 9),
      insumoId: selectedInsumoId,
      nome: (insumo as any).name || insumo.nome,
      quantidade: parseFloat(qty),
      unidade: (insumo as any).unit || insumo.unidadeBase,
      custoUnitario: Number((insumo as any).averageCost || insumo.custoUnitario || 0),
      subtotal: parseFloat(qty) * Number((insumo as any).averageCost || insumo.custoUnitario || 0),
      isFixed: !isSlot,
      variationGroupId: isSlot ? variationGroupId : undefined
    };

    setItems(prev => [...prev, newItem]);
    resetForm();
  };

  const resetForm = () => {
    setSelectedInsumoId('');
    setQty('1');
    setIsSlot(false);
    setVariationGroupId('');
    setShowAddForm(false);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  if (loading) return <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando Ficha Técnica...</div>;

  // State de bloqueio para novos produtos
  if (!productId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-20 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-slate-200">
          <Layers className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Aguardando Cadastro Inicial</h3>
        <p className="text-xs font-bold text-slate-400 mt-2 max-w-xs uppercase leading-relaxed">
          Salve as informações gerais do produto na aba de <span className="text-primary underline">Cadastro</span> para liberar a montagem da ficha técnica.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-300 h-full flex flex-col">
      
      {/* Header da Aba */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <Layers className="w-5 h-5" />
           </div>
           <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Ficha Técnica Base (BOM)</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Defina o que compõe {draft.name}</p>
           </div>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="rounded-xl font-bold shadow-md shadow-primary/20">
           <Plus className="w-4 h-4 mr-2" /> Adicionar Item
        </Button>
      </div>

      {/* Formulário de Adição Rápida */}
      {showAddForm && (
        <Card className="border-2 border-indigo-100 bg-indigo-50/30 overflow-hidden shrink-0">
          <CardContent className="p-6 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-2">
                   <Label className="text-[10px] font-black uppercase text-indigo-700">Material do Estoque</Label>
                   <Combobox 
                     value={selectedInsumoId}
                     onChange={setSelectedInsumoId}
                     placeholder="Buscar material..."
                     options={insumos.map(i => ({ 
                       id: i.id, 
                       label: (i as any).name || i.nome,
                       sublabel: `${(i as any).unit || i.unidadeBase} • R$ ${Number((i as any).averageCost || i.custoUnitario || 0).toFixed(2)}`
                     }))}
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-indigo-700">Qtd. Base</Label>
                   <Input 
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="h-10 font-black border-2 focus:border-indigo-400"
                   />
                </div>
             </div>

             <div className="flex items-center justify-between pt-4 border-t border-indigo-100">
                <div className="flex items-center gap-6">
                   <label className="flex items-center gap-2 cursor-pointer group">
                      <div 
                        onClick={() => setIsSlot(!isSlot)}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all flex items-center p-1",
                          isSlot ? "bg-indigo-600" : "bg-slate-300"
                        )}
                      >
                         <div className={cn("w-3 h-3 bg-white rounded-full transition-all", isSlot ? "translate-x-5" : "translate-x-0")} />
                      </div>
                      <span className="text-xs font-black text-indigo-900 uppercase tracking-tighter">Este item é um SLOT variável?</span>
                   </label>
                   
                   {isSlot && (
                     <div className="animate-in slide-in-from-left-4 flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5 text-indigo-400" />
                        <select 
                          value={variationGroupId}
                          onChange={(e) => setVariationGroupId(e.target.value)}
                          className="text-[10px] font-black uppercase bg-white border-2 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400"
                        >
                           <option value="">Vincular a Grupo...</option>
                           <option value="paper">Tipo de Papel</option>
                           <option value="lamination">Plastificação</option>
                        </select>
                     </div>
                   )}
                </div>
                <div className="flex gap-2">
                   <Button variant="ghost" onClick={resetForm} className="text-indigo-600 font-bold">Cancelar</Button>
                   <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 font-black">Confirmar Item</Button>
                </div>
             </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Itens (Split Fixo vs Slots) */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-2 pb-8">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-20 opacity-30 border-4 border-dashed rounded-3xl">
             <Package className="w-16 h-16 mb-4" />
             <p className="font-black uppercase tracking-widest text-lg">Ficha técnica vazia</p>
             <p className="text-xs font-bold mt-1">Adicione materiais fixos ou slots para variações</p>
          </div>
        ) : (
          <>
            {/* Seção de Itens Fixos */}
            <div className="space-y-3">
               <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" /> Itens Fixos (Sempre incluídos)
               </h4>
               {items.filter(i => i.isFixed).map(item => (
                 <BOMCard key={item.id} item={item} onRemove={removeItem} />
               ))}
            </div>

            {/* Seção de Slots Variáveis */}
            <div className="space-y-3 pt-6">
               <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-4 px-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" /> Slots Variáveis (Dependentes de Variação)
               </h4>
               {items.filter(i => !i.isFixed).map(item => (
                 <BOMCard key={item.id} item={item} onRemove={removeItem} />
               ))}
            </div>
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 border border-blue-100 shrink-0">
         <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
         <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase tracking-tighter">
            Os materiais adicionados aqui definem o custo base de produção. 
            <span className="block mt-1 text-blue-500 font-medium normal-case">
              Itens fixos são contabilizados em 100% dos pedidos. Slots são ativados dinamicamente apenas se a variação correspondente for selecionada no orçamento.
            </span>
         </p>
      </div>
    </div>
  );
};

// Subcomponente de Card da BOM
const BOMCard = ({ item, onRemove }: { item: BOMItemData, onRemove: (id: string) => void }) => (
  <div className={cn(
    "bom-item p-4 flex items-center justify-between group bg-white",
    item.isFixed ? "fixed" : "slot"
  )}>
    <div className="flex items-center gap-4">
       <div className={cn(
         "w-10 h-10 rounded-xl flex items-center justify-center",
         item.isFixed ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
       )}>
          {item.isFixed ? <Package className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
       </div>
       <div>
          <h5 className="text-sm font-black text-slate-800">{item.nome}</h5>
          <div className="flex items-center gap-3 mt-0.5">
             <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
               {item.unidade}
             </span>
             {item.variationGroupId && (
               <span className="text-[10px] font-black uppercase text-indigo-500 flex items-center gap-1">
                 <LinkIcon className="w-2.5 h-2.5" /> Slot: {item.variationGroupId}
               </span>
             )}
          </div>
       </div>
    </div>

    <div className="flex items-center gap-8">
       <div className="text-center px-4 border-x min-w-[80px]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Qtd</p>
          <p className="text-sm font-black text-slate-700">{item.quantidade}</p>
       </div>
       <div className="text-right min-w-[120px]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subtotal (Médio)</p>
          <p className="text-sm font-black text-slate-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}
          </p>
       </div>
       <button 
        onClick={() => onRemove(item.id)}
        className="p-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 rounded-lg"
       >
          <Trash2 className="w-4 h-4" />
       </button>
    </div>
  </div>
);
