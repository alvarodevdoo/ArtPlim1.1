import { useState, useCallback, useMemo } from 'react';
import { 
  ProductiveIntelligenceData, 
  DimUnit, 
} from '../components/ProductiveIntelligence/types';

export const useProductiveIntelligence = (
  value: ProductiveIntelligenceData,
  onChange: (data: ProductiveIntelligenceData) => void
) => {
  const [dimUnit, setDimUnit] = useState<DimUnit>('cm');

  const toDisplayValue = useCallback((meters: number, unit: DimUnit): string => {
    if (meters === undefined || meters === null) return '';
    if (unit === 'cm') return (meters * 100).toFixed(2).replace(/\.00$/, '');
    if (unit === 'mm') return Math.round(meters * 1000).toString();
    return meters.toString();
  }, []);

  const toMeters = useCallback((displayValue: string, unit: DimUnit): number => {
    const v = parseFloat(displayValue.replace(',', '.')) || 0;
    if (unit === 'cm') return v / 100;
    if (unit === 'mm') return v / 1000;
    return v;
  }, []);

  const calculateConversionFactor = useCallback((width: number, height: number): number => {
    return Number((width * height).toFixed(4));
  }, []);

  const handleWidthChange = useCallback((valStr: string) => {
    const newMeters = toMeters(valStr, dimUnit);
    const newFactor = calculateConversionFactor(newMeters, value.altura_unitaria);
    
    // Auto-define unidade e regra
    let controlUnit = value.controlUnit;
    let regra = value.defaultConsumptionRule;
    
    if (newMeters > 0 && value.altura_unitaria > 0) {
      controlUnit = 'M2';
      regra = 'PRODUCT_AREA';
    } else if (newMeters > 0 || value.altura_unitaria > 0) {
      controlUnit = 'M';
      regra = 'PERIMETER';
    }

    onChange({
      ...value,
      largura_unitaria: newMeters,
      conversionFactor: newFactor,
      controlUnit,
      defaultConsumptionRule: regra
    });
  }, [dimUnit, value, onChange, toMeters, calculateConversionFactor]);

  const handleHeightChange = useCallback((valStr: string) => {
    const newMeters = toMeters(valStr, dimUnit);
    const newFactor = calculateConversionFactor(value.largura_unitaria, newMeters);
    
    // Auto-define unidade e regra
    let controlUnit = value.controlUnit;
    let regra = value.defaultConsumptionRule;
    
    if (value.largura_unitaria > 0 && newMeters > 0) {
      controlUnit = 'M2';
      regra = 'PRODUCT_AREA';
    } else if (value.largura_unitaria > 0 || newMeters > 0) {
      controlUnit = 'M';
      regra = 'PERIMETER';
    }

    onChange({
      ...value,
      altura_unitaria: newMeters,
      conversionFactor: newFactor,
      controlUnit,
      defaultConsumptionRule: regra
    });
  }, [dimUnit, value, onChange, toMeters, calculateConversionFactor]);

  const handleMultiplicadorChange = useCallback((val: number) => {
    onChange({
      ...value,
      multiplicador_padrao_entrada: Math.floor(val)
    });
  }, [value, onChange]);

  const feedbackMessage = useMemo(() => {
    const x = value.multiplicador_padrao_entrada || 0;
    const y = (value.conversionFactor * x).toFixed(2);
    return `Com base no multiplicador, 1 unidade na NF gerará ${x} unidades no estoque, totalizando ${y} m²`;
  }, [value.multiplicador_padrao_entrada, value.conversionFactor]);

  return {
    dimUnit,
    setDimUnit,
    toDisplayValue,
    handleWidthChange,
    handleHeightChange,
    handleMultiplicadorChange,
    feedbackMessage,
    calculateConversionFactor
  };
};
