/**
 * VariationSelector
 *
 * Responsabilidade: renderizar os botões de seleção para uma configuração
 * do tipo SELECT (ex: "Cor", "Papel", "Tamanho").
 *
 * Aplica visualmente os estados de incompatibilidade e indisponibilidade.
 */

import React from 'react';
import type { ProductConfig, ConfigOption } from '../../types/composition.types';
import { IncompatibilityBadge } from './IncompatibilityBadge';

interface VariationSelectorProps {
  config: ProductConfig;
  selectedOptionId: string | null;
  blockedOptionIds: string[];
  incompatibilityReasons: Record<string, string>;
  onSelect: (configId: string, optionId: string) => void;
}

export const VariationSelector: React.FC<VariationSelectorProps> = ({
  config,
  selectedOptionId,
  blockedOptionIds,
  incompatibilityReasons,
  onSelect
}) => {
  const sortedOptions = [...config.options].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="variation-selector">
      <div className="variation-selector-header">
        <span className="variation-selector-name">
          {config.name}
          {config.required && <sup className="variation-required">*</sup>}
        </span>
        {selectedOptionId && (
          <span className="variation-selected-label">
            {config.options.find(o => o.id === selectedOptionId)?.label}
          </span>
        )}
      </div>

      <div className="variation-options">
        {sortedOptions.map(option => {
          const isSelected = option.id === selectedOptionId;
          const isBlocked = blockedOptionIds.includes(option.id);
          const isUnavailable = !option.isAvailable;
          const isDisabled = isBlocked || isUnavailable;
          const blockReason = incompatibilityReasons[option.id];

          return (
            <div key={option.id} className="variation-option-wrapper">
              <button
                type="button"
                className={[
                  'variation-option-btn',
                  isSelected ? 'variation-option-selected' : '',
                  isBlocked ? 'variation-option-incompatible' : '',
                  isUnavailable ? 'variation-option-unavailable' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => !isDisabled && onSelect(config.id, option.id)}
                disabled={isDisabled}
                title={blockReason || (isUnavailable ? 'Indisponível' : option.label)}
                aria-pressed={isSelected}
                id={`opt-${option.id}`}
              >
                {option.label}
                {(option.priceOverride !== undefined && option.priceOverride !== null) ? (
                  <span className="variation-price-delta" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                    R$ {Number(option.priceOverride).toFixed(2)}
                  </span>
                ) : option.priceModifier !== 0 && !isDisabled && (
                  <span className="variation-price-delta">
                    {option.priceModifier > 0 ? '+' : ''}
                    {Number(option.priceModifier).toFixed(2)}
                  </span>
                )}
              </button>

              {/* Badge flutuante de incompatibilidade */}
              {isBlocked && blockReason && (
                <IncompatibilityBadge reason={blockReason} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
