import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Calculator, Package, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Material {
  id: string;
  name: string;
  format: 'ROLL' | 'SHEET' | 'UNIT';
  standardWidth?: number;
  standardLength?: number;
  costPerUnit: number;
  unit: string;
  currentStock: number;
}

interface ProductComponent {
  id: string;
  materialId: string;
  consumptionMethod: 'BOUNDING_BOX' | 'LINEAR_NEST' | 'FIXED_AMOUNT';
  wastePercentage: number;
  calculatedWastePercentage: number;
  manualWastePercentage?: number;
  isOptional: boolean;
  priority: number;
  notes?: string;
  material: Material;
}

interface MaterialCalculatorProps {
  productId?: string;
  width: number;
  height: number;
  quantity: number;
  configurations?: Record<string, any>;
  onCalculationComplete?: (result: CalculationResult) => void;
}

interface CalculationResult {
  materials: Array<{
    component: ProductComponent;
    needed: number;
    available: number;
    cost: number;
    sufficient: boolean;
    unit: string;
    wasteApplied: number;
  }>;
  totalCost: number;
  warnings: string[];
  hasRequiredMaterials: boolean;
}

export const MaterialCalculator: React.FC<MaterialCalculatorProps> = ({
  productId,
  width,
  height,
  quantity,
  configurations = {},
  onCalculationComplete
}) => {
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualWasteOverride, setManualWasteOverride] = useState<Record<string, number>>({});

  // Memoize configurations to prevent infinite loops
  const memoizedConfigurations = useMemo(() => configurations, [JSON.stringify(configurations)]);

  useEffect(() => {
    if (productId) {
      loadProductComponents();
    }
  }, [productId]);

  // Use useCallback to memoize the calculation function
  const calculateMaterials = useCallback(() => {
    setLoading(true);
    
    const result: CalculationResult = {
      materials: [],
      totalCost: 0,
      warnings: [],
      hasRequiredMaterials: false
    };

    const itemArea = (width * height) / 1000000; // m²
    let hasRequiredMaterials = false;

    components.forEach(component => {
      // Skip optional materials if not enough required materials
      if (component.isOptional && !hasRequiredMaterials) {
        return;
      }

      const wastePercentage = manualWasteOverride[component.id] !== undefined 
        ? manualWasteOverride[component.id] / 100
        : (component.manualWastePercentage || component.wastePercentage);
      
      // Perdas em unidades (folhas, metros, etc) - prioridade sobre percentual
      const wasteUnits = component.manualWasteUnits || component.wasteUnits || 0;

      let needed = 0;
      let cost = 0;
      let unit = component.material.unit;

      switch (component.consumptionMethod) {
        case 'BOUNDING_BOX':
          // Calculate area-based consumption (for sheets)
          if (component.material.format === 'SHEET') {
            const sheetArea = ((component.material.standardWidth || 0) * (component.material.standardLength || 0)) / 1000000;
            const totalAreaNeeded = itemArea * quantity;
            const sheetsNeeded = Math.ceil(totalAreaNeeded / sheetArea);
            
            // Usar perdas em unidades se configurado, senão usar percentual
            if (wasteUnits > 0) {
              needed = sheetsNeeded + wasteUnits;
            } else {
              needed = sheetsNeeded * (1 + wastePercentage);
            }
            needed = Math.ceil(needed);
            cost = needed * Number(component.material.costPerUnit);
            unit = 'folhas';
          } else {
            // For non-sheet materials, calculate area and convert to material units
            const totalAreaNeeded = itemArea * quantity;
            
            // Usar perdas em unidades se configurado, senão usar percentual
            if (wasteUnits > 0) {
              needed = totalAreaNeeded + wasteUnits;
            } else {
              needed = totalAreaNeeded * (1 + wastePercentage);
            }
            cost = needed * Number(component.material.costPerUnit);
            unit = 'm²';
          }
          break;

        case 'LINEAR_NEST':
          // Calculate linear consumption (for rolls)
          if (component.material.format === 'ROLL') {
            const materialWidth = component.material.standardWidth || 1000;
            if (width <= materialWidth) {
              const baseNeeded = (height * quantity) / 1000; // meters
              
              // Usar perdas em unidades se configurado, senão usar percentual
              if (wasteUnits > 0) {
                needed = baseNeeded + wasteUnits;
              } else {
                needed = baseNeeded * (1 + wastePercentage);
              }
              cost = needed * Number(component.material.costPerUnit);
              unit = 'metros';
            } else {
              result.warnings.push(
                `${component.material.name}: Largura do item (${width}mm) excede largura do material (${materialWidth}mm)`
              );
            }
          } else {
            result.warnings.push(
              `${component.material.name}: Método LINEAR_NEST não compatível com formato ${component.material.format}`
            );
          }
          break;

        case 'FIXED_AMOUNT':
          // Fixed quantity per item
          const baseQuantity = quantity;
          
          // Usar perdas em unidades se configurado, senão usar percentual
          if (wasteUnits > 0) {
            needed = baseQuantity + wasteUnits;
          } else {
            needed = baseQuantity * (1 + wastePercentage);
          }
          cost = needed * Number(component.material.costPerUnit);
          unit = component.material.unit;
          break;
      }

      if (needed > 0) {
        const sufficient = component.material.currentStock >= needed;
        
        result.materials.push({
          component,
          needed: Math.ceil(needed * 100) / 100, // Round to 2 decimal places
          available: component.material.currentStock,
          cost,
          sufficient,
          unit,
          wasteApplied: wasteUnits > 0 ? wasteUnits : wastePercentage * 100,
          wasteType: wasteUnits > 0 ? 'units' : 'percentage'
        });

        if (!sufficient) {
          result.warnings.push(
            `Estoque insuficiente de ${component.material.name}: necessário ${needed.toFixed(2)} ${unit}, disponível ${component.material.currentStock}`
          );
        }

        if (!component.isOptional) {
          hasRequiredMaterials = true;
        }

        result.totalCost += cost;
      }
    });

    // Sort by priority, then by cost
    result.materials.sort((a, b) => {
      if (a.component.priority !== b.component.priority) {
        return a.component.priority - b.component.priority;
      }
      return a.cost - b.cost;
    });

    result.hasRequiredMaterials = hasRequiredMaterials;

    if (!hasRequiredMaterials && components.some(c => !c.isOptional)) {
      result.warnings.push('Nenhum material obrigatório pode ser calculado com as dimensões fornecidas');
    }

    setCalculation(result);
    setLoading(false);

    if (onCalculationComplete) {
      onCalculationComplete(result);
    }
  }, [components, width, height, quantity, memoizedConfigurations, manualWasteOverride, onCalculationComplete]);

  // Effect to trigger calculation when dependencies change
  useEffect(() => {
    if (components.length > 0 && width > 0 && height > 0 && quantity > 0) {
      calculateMaterials();
    }
  }, [calculateMaterials, components.length, width, height, quantity]);

  const loadProductComponents = async () => {
    if (!productId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/api/catalog/products/${productId}/components`);
      
      if (response.data.data && response.data.data.length > 0) {
        setComponents(response.data.data);
      } else {
        setComponents([]);
      }
    } catch (error) {
      console.error('Erro ao carregar componentes do produto:', error);
      toast.error('Erro ao carregar materiais do produto');
      setComponents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleWasteOverride = (componentId: string, wastePercentage: number) => {
    setManualWasteOverride(prev => ({
      ...prev,
      [componentId]: wastePercentage
    }));
  };

  const getConsumptionMethodLabel = (method: string) => {
    switch (method) {
      case 'BOUNDING_BOX': return 'Área (Chapa)';
      case 'LINEAR_NEST': return 'Linear (Rolo)';
      case 'FIXED_AMOUNT': return 'Quantidade Fixa';
      default: return method;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="w-5 h-5" />
            <span>Calculadora de Materiais</span>
          </CardTitle>
          <CardDescription>
            Calculando materiais necessários...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!calculation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="w-5 h-5" />
            <span>Calculadora de Materiais</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {!productId 
                ? 'Selecione um produto para calcular materiais'
                : 'Configure materiais para este produto primeiro'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calculator className="w-5 h-5" />
          <span>Materiais Necessários</span>
        </CardTitle>
        <CardDescription>
          Dimensões: {width} × {height}mm • Quantidade: {quantity}un
          {Object.keys(configurations).length > 0 && (
            <span> • Configurações aplicadas</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warnings */}
        {calculation.warnings.length > 0 && (
          <div className="space-y-2">
            {calculation.warnings.map((warning, index) => (
              <div key={index} className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                <p className="text-sm text-red-700">{warning}</p>
              </div>
            ))}
          </div>
        )}

        {/* Material Requirements */}
        <div className="space-y-3">
          <h4 className="font-medium">Materiais Configurados:</h4>
          {calculation.materials.map((item) => (
            <div key={item.component.id} className={`border rounded-lg p-4 ${
              item.sufficient ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    item.sufficient ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {item.sufficient ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-medium">{item.component.material.name}</h5>
                    <p className="text-sm text-muted-foreground">
                      {getConsumptionMethodLabel(item.component.consumptionMethod)} • 
                      Prioridade: {item.component.priority}
                      {item.component.isOptional && ' • Opcional'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{formatCurrency(item.cost)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(Number(item.component.material.costPerUnit))}/{item.component.material.unit}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Necessário</p>
                  <p>{item.needed} {item.unit}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Disponível</p>
                  <p>{item.available} {item.component.material.unit}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Perda Aplicada</p>
                  <p>
                    {item.wasteType === 'units' 
                      ? `${item.wasteApplied} ${item.component.material.unit}` 
                      : `${item.wasteApplied.toFixed(1)}%`
                    }
                  </p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">
                    Ajustar Perda {item.wasteType === 'units' ? `(${item.component.material.unit})` : '(%)'}
                  </p>
                  <Input
                    type="number"
                    value={manualWasteOverride[item.component.id] || item.wasteApplied}
                    onChange={(e) => handleWasteOverride(item.component.id, Number(e.target.value))}
                    className="w-20 h-6 text-xs"
                    min="0"
                    max={item.wasteType === 'units' ? "999" : "50"}
                    step={item.wasteType === 'units' ? "1" : "0.1"}
                  />
                </div>
              </div>

              {item.component.notes && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Observações:</span> {item.component.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {calculation.materials.length === 0 && (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum material configurado</h3>
            <p className="text-muted-foreground mb-4">
              Este produto não possui materiais configurados para cálculo automático.
            </p>
            <p className="text-sm text-muted-foreground">
              Para configurar materiais, acesse <strong>Produtos → Configurar Materiais</strong>
            </p>
          </div>
        )}

        {/* Total */}
        {calculation.materials.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Custo Total de Material:</span>
              <span className="text-xl font-bold">{formatCurrency(calculation.totalCost)}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Área total: {((width * height * quantity) / 1000000).toFixed(2)} m²
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-4 border-t">
          <Button size="sm" onClick={calculateMaterials} disabled={loading}>
            <Calculator className="w-4 h-4 mr-2" />
            Recalcular
          </Button>
          {calculation.hasRequiredMaterials && (
            <Button size="sm" variant="outline">
              <Package className="w-4 h-4 mr-2" />
              Reservar Materiais
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};