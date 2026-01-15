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
import { formatCurrency } from '@/lib/utils';
import { formatarExibicaoPreco } from '@/lib/product-utils';
import { MaterialCalculator } from '@/components/ui/MaterialCalculator';
import api from '@/lib/api';
import { toast } from 'sonner';

// Opções para campos específicos
const paperSizeOptions = [
  { value: 'A3', label: 'A3 (297 × 420mm)' },
  { value: 'A4', label: 'A4 (210 × 297mm)' },
  { value: 'A5', label: 'A5 (148 × 210mm)' },
  { value: 'CARTA', label: 'Carta (216 × 279mm)' },
  { value: 'OFICIO', label: 'Ofício (216 × 355mm)' },
  { value: 'CUSTOM', label: 'Personalizado' }
];

const paperTypeOptions = [
  { value: 'SULFITE_75', label: 'Sulfite 75g' },
  { value: 'SULFITE_90', label: 'Sulfite 90g' },
  { value: 'COUCHE_115', label: 'Couché 115g' },
  { value: 'COUCHE_150', label: 'Couché 150g' },
  { value: 'COUCHE_170', label: 'Couché 170g' },
  { value: 'CARTAO_250', label: 'Cartão 250g' },
  { value: 'CARTAO_300', label: 'Cartão 300g' }
];

const printColorsOptions = [
  { value: '1x0', label: '1x0 (Preto frente)', sides: 'FRENTE' },
  { value: '1x1', label: '1x1 (Preto frente e verso)', sides: 'FRENTE_VERSO' },
  { value: '4x0', label: '4x0 (Colorido frente)', sides: 'FRENTE' },
  { value: '4x1', label: '4x1 (Colorido frente, preto verso)', sides: 'FRENTE_VERSO' },
  { value: '4x4', label: '4x4 (Colorido frente e verso)', sides: 'FRENTE_VERSO' }
];

const finishingOptions = [
  { value: 'NONE', label: 'Sem acabamento' },
  { value: 'LAMINACAO_FOSCA', label: 'Laminação Fosca' },
  { value: 'LAMINACAO_BRILHO', label: 'Laminação Brilho' },
  { value: 'VERNIZ_UV', label: 'Verniz UV' },
  { value: 'VERNIZ_LOCALIZADO', label: 'Verniz Localizado' },
  { value: 'CORTE_VINCO', label: 'Corte e Vinco' }
];

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

interface ItemPedido {
  id: string;
  productId: string;
  product?: Produto;
  width: number;
  height: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  
  // Campos específicos por tipo
  area?: number;
  paperSize?: string;
  paperType?: string;
  printColors?: string;
  finishing?: string;
  machineTime?: number;
  setupTime?: number;
  complexity?: string;
  
  // Tamanho personalizado
  customSizeName?: string;
  isCustomSize?: boolean;
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
  
  // Estados do formulário
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [searchProduto, setSearchProduto] = useState('');
  const [showProdutoDropdown, setShowProdutoDropdown] = useState(false);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [itemNotes, setItemNotes] = useState('');
  const [simulatingPrice, setSimulatingPrice] = useState(false);
  
  // Campos específicos por tipo de produto
  const [paperSize, setPaperSize] = useState('');
  const [paperType, setPaperType] = useState('');
  const [printColors, setPrintColors] = useState('');
  const [finishing, setFinishing] = useState('');
  
  // Tamanho personalizado
  const [customSizeName, setCustomSizeName] = useState('');
  const [isCustomSize, setIsCustomSize] = useState(false);
  
  // Para produtos dinâmicos
  const [machineTime, setMachineTime] = useState<number>(0);
  const [setupTime, setSetupTime] = useState<number>(0);
  const [complexity, setComplexity] = useState('');

