import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { X, Check } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface DefaultCategoriesModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_CATEGORIES = [
  // Receitas
  { id: 'inc_1', name: 'Venda de Impressos', type: 'INCOME', color: '#10B981' },
  { id: 'inc_2', name: 'Serviços Gráficos e Arte', type: 'INCOME', color: '#059669' },
  { id: 'inc_3', name: 'Venda de Papelaria', type: 'INCOME', color: '#34D399' },
  { id: 'inc_4', name: 'Encadernação e Acabamento', type: 'INCOME', color: '#6EE7B7' },
  { id: 'inc_5', name: 'Outras Receitas', type: 'INCOME', color: '#A7F3D0' },
  // Despesas
  { id: 'exp_1', name: 'Cartuchos, Toners e Tintas', type: 'EXPENSE', color: '#EF4444' },
  { id: 'exp_2', name: 'Papel e Mídias de Impressão', type: 'EXPENSE', color: '#DC2626' },
  { id: 'exp_3', name: 'Materiais para Revenda (Papelaria)', type: 'EXPENSE', color: '#B91C1C' },
  { id: 'exp_4', name: 'Manutenção de Máquinas', type: 'EXPENSE', color: '#991B1B' },
  { id: 'exp_5', name: 'Folha de Pagamento', type: 'EXPENSE', color: '#F59E0B' },
  { id: 'exp_6', name: 'Água, Luz e Internet', type: 'EXPENSE', color: '#6366F1' },
  { id: 'exp_7', name: 'Aluguel e Condomínio', type: 'EXPENSE', color: '#4F46E5' },
  { id: 'exp_8', name: 'Entregas e Fretes', type: 'EXPENSE', color: '#3B82F6' },
  { id: 'exp_9', name: 'Impostos e Taxas', type: 'EXPENSE', color: '#D97706' },
];

export const DefaultCategoriesModal: React.FC<DefaultCategoriesModalProps> = ({ onClose, onSuccess }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCategory = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAll = (type?: 'INCOME' | 'EXPENSE') => {
    if (!type) {
      setSelectedIds(DEFAULT_CATEGORIES.map(c => c.id));
      return;
    }
    const ids = DEFAULT_CATEGORIES.filter(c => c.type === type).map(c => c.id);
    setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const deselectAll = (type?: 'INCOME' | 'EXPENSE') => {
    if (!type) {
      setSelectedIds([]);
      return;
    }
    const ids = DEFAULT_CATEGORIES.filter(c => c.type === type).map(c => c.id);
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) {
      toast.error('Selecione pelo menos uma categoria.');
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    const categoriesToImport = DEFAULT_CATEGORIES.filter(c => selectedIds.includes(c.id));

    try {
      // Create sequentially to keep the order in the database and avoid pounding the server
      for (const cat of categoriesToImport) {
        await api.post('/api/finance/categories', {
          name: cat.name,
          type: cat.type,
          color: cat.color
        });
        successCount++;
      }
      toast.success(`${successCount} categorias importadas com sucesso!`);
      onSuccess();
    } catch (error: any) {
      toast.error(`Erro após importar ${successCount} categorias: ${error.message || 'Falha na comunicação'}`);
      if (successCount > 0) {
        onSuccess(); // Still refresh if some succeeded
      } else {
        setIsSubmitting(false);
      }
    }
  };

  const incomes = DEFAULT_CATEGORIES.filter(c => c.type === 'INCOME');
  const expenses = DEFAULT_CATEGORIES.filter(c => c.type === 'EXPENSE');

  return (
    <div className="modal-overlay z-[9999] flex items-center justify-center p-4">
      <Card className="modal-content-card max-w-2xl w-full max-h-[90vh] flex flex-col">
        <CardHeader className="bg-slate-50 border-b shrink-0 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl text-primary">Categorias Padrão</CardTitle>
            <CardDescription className="mt-1">
              Catálogo de categorias otimizado para o segmento de <strong>Gráfica e Papelaria</strong>.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        
        <CardContent className="overflow-y-auto p-6 space-y-6">
          {/* Receitas */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-green-700">Receitas</h3>
              <div className="space-x-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => selectAll('INCOME')}>Todas</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => deselectAll('INCOME')}>Nenhuma</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {incomes.map(cat => (
                <div 
                  key={cat.id} 
                  className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-colors ${selectedIds.includes(cat.id) ? 'bg-green-50 border-green-200' : 'hover:bg-slate-50'}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <input 
                    type="checkbox"
                    checked={selectedIds.includes(cat.id)} 
                    onChange={() => toggleCategory(cat.id)}
                    className="w-4 h-4 rounded text-green-600 focus:ring-green-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Despesas */}
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-red-700">Despesas</h3>
              <div className="space-x-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => selectAll('EXPENSE')}>Todas</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => deselectAll('EXPENSE')}>Nenhuma</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {expenses.map(cat => (
                <div 
                  key={cat.id} 
                  className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-colors ${selectedIds.includes(cat.id) ? 'bg-red-50 border-red-200' : 'hover:bg-slate-50'}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <input 
                    type="checkbox"
                    checked={selectedIds.includes(cat.id)} 
                    onChange={() => toggleCategory(cat.id)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-slate-50 border-t p-4 shrink-0 flex justify-between items-center">
          <span className="text-sm text-slate-500 font-medium">
            {selectedIds.length} selecionadas
          </span>
          <div className="space-x-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleImport} disabled={isSubmitting || selectedIds.length === 0}>
              {isSubmitting ? 'Importando...' : 'Importar Selecionadas'}
              {!isSubmitting && <Check className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
