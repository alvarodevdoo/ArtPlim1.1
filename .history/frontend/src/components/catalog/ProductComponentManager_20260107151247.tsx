import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Trash2, Edit, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { MaterialSelector } from '@/components/catalog/MaterialSelector';

interface Material {
  id: string;
  name: string;
  format: 'ROLL' | 'SHEET' | 'UNIT';
  costPerUnit: number;
  unit: string;
  standardWidth?: number;
  standardLength?: number;
}

interface ProductComponent {
  id: string;
  materialId: string;
  consumptionMethod: 'BOUNDING_BOX' | 'LINEAR_NEST' | 'FIXED_AMOUNT';
  wastePercentage: number;
  calculatedWastePercentage: number;
  manualWastePercentage?: number;
  wasteUnits: number;
  manualWasteUnits?: number;
  isOptional: boolean;
  priority: number;
  notes?: string;
  material: Material;
  createdAt: string;
  updatedAt: string;
}

interface ProductComponentManagerProps {
  productId: string;
  productName: string;
  pricingMode: string;
}

export const ProductComponentManager: React.FC<ProductComponentManagerProps> = ({
  productId,
  productName,
  pricingMode
}) => {
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ProductComponent | null>(null);
  const [validation, setValidation] = useState<{ isValid: boolean; errors: string[] } | null>(null);

  useEffect(() => {
    loadComponents();
    validateProduct();
  }, [productId]);

  const loadComponents = async () => {
    try {
      const response = await api.get(`/api/catalog/products/${productId}/components`);
      setComponents(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar componentes');
    } finally {
      setLoading(false);
    }
  };

  const validateProduct = async () => {
    try {
      const response = await api.get(`/api/catalog/products/${productId}/validate`);
      setValidation(response.data.data);
    } catch (error) {
      console.error('Erro ao validar produto:', error);
    }
  };

  const handleAddComponent = async (materialId: string, config: any) => {
    try {
      await api.post(`/api/catalog/products/${productId}/components`, {
        materialId,
        consumptionMethod: config.consumptionMethod,
        wastePercentage: config.wastePercentage || 0,
        manualWastePercentage: config.manualWastePercentage,
        isOptional: config.isOptional || false,
        priority: config.priority || components.length + 1,
        notes: config.notes
      });
      
      toast.success('Componente adicionado com sucesso!');
      setShowMaterialSelector(false);
      loadComponents();
      validateProduct();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao adicionar componente');
    }
  };

  const handleRemoveComponent = async (componentId: string) => {
    if (!confirm('Tem certeza que deseja remover este componente?')) return;
    
    try {
      await api.delete(`/api/catalog/products/${productId}/components/${componentId}`);
      toast.success('Componente removido com sucesso!');
      loadComponents();
      validateProduct();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao remover componente');
    }
  };

  const handleUpdateComponent = async (componentId: string, updates: any) => {
    try {
      await api.put(`/api/catalog/products/${productId}/components/${componentId}`, updates);
      toast.success('Componente atualizado com sucesso!');
      setEditingComponent(null);
      loadComponents();
      validateProduct();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao atualizar componente');
    }
  };

  const getConsumptionMethodLabel = (method: string) => {
    switch (method) {
      case 'BOUNDING_BOX': return 'Área (Chapa)';
      case 'LINEAR_NEST': return 'Linear (Rolo)';
      case 'FIXED_AMOUNT': return 'Quantidade Fixa';
      default: return method;
    }
  };

  const getConsumptionMethodColor = (method: string) => {
    switch (method) {
      case 'BOUNDING_BOX': return 'bg-blue-100 text-blue-600';
      case 'LINEAR_NEST': return 'bg-green-100 text-green-600';
      case 'FIXED_AMOUNT': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'SHEET': return 'Chapa';
      case 'ROLL': return 'Rolo';
      case 'UNIT': return 'Unidade';
      default: return format;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Materiais do Produto</h3>
          <p className="text-sm text-muted-foreground">
            Configure os materiais necessários para produzir "{productName}"
          </p>
        </div>
        <Button onClick={() => setShowMaterialSelector(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Material
        </Button>
      </div>

      {/* Validation Status */}
      {validation && (
        <Card className={validation.isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="pt-4">
            <div className="flex items-center space-x-2">
              {validation.isValid ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <p className={`font-medium ${validation.isValid ? 'text-green-800' : 'text-red-800'}`}>
                  {validation.isValid ? 'Produto configurado corretamente' : 'Produto precisa de ajustes'}
                </p>
                {validation.errors.length > 0 && (
                  <ul className="text-sm text-red-700 mt-1 list-disc list-inside">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Components List */}
      {components.length > 0 ? (
        <div className="space-y-4">
          {components
            .sort((a, b) => a.priority - b.priority)
            .map((component) => (
              <Card key={component.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{component.material.name}</CardTitle>
                      <CardDescription className="flex items-center space-x-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getConsumptionMethodColor(component.consumptionMethod)}`}>
                          {getConsumptionMethodLabel(component.consumptionMethod)}
                        </span>
                        <span className="text-xs">
                          {getFormatLabel(component.material.format)} • {component.material.unit}
                        </span>
                        {component.isOptional && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-600 rounded text-xs font-medium">
                            Opcional
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingComponent(component)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveComponent(component.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">Custo por {component.material.unit}</p>
                      <p>R$ {Number(component.material.costPerUnit || 0).toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Perda Atual</p>
                      <p>{(component.wastePercentage * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Perda Calculada</p>
                      <p>{(component.calculatedWastePercentage * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Prioridade</p>
                      <p>{component.priority}</p>
                    </div>
                  </div>
                  {component.notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Observações:</span> {component.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhum material configurado</h3>
            <p className="text-muted-foreground mb-4">
              {pricingMode === 'DYNAMIC_ENGINEER' 
                ? 'Produtos com cálculo dinâmico precisam de pelo menos um material configurado.'
                : 'Adicione materiais para calcular custos automaticamente.'
              }
            </p>
            <Button onClick={() => setShowMaterialSelector(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeiro Material
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Material Selector Modal */}
      {showMaterialSelector && (
        <MaterialSelector
          isOpen={showMaterialSelector}
          onClose={() => setShowMaterialSelector(false)}
          onSelect={handleAddComponent}
          excludeIds={components.map(c => c.materialId)}
        />
      )}

      {/* Edit Component Modal */}
      {editingComponent && (
        <EditComponentModal
          component={editingComponent}
          onClose={() => setEditingComponent(null)}
          onSave={handleUpdateComponent}
        />
      )}
    </div>
  );
};

// Component para editar componente
interface EditComponentModalProps {
  component: ProductComponent;
  onClose: () => void;
  onSave: (componentId: string, updates: any) => void;
}

const EditComponentModal: React.FC<EditComponentModalProps> = ({
  component,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    consumptionMethod: component.consumptionMethod,
    manualWastePercentage: component.manualWastePercentage?.toString() || '',
    isOptional: component.isOptional,
    priority: component.priority.toString(),
    notes: component.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates = {
      consumptionMethod: formData.consumptionMethod,
      manualWastePercentage: formData.manualWastePercentage ? parseFloat(formData.manualWastePercentage) / 100 : null,
      isOptional: formData.isOptional,
      priority: parseInt(formData.priority),
      notes: formData.notes || null
    };
    
    onSave(component.id, updates);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Editar Componente</CardTitle>
          <CardDescription>
            {component.material.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Método de Consumo</label>
              <select
                value={formData.consumptionMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, consumptionMethod: e.target.value as any }))}
                className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="BOUNDING_BOX">Área (Chapa)</option>
                <option value="LINEAR_NEST">Linear (Rolo)</option>
                <option value="FIXED_AMOUNT">Quantidade Fixa</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Percentual de Perda Manual (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.manualWastePercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, manualWastePercentage: e.target.value }))}
                className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                placeholder="Deixe vazio para usar cálculo automático"
              />
              <p className="text-xs text-muted-foreground">
                Atual calculado: {(component.calculatedWastePercentage * 100).toFixed(1)}%
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridade</label>
              <input
                type="number"
                min="1"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isOptional"
                checked={formData.isOptional}
                onChange={(e) => setFormData(prev => ({ ...prev, isOptional: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="isOptional" className="text-sm font-medium">
                Material opcional
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full min-h-[80px] px-3 py-2 border border-input rounded-md bg-background"
                placeholder="Observações sobre este material..."
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};