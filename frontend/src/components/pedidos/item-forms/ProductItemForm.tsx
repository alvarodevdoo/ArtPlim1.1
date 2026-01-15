import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { Calculator, Save, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    minPrice?: number;
}

interface ProductItemFormProps {
    produto: Produto;
    onSubmit: (itemData: any) => void;
    editingData?: any;
    isEditing?: boolean;
}

const ProductItemForm: React.FC<ProductItemFormProps> = ({
    produto,
    onSubmit,
    editingData,
    isEditing = false
}) => {
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);
    const [quantity, setQuantity] = useState<number>(1);
    const [unitPrice, setUnitPrice] = useState<number>(0);
    const [materialPricePerM2, setMaterialPricePerM2] = useState<number>(0);
    const [notes, setNotes] = useState('');
    const [dimensionUnit, setDimensionUnit] = useState<'mm' | 'cm' | 'm'>('cm');
    const [simulatingPrice, setSimulatingPrice] = useState(false);

    // Funções de conversão
    const convertToMm = (value: number, unit: 'mm' | 'cm' | 'm'): number => {
        switch (unit) {
            case 'mm': return value;
            case 'cm': return value * 10;
            case 'm': return value * 1000;
            default: return value;
        }
    };

    const convertFromMm = (value: number, unit: 'mm' | 'cm' | 'm'): number => {
        switch (unit) {
            case 'mm': return value;
            case 'cm': return value / 10;
            case 'm': return value / 1000;
            default: return value;
        }
    };

    const widthInMm = convertToMm(width, dimensionUnit);
    const heightInMm = convertToMm(height, dimensionUnit);

    // Carregar dados de edição
    useEffect(() => {
        if (editingData) {
            const storedUnit = editingData.attributes?.dimensionUnit || 'cm';
            setDimensionUnit(storedUnit);
            setWidth(editingData.width ? convertFromMm(editingData.width, storedUnit) : 0);
            setHeight(editingData.height ? convertFromMm(editingData.height, storedUnit) : 0);
            setQuantity(editingData.quantity || 1);
            setUnitPrice(editingData.unitPrice || 0);
            setMaterialPricePerM2(editingData.attributes?.materialPricePerM2 || 0);
            setNotes(editingData.notes || '');

        }
    }, [editingData]);

    // Cálculo automático de preço para produtos por área
    useEffect(() => {
        if (produto.pricingMode === 'SIMPLE_AREA' && widthInMm > 0 && heightInMm > 0 && materialPricePerM2 > 0) {
            const area = (widthInMm * heightInMm) / 1000000; // m²
            const precoCalculado = materialPricePerM2 * area;
            setUnitPrice(precoCalculado);
        }
    }, [produto, widthInMm, heightInMm, materialPricePerM2]);

    const simularPreco = async () => {
        if (produto.pricingMode === 'SIMPLE_AREA' && (!widthInMm || !heightInMm || quantity <= 0)) {
            return;
        }

        if (quantity <= 0) {
            return;
        }

        setSimulatingPrice(true);
        try {
            const payload: any = {
                productId: produto.id,
                quantity
            };

            if (produto.pricingMode === 'SIMPLE_AREA') {
                payload.width = widthInMm;
                payload.height = heightInMm;
            }

            const response = await api.post('/api/sales/simulate', payload);

            const simulacao = response.data.data;
            setUnitPrice(simulacao.unitPrice);
            toast.success('Preço calculado automaticamente!');
        } catch (error) {
            // Fallback para preços simples
            if (produto.pricingMode === 'SIMPLE_AREA' && materialPricePerM2 > 0) {
                const area = (widthInMm * heightInMm) / 1000000;
                setUnitPrice(materialPricePerM2 * area);
                toast.info('Usando preço por m² informado');
            } else if (produto.pricingMode === 'SIMPLE_UNIT' && produto.salePrice) {
                setUnitPrice(produto.salePrice);
                toast.info('Usando preço configurado');
            } else {
                toast.error('Erro ao calcular preço. Insira manualmente.');
            }
        } finally {
            setSimulatingPrice(false);
        }
    };

    const handleSubmit = () => {
        // Validação baseada no tipo de produto
        let isValid = false;

        if (produto.pricingMode === 'SIMPLE_UNIT') {
            // Produtos por unidade: apenas quantidade e preço
            isValid = quantity > 0 && unitPrice > 0;
        } else if (produto.pricingMode === 'SIMPLE_AREA') {
            // Produtos por área: dimensões, quantidade e preço
            isValid = widthInMm > 0 && heightInMm > 0 && quantity > 0 && unitPrice > 0;
        } else if (produto.pricingMode === 'DYNAMIC_ENGINEER') {
            // Produtos dinâmicos: apenas quantidade e preço (dimensões opcionais)
            isValid = quantity > 0 && unitPrice > 0;
        }

        if (!isValid) {
            let errorMessage = 'Preencha todos os campos obrigatórios';

            if (produto.pricingMode === 'SIMPLE_AREA') {
                errorMessage = 'Para produtos por área, preencha: dimensões, quantidade e preço';
            } else if (produto.pricingMode === 'DYNAMIC_ENGINEER') {
                errorMessage = 'Para produtos dinâmicos, preencha: quantidade e preço';
            }

            toast.error(errorMessage);
            return;
        }

        const itemData = {
            productId: produto.id,
            product: produto,
            width: produto.pricingMode === 'SIMPLE_AREA' ? widthInMm : undefined,
            height: produto.pricingMode === 'SIMPLE_AREA' ? heightInMm : undefined,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            totalPrice: Number(unitPrice * quantity),
            notes,
            attributes: {
                dimensionUnit,
                materialPricePerM2: produto.pricingMode === 'SIMPLE_AREA' ? materialPricePerM2 : undefined
            }
        };

        onSubmit(itemData);
    };

    return (
        <div className="space-y-4">
            {/* Dimensões (apenas para produtos por área) */}
            {produto.pricingMode === 'SIMPLE_AREA' && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                        <label className="text-sm font-medium">Largura ({dimensionUnit})</label>
                        <Input
                            type="number"
                            value={width || ''}
                            onChange={(e) => setWidth(Number(e.target.value))}
                            placeholder="0"
                            min="0"
                            step={dimensionUnit === 'm' ? '0.01' : '1'}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Altura ({dimensionUnit})</label>
                        <Input
                            type="number"
                            value={height || ''}
                            onChange={(e) => setHeight(Number(e.target.value))}
                            placeholder="0"
                            min="0"
                            step={dimensionUnit === 'm' ? '0.01' : '1'}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Unidade</label>
                        <select
                            value={dimensionUnit}
                            onChange={(e) => {
                                const newUnit = e.target.value as 'mm' | 'cm' | 'm';
                                if (width > 0) {
                                    const widthInMm = convertToMm(width, dimensionUnit);
                                    setWidth(convertFromMm(widthInMm, newUnit));
                                }
                                if (height > 0) {
                                    const heightInMm = convertToMm(height, dimensionUnit);
                                    setHeight(convertFromMm(heightInMm, newUnit));
                                }
                                setDimensionUnit(newUnit);
                            }}
                            className="w-full h-10 px-2 py-2 border border-input rounded-md bg-background text-sm"
                        >
                            <option value="mm">mm</option>
                            <option value="cm">cm</option>
                            <option value="m">m</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">R$/m²</label>
                        <CurrencyInput
                            value={materialPricePerM2}
                            onValueChange={(value) => setMaterialPricePerM2(value || 0)}
                            placeholder="R$ 0,00"
                        />
                    </div>
                </div>
            )}

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
                    <div className="flex space-x-2">
                        <CurrencyInput
                            value={unitPrice}
                            onValueChange={(value) => setUnitPrice(value || 0)}
                            placeholder="R$ 0,00"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={simularPreco}
                            disabled={
                                simulatingPrice ||
                                (produto.pricingMode === 'SIMPLE_AREA' && (!widthInMm || !heightInMm))
                            }
                            className="px-2"
                        >
                            <Calculator className="w-3 h-3" />
                        </Button>
                    </div>
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

            {/* Área Calculada */}
            {produto.pricingMode === 'SIMPLE_AREA' && width > 0 && height > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                            <span className="font-medium">Dimensões:</span>
                            <p>{width} × {height} {dimensionUnit}</p>
                        </div>
                        <div>
                            <span className="font-medium">Área Unitária:</span>
                            <p>{((widthInMm * heightInMm) / 1000000).toFixed(4)} m²</p>
                        </div>
                        <div>
                            <span className="font-medium">Área Total:</span>
                            <p>{((widthInMm * heightInMm * quantity) / 1000000).toFixed(4)} m²</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Observações */}
            <div>
                <label className="text-sm font-medium">Observações</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações específicas deste item..."
                    className="w-full h-20 p-3 border border-input rounded-md resize-none mt-1"
                />
            </div>

            {/* Botão de Ação */}
            <Button
                onClick={handleSubmit}
                disabled={
                    (produto.pricingMode === 'SIMPLE_AREA' && (widthInMm <= 0 || heightInMm <= 0)) ||
                    quantity <= 0 || unitPrice <= 0
                }
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

export default ProductItemForm;