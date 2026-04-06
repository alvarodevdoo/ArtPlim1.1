import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus, Search, Settings2, Package, AlertTriangle, CheckCircle2
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/Combobox';
import { MaterialDrawer, type Material } from '@/features/supplies/components/MaterialDrawer';
import { cn } from '@/lib/utils';

const Insumos: React.FC = () => {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const matsRes = await api.get('/api/catalog/materials');
      setMateriais(matsRes.data.data || []);
    } catch (error) {
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrawer = (id: string | null) => {
    setSelectedMaterialId(id);
    setIsDrawerOpen(true);
  };

  const getCategoryName = (cat: any) => {
    if (!cat) return 'Outros';
    if (typeof cat === 'object') return cat.name || 'Outros';
    return String(cat);
  };

  const filtered = materiais.filter(m => {
    const catName = getCategoryName(m.category);
    return (
      (m.name.toLowerCase().includes(searchTerm.toLowerCase()) || catName.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterCategory === 'ALL' || catName === filterCategory)
    )
  });

  const categories = ['ALL', ...new Set(materiais.map(m => getCategoryName(m.category)))];

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Insumos</h1>
          <p className="text-muted-foreground">Controle técnico e financeiro do estoque.</p>
        </div>
        <Button onClick={() => handleOpenDrawer(null)} className="h-12 px-6 shadow-lg shadow-primary/20">
          <Plus className="mr-2 w-4 h-4" /> Novo Insumo
        </Button>
      </div>

      <div className="flex gap-3 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Buscar por nome ou categoria..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-10 h-11 border-2 focus:border-primary/50" 
          />
        </div>
        <Combobox
          value={filterCategory}
          onChange={setFilterCategory}
          options={categories.map(cat => ({ id: cat, label: cat === 'ALL' ? 'Todas Categorias' : cat }))}
          className="w-56 h-11"
        />
      </div>

      <div className="flex-1 bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50 border-b">
              <tr className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                <th className="px-6 py-4">Insumo / Especificação</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Status Estoque</th>
                <th className="px-6 py-4">Saldo Atual</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-muted-foreground animate-pulse">Carregando catálogo...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-muted-foreground italic">Nenhum insumo encontrado.</td></tr>
              ) : filtered.map(m => {
                const stock = getStockStatus(m);
                return (
                  <tr key={m.id} className="hover:bg-muted/30 cursor-pointer group" onClick={() => handleOpenDrawer(m.id)}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono uppercase">{m.id.split('-')[0]} | {m.unit}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {getCategoryName(m.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold", stock.color)}>
                        <stock.icon className="w-3.5 h-3.5" />
                        {stock.label}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-600">
                      {m.trackStock ? (
                        <div className="flex items-baseline gap-1">
                          {m.currentStock || 0}
                          <span className="text-[9px] font-normal text-muted-foreground">{m.unit}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <MaterialDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        materialId={selectedMaterialId}
        onSuccess={loadData}
      />
    </div>
  );
};

const getStockStatus = (material: Material) => {
  if (!material.trackStock) return { label: 'Sob Demanda', color: 'bg-blue-50 text-blue-600', icon: Package };
  const stock = material.currentStock || 0;
  const min = material.minStockQuantity || 0;
  if (stock <= 0) return { label: 'Zerado', color: 'bg-red-50 text-red-600 border border-red-100', icon: AlertTriangle };
  if (min > 0 && stock < min) return { label: 'Crítico', color: 'bg-amber-50 text-amber-600 border border-amber-100', icon: AlertTriangle };
  return { label: 'Disponível', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100', icon: CheckCircle2 };
};

export default Insumos;
