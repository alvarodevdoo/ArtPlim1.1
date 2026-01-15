import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Settings, AlertTriangle, Info, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface ConfigurationOption {
  id: string;
  label: string;
  value: string;
  description?: string;
  priceModifier: number;
  priceModifierType: 'FIXED' | 'PERCENTAGE';
  displayOrder: number;
  isAvailable: boolean;
}

interface ProductConfiguration {
  id: string;
  name: string;
  description?: string;
  helpText?: string;
  type: 'SELECT' | 'NUMBER' | 'BOOLEAN' | 'TEXT';
  required: boolean;
  defaultValue?: string;
  affectsComponents: boolean;
  affectsPricing: boolean;
  minValue?: number;
  maxValue?: number;
  step?: number;
  displayOrder: number;
  options: ConfigurationOption[];
}

interface ConfigurationSelectorProps {
  productId: string;
  selectedConfigurations: Record<string, any>;
  onConfigurationChange: (configId: string, value: any) => void;
  onPriceImpactChange?: (totalImpact: number) => void;
  showPriceImpact?: boolean;
  disabled?: boolean;
}

export const ConfigurationSelector: React.FC<ConfigurationSelectorProps> = ({
  productId,
  selectedConfigurations,
  onConfigurationChange,
  onPriceImpactChange,
  showPriceImpact = true,
  disabled = false
}) => {
  const [configurations, setConfigurations] = useState<ProductConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [priceImpact, setPriceImpact] = useState(0);

  useEffect(() => {
    if (productId) {
      loadConfigurations();
    }
  }, [productId]);

  useEffect(() => {
    calculatePriceImpact();
  }, [selectedConfigurations, configurations]);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/catalog/products/${productId}/configurations`);
      const configs = response.data.data || [];
      
      // Sort by display order
      configs.sort((a: ProductConfiguration, b: ProductConfiguration) => a.displayOrder - b.displayOrder);
      
      setConfigurations(configs);
      
      // Set default values
      configs.forEach((config: ProductConfiguration) => {
        if (config.defaultValue && !selectedConfigurations[config.id]) {
          onConfigurationChange(config.id, config.defaultValue);
        }
      });
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações do produto');
    } finally {
      setLoading(false);
    }
  };

  const calculatePriceImpact = () => {
    let totalImpact = 0;
    
    configurations.forEach(config => {
      if (!config.affectsPricing) return;
      
      const selectedValue = selectedConfigurations[config.id];
      if (!selectedValue) return;
      
      if (config.type === 'SELECT') {
        const selectedOption = config.options.find(opt => opt.value === selectedValue);
        if (selectedOption) {
          totalImpact += Number(selectedOption.priceModifier);
        }
      }
      // Add logic for other types if needed
    });
    
    setPriceImpact(totalImpact);
    
    if (onPriceImpactChange) {
      onPriceImpactChange(totalImpact);
    }
  };

  const validateInput = (configId: string, value: any): string | null => {
    const config = configurations.find(c => c.id === configId);
    if (!config) return null;

    // Required validation
    if (config.required && (value === undefined || value === null || value === '')) {
      return `${config.name} é obrigatório`;
    }

    // Type-specific validation
    switch (config.type) {
      case 'NUMBER':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return `${config.name} deve ser um número válido`;
        }
        if (config.minValue !== undefined && numValue < config.minValue) {
          return `${config.name} deve ser maior ou igual a ${config.minValue}`;
        }
        if (config.maxValue !== undefined && numValue > config.maxValue) {
          return `${config.name} deve ser menor ou igual a ${config.maxValue}`;
        }
        if (config.step && config.step > 0) {
          const remainder = (numValue - (config.minValue || 0)) % config.step;
          if (Math.abs(remainder) > 0.001) {
            return `${config.name} deve ser múltiplo de ${config.step}`;
          }
        }
        break;

      case 'SELECT':
        const validOption = config.options.find(opt => opt.value === value);
        if (!validOption) {
          return `Valor inválido para ${config.name}`;
        }
        if (!validOption.isAvailable) {
          return `Opção "${validOption.label}" não está disponível`;
        }
        break;

      case 'BOOLEAN':
        if (!['true', 'false'].includes(String(value))) {
          return `${config.name} deve ser verdadeiro ou falso`;
        }
        break;
    }

    return null;
  };

  const handleConfigurationChange = (configId: string, value: any) => {
    // Validate input
    const error = validateInput(configId, value);
    setValidationErrors(prev => ({
      ...prev,
      [configId]: error || ''
    }));

    // Update configuration
    onConfigurationChange(configId, value);
  };

  const renderSelectConfiguration = (config: ProductConfiguration) => {
    const selectedValue = selectedConfigurations[config.id];
    const error = validationErrors[config.id];

    return (
      <div key={config.id} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {config.name}
            {config.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {config.helpText && (
            <div className="group relative">
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              <div className="absolute right-0 top-6 w-64 p-2 bg-popover border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <p className="text-xs">{config.helpText}</p>
              </div>
            </div>
          )}
        </div>
        
        <select
          value={selectedValue || ''}
          onChange={(e) => handleConfigurationChange(config.id, e.target.value)}
          className={`w-full h-10 px-3 py-2 border rounded-md bg-background ${
            error ? 'border-red-500' : 'border-input'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={disabled}
        >
          <option value="">Selecione uma opção</option>
          {config.options
            .filter(opt => opt.isAvailable)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(option => (
              <option key={option.id} value={option.value}>
                {option.label}
                {showPriceImpact && option.priceModifier !== 0 && (
                  ` (${option.priceModifier > 0 ? '+' : ''}${formatCurrency(option.priceModifier)})`
                )}
              </option>
            ))}
        </select>
        
        {error && (
          <p className="text-sm text-red-500 flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {error}
          </p>
        )}
        
        {config.description && (
          <p className="text-xs text-muted-foreground">{config.description}</p>
        )}
      </div>
    );
  };

  const renderNumberConfiguration = (config: ProductConfiguration) => {
    const selectedValue = selectedConfigurations[config.id];
    const error = validationErrors[config.id];

    return (
      <div key={config.id} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {config.name}
            {config.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {config.helpText && (
            <div className="group relative">
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              <div className="absolute right-0 top-6 w-64 p-2 bg-popover border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <p className="text-xs">{config.helpText}</p>
              </div>
            </div>
          )}
        </div>
        
        <Input
          type="number"
          value={selectedValue || ''}
          onChange={(e) => handleConfigurationChange(config.id, e.target.value)}
          min={config.minValue}
          max={config.maxValue}
          step={config.step}
          placeholder={config.defaultValue || ''}
          className={error ? 'border-red-500' : ''}
          disabled={disabled}
        />
        
        {(config.minValue !== undefined || config.maxValue !== undefined || config.step !== undefined) && (
          <div className="text-xs text-muted-foreground">
            {config.minValue !== undefined && `Mín: ${config.minValue}`}
            {config.maxValue !== undefined && ` Máx: ${config.maxValue}`}
            {config.step !== undefined && ` Incremento: ${config.step}`}
          </div>
        )}
        
        {error && (
          <p className="text-sm text-red-500 flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {error}
          </p>
        )}
        
        {config.description && (
          <p className="text-xs text-muted-foreground">{config.description}</p>
        )}
      </div>
    );
  };

  const renderBooleanConfiguration = (config: ProductConfiguration) => {
    const selectedValue = selectedConfigurations[config.id];
    const error = validationErrors[config.id];

    return (
      <div key={config.id} className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={config.id}
            checked={selectedValue === 'true' || selectedValue === true}
            onChange={(e) => handleConfigurationChange(config.id, e.target.checked ? 'true' : 'false')}
            className="rounded"
            disabled={disabled}
          />
          <label htmlFor={config.id} className="text-sm font-medium">
            {config.name}
            {config.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {config.helpText && (
            <div className="group relative">
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              <div className="absolute left-0 top-6 w-64 p-2 bg-popover border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <p className="text-xs">{config.helpText}</p>
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-red-500 flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {error}
          </p>
        )}
        
        {config.description && (
          <p className="text-xs text-muted-foreground ml-6">{config.description}</p>
        )}
      </div>
    );
  };

  const renderTextConfiguration = (config: ProductConfiguration) => {
    const selectedValue = selectedConfigurations[config.id];
    const error = validationErrors[config.id];

    return (
      <div key={config.id} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {config.name}
            {config.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {config.helpText && (
            <div className="group relative">
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              <div className="absolute right-0 top-6 w-64 p-2 bg-popover border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <p className="text-xs">{config.helpText}</p>
              </div>
            </div>
          )}
        </div>
        
        <Input
          type="text"
          value={selectedValue || ''}
          onChange={(e) => handleConfigurationChange(config.id, e.target.value)}
          placeholder={config.defaultValue || ''}
          className={error ? 'border-red-500' : ''}
          disabled={disabled}
        />
        
        {error && (
          <p className="text-sm text-red-500 flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {error}
          </p>
        )}
        
        {config.description && (
          <p className="text-xs text-muted-foreground">{config.description}</p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Carregando configurações...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (configurations.length === 0) {
    return null; // Don't show anything if no configurations
  }

  const hasErrors = Object.values(validationErrors).some(error => error);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Configurações do Produto</span>
        </CardTitle>
        <CardDescription>
          Personalize as opções do produto conforme necessário
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {configurations.map(config => {
          switch (config.type) {
            case 'SELECT':
              return renderSelectConfiguration(config);
            case 'NUMBER':
              return renderNumberConfiguration(config);
            case 'BOOLEAN':
              return renderBooleanConfiguration(config);
            case 'TEXT':
              return renderTextConfiguration(config);
            default:
              return null;
          }
        })}

        {/* Price Impact Summary */}
        {showPriceImpact && priceImpact !== 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Impacto das Configurações:</span>
              </div>
              <span className={`font-bold ${priceImpact > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {priceImpact > 0 ? '+' : ''}{formatCurrency(priceImpact)}
              </span>
            </div>
          </div>
        )}

        {/* Validation Summary */}
        {hasErrors && (
          <div className="border-t pt-4">
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">
                Corrija os erros acima antes de continuar
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};