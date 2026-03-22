import React, { useState } from 'react';
import { toast } from 'sonner';
import { ItemType } from '@/types/item-types';
import ProductSelectionModal from './ProductSelectionModal';
import ItemConfigurationModal from './ItemConfigurationModal';

import { Produto as SalesProduct } from '@/types/sales';

interface SelectableProduct extends SalesProduct {
    usageCount?: number;
}

interface ItemPedido {
    id: string;
    itemType: ItemType;
    productId: string;
    product?: SelectableProduct;
    width?: number;
    height?: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    pricingRuleId?: string;
    attributes?: Record<string, any>;
}

interface AddItemModalFlowProps {
    produtos: SalesProduct[];
    onAddItem: (item: ItemPedido) => void;
    onUpdateItem?: (item: ItemPedido) => void;
    editingItem?: ItemPedido | null;
    isOpen: boolean;
    onClose: () => void;
}

type ModalStep = 'selection' | 'configuration';

const AddItemModalFlow: React.FC<AddItemModalFlowProps> = ({
    produtos,
    onAddItem,
    onUpdateItem,
    editingItem,
    isOpen,
    onClose
}) => {
    const [currentStep, setCurrentStep] = useState<ModalStep>('selection');
    const [selectedProduct, setSelectedProduct] = useState<SelectableProduct | null>(null);

    // Adicionar contadores de uso simulados aos produtos
    // Em produção, isso viria do backend baseado no histórico real de uso
    const produtosComUsage = React.useMemo(() =>
        produtos.map(produto => ({
            ...produto,
            usageCount: Math.floor(Math.random() * 50) + 1 // Simulação de 1-50 usos
        })), [produtos]
    );

    // Se estamos editando, pular direto para configuração
    React.useEffect(() => {
        if (isOpen) {
            if (editingItem) {
                if (editingItem.product) {
                    // Modo edição: usar o produto do ITEM (que vem do backend com pricingRule já resolvido)
                    // NÃO sobrescrever com o produto da lista de catálogo (que não tem fórmula)
                    setSelectedProduct(editingItem.product as any);
                    setCurrentStep('configuration');
                } else if (editingItem.productId) {
                    // Item sem produto - tentar encontrar na lista
                    const produto = produtosComUsage.find(p => p.id === editingItem.productId);
                    if (produto) {
                        setSelectedProduct(produto);
                        setCurrentStep('configuration');
                    } else {
                        setCurrentStep('selection');
                        setSelectedProduct(null);
                    }
                } else {
                    setCurrentStep('selection');
                    setSelectedProduct(null);
                }
            } else {
                // Modo adição: começar na seleção
                setCurrentStep('selection');
                setSelectedProduct(null);
            }
        }
    }, [editingItem, isOpen]);

    // NÃO verificar mais se o produto existe em produtosComUsage durante edição
    // pois o produto do item pode ter dados extras (pricingRule) que a lista genérica não tem
    // Removed the second useEffect that was overwriting the selectedProduct

    const handleProductSelect = (produto: SelectableProduct) => {
        setSelectedProduct(produto);
        setCurrentStep('configuration');
    };

    const handleBackToSelection = () => {
        setCurrentStep('selection');
        setSelectedProduct(null);
    };

    const handleItemSubmit = (item: ItemPedido) => {
        if (editingItem && onUpdateItem) {
            onUpdateItem(item);
            toast.success('Item atualizado com sucesso!');
        } else {
            onAddItem(item);
            toast.success('Item adicionado ao pedido!');
        }

        // Fechar modal e resetar estado
        onClose();
        setCurrentStep('selection');
        setSelectedProduct(null);
    };

    const handleCancel = () => {
        onClose();
        setCurrentStep('selection');
        setSelectedProduct(null);
    };

    // Verificar se há produtos disponíveis
    const hasProducts = produtosComUsage && produtosComUsage.length > 0;

    if (!hasProducts) {
        // Mostrar mensagem de produtos não disponíveis
        return (
            <ProductSelectionModal
                produtos={[]}
                onSelect={handleProductSelect}
                onCancel={handleCancel}
                isOpen={isOpen}
            />
        );
    }

    return (
        <>
            {/* Modal de Seleção de Produto */}
            <ProductSelectionModal
                produtos={produtosComUsage}
                onSelect={handleProductSelect}
                onCancel={handleCancel}
                isOpen={isOpen && currentStep === 'selection'}
            />

            {/* Modal de Configuração do Item */}
            {selectedProduct && (
                <ItemConfigurationModal
                    produto={selectedProduct}
                    onSubmit={handleItemSubmit}
                    onBack={handleBackToSelection}
                    onCancel={handleCancel}
                    editingItem={editingItem}
                    isOpen={isOpen && currentStep === 'configuration'}
                />
            )}
        </>
    );
};

export default AddItemModalFlow;