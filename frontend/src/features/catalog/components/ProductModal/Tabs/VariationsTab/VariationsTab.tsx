import React, { useState, useEffect } from 'react';
import { 
  Settings, Plus, Trash2, Link as LinkIcon, 
  AlertTriangle, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useInsumos } from '@/features/insumos/useInsumos';
import { Combobox } from '@/components/ui/Combobox';
import { ProductDraft } from '../../types';

interface VariationsTabProps {
  productId: string;
  draft: ProductDraft;
  onSimulate: (optionIds: string[]) => void;
}

interface ConfigurationGroup {
  id: string;
  name: string;
  type: string;
  options: any[];
}

export const VariationsTab: React.FC<VariationsTabProps> = ({ productId, onSimulate }) => {
  const [groups, setGroups] = useState<ConfigurationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { insumos } = useInsumos();
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  
  // Novo Grupo State
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('SELECT');
  const [submitting, setSubmitting] = useState(false);

  // Nova Opção State
  const [addingOptionToGroup, setAddingOptionToGroup] = useState<string | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState('0');

  useEffect(() => {
    if (productId) loadConfigurations();
    else setLoading(false);
  }, [productId]);

  const loadConfigurations = async () => {
    try {
      const resp = await api.get(`/api/catalog/products/${productId}/configurations/complete`);
      if (resp.data.success) {
        const configs = resp.data.data.configurations || [];
        setGroups(configs);
        
        // Initialize simulation with default options if any
        const defaults: Record<string, string> = {};
        configs.forEach((g: any) => {
          if (g.options && g.options.length > 0) defaults[g.id] = g.options[0].id;
        });
        setSelectedOptions(defaults);
      }
    } catch (err) {
      toast.error('Erro ao carregar variações');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!productId) {
      toast.error('Salve o produto primeiro para adicionar variações');
      return;
    }
    if (!newGroupName) {
      toast.error('Informe o nome do grupo');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await api.post(`/api/catalog/products/${productId}/configurations`, {
        name: newGroupName,
        type: newGroupType,
        required: true,
        displayOrder: groups.length + 1
      });

      if (resp.data.success) {
        toast.success('Grupo criado com sucesso');
        setNewGroupName('');
        setShowAddGroupForm(false);
        loadConfigurations();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar grupo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddOption = async (groupId: string) => {
    if (!newOptionLabel) {
      toast.error('Informe o nome da opção');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await api.post(`/api/catalog/configurations/${groupId}/options`, {
        label: newOptionLabel,
        value: newOptionLabel.toLowerCase().replace(/\s+/g, '_'),
        priceModifier: parseFloat(newOptionPrice) || 0,
        priceModifierType: 'FIXED',
        displayOrder: 1
      });

      if (resp.data.success) {
        toast.success('Opção adicionada com sucesso');
        setNewOptionLabel('');
        setNewOptionPrice('0');
        setAddingOptionToGroup(null);
        loadConfigurations();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao adicionar opção');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    onSimulate(Object.values(selectedOptions));
  }, [selectedOptions]);

  const handleOptionSelect = (groupId: string, optionId: string) => {
    setSelectedOptions(prev => ({ ...prev, [groupId]: optionId }));
  };

  const updateOptionMaterial = async (groupId: string, optionId: string, materialId: string) => {
     try {
       await api.put(`/api/catalog/configurations/${groupId}/options/${optionId}`, { materialId });
       toast.success('Vínculo de material atualizado');
       loadConfigurations();
     } catch (err) {
       toast.error('Erro ao vincular material');
     }
  };

  if (loading) return <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando Configurações...</div>;

  // State de bloqueio para novos produtos
  if (!productId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-20 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-slate-200">
          <Settings className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Aguardando Cadastro Inicial</h3>
        <p className="text-xs font-bold text-slate-400 mt-2 max-w-xs uppercase leading-relaxed">
          Salve as informações gerais do produto na aba de <span className="text-primary underline">Cadastro</span> para liberar a configuração de variações e slots.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-300 h-full flex flex-col">
      
      {/* Header da Aba */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <Settings className="w-5 h-5" />
           </div>
           <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Grade de Variações</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Grupos de escolha e regras de bloqueio</p>
           </div>
        </div>
        <Button 
          onClick={() => setShowAddGroupForm(true)}
          variant="outline" 
          className="rounded-xl font-bold border-2"
        >
           <Plus className="w-4 h-4 mr-2" /> Novo Grupo
        </Button>
      </div>

      {/* Formulário de Novo Grupo */}
      {showAddGroupForm && (
        <div className="bg-amber-50/50 border-2 border-dashed border-amber-200 rounded-2xl p-6 animate-in slide-in-from-top duration-300">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-amber-700">Nome do Grupo (ex: Papel, Cor)</label>
                 <input 
                  autoFocus
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border-2 border-amber-100 focus:border-amber-500 focus:outline-none font-bold text-slate-700"
                  placeholder="Informe o nome..."
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-amber-700">Tipo de Seleção</label>
                 <select 
                  value={newGroupType}
                  onChange={(e) => setNewGroupType(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border-2 border-amber-100 focus:border-amber-500 focus:outline-none font-bold text-slate-700 bg-white"
                 >
                    <option value="SELECT">Lista de Escolha (Select)</option>
                    <option value="BOOLEAN">Sim/Não (Toggle)</option>
                    <option value="NUMBER">Valor Numérico</option>
                    <option value="TEXT">Texto Livre</option>
                 </select>
              </div>
           </div>
           <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-amber-100">
              <Button variant="ghost" onClick={() => setShowAddGroupForm(false)} className="text-amber-700 font-bold">Cancelar</Button>
              <Button onClick={handleCreateGroup} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 font-black">
                {submitting ? 'Criando...' : 'Confirmar Grupo'}
              </Button>
           </div>
        </div>
      )}

      {/* Grid de Grupos */}
      <div className="flex-1 space-y-10 overflow-y-auto pr-2 pb-8">
        {groups.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-20 opacity-30 border-4 border-dashed rounded-3xl">
             <Settings className="w-16 h-16 mb-4" />
             <p className="font-black uppercase tracking-widest text-lg">Sem variações configuradas</p>
             <p className="text-xs font-bold mt-1">Crie grupos como 'Papel', 'Acabamento', etc.</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="space-y-4">
               <div className="flex items-center justify-between px-2">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-amber-500" /> {group.name}
                  </h4>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">
                    Tipo: {group.type}
                  </span>
               </div>

               <div className="grid grid-cols-1 gap-3">
                  {group.options.map(option => (
                    <OptionCard 
                      key={option.id} 
                      option={option} 
                      isSelected={selectedOptions[group.id] === option.id}
                      onSelect={() => handleOptionSelect(group.id, option.id)}
                      insumos={insumos}
                      onLinkMaterial={(matId: string) => updateOptionMaterial(group.id, option.id, matId)}
                    />
                  ))}
               </div>

               {/* Formulário de Nova Opção */}
               {addingOptionToGroup === group.id ? (
                 <div className="mt-4 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col md:flex-row gap-4 animate-in slide-in-from-top duration-200">
                    <div className="flex-1 space-y-1">
                       <p className="text-[9px] font-black uppercase text-slate-400 ml-1">Nome da Opção</p>
                       <input 
                        autoFocus
                        value={newOptionLabel}
                        onChange={(e) => setNewOptionLabel(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border focus:border-amber-500 focus:outline-none text-xs font-bold"
                        placeholder="Ex: Capa Dura, Brilho..."
                       />
                    </div>
                    <div className="w-full md:w-32 space-y-1">
                       <p className="text-[9px] font-black uppercase text-slate-400 ml-1">Preço Add.</p>
                       <input 
                        type="number"
                        value={newOptionPrice}
                        onChange={(e) => setNewOptionPrice(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border focus:border-amber-500 focus:outline-none text-xs font-bold"
                       />
                    </div>
                    <div className="flex items-end gap-2">
                       <Button variant="ghost" onClick={() => setAddingOptionToGroup(null)} className="h-9 px-3 text-[10px] font-bold">Cancelar</Button>
                       <Button onClick={() => handleAddOption(group.id)} disabled={submitting} className="h-9 px-4 bg-slate-800 hover:bg-slate-900 text-[10px] font-black">
                          {submitting ? 'Adicionando...' : 'Salvar Opção'}
                       </Button>
                    </div>
                 </div>
               ) : (
                 <button 
                  onClick={() => setAddingOptionToGroup(group.id)}
                  className="mt-2 flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all w-fit"
                 >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Opção ao grupo
                 </button>
               )}
            </div>
          ))
        )}
      </div>

      {/* Incompatibility Alert Banner (Simulated) */}
      <div className="bg-amber-50 p-4 rounded-2xl flex gap-3 border border-amber-100 shrink-0">
         <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
         <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-tighter">
            Regras de Incompatibilidade Ativas: 
            <span className="block mt-1 text-amber-600 font-medium normal-case">
              Algumas opções podem estar bloqueadas se forem selecionadas em conjunto. O sistema sinaliza com um ícone de aviso na cor vermelha caso um conflito seja detectado no configurador dinâmico.
            </span>
         </p>
      </div>
    </div>
  );
};

// Subcomponente de Card de Opção
const OptionCard = ({ option, isSelected, onSelect, insumos, onLinkMaterial }: any) => {
  return (
    <div className={cn(
      "relative p-4 rounded-2xl border-2 transition-all flex items-center justify-between group overflow-hidden",
      isSelected ? "border-amber-500 bg-amber-50/30 ring-4 ring-amber-500/5 shadow-lg" : "border-slate-100 bg-white hover:border-slate-200"
    )}>
       {isSelected && (
         <div className="absolute top-0 right-0 p-1.5 bg-amber-500 text-white rounded-bl-xl">
            <CheckCircle2 className="w-3.5 h-3.5" />
         </div>
       )}

       <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={onSelect}
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
              isSelected ? "border-amber-500 bg-amber-500" : "border-slate-300 group-hover:border-slate-400"
            )}
          >
             {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
          </button>
          
          <div className="flex-1">
             <div className="flex items-center gap-3">
                <h5 className="text-sm font-black text-slate-800">{option.label}</h5>
                {option.materialId && (
                  <span className="text-[10px] font-black uppercase text-indigo-500 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    <LinkIcon className="w-2.5 h-2.5" /> Slot de Material
                  </span>
                )}
             </div>
             
             {/* Seletor de Material para o Slot */}
             <div className="mt-3 max-w-sm">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5 ml-1">Vincular Material do Estoque (Slot)</p>
                <Combobox 
                   value={option.materialId || ''}
                   onChange={onLinkMaterial}
                   placeholder="Nenhum material vinculado..."
                   className="h-8 text-[10px]"
                   options={insumos.map((i: any) => ({
                      id: i.id,
                      label: i.name || i.nome,
                      sublabel: `${i.unit || i.unidadeBase} • R$ ${Number(i.averageCost || i.custoUnitario || 0).toFixed(2)}`
                   }))}
                />
             </div>
          </div>
       </div>

       <div className="flex items-center gap-8 pl-8 border-l ml-8">
          <div className="text-right min-w-[100px]">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Preço</p>
             <p className={cn(
               "text-sm font-black",
               Number(option.priceModifier) > 0 ? "text-emerald-600" : "text-slate-900"
             )}>
               {option.priceModifierType === 'PERCENTAGE' 
                  ? `+${option.priceModifier}%` 
                  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(option.priceModifier))}
             </p>
          </div>
          <button className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
             <Trash2 className="w-4 h-4" />
          </button>
       </div>
    </div>
  );
};
