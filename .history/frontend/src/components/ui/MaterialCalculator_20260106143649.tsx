import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Calculator, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Material {
  id: string;
  name: string;
  format: 'ROLL' | 'SHEET' | 'UNIT';
  width?: number;
  height?: number;
  costPerUnit: number;
  stock: number;
}

interface MaterialCalculatorProps {
  width: number;
  height: number;
  quantity: number;
  onCalculationComplete?: (result: CalculationResult) => void;
}

interface CalculationResult {
  materials: Array<{
    material: Material;
    needed: number;
    available: number;
    cost: number;
    sufficient: boolean;
  }>;
  totalCost: number;
  warnings: string[];
}

export const MaterialCalculator: React.FC<MaterialCalculatorProps> = ({
  width,
  height,
  quantity,
  onCalculationComplete
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [wastePercentage, setWastePercentage] = useState(10);

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    if (materials.length > 0 && width > 0 && height > 0 && quantity > 0) {
      calculateMaterials();
    }
  }, [materials, width, height, quantity, wastePercentage]);

  const loadMaterials = async () => {
    try {
      // Simular carregamento de materiais - implementar API depois
      const mockMaterials: Material[] = [
        {
          id: '1',
          name: 'Lona Vinílica Branca',
          format: 'ROLL',
          width: 1400,
          costPerUnit: 12.50,
          stock: 150
        },
        {
          id: '2',
          name: 'Vinil Adesivo',
          format: 'ROLL',
          width: 1220,
          costPerUnit: 8.90,
          stock: 80
        },
        {
          id: '3',
          name: 'ACM 3mm',
          format: 'SHEET',
          width: 1220,
          height: 2440,
          costPerUnit: 45.00,
          stock: 25
        }
      ];
      setMaterials(mockMaterials);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
    }
  };

  const calculateMaterials = () => {
    setLoading(true);
    
    const result: CalculationResult = {
      materials: [],
      totalCost: 0,
      warnings: []
    };

    const itemArea = (width * height) / 1000000; // m²
    const totalArea = itemArea * quantity;
    const areaWithWaste = totalArea * (1 + wastePercentage / 100);

    materials.forEach(material => {
      let needed = 0;
      let cost = 0;

      if (material.format === 'ROLL') {
        // Para rolos, calcular metros lineares necessários
        const materialWidth = material.width || 1000;
        if (width <= materialWidth) {
          needed = (height * quantity) / 1000; // metros lineares
          needed = needed * (1 + wastePercentage / 100);
          cost = needed * material.costPerUnit;
        }
      } else if (material.format === 'SHEET') {
        // Para chapas, calcular quantas chapas são necessárias
        const sheetArea = ((material.width || 0) * (material.height || 0)) / 1000000;
        if (width <= (material.width || 0) && height <= (material.height || 0)) {
          needed = Math.ceil(areaWithWaste / sheetArea);
          cost = needed * material.costPerUnit;
        }
      } else if (material.format === 'UNIT') {
        // Para unidades, usar a quantidade diretamente
        needed = quantity * (1 + wastePercentage / 100);
        cost = needed * material.costPerUnit;
      }

      if (needed > 0) {
        const sufficient = material.stock >= needed;
        
        result.materials.push({
          material,
          needed: Math.ceil(needed * 100) / 100, // Arredondar para 2 casas
          available: material.stock,
          cost,
          sufficient
        });

        if (!sufficient) {
          result.warnings.push(
            `Estoque insuficiente de ${material.name}: necessário ${needed.toFixed(2)}, disponível ${material.stock}`
          );
        }

        result.totalCost += cost;
      }
    });

    // Ordenar por custo (menor primeiro)
    result.materials.sort((a, b) => a.cost - b.cost);

    setCalculation(result);
    setLoading(false);

    if (onCalculationComplete) {
      onCalculationComplete(result);
    }
  };

  if (!calculation) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calculator className="w-5 h-5" />
          <span>Calculadora de Materiais</span>
        </CardTitle>
        <CardDescription>
          Dimensões: {width} × {height}mm • Quantidade: {quantity}un
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuração de Perda */}
        <div className="flex items-center space-x-4 p-3 bg-muted rounded-lg">
          <label className="text-sm font-medium">Perda técnica:</label>
          <Input
            type="number"
            value={wastePercentage}
            onChange={(e) => setWastePercentage(Number(e.target.value))}
            className="w-20"
            min="0"
            max="50"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>

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

        {/* Material Options */}
        <div className="space-y-3">
          <h4 className="font-medium">Opções de Material:</h4>
          {calculation.materials.map((item) => (
            <div key={item.material.id} className={`border rounded-lg p-4 ${
              item.sufficient ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
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
                    <h5 className="font-medium">{item.material.name}</h5>
                    <p className="text-sm text-muted-foreground">
                      Necessário: {item.needed} {item.material.format === 'ROLL' ? 'm' : item.material.format === 'SHEET' ? 'chapas' : 'un'} • 
                      Disponível: {item.available}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{formatCurrency(item.cost)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(item.material.costPerUnit)}/{item.material.format === 'ROLL' ? 'm' : 'un'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Custo Total de Material:</span>
            <span className="text-xl font-bold">{formatCurrency(calculation.totalCost)}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Área total: {((width * height * quantity) / 1000000).toFixed(2)} m² 
            (com {wastePercentage}% de perda: {((width * height * quantity) / 1000000 * (1 + wastePercentage / 100)).toFixed(2)} m²)
          </p>
        </div>

        {/* Actions */}
        <div className="flex space-x-2 pt-4 border-t">
          <Button size="sm" onClick={calculateMaterials} disabled={loading}>
            <Calculator className="w-4 h-4 mr-2" />
            Recalcular
          </Button>
          <Button size="sm" variant="outline">
            <Package className="w-4 h-4 mr-2" />
            Reservar Material
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};