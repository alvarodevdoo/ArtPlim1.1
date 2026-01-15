import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
    Plus,
    Search,
    Calculator,
    Save,
    Package,
    X,
    Palette,
    Scissors,
    FileText,
    Zap
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
    ItemType,
    ITEM_TYPE_CONFIGS,
    MATERIALS_BY_TYPE,
    FINISHINGS_BY_TYPE,
    STANDARD_SIZES_BY_TYPE,
    ItemFormData,
    ItemPedido
} from '@/types/item-types';

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    minPrice?: number;
}

interface AddItemFormProps {
    produtos: Produto[];
    onAddItem: (item: ItemPedido) => void;
    onUpdateItem?: (item: ItemPedido) => void;
    editingItem?: ItemPedido | null;
    isModal?: boolean;
    onCancel?: () => void;
}

const AddItemFormRefactored: React.FC<AddItemFormProps> = ({
    produtos,
    onAddItem,
    onUpdateItem,
    editingItem,
    isModal = false,
    onCancel
}) => {
    const produtoDropdownRef = useRef<HTMLDivElement>(null);

    // Estados principais do formulário
    const [formData, setFormData] = useState<ItemFormData>({
        itemType: ItemType.PRODUCT,
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        attributes: {}
    });

    // Estados auxiliares
    const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
    const [searchProduto, setSearchProduto] = useState('');
    const [showProdutoDropdown, setShowProdutoDropdown] = useState(false);
    const [simulatingPrice, setSimulatingPrice] = useState(false);

    // Carregar dados do item em edição
    useEffect(() => {
        if (editingItem) {
            setFormData({
                itemType: editingItem.itemType || ItemType.PRODUCT,
                productId: editingItem.productId,
                quantity: editingItem.quantity,
                width: editingItem.width,
                height: editingItem.height,
                totalArea: editingItem.totalArea,
                unitPrice: editingItem.unitPrice,
                totalPrice: editingItem.totalPrice,
                notes: editingItem.notes,
                attributes: editingItem.attributes || {}
            });

            setProdutoSelecionado(editingItem.product || null);
            setSearchProduto(editingItem.product?.name || '');
        }
    }, [editingItem]);

    // Recalcular preço total quando unitPrice ou quantity mudam
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            totalPrice: prev.unitPrice * prev.quantity
        }));
    }, [formData.unitPrice, formData.quantity]);

    // Recalcular área total quando dimensões mudam
    useEffect(() => {
        if (formData.width && formData.height) {
            const areaM2 = (formData.width * formData.height) / 1000000;
            setFormData(prev => ({
                ...prev,
                totalArea: areaM2
            }));
        }
    }, [formData.width, formData.height]);

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

    const updateFormData = (updates: Partial<ItemFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const updateAttributes = (key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            attributes: {
                ...prev.attributes,
                [key]: value
            }
        }));
    };

    const produtosFiltrados = produtos.filter(produto =>
        produto.name.toLowerCase().includes(searchProduto.toLowerCase())
    );

    const currentConfig = ITEM_TYPE_CONFIGS[formData.itemType];

    const simularPreco = async () => {
        if (!produtoSelecionado || formData.quantity <= 0) {
            return;
        }

        // Validar dimensões apenas se necessário para o tipo
        if (currentConfig.requiresDimensions && (!formData.width || !formData.height)) {
            toast.error('Informe as dimensões para calcular o preço');
            return;
        }

        setSimulatingPrice(true);
        try {
            const response = await api.post('/api/sales/simulate', {
                productId: produtoSelecionado.id,
                itemType: formData.itemType,
                width: formData.width || 1,
                height: formData.height || 1,
                quantity: formData.quantity,
                attributes: formData.attributes
            });

            const simulacao = response.data.data;
            updateFormData({ unitPrice: simulacao.unitPrice });
            toast.success('Preço calculado automaticamente!');
        } catch (error: any) {
            // Fallback para preço simples
            if (produtoSelecionado.salePrice) {
                if (formData.itemType === ItemType.PRINT_SHEET && formData.totalArea) {
                    const precoCalculado = produtoSelecionado.salePrice * formData.totalArea;
                    updateFormData({ unitPrice: precoCalculado });
                    toast.info('Usando preço por m² configurado');
                } else {
                    updateFormData({ unitPrice: produtoSelecionado.salePrice });
                    toast.info('Usando preço configurado');
                }
            } else {
                toast.error('Erro ao calcular preço. Insira manualmente.');
            }
        } finally {
            setSimulatingPrice(false);
        }
    };

    const limparFormulario = () => {
        setFormData({
            itemType: ItemType.PRODUCT,
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            attributes: {}
        });
        setProdutoSelecionado(null);
        setSearchProduto('');
    };

    const handleSubmit = () => {
        // Validações básicas
        if (formData.quantity <= 0 || formData.unitPrice <= 0) {
            toast.error('Preencha quantidade e preço');
            return;
        }

        // Validar dimensões se necessário
        if (currentConfig.requiresDimensions && (!formData.width || !formData.height)) {
            toast.error('Informe as dimensões para este tipo de item');
            return;
        }

        // Validar produto para tipos que precisam
        if (formData.itemType === ItemType.PRODUCT && !produtoSelecionado) {
            toast.error('Selecione um produto');
            return;
        }

        const item: ItemPedido = {
            id: editingItem?.id || Date.now().toString(),
            ...formData,
            product: produtoSelecionado
        };

        if (editingItem && onUpdateItem) {
            onUpdateItem(item);
            toast.success('Item atualizado com sucesso!');
        } else {
            onAddItem(item);
            toast.success('Item adicionado ao pedido!');
        }

        if (!isModal) {
            limparFormulario();
        }
    };

    const renderItemTypeSelector = () => (
        <div className="space-y-3">
            <label className="text-sm font-medium">Tipo de Item</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(ITEM_TYPE_CONFIGS).map((config) => (
                    <div
                        key={config.value}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.itemType === config.value
                            ? `border-${config.color}-500 bg-${config.color}-50`
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                        onClick={() => {
                            updateFormData({ itemType: config.value });
                            // Limpar campos específicos quando mudar tipo
                            updateFormData({
                                width: undefined,
                                height: undefined,
                                totalArea: undefined,
                                attributes: {}
                            });
                        }}
                    >
                        <div className="flex items-center space-x-3">
                            <span className="text-2xl">{config.icon}</span>
                            <div>
                                <h4 className="font-medium">{config.label}</h4>
                                <p className="text-sm text-muted-foreground">{config.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderProductSelector = () => {
        // Só mostrar seletor de produto para tipos que precisam
        if (formData.itemType === ItemType.SERVICE) {
            return null;
        }

        return (
            <div className="relative" ref={produtoDropdownRef}>
                <label className="text-sm font-medium">Produto (Opcional)</label>
                <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="Buscar produto..."
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
                            {produtosFiltrados.map(produto => (
                                <div
                                    key={produto.id}
                                    className="p-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                                    onClick={() => {
                                        setProdutoSelecionado(produto);
                                        setSearchProduto(produto.name);
                                        setShowProdutoDropdown(false);
                                        updateFormData({ productId: produto.id });

                                        if (produto.salePrice) {
                                            updateFormData({ unitPrice: produto.salePrice });
                                        }
                                    }}
                                >
                                    <div className="font-medium">{produto.name}</div>
                                    {produto.description && (
                                        <div className="text-sm text-muted-foreground">{produto.description}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderDimensionsFields = () => {
        if (!currentConfig.requiresDimensions) {
            return null;
        }

        const standardSizes = STANDARD_SIZES_BY_TYPE[formData.itemType];

        return (
            <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                        <Scissors className="w-4 h-4 mr-2" />
                        Dimensões
                    </h4>

                    {/* Seletor de tamanho padrão */}
                    {standardSizes.length > 0 && (
                        <div className="mb-4">
                            <label className="text-sm font-medium">Tamanho Padrão</label>
                            <select
                                value=""
                                onChange={(e) => {
                                    const size = standardSizes.find(s => s.value === e.target.value);
                                    if (size) {
                                        updateFormData({ width: size.width, height: size.height });
                                        updateAttributes('standardSize', size.value);
                                    }
                                }}
                                className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background mt-1"
                            >
                                <option value="">Selecione um tamanho padrão</option>
                                {standardSizes.map(size => (
                                    <option key={size.value} value={size.value}>
                                        {size.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Campos de dimensão customizada */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Largura (mm)</label>
                            <Input
                                type="number"
                                value={formData.width || ''}
                                onChange={(e) => updateFormData({ width: Number(e.target.value) })}
                                placeholder="0"
                                min="1"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Altura (mm)</label>
                            <Input
                                type="number"
                                value={formData.height || ''}
                                onChange={(e) => updateFormData({ height: Number(e.target.value) })}
                                placeholder="0"
                                min="1"
                            />
                        </div>
                    </div>

                    {/* Mostrar área calculada */}
                    {formData.width && formData.height && (
                        <div className="mt-3 p-3 bg-blue-100 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-medium">Área unitária:</span>
                                    <p>{formData.totalArea?.toFixed(4)} m²</p>
                                </div>
                                <div>
                                    <span className="font-medium">Área total:</span>
                                    <p>{((formData.totalArea || 0) * formData.quantity).toFixed(4)} m²</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderMaterialSelector = () => {
        if (!currentConfig.showMaterialSelector) {
            return null;
        }

        const materials = MATERIALS_BY_TYPE[formData.itemType];

        return (
            <div>
                <label className="text-sm font-medium flex items-center">
                    <Package className="w-4 h-4 mr-2" />
                    Material
                </label>
                <select
                    value={formData.attributes.material || ''}
                    onChange={(e) => updateAttributes('material', e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background mt-1"
                >
                    <option value="">Selecione o material</option>
                    {materials.map(material => (
                        <option key={material.value} value={material.value}>
                            {material.label}
                        </option>
                    ))}
                </select>
            </div>
        );
    };

    const renderFinishingSelector = () => {
        if (!currentConfig.showFinishingSelector) {
            return null;
        }

        const finishings = FINISHINGS_BY_TYPE[formData.itemType];

        return (
            <div>
                <label className="text-sm font-medium flex items-center">
                    <Palette className="w-4 h-4 mr-2" />
                    Acabamento
                </label>
                <select
                    value={formData.attributes.finishing || ''}
                    onChange={(e) => updateAttributes('finishing', e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background mt-1"
                >
                    <option value="">Selecione o acabamento</option>
                    {finishings.map(finishing => (
                        <option key={finishing.value} value={finishing.value}>
                            {finishing.label}
                        </option>
                    ))}
                </select>
            </div>
        );
    };

    const renderSpecificFields = () => {
        switch (formData.itemType) {
            case ItemType.SERVICE:
                return (
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                                <Palette className="w-4 h-4 mr-2" />
                                Especificações do Serviço
                            </h4>
                            <div>
                                <label className="text-sm font-medium">Descrição do Serviço</label>
                                <textarea
                                    value={formData.attributes.description || ''}
                                    onChange={(e) => updateAttributes('description', e.target.value)}
                                    placeholder="Ex: Criação de logotipo, arte para cartão de visita..."
                                    className="w-full h-20 p-3 border border-input rounded-md resize-none mt-1"
                                />
                            </div>
                            <div className="mt-3">
                                <label className="text-sm font-medium">Briefing/Observações</label>
                                <textarea
                                    value={formData.attributes.briefing || ''}
                                    onChange={(e) => updateAttributes('briefing', e.target.value)}
                                    placeholder="Cores, estilo, referências..."
                                    className="w-full h-16 p-3 border border-input rounded-md resize-none mt-1"
                                />
                            </div>
                        </div>
                    </div>
                );

            case ItemType.LASER_CUT:
                return (
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <h4 className="font-medium text-red-800 mb-3 flex items-center">
                                <Zap className="w-4 h-4 mr-2" />
                                Especificações do Corte Laser
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Tempo de Máquina (min)</label>
                                    <Input
                                        type="number"
                                        value={formData.attributes.machineTimeMinutes || ''}
                                        onChange={(e) => updateAttributes('machineTimeMinutes', Number(e.target.value))}
                                        placeholder="0"
                                        min="0"
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Tipo de Operação</label>
                                    <select
                                        value={formData.attributes.cutType || ''}
                                        onChange={(e) => updateAttributes('cutType', e.target.value)}
                                        className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                                    >
                                        <option value="">Selecione</option>
                                        <option value="cut">Corte</option>
                                        <option value="engrave">Gravação</option>
                                        <option value="cut_engrave">Corte + Gravação</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-3">
                                <label className="text-sm font-medium">Arquivo Vetorial</label>
                                <Input
                                    value={formData.attributes.vectorFile || ''}
                                    onChange={(e) => updateAttributes('vectorFile', e.target.value)}
                                    placeholder="Ex: logo.dxf, caixa.ai"
                                />
                            </div>
                        </div>
                    </div>
                );

            case ItemType.PRINT_ROLL:
                return (
                    <div className="space-y-4">
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <h4 className="font-medium text-purple-800 mb-3">Especificações da Impressão</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Resolução</label>
                                    <select
                                        value={formData.attributes.resolution || ''}
                                        onChange={(e) => updateAttributes('resolution', e.target.value)}
                                        className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                                    >
                                        <option value="">Selecione</option>
                                        <option value="720dpi">720 DPI</option>
                                        <option value="1440dpi">1440 DPI</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Perfil de Cor</label>
                                    <select
                                        value={formData.attributes.colorProfile || ''}
                                        onChange={(e) => updateAttributes('colorProfile', e.target.value)}
                                        className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                                    >
                                        <option value="">Selecione</option>
                                        <option value="CMYK">CMYK</option>
                                        <option value="RGB">RGB</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case ItemType.PRINT_SHEET:
                return (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h4 className="font-medium text-green-800 mb-3">Especificações da Impressão</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Cores de Impressão</label>
                                    <select
                                        value={formData.attributes.printColors || ''}
                                        onChange={(e) => updateAttributes('printColors', e.target.value)}
                                        className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                                    >
                                        <option value="">Selecione</option>
                                        <option value="1x0">1x0 (Preto frente)</option>
                                        <option value="1x1">1x1 (Preto frente e verso)</option>
                                        <option value="4x0">4x0 (Colorido frente)</option>
                                        <option value="4x1">4x1 (Colorido frente, preto verso)</option>
                                        <option value="4x4">4x4 (Colorido frente e verso)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Lados de Impressão</label>
                                    <div className="text-sm text-muted-foreground mt-2">
                                        {formData.attributes.printColors?.includes('x1') || formData.attributes.printColors?.includes('x4')
                                            ? 'Frente e Verso'
                                            : formData.attributes.printColors?.includes('x0')
                                                ? 'Apenas Frente'
                                                : 'Selecione as cores'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const content = (
        <div className="space-y-6">
            {/* Seletor de Tipo de Item */}
            {renderItemTypeSelector()}

            {/* Seletor de Produto */}
            {renderProductSelector()}

            {/* Produto Selecionado */}
            {produtoSelecionado && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-blue-800">{produtoSelecionado.name}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setProdutoSelecionado(null);
                                setSearchProduto('');
                                updateFormData({ productId: undefined });
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                        >
                            <X className="w-4 h-4 mr-1" />
                            Remover
                        </Button>
                    </div>
                </div>
            )}

            {/* Quantidade */}
            <div>
                <label className="text-sm font-medium">Quantidade</label>
                <Input
                    type="number"
                    value={formData.quantity || ''}
                    onChange={(e) => updateFormData({ quantity: Number(e.target.value) })}
                    placeholder="1"
                    min="1"
                />
            </div>

            {/* Dimensões */}
            {renderDimensionsFields()}

            {/* Seletor de Material */}
            {renderMaterialSelector()}

            {/* Seletor de Acabamento */}
            {renderFinishingSelector()}

            {/* Campos Específicos por Tipo */}
            {renderSpecificFields()}

            {/* Preço */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium">Preço Unitário</label>
                    <div className="flex space-x-2">
                        <Input
                            type="number"
                            value={formData.unitPrice || ''}
                            onChange={(e) => updateFormData({ unitPrice: Number(e.target.value) })}
                            placeholder="0,00"
                            min="0"
                            step="0.01"
                        />
                        {produtoSelecionado && (
                            <Button
                                variant="outline"
                                onClick={simularPreco}
                                disabled={simulatingPrice}
                            >
                                <Calculator className="w-4 h-4 mr-2" />
                                {simulatingPrice ? 'Calculando...' : 'Calcular'}
                            </Button>
                        )}
                    </div>
                </div>
                <div>
                    <label className="text-sm font-medium">Total do Item</label>
                    <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(formData.totalPrice)}
                    </div>
                </div>
            </div>

            {/* Observações */}
            <div>
                <label className="text-sm font-medium flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Observações do Item
                </label>
                <textarea
                    value={formData.notes || ''}
                    onChange={(e) => updateFormData({ notes: e.target.value })}
                    placeholder="Observações específicas deste item..."
                    className="w-full h-20 p-3 border border-input rounded-md resize-none mt-1"
                />
            </div>

            {/* Botões de Ação */}
            <div className={`flex space-x-2 ${isModal ? 'pt-4 border-t' : ''}`}>
                <Button
                    onClick={handleSubmit}
                    disabled={formData.quantity <= 0 || formData.unitPrice <= 0 ||
                        (currentConfig.requiresDimensions && (!formData.width || !formData.height))}
                    className="flex-1"
                >
                    {editingItem ? (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Salvar Alterações
                        </>
                    ) : (
                        <>
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar Item ao Pedido
                        </>
                    )}
                </Button>
                {isModal && onCancel && (
                    <Button variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                )}
            </div>
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
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
                                        : 'Selecione o tipo de item e configure suas especificações'
                                    }
                                </CardDescription>
                            </div>
                            {onCancel && (
                                <Button variant="outline" size="sm" onClick={onCancel}>
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
                    Selecione o tipo de item e configure suas especificações
                </CardDescription>
            </CardHeader>
            <CardContent>
                {content}
            </CardContent>
        </Card>
    );
};

export default AddItemFormRefactored;