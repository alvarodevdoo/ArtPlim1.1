import React, { useState, useEffect } from 'react';
import {
  Settings, Plus, Trash2, Link as LinkIcon, Check,
  CheckCircle2, ChevronDown, ChevronRight, Layers, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/Combobox';
import { MultiInsumoCombobox, SelectedInsumo } from './MultiInsumoCombobox';
import { useInsumos } from '@/features/supplies/useInsumos';
import { buildInsumoSublabel } from '@/lib/units';
import { DraftVariationGroup, DraftOption, ConfigurationKind } from '../../types';

// Temp-ID generator (no external dep needed)
const tempId = () => `__new_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

interface FormulaVariable {
  id: string;
  name?: string;
  label?: string;
  type?: string;
  role?: string;
  visible?: boolean;
}

interface VariationsTabProps {
  groups: DraftVariationGroup[];
  selectedOptionIds: Record<string, string>; // groupId → optionId
  onChange: (groups: DraftVariationGroup[]) => void;
  onSelectOption: (groupId: string, optionId: string) => void;
  /** Quando definido, força o kind de novos grupos e esconde o seletor */
  forcedKind?: ConfigurationKind;
  /** Motor de precificação do produto (controla qual segmented control mostrar) */
  pricingMode?: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
  /** Variáveis da fórmula do pricingRule selecionado — usadas no motor DYNAMIC */
  formulaVariables?: FormulaVariable[];
}

const InlineInput = ({ 
  initialValue, 
  onSave, 
  className,
  placeholder,
  type = 'text',
  isEditing = false,
  formatAsCurrency = false
}: { 
  initialValue: string | number; 
  onSave: (val: string) => void;
  className?: string;
  placeholder?: string;
  type?: 'text' | 'number';
  isEditing?: boolean;
  formatAsCurrency?: boolean;
}) => {
  const [val, setVal] = useState(String(initialValue));
  const inputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => { setVal(String(initialValue)); }, [initialValue]);

  if (!isEditing) {
    const displayValue = formatAsCurrency && typeof initialValue === 'number'
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(initialValue)
      : initialValue;
    return <span className={cn("inline-block", className)}>{displayValue}</span>;
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
  forcedKind,
  pricingMode,
  formulaVariables = [],
}) => {
  const { insumos } = useInsumos();

  // New Group form
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<DraftVariationGroup['type']>('SELECT');
  const [newGroupKind, setNewGroupKind] = useState<ConfigurationKind>(forcedKind || 'VARIATION');

  const isFinishingTab = forcedKind === 'FINISHING';

  // New Option form (keyed by groupId)
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  // Escopo da opção ao criar (Acabamentos). Para VARIATION é sempre REPLACE_RATE.
  //  ADD_FLAT      → priceModifier + FIXED (soma fixo no total)
  //  ADD_PER_AREA  → priceModifier + PER_AREA (soma ao R$/m²)
  //  REPLACE_RATE  → fixedValue + PER_AREA (substitui R$/m²)
  const [newOptionScope, setNewOptionScope] =
    useState<'ADD_FLAT' | 'ADD_PER_AREA' | 'REPLACE_RATE'>('ADD_FLAT');
  // Campos de quantidade da opção (Acabamentos) — espelham o painel de edição
  const [newOptionDefaultQty, setNewOptionDefaultQty] = useState<string>('');
  const [newOptionMinQty, setNewOptionMinQty] = useState<string>('');
  const [newOptionMaxQty, setNewOptionMaxQty] = useState<string>('');
  const [newOptionAllowCustomQty, setNewOptionAllowCustomQty] = useState<boolean>(false);
  const [newOptionValue, setNewOptionValue] = useState('0');
  /** Lista de insumos selecionados (multi-select) para criação em lote */
  const [selectedInsumos, setSelectedInsumos] = useState<SelectedInsumo[]>([]);
  /** Nome da opção de serviço (acabamento sem insumo) */
  const [serviceOptionName, setServiceOptionName] = useState('');

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
      kind: forcedKind || newGroupKind,
      required: true,
      displayOrder: groups.length + 1,
      options: [],
    };
    onChange([...groups, newGroup]);
    setNewGroupName('');
    setNewGroupKind('VARIATION');
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
    const group = groups.find((g) => g.id === groupId);
    const baseOrder = group ? group.options.length : 0;
    // Para VARIATION sempre criamos como Preço Base que substitui o R$/m².
    const effectiveScope = group?.kind === 'VARIATION' ? 'REPLACE_RATE' : newOptionScope;
    const val = parseFloat(newOptionValue) || 0;

    // Mapeia o escopo para os campos do modelo
    const scopeFields = (() => {
      switch (effectiveScope) {
        case 'REPLACE_RATE':
          return { priceModifier: 0, fixedValue: val, priceModifierType: 'PER_AREA' as const };
        case 'ADD_PER_AREA':
          return { priceModifier: val, fixedValue: null, priceModifierType: 'PER_AREA' as const };
        case 'ADD_FLAT':
        default:
          return { priceModifier: val, fixedValue: null, priceModifierType: 'FIXED' as const };
      }
    })();

    // Campos de quantidade (só fazem sentido em Acabamentos)
    const qtyFields = group?.kind === 'FINISHING'
      ? {
          defaultQuantity: newOptionDefaultQty.trim() === '' ? null : Number(newOptionDefaultQty),
          minQuantity:     newOptionMinQty.trim()     === '' ? null : Number(newOptionMinQty),
          maxQuantity:     newOptionMaxQty.trim()     === '' ? null : Number(newOptionMaxQty),
          allowCustomQty:  newOptionAllowCustomQty,
        }
      : {};

    if (selectedInsumos.length > 0) {
      const newOptions: DraftOption[] = selectedInsumos.map((insumo, idx) => ({
        id: tempId(),
        label: insumo.editedLabel.trim() || insumo.rawName.trim(),
        value: (insumo.editedLabel.trim() || insumo.rawName.trim()).toLowerCase().replace(/\s+/g, '_'),
        ...scopeFields,
        ...qtyFields,
        materialId: insumo.id,
        isAvailable: true,
        displayOrder: baseOrder + idx + 1,
      }));
      onChange(groups.map((g) =>
        g.id === groupId ? { ...g, options: [...g.options, ...newOptions] } : g
      ));
    } else if (serviceOptionName.trim()) {
      const newOption: DraftOption = {
        id: tempId(),
        label: serviceOptionName.trim(),
        value: serviceOptionName.trim().toLowerCase().replace(/\s+/g, '_'),
        ...scopeFields,
        ...qtyFields,
        materialId: null as any,
        isAvailable: true,
        displayOrder: baseOrder + 1,
      };
      onChange(groups.map((g) =>
        g.id === groupId ? { ...g, options: [...g.options, newOption] } : g
      ));
    }

    setSelectedInsumos([]);
    setServiceOptionName('');
    setNewOptionValue('0');
    setNewOptionScope('ADD_FLAT');
    setNewOptionDefaultQty('');
    setNewOptionMinQty('');
    setNewOptionMaxQty('');
    setNewOptionAllowCustomQty(false);
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
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              {isFinishingTab ? 'Acabamentos' : 'Grade de Variações'}
            </h3>
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
          {/* ── Seletor de TIPO DE GRUPO (escondido quando forcedKind) ── */}
          {!forcedKind && (
          <div className="space-y-2 mb-5">
            <label className="text-[10px] font-black uppercase text-amber-700">Tipo de Grupo</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KindCard
                active={newGroupKind === 'VARIATION'}
                onClick={() => setNewGroupKind('VARIATION')}
                icon={<Layers className="w-5 h-5" />}
                title="Variação"
                description="Define identidade do produto. Cliente escolhe UMA opção. Gera SKUs separados no catálogo."
                examples="Cor · Tamanho · Papel · Modelo"
                accent="indigo"
              />
              <KindCard
                active={newGroupKind === 'FINISHING'}
                onClick={() => setNewGroupKind('FINISHING')}
                icon={<Wrench className="w-5 h-5" />}
                title="Acabamento"
                description="Soma materiais/processos ao item. Cliente pode COMBINAR várias. Não expande SKUs."
                examples="Ilhos · Plastificação · Encadernação · Corte"
                accent="emerald"
              />
            </div>
          </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-amber-700">Nome do Grupo</label>
            <input
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
              className="w-full h-10 px-4 rounded-xl border-2 border-amber-100 focus:border-amber-500 focus:outline-none font-bold text-slate-700"
              placeholder={newGroupKind === 'FINISHING' ? 'Ex: Acabamento, Extras' : 'Ex: Cor, Papel, Tamanho'}
            />
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
                  <div className="flex items-center gap-3 flex-wrap">
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
                    {/* Badge do KIND — escondida quando cada tab já define o kind */}
                    {!forcedKind && (
                      <KindBadge
                        kind={group.kind}
                        editable={isGlobalEditing}
                        onToggle={(e) => {
                          e.stopPropagation();
                          handleUpdateGroup(group.id, {
                            kind: group.kind === 'FINISHING' ? 'VARIATION' : 'FINISHING'
                          });
                        }}
                      />
                    )}
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
                        groupKind={group.kind}
                        isSelected={selectedOptionIds[group.id] === option.id}
                        insumos={insumos}
                        allGroups={groups}
                        currentGroupId={group.id}
                        onSelect={() => onSelectOption(group.id, option.id)}
                        onDelete={() => handleDeleteOption(group.id, option.id)}
                        onChange={(patch) => updateOption(group.id, option.id, patch)}
                        isGlobalEditing={isGlobalEditing}
                        pricingMode={pricingMode}
                        formulaVariables={formulaVariables}
                      />
                    ))}

                    {/* Add Option Form */}
                    {addingToGroup === group.id ? (
                      <div className="p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-4 animate-in slide-in-from-top duration-200">
                        {/* ── Nome do serviço OU seleção de insumos ── */}
                        {group.kind === 'FINISHING' && (
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-slate-400">
                              Nome do Acabamento (serviço sem insumo)
                            </p>
                            <input
                              type="text"
                              value={serviceOptionName}
                              onChange={(e) => setServiceOptionName(e.target.value)}
                              placeholder="Ex: Recorte, Dobra, Vinco..."
                              className="w-full h-10 px-3 text-sm bg-white border-2 border-slate-200 rounded-lg focus:border-amber-400 focus:ring-2 focus:ring-amber-100 focus:outline-none transition-all"
                            />
                            {!serviceOptionName.trim() && (
                              <p className="text-[9px] text-slate-400 italic">ou vincule a um insumo abaixo ↓</p>
                            )}
                          </div>
                        )}

                        {/* ── Seleção múltipla de insumos ── */}
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-slate-400">
                            {group.kind === 'FINISHING' ? 'Vincular Insumo (opcional)' : 'Selecionar Insumos (nome da variação = nome do insumo)'}
                          </p>
                          <MultiInsumoCombobox
                            options={insumos
                              .filter((i: any) => !group.options.some(o => o.materialId === i.id))
                              .map((i: any) => ({
                                id: i.id,
                                label: i.name || i.nome,
                                sublabel: buildInsumoSublabel(i),
                              }))}
                            selected={selectedInsumos}
                            onChangeSelected={setSelectedInsumos}
                            placeholder="Pesquisar e selecionar insumos..."
                          />
                        </div>

                        {/* ── Precificação da Opção (3 escopos para Acabamentos) ── */}
                        <div className="space-y-1 w-full md:w-1/2">
                          <p className="text-[9px] font-black uppercase text-slate-400" title="Como essa opção afeta o preço do produto?">Regra de Preço</p>
                          {group.kind === 'VARIATION' ? (
                            <div className="flex bg-white rounded-lg border-2 border-slate-200 overflow-hidden focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition-all">
                              <span className="h-10 px-3 bg-slate-50 border-r-2 border-slate-100 text-xs font-bold text-slate-600 flex items-center">Preço (R$)</span>
                              <input
                                type="number"
                                value={newOptionValue}
                                onChange={(e) => setNewOptionValue(e.target.value)}
                                className="flex-1 h-10 px-3 text-sm font-black text-center focus:outline-none text-indigo-600"
                                placeholder="0"
                              />
                            </div>
                          ) : (
                            <>
                              {/* Segmented 3 estados — espelha o seletor da opção já criada */}
                              <div className="inline-flex w-full rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-50 mb-1">
                                {([
                                  { id: 'REPLACE_RATE', label: 'Substitui R$/m²', active: 'bg-indigo-100 text-indigo-700' },
                                  { id: 'ADD_PER_AREA', label: '+ R$/m²', active: 'bg-violet-100 text-violet-700' },
                                  { id: 'ADD_FLAT',     label: '+ R$ fixo', active: 'bg-emerald-100 text-emerald-700' },
                                ] as const).map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setNewOptionScope(s.id)}
                                    className={cn(
                                      'flex-1 h-9 text-[10px] font-black uppercase tracking-wider transition-all border-r border-slate-200 last:border-r-0',
                                      newOptionScope === s.id ? s.active : 'text-slate-500 hover:bg-white'
                                    )}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex bg-white rounded-lg border-2 border-slate-200 overflow-hidden focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition-all">
                                <span className="h-10 px-3 bg-slate-50 border-r-2 border-slate-100 text-xs font-bold text-slate-600 flex items-center">R$</span>
                                <input
                                  type="number"
                                  value={newOptionValue}
                                  onChange={(e) => setNewOptionValue(e.target.value)}
                                  className={cn(
                                    'flex-1 h-10 px-3 text-sm font-black text-center focus:outline-none',
                                    newOptionScope === 'ADD_FLAT' ? 'text-emerald-600' :
                                    newOptionScope === 'ADD_PER_AREA' ? 'text-violet-600' : 'text-indigo-600'
                                  )}
                                  placeholder="0"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        {/* ── Painel de QUANTIDADE — espelha o painel do OptionCard editado ── */}
                        {group.kind === 'FINISHING' && (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Wrench className="w-3 h-3 text-emerald-600" />
                              <p className="text-[9px] font-black uppercase text-emerald-700">
                                Quantidade consumida deste acabamento
                              </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <label className="text-[8px] font-black uppercase text-slate-500">Padrão</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={newOptionDefaultQty}
                                  onChange={(e) => setNewOptionDefaultQty(e.target.value)}
                                  placeholder="Ex: 8"
                                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] font-black uppercase text-slate-500">Mínima</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={newOptionMinQty}
                                  onChange={(e) => setNewOptionMinQty(e.target.value)}
                                  placeholder="—"
                                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] font-black uppercase text-slate-500">Máxima</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={newOptionMaxQty}
                                  onChange={(e) => setNewOptionMaxQty(e.target.value)}
                                  placeholder="—"
                                  className="w-full h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] font-black uppercase text-slate-500">Vendedor edita?</label>
                                <button
                                  type="button"
                                  onClick={() => setNewOptionAllowCustomQty((v) => !v)}
                                  className={cn(
                                    'w-full h-8 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors',
                                    newOptionAllowCustomQty
                                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                  )}
                                >
                                  {newOptionAllowCustomQty ? 'Sim · permite ajustar' : 'Não · qty fixa'}
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                              Quantidade padrão consumida quando este acabamento é selecionado no pedido.
                              Ex: <span className="font-bold">Ilhos = 8</span>, <span className="font-bold">Cabo de Banner = 2</span>.
                              Quando "Vendedor edita" está ativo, o vendedor pode ajustar a quantidade no pedido.
                            </p>
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/50">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setAddingToGroup(null);
                              setSelectedInsumos([]);
                              setServiceOptionName('');
                            }}
                            className="h-10 px-6 font-bold text-slate-500"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={() => handleAddOption(group.id)}
                            disabled={selectedInsumos.length === 0 && !serviceOptionName.trim()}
                            className="h-10 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black disabled:opacity-40"
                          >
                            {selectedInsumos.length > 1
                              ? `Adicionar ${selectedInsumos.length} Opções`
                              : 'Adicionar Opção'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingToGroup(group.id);
                          setNewOptionValue('0');
                          setSelectedInsumos([]);
                        }}
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 text-xs font-black uppercase tracking-wide text-amber-700 bg-amber-50 hover:bg-amber-100 border-2 border-dashed border-amber-400 hover:border-amber-500 hover:text-amber-800 rounded-xl transition-all shadow-sm hover:shadow"
                      >
                        <Plus className="w-4 h-4" /> Adicionar Opção / Vincular Material
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

// ─── Card de seleção de TIPO DE GRUPO (Variação | Acabamento) ────────────────
const KindCard: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  examples: string;
  accent: 'indigo' | 'emerald';
}> = ({ active, onClick, icon, title, description, examples, accent }) => {
  const palette = accent === 'indigo'
    ? {
        on: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200',
        off: 'border-slate-200 bg-white hover:border-indigo-300',
        iconOn: 'bg-indigo-500 text-white',
        iconOff: 'bg-slate-100 text-slate-400',
        titleOn: 'text-indigo-700',
        titleOff: 'text-slate-700',
        examplesOn: 'text-indigo-600',
        examplesOff: 'text-slate-400'
      }
    : {
        on: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200',
        off: 'border-slate-200 bg-white hover:border-emerald-300',
        iconOn: 'bg-emerald-500 text-white',
        iconOff: 'bg-slate-100 text-slate-400',
        titleOn: 'text-emerald-700',
        titleOff: 'text-slate-700',
        examplesOn: 'text-emerald-600',
        examplesOff: 'text-slate-400'
      };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative text-left p-4 rounded-xl border-2 transition-all duration-150',
        active ? palette.on : palette.off
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
          active ? palette.iconOn : palette.iconOff
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-black uppercase tracking-wider', active ? palette.titleOn : palette.titleOff)}>
              {title}
            </span>
            {active && <CheckCircle2 className={cn('w-4 h-4', accent === 'indigo' ? 'text-indigo-500' : 'text-emerald-500')} />}
          </div>
          <p className="text-[11px] text-slate-600 leading-tight mt-1">{description}</p>
          <p className={cn('text-[9px] font-bold uppercase tracking-wider mt-2', active ? palette.examplesOn : palette.examplesOff)}>
            {examples}
          </p>
        </div>
      </div>
    </button>
  );
};

// ─── Badge compacto do KIND (lê-only ou clicável em edição) ──────────────────
const KindBadge: React.FC<{
  kind: ConfigurationKind;
  editable: boolean;
  onToggle: (e: React.MouseEvent) => void;
}> = ({ kind, editable, onToggle }) => {
  const isFinishing = kind === 'FINISHING';
  const className = cn(
    'inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all',
    isFinishing
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-indigo-700 bg-indigo-50 border-indigo-200',
    editable && 'cursor-pointer hover:scale-105 ring-2 ring-amber-200 hover:ring-amber-400'
  );
  const Icon = isFinishing ? Wrench : Layers;

  if (!editable) {
    return (
      <span className={className} title={isFinishing ? 'Acabamento — multi-select, soma materiais' : 'Variação — exclusivo, gera SKU'}>
        <Icon className="w-2.5 h-2.5" />
        {isFinishing ? 'Acabamento' : 'Variação'}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={className}
      title="Clique para alternar entre Variação / Acabamento"
    >
      <Icon className="w-2.5 h-2.5" />
      {isFinishing ? 'Acabamento' : 'Variação'}
      <span className="text-[8px] opacity-60 ml-0.5">↻</span>
    </button>
  );
};

// ─── Option Card ──────────────────────────────────────────────────────────────
const OptionCard = ({
  option,
  groupKind,
  isSelected,
  insumos,
  allGroups,
  currentGroupId,
  onSelect,
  onDelete,
  onChange,
  isGlobalEditing = false,
  pricingMode,
  formulaVariables = []
}: {
  option: DraftOption;
  groupKind: ConfigurationKind;
  isSelected: boolean;
  insumos: any[];
  allGroups: DraftVariationGroup[];
  currentGroupId: string;
  onSelect: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<DraftOption>) => void;
  pricingMode?: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
  formulaVariables?: FormulaVariable[];
  isGlobalEditing?: boolean;
}) => {
  const isFinishing = groupKind === 'FINISHING';
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
            {option.allowedChildIds && option.allowedChildIds.length > 0 && (
              <span className="text-[9px] font-black uppercase text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ↳ {option.allowedChildIds.length} variação(ões) vinculada(s)
              </span>
            )}
          </div>
        </div>

        {/* ── Seletor de Escopo (3 estados) — apenas ACABAMENTOS ────────────
            Unifica os antigos controles "Adicional/Preço Base" + toggle "+NO M²/+NO TOTAL"
            em um único segmented control de 3 estados mutuamente exclusivos:
              • REPLACE_RATE  — Substitui R$/m²   (fixedValue + PER_AREA)
              • ADD_PER_AREA  — Soma ao R$/m²     (priceModifier + PER_AREA)
              • ADD_FLAT      — Soma fixo no total (priceModifier + FIXED)
            Para VARIATION, mantém o display simples (preço base puro). */}
        {(() => {
          const isParentFilter =
            option.allowedChildIds && option.allowedChildIds.length > 0;
          if (isParentFilter) return null;

          // ─── Motor DINÂMICO: segmented Substitui / Soma / Soma Preço Final ───
          // Em vez de operar em R$/m² (conceito do motor SIMPLE_AREA), as opções
          // vinculam-se a variáveis nomeadas da fórmula configurada no produto.
          if (pricingMode === 'DYNAMIC_ENGINEER' && groupKind !== 'VARIATION') {
            type DynOp = 'REPLACE_VAR' | 'ADD_VAR' | 'ADD_FINAL';
            const currentOp: DynOp = (option.formulaOp as DynOp) || 'ADD_FINAL';
            const currentValue = Number(option.priceModifier ?? 0);

            const applyDyn = (op: DynOp, val: number, target?: string | null) => {
              const patch: Partial<DraftOption> = {
                formulaOp: op,
                priceModifier: val,
                fixedValue: null,
              };
              if (op === 'ADD_FINAL') {
                patch.formulaVariableTarget = null;
                patch.priceModifierType = 'FIXED'; // mantém compat com cálculo de modifiers
              } else {
                patch.formulaVariableTarget = target ?? option.formulaVariableTarget ?? null;
                patch.priceModifierType = 'FIXED';
              }
              onChange(patch);
            };

            const opMeta: Record<DynOp, { label: string; activeClass: string; valueColor: string; tooltip: string }> = {
              REPLACE_VAR: {
                label: 'SUBSTITUI',
                activeClass: 'bg-indigo-100 text-indigo-700 border-indigo-300',
                valueColor: 'text-indigo-600',
                tooltip: 'Substitui o valor da variável selecionada da fórmula.',
              },
              ADD_VAR: {
                label: 'SOMA',
                activeClass: 'bg-violet-100 text-violet-700 border-violet-300',
                valueColor: 'text-violet-600',
                tooltip: 'Soma o valor à variável selecionada da fórmula.',
              },
              ADD_FINAL: {
                label: 'SOMA PREÇO FINAL',
                activeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300',
                valueColor: 'text-emerald-600',
                tooltip: 'Soma fixo no total do item, sem mexer em variáveis da fórmula.',
              },
            };
            const ops: DynOp[] = ['REPLACE_VAR', 'ADD_VAR', 'ADD_FINAL'];
            const needsVarTarget = currentOp === 'REPLACE_VAR' || currentOp === 'ADD_VAR';

            // Read-only
            if (!isGlobalEditing) {
              const meta = opMeta[currentOp];
              return (
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider', meta.activeClass)}>
                    {meta.label}
                  </span>
                  {needsVarTarget && option.formulaVariableTarget && (
                    <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[9px] font-bold text-slate-600 uppercase tracking-wide">
                      {option.formulaVariableTarget}
                    </span>
                  )}
                  <div className="w-20 text-right">
                    <InlineInput
                      type="number"
                      initialValue={currentValue}
                      isEditing={false}
                      formatAsCurrency={true}
                      onSave={() => {}}
                      className={cn('text-sm font-black pr-1', meta.valueColor)}
                    />
                  </div>
                </div>
              );
            }

            // Editing
            return (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  {ops.map((o) => {
                    const meta = opMeta[o];
                    const isActive = currentOp === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => applyDyn(o, currentValue, option.formulaVariableTarget)}
                        title={meta.tooltip}
                        className={cn(
                          'px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-all border-r border-slate-200 last:border-r-0',
                          isActive ? meta.activeClass : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  {needsVarTarget && (
                    <select
                      value={option.formulaVariableTarget || ''}
                      onChange={(e) => applyDyn(currentOp, currentValue, e.target.value || null)}
                      className={cn(
                        'h-8 text-[10px] font-bold px-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-[120px]',
                        option.formulaVariableTarget ? 'border-indigo-200 text-indigo-700' : 'border-red-200 text-red-500'
                      )}
                    >
                      <option value="">— Variável —</option>
                      {formulaVariables.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name || v.label || v.id}
                        </option>
                      ))}
                    </select>
                  )}
                  <InlineInput
                    type="number"
                    initialValue={currentValue}
                    isEditing={true}
                    formatAsCurrency={true}
                    onSave={(val) => applyDyn(currentOp, parseFloat(val) || 0, option.formulaVariableTarget)}
                    className={cn(
                      'text-right font-black w-32 h-8 text-center',
                      opMeta[currentOp].valueColor,
                      currentOp === 'REPLACE_VAR' ? 'border-indigo-200' :
                      currentOp === 'ADD_VAR' ? 'border-violet-200' : 'border-emerald-200'
                    )}
                  />
                </div>
                {needsVarTarget && !option.formulaVariableTarget && (
                  <p className="text-[9px] text-red-500 font-bold italic">
                    Selecione uma variável da fórmula
                  </p>
                )}
                {formulaVariables.length === 0 && (
                  <p className="text-[9px] text-amber-600 font-bold italic">
                    Configure uma regra de fórmula no Motor de Precificação
                  </p>
                )}
              </div>
            );
          }

          // Detecta o escopo atual a partir da combinação de campos
          type Scope = 'REPLACE_RATE' | 'ADD_PER_AREA' | 'ADD_FLAT';
          const currentScope: Scope =
            option.fixedValue != null
              ? (option.priceModifierType === 'FIXED' ? 'ADD_FLAT' : 'REPLACE_RATE')
              : (option.priceModifierType === 'PER_AREA' ? 'ADD_PER_AREA' : 'ADD_FLAT');

          // Valor numérico exibido independente do escopo
          const currentValue =
            option.fixedValue != null
              ? Number(option.fixedValue)
              : Number(option.priceModifier ?? 0);

          // Aplica o escopo ao modelo (normaliza priceModifier/fixedValue/type)
          const applyScope = (scope: Scope, val: number) => {
            if (scope === 'REPLACE_RATE') {
              onChange({ fixedValue: val, priceModifier: 0, priceModifierType: 'PER_AREA' });
            } else if (scope === 'ADD_PER_AREA') {
              onChange({ fixedValue: null, priceModifier: val, priceModifierType: 'PER_AREA' });
            } else {
              onChange({ fixedValue: null, priceModifier: val, priceModifierType: 'FIXED' });
            }
          };

          // Para VARIATION mantemos display simples (Preço Base, sem segmented)
          if (groupKind === 'VARIATION') {
            return (
              <div className="flex flex-col items-end shrink-0 w-28">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Preço Base</p>
                <InlineInput
                  type="number"
                  initialValue={option.fixedValue ?? option.priceModifier ?? 0}
                  isEditing={isGlobalEditing}
                  formatAsCurrency={true}
                  onSave={(val) => onChange({ fixedValue: parseFloat(val) || 0, priceModifier: 0 })}
                  className={cn(
                    'text-right font-black text-indigo-600',
                    isGlobalEditing ? 'w-full h-8 border-indigo-200 text-center' : 'text-sm pr-1'
                  )}
                />
              </div>
            );
          }

          // Estilos por escopo (cor distinta para cada modo)
          const scopeMeta: Record<Scope, { label: string; activeClass: string; valueColor: string; tooltip: string }> = {
            REPLACE_RATE: {
              label: 'SUBSTITUI R$/M²',
              activeClass: 'bg-indigo-100 text-indigo-700 border-indigo-300',
              valueColor: 'text-indigo-600',
              tooltip: 'Substitui o preço por m² do produto. Multiplica pela área.',
            },
            ADD_PER_AREA: {
              label: '+ R$/M²',
              activeClass: 'bg-violet-100 text-violet-700 border-violet-300',
              valueColor: 'text-violet-600',
              tooltip: 'Soma ao preço por m² do produto. Multiplica pela área.',
            },
            ADD_FLAT: {
              label: '+ R$ FIXO',
              activeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300',
              valueColor: 'text-emerald-600',
              tooltip: 'Soma fixo no total do item. Não multiplica pela área.',
            },
          };

          const scopes: Scope[] = ['REPLACE_RATE', 'ADD_PER_AREA', 'ADD_FLAT'];

          // Read-only: só badge do escopo atual + valor
          if (!isGlobalEditing) {
            const meta = scopeMeta[currentScope];
            return (
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  'px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider',
                  meta.activeClass
                )}>
                  {meta.label}
                </span>
                <div className="w-20 text-right">
                  <InlineInput
                    type="number"
                    initialValue={currentValue}
                    isEditing={false}
                    formatAsCurrency={true}
                    onSave={() => {}}
                    className={cn('text-sm font-black pr-1', meta.valueColor)}
                  />
                </div>
              </div>
            );
          }

          // Editing: segmented control de 3 botões + input do valor
          return (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                {scopes.map((s) => {
                  const meta = scopeMeta[s];
                  const isActive = currentScope === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => applyScope(s, currentValue)}
                      title={meta.tooltip}
                      className={cn(
                        'px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-all border-r border-slate-200 last:border-r-0',
                        isActive
                          ? meta.activeClass
                          : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'
                      )}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <InlineInput
                type="number"
                initialValue={currentValue}
                isEditing={true}
                formatAsCurrency={true}
                onSave={(val) => applyScope(currentScope, parseFloat(val) || 0)}
                className={cn(
                  'text-right font-black w-32 h-8 text-center',
                  scopeMeta[currentScope].valueColor,
                  currentScope === 'REPLACE_RATE' ? 'border-indigo-200' :
                  currentScope === 'ADD_PER_AREA' ? 'border-violet-200' : 'border-emerald-200'
                )}
              />
            </div>
          );
        })()}

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
        <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50 animate-in slide-in-from-top duration-150 space-y-4">
          {/* ── Variações Compatíveis (cascata) ── */}
          {(() => {
            const groupIdx = allGroups.findIndex(g => g.id === currentGroupId);
            const laterGroups = allGroups.slice(groupIdx + 1).filter(g => g.options.length > 0);
            if (laterGroups.length === 0) return null;
            const currentChildIds = option.allowedChildIds || [];
            return (
              <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                <p className="text-[9px] font-black uppercase text-amber-700 mb-2">
                  Variações compatíveis com "{option.label}"
                </p>
                <p className="text-[9px] text-slate-500 mb-3">
                  Marque quais opções dos próximos grupos ficam disponíveis quando "{option.label}" estiver selecionado. Se nenhuma for marcada e outras opções deste grupo tiverem vínculos, esta opção não combinará com aquele grupo.
                </p>
                {laterGroups.map(lg => (
                  <div key={lg.id} className="mb-2">
                    <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">{lg.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {lg.options.map(childOpt => {
                        const isChecked = currentChildIds.includes(childOpt.id);
                        return (
                          <label
                            key={childOpt.id}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-all select-none',
                              isChecked
                                ? 'border-amber-400 bg-amber-100 text-amber-800'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const next = isChecked
                                  ? currentChildIds.filter((id: string) => id !== childOpt.id)
                                  : [...currentChildIds, childOpt.id];
                                const patch: any = { allowedChildIds: next.length > 0 ? next : null };
                                if (next.length > 0) {
                                  if (option.materialId) patch.materialId = null;
                                  patch.priceModifier = 0;
                                  patch.fixedValue = null;
                                }
                                onChange(patch);
                              }}
                              className="sr-only"
                            />
                            <span className={cn(
                              'w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0',
                              isChecked ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
                            )}>
                              {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                            </span>
                            {childOpt.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Vincular Material — oculto se opção é grupo-pai (tem allowedChildIds) ── */}
          {!(option.allowedChildIds && option.allowedChildIds.length > 0) && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
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
                allowClear
                clearLabel="Remover Material"
                className={cn("h-10 text-[10px] transition-all", isGlobalEditing ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-100")}
                options={insumos.map((i: any) => ({
                  id: i.id,
                  label: i.name || i.nome,
                  sublabel: buildInsumoSublabel(i),
                }))}
              />
            </div>
          )}

          {/* ── Painel de QUANTIDADE — só para grupos ACABAMENTO ── */}
          {isFinishing && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-3 h-3 text-emerald-600" />
                <p className="text-[9px] font-black uppercase text-emerald-700">
                  Quantidade consumida deste acabamento
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-500">Padrão</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={option.defaultQuantity ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange({ defaultQuantity: v === '' ? null : Number(v) });
                    }}
                    placeholder="Ex: 8"
                    className="w-full h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-500">Mínima</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={option.minQuantity ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange({ minQuantity: v === '' ? null : Number(v) });
                    }}
                    placeholder="—"
                    className="w-full h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-500">Máxima</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={option.maxQuantity ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange({ maxQuantity: v === '' ? null : Number(v) });
                    }}
                    placeholder="—"
                    className="w-full h-8 px-2 text-xs border border-slate-200 rounded-md bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase text-slate-500">Vendedor edita?</label>
                  <button
                    type="button"
                    onClick={() => onChange({ allowCustomQty: !option.allowCustomQty })}
                    className={cn(
                      'w-full h-8 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors',
                      option.allowCustomQty
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                    )}
                  >
                    {option.allowCustomQty ? 'Sim · permite ajustar' : 'Não · qty fixa'}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                Quantidade padrão de material consumido quando este acabamento é selecionado no pedido.
                Ex: <span className="font-bold">Ilhos = 8</span>, <span className="font-bold">Cabo de Banner = 2</span>.
                Quando "Vendedor edita" está ativo, o vendedor poderá ajustar a quantidade no pedido.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
