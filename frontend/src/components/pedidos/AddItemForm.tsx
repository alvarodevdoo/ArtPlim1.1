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
  X
} from 'lucide-react';
import { ConfigurationSelector } from '@/components/catalog/ConfigurationSelector';
import { formatarExibicaoPreco } from '@/lib/product-utils';
import { MaterialCalculator } from '@/components/ui/MaterialCalculator';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ItemType,
  ITEM_TYPE_CONFIGS,
  type ItemPedido as ItemPedidoType
} from '@/types/item-types';

// Opções para campos específicos (mantidas para compatibilidade com produtos dinâmicos)
const complexityOptions = [
  { value: 'SIMPLES', label: 'Simples' },
  { value: 'MEDIO', label: 'Médio' },
  { value: 'COMPLEXO', label: 'Complexo' },
  { value: 'MUITO_COMPLEXO', label: 'Muito Complexo' }
];

interface Produto {
  id: string;
  name: string;
  description?: string;
  pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
  salePrice?: number;
  minPrice?: number;
  standardSizes?: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    isDefault: boolean;
  }>;
}

interface ItemPedido extends ItemPedidoType {
  product?: Produto;
}

interface AddItemFormProps {
  produtos: Produto[];
  onAddItem: (item: ItemPedido) => void;
  onUpdateItem?: (item: ItemPedido) => void;
  editingItem?: ItemPedido | null;
  isModal?: boolean;
  onCancel?: () => void;
}

