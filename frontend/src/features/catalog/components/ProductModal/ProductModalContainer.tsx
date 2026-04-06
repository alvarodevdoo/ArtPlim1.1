import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Package, Wrench, Settings,
  BarChart3, Workflow, Info, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';

import { GeneralTab } from './Tabs/GeneralTab';
import { BOMTab } from './Tabs/BOMTab/BOMTab';
import { VariationsTab } from './Tabs/VariationsTab/VariationsTab';
import { PricingTab } from './Tabs/PricingTab/PricingTab';
import { ProductionTab } from './Tabs/ProductionTab';
import { FinancialSidebar } from './FinancialSidebar';
import { useInsumos } from '@/features/supplies/useInsumos';
import {
  ProductDraft,
  DraftBOMItem,
  DraftVariationGroup,
  FinancialSummary,
} from './types';
import './ProductModal.scss';

interface ProductModalContainerProps {
  productId?: string;
  onClose: () => void;
  onSave: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const emptyDraft = (): ProductDraft => ({
  name: '',
  productType: 'PRODUCT',
  pricingMode: 'SIMPLE_AREA',
  salePrice: 0,
  costPrice: 0,
  active: true,
  trackStock: false,
  stockQuantity: 0,
  stockMinQuantity: 0,
  stockUnit: 'un',
  sellWithoutStock: true,
});

const isTemp = (id: string) => id.startsWith('__new_');

// ─── Component ────────────────────────────────────────────────────────────────
export const ProductModalContainer: React.FC<ProductModalContainerProps> = ({
  productId,
  onClose,
  onSave,
}) => {
  type TabId = 'geral' | 'bom' | 'variations' | 'pricing' | 'production';
  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [loading, setLoading] = useState(!!productId);
  const [submitting, setSubmitting] = useState(false);
  const { insumos } = useInsumos();

  // ── Central Draft State ────────────────────────────────────────────────────
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft());
  const [bomItems, setBomItems] = useState<DraftBOMItem[]>([]);
  const [varGroups, setVarGroups] = useState<DraftVariationGroup[]>([]);
  const [pricingRules, setPricingRules] = useState<{ id: string, name: string }[]>([]);

  // which option is "selected" in the simulator per group
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string>>({});
  const [deletedGroupIds, setDeletedGroupIds] = useState<string[]>([]);
  const [deletedOptionIds, setDeletedOptionIds] = useState<{ groupId: string; optionId: string }[]>([]);

  const handleUpdateGroups = (newGroups: DraftVariationGroup[]) => {
    // 1. Detect removed groups (only those already in DB)
    const removedGs = varGroups.filter(
      (oldG) => !isTemp(oldG.id) && !newGroups.find((newG) => newG.id === oldG.id)
    );
    if (removedGs.length > 0) {
      setDeletedGroupIds((prev) => [...prev, ...removedGs.map((g) => g.id)]);
    }

    // 2. Detect removed options in groups that still exist
    newGroups.forEach((newG) => {
      const oldG = varGroups.find((og) => og.id === newG.id);
      if (oldG) {
        const removedOs = oldG.options.filter(
          (oldO) => !isTemp(oldO.id) && !newG.options.find((newO) => newO.id === oldO.id)
        );
        if (removedOs.length > 0) {
          setDeletedOptionIds((prev) => [
            ...prev,
            ...removedOs.map((o) => ({ groupId: newG.id, optionId: o.id })),
          ]);
        }
      }
    });

    setVarGroups(newGroups);
  };

  const handleSelectOption = useCallback((groupId: string, optionId: string) => {
    setSelectedOptionIds((prev) => ({ ...prev, [groupId]: optionId }));
  }, []);

