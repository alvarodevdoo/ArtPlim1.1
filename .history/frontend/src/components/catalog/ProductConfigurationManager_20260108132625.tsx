import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Trash2, Edit, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface ConfigurationOption {
  id: string;
  label: string;
  value: string;
  priceModifier: number;
  displayOrder: number;
  additionalComponents?: any[];
}

interface ProductConfiguration {
  id: string;
  name: string;
  type: 'SELECT' | 'NUMBER' | 'BOOLEAN';
  required: boolean;
  defaultValue?: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  affectsComponents: boolean;
  affectsPricing: boolean;
  displayOrder: number;
  options: ConfigurationOption[];
  createdAt: string;
  updatedAt: string;
}

interface ProductConfigurationManagerProps {
  productId: string;
  productName: string;
  pricingMode: string;
}

export const ProductConfigurationManager: React.FC<ProductConfigurationManagerProps> = ({
  productId,
  productName,
  pricingMode
}) => {
  const [configurations, setConfigurations] = useState<ProductConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ProductConfiguration | null>(null);
  const [showOptionForm, setShowOptionForm] = useState(false);
  const [editingOption, setEditingOption] = useState<ConfigurationOption | null>(null);
  const [selectedConfigForOption, setSelectedConfigForOption] = useState<string | null>(null);
  const [optionFormData, setOptionFormData] = useState({
    label: '',
    value: '',
    description: '',
    priceModifier: '',
    priceModifierType: 'FIXED' as 'FIXED' | 'PERCENTAGE',
    displayOrder: '',
    isAvailable: true
  });

  const [formData, setFormData] = useState({
    name: '',
    type: 'SELECT' as 'SELECT' | 'NUMBER' | 'BOOLEAN',
    required: true,
    defaultValue: '',
    minValue: '',
    maxValue: '',
    step: '',
    affectsComponents: false,
    affectsPricing: true,
    displayOrder: ''
  });

  useEffect(() => {
    loadConfigurations();
  }, [productId]);

  const loadConfigurations = async () => {
    try {
      const response = await api.get(`/api/catalog/products/${productId}/configurations`);
      setConfigurations(response.data.data);
    } catch (error) {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      type: formData.type,
      required: formData.required,
      defaultValue: formData.defaultValue || undefined,
      minValue: formData.minValue ? parseFloat(formData.minValue) : undefined,
      maxValue: formData.maxValue ? parseFloat(formData.maxValue) : undefined,
      step: formData.step ? parseFloat(formData.step) : undefined,
      affectsComponents: formData.affectsComponents,
      affectsPricing: formData.affectsPricing,
      displayOrder: formData.displayOrder ? parseInt(formData.displayOrder) : configurations.length + 1
    };
    
    try {
      if (editingConfig) {
        await api.put(`/api/catalog/products/${productId}/configurations/${editingConfig.id}`, payload);
        toast.success('Configuração atualizada com sucesso!');
      } else {
        await api.post(`/api/catalog/products/${productId}/configurations`, payload);
        toast.success('Configuração criada com sucesso!');
      }
      
      setShowForm(false);
      setEditingConfig(null);
      resetForm();
      loadConfigurations();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar configuração');
    }
  };

  const handleEdit = (config: ProductConfiguration) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      type: config.type,
      required: config.required,
      defaultValue: config.defaultValue || '',
      minValue: config.minValue?.toString() || '',
      maxValue: config.maxValue?.toString() || '',
      step: config.step?.toString() || '',
      affectsComponents: config.affectsComponents,
      affectsPricing: config.affectsPricing,
      displayOrder: config.displayOrder.toString()
    });
    setShowForm(true);
  };

  const handleDelete = async (configId: string) => {
    if (!confirm('Tem certeza que deseja remover esta configuração?')) return;
    
    try {
      await api.delete(`/api/catalog/products/${productId}/configurations/${configId}`);
      toast.success('Configuração removida com sucesso!');
      loadConfigurations();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao remover configuração');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'SELECT',
      required: true,
      defaultValue: '',
      minValue: '',
      maxValue: '',
      step: '',
      affectsComponents: false,
      affectsPricing: true,
      displayOrder: ''
    });
  };

  const toggleExpanded = (configId: string) => {
    const newExpanded = new Set(expandedConfigs);
    if (newExpanded.has(configId)) {
      newExpanded.delete(configId);
    } else {
      newExpanded.add(configId);
    }
    setExpandedConfigs(newExpanded);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SELECT': return 'Seleção';
      case 'NUMBER': return 'Número';
      case 'BOOLEAN': return 'Sim/Não';
      default: return type;
    }
  };

  const handleAddOption = (configId: string) => {
    setSelectedConfigForOption(configId);
    setEditingOption(null);
    resetOptionForm();
    setShowOptionForm(true);
  };

  const handleEditOption = (option: ConfigurationOption) => {
    setEditingOption(option);
    setSelectedConfigForOption(null);
    setOptionFormData({
      label: option.label,
      value: option.value,
      description: '',
      priceModifier: option.priceModifier.toString(),
      priceModifierType: 'FIXED',
      displayOrder: option.displayOrder.toString(),
      isAvailable: true
    });
    setShowOptionForm(true);
  };

  const handleDeleteOption = async (optionId: string) => {
    if (!confirm('Tem certeza que deseja remover esta opção?')) return;
    
    try {
      await api.delete(`/api/catalog/configurations/${selectedConfigForOption}/options/${optionId}`);
      toast.success('Opção removida com sucesso!');
      loadConfigurations();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao remover opção');
    }
  };

  const handleSubmitOption = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedConfigForOption && !editingOption) return;
    
    const payload = {
      label: optionFormData.label,
      value: optionFormData.value,
      description: optionFormData.description || undefined,
      priceModifier: optionFormData.priceModifier ? parseFloat(optionFormData.priceModifier) : 0,
      priceModifierType: optionFormData.priceModifierType,
      displayOrder: optionFormData.displayOrder ? parseInt(optionFormData.displayOrder) : 1,
      isAvailable: optionFormData.isAvailable
    };
    
    try {
      if (editingOption) {
        await api.put(`/api/catalog/configurations/${editingOption.configurationId}/options/${editingOption.id}`, payload);
        toast.success('Opção atualizada com sucesso!');
      } else {
        await api.post(`/api/catalog/configurations/${selectedConfigForOption}/options`, payload);
        toast.success('Opção criada com sucesso!');
      }
      
      setShowOptionForm(false);
      setEditingOption(null);
      setSelectedConfigForOption(null);
      resetOptionForm();
      loadConfigurations();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao salvar opção');
    }
  };

  const resetOptionForm = () => {
    setOptionFormData({
      label: '',
      value: '',
      description: '',
      priceModifier: '',
      priceModifierType: 'FIXED',
      displayOrder: '',
      isAvailable: true
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SELECT': return 'bg-blue-100 text-blue-600';
      case 'NUMBER': return 'bg-green-100 text-green-600';
      case 'BOOLEAN': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
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
          <h3 className="text-lg font-semibold">Configurações do Produto</h3>
          <p className="text-sm text-muted-foreground">
            Configure opções dinâmicas para "{productName}"
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Configuração
        </Button>
      </div>

      {/* Info Card */}
      {pricingMode !== 'DYNAMIC_ENGINEER' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">
                  Configurações disponíveis apenas para produtos dinâmicos
                </p>
                <p className="text-sm text-yellow-700">
                  Altere o modo de precificação para "Cálculo dinâmico" para usar configurações.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
              </CardTitle>
              <CardDescription>
                Configure uma opção personalizável para o produto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Configuração *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Número de Páginas, Tipo de Capa"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    required
                  >
                    <option value="SELECT">Seleção (lista de opções)</option>
                    <option value="NUMBER">Número (valor numérico)</option>
                    <option value="BOOLEAN">Sim/Não (checkbox)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="required"
                      checked={formData.required}
                      onChange={(e) => setFormData(prev => ({ ...prev, required: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="required" className="text-sm font-medium">
                      Obrigatório
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="affectsPricing"
                      checked={formData.affectsPricing}
                      onChange={(e) => setFormData(prev => ({ ...prev, affectsPricing: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="affectsPricing" className="text-sm font-medium">
                      Afeta preço
                    </label>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="affectsComponents"
                    checked={formData.affectsComponents}
                    onChange={(e) => setFormData(prev => ({ ...prev, affectsComponents: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="affectsComponents" className="text-sm font-medium">
                    Afeta materiais necessários
                  </label>
                </div>

                {formData.type === 'NUMBER' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Valor Mínimo</label>
                      <Input
                        type="number"
                        value={formData.minValue}
                        onChange={(e) => setFormData(prev => ({ ...prev, minValue: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Valor Máximo</label>
                      <Input
                        type="number"
                        value={formData.maxValue}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxValue: e.target.value }))}
                        placeholder="100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Incremento</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.step}
                        onChange={(e) => setFormData(prev => ({ ...prev, step: e.target.value }))}
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valor Padrão</label>
                    <Input
                      value={formData.defaultValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultValue: e.target.value }))}
                      placeholder={formData.type === 'BOOLEAN' ? 'true/false' : 'Valor inicial'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ordem de Exibição</label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.displayOrder}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: e.target.value }))}
                      placeholder={(configurations.length + 1).toString()}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowForm(false);
                      setEditingConfig(null);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingConfig ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Option Form Modal */}
      {showOptionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingOption ? 'Editar Opção' : 'Nova Opção'}
              </CardTitle>
              <CardDescription>
                Configure uma opção para a configuração selecionada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitOption} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Opção *</label>
                  <Input
                    value={optionFormData.label}
                    onChange={(e) => setOptionFormData(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Ex: Capa Dura, Wire-o, 4 Páginas"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Valor (ID) *</label>
                  <Input
                    value={optionFormData.value}
                    onChange={(e) => setOptionFormData(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="Ex: hard_cover, wire_o, 4_pages"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador único da opção (sem espaços, use _ ou -)
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={optionFormData.description}
                    onChange={(e) => setOptionFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional da opção"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Modificador de Preço</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={optionFormData.priceModifier}
                      onChange={(e) => setOptionFormData(prev => ({ ...prev, priceModifier: e.target.value }))}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Valor a adicionar (+) ou subtrair (-) do preço
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo do Modificador</label>
                    <select
                      value={optionFormData.priceModifierType}
                      onChange={(e) => setOptionFormData(prev => ({ ...prev, priceModifierType: e.target.value as any }))}
                      className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="FIXED">Valor Fixo (R$)</option>
                      <option value="PERCENTAGE">Percentual (%)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ordem de Exibição</label>
                    <Input
                      type="number"
                      min="1"
                      value={optionFormData.displayOrder}
                      onChange={(e) => setOptionFormData(prev => ({ ...prev, displayOrder: e.target.value }))}
                      placeholder="1"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <input
                      type="checkbox"
                      id="isAvailable"
                      checked={optionFormData.isAvailable}
                      onChange={(e) => setOptionFormData(prev => ({ ...prev, isAvailable: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="isAvailable" className="text-sm font-medium">
                      Disponível
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowOptionForm(false);
                      setEditingOption(null);
                      setSelectedConfigForOption(null);
                      resetOptionForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingOption ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configurations List */}
      {configurations.length > 0 ? (
        <div className="space-y-4">
          {configurations
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((config) => (
              <Card key={config.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-base">{config.name}</CardTitle>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(config.type)}`}>
                          {getTypeLabel(config.type)}
                        </span>
                        {config.required && (
                          <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-medium">
                            Obrigatório
                          </span>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        <div className="flex items-center space-x-4 text-xs">
                          {config.affectsPricing && (
                            <span className="text-green-600">• Afeta preço</span>
                          )}
                          {config.affectsComponents && (
                            <span className="text-blue-600">• Afeta materiais</span>
                          )}
                          <span>Ordem: {config.displayOrder}</span>
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleExpanded(config.id)}
                      >
                        {expandedConfigs.has(config.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(config)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(config.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                {expandedConfigs.has(config.id) && (
                  <CardContent>
                    <div className="space-y-3">
                      {/* Configuration Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {config.defaultValue && (
                          <div>
                            <p className="font-medium text-muted-foreground">Valor Padrão</p>
                            <p>{config.defaultValue}</p>
                          </div>
                        )}
                        {config.minValue !== undefined && (
                          <div>
                            <p className="font-medium text-muted-foreground">Mínimo</p>
                            <p>{config.minValue}</p>
                          </div>
                        )}
                        {config.maxValue !== undefined && (
                          <div>
                            <p className="font-medium text-muted-foreground">Máximo</p>
                            <p>{config.maxValue}</p>
                          </div>
                        )}
                        {config.step !== undefined && (
                          <div>
                            <p className="font-medium text-muted-foreground">Incremento</p>
                            <p>{config.step}</p>
                          </div>
                        )}
                      </div>

                      {/* Options for SELECT type */}
                      {config.type === 'SELECT' && (
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <p className="font-medium text-sm">Opções Disponíveis</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddOption(config.id)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Adicionar Opção
                            </Button>
                          </div>
                          {config.options.length > 0 ? (
                            <div className="space-y-2">
                              {config.options
                                .sort((a, b) => a.displayOrder - b.displayOrder)
                                .map((option) => (
                                  <div key={option.id} className="flex items-center justify-between p-2 border rounded">
                                    <div>
                                      <span className="font-medium">{option.label}</span>
                                      {option.priceModifier !== 0 && (
                                        <span className={`ml-2 text-sm ${option.priceModifier > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {option.priceModifier > 0 ? '+' : ''}R$ {option.priceModifier.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex space-x-1">
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        onClick={() => handleEditOption(option)}
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        onClick={() => handleDeleteOption(option.id)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Nenhuma opção configurada. Adicione opções para que os clientes possam escolher.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhuma configuração criada</h3>
            <p className="text-muted-foreground mb-4">
              {pricingMode === 'DYNAMIC_ENGINEER' 
                ? 'Crie configurações para permitir que clientes personalizem este produto.'
                : 'Configurações estão disponíveis apenas para produtos com cálculo dinâmico.'
              }
            </p>
            {pricingMode === 'DYNAMIC_ENGINEER' && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Configuração
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};