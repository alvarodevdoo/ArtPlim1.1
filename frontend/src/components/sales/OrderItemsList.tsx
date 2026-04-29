import React from 'react';
import { statusConfig } from '@/types/pedidos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2, AlertCircle, Ban } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ItemPedido, Produto } from '@/types/sales';
import { ITEM_TYPE_CONFIGS } from '@/types/item-types';



interface OrderItemsListProps {
    items: ItemPedido[];
    onAdd: () => void;
    onEdit: (item: ItemPedido) => void;
    onRemove: (itemId: string) => void;
    editingItemId?: string;
    produtos: Produto[]; // To resolve product details if missing in item
    onItemStatusChange?: (itemId: string, status: string) => void;
    processStatuses?: any[];
    onRegisterWaste?: (item: ItemPedido) => void;
}

export const OrderItemsList: React.FC<OrderItemsListProps> = ({
    items,
    onAdd,
    onEdit,
    onRemove,
    editingItemId,
    produtos,
    onItemStatusChange,
    processStatuses = [],
    onRegisterWaste
}) => {
    const formatarUnidadePreco = (produto?: Produto) => {
        if (!produto) return '/un';

        switch (produto.pricingMode) {
            case 'SIMPLE_AREA':
                return '/m²';
            case 'SIMPLE_UNIT':
            case 'DYNAMIC_ENGINEER':
            default:
                return '/un';
        }
    };

    const renderItemDisplay = (item: ItemPedido) => {
        // Only show additional info for products with special attributes
        const attributes = item.attributes || {};

        if (item.product?.pricingMode === 'DYNAMIC_ENGINEER' && (attributes.complexity || attributes.machineTime || attributes.setupTime)) {
            return (
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                    <p className="font-medium text-gray-800 mb-1">📦 Especificações do Produto:</p>
                    <div className="grid grid-cols-2 gap-2">
                        {attributes.complexity && (
                            <p><span className="font-medium">Complexidade:</span> {attributes.complexity}</p>
                        )}
                        {attributes.machineTime && (
                            <p><span className="font-medium">Tempo Máquina:</span> {attributes.machineTime} min</p>
                        )}
                        {attributes.setupTime && (
                            <p><span className="font-medium">Setup:</span> {attributes.setupTime} min</p>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    const renderVariations = (item: ItemPedido, product?: Produto) => {
        const attributes = item.attributes || {};
        const selectedOptions = attributes.selectedOptions;
        const variationDetails: string[] = [];

        // 1. Variações Dinâmicas (Sistema novo/Carimbos)
        if (selectedOptions && product?.configurations) {
            Object.entries(selectedOptions).forEach(([configId, optionId]) => {
                const config = product.configurations?.find(c => c.id === configId);
                if (config) {
                    const option = config.options?.find(o => o.id === optionId);
                    if (option) {
                        variationDetails.push(`${config.name}: ${option.label}`);
                    }
                }
            });
        }

        // 2. Atributos Clássicos (Vinil, Lonas, etc - Lidos das colunas dedicadas ou atributos)
        const paperType = item.paperType || attributes.paperType;
        const printColors = item.printColors || attributes.printColors;
        const finishing = item.finishing || attributes.finishing;
        const paperSize = item.paperSize || attributes.paperSize;

        if (paperType) variationDetails.push(`Mídia: ${paperType}`);
        if (printColors) variationDetails.push(`Cores: ${printColors}`);
        if (finishing) variationDetails.push(`Acabamento: ${finishing}`);
        if (paperSize && paperSize !== 'Personalizado') {
            variationDetails.push(`Tamanho: ${paperSize}`);
        }

        // 3. Materiais da Composição (Snapshot) - Ex: Vinil Branco, Lona 440g, etc.
        if (item.compositionSnapshot) {
            try {
                let snap = item.compositionSnapshot;
                if (typeof snap === 'string') {
                    snap = JSON.parse(snap);
                }
                
                if (Array.isArray(snap)) {
                    snap.forEach((s: any) => {
                        const matName = s.materialName || s.name;
                        // Mostrar se for diferente do nome do produto e não for um insumo genérico/serviço
                        if (matName && 
                            matName !== product?.name && 
                            !variationDetails.includes(matName) &&
                            !matName.toLowerCase().includes('mão de obra') &&
                            !matName.toLowerCase().includes('frete')
                        ) {
                            variationDetails.push(matName);
                        }
                    });
                }
            } catch (e) {
                console.error("Erro ao processar snapshot do item:", e);
            }
        }

        // 4. Fallback: Materiais da Ficha Técnica/Componentes do Produto (Caso o snapshot ainda não exista)
        if (variationDetails.length === 0 && product) {
            // Tentar Fichas Técnicas
            if (product.fichasTecnicas && Array.isArray(product.fichasTecnicas)) {
                product.fichasTecnicas.forEach((ft: any) => {
                    const matName = ft.material?.name;
                    if (matName && matName !== product.name && !variationDetails.includes(matName)) {
                        variationDetails.push(matName);
                    }
                });
            }
            
            // Tentar Componentes
            if (variationDetails.length === 0 && product.components && Array.isArray(product.components)) {
                product.components.forEach((c: any) => {
                    const matName = c.material?.name;
                    if (matName && matName !== product.name && !variationDetails.includes(matName)) {
                        variationDetails.push(matName);
                    }
                });
            }
        }

        if (variationDetails.length === 0) return null;

        return (
            <div className="flex flex-wrap gap-2 mt-1">
                {variationDetails.map((detail, i) => (
                    <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-bold border border-indigo-100 uppercase tracking-tight">
                        {detail}
                    </span>
                ))}
            </div>
        );
    };

    if (items.length === 0) {
        return (
            <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-4 bg-blue-50 rounded-full mb-3">
                        <Plus className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">Nenhum item adicionado</h3>
                    <p className="text-muted-foreground mb-4 max-w-sm">
                        Adicione produtos ou serviços para compor este pedido.
                    </p>
                    <Button onClick={onAdd}>Adicionar Primeiro Item</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Itens do Pedido ({items.length})</CardTitle>
                    <Button
                        onClick={onAdd}
                        size="sm"
                        className="flex items-center space-x-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Adicionar Item</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {items.map((item, index) => {
                        // Ensure product data is available - fetch from produtos list if missing in item
                        // Logic handled by parent usually, but good to have fallback
                        const itemProduct = item.product || produtos.find(p => p.id === item.productId);

                        return (
                            <div
                                key={item.id}
                                className={`border rounded-lg p-4 ${editingItemId === item.id ? 'border-blue-300 bg-blue-50' : 'border-border'
                                    }`}
                            >
                                <div className="flex justify-between items-stretch">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-sm">
                                                #{index + 1}
                                            </span>
                                            <h5 className="font-medium">
                                                {itemProduct?.name || item.attributes?.serviceName || `Produto (ID: ${item.productId})`}
                                            </h5>
                                            {(() => {
                                                const typeConfig = ITEM_TYPE_CONFIGS[item.itemType];
                                                const colorClasses = {
                                                    blue: 'bg-blue-100 text-blue-800 border-blue-200',
                                                    green: 'bg-green-100 text-green-800 border-green-200',
                                                    purple: 'bg-purple-100 text-purple-800 border-purple-200',
                                                    red: 'bg-red-100 text-red-800 border-red-200',
                                                    gray: 'bg-gray-100 text-gray-800 border-gray-200'
                                                };
                                                const colorClass = colorClasses[typeConfig.color as keyof typeof colorClasses] || colorClasses.gray;

                                                return (
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
                                                        <span className="mr-1">{typeConfig.icon}</span>
                                                        {typeConfig.label}
                                                    </span>
                                                );
                                            })()}
                                            {editingItemId === item.id && (
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                                    Editando
                                                </span>
                                            )}
                                            {(item as any).discountStatus === 'PENDING' && (
                                                <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Autorização Pendente
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Variations (Cor, Modelo, etc) */}
                                        {renderVariations(item, itemProduct as Produto)}

                                        {/* Basic item information */}
                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                            <p><span className="font-medium">Qtd:</span> {item.quantity} un</p>

                                            {/* Show dimensions only for area-based products */}
                                            {itemProduct?.pricingMode === 'SIMPLE_AREA' && item.width && item.height && (
                                                <>
                                                    <p><span className="font-medium">Dimensões:</span> {item.width} × {item.height} mm</p>
                                                    <p><span className="font-medium">Área:</span> {((item.width * item.height) / 1000000).toFixed(4)} m²</p>
                                                    <p><span className="font-medium">Área Total:</span> {((item.width * item.height * item.quantity) / 1000000).toFixed(4)} m²</p>
                                                </>
                                            )}
                                        </div>

                                        {/* Simplified item display */}
                                        {renderItemDisplay(item)}

                                        {/* Notes */}
                                        {item.notes && (
                                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                                                <span className="font-medium">Observações:</span> {item.notes}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right side: Price block + Action buttons */}
                                    <div className="text-right ml-4 flex flex-col items-end justify-between min-w-[130px]">
                                        <div>
                                            <p className="text-sm text-gray-500">{formatCurrency(item.unitPrice)}{formatarUnidadePreco(itemProduct as Produto | undefined)}</p>
                                            {/* Discount tag - above total */}
                                            {(item.discountItem || 0) > 0 && (
                                                (item as any).discountStatus === 'PENDING' ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium" title="Aguardando autorização de desconto">
                                                        ⏳ -{formatCurrency(item.discountItem || 0)} pendente
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-red-500 font-medium">
                                                        ↓ {formatCurrency(item.discountItem || 0)} desc.
                                                    </span>
                                                )
                                            )}
                                            <p className="text-lg font-bold">
                                                {formatCurrency(item.totalPrice)}
                                            </p>
                                            {(item as any).discountStatus === 'PENDING' && !(item.discountItem || 0) && (
                                                <p className="text-[10px] text-amber-600 font-medium italic">
                                                    * Aguardando liberação
                                                </p>
                                            )}
                                        </div>
                                        {/* Status + Action buttons in same row */}
                                        <div className="flex items-center gap-1 mt-auto">
                                            <select
                                                value={(item as any).status || 'DRAFT'}
                                                onChange={(e) => onItemStatusChange?.(item.id, e.target.value)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${statusConfig[(item as any).status as keyof typeof statusConfig]?.color || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                                                style={{ appearance: 'none', paddingRight: '28px', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'currentColor\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                                            >
                                                {processStatuses.length > 0 ? (
                                                    processStatuses.map(ps => (
                                                        <option key={ps.id} value={ps.mappedBehavior}>
                                                            {ps.name}
                                                        </option>
                                                    ))
                                                ) : (
                                                    Object.keys(statusConfig).map(key => (
                                                        <option key={key} value={key}>
                                                            {statusConfig[key as keyof typeof statusConfig].label}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                            {(item as any).status === 'FINISHED' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-green-600 border-green-200 hover:bg-green-50 h-7 text-xs px-2"
                                                    onClick={() => onItemStatusChange?.(item.id, 'DELIVERED')}
                                                >
                                                    ✓ Entregue
                                                </Button>
                                            )}
                                            {(item as any).status === 'DELIVERED' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                    ✓ Entregue
                                                </span>
                                            )}
                                            <div className="w-px h-5 bg-gray-200 mx-1" />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => onEdit(item)}
                                                title="Editar item"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50"
                                                onClick={() => onRemove(item.id)}
                                                title="Remover item"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                            {item.id && onRegisterWaste && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-rose-500 border-rose-200 hover:bg-rose-50"
                                                    onClick={() => onRegisterWaste(item)}
                                                    title="Registrar perda"
                                                >
                                                    <Ban className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