  // ── Load Existing Product ──────────────────────────────────────────────────
  useEffect(() => {
    if (!productId) return;

    const load = async () => {
      try {
        // 1. General data
        const [prodRes, configRes, bomRes] = await Promise.all([
          api.get(`/api/catalog/products/${productId}`),
          api.get(`/api/catalog/products/${productId}/configurations/complete`),
          api.get(`/api/catalog/products/${productId}/ficha-tecnica`),
        ]);

        const data = prodRes.data.data;
        setDraft({
          ...emptyDraft(),
          ...data,
          salePrice: Number(data.salePrice || 0),
          costPrice: Number(data.costPrice || 0),
        });

        // 2. Variation groups
        const configs: DraftVariationGroup[] = (configRes.data.data?.configurations || []).map(
          (g: any) => ({
            id: g.id,
            name: g.name,
            type: g.type,
            required: g.required ?? true,
            displayOrder: g.displayOrder ?? 1,
            options: (g.options || []).map((o: any) => ({
              id: o.id,
              label: o.label,
              value: o.value,
              priceModifier: Number(o.priceModifier || 0),
              priceModifierType: o.priceModifierType || 'FIXED',
              fixedValue: o.fixedValue != null ? Number(o.fixedValue) : (o.priceOverride != null ? Number(o.priceOverride) : null),
              materialId: o.materialId || null,
              materialName: o.materialName || null,
              isAvailable: o.isAvailable ?? true,
              displayOrder: o.displayOrder ?? 1,
            })),
          })
        );
        console.log('[ProductModal] Variation groups loaded:', JSON.stringify(configs, null, 2));
        setVarGroups(configs);

        // 3. BOM items
        const bom: DraftBOMItem[] = (bomRes.data.data || []).map((item: any) => {
          // averageCost = custo médio ponderado (atualizado por entradas de estoque)
          // costPerUnit = custo base cadastrado manualmente
          // Usar o melhor disponível; priorizar averageCost se > 0
          const mat = item.material;
          const rawAvg = Number(mat?.averageCost || 0);
          const rawCost = Number(mat?.costPerUnit || 0);
          const costPerUnit = rawAvg > 0 ? rawAvg : rawCost;

          const ipu = Number(item.itemsPerUnit || 1);
          const eff = ipu > 0 ? costPerUnit / ipu : 0;
          const qty = Number(item.quantidade || 1);
          return {
            id: item.id,
            materialId: item.insumoId,
            materialName: mat?.name || 'Material',
            unit: mat?.unit || 'un',
            quantity: qty,
            width: Number(item.width || 0),
            height: Number(item.height || 0),
            itemsPerUnit: ipu,
            costPerUnit,
            effectiveCost: eff,
            subtotal: eff * qty,
            salePrice: Number(item.custoCalculado || 0) * 2.5, // Exemplo de markup inicial, se necessário
            isFixed: !item.configurationOptionId && !item.configurationGroupId,
            configurationOptionId: item.configurationOptionId || null,
            configurationGroupId: item.configurationGroupId || null,
          };
        });
        console.log('[ProductModal] BOM items loaded:', bom.filter(i => !i.isFixed));
        setBomItems(bom);

        // Init simulation defaults
        const defaults: Record<string, string> = {};
        configs.forEach((g) => {
          if (g.options.length > 0) defaults[g.id] = g.options[0].id;
        });
        setSelectedOptionIds(defaults);
      } catch {
        toast.error('Erro ao carregar produto');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [productId]);

  // ── Load Pricing Rules ─────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/catalog/pricing-rules')
      .then(res => {
        if (res.data?.success) {
          setPricingRules(res.data.data);
        }
      })
      .catch(() => console.error('Erro ao buscar regras de precificação'));
  }, []);

  // ── Financial Summary (computed) ───────────────────────────────────────────
  const financialSummary = useMemo((): FinancialSummary => {
    // Fixed cost = sum of all fixed BOM items
    const fixedCost = bomItems
      .filter((i) => i.isFixed)
      .reduce((s, i) => s + i.subtotal, 0);

    let variationCost = 0;
    varGroups.forEach((g) => {
      const selectedId = selectedOptionIds[g.id];
      if (!selectedId) return;

      const opt = g.options.find((o) => o.id === selectedId);
      if (!opt) return;

      // 1. Option price modifier (revenue impact)
      variationCost += Number(opt.priceModifier || 0);

      // 2. Legacy slot cost (directly linked to specific optionId)
      const slotSpecificCost = bomItems
        .filter((i) => !i.isFixed && i.configurationOptionId === selectedId)
        .reduce((s, i) => s + i.subtotal, 0);
      variationCost += slotSpecificCost;

      // 3. New Generic Group slot cost (linked to groupId)
      // We look up the material assigned to the selected option in this group
      const groupSlotItems = bomItems.filter((i) => !i.isFixed && i.configurationGroupId === g.id);
      groupSlotItems.forEach(slot => {
        if (opt.materialId) {
          const mat = insumos.find(m => m.id === opt.materialId);
          if (mat) {
            const costPerUnit = Number((mat as any).custoUnitario || (mat as any).costPerUnit || (mat as any).averageCost || 0);
            const effCost = costPerUnit / (slot.itemsPerUnit || 1);
            variationCost += effCost * slot.quantity;
          }
        }
      });
    });

    const totalCost = fixedCost + variationCost;

    // Sale price: check if selected option has a fixedValue, else use draft.salePrice
    let salePrice = draft.salePrice;
    Object.entries(selectedOptionIds).forEach(([groupId, optId]) => {
      const group = varGroups.find((g) => g.id === groupId);
      const opt = group?.options.find((o) => o.id === optId);
      if (opt?.fixedValue != null) salePrice = opt.fixedValue;
    });

    const grossProfit = salePrice - totalCost;
    const marginPercent = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;

    return { 
       fixedCost, variationCost, totalCost, salePrice, grossProfit, 
       marginPercent, isSalePriceOverridden: salePrice !== draft.salePrice,
       baseSalePrice: draft.salePrice 
    };
  }, [bomItems, varGroups, selectedOptionIds, draft.salePrice]);

  // Selected option label for sidebar
  const selectedOptionLabel = useMemo(() => {
    const labels: string[] = [];
    varGroups.forEach((g) => {
      const opt = g.options.find((o) => o.id === selectedOptionIds[g.id]);
      if (opt) labels.push(opt.label);
    });
    return labels.join(' + ') || undefined;
  }, [varGroups, selectedOptionIds]);

  // ── UPSERT Save ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!draft.name) {
      toast.error('Informe o nome do produto');
      setActiveTab('geral');
      return;
    }

