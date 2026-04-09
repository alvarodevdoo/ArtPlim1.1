import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check, Scissors, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComboboxOption } from '@/components/ui/Combobox';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectedInsumo {
  id: string;
  /** Nome bruto do insumo */
  rawName: string;
  /** Nome editável (auto-preenchido com prefixo removido) */
  editedLabel: string;
}

interface MultiInsumoComboboxProps {
  options: ComboboxOption[];
  selected: SelectedInsumo[];
  onChangeSelected: (selected: SelectedInsumo[]) => void;
  placeholder?: string;
  className?: string;
}

// ─── Helper: detecta prefixo comum ───────────────────────────────────────────

/**
 * Encontra o maior prefixo comum entre os nomes usando comparação caractere
 * a caractere (case-insensitive), depois recorta na última fronteira de espaço.
 *
 * Ex: ["CARIMBO PRINTER C20 AZUL", "CARIMBO PRINTER C20 CINZA"]
 *   → "CARIMBO PRINTER C20 "
 */
function detectCommonPrefix(names: string[]): string {
  if (names.length < 2) return '';

  const upper = names.map((n) => n.trim().toUpperCase());

  // Comprimento máximo possível do prefixo = menor string
  let maxLen = upper[0].length;
  for (const n of upper) maxLen = Math.min(maxLen, n.length);

  // Quantos caracteres são iguais em TODOS os nomes
  let commonLen = 0;
  for (let i = 0; i < maxLen; i++) {
    const ch = upper[0][i];
    if (upper.every((n) => n[i] === ch)) {
      commonLen = i + 1;
    } else {
      break;
    }
  }

  if (commonLen === 0) return '';

  // Pega o prefixo com case original do primeiro nome
  let prefix = names[0].substring(0, commonLen);

  // Garante que não termina no meio de uma palavra — corta no último espaço
  if (commonLen < names[0].length && names[0][commonLen] !== ' ') {
    const lastSpace = prefix.lastIndexOf(' ');
    if (lastSpace <= 0) return ''; // sem fronteira de palavra
    prefix = names[0].substring(0, lastSpace + 1);
  } else {
    // Adiciona o espaço separador se não existir
    if (!prefix.endsWith(' ')) prefix += ' ';
  }

  // Não remover se o prefixo engolir o nome inteiro de algum item
  const wouldBeEmpty = names.some((n) => {
    const remainder = n.replace(new RegExp(`^${escapeRegex(prefix.trim())}`, 'i'), '').trim();
    return remainder === '';
  });
  if (wouldBeEmpty) return '';

  return prefix;
}

/**
 * Recalcula os editedLabel de todos os itens aplicando (ou não) o prefixo.
 * Sempre usa rawName como base para evitar cortes duplos.
 */
