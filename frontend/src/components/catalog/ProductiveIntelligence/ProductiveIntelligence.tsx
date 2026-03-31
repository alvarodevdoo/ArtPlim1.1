import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import styles from './ProductiveIntelligence.module.scss';

// ============================================================
// Tipos e Enums (espelham o Prisma schema)
// ============================================================
export type ControlUnit = 'UN' | 'M' | 'M2' | 'ML';
export type ConsumptionRule = 'FIXED_UNIT' | 'PRODUCT_AREA' | 'PERIMETER' | 'SPACING';
export type DimUnit = 'm' | 'cm' | 'mm';

export interface ProductiveIntelligenceData {
  controlUnit: ControlUnit;
  defaultConsumptionRule: ConsumptionRule;
  conversionFactor: number;
  /** Largura em METROS (valor interno sempre em metros) */
  width: number;
  /** Altura em METROS (valor interno sempre em metros) */
  height: number;
}

interface Props {
  value: ProductiveIntelligenceData;
  onChange: (data: ProductiveIntelligenceData) => void;
}

// Unidades sugeridas por regra de consumo
const RULE_UNIT_MAP: Record<ConsumptionRule, ControlUnit> = {
  FIXED_UNIT: 'UN',
  PRODUCT_AREA: 'M2',
  PERIMETER: 'M',
  SPACING: 'UN',
};

// Rótulos amigáveis para cada regra
const RULE_LABELS: Record<ConsumptionRule, string> = {
  FIXED_UNIT: 'Fixo por Unidade',
  PRODUCT_AREA: 'Área do Produto (m²)',
  PERIMETER: 'Perímetro (m)',
  SPACING: 'Espaçamento (ilhoses)',
};

const CONTROL_UNIT_LABELS: Record<ControlUnit, string> = {
  UN: 'UN – Unidade',
  M2: 'M² – Metro Quadrado',
  M: 'M – Metro',
  ML: 'ML – Metro Linear',
};

// Regras que necessitam de dimensões físicas do material
const NEEDS_DIMENSIONS: ConsumptionRule[] = ['PRODUCT_AREA', 'PERIMETER', 'SPACING'];

// ============================================================
// Utilitários de conversão
// ============================================================
const toDisplayValue = (meters: number, dimUnit: DimUnit): string => {
  if (!meters) return '';
  if (dimUnit === 'cm') return (meters * 100).toFixed(2).replace(/\.00$/, '');
  if (dimUnit === 'mm') return Math.round(meters * 1000).toString();
  return meters.toString();
};

const toMeters = (displayValue: string, dimUnit: DimUnit): number => {
  const v = parseFloat(displayValue.replace(',', '.')) || 0;
  if (dimUnit === 'cm') return v / 100;
  if (dimUnit === 'mm') return v / 1000;
  return v;
};