    setSubmitting(true);
    try {
      // 1. UPSERT Product
      let savedId = productId;
      if (savedId) {
        await api.put(`/api/catalog/products/${savedId}`, draft);
      } else {
        const res = await api.post('/api/catalog/products', draft);
        savedId = res.data.data.id;
      }

      // 1.5. Execute DELETIONS
      // Delete options first (due to FKs)
      for (const delOpt of deletedOptionIds) {
        // Only delete if the group itself isn't being deleted
        if (!deletedGroupIds.includes(delOpt.groupId)) {
          await api.delete(`/api/catalog/configurations/${delOpt.groupId}/options/${delOpt.optionId}`);
        }
      }
      // Delete groups
      for (const delGroupId of deletedGroupIds) {
        await api.delete(`/api/catalog/products/${savedId}/configurations/${delGroupId}`);
      }

      // 2. Save Variation Groups & Options
      for (const group of varGroups) {
        let groupId = group.id;

        if (isTemp(group.id)) {
          // Garantir que o type seja sempre um valor válido antes de enviar
          const validType = (['SELECT', 'NUMBER', 'BOOLEAN', 'TEXT'] as const)
            .includes(group.type as any) ? group.type : 'SELECT';

          const res = await api.post(`/api/catalog/products/${savedId}/configurations`, {
            name: group.name,
            type: validType,
            required: group.required,
            displayOrder: group.displayOrder,
          });
          groupId = res.data.data.id;
        }

        for (const opt of group.options) {
          const payload = {
            label: opt.label,
            value: opt.value,
            priceModifier: opt.priceModifier,
            priceModifierType: opt.priceModifierType,
            priceOverride: opt.fixedValue, // Envia para o campo antigo por compatibilidade
            fixedValue: opt.fixedValue,    // Envia para o novo campo
            materialId: opt.materialId,
            displayOrder: opt.displayOrder,
          };

          if (isTemp(opt.id)) {
            await api.post(`/api/catalog/configurations/${groupId}/options`, payload);
          } else {
            await api.put(`/api/catalog/configurations/${groupId}/options/${opt.id}`, payload);
          }
        }
      }

      // 3. Save BOM (ficha-técnica) as a full replace
      const bomPayload = bomItems.map((i) => ({
        insumoId: i.materialId,
        quantidade: i.quantity,
        width: typeof i.width === 'number' ? i.width : null,
        height: typeof i.height === 'number' ? i.height : null,
        itemsPerUnit: i.itemsPerUnit,
        custoCalculado: i.subtotal, 
        configurationOptionId: i.configurationOptionId ?? null,
        configurationGroupId: i.configurationGroupId ?? null,
      }));
      console.log('[ProductModal] Saving BOM payload:', JSON.stringify(bomPayload, null, 2));
      await api.post(`/api/catalog/products/${savedId}/ficha-tecnica`, { items: bomPayload });

      toast.success('Produto salvo com sucesso!');
      onSave();
      onClose();
    } catch (err: any) {
      const apiMsg = err.response?.data?.error?.message
        || err.response?.data?.message
        || err.message
        || 'Erro desconhecido ao salvar produto';
      console.error('[ProductModal] Erro ao salvar:', err.response?.data || err);
      toast.error(apiMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'geral',      label: 'Cadastro',       icon: Package  },
    { id: 'bom',        label: 'Ficha Técnica',  icon: Wrench   },
    { id: 'variations', label: 'Variações',      icon: Settings },
    { id: 'pricing',    label: 'Precificação',   icon: BarChart3 },
    { id: 'production', label: 'Produção',       icon: Workflow },
  ];

