import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import { ItemType, ITEM_TYPE_CONFIGS } from '@/types/item-types';
import ProductItemForm from './item-forms/ProductItemForm';
import ServiceItemForm from './item-forms/ServiceItemForm';

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    minPrice?: number;
    productType?: ItemType; // Corrigido para usar ItemType
}

interface ItemPedido {
    id: string;
    itemType: ItemType;
    productId: string;
    product?: Produto;
    width?: number;
    height?: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    pricingRuleId?: string;
    attributes?: Record<string, any>;
}

interface ItemConfigurationModalProps {
    produto: Produto;
    onSubmit: (item: ItemPedido) => void;
    onBack: () => void;
    onCancel: () => void;
    editingItem?: ItemPedido | null;
    isOpen: boolean;
}

const ItemConfigurationModal: React.FC<ItemConfigurationModalProps> = ({
    produto,
    onSubmit,
    onBack,
    onCancel,
    editingItem,
    isOpen
}) => {
    // Obter informações do tipo de produto
    const productType = produto.productType || ItemType.PRODUCT;
    const productConfig = ITEM_TYPE_CONFIGS[productType];
    const isService = productType === ItemType.SERVICE;

    // Bloquear scroll da página quando modal está aberto
    React.useEffect(() => {
        if (isOpen) {
            // Salvar posição atual do scroll
            const scrollY = window.scrollY;

            // Bloquear scroll da página
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';

            return () => {
                // Restaurar scroll da página
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                window.scrollTo(0, scrollY);
            };
        }
    }, [isOpen]);

    const handleItemSubmit = (itemData: any) => {
        const item: ItemPedido = {
            id: editingItem?.id || Date.now().toString(),
            itemType: productType, // Usar o tipo correto do produto
            ...itemData
        };

        onSubmit(item);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <Card className="modal-content-card max-w-4xl">

                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onBack}
                                className="flex items-center space-x-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Trocar</span>
                            </Button>
                            <div>
                                <CardTitle className="flex items-center space-x-2">
                                    <span className="text-2xl">{productConfig?.icon || '📦'}</span>
                                    <div>
                                        {editingItem ? (
                                            <>
                                                <Save className="w-5 h-5 inline mr-2" />
                                                <span>Editando Item</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-5 h-5 inline mr-2" />
                                                <span>Configurar Item</span>
                                            </>
                                        )}
                                    </div>
                                </CardTitle>
                                <div className="mt-1">
                                    <div className="font-medium text-lg">{produto.name}</div>
                                    {produto.description && (
                                        <div className="text-sm text-muted-foreground">
                                            {produto.description}
                                        </div>
                                    )}
                                    <div className={`inline-block text-xs px-2 py-1 rounded-full mt-2 ${isService
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-green-100 text-green-700'
                                        }`}>
                                        {productConfig?.label || 'Produto'} - {produto.pricingMode === 'SIMPLE_AREA' ? 'Por m²' :
                                            produto.pricingMode === 'SIMPLE_UNIT' ? 'Por unidade' : 'Dinâmico'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCancel}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent>
                    {isService ? (
                        <ServiceItemForm
                            produto={produto}
                            onSubmit={handleItemSubmit}
                            editingData={editingItem}
                            isEditing={!!editingItem}
                        />
                    ) : (
                        <ProductItemForm
                            produto={produto}
                            onSubmit={handleItemSubmit}
                            editingData={editingItem}
                            isEditing={!!editingItem}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ItemConfigurationModal;