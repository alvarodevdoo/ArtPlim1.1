import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Search, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Material {
  id: string;
  name: string;
  format: 'ROLL' | 'SHEET' | 'UNIT';
  costPerUnit: number;
  unit: string;
  standardWidth?: number;
  standardLength?: number;
  description?: string;
}

interface MaterialSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (materialId: string, config: ComponentConfig) => void;
  excludeIds?: string[];
}

interface ComponentConfig {
  consumptionMethod: 'BOUNDING_BOX' | 'LINEAR_NEST' | 'FIXED_AMOUNT';
  wastePercentage?: number;
  manualWastePercentage?: number;
  isOptional?: boolean;
  priority?: number;
  notes?: string;
}

export const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  excludeIds = []
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [config, setConfig] = useState<ComponentConfig>({
    consumptionMethod: 'BOUNDING_BOX',
    wastePercentage: 0,
    isOptional: false,
    priority: 1,
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadMaterials();
    }
  }, [isOpen]);

  const loadMaterials = async () => {
    try {
      const response = await api.get('/api/catalog/materials');
      setMaterials(response.data.data.filter((m: Material) => !excludeIds.includes(m.id)));
    } catch (error) {
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialSelect = (material: Material) => {
    setSelectedMaterial(material);
    
    // Auto-select compatible consumption method based on format
    let defaultMethod: 'BOUNDING_BOX' | 'LINEAR_NEST' | 'FIXED_AMOUNT' = 'FIXED_AMOUNT';
    if (material.format === 'SHEET') {
      defaultMethod = 'BOUNDING_BOX';
    } else if (material.format === 'ROLL') {
      defaultMethod = 'LINEAR_NEST';
    }
    
    setConfig(prev => ({
      ...prev,
      consumptionMethod: defaultMethod
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    
    onSelect(selectedMaterial.id, config);
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'SHEET': return 'Chapa';
      case 'ROLL': return 'Rolo';
      case 'UNIT': return 'Unidade';
      default: return format;
    }
  };

  const getFormatColor = (format: string) => {
    switch (format) {
      case 'SHEET': return 'bg-blue-100 text-blue-600';
      case 'ROLL': return 'bg-green-100 text-green-600';
      case 'UNIT': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const isMethodCompatible = (materialFormat: string, method: string) => {
    if (method === 'FIXED_AMOUNT') return true;
    if (method === 'BOUNDING_BOX' && materialFormat === 'SHEET') return true;
    if (method === 'LINEAR_NEST' && materialFormat === 'ROLL') return true;
    return false;
  };

  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader>
          <CardTitle>Selecionar Material</CardTitle>
          <CardDescription>
            Escolha um material e configure como ele será consumido
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          {!selectedMaterial ? (
            // Material Selection Step
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar materiais..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Materials Grid */}
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredMaterials.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {filteredMaterials.map((material) => (
                    <Card 
                      key={material.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleMaterialSelect(material)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">{material.name}</CardTitle>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getFormatColor(material.format)}`}>
                            {getFormatLabel(material.format)}
                          </span>
                        </div>
                        {material.description && (
                          <CardDescription className="text-sm">
                            {material.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="font-medium">Custo:</span> R$ {Number(material.costPerUnit).toFixed(4)}/{material.unit}
                          </p>
                          {material.standardWidth && material.standardLength && (
                            <p>
                              <span className="font-medium">Dimensões:</span> {material.standardWidth}mm × {material.standardLength}mm
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum material encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Tente ajustar sua busca' : 'Nenhum material disponível'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Configuration Step
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selected Material Info */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{selectedMaterial.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {getFormatLabel(selectedMaterial.format)} • R$ {selectedMaterial.costPerUnit.toFixed(4)}/{selectedMaterial.unit}
                      </p>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedMaterial(null)}
                    >
                      Trocar Material
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Configuration Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Método de Consumo *</label>
                  <select
                    value={config.consumptionMethod}
                    onChange={(e) => setConfig(prev => ({ ...prev, consumptionMethod: e.target.value as any }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    required
                  >
                    <option 
                      value="BOUNDING_BOX" 
                      disabled={!isMethodCompatible(selectedMaterial.format, 'BOUNDING_BOX')}
                    >
                      Área (Chapa) - Para materiais em chapa
                    </option>
                    <option 
                      value="LINEAR_NEST" 
                      disabled={!isMethodCompatible(selectedMaterial.format, 'LINEAR_NEST')}
                    >
                      Linear (Rolo) - Para materiais em rolo
                    </option>
                    <option value="FIXED_AMOUNT">
                      Quantidade Fixa - Para materiais unitários
                    </option>
                  </select>
                  
                  {!isMethodCompatible(selectedMaterial.format, config.consumptionMethod) && (
                    <div className="flex items-center space-x-2 text-amber-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>Este método pode não ser compatível com o formato do material</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Percentual de Perda Inicial (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={config.wastePercentage || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        wastePercentage: e.target.value ? parseFloat(e.target.value) / 100 : 0 
                      }))}
                      placeholder="0.0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Será atualizado automaticamente conforme o uso
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prioridade</label>
                    <Input
                      type="number"
                      min="1"
                      value={config.priority || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        priority: e.target.value ? parseInt(e.target.value) : 1 
                      }))}
                      placeholder="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ordem de exibição (1 = primeiro)
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isOptional"
                    checked={config.isOptional}
                    onChange={(e) => setConfig(prev => ({ ...prev, isOptional: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="isOptional" className="text-sm font-medium">
                    Material opcional (não obrigatório para produção)
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações</label>
                  <textarea
                    value={config.notes}
                    onChange={(e) => setConfig(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full min-h-[80px] px-3 py-2 border border-input rounded-md bg-background"
                    placeholder="Observações sobre como este material é usado..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Adicionar Material
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};