// ============================================================
// Componente Principal
// ============================================================
export const ProductiveIntelligence: React.FC<Props> = ({ value, onChange }) => {
  const [dimUnit, setDimUnit] = useState<DimUnit>('cm');
  const [localWidth, setLocalWidth] = useState(() => toDisplayValue(value.width, 'cm'));
  const [localHeight, setLocalHeight] = useState(() => toDisplayValue(value.height, 'cm'));

  // Sincronizar display quando o material aberto muda (edição)
  useEffect(() => {
    setLocalWidth(toDisplayValue(value.width, dimUnit));
    setLocalHeight(toDisplayValue(value.height, dimUnit));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.width, value.height]);

  const calculateSuggestedFactor = (rule: ConsumptionRule, w: number, h: number): number => {
    let suggested = 0;
    if (rule === 'PRODUCT_AREA') {
      suggested = w * h;
    } else if (rule === 'PERIMETER') {
      suggested = (w + h) * 2;
    } else {
      suggested = w || h || 1;
    }
    return Number(suggested.toFixed(4));
  };

  const handleRuleChange = (rule: ConsumptionRule) => {
    const newFactor = calculateSuggestedFactor(rule, value.width, value.height);
    onChange({
      ...value,
      defaultConsumptionRule: rule,
      controlUnit: RULE_UNIT_MAP[rule],
      conversionFactor: newFactor,
    });
  };

  const handleControlUnitChange = (unit: ControlUnit) => {
    onChange({ ...value, controlUnit: unit });
  };

  const handleConversionFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const factor = parseFloat(e.target.value.replace(',', '.')) || 0;
    onChange({ ...value, conversionFactor: factor });
  };

  const handleDimUnitChange = (unit: DimUnit) => {
    const currentW = value.width;
    const currentH = value.height;
    setDimUnit(unit);
    setLocalWidth(toDisplayValue(currentW, unit));
    setLocalHeight(toDisplayValue(currentH, unit));
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    const newMeters = toMeters(valStr, dimUnit);
    setLocalWidth(valStr);
    
    // Auto-calcula o fator ao mexer no tamanho
    const newFactor = calculateSuggestedFactor(value.defaultConsumptionRule, newMeters, value.height);
    onChange({ ...value, width: newMeters, conversionFactor: newFactor });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    const newMeters = toMeters(valStr, dimUnit);
    setLocalHeight(valStr);

    // Auto-calcula o fator ao mexer no tamanho
    const newFactor = calculateSuggestedFactor(value.defaultConsumptionRule, value.width, newMeters);
    onChange({ ...value, height: newMeters, conversionFactor: newFactor });
  };

  const needsDimensions = NEEDS_DIMENSIONS.includes(value.defaultConsumptionRule);

  return (
    <div className={styles.container}>
      {/* Cabeçalho Compacto */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconCircle}>
            <Info className="w-4 h-4" />
          </div>
          <h3 className={styles.title}>Inteligência Produtiva</h3>
        </div>
        
        {/* Toggle de Unidade (m, cm, mm) movido para o topo para limpar o bloco de dimensões */}
        <div className={styles.unitToggle}>
          {(['m', 'cm', 'mm'] as DimUnit[]).map(u => (
            <button
              key={u}
              type="button"
              onClick={() => handleDimUnitChange(u)}
              className={`${styles.unitBtn} ${dimUnit === u ? styles.active : ''}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {/* Primeira Linha: Unidade + Regra */}
        <div className={styles.row}>
          <div className={styles.field}>
            <label>Unid. Controle</label>
            <select
              value={value.controlUnit}
              onChange={e => handleControlUnitChange(e.target.value as ControlUnit)}
            >
              {(Object.keys(CONTROL_UNIT_LABELS) as ControlUnit[]).map(u => (
                <option key={u} value={u}>{CONTROL_UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Regra de Consumo</label>
            <select
              value={value.defaultConsumptionRule}
              onChange={e => handleRuleChange(e.target.value as ConsumptionRule)}
            >
              {(Object.keys(RULE_LABELS) as ConsumptionRule[]).map(r => (
                <option key={r} value={r}>{RULE_LABELS[r]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Segunda Linha: Fator + Dimensões (Cálculo Dinâmico de Espaço) */}
        <div className={`${styles.row} ${needsDimensions ? styles.threeCols : ''}`}>
          <div className={`${styles.field} ${styles.factorField}`}>
            <label>Fator de Conversão</label>
            <div className={styles.inputWithAddon}>
              <input
                type="number"
                step="any"
                min="0.0001"
                value={value.conversionFactor}
                onChange={handleConversionFactorChange}
                placeholder="Ex: 750"
              />
              <span className={styles.addon}>{value.controlUnit}</span>
            </div>
          </div>

          {needsDimensions && (
            <>
              <div className={styles.field}>
                <label>Largura</label>
                <input
                  type="text"
                  value={localWidth}
                  onChange={handleWidthChange}
                  placeholder="0"
                />
              </div>
              <div className={styles.field}>
                <label>Altura</label>
                <input
                  type="text"
                  value={localHeight}
                  onChange={handleHeightChange}
                  placeholder="0"
                />
              </div>
            </>
          )}
        </div>

        {/* Banner de Feedback - Sutil e integrado */}
        {needsDimensions && (
          <div className={styles.feedbackBanner}>
             <span className={styles.badge}>Internal (m)</span>
             <span>{value.width.toFixed(3)}m × {value.height.toFixed(3)}m</span>
             <span className={styles.result}>
                {value.defaultConsumptionRule === 'PRODUCT_AREA' && `→ ${(value.width * value.height).toFixed(4)} m²`}
                {value.defaultConsumptionRule === 'PERIMETER' && `→ P = ${((value.width + value.height) * 2).toFixed(3)} m`}
             </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductiveIntelligence;
