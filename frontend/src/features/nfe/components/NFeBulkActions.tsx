import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  PackageCheck,
  Trash2,
  Tag,
  X,
  Check
} from 'lucide-react';

interface NFeBulkActionsProps {
  selectedCount: number;
  onClear: () => void;
  onBulkUpdate: (data: any) => void;
  categories: any[];
  activeCategoryId?: string | 'mixed';
}

export const NFeBulkActions: React.FC<NFeBulkActionsProps> = ({
  selectedCount,
  onClear,
  onBulkUpdate,
  categories,
  activeCategoryId
}) => {
  if (selectedCount === 0) return null;

  const activeCategoryName = activeCategoryId && activeCategoryId !== 'mixed'
    ? categories.find(c => c.id === activeCategoryId)?.name
    : null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-300">
      <div className="bg-white rounded-xl shadow-xl ring-1 ring-slate-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
          <div className="bg-primary text-primary-foreground h-7 min-w-[28px] px-1.5 rounded-md flex items-center justify-center font-bold text-xs">
            {selectedCount}
          </div>
          <span className="text-xs font-semibold text-slate-700">
            {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Categoria com indicador da seleção atual */}
          <div className="group relative">
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 gap-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Tag className="w-3.5 h-3.5 text-primary" />
              Categoria
              {activeCategoryName && (
                <span className="text-[11px] font-medium text-primary truncate max-w-[140px]">
                  · {activeCategoryName}
                </span>
              )}
              {activeCategoryId === 'mixed' && (
                <span className="text-[11px] font-medium text-amber-600">· várias</span>
              )}
            </Button>
            <div className="absolute bottom-full left-0 hidden group-hover:block pb-2 min-w-[280px] z-[100]">
              <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xl max-h-72 overflow-y-auto w-full">
                <p className="px-2 py-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-100 mb-1">
                  Definir categoria contábil
                </p>
                {categories.map(cat => {
                  const isActive = activeCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => onBulkUpdate({
                        categoryId: cat.id,
                        createNew: true,
                        skip: false
                      })}
                      className={cn(
                        "w-full text-left px-2.5 py-2 text-xs rounded-md transition-colors flex items-center gap-2.5",
                        isActive ? "bg-primary/10" : "hover:bg-slate-50"
                      )}
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          isActive ? "bg-primary border-primary" : "border-slate-300"
                        )}
                      >
                        {isActive && <Check className="w-2.5 h-2.5 text-white stroke-[4]" />}
                      </span>
                      <span className={cn("font-semibold", isActive ? "text-primary" : "text-slate-700")}>
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => onBulkUpdate({ createNew: true, skip: false })}
            variant="ghost"
            className="h-9 px-3 gap-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
            Marcar Novos
          </Button>

          <Button
            type="button"
            onClick={() => onBulkUpdate({ skip: true, createNew: false, mappedMaterialId: undefined })}
            variant="ghost"
            className="h-9 px-3 gap-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            Ignorar
          </Button>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="ml-1 p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-slate-600"
          title="Limpar seleção"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
