import React from 'react';
import { Button } from '@/components/ui/Button';
import { 
  PackageCheck, 
  Trash2, 
  Tag, 
  X
} from 'lucide-react';

interface NFeBulkActionsProps {
  selectedCount: number;
  onClear: () => void;
  onBulkUpdate: (data: any) => void;
  onBulkSkip: (skip: boolean) => void;
  categories: any[];
}

export const NFeBulkActions: React.FC<NFeBulkActionsProps> = ({
  selectedCount,
  onClear,
  onBulkUpdate,
  onBulkSkip,
  categories
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-300">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6 border border-white/10 backdrop-blur-md bg-opacity-95">
        <div className="flex items-center gap-3 pr-6 border-r border-white/10">
          <div className="bg-primary h-8 w-8 rounded-lg flex items-center justify-center font-black text-sm">
            {selectedCount}
          </div>
          <span className="text-sm font-black uppercase tracking-tight">Itens Selecionados</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Ação: Definir Categoria */}
          <div className="group relative">
            <Button 
               variant="ghost" 
               className="text-white hover:bg-white/10 h-10 gap-2 font-bold text-xs uppercase"
            >
              <Tag className="w-4 h-4 text-primary" />
              Categoria
            </Button>
            <div className="absolute bottom-full left-0 hidden group-hover:block pb-2 min-w-[240px] z-[100]">
              <div className="bg-slate-800 border border-white/10 rounded-xl p-2 shadow-xl max-h-60 overflow-y-auto w-full">
                <p className="px-3 py-2 text-[10px] font-black uppercase text-slate-400 border-b border-white/5 mb-1 text-center">Definir Categoria e Contas</p>
                {categories.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => onBulkUpdate({ 
                      categoryId: cat.id, 
                      createNew: true, 
                      skip: false 
                    })}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 rounded-md transition-colors flex flex-col"
                  >
                    <span className="font-bold">{cat.name}</span>
                    <span className="text-[9px] text-slate-500 italic">Vínculo contábil inteligente</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button 
            onClick={() => onBulkUpdate({ createNew: true, skip: false })}
            variant="ghost" 
            className="text-white hover:bg-white/10 h-10 gap-2 font-bold text-xs uppercase"
          >
            <PackageCheck className="w-4 h-4 text-emerald-400" />
            Marcar Novos
          </Button>

          <Button 
            onClick={() => onBulkSkip(true)}
            variant="ghost" 
            className="text-white hover:bg-white/10 h-10 gap-2 font-bold text-xs uppercase"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            Ignorar
          </Button>
        </div>

        <button 
          onClick={onClear}
          className="ml-4 p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
