import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Search, Package, X, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ItemType } from '@/types/item-types';
import { ProductItemForm, ServiceItemForm } from './item-forms';

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    minPrice?: number;
    productType?: string; // Para identificar se é serviço
}

interface ItemPedido {
    id: string;
    itemType: ItemType;
    productId?: string;
    product?: Produto;
    width?: number;
    height?: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    attributes: Record<string, any>;
}

interface AddItemFormSimplifiedProps {
    produtos: Produto[];
    onAddItem: (item: ItemPedido) => void;
    onUpdateItem?: (item: ItemPedido) => void;
    editingItem?: ItemPedido | null;
    isModal?: boolean;
    onCancel?: () => void;
}

const AddItemFormSimplified: React.FC<AddItemFormSimplifiedProps> = ({
    produtos,
    onAddItem,
    onUpdateItem,
    editingItem,
    isModal = false,
    onCancel
}) => {
    const produtoDropdownRef = useRef<HTMLDivElement>(null);
    const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
    const [searchProduto, setSearchProduto] = useState('');
    const [showProdutoDropdown, setShowProdutoDropdown] = useState(false);

    // Verificar se há produtos disponíveis
    const hasProducts = produtos && produtos.length > 0;

    // Carregar dados do item em edição
    useEffect(() => {
        if (editingItem) {
            setProdutoSelecionado(editingItem.product || null);
            setSearchProduto(editingItem.product?.name || '');
        }
    }, [editingItem]);

    // Effect para fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (produtoDropdownRef.current && !produtoDropdownRef.current.contains(event.target as Node)) {
                setShowProdutoDropdown(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowProdutoDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const produtosFiltrados = produtos.filter(produto =>
        produto.name.toLowerCase().includes(searchProduto.toLowerCase())
    );

    // Determinar se o produto selecionado é um serviço
    const isService = produtoSelecionado?.productType?.toLowerCase().includes('serviço') ||
        produtoSelecionado?.productType?.toLowerCase().includes('arte') ||
        produtoSelecionado?.name.toLowerCase().includes('arte') ||
        produtoSelecionado?.name.toLowerCase().includes('serviço');

    const handleItemSubmit = (itemData: any) => {
        const item: ItemPedido = {
            id: editingItem?.id || Date.now().toString(),
            itemType: isService ? ItemType.SERVICE : ItemType.PRODUCT,
            ...itemData
        };

        if (editingItem && onUpdateItem) {
            onUpdateItem(item);
            toast.success('Item atualizado com sucesso!');
        } else {
            onAddItem(item);
            toast.success('Item adicionado ao pedido!');
        }

        // Limpar formulário se não for modal
        if (!isModal) {
            setProdutoSelecionado(null);
            setSearchProduto('');
        }
    };

    const content = (
        <div className="space-y-4">
            {/* Seleção de Produto/Serviço */}
            <div className="relative" ref={produtoDropdownRef}>
                <label className="text-sm font-medium">Produto/Serviço</label>
                <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="Buscar produto ou serviço..."
                        value={searchProduto}
                        onChange={(e) => {
                            setSearchProduto(e.target.value);
                            setShowProdutoDropdown(true);
                        }}
                        onFocus={() => setShowProdutoDropdown(true)}
                        className="pl-10"
                    />

                    {showProdutoDropdown && produtosFiltrados.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {produtosFiltrados.map(produto => {
                                const isServiceItem = produto.productType?.toLowerCase().includes('serviço') ||
                                    produto.productType?.toLowerCase().includes('arte') ||
                                    produto.name.toLowerCase().includes('arte') ||
                                    produto.name.toLowerCase().includes('serviço');

                                return (
                                    <div
                                        key={produto.id}
                                        className="p-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                                        onClick={() => {
                                            setProdutoSelecionado(produto);
                                            setSearchProduto(produto.name);
                                            setShowProdutoDropdown(false);
                                        }}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <span className="text-lg">{isServiceItem ? '🎨' : '📦'}</span>
                                            <div className="flex-1">
                                                <div className="font-medium">{produto.name}</div>
                                                {produto.description && (
                                                    <div className="text-sm text-muted-foreground">{produto.description}</div>
                                                )}
                                                <div className="text-sm text-muted-foreground">
                                                    {isServiceItem ? 'Serviço/Arte' :
                                                        produto.pricingMode === 'SIMPLE_AREA' ? 'Produto por m²' :
                                                            produto.pricingMode === 'SIMPLE_UNIT' ? 'Produto por unidade' : 'Produto dinâmico'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {produtoSelecionado && (
                    <div className={`p-3 border rounded-lg mt-3 ${isService ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <span className="text-lg">{isService ? '🎨' : '📦'}</span>
                                <div>
                                    <span className={`font-medium ${isService ? 'text-blue-800' : 'text-green-800'}`}>
                                        {produtoSelecionado.name}
                                    </span>
                                    <div className={`text-sm ${isService ? 'text-blue-600' : 'text-green-600'}`}>
                                        {isService ? 'Serviço/Arte' :
                                            produtoSelecionado.pricingMode === 'SIMPLE_AREA' ? 'Produto por m²' :
                                                produtoSelecionado.pricingMode === 'SIMPLE_UNIT' ? 'Produto por unidade' : 'Produto dinâmico'}
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setProdutoSelecionado(null);
                                    setSearchProduto('');
                                    setShowProdutoDropdown(true);
                                }}
                                className={`${isService ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-100' : 'text-green-600 hover:text-green-800 hover:bg-green-100'}`}
                                title="Trocar produto/serviço"
                            >
                                <X className="w-4 h-4 mr-1" />
                                Trocar
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Formulário Específico */}
            {produtoSelecionado && (
                <div className="mt-6">
                    {isService ? (
                        <ServiceItemForm
                            serviceName={produtoSelecionado.name}
                            onSubmit={handleItemSubmit}
                            editingData={editingItem}
                            isEditing={!!editingItem}
                        />
                    ) : (
                        <ProductItemForm
                            produto={produtoSelecionado}
                            onSubmit={handleItemSubmit}
                            editingData={editingItem}
                            isEditing={!!editingItem}
                        />
                    )}
                </div>
            )}

            {/* Botão de cancelar para modal */}
            {isModal && onCancel && !produtoSelecionado && (
                <div className="flex justify-end">
                    <Button variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                </div>
            )}
        </div>
    );

    // Se não há produtos, mostrar mensagem de aviso
    if (!hasProducts) {
        const noProductsContent = (
            <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum produto cadastrado
                </h3>
                <p className="text-gray-600 mb-4">
                    Para adicionar itens ao pedido, você precisa cadastrar produtos primeiro.
                </p>
                <div className="space-y-2">
                    <p className="text-sm text-gray-500">
                        <strong>Passo 1:</strong> Cadastre materiais (papel, lona, etc.)
                    </p>
                    <p className="text-sm text-gray-500">
                        <strong>Passo 2:</strong> Cadastre produtos usando os materiais
                    </p>
                    <p className="text-sm text-gray-500">
                        <strong>Passo 3:</strong> Volte aqui para criar pedidos
                    </p>
                </div>
                <div className="mt-6 space-x-3">
                    <Button
                        onClick={() => window.open('/materiais', '_blank')}
                        variant="outline"
                    >
                        Cadastrar Materiais
                    </Button>
                    <Button
                        onClick={() => window.open('/produtos', '_blank')}
                    >
                        Cadastrar Produtos
                    </Button>
                </div>
                {onCancel && (
                    <Button
                        onClick={onCancel}
                        variant="ghost"
                        className="mt-3"
                    >
                        Fechar
                    </Button>
                )}
            </div>
        );

        if (isModal) {
            return (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Package className="w-5 h-5" />
                                <span>Adicionar Item</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {noProductsContent}
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Package className="w-5 h-5" />
                        <span>Adicionar Item</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {noProductsContent}
                </CardContent>
            </Card>
        );
    }

    if (isModal) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="flex items-center space-x-2">
                                    {editingItem ? (
                                        <>
                                            <Save className="w-5 h-5" />
                                            <span>Editar Item</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-5 h-5" />
                                            <span>Adicionar Item</span>
                                        </>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    {editingItem
                                        ? 'Modifique as informações do item selecionado'
                                        : 'Selecione um produto ou serviço e configure os detalhes'
                                    }
                                </CardDescription>
                            </div>
                            {onCancel && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onCancel}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {content}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Package className="w-5 h-5" />
                    <span>Adicionar Item</span>
                </CardTitle>
                <CardDescription>
                    Selecione um produto ou serviço e configure os detalhes
                </CardDescription>
            </CardHeader>
            <CardContent>
                {content}
            </CardContent>
        </Card>
    );
};

export default AddItemFormSimplified;