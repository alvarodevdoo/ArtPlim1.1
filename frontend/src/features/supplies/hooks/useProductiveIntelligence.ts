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

  const calculateConversionFactor = useCallback((width: number, height: number, multiplier: number): number => {
    const totalArea = width * height;
    const factorPerInternalUnit = multiplier > 0 ? totalArea / multiplier : totalArea;
    return Number(factorPerInternalUnit.toFixed(6));
  }, []);

  const handleWidthChange = useCallback((valStr: string) => {
    const newMeters = toMeters(valStr, dimUnit);
    const newFactor = calculateConversionFactor(newMeters, value.altura_unitaria, value.multiplicador_padrao_entrada);
    
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
    const newFactor = calculateConversionFactor(value.largura_unitaria, newMeters, value.multiplicador_padrao_entrada);
    
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
    const x = Math.floor(val) || 1;
    const newFactor = calculateConversionFactor(value.largura_unitaria, value.altura_unitaria, x);
    
    onChange({
      ...value,
      multiplicador_padrao_entrada: x,
      conversionFactor: newFactor
    });
  }, [value, onChange, calculateConversionFactor]);

  const feedbackMessage = useMemo(() => {
    const x = value.multiplicador_padrao_entrada || 1;
    const areaTotal = (value.largura_unitaria * value.altura_unitaria).toFixed(4);
    const areaUnitária = (value.conversionFactor).toFixed(4);
    const custoStr = value.purchasePrice ? ` | Custo: R$ ${(value.purchasePrice / x).toFixed(2)}` : '';
    
    return `1 unidade na NF gerará ${x} unidades no estoque. Total por compra: ${areaTotal} m² (${areaUnitária} m² por pedaço)${custoStr}`;
  }, [value.multiplicador_padrao_entrada, value.conversionFactor, value.largura_unitaria, value.altura_unitaria]);

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
