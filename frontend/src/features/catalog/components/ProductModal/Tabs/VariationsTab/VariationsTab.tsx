import React, { useState, useEffect } from 'react';
import {
  Settings, Plus, Trash2, Link as LinkIcon,
  CheckCircle2, ChevronDown, ChevronRight, DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/Combobox';
import { useInsumos } from '@/features/insumos/useInsumos';
import { DraftVariationGroup, DraftOption } from '../../types';

// Temp-ID generator (no external dep needed)
const tempId = () => `__new_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

interface VariationsTabProps {
  groups: DraftVariationGroup[];
  selectedOptionIds: Record<string, string>; // groupId → optionId
  onChange: (groups: DraftVariationGroup[]) => void;
  onSelectOption: (groupId: string, optionId: string) => void;
}

const InlineInput = ({ 
  initialValue, 
  onSave, 
  className,
  placeholder,
  type = 'text',
  isEditing = false
}: { 
  initialValue: string | number; 
  onSave: (val: string) => void;
  className?: string;
  placeholder?: string;
  type?: 'text' | 'number';
  isEditing?: boolean;
}) => {
  const [val, setVal] = useState(String(initialValue));
  const inputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => { setVal(String(initialValue)); }, [initialValue]);

  if (!isEditing) {
    return <span className={cn("inline-block", className)}>{initialValue}</span>;
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => val !== String(initialValue) && onSave(val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { inputRef.current?.blur(); }
        if (e.key === 'Escape') { setVal(String(initialValue)); inputRef.current?.blur(); }
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "bg-white border-2 border-slate-100 hover:border-slate-300 focus:border-amber-400 focus:outline-none transition-all rounded-lg px-2 py-0.5 text-slate-700",
        className
      )}
    />
  );
};

export const VariationsTab: React.FC<VariationsTabProps> = ({
  groups,
  selectedOptionIds,
  onChange,
  onSelectOption,
}) => {
  const { insumos } = useInsumos();

  // New Group form
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<DraftVariationGroup['type']>('SELECT');

  // New Option form (keyed by groupId)
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState('0');
  const [newOptionOverridePrice, setNewOptionOverridePrice] = useState('');
  const [newOptionMaterialId, setNewOptionMaterialId] = useState<string | null>(null);

  // Global editing toggle
  const [isGlobalEditing, setIsGlobalEditing] = useState(false);

  // Collapsed groups
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // ── Group CRUD ──────────────────────────────────────────────────────────────
  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: DraftVariationGroup = {
      id: tempId(),
      name: newGroupName.trim(),
      type: newGroupType || 'SELECT',
      required: true,
      displayOrder: groups.length + 1,
      options: [],
    };
    onChange([...groups, newGroup]);
    setNewGroupName('');
    setShowAddGroup(false);
  };

  const handleDeleteGroup = (groupId: string) => {
    console.log('[VariationsTab] Deleting group:', groupId);
    onChange(groups.filter((g) => g.id !== groupId));
  };

  const handleUpdateGroup = (groupId: string, patch: Partial<DraftVariationGroup>) => {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  };

  // ── Option CRUD ─────────────────────────────────────────────────────────────
  const handleAddOption = (groupId: string) => {
    if (!newOptionLabel.trim()) return;
    const newOption: DraftOption = {
      id: tempId(),
      label: newOptionLabel.trim(),
      value: newOptionLabel.trim().toLowerCase().replace(/\s+/g, '_'),
      priceModifier: parseFloat(newOptionPrice) || 0,
      priceModifierType: 'FIXED',
      priceOverride: newOptionOverridePrice ? parseFloat(newOptionOverridePrice) : null,
      materialId: newOptionMaterialId,
      isAvailable: true,
      displayOrder: 1,
    };
    onChange(groups.map((g) =>
      g.id === groupId ? { ...g, options: [...g.options, newOption] } : g
    ));
    setNewOptionLabel('');
    setNewOptionPrice('0');
    setNewOptionOverridePrice('');
    setNewOptionMaterialId(null);
    setAddingToGroup(null);
  };

  const handleDeleteOption = (groupId: string, optionId: string) => {
    console.log('[VariationsTab] Deleting option:', optionId, 'from group:', groupId);
    onChange(groups.map((g) =>
      g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g
    ));
  };

  const updateOption = (groupId: string, optionId: string, patch: Partial<DraftOption>) => {
    onChange(groups.map((g) =>
      g.id === groupId
        ? { ...g, options: g.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
        : g
    ));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-300 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Grade de Variações</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              {groups.length} grupo{groups.length !== 1 ? 's' : ''} • Alterações salvas ao confirmar
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsGlobalEditing((e) => !e)}
            variant={isGlobalEditing ? 'default' : 'outline'}
            className={cn(
              "rounded-xl font-bold border-2",
              isGlobalEditing ? "bg-amber-500 hover:bg-amber-600 text-white" : ""
            )}
          >
            {isGlobalEditing ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar Edição
              </>
            ) : (
              <>
                <Settings className="w-4 h-4 mr-2" /> Editar Grade
              </>
            )}
          </Button>
          <Button onClick={() => setShowAddGroup(true)} variant="outline" className="rounded-xl font-bold border-2">
            <Plus className="w-4 h-4 mr-2" /> Novo Grupo
          </Button>
        </div>
      </div>

      {/* New Group Form */}
      {showAddGroup && (
        <div className="bg-amber-50/50 border-2 border-dashed border-amber-200 rounded-2xl p-6 animate-in slide-in-from-top duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-amber-700">Nome do Grupo</label>
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                className="w-full h-10 px-4 rounded-xl border-2 border-amber-100 focus:border-amber-500 focus:outline-none font-bold text-slate-700"
                placeholder="Ex: Papel, Acabamento, Cor..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-amber-700">Tipo de Seleção</label>
              <select
                value={newGroupType}
                onChange={(e) => setNewGroupType(e.target.value as DraftVariationGroup['type'])}
                className="w-full h-10 px-4 rounded-xl border-2 border-amber-100 focus:border-amber-500 focus:outline-none font-bold text-slate-700 bg-white"
              >
                <option value="SELECT">Lista de Escolha (Select)</option>
                <option value="BOOLEAN">Sim / Não (Toggle)</option>
                <option value="NUMBER">Valor Numérico</option>
                <option value="TEXT">Texto Livre</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-amber-100">
            <Button variant="ghost" onClick={() => setShowAddGroup(false)} className="text-amber-700 font-bold">Cancelar</Button>
            <Button onClick={handleAddGroup} className="bg-amber-600 hover:bg-amber-700 font-black">Confirmar Grupo</Button>
          </div>
        </div>
      )}

      {/* Groups List */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2 pb-8">
        {groups.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-20 opacity-30 border-4 border-dashed rounded-3xl">
            <Settings className="w-16 h-16 mb-4" />
            <p className="font-black uppercase tracking-widest text-lg">Sem variações configuradas</p>
            <p className="text-xs font-bold mt-1">Crie grupos como "Papel", "Acabamento", etc.</p>
          </div>
        ) : (
          groups.map((group) => {
            const isCollapsed = collapsed[group.id];
            return (
              <div key={group.id} className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                {/* Group Header */}
                <div
                  className="flex items-center justify-between px-5 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4 text-amber-500" />
                      : <ChevronDown className="w-4 h-4 text-amber-500" />
                    }
                    <InlineInput
                      initialValue={group.name}
                      isEditing={isGlobalEditing}
                      onSave={(val) => handleUpdateGroup(group.id, { name: val })}
                      className={cn(
                        "text-xs font-black uppercase tracking-[0.2em] w-48 self-center",
                        isGlobalEditing ? "text-slate-800 bg-white border-amber-100 h-8 px-3" : "text-slate-600 border-transparent bg-transparent"
                      )}
                    />
                    <span className="text-[9px] font-bold bg-white text-slate-400 px-2 py-0.5 rounded-full border uppercase">
                      {group.type} • {group.options.length} opção{group.options.length !== 1 ? 'ões' : ''}
                    </span>
                  </div>
                {/* Action Buttons: Expand / Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
                    className="p-1 px-3 text-[9px] font-black uppercase text-slate-400 hover:bg-slate-100 rounded-lg flex items-center gap-1"
                  >
                    {isCollapsed ? 'Ver Opções' : 'Recolher'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all relative z-10"
                    title="Remover Grupo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

                {/* Group Body */}
                {!isCollapsed && (
                  <div className="p-4 space-y-3">
                    {group.options.map((option) => (
                      <OptionCard
                        key={option.id}
                        option={option}
                        isSelected={selectedOptionIds[group.id] === option.id}
                        insumos={insumos}
                        onSelect={() => onSelectOption(group.id, option.id)}
                        onDelete={() => handleDeleteOption(group.id, option.id)}
                        onChange={(patch) => updateOption(group.id, option.id, patch)}
                        isGlobalEditing={isGlobalEditing}
                      />
                    ))}

                    {/* Add Option Form */}
                    {addingToGroup === group.id ? (
                      <div className="p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-4 animate-in slide-in-from-top duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                          <div className="md:col-span-3 space-y-1">
                            <p className="text-[9px] font-black uppercase text-slate-400">Nome da Opção</p>
                            <input
                              autoFocus
                              value={newOptionLabel}
                              onChange={(e) => setNewOptionLabel(e.target.value)}
                              className="w-full h-10 px-3 rounded-lg border-2 focus:border-amber-400 focus:outline-none text-sm font-bold"
                              placeholder="Ex: Couché 150g..."
                            />
                          </div>
                          <div className="md:col-span-4 space-y-1">
                            <p className="text-[9px] font-black uppercase text-slate-400">Vincular Material (Slot)</p>
                            <Combobox
                              value={newOptionMaterialId || ''}
                              onChange={(matId) => setNewOptionMaterialId(matId || null)}
                              placeholder="Pesquisar material..."
                              className="h-10 border-2"
                              options={insumos.map((i: any) => ({
                                id: i.id,
                                label: i.name || i.nome,
                                sublabel: `${i.unit || i.unidadeBase} • R$ ${Number(i.averageCost || i.custoUnitario || 0).toFixed(2)}`,
                              }))}
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <p className="text-[9px] font-black uppercase text-slate-400" title="Soma ou subtrai do preço base">Ajuste (+/- R$)</p>
                            <input
                              type="number"
                              value={newOptionPrice}
                              onChange={(e) => setNewOptionPrice(e.target.value)}
                              className="w-full h-10 px-3 rounded-lg border-2 focus:border-amber-400 focus:outline-none text-sm font-bold text-center text-emerald-600"
                            />
                          </div>
                          <div className="md:col-span-3 space-y-1">
                            <p className="text-[9px] font-black uppercase text-slate-400" title="Substitui o preço final do produto">Preço Fixo (Manual)</p>
                            <input
                              type="number"
                              value={newOptionOverridePrice}
                              onChange={(e) => setNewOptionOverridePrice(e.target.value)}
                              className="w-full h-10 px-3 rounded-lg border-2 focus:border-indigo-400 focus:outline-none text-sm font-bold text-center text-indigo-700"
                              placeholder="Auto"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/50">
                          <Button variant="ghost" onClick={() => setAddingToGroup(null)} className="h-10 px-6 font-bold text-slate-500">Cancelar</Button>
                          <Button onClick={() => handleAddOption(group.id)} className="h-10 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black">Adicionar Opção</Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingToGroup(group.id); setNewOptionLabel(''); setNewOptionPrice('0'); setNewOptionOverridePrice(''); setNewOptionMaterialId(null); }}
                        className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Opção
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── Option Card ──────────────────────────────────────────────────────────────
const OptionCard = ({
  option,
  isSelected,
  insumos,
  onSelect,
  onDelete,
  onChange,
  isGlobalEditing = false
}: {
  option: DraftOption;
  isSelected: boolean;
  insumos: any[];
  onSelect: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<DraftOption>) => void;
  isGlobalEditing?: boolean;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className={cn(
      'relative rounded-2xl border-2 transition-all group overflow-hidden',
      isSelected ? 'border-amber-400 bg-amber-50/30 shadow-md' : 'border-slate-100 bg-white hover:border-slate-200'
    )}>
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-0 right-0 p-1.5 bg-amber-500 text-white rounded-bl-xl">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Main row */}
      <div className="flex items-center gap-4 p-4">
        {/* Radio button */}
        <button
          onClick={onSelect}
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
            isSelected ? 'border-amber-500 bg-amber-500' : 'border-slate-300 hover:border-slate-400'
          )}
        >
          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
        </button>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <InlineInput
              initialValue={option.label}
              isEditing={isGlobalEditing}
              onSave={(val) => onChange({ label: val })}
              className={cn(
                "font-black w-full self-center",
                isGlobalEditing ? "text-sm bg-white border-amber-100 h-9 px-3 text-slate-800" : "text-base text-slate-800 border-transparent bg-transparent"
              )}
            />
            {option.materialId && (
              <span className="text-[9px] font-black uppercase text-indigo-500 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                <LinkIcon className="w-2.5 h-2.5" /> Material Vinculado
              </span>
            )}
          </div>
        </div>

        {/* Price modifier */}
        <div className="text-right shrink-0">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1" title="Acréscimo sobre o preço base">Ajuste (+ R$)</p>
          <InlineInput
            type="number"
            initialValue={option.priceModifier}
            isEditing={isGlobalEditing}
            onSave={(val) => onChange({ priceModifier: parseFloat(val) || 0 })}
            className={cn(
              "text-center font-black text-emerald-600",
              isGlobalEditing ? "w-20 h-8 border-amber-200" : "text-sm"
            )}
          />
        </div>

        {/* Price Override */}
        <div className="text-center shrink-0">
          <p className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1" title="Substitui o preço final do produto">
            <DollarSign className="w-2.5 h-2.5" /> Valor Fixo
          </p>
          <InlineInput
            type="number"
            initialValue={option.priceOverride ?? ''}
            isEditing={isGlobalEditing}
            onSave={(val) => onChange({ priceOverride: val === '' ? null : parseFloat(val) })}
            placeholder="Auto"
            className={cn(
              "text-center font-black",
              isGlobalEditing ? "w-20 h-8 border-indigo-200 text-indigo-700" : "text-indigo-400 text-xs"
            )}
          />
        </div>

        {/* Expand / Delete */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all text-[9px] font-black uppercase"
          >
            {showDetails ? 'Fechar' : 'Material'}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all relative z-10"
            title="Remover Opção"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Material slot (expanded or always-on in editing) */}
      {(showDetails || isGlobalEditing) && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50 animate-in slide-in-from-top duration-150">
          <div className="flex items-center gap-2 mb-2 mt-3">
             <p className="text-[9px] font-black uppercase text-slate-400">Vincular Material do Estoque (Slot)</p>
             {isGlobalEditing && (
               <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                 Modo de Edição Ativo
               </span>
             )}
          </div>
          <Combobox
            value={option.materialId || ''}
            onChange={(matId) => onChange({ materialId: matId || null })}
            placeholder="Nenhum material vinculado..."
            className={cn("h-10 text-[10px] transition-all", isGlobalEditing ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-100")}
            options={insumos.map((i: any) => ({
              id: i.id,
              label: i.name || i.nome,
              sublabel: `${i.unit || i.unidadeBase} • R$ ${Number(i.averageCost || i.custoUnitario || 0).toFixed(2)}`,
            }))}
          />
        </div>
      )}
    </div>
  );
};
