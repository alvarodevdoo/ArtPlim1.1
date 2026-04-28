import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Save, Plus, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { ItemType } from '@/types/item-types';

interface ServiceItemFormProps {
    produto: {
        id: string;
        name: string;
        description?: string;
        pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
        salePrice?: number;
        minPrice?: number;
        productType?: ItemType;
    };
    onSubmit: (itemData: any) => void;
    editingData?: any;
    isEditing?: boolean;
    maxDiscountThreshold?: number;
}

const ServiceItemForm: React.FC<ServiceItemFormProps> = ({
    produto,
    onSubmit,
    editingData,
    isEditing = false,
    maxDiscountThreshold = 0.15
}) => {
    const [unitPrice, setUnitPrice] = useState<number>(0);
    const [discountItem, setDiscountItem] = useState<number>(0);
    const [description, setDescription] = useState('');
    const [briefing, setBriefing] = useState('');

    // Carregar dados de edição
    useEffect(() => {
        if (editingData) {
            setQuantity(editingData.quantity || 1);
            setUnitPrice(editingData.unitPrice || 0);
            setDiscountItem(editingData.discountItem || 0);
            setDescription(editingData.notes || editingData.attributes?.description || '');
            setBriefing(editingData.attributes?.briefing || '');
        }
    }, [editingData]);

    const discountValidation = useMemo(() => {
        const grossValue = Number(unitPrice) * quantity;
        const discountVal = Number(discountItem) || 0;
        if (grossValue <= 0) return { ok: true, percent: 0, exceedsGross: false };
        
        const exceedsGross = discountVal > grossValue;
        const percent = discountVal / grossValue;
        const exceedsThreshold = percent > maxDiscountThreshold;
        
        return {
            ok: !exceedsThreshold && !exceedsGross,
            percent: percent * 100,
            exceedsThreshold,
            exceedsGross
        };
    }, [unitPrice, quantity, discountItem, maxDiscountThreshold]);

    const handleSubmit = () => {
        if (!description.trim()) {
            toast.error('Preencha a descrição do serviço');
            return;
        }

        if (quantity <= 0 || unitPrice <= 0) {
            toast.error('Preencha a quantidade e o preço do serviço');
            return;
        }

        if (discountValidation.exceedsGross) {
            toast.error('O desconto não pode ser maior que o valor do serviço');
            return;
        }

        if (!discountValidation.ok && maxDiscountThreshold === 0) {
            toast.error('Descontos não são permitidos para este item');
            return;
        }

        if (!discountValidation.ok) {
            toast.error(`O desconto de ${discountValidation.percent.toFixed(2)}% excede o limite permitido de ${(maxDiscountThreshold * 100).toFixed(2)}%.`);
            return;
        }

        const itemData = {
            productId: produto.id, // Usar o ID real do produto/serviço cadastrado
            product: produto, // Usar o objeto produto completo
            width: undefined,
            height: undefined,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            totalPrice: Number((unitPrice * quantity) - discountItem),
            discountItem: Number(discountItem) || 0,
            notes: description,
            attributes: {
                description,
                briefing,
                serviceName: produto.name
            }
        };

        onSubmit(itemData);
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                    🎨 Especificações do Serviço: {produto.name}
                </h4>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Descrição do Serviço *</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ex: Criação de logotipo, arte para cartão de visita, design de banner..."
                            className="w-full h-20 p-3 border border-input rounded-md resize-none mt-1"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Briefing/Observações</label>
                        <textarea
                            value={briefing}
                            onChange={(e) => setBriefing(e.target.value)}
                            placeholder="Cores preferidas, estilo desejado, referências, público-alvo, informações específicas..."
                            className="w-full h-16 p-3 border border-input rounded-md resize-none mt-1"
                        />
                    </div>
                </div>
            </div>

            {/* Quantidade e Preço */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label className="text-sm font-medium">Quantidade</label>
                    <Input
                        type="number"
                        value={quantity || ''}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        placeholder="1"
                        min="1"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium">Unitário (R$)</label>
                    <CurrencyInput
                        value={unitPrice}
                        onValueChange={(value) => setUnitPrice(value || 0)}
                        placeholder="R$ 0,00"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-600">Desconto (R$)</label>
                    <CurrencyInput
                        value={discountItem}
                        onValueChange={(value) => setDiscountItem(value || 0)}
                        placeholder="R$ 0,00"
                        className="border-slate-300 bg-white text-slate-900"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium">Total Líquido</label>
                    <div className="h-10 px-3 py-2 border border-input rounded-md bg-muted flex items-center">
                        <span className="font-medium text-green-600">
                            {formatCurrency((unitPrice * quantity) - discountItem)}
                        </span>
                    </div>
                    {!discountValidation.ok && (
                        <div className="mt-1 text-[10px] text-red-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {discountValidation.exceedsGross ? 'Excede valor do serviço!' : `Excede teto de ${(maxDiscountThreshold * 100).toFixed(2)}%`}
                        </div>
                    )}
                </div>
            </div>

            {/* Botão de Ação */}
            <Button 
                onClick={handleSubmit} 
                className="w-full h-10 text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 shadow-md"
                disabled={!description.trim() || quantity <= 0 || unitPrice <= 0 || (!discountValidation.ok && (maxDiscountThreshold === 0 || discountValidation.exceedsGross))}
            >
                {isEditing ? <Save className="w-3.5 h-3.5 mr-2" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
                {isEditing ? 'Salvar Item' : 'Adicionar Item'}
            </Button>
        </div>
    );
};

export default ServiceItemForm;