/**
 * PriceSummaryPanel
 *
 * Responsabilidade: exibir em tempo real o custo, o preço sugerido,
 * o preço negociado e o lucro calculado com a cor adequada ao status da margem.
 *
 * < 150 linhas JSX — aderente ao DEVELOPMENT_STANDARDS.md
 */

import React from 'react';
import type { CompositionResult } from '../../types/composition.types';
import { getMarginStatus, type MarginStatus } from '../../types/composition.types';

interface PriceSummaryPanelProps {
  composition: CompositionResult | null;
  loading: boolean;
  negotiatedPrice: number;
  onNegotiatedPriceChange: (value: number) => void;
  quantity: number;
  targetMarkup?: number;
}

const CURRENCY = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PERCENT = (v: number) =>
  `${(v * 100).toFixed(1)}%`;

const marginConfig: Record<MarginStatus, { label: string; color: string; bg: string }> = {
  HEALTHY:  { label: 'Margem saudável',    color: '#15803d', bg: '#f0fdf4' },
  WARNING:  { label: 'Margem abaixo do alvo', color: '#b45309', bg: '#fffbeb' },
  DANGER:   { label: 'Margem crítica',     color: '#dc2626', bg: '#fef2f2' },
  NEGATIVE: { label: '⚠ Prejuízo!',        color: '#7c3aed', bg: '#faf5ff' }
};

export const PriceSummaryPanel: React.FC<PriceSummaryPanelProps> = ({
  composition,
  loading,
  negotiatedPrice,
  onNegotiatedPriceChange,
  quantity,
  targetMarkup
}) => {
  const totalCost = composition ? composition.totalCost : 0;
  const suggestedPrice = composition ? composition.suggestedPrice : 0;
  const profit = negotiatedPrice - totalCost;
  const margin = negotiatedPrice > 0 ? profit / negotiatedPrice : 0;
  const actualMarkup = totalCost > 0 ? negotiatedPrice / totalCost : 0;
  const status = getMarginStatus(negotiatedPrice, totalCost, targetMarkup);
  const cfg = marginConfig[status];

  return (
    <div className="composition-summary-panel" style={{ background: cfg.bg }}>

      {/* Linha 1: Custo vs Preço Sugerido */}
      <div className="composition-row">
        <div className="composition-metric">
          <span className="composition-label">Custo Total</span>
          <span className="composition-value cost">
            {loading ? '...' : CURRENCY(totalCost)}
          </span>
          {composition && (
            <span className="composition-sublabel">
              base: {CURRENCY(composition.baseMaterialCost)} +
              variável: {CURRENCY(composition.variableMaterialCost)}
            </span>
          )}
        </div>
        <div className="composition-metric">
          <span className="composition-label">Preço Sugerido</span>
          <span className="composition-value suggested">
            {loading ? '...' : CURRENCY(suggestedPrice)}
          </span>
          {composition && (
            <span className="composition-sublabel">
              markup {composition.suggestedMarkup.toFixed(1)}×
            </span>
          )}
        </div>
      </div>

      {/* Linha 2: Preço Negociado (editável) */}
      <div className="composition-negotiation">
        <label className="composition-label" htmlFor="negotiated-price">
          Preço Praticado (editável)
        </label>
        <div className="composition-negotiation-input">
          <span className="composition-currency-prefix">R$</span>
          <input
            id="negotiated-price"
            type="number"
            step="0.01"
            min="0"
            value={negotiatedPrice || ''}
            onChange={e => onNegotiatedPriceChange(Number(e.target.value) || 0)}
            className="composition-price-input"
          />
          <span className="composition-qty-label">× {quantity} un</span>
        </div>
      </div>

      {/* Linha 3: Resultado da margem */}
      <div className="composition-margin-row" style={{ color: cfg.color, borderColor: cfg.color }}>
        <div className="composition-metric">
          <span className="composition-label">Lucro Líquido</span>
          <span className="composition-value profit" style={{ color: cfg.color }}>
            {CURRENCY(profit * quantity)}
          </span>
        </div>
        <div className="composition-metric">
          <span className="composition-label">Margem / Markup</span>
          <span className="composition-value markup" style={{ color: cfg.color }}>
            {PERCENT(margin)} / {actualMarkup.toFixed(2)}×
          </span>
        </div>
        <div className="composition-status-badge" style={{ background: cfg.color }}>
          {cfg.label}
        </div>
      </div>

      {/* Alertas de estoque insuficiente */}
      {composition && composition.insufficientStock.length > 0 && (
        <div className="composition-stock-alert">
          <strong>⚠ Estoque insuficiente:</strong>
          <ul>
            {composition.insufficientStock.map(item => (
              <li key={item.materialId}>
                {item.materialName}: necessário {item.requiredQuantity.toFixed(2)},
                disponível {item.currentStock.toFixed(2)}
                (déficit: {item.deficit.toFixed(2)})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
