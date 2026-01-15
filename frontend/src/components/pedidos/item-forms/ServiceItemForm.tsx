import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Save, Plus } from 'lucide-react';
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
}

const ServiceItemForm: React.FC<ServiceItemFormProps> = ({
    produto,
    onSubmit,
    editingData,
    isEditing = false
}) => {
    const [quantity, setQuantity] = useState<number>(1);
    const [unitPrice, setUnitPrice] = useState<number>(0);
    const [description, setDescription] = useState('');
    const [briefing, setBriefing] = useState('');

    // Carregar dados de edição
    useEffect(() => {
        if (editingData) {
            setQuantity(editingData.quantity || 1);
            setUnitPrice(editingData.unitPrice || 0);
            setDescription(editingData.notes || editingData.attributes?.description || '');
            setBriefing(editingData.attributes?.briefing || '');
        }
    }, [editingData]);

    const handleSubmit = () => {
        if (!description.trim()) {
            toast.error('Preencha a descrição do serviço');
            return;
        }

        if (quantity <= 0 || unitPrice <= 0) {
            toast.error('Preencha a quantidade e o preço do serviço');
            return;
        }

        const itemData = {
            productId: produto.id, // Usar o ID real do produto/serviço cadastrado
            product: produto, // Usar o objeto produto completo
            width: undefined,
            height: undefined,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            totalPrice: Number(unitPrice * quantity),
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    <label className="text-sm font-medium">Preço Unitário</label>
                    <CurrencyInput
                        value={unitPrice}
                        onValueChange={(value) => setUnitPrice(value || 0)}
                        placeholder="R$ 0,00"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium">Total</label>
                    <div className="h-10 px-3 py-2 border border-input rounded-md bg-muted flex items-center">
                        <span className="font-medium text-green-600">
                            {formatCurrency(unitPrice * quantity)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Botão de Ação */}
            <Button
                onClick={handleSubmit}
                disabled={!description.trim() || quantity <= 0 || unitPrice <= 0}
                className="w-full"
            >
                {isEditing ? (
                    <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Alterações
                    </>
                ) : (
                    <>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar ao Pedido
                    </>
                )}
            </Button>
        </div>
    );
};

export default ServiceItemForm;