const AddItemForm: React.FC<AddItemFormProps> = ({
  produtos,
  onAddItem,
  onUpdateItem,
  editingItem,
  isModal = false,
  onCancel
}) => {
  const produtoDropdownRef = useRef<HTMLDivElement>(null);

  // Verificar se há produtos disponíveis
  const hasProducts = produtos && produtos.length > 0;

  // Estados do formulário
  const [itemType, setItemType] = useState<ItemType>(ItemType.PRODUCT);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [searchProduto, setSearchProduto] = useState('');
  const [showProdutoDropdown, setShowProdutoDropdown] = useState(false);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [itemNotes, setItemNotes] = useState('');
  const [simulatingPrice, setSimulatingPrice] = useState(false);

  // Estado para controlar se o campo de preço está sendo editado
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isEditingUnitPrice, setIsEditingUnitPrice] = useState(false);

  // Campo para valor do m² do material
  const [materialPricePerM2, setMaterialPricePerM2] = useState<number>(0);
  const [isEditingMaterialPrice, setIsEditingMaterialPrice] = useState(false);

  // Unidade de medida para dimensões
  const [dimensionUnit, setDimensionUnit] = useState<'mm' | 'cm' | 'm'>('cm');

  // Campos para produtos dinâmicos (legacy)
  const [setupTime, setSetupTime] = useState<number>(0);
  const [complexity, setComplexity] = useState('');

  // Tamanho personalizado
  const [customSizeName, setCustomSizeName] = useState('');
  const [isCustomSize, setIsCustomSize] = useState(false);

  // Configurações dinâmicas
  const [selectedConfigurations, setSelectedConfigurations] = useState<Record<string, any>>({});
  const [configurationPriceImpact, setConfigurationPriceImpact] = useState(0);

  // Para produtos dinâmicos (legacy)
  const [machineTime, setMachineTime] = useState<number>(0);

  // Funções de conversão de unidades para milímetros (padrão interno)
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

  // Valores convertidos para milímetros (para cálculos internos)
  const widthInMm = convertToMm(width, dimensionUnit);
  const heightInMm = convertToMm(height, dimensionUnit);

  // Carregar dados do item em edição
  useEffect(() => {
    if (editingItem) {
      // Load item type
      setItemType(editingItem.itemType || ItemType.PRODUCT);

      // Load basic item data
      setProdutoSelecionado(editingItem.product || null);
      setSearchProduto(editingItem.product?.name || '');

      // Load dimensions and convert from mm to the stored unit (or default to cm)
      const storedUnit = editingItem.attributes?.dimensionUnit || 'cm';
      setDimensionUnit(storedUnit);
      setWidth(editingItem.width ? convertFromMm(editingItem.width, storedUnit) : 0);
      setHeight(editingItem.height ? convertFromMm(editingItem.height, storedUnit) : 0);

      setQuantity(editingItem.quantity);
      setUnitPrice(editingItem.unitPrice);
      setMaterialPricePerM2(editingItem.attributes?.materialPricePerM2 || 0);
      setItemNotes(editingItem.notes || '');

      // Load legacy fields for backward compatibility with existing orders
      const attributes = editingItem.attributes || {};
      setSetupTime(attributes.setupTime || 0);
      setComplexity(attributes.complexity || '');
      setCustomSizeName(attributes.customSizeName || attributes.briefing || '');
      setIsCustomSize(attributes.isCustomSize || false);
    }
  }, [editingItem]);

  // Effect para cálculo automático de área (apenas para produtos por área)
  useEffect(() => {
    if (produtoSelecionado?.pricingMode === 'SIMPLE_AREA' && widthInMm > 0 && heightInMm > 0 && materialPricePerM2 > 0 && !isEditingUnitPrice) {
      // Calcular preço automaticamente baseado na área e no valor do m² informado
      const area = (widthInMm * heightInMm) / 1000000; // m²
      const precoCalculado = materialPricePerM2 * area;
      setUnitPrice(precoCalculado);
    }
  }, [produtoSelecionado, widthInMm, heightInMm, materialPricePerM2, quantity, isEditingUnitPrice]);

  // Effect para cálculo reverso: quando preço unitário muda, ajusta o valor do m²
  useEffect(() => {
    if (produtoSelecionado?.pricingMode === 'SIMPLE_AREA' && widthInMm > 0 && heightInMm > 0 && unitPrice > 0 && !isEditingMaterialPrice && isEditingUnitPrice) {
      const area = (widthInMm * heightInMm) / 1000000; // m²
      const precoCalculadoPorM2 = unitPrice / area;
      setMaterialPricePerM2(precoCalculadoPorM2);
    }
  }, [unitPrice, widthInMm, heightInMm, produtoSelecionado, isEditingMaterialPrice, isEditingUnitPrice]);

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

  const simularPreco = async () => {
    // Validation for PRODUCT type only
    const dimensionsValid = !produtoSelecionado ||
      produtoSelecionado.pricingMode === 'SIMPLE_UNIT' ||
      (widthInMm > 0 && heightInMm > 0);

    if (!produtoSelecionado || !dimensionsValid || quantity <= 0) {
      return;
    }

    setSimulatingPrice(true);
    try {
      // Use existing simulation API for products
      const response = await api.post('/api/sales/simulate', {
        productId: produtoSelecionado.id,
        width: produtoSelecionado.pricingMode === 'SIMPLE_AREA' ? widthInMm : 1,
        height: produtoSelecionado.pricingMode === 'SIMPLE_AREA' ? heightInMm : 1,
        quantity,
        configurations: selectedConfigurations
      });

      const simulacao = response.data.data;
      setUnitPrice(simulacao.unitPrice);
      toast.success('Preço calculado automaticamente!');
    } catch (error: any) {
      // Fallback for products with simple pricing
      if ((produtoSelecionado.pricingMode === 'SIMPLE_AREA' || produtoSelecionado.pricingMode === 'SIMPLE_UNIT')) {
        if (produtoSelecionado.pricingMode === 'SIMPLE_AREA' && materialPricePerM2 > 0) {
          const area = (widthInMm * heightInMm) / 1000000; // m²
          const precoCalculado = materialPricePerM2 * area;
          setUnitPrice(precoCalculado);
          toast.info('Usando preço por m² informado');
        } else if (produtoSelecionado.pricingMode === 'SIMPLE_UNIT' && produtoSelecionado.salePrice) {
          setUnitPrice(produtoSelecionado.salePrice);
          toast.info('Usando preço por unidade configurado');
        }
      } else {
        toast.error('Erro ao calcular preço. Insira manualmente.');
      }
    } finally {
      setSimulatingPrice(false);
    }
  };

  const limparFormulario = () => {
    setItemType(ItemType.PRODUCT); // Reset to default
    setProdutoSelecionado(null);
    setSearchProduto('');
    setWidth(0);
    setHeight(0);
    setQuantity(1);
    setUnitPrice(0);
    setMaterialPricePerM2(0);
    setItemNotes('');
    setDimensionUnit('cm'); // Reset para cm como padrão
    setIsEditingPrice(false);
    setIsEditingMaterialPrice(false);
    setIsEditingUnitPrice(false);

    // Clear custom size fields
    setCustomSizeName('');
    setIsCustomSize(false);

    // Clear legacy fields
    setSetupTime(0);
    setComplexity('');

    // Clear dynamic configurations
    setSelectedConfigurations({});
    setConfigurationPriceImpact(0);
  };

  const handleSubmit = () => {
    // Validation based on item type
    if (itemType === ItemType.PRODUCT) {
      const dimensionsValid = !produtoSelecionado ||
        produtoSelecionado.pricingMode === 'SIMPLE_UNIT' ||
        (widthInMm > 0 && heightInMm > 0);

      // Validate product selection
      if (!produtoSelecionado) {
        toast.error('Selecione um produto para este item');
        return;
      }

      // Verificar se há produtos disponíveis
      if (!hasProducts) {
        toast.error('Não é possível adicionar itens sem produtos cadastrados.', {
          duration: 5000,
          action: {
            label: 'Cadastrar Produtos',
            onClick: () => window.open('/produtos', '_blank')
          }
        });
        return;
      }

      // Validar se o produto selecionado ainda existe na lista
      const produtoAindaExiste = produtos.find(p => p.id === produtoSelecionado.id);
      if (!produtoAindaExiste) {
        toast.error('O produto selecionado não está mais disponível. Selecione outro produto.');
        setProdutoSelecionado(null);
        setSearchProduto('');
        return;
      }

      if (!dimensionsValid || quantity <= 0 || unitPrice <= 0) {
        toast.error('Preencha todos os campos obrigatórios do item');
        return;
      }
    } else if (itemType === ItemType.SERVICE) {
      // Validation for services
      if (!itemNotes.trim()) {
        toast.error('Preencha a descrição do serviço');
        return;
      }
      if (quantity <= 0 || unitPrice <= 0) {
        toast.error('Preencha a quantidade e o preço do serviço');
        return;
      }
    }

    // Pack attributes based on item type
    const attributes: Record<string, any> = {};

    if (itemType === ItemType.PRODUCT && produtoSelecionado) {
      // For PRODUCT type, store legacy fields for backward compatibility
      if (produtoSelecionado.pricingMode === 'DYNAMIC_ENGINEER') {
        attributes.machineTime = machineTime;
        attributes.setupTime = setupTime;
        attributes.complexity = complexity;
      }

      // Custom size fields
      if (isCustomSize) {
        attributes.customSizeName = customSizeName;
        attributes.isCustomSize = true;
      }

      // Store dimension unit for reference
      attributes.dimensionUnit = dimensionUnit;

      // Store material price per m² for area-based products
      if (produtoSelecionado.pricingMode === 'SIMPLE_AREA') {
        attributes.materialPricePerM2 = materialPricePerM2;
      }
    } else if (itemType === ItemType.SERVICE) {
      // For SERVICE type, store briefing information
      attributes.description = itemNotes;
      attributes.briefing = customSizeName;
    }

    // Calculate total area for area-based products
    const needsDimensions = itemType === ItemType.PRODUCT && produtoSelecionado?.pricingMode === 'SIMPLE_AREA';
    const totalArea = needsDimensions && widthInMm > 0 && heightInMm > 0 ? (widthInMm * heightInMm) / 1000000 : undefined;

    const item: ItemPedido = {
      id: editingItem?.id || Date.now().toString(),
      itemType: itemType,
      productId: itemType === ItemType.PRODUCT ? produtoSelecionado?.id : undefined,
      product: itemType === ItemType.PRODUCT ? produtoSelecionado || undefined : undefined,
      width: needsDimensions ? widthInMm : undefined, // Sempre salvar em mm
      height: needsDimensions ? heightInMm : undefined, // Sempre salvar em mm
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      totalArea,
      notes: itemType === ItemType.SERVICE ? itemNotes : itemNotes,
      attributes
    };

    // Validação final do item criado
    if (item.quantity <= 0 || item.unitPrice <= 0 || item.totalPrice <= 0) {
      toast.error('Erro interno: item criado com dados inválidos. Tente novamente.');
      return;
    }

    // Validação específica por tipo
    if (itemType === ItemType.PRODUCT && !item.productId) {
      toast.error('Erro interno: produto não selecionado. Tente novamente.');
      return;
    }

    if (editingItem && onUpdateItem) {
      onUpdateItem(item);
      toast.success('Item atualizado com sucesso!');
    } else {
      onAddItem(item);
      toast.success('Item adicionado ao pedido!');
    }

    // Clear form only if not modal
    if (!isModal) {
      limparFormulario();
    }
  };

  const formatarUnidadePreco = (produto?: Produto) => {
    if (!produto) return '/un';

    switch (produto.pricingMode) {
      case 'SIMPLE_AREA':
        return '/m²';
      case 'SIMPLE_UNIT':
        return '/un';
      case 'DYNAMIC_ENGINEER':
        return '/un';
      default:
        return '/un';
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Seleção de Tipo de Item */}
      <div>
        <label className="text-sm font-medium">Tipo de Item</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {Object.values(ITEM_TYPE_CONFIGS).map(config => (
            <button
              key={config.value}
              type="button"
              onClick={() => {
                setItemType(config.value);
                // Limpar produto selecionado ao mudar tipo
                if (config.value !== ItemType.PRODUCT) {
                  setProdutoSelecionado(null);
                  setSearchProduto('');
                }
              }}
              className={`p-3 border rounded-lg text-left transition-colors ${itemType === config.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50'
                }`}
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{config.icon}</span>
                <div>
                  <div className="font-medium text-sm">{config.label}</div>
                  <div className="text-xs text-muted-foreground">{config.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Seleção de Produto - apenas para tipo PRODUCT */}
      {itemType === ItemType.PRODUCT && (
        <div className="relative" ref={produtoDropdownRef}>
          <label className="text-sm font-medium">Produto</label>
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

                      // Se for preço simples, já definir um valor base
                      if ((produto.pricingMode === 'SIMPLE_AREA' || produto.pricingMode === 'SIMPLE_UNIT') && produto.salePrice) {
                        if (produto.pricingMode === 'SIMPLE_UNIT') {
                          setUnitPrice(produto.salePrice);
                        } else if (produto.pricingMode === 'SIMPLE_AREA') {
                          // Para produtos por área, preencher o valor do m² do material
                          setMaterialPricePerM2(produto.salePrice);
                        }
                      }
                    }}
                  >
                    <div className="font-medium">{produto.name}</div>
                    {produto.description && (
                      <div className="text-sm text-muted-foreground">{produto.description}</div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {produto.pricingMode === 'SIMPLE_AREA' ? 'Preço por m²' :
                        produto.pricingMode === 'SIMPLE_UNIT' ? 'Preço por unidade' : 'Preço Dinâmico'}
                      {formatarExibicaoPreco(produto).includes("•") ? formatarExibicaoPreco(produto).split("•")[1] : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {produtoSelecionado && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-800">{produtoSelecionado.name}</span>
                  <span className="text-sm text-blue-600">
                    ({produtoSelecionado.pricingMode === 'SIMPLE_AREA' ? 'Preço por m²' :
                      produtoSelecionado.pricingMode === 'SIMPLE_UNIT' ? 'Preço por unidade' : 'Preço Dinâmico'})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setProdutoSelecionado(null);
                    setSearchProduto('');
                    setShowProdutoDropdown(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                  title="Trocar produto"
                >
                  <X className="w-4 h-4 mr-1" />
                  Trocar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campos Específicos para Serviços */}
      {itemType === ItemType.SERVICE && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-3 flex items-center">
              🎨 Especificações do Serviço
            </h4>
            <div>
              <label className="text-sm font-medium">Descrição do Serviço</label>
              <textarea
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Ex: Criação de logotipo, arte para cartão de visita, design de banner..."
                className="w-full h-20 p-3 border border-input rounded-md resize-none mt-1"
              />
            </div>
            <div className="mt-3">
              <label className="text-sm font-medium">Briefing/Observações</label>
              <textarea
                value={customSizeName}
                onChange={(e) => setCustomSizeName(e.target.value)}
                placeholder="Cores preferidas, estilo desejado, referências, público-alvo, informações específicas..."
                className="w-full h-16 p-3 border border-input rounded-md resize-none mt-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Dimensões e Quantidade */}
      <div className="space-y-4">
        <div className={`grid gap-3 ${produtoSelecionado?.pricingMode === 'SIMPLE_AREA'
          ? 'grid-cols-2 md:grid-cols-6'
          : 'grid-cols-1 md:grid-cols-2'
          }`}>
          {/* Largura - mostrar apenas para produtos por área */}
          {produtoSelecionado?.pricingMode === 'SIMPLE_AREA' && (
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
          )}

          {/* Altura - mostrar apenas para produtos por área */}
          {produtoSelecionado?.pricingMode === 'SIMPLE_AREA' && (
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
          )}

          {/* Unidade - mostrar apenas para produtos por área */}
          {produtoSelecionado?.pricingMode === 'SIMPLE_AREA' && (
            <div>
              <label className="text-sm font-medium">Un.</label>
              <select
                value={dimensionUnit}
                onChange={(e) => {
                  const newUnit = e.target.value as 'mm' | 'cm' | 'm';
                  // Converter valores existentes para a nova unidade
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
          )}

          {/* Valor do m² do Material - mostrar apenas para produtos por área */}
          {produtoSelecionado?.pricingMode === 'SIMPLE_AREA' && (
            <div>
              <label className="text-sm font-medium">R$/m²</label>
              <Input
                type="text"
                value={isEditingMaterialPrice ? materialPricePerM2.toString() : (materialPricePerM2 > 0 ? formatCurrency(materialPricePerM2) : '')}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                  setMaterialPricePerM2(Number(value) || 0);
                }}
                onFocus={() => setIsEditingMaterialPrice(true)}
                onBlur={() => setIsEditingMaterialPrice(false)}
                placeholder="R$ 0,00"
                className="text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Qtd</label>
            <Input
              type="number"
              value={quantity || ''}
              onChange={(e) => setQuantity(Number(e.target.value))}
              placeholder="1"
              min="1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Preço Un.</label>
            <div className="flex space-x-2">
              <Input
                type="text"
                value={isEditingPrice ? unitPrice.toString() : (unitPrice > 0 ? formatCurrency(unitPrice) : '')}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                  setUnitPrice(Number(value) || 0);
                }}
                onFocus={() => {
                  setIsEditingPrice(true);
                  setIsEditingUnitPrice(true);
                }}
                onBlur={() => {
                  setIsEditingPrice(false);
                  setIsEditingUnitPrice(false);
                }}
                placeholder="R$ 0,00"
                className="text-sm"
              />
              {produtoSelecionado && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={simularPreco}
                  disabled={simulatingPrice ||
                    (produtoSelecionado.pricingMode === 'SIMPLE_AREA' && (!widthInMm || !heightInMm)) ||
                    !quantity}
                  className="px-2"
                >
                  <Calculator className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Área Calculada - para produtos por área */}
      {
        width > 0 && height > 0 && produtoSelecionado?.pricingMode === 'SIMPLE_AREA' && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="font-medium">Dim.:</span>
                <p>{width} × {height} {dimensionUnit}</p>
              </div>
              <div>
                <span className="font-medium">Área Un.:</span>
                <p>{((widthInMm * heightInMm) / 1000000).toFixed(4)} m²</p>
              </div>
              <div>
                <span className="font-medium">Área Tot.:</span>
                <p>{((widthInMm * heightInMm * quantity) / 1000000).toFixed(4)} m²</p>
              </div>
            </div>
          </div>
        )
      }

      {/* Total do Item */}
      {unitPrice > 0 && quantity > 0 && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-center">
            <span className="text-sm font-medium text-green-700">Total do Item: </span>
            <span className="text-xl font-bold text-green-600">
              {formatCurrency(unitPrice * quantity)}
            </span>
          </div>
        </div>
      )}

      {/* Material Calculator - Show material requirements for products */}
      {
        produtoSelecionado && quantity > 0 && (
          produtoSelecionado.pricingMode !== 'SIMPLE_AREA' || (widthInMm > 0 && heightInMm > 0)
        ) && (
          <MaterialCalculator
            productId={produtoSelecionado.id}
            width={produtoSelecionado.pricingMode === 'SIMPLE_AREA' ? widthInMm : 1}
            height={produtoSelecionado.pricingMode === 'SIMPLE_AREA' ? heightInMm : 1}
            quantity={quantity}
            configurations={selectedConfigurations}
            onCalculationComplete={(result) => {
              // Optional: Could use this to adjust pricing based on material costs
            }}
          />
        )
      }

      {/* Configuration Selector - Show dynamic configurations for products with DYNAMIC_ENGINEER pricing */}
      {
        produtoSelecionado && produtoSelecionado.pricingMode === 'DYNAMIC_ENGINEER' && (
          <ConfigurationSelector
            productId={produtoSelecionado.id}
            selectedConfigurations={selectedConfigurations}
            onConfigurationChange={(configId, value) => {
              setSelectedConfigurations(prev => ({
                ...prev,
                [configId]: value
              }));
            }}
            onPriceImpactChange={setConfigurationPriceImpact}
            showPriceImpact={true}
          />
        )
      }

      {/* Campos Específicos para Produtos Dinâmicos */}
      {produtoSelecionado?.pricingMode === 'DYNAMIC_ENGINEER' && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-3">Especificações do Produto</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Tempo de Máquina (min)</label>
                <Input
                  type="number"
                  value={machineTime || ''}
                  onChange={(e) => setMachineTime(Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tempo de Setup (min)</label>
                <Input
                  type="number"
                  value={setupTime || ''}
                  onChange={(e) => setSetupTime(Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Complexidade</label>
                <select
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="">Selecione a complexidade</option>
                  {complexityOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Observações do Item */}
      <div>
        <label className="text-sm font-medium">Observações do Item</label>
        <textarea
          value={itemNotes}
          onChange={(e) => setItemNotes(e.target.value)}
          placeholder="Observações específicas deste item..."
          className="w-full h-20 p-3 border border-input rounded-md resize-none mt-1"
        />
      </div>

      {/* Botões de Ação */}
      <div className={`flex space-x-2 ${isModal ? 'pt-4 border-t' : ''}`}>
        <Button
          onClick={handleSubmit}
          disabled={
            (itemType === ItemType.PRODUCT && (
              !produtoSelecionado ||
              (produtoSelecionado.pricingMode === 'SIMPLE_AREA' && (widthInMm <= 0 || heightInMm <= 0)) ||
              quantity <= 0 || unitPrice <= 0
            )) ||
            (itemType === ItemType.SERVICE && (
              !itemNotes.trim() || quantity <= 0 || unitPrice <= 0
            ))
          }
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
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );

  // Se não há produtos, mostrar mensagem de aviso
  if (!hasProducts) {
    const noProductsContent = (
      <div className="text-center py-8">
        <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
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
                    : 'Configure o produto, dimensões e quantidade'
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
          Configure o produto, dimensões e quantidade
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};

export default AddItemForm;