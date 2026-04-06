import React, { useState, useEffect } from 'react';
import { Info, Package, ShoppingCart, Calculator } from 'lucide-react';
import styles from './ProductiveIntelligence.module.scss';
import { useProductiveIntelligence } from '../../hooks/useProductiveIntelligence';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  ProductiveIntelligenceData, 
  ControlUnit, 
  ConsumptionRule, 
  DimUnit 
} from './types';

interface Props {
  value: ProductiveIntelligenceData;
  onChange: (data: ProductiveIntelligenceData) => void;
  format?: string;
}

const CONTROL_UNIT_LABELS: Record<ControlUnit, string> = {
  UN: 'UN – Unidade',
  M2: 'M² – Metro Quadrado',
  M: 'M – Metro',
  ML: 'ML – Metro Linear',
};

const RULE_LABELS: Record<ConsumptionRule, string> = {
  FIXED_UNIT: 'Fixo por Unidade',
  PRODUCT_AREA: 'Área do Produto (m²)',
  PERIMETER: 'Perímetro (m)',
  SPACING: 'Espaçamento (ilhoses)',
};

const PURCHASE_UNIT_OPTIONS = [
  { value: 'UN', label: 'Unidade (un)' },
  { value: 'PAC', label: 'Pacote (pac)' },
  { value: 'CX', label: 'Caixa (cx)' },
  { value: 'RL', label: 'Rolo (rl)' },
  { value: 'FL', label: 'Folha (fl)' },
  { value: 'MT', label: 'Metro (mt)' },
  { value: 'KG', label: 'Quilograma (kg)' },
];

export const ProductiveIntelligence: React.FC<Props> = ({ 
  value, 
  onChange, 
  format 
}) => {
  const [activeTab, setActiveTab] = useState<'logistics' | 'consumption'>('logistics');
  
  const {
    dimUnit,
    setDimUnit,
    toDisplayValue,
    handleWidthChange,
    handleHeightChange,
    feedbackMessage,
  } = useProductiveIntelligence(value, onChange);

  const availableControlUnits = (Object.keys(CONTROL_UNIT_LABELS) as ControlUnit[]).filter(u => {
    if (format === 'UNIT') return u === 'UN';
    return true;
  });

  const availableRules = (Object.keys(RULE_LABELS) as ConsumptionRule[]).filter(r => {
    if (format === 'UNIT') return r === 'FIXED_UNIT';
    return true;
  });

  // Sincronizar caso o formato mude pra restringir a valores incompatíveis
  useEffect(() => {
    if (format === 'UNIT' && value.controlUnit !== 'UN') {
      onChange({ 
        ...value, 
        controlUnit: 'UN', 
        defaultConsumptionRule: 'FIXED_UNIT' 
      });
    }
  }, [format, value.controlUnit, onChange, value]);

  return (
    <div className={styles.container}>
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconCircle}>
            <Info className="w-4 h-4" />
          </div>
          <h3 className={styles.title}>Inteligência Produtiva</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'logistics' ? styles.active : ''}`}
          onClick={() => setActiveTab('logistics')}
        >
          <ShoppingCart className="w-3 h-3 mr-1.5" />
          Logística de Compra
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'consumption' ? styles.active : ''}`}
          onClick={() => setActiveTab('consumption')}
        >
          <Package className="w-3 h-3 mr-1.5" />
          Consumo / Venda
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'logistics' ? (
          <div className="space-y-4">
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Unidade de Compra</label>
                <select
                  value={value.purchaseUnit || 'UN'}
                  onChange={e => onChange({ ...value, purchaseUnit: e.target.value })}
                >
                  {PURCHASE_UNIT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <div className="flex items-center gap-1.5">
                  <label>Fator de Embalagem Sugerido</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-primary transition-colors">
                        <Info size={11} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 text-[11px] font-medium leading-relaxed bg-card shadow-xl border-2 z-[9999]">
                      <p className="font-bold mb-1 text-primary uppercase tracking-wider">O que é isto?</p>
                      Indica quantas unidades internas existem em 1 unidade do fornecedor.
                      <br/><br/>
                      Ex: Se você compra 1 <strong>Caixa</strong> que vem com <strong>5 unidades</strong>, o fator é 5.
                      Isso automatiza o fracionamento na entrada da Nota Fiscal.
                    </PopoverContent>
                  </Popover>
                </div>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={value.multiplicador_padrao_entrada || 1}
                  onChange={e => onChange({ ...value, multiplicador_padrao_entrada: parseInt(e.target.value) || 1 })}
                  placeholder="Ex: 5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="text-[9px] font-bold uppercase text-muted-foreground">Dimensões Unitárias</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-primary transition-colors">
                        <Info size={11} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 text-[11px] font-medium leading-relaxed bg-card shadow-xl border-2 z-[9999]">
                      <p className="font-bold mb-1 text-primary uppercase tracking-wider">Por que informar?</p>
                      As dimensões físicas (Largura x Altura) permitem que o sistema calcule a <strong>Área Unitária (m²)</strong>.
                      <br/><br/>
                      Isso é essencial para converter unidades de compra em metros quadrados no seu estoque.
                    </PopoverContent>
                  </Popover>
                </div>
                <div className={styles.unitToggle}>
                  {(['m', 'cm', 'mm'] as DimUnit[]).map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setDimUnit(u)}
                      className={`${styles.unitBtn} ${dimUnit === u ? styles.active : ''}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Largura</label>
                  <input
                    type="text"
                    value={toDisplayValue(value.largura_unitaria, dimUnit)}
                    onChange={e => handleWidthChange(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className={styles.field}>
                  <label>Altura</label>
                  <input
                    type="text"
                    value={toDisplayValue(value.altura_unitaria, dimUnit)}
                    onChange={e => handleHeightChange(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Unidade de Controle (Interno)</label>
                <select
                  value={value.controlUnit}
                  onChange={e => onChange({ ...value, controlUnit: e.target.value as ControlUnit })}
                >
                  {availableControlUnits.map(u => (
                    <option key={u} value={u}>{CONTROL_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>Regra de Cálculo (Consumo)</label>
                <select
                  value={value.defaultConsumptionRule}
                  onChange={e => onChange({ ...value, defaultConsumptionRule: e.target.value as ConsumptionRule })}
                >
                  {availableRules.map(r => (
                    <option key={r} value={r}>{RULE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className={styles.field}>
              <label>Área Unitária Manual (Fator de Conversão)</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  value={value.conversionFactor}
                  onChange={e => onChange({ ...value, conversionFactor: parseFloat(e.target.value) || 0 })}
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                  {value.controlUnit}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Visual */}
        <div className={styles.feedbackBanner}>
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider text-[10px] font-black">Resumo da Inteligência</span>
          </div>
          <div className={styles.calculation}>
            Cálculo: {Number(value.largura_unitaria || 0).toFixed(3)}m × {Number(value.altura_unitaria || 0).toFixed(3)}m = {Number(value.conversionFactor || 0).toFixed(4)} m² (Área Unitária)
          </div>
          <div className={styles.message}>
            {feedbackMessage}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductiveIntelligence;
