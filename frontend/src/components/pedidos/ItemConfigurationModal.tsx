import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft, Save, Plus, X, Package, Zap } from 'lucide-react';
import { ItemType, ITEM_TYPE_CONFIGS } from '@/types/item-types';
import ProductItemForm from './item-forms/ProductItemForm';
import ServiceItemForm from './item-forms/ServiceItemForm';
import { SelectionPresets } from './ProductSelectionModal';
import { ModalPortal } from '@/components/ui/ModalPortal';

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    minPrice?: number;
    productType?: ItemType; // Corrigido para usar ItemType
    stockQuantity?: number | null;
    availableStock?: number | null;
    stockUnit?: string | null;
    sellWithoutStock?: boolean;
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
    maxDiscountThreshold?: number;
    isPriceUnlocked?: boolean;
    selectionPresets?: SelectionPresets;
}

const ItemConfigurationModal: React.FC<ItemConfigurationModalProps> = ({
    produto,
    onSubmit,
    onBack,
    onCancel,
    editingItem,
    isOpen,
    maxDiscountThreshold = 0.15,
    isPriceUnlocked = false,
    selectionPresets
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
        <ModalPortal>
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
                                    {React.createElement(productConfig?.icon ?? Package, { className: 'w-6 h-6 text-muted-foreground' })}
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
                                    {produto.stockQuantity != null && (
                                        <div className={`inline-flex items-center gap-1.5 ml-2 text-xs px-2 py-1 rounded-full mt-2 ${
                                            produto.availableStock != null && produto.availableStock <= 0
                                                ? 'bg-red-100 text-red-700 border border-red-300'
                                                : produto.availableStock != null && produto.availableStock < produto.stockQuantity
                                                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                                : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            <Package className="w-3 h-3" />
                                            Estoque: {produto.stockQuantity} {produto.stockUnit || 'un.'}
                                            {produto.availableStock != null && produto.availableStock !== produto.stockQuantity && (
                                                <span className="font-bold">
                                                    · Disponível: {produto.availableStock}
                                                </span>
                                            )}
                                        </div>
                                    )}
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

                <CardContent className="overflow-y-auto flex-1">
                    {selectionPresets?.favoriteName && (
                        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                            <Zap className="w-4 h-4 shrink-0" fill="currentColor" />
                            <span className="text-xs font-bold uppercase tracking-wider">SKU rápido:</span>
                            <span className="text-sm font-semibold truncate">{selectionPresets.favoriteName}</span>
                            <span className="text-[10px] text-amber-600 italic ml-auto">parâmetros pré-aplicados — basta informar quantidade e Enter</span>
                        </div>
                    )}
                    {isService ? (
                        <ServiceItemForm
                            produto={produto}
                            onSubmit={handleItemSubmit}
                            editingData={editingItem}
                            isEditing={!!editingItem}
                            maxDiscountThreshold={maxDiscountThreshold}
                            isPriceUnlocked={isPriceUnlocked}
                        />
                    ) : (
                        <ProductItemForm
                            produto={produto}
                            onSubmit={handleItemSubmit}
                            editingData={editingItem}
                            isEditing={!!editingItem}
                            maxDiscountThreshold={maxDiscountThreshold}
                            isPriceUnlocked={isPriceUnlocked}
                            selectionPresets={selectionPresets}
                        />
                    )}
                </CardContent>
            </Card>
        </ModalPortal>
    );
};

export default ItemConfigurationModal;