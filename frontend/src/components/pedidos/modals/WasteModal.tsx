import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle, PackageX, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import CurrencyInput from '@/components/ui/CurrencyInput';

interface WasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  item: any; // OrderItem com compositionSnapshot
  onSuccess?: () => void;
}

export const WasteModal: React.FC<WasteModalProps> = ({
  isOpen,
  onClose,
  orderId,
  item,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [reason, setReason] = useState('');
  const [unitCost, setUnitCost] = useState<number | ''>('');
  const [totalPrice, setTotalPrice] = useState<number | ''>('');

  // Extrair lista única de materiais do snapshot da ficha técnica deste item
  const getMaterials = () => {
    if (!item) return [];
    let materialsList: Array<{ id: string, name: string, category: string, basePrice: number }> = [];
    try {
      const rawSnap = item.compositionSnapshot;
      let snap: any[] = [];
      
      if (Array.isArray(rawSnap)) {
        snap = rawSnap;
      } else if (typeof rawSnap === 'string' && rawSnap.trim().length > 0) {
        try { snap = JSON.parse(rawSnap); } catch(e) { console.warn('Falha ao parsear snapshot string'); }
      } else if (rawSnap && typeof rawSnap === 'object') {
        snap = (rawSnap as any).items || [];
      }
  
      if (Array.isArray(snap)) {
        snap.forEach((s: any) => {
          const id = s.materialId || s.id || s.insumoId;
          if (id && !materialsList.find(m => m.id === id)) {
            materialsList.push({
              id: id,
              name: s.materialName || s.name || 'Insumo',
              category: s.materialCategory || s.category || 'Insumo',
              basePrice: Number(s.costPerUnit || 0)
            });
          }
        });
      }
  
      // Se não houver snapshot (item em DRAFT), buscar do produto respeitando a seleção
      if (materialsList.length === 0) {
          // 1. Fichas Técnicas Fixas
          if (item.product?.fichasTecnicas?.length > 0) {
              item.product.fichasTecnicas.forEach((ft: any) => {
                  const mat = ft.material;
                  if (mat?.id && !materialsList.find(m => m.id === mat.id)) {
                      materialsList.push({
                          id: mat.id,
                          name: mat.name,
                          category: mat.category?.name || mat.category || 'Insumo',
                          basePrice: Number(mat.averageCost || mat.costPerUnit || 0)
                      });
                  }
              });
          }
  
          // 2. Componentes Fixos
          if (item.product?.components?.length > 0) {
              item.product.components.forEach((comp: any) => {
                  const mat = comp.material;
                  if (mat?.id && !materialsList.find(m => m.id === mat.id)) {
                      materialsList.push({
                          id: mat.id,
                          name: mat.name,
                          category: mat.category?.name || mat.category || 'Insumo',
                          basePrice: Number(mat.averageCost || mat.costPerUnit || 0)
                      });
                  }
              });
          }
  
          // 3. Configurações (Filtrado pelo que foi selecionado)
          if (item.product?.configurations?.length > 0) {
              const selectedOptionIds = Object.values(item.attributes?.selectedOptions || {});
              item.product.configurations.forEach((group: any) => {
                  (group.options || []).forEach((opt: any) => {
                      if (selectedOptionIds.includes(opt.id)) {
                          const mat = opt.material;
                          if (mat?.id && !materialsList.find(m => m.id === mat.id)) {
                              materialsList.push({
                                  id: mat.id,
                                  name: mat.name,
                                  category: mat.category?.name || mat.category || 'Opção',
                                  basePrice: Number(mat.averageCost || mat.costPerUnit || 0)
                              });
                          }
                      }
                  });
              });
          }
      }
    } catch(e) { console.error('Erro ao extrair materiais:', e); }
    return materialsList;
  };

  const materials = getMaterials();

  const handleMaterialChange = (id: string) => {
    setSelectedMaterialId(id);
    const mat = materials.find(m => m.id === id);
    if (mat) {
      setUnitCost(mat.basePrice);
      setTotalPrice(mat.basePrice * (Number(quantity) || 1));
      if (quantity === '') setQuantity(1);
    } else {
      setUnitCost('');
      setTotalPrice('');
    }
  };

  // Efeito para auto-seleção quando houver apenas 1 item
  useEffect(() => {
    if (isOpen && materials.length === 1 && !selectedMaterialId) {
      handleMaterialChange(materials[0].id);
    }
  }, [isOpen, materials.length, selectedMaterialId]);

  const handleQuantityChange = (val: string) => {
    const q = val ? Number(val) : '';
    setQuantity(q);
    if (q !== '' && unitCost !== '') {
      setTotalPrice(q * Number(unitCost));
    }
  };

  const handleUnitCostChange = (uc: number | undefined) => {
    const val = uc ?? 0;
    setUnitCost(val);
    if (quantity !== '') {
      setTotalPrice(Number(quantity) * val);
    }
  };

  const handleTotalChange = (tp: number | undefined) => {
    const val = tp ?? 0;
    setTotalPrice(val);
    if (val !== 0 && Number(quantity) > 0) {
      setUnitCost(val / Number(quantity));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialId) return toast.error('Selecione o insumo perdido');
    if (Number(quantity) <= 0) return toast.error('Informe uma quantidade válida');
    if (reason.length < 3) return toast.error('Informe um motivo claro para a perda');

    setLoading(true);
    try {
      await api.post(`/api/sales/orders/${orderId}/items/${item.id}/waste`, {
        materialId: selectedMaterialId,
        quantity: Number(quantity),
        reason,
        unitCost: unitCost !== '' ? Number(unitCost) : undefined
      });
      toast.success('Retrabalho/Perda registrado com sucesso!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao registrar perda');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-rose-600">
            <PackageX className="w-5 h-5" />
            <h2 className="text-lg font-bold">Registrar Perda / Retrabalho</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 leading-relaxed">
              O registro de perda dará baixa imediata no estoque do insumo e repassará este custo para a Ordem de Serviço.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase">Qual insumo foi perdido?</label>
            {materials.length > 0 ? (
              <select
                value={selectedMaterialId}
                onChange={(e) => handleMaterialChange(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="">-- Selecione o insumo da composição --</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.name} (Ref: {m.category})</option>
                ))}
              </select>
            ) : (
                <div className="p-3 border border-dashed border-slate-300 rounded-md bg-slate-50 text-slate-500 text-sm flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-slate-400" />
                    Não localizamos a ficha técnica deste item.
                </div>
            )}
          </div>

          {selectedMaterialId && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase">Quantidade</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    placeholder="Ex: 1"
                    required
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase">Custo Unit. (R$)</label>
                  <CurrencyInput
                    value={unitCost === '' ? undefined : unitCost}
                    onValueChange={handleUnitCostChange}
                    placeholder="0,00"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase font-bold text-rose-600">Total (R$)</label>
                  <CurrencyInput
                    value={totalPrice === '' ? undefined : totalPrice}
                    onValueChange={handleTotalChange}
                    placeholder="0,00"
                    className="border-rose-200 focus:ring-rose-500 font-bold text-rose-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase">Motivo do Retrabalho</label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Erro de corte no acabamento, mancha na impressão..."
                  required
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button 
                type="submit" 
                disabled={loading || !selectedMaterialId || !quantity || materials.length === 0} 
                className="bg-rose-600 hover:bg-rose-700 text-white"
            >
                {loading ? 'Registrando...' : 'Confirmar Perda'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
