import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Package, X } from 'lucide-react';
import { ItemType, ITEM_TYPE_CONFIGS } from '@/types/item-types';

import { getProductDisplayInfo } from '@/lib/pricing/displayUtils';
import { Produto } from '@/types/sales';

interface SelectableProduct extends Produto {
    usageCount?: number;
}

interface ProductSelectionModalProps {
    produtos: SelectableProduct[];
    onSelect: (produto: SelectableProduct) => void;
    onCancel: () => void;
    isOpen: boolean;
}

type SortOrder = 'usage' | 'alphabetic-asc' | 'alphabetic-desc';

const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
    produtos,
    onSelect,
    onCancel,
    isOpen
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<SortOrder>('usage');
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Filtrar produtos baseado no termo de busca
    const filteredProducts = produtos.filter(produto =>
        produto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        produto.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Ordenar produtos baseado na ordenação selecionada
    const sortedProducts = [...filteredProducts].sort((a, b) => {
        switch (sortOrder) {
            case 'usage':
                return (b.usageCount || 0) - (a.usageCount || 0);
            case 'alphabetic-asc':
                return a.name.localeCompare(b.name);
            case 'alphabetic-desc':
                return b.name.localeCompare(a.name);
            default:
                return 0;
        }
    });

    // Reset hover index when products change
    useEffect(() => {
        if (sortedProducts.length > 0) {
            // Iniciar com o primeiro item com hover
            setHoveredIndex(0);
        } else {
            setHoveredIndex(null);
        }
    }, [sortedProducts.length, searchTerm, sortOrder]);

    // Focus no input quando modal abre e bloquear scroll da página
    useEffect(() => {
        if (isOpen) {
            // Focus no input
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }

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

    // Navegação por teclado
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    setHoveredIndex(prev => {
                        const newIndex = prev === null ? 0 : Math.min(prev + 1, sortedProducts.length - 1);
                        return newIndex;
                    });
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    setHoveredIndex(prev => {
                        const newIndex = prev === null ? sortedProducts.length - 1 : Math.max(prev - 1, 0);
                        return newIndex;
                    });
                    break;
                case 'Enter':
                    event.preventDefault();
                    if (hoveredIndex !== null && sortedProducts[hoveredIndex]) {
                        handleSelect(sortedProducts[hoveredIndex]);
                    }
                    break;
                case 'Escape':
                    event.preventDefault();
                    onCancel();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, hoveredIndex, sortedProducts, onCancel]);

    // Auto-scroll para item com hover
    useEffect(() => {
        if (listRef.current && sortedProducts.length > 0 && hoveredIndex !== null) {
            // Usar querySelector para encontrar o item com hover
            const hoveredElement = listRef.current.querySelector(`[data-index="${hoveredIndex}"]`) as HTMLElement;
            if (hoveredElement) {
                hoveredElement.scrollIntoView({
                    behavior: 'auto', // Sem animação - instantâneo
                    block: 'nearest'  // Movimento mínimo necessário
                });
            }
        }
    }, [hoveredIndex, sortedProducts.length]);

    // Auto-selecionar se sobrar apenas 1 item
    useEffect(() => {
        if (sortedProducts.length === 1 && searchTerm.length > 0) {
            setHoveredIndex(0);
        }
    }, [sortedProducts.length, searchTerm]);

    const handleSelect = (produto: SelectableProduct) => {
        onSelect(produto);
    };

    const getSortIcon = () => {
        switch (sortOrder) {
            case 'usage':
                return <ArrowUpDown className="w-4 h-4" />;
            case 'alphabetic-asc':
                return <ArrowUp className="w-4 h-4" />;
            case 'alphabetic-desc':
                return <ArrowDown className="w-4 h-4" />;
        }
    };

    const getSortLabel = () => {
        switch (sortOrder) {
            case 'usage':
                return 'Relevância';
            case 'alphabetic-asc':
                return 'A → Z';
            case 'alphabetic-desc':
                return 'Z → A';
        }
    };

    const cycleSortOrder = () => {
        const orders: SortOrder[] = ['usage', 'alphabetic-asc', 'alphabetic-desc'];
        const currentIndex = orders.indexOf(sortOrder);
        const nextIndex = (currentIndex + 1) % orders.length;
        setSortOrder(orders[nextIndex]);
    };

    const getProductTypeInfo = (produto: SelectableProduct) => {
        const productType = produto.productType || ItemType.PRODUCT;
        const config = ITEM_TYPE_CONFIGS[productType];

        return {
            icon: config?.icon || '📦',
            label: config?.label || 'Produto',
            isService: productType === ItemType.SERVICE,
            color: config?.color || 'gray'
        };
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                margin: 0,
                padding: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <div className="p-4 w-full h-full flex items-center justify-center">
                <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col">
                    <CardHeader className="pb-4 flex-shrink-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="flex items-center space-x-2">
                                    <Package className="w-5 h-5" />
                                    <span>Selecionar Produto/Serviço</span>
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Use as setas ↑↓ para navegar, Enter para selecionar, Esc para cancelar
                                </p>
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

                    <CardContent className="flex-1 flex flex-col space-y-4 min-h-0">
                        {/* Barra de Busca e Ordenação */}
                        <div className="flex space-x-2 flex-shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    ref={searchInputRef}
                                    placeholder="Buscar produto ou serviço..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button
                                variant="outline"
                                onClick={cycleSortOrder}
                                className="flex items-center space-x-2 min-w-[120px]"
                                title="Alterar ordenação"
                            >
                                {getSortIcon()}
                                <span className="text-sm">{getSortLabel()}</span>
                            </Button>
                        </div>

                        {/* Lista de Produtos com Scroll Interno */}
                        <div
                            ref={listRef}
                            className="flex-1 overflow-y-auto border border-border rounded-md min-h-0"
                            style={{ maxHeight: 'calc(85vh - 220px)' }}
                        >
                            {sortedProducts.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Nenhum produto encontrado</p>
                                    <p className="text-sm">Tente ajustar o termo de busca</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {sortedProducts.map((produto, index) => {
                                        const productInfo = getProductTypeInfo(produto);
                                        const isHovered = index === hoveredIndex;

                                        return (
                                            <div
                                                key={produto.id}
                                                data-index={index}
                                                className="p-4 cursor-pointer border-l-4"
                                                style={{
                                                    backgroundColor: isHovered ? '#dbeafe' : 'transparent',
                                                    borderLeftColor: isHovered ? '#3b82f6' : 'transparent'
                                                }}
                                                onMouseEnter={() => setHoveredIndex(index)}
                                                onMouseLeave={() => setHoveredIndex(null)}
                                                onClick={() => handleSelect(produto)}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start space-x-4 flex-1 min-w-0">
                                                        <div className="flex-shrink-0 w-12 h-12 bg-muted/50 rounded-lg flex items-center justify-center text-3xl">
                                                            {productInfo.icon}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center flex-wrap gap-2 mb-1">
                                                                <h4 className="font-bold text-foreground truncate">{produto.name}</h4>
                                                            </div>
                                                            
                                                            {produto.description && (
                                                                <p className="text-sm text-muted-foreground line-clamp-1 leading-tight">
                                                                    {produto.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end text-right min-w-[120px] gap-2">
                                                        {(() => {
                                                            const display = getProductDisplayInfo(produto);
                                                            return (
                                                                <div className="flex flex-col items-end">
                                                                    <div className="flex flex-col items-end leading-none">
                                                                        {display.isStarting && (
                                                                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter mb-0.5">A partir de</span>
                                                                        )}
                                                                        <span className="text-lg font-black text-primary tracking-tight">
                                                                            {display.price}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                        
                                                        <Button
                                                            variant={isHovered ? "default" : "outline"}
                                                            size="sm"
                                                            className="h-8 px-4 mt-auto font-semibold"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSelect(produto);
                                                            }}
                                                        >
                                                            Selecionar
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Rodapé com informações */}
                        <div className="flex justify-between items-center text-sm text-muted-foreground border-t pt-4">
                            <span>
                                {sortedProducts.length} produto(s) encontrado(s)
                                {searchTerm && ` para "${searchTerm}"`}
                            </span>
                            {sortedProducts.length > 0 && (
                                <span className="text-xs">
                                    Use ↑↓ para navegar • Enter para selecionar
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ProductSelectionModal;