function applyPrefix(selected: SelectedInsumo[], prefix: string): SelectedInsumo[] {
  return selected.map((s) => ({
    ...s,
    editedLabel: prefix
      ? s.rawName.replace(new RegExp(`^${escapeRegex(prefix)}`, 'i'), '').trim()
      : s.rawName,
  }));
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MultiInsumoCombobox: React.FC<MultiInsumoComboboxProps> = ({
  options,
  selected,
  onChangeSelected,
  placeholder = 'Pesquisar insumo...',
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [prefixToRemove, setPrefixToRemove] = useState('');
  const [manualPrefix, setManualPrefix] = useState('');
  const [editingPrefix, setEditingPrefix] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Detecta prefixo comum e re-aplica nos editedLabels a cada mudança de seleção
  useEffect(() => {
    if (selected.length < 2) {
      setPrefixToRemove('');
      setManualPrefix('');
      // Restaura nomes originais se só sobrou 1 item
      if (selected.length === 1 && selected[0].editedLabel !== selected[0].rawName) {
        onChangeSelected(selected.map((s) => ({ ...s, editedLabel: s.rawName })));
      }
      return;
    }
    const detected = detectCommonPrefix(selected.map((s) => s.rawName));
    setPrefixToRemove(detected);
    setManualPrefix(detected);
    // Re-aplica sempre a partir do rawName para evitar cortes duplos
    onChangeSelected(applyPrefix(selected, detected));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.map((s) => s.id).join(',')]);

  // ── Filtragem
  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        o.sublabel?.toLowerCase().includes(term)
    );
  }, [options, search]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  // ── Toggle item
  const toggleItem = (opt: ComboboxOption) => {
    if (selectedIds.has(opt.id)) {
      // Remove
      const next = selected.filter((s) => s.id !== opt.id);
      onChangeSelected(next);
    } else {
      // Adiciona
      const next: SelectedInsumo[] = [
        ...selected,
        { id: opt.id, rawName: opt.label, editedLabel: opt.label },
      ];
      // Re-detecta prefixo
      const detected = detectCommonPrefix(next.map((s) => s.rawName));
      onChangeSelected(applyPrefix(next, detected));
    }
  };

  // ── Selecionar todos os filtrados
  const selectAllFiltered = () => {
    const newToSelect = filteredOptions.filter(opt => !selectedIds.has(opt.id));
    if (newToSelect.length === 0) return;

    const next: SelectedInsumo[] = [
      ...selected,
      ...newToSelect.map(opt => ({ id: opt.id, rawName: opt.label, editedLabel: opt.label }))
    ];
    
    // Re-detecta prefixo
    const detected = detectCommonPrefix(next.map((s) => s.rawName));
    onChangeSelected(applyPrefix(next, detected));
  };

  // ── Remove item selecionado
  const removeItem = (id: string) => {
    const next = selected.filter((s) => s.id !== id);
    onChangeSelected(next);
  };

  // ── Atualiza label editado
  const updateLabel = (id: string, label: string) => {
    onChangeSelected(selected.map((s) => (s.id === id ? { ...s, editedLabel: label } : s)));
  };

  // ── Aplica prefixo manual
  const applyManualPrefix = () => {
    setPrefixToRemove(manualPrefix);
    onChangeSelected(applyPrefix(selected, manualPrefix));
    setEditingPrefix(false);
  };

  // ── Restaura nomes originais
  const restoreOriginalNames = () => {
    setPrefixToRemove('');
    setManualPrefix('');
    onChangeSelected(selected.map((s) => ({ ...s, editedLabel: s.rawName })));
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* ── Trigger / Search bar ── */}
      <div
        className={cn(
          'w-full min-h-[40px] px-3 py-1.5 rounded-lg border-2 flex items-center gap-2 flex-wrap cursor-text transition-all',
          open ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200 hover:border-slate-300'
        )}
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        {selected.length === 0 && !open && (
          <span className="text-slate-400 text-sm">{placeholder}</span>
        )}

        {/* Chips dos selecionados */}
        {selected.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-md px-2 py-0.5 max-w-[200px]"
          >
            <span className="truncate" title={s.rawName}>{s.editedLabel || s.rawName}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeItem(s.id); }}
              className="shrink-0 hover:text-red-500 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Campo de busca */}
        {open && (
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
            className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
            placeholder={selected.length > 0 ? 'Adicionar mais...' : placeholder}
          />
        )}

        <ChevronDown className={cn('w-4 h-4 text-slate-400 ml-auto shrink-0 transition-transform', open && 'rotate-180')} />
      </div>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-1 duration-150">
          {/* Search input if not inline */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent min-w-[50px] outline-none text-sm text-slate-700 placeholder-slate-400"
              placeholder="Filtrar insumos..."
              autoFocus
            />
            {search && filteredOptions.length > 0 && (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-2 py-1 rounded transition-colors whitespace-nowrap shrink-0"
              >
                Selecionar Todos ({filteredOptions.length})
              </button>
            )}
            {search && (
              <button type="button" onClick={() => setSearch('')} className="shrink-0 p-1">
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 italic">Nenhum insumo encontrado.</div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedIds.has(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleItem(opt)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm',
                      isChecked
                        ? 'bg-indigo-50 text-indigo-800'
                        : 'hover:bg-slate-50 text-slate-700'
                    )}
                  >
                    {/* Checkbox visual */}
                    <div className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                      isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                    )}>
                      {isChecked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{opt.label}</p>
                      {opt.sublabel && (
                        <p className="text-[10px] text-slate-400">{opt.sublabel}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer com contador */}
          {selected.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-2 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {selected.length} insumo{selected.length !== 1 ? 's' : ''} selecionado{selected.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase"
              >
                Confirmar ✓
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Painel de edição de labels (aparece quando há selecionados) ── */}
      {selected.length > 0 && (
        <div className="mt-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-3 space-y-2 animate-in slide-in-from-top duration-200">
          {/* Prefixo comum detectado */}
          {prefixToRemove && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
              <Scissors className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-amber-700 font-semibold flex-1">
                Prefixo comum removido automaticamente:{' '}
                <strong className="font-black">"{prefixToRemove.trim()}"</strong>
              </span>
              <button
                type="button"
                onClick={restoreOriginalNames}
                className="text-amber-600 hover:text-amber-800 font-bold underline shrink-0"
              >
                Desfazer
              </button>
            </div>
          )}

          {/* Edição por prefixo manual */}
          {selected.length >= 2 && (
            <div className="flex items-center gap-2">
              {editingPrefix ? (
                <>
                  <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    value={manualPrefix}
                    onChange={(e) => setManualPrefix(e.target.value)}
                    className="flex-1 text-xs h-7 px-2 rounded-md border border-slate-300 focus:border-amber-400 focus:outline-none"
                    placeholder="Prefixo a remover..."
                  />
                  <button
                    type="button"
                    onClick={applyManualPrefix}
                    className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 uppercase px-2"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingPrefix(false); setManualPrefix(prefixToRemove); }}
                    className="text-[10px] font-bold text-slate-400 uppercase"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingPrefix(true)}
                  className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase transition-colors"
                >
                  <Scissors className="w-3 h-3" />
                  Editar prefixo a remover
                </button>
              )}
            </div>
          )}

          {/* Lista editável de nomes */}
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5">
            Nomes das opções (editáveis):
          </p>
          {selected.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 w-4 text-right shrink-0">{idx + 1}.</span>
              <input
                value={s.editedLabel}
                onChange={(e) => updateLabel(s.id, e.target.value)}
                className="flex-1 text-xs h-8 px-2 rounded-md border border-slate-200 focus:border-amber-400 focus:outline-none font-bold text-slate-700 bg-white"
                placeholder="Nome da opção..."
              />
              <button
                type="button"
                onClick={() => removeItem(s.id)}
                className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                title="Remover"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