  // Carregar dados do item em edição
  useEffect(() => {
    if (editingItem) {
      setProdutoSelecionado(editingItem.product || null);
      setSearchProduto(editingItem.product?.name || '');
      setWidth(editingItem.width);
      setHeight(editingItem.height);
      setQuantity(editingItem.quantity);
      setUnitPrice(editingItem.unitPrice);
      setItemNotes(editingItem.notes || '');
      
      // Carregar campos específicos
      setPaperSize(editingItem.paperSize || '');
      setPaperType(editingItem.paperType || '');
      setPrintColors(editingItem.printColors || '');
      setFinishing(editingItem.finishing || '');
      setMachineTime(editingItem.machineTime || 0);
      setSetupTime(editingItem.setupTime || 0);
      setComplexity(editingItem.complexity || '');
      
      // Carregar campos de tamanho personalizado
      setCustomSizeName(editingItem.customSizeName || '');
      setIsCustomSize(editingItem.isCustomSize || false);
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

  const simularPreco = async () => {
    if (!produtoSelecionado || width <= 0 || height <= 0 || quantity <= 0) {
      return;
    }

    setSimulatingPrice(true);
    try {
      const response = await api.post('/api/sales/simulate', {
        productId: produtoSelecionado.id,
        width,
        height,
        quantity
      });

      const simulacao = response.data.data;
      setUnitPrice(simulacao.unitPrice);
      toast.success('Preço calculado automaticamente!');
    } catch (error: any) {
      console.error('Erro ao simular preço:', error);
      
      // Fallback para preço simples se a simulação falhar
      if ((produtoSelecionado.pricingMode === 'SIMPLE_AREA' || produtoSelecionado.pricingMode === 'SIMPLE_UNIT') && produtoSelecionado.salePrice) {
        if (produtoSelecionado.pricingMode === 'SIMPLE_AREA') {
          const area = (width * height) / 1000000; // m²
          const precoCalculado = produtoSelecionado.salePrice * area;
          setUnitPrice(precoCalculado);
          toast.info('Usando preço por m² configurado');
        } else {
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
    setProdutoSelecionado(null);
    setSearchProduto('');
    setWidth(0);
    setHeight(0);
    setQuantity(1);
    setUnitPrice(0);
    setItemNotes('');
    
    // Limpar campos específicos
    setPaperSize('');
    setPaperType('');
    setPrintColors('');
    setFinishing('');
    setMachineTime(0);
    setSetupTime(0);
    setComplexity('');
    
    // Limpar campos de tamanho personalizado
    setCustomSizeName('');
    setIsCustomSize(false);
  };

  const handleSubmit = () => {
    // Validação diferente para produtos por unidade
    const isSimpleUnit = produtoSelecionado?.pricingMode === 'SIMPLE_UNIT';
    const dimensionsValid = isSimpleUnit || (width > 0 && height > 0);
    
    if (!produtoSelecionado || !dimensionsValid || quantity <= 0 || unitPrice <= 0) {
      toast.error('Preencha todos os campos do item');
      return;
    }

    const item: ItemPedido = {
      id: editingItem?.id || Date.now().toString(),
      productId: produtoSelecionado.id,
      product: produtoSelecionado,
      width,
      height,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      notes: itemNotes,
      
      // Campos específicos por tipo
      area: produtoSelecionado.pricingMode === 'SIMPLE_AREA' ? (width * height) / 1000000 : undefined,
      paperSize: produtoSelecionado.pricingMode === 'SIMPLE_UNIT' ? paperSize : undefined,
      paperType: produtoSelecionado.pricingMode === 'SIMPLE_UNIT' ? paperType : undefined,
      printColors: produtoSelecionado.pricingMode === 'SIMPLE_UNIT' ? printColors : undefined,
      finishing: produtoSelecionado.pricingMode === 'SIMPLE_UNIT' ? finishing : undefined,
      machineTime: produtoSelecionado.pricingMode === 'DYNAMIC_ENGINEER' ? machineTime : undefined,
      setupTime: produtoSelecionado.pricingMode === 'DYNAMIC_ENGINEER' ? setupTime : undefined,
      complexity: produtoSelecionado.pricingMode === 'DYNAMIC_ENGINEER' ? complexity : undefined,
      
      // Tamanho personalizado
      customSizeName: isCustomSize ? customSizeName : undefined,
      isCustomSize: isCustomSize
    };

    if (editingItem && onUpdateItem) {
      onUpdateItem(item);
      toast.success('Item atualizado com sucesso!');
    } else {
      onAddItem(item);
      toast.success('Item adicionado ao pedido!');
    }
    
    // Limpar formulário apenas se não for modal
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

  const renderCamposEspecificos = () => {
    if (!produtoSelecionado) return null;

    switch (produtoSelecionado.pricingMode) {
      case 'SIMPLE_AREA':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-3">Especificações para Produto por m²</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Área Calculada</label>
                  <div className="text-lg font-bold text-blue-600">
                    {((width * height) / 1000000).toFixed(4)} m²
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Área Total</label>
                  <div className="text-lg font-bold text-blue-600">
                    {((width * height * quantity) / 1000000).toFixed(4)} m²
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'SIMPLE_UNIT':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-3">Especificações para Impressão</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tamanho do Papel</label>
                  <select
                    value={paperSize}
                    onChange={(e) => {
                      setPaperSize(e.target.value);
                      
                      if (e.target.value === 'CUSTOM') {
                        setIsCustomSize(true);
                      } else {
                        setIsCustomSize(false);
                        setCustomSizeName('');
                        
                        // Verificar se é um tamanho padrão do produto
                        const standardSize = produtoSelecionado?.standardSizes?.find(size => size.name === e.target.value);
                        if (standardSize) {
                          setWidth(standardSize.width);
                          setHeight(standardSize.height);
                        } else {
                          // Tamanhos padrão gerais
                          switch (e.target.value) {
                            case 'A3': setWidth(297); setHeight(420); break;
                            case 'A4': setWidth(210); setHeight(297); break;
                            case 'A5': setWidth(148); setHeight(210); break;
                            case 'CARTA': setWidth(216); setHeight(279); break;
                            case 'OFICIO': setWidth(216); setHeight(355); break;
                          }
                        }
                      }
                    }}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Selecione o tamanho</option>
                    
                    {/* Tamanhos padrão do produto */}
                    {produtoSelecionado?.standardSizes?.map(size => (
                      <option key={size.id} value={size.name}>
                        {size.name} ({size.width} × {size.height}mm)
                      </option>
                    ))}
                    
                    {/* Tamanhos padrão gerais se não houver específicos */}
                    {(!produtoSelecionado?.standardSizes || produtoSelecionado.standardSizes.length === 0) && 
                      paperSizeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    }
                    
                    <option value="CUSTOM">Personalizado</option>
                  </select>
                </div>

                {isCustomSize && (
                  <div>
                    <label className="text-sm font-medium">Nome do Tamanho Personalizado</label>
                    <Input
                      value={customSizeName}
                      onChange={(e) => setCustomSizeName(e.target.value)}
                      placeholder="Ex: Cartão de Visita, Flyer, etc."
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Tipo de Papel</label>
                  <select
                    value={paperType}
                    onChange={(e) => setPaperType(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Selecione o papel</option>
                    {paperTypeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Cores de Impressão</label>
                  <select
                    value={printColors}
                    onChange={(e) => setPrintColors(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Selecione as cores</option>
                    {printColorsOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Acabamento</label>
                  <select
                    value={finishing}
                    onChange={(e) => setFinishing(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Selecione o acabamento</option>
                    {finishingOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Informações automáticas baseadas na seleção de cores */}
              {printColors && (
                <div className="mt-4 p-3 bg-green-100 rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium">Lados de impressão:</span>
                    <p>{printColorsOptions.find(opt => opt.value === printColors)?.sides === 'FRENTE_VERSO' ? 'Frente e Verso' : 'Apenas Frente'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'DYNAMIC_ENGINEER':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-3">Especificações para Produto Dinâmico</h4>
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

              {(machineTime > 0 || setupTime > 0) && (
                <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Tempo Total por Unidade:</span>
                      <p>{((machineTime || 0) + (setupTime || 0) / quantity).toFixed(2)} min</p>
                    </div>
                    <div>
                      <span className="font-medium">Tempo Total do Lote:</span>
                      <p>{((machineTime || 0) * quantity + (setupTime || 0)).toFixed(2)} min</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Seleção de Produto */}
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
                      setUnitPrice(produto.salePrice);
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
      </div>

      {produtoSelecionado && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
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

      {/* Dimensões e Quantidade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Largura - ocultar para produtos por unidade */}
        {produtoSelecionado?.pricingMode !== 'SIMPLE_UNIT' && (
          <div>
            <label className="text-sm font-medium">Largura (mm)</label>
            <Input
              type="number"
              value={width || ''}
              onChange={(e) => setWidth(Number(e.target.value))}
              placeholder="0"
              min="1"
            />
          </div>
        )}
        
        {/* Altura - ocultar para produtos por unidade */}
        {produtoSelecionado?.pricingMode !== 'SIMPLE_UNIT' && (
          <div>
            <label className="text-sm font-medium">Altura (mm)</label>
            <Input
              type="number"
              value={height || ''}
              onChange={(e) => setHeight(Number(e.target.value))}
              placeholder="0"
              min="1"
            />
          </div>
        )}
        
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
      </div>

      {/* Área Calculada - apenas para produtos por m² */}
      {width > 0 && height > 0 && produtoSelecionado?.pricingMode === 'SIMPLE_AREA' && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Área unitária:</span>
              <p>{((width * height) / 1000000).toFixed(4)} m²</p>
            </div>
            <div>
              <span className="font-medium">Área total:</span>
              <p>{((width * height * quantity) / 1000000).toFixed(4)} m²</p>
            </div>
          </div>
        </div>
      )}

      {/* Preço */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Preço Unitário</label>
          <div className="flex space-x-2">
            <Input
              type="number"
              value={unitPrice || ''}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              placeholder="0,00"
              min="0"
              step="0.01"
            />
            {produtoSelecionado && (
              <Button
                variant="outline"
                onClick={simularPreco}
                disabled={simulatingPrice || !width || !height || !quantity}
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
            {formatCurrency(unitPrice * quantity)}
          </div>
        </div>
      </div>

      {/* Material Calculator - Show material requirements for this item */}
      {produtoSelecionado && width > 0 && height > 0 && quantity > 0 && (
        <MaterialCalculator
          productId={produtoSelecionado.id}
          width={width}
          height={height}
          quantity={quantity}
          configurations={{
            paperSize,
            paperType,
            printColors,
            finishing,
            complexity,
            machineTime,
            setupTime,
            customSizeName: isCustomSize ? customSizeName : undefined
          }}
          onCalculationComplete={(result) => {
            // Optional: Could use this to adjust pricing based on material costs
            console.log('Material calculation result:', result);
          }}
        />
      )}

      {/* Campos Específicos por Tipo de Produto */}
      {produtoSelecionado && renderCamposEspecificos()}

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
          disabled={!produtoSelecionado || width <= 0 || height <= 0 || quantity <= 0 || unitPrice <= 0}
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