  if (loading) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center">
      <div className="bg-white rounded-2xl p-16 text-slate-400 font-black uppercase tracking-widest animate-pulse">
        Carregando Produto...
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-[95vw] xl:max-w-[1280px] h-[92vh] flex flex-col shadow-2xl border-0 overflow-hidden product-modal">

        {/* ── Header ── */}
        <CardHeader className="bg-slate-50 border-b flex-row justify-between items-center py-4 px-6 shrink-0">
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
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-50 hover:text-red-500">
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar: tabs + financial panel */}
          <aside className="w-60 bg-slate-50/50 border-r p-4 flex flex-col gap-2 shrink-0 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all',
                  activeTab === tab.id
                    ? 'bg-white text-primary shadow-sm border ring-1 ring-primary/10'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                )}
              >
                <tab.icon className={cn('w-5 h-5', activeTab === tab.id ? 'text-primary' : 'text-slate-400')} />
                {tab.label}
              </button>
            ))}

            {/* Financial Panel (always visible) */}
            <div className="mt-6">
              <FinancialSidebar
                summary={financialSummary}
                selectedOptionLabel={selectedOptionLabel}
                onSalePriceChange={(v: number) => setDraft((d) => ({ ...d, salePrice: v }))}
              />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-white">
            <div className="p-8 h-full max-w-5xl mx-auto">
              {activeTab === 'geral' && (
                <GeneralTab 
                  draft={draft} 
                  setDraft={setDraft} 
                  pricingRules={pricingRules}
                />
              )}
              {activeTab === 'bom' && (
                <BOMTab
                  productName={draft.name}
                  salePrice={draft.salePrice}
                  items={bomItems}
                  variationGroups={varGroups}
                  onChange={setBomItems}
                />
              )}
              {activeTab === 'variations' && (
                <VariationsTab
                  groups={varGroups}
                  selectedOptionIds={selectedOptionIds}
                  onChange={handleUpdateGroups}
                  onSelectOption={handleSelectOption}
                />
              )}
              {activeTab === 'pricing' && (
                <PricingTab draft={draft} simResult={null} />
              )}
              {activeTab === 'production' && (
                <ProductionTab productId={productId || ''} draft={draft} />
              )}
            </div>
          </main>
        </div>

        {/* ── Footer ── */}
        <div className="bg-slate-50 border-t py-4 px-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Info className="w-4 h-4" />
            Todas as abas são editadas em rascunho. Clique em <strong className="text-slate-600 ml-1">Salvar</strong> para confirmar.
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={submitting || !draft.name}
              className="gap-2 font-black"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Salvando...' : 'Salvar Produto'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
