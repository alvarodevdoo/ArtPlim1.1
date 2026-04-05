import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Package, Calculator, Wrench, Settings, 
  BarChart3, Workflow, Info 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';

// Subcomponents
import { GeneralTab } from './Tabs/GeneralTab';
import { BOMTab } from './Tabs/BOMTab/BOMTab';
import { VariationsTab } from './Tabs/VariationsTab/VariationsTab';
import { PricingTab } from './Tabs/PricingTab/PricingTab';
import { ProductionTab } from './Tabs/ProductionTab';

// Hooks & Types
import { useProductSimulation } from './useProductSimulation';
import { ProductDraft } from './types';
import './ProductModal.scss';

interface ProductModalContainerProps {
  productId?: string;
  onClose: () => void;
  onSave: () => void;
}

export const ProductModalContainer: React.FC<ProductModalContainerProps> = ({ 
  productId, 
  onClose,
  onSave 
}) => {
  const [activeTab, setActiveTab] = useState<'geral' | 'bom' | 'variations' | 'pricing' | 'production'>('geral');
  const [loading, setLoading] = useState(!!productId);
  const [submitting, setSubmitting] = useState(false);
  
  const [draft, setDraft] = useState<ProductDraft>({
    name: '',
    productType: 'PRODUCT',
    pricingMode: 'SIMPLE_AREA',
    salePrice: 0,
    costPrice: 0,
    markup: 2.0,
    targetMarkup: 2.5,
    active: true,
    trackStock: false,
    stockQuantity: 0,
    stockMinQuantity: 0,
    stockUnit: 'un',
    sellWithoutStock: true,
  });

  const [internalProductId, setInternalProductId] = useState<string | undefined>(productId);

  useEffect(() => {
    setInternalProductId(productId);
  }, [productId]);

  // Simulation Logic (Real-time calculation)
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const { result: simResult, loading: simLoading } = useProductSimulation(internalProductId || '', selectedOptionIds);

  useEffect(() => {
    if (internalProductId) {
      loadProduct();
    }
  }, [internalProductId]);

  const loadProduct = async () => {
    try {
      const response = await api.get(`/api/catalog/products/${internalProductId}`);
      const data = response.data.data;
      setDraft({
        ...data,
        salePrice: Number(data.salePrice || 0),
        costPrice: Number(data.costPrice || 0),
      });
      setLoading(false);
    } catch (err) {
      toast.error('Erro ao carregar produto');
      onClose();
    }
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      if (internalProductId) {
        await api.put(`/api/catalog/products/${internalProductId}`, draft);
        toast.success('Produto atualizado com sucesso!');
      } else {
        const resp = await api.post('/api/catalog/products', draft);
        const newId = resp.data.data.id;
        setInternalProductId(newId);
        toast.success('Produto criado! Agora você pode configurar os detalhes.');
      }
      onSave(); // Atualiza a lista no background
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar produto');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'geral', label: 'Cadastro', icon: Package },
    { id: 'bom', label: 'Ficha Técnica (BOM)', icon: Wrench },
    { id: 'variations', label: 'Variações', icon: Settings },
    { id: 'pricing', label: 'Precificação / BI', icon: BarChart3 },
    { id: 'production', label: 'Produção', icon: Workflow },
  ] as const;

  if (loading) return <div className="p-20 text-center">Carregando...</div>;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl border-0 overflow-hidden product-modal">
        
        {/* Header Profissional */}
        <CardHeader className="bg-slate-50 border-b flex-row justify-between items-center py-4 px-6 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-800">
                  {productId ? 'Configurar Produto' : 'Novo Produto'}
                </CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {draft.name || 'Sem nome'}
                </CardDescription>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        {/* Tab Navigation & Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <aside className="w-64 bg-slate-50/50 border-r p-4 space-y-2 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                  activeTab === tab.id 
                    ? "bg-white text-primary shadow-sm border ring-1 ring-primary/10" 
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                )}
              >
                <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-primary" : "text-slate-400")} />
                {tab.label}
              </button>
            ))}

            <div className="mt-auto pt-8">
               <div className="bg-indigo-900 text-white rounded-2xl p-5 space-y-4 shadow-xl border-t-4 border-indigo-400/30">
                  <div>
                    <p className="text-[10px] font-black uppercase text-indigo-300 tracking-widest mb-1">Custo Médio Total</p>
                    <p className={cn("text-2xl font-black", simLoading ? "opacity-50" : "")}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simResult?.totalCost || draft.costPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-indigo-300 tracking-widest mb-1">Preço Sugerido (BI)</p>
                    <p className={cn("text-xl font-black text-emerald-400", simLoading ? "opacity-50" : "")}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simResult?.suggestedPrice || draft.salePrice)}
                    </p>
                    <p className="text-[10px] text-indigo-300 mt-1 italic">Baseado em {draft.targetMarkup}x Markup</p>
                  </div>
               </div>
            </div>
          </aside>

          {/* Active Tab Content */}
          <main className="flex-1 overflow-y-auto bg-white">
            <div className="p-8 h-full max-w-5xl mx-auto">
              {activeTab === 'geral' && <GeneralTab draft={draft} setDraft={setDraft} />}
              {activeTab === 'bom' && <BOMTab productId={internalProductId || ''} draft={draft} />}
              {activeTab === 'variations' && <VariationsTab productId={internalProductId || ''} draft={draft} onSimulate={(ids) => setSelectedOptionIds(ids)} />}
              {activeTab === 'pricing' && <PricingTab draft={draft} simResult={simResult} />}
              {activeTab === 'production' && <ProductionTab productId={internalProductId || ''} draft={draft} />}
            </div>
          </main>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t py-4 px-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
             <Info className="w-4 h-4" />
             Atalhos: Esc para sair • Ctrl+S para salvar
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting || !draft.name}>
              {submitting ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
