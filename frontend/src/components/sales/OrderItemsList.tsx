import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ItemPedido, Produto } from '@/types/sales';
import { ITEM_TYPE_CONFIGS } from '@/types/item-types';

// Status configuration for badge styling
const statusConfig = {
    DRAFT: { label: 'Pedido Criado', color: 'bg-slate-100 text-slate-800 border-slate-200' },
    APPROVED: { label: 'Aguardando Aprovação', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    IN_PRODUCTION: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    FINISHED: { label: 'Aguardando Retirada', color: 'bg-green-100 text-green-800 border-green-200' },
    DELIVERED: { label: 'Entregue', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-200' }
};

interface OrderItemsListProps {
    items: ItemPedido[];
    onAdd: () => void;
    onEdit: (item: ItemPedido) => void;
    onRemove: (itemId: string) => void;
    editingItemId?: string;
    produtos: Produto[]; // To resolve product details if missing in item
    onItemStatusChange?: (itemId: string, status: string) => void;
}

export const OrderItemsList: React.FC<OrderItemsListProps> = ({
    items,
    onAdd,
    onEdit,
    onRemove,
    editingItemId,
    produtos,
    onItemStatusChange
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
                                <div className="flex justify-between items-start">
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
                                        </div>

                                        {/* Basic item information */}
                                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
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

                                        {/* Item Status Selector - Badge Style */}
                                        <div className="mt-4 flex items-center space-x-2">
                                            <select
                                                value={(item as any).status || 'DRAFT'}
                                                onChange={(e) => onItemStatusChange?.(item.id, e.target.value)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${statusConfig[(item as any).status as keyof typeof statusConfig]?.color || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                                                style={{ appearance: 'none', paddingRight: '28px', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'currentColor\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                                            >
                                                <option value="DRAFT">Pedido Criado</option>
                                                <option value="APPROVED">Aguardando Aprovação</option>
                                                <option value="IN_PRODUCTION">Em Produção</option>
                                                <option value="FINISHED">Aguardando Retirada</option>
                                            </select>

                                            {/* Delivery Button for FINISHED items */}
                                            {(item as any).status === 'FINISHED' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-green-600 border-green-200 hover:bg-green-50"
                                                    onClick={() => onItemStatusChange?.(item.id, 'DELIVERED')}
                                                >
                                                    ✓ Marcar como Entregue
                                                </Button>
                                            )}

                                            {/* Show delivered badge */}
                                            {(item as any).status === 'DELIVERED' && (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                    ✓ Entregue
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="font-medium">{formatCurrency(item.unitPrice)}{formatarUnidadePreco(itemProduct as Produto | undefined)}</p>
                                        <p className="text-lg font-bold">{formatCurrency(item.totalPrice)}</p>
                                        <div className="flex space-x-2 mt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onEdit(item)}
                                            >
                                                <Edit className="w-3 h-3 mr-1" />
                                                Editar
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 border-red-200 hover:bg-red-50"
                                                onClick={() => onRemove(item.id)}
                                            >
                                                <Trash2 className="w-3 h-3 mr-1" />
                                                Remover
                                            </Button>
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
