/**
 * ConfiguratorModal — Orquestrador Principal
 *
 * Responsabilidade: integrar todos os sub-componentes do configurador,
 * gerenciar o estado local e expor o item configurado via onSubmit.
 *
 * < 160 linhas JSX — aderente ao DEVELOPMENT_STANDARDS.md
 */

import React, { useState, useEffect } from 'react';
import { useComposition } from '../../hooks/useComposition';
import { useIncompatibilities } from '../../hooks/useIncompatibilities';
import { VariationSelector } from './VariationSelector';
import { PriceSummaryPanel } from './PriceSummaryPanel';
import type { ProductConfig } from '../../types/composition.types';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Produto {
  id: string;
  name: string;
  targetMarkup?: number;
  markup?: number;
}

interface ConfiguratorModalProps {
  produto: Produto;
  quantity: number;
  onQuantityChange: (q: number) => void;
  initialOptions?: Record<string, string>;
  onSubmit: (result: {
    selectedOptions: Record<string, string>;
    negotiatedPrice: number;
    quantity: number;
    unitCostEstimate: number;
    profitEstimate: number;
  }) => void;
  onCancel: () => void;
}

export const ConfiguratorModal: React.FC<ConfiguratorModalProps> = ({
  produto,
  quantity,
  onQuantityChange,
  initialOptions = {},
  onSubmit,
  onCancel
}) => {
  const [configurations, setConfigurations] = useState<ProductConfig[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialOptions);
  const [negotiatedPrice, setNegotiatedPrice] = useState(0);

  // IDs de todas as opções selecionadas (array plano)
  const selectedOptionIds = Object.values(selectedOptions).filter(Boolean);

  // Hooks de Motor de Composição
  const { composition, loading } = useComposition({
    productId: produto.id,
    selectedOptionIds,
    quantity
  });

  const { blockedIds, reasons } = useIncompatibilities(selectedOptionIds);

  // Sincronizar preço negociado com o preço sugerido ao receber composição
  useEffect(() => {
    if (composition && negotiatedPrice === 0) {
      setNegotiatedPrice(composition.suggestedPrice);
    }
  }, [composition?.suggestedPrice]);

  // Carregar configurações do produto
  useEffect(() => {
    if (!produto?.id) return;
    api.get(`/api/catalog/products/${produto.id}/configurations`)
      .then(res => {
        if (res.data?.success) setConfigurations(res.data.data || []);
      })
      .catch(() => toast.error('Erro ao carregar variações do produto'));
  }, [produto.id]);

  const handleOptionSelect = (configId: string, optionId: string) => {
    // Toggle: clicar na mesma opção deseleciona
    setSelectedOptions(prev =>
      prev[configId] === optionId
        ? { ...prev, [configId]: '' }
        : { ...prev, [configId]: optionId }
    );
  };

  const handleSubmit = () => {
    // Validar obrigatoriedade
    const missingRequired = configurations.filter(c =>
      c.required && !selectedOptions[c.id]
    );
    if (missingRequired.length > 0) {
      toast.warning(`Selecione: ${missingRequired.map(c => c.name).join(', ')}`);
      return;
    }

    onSubmit({
      selectedOptions,
      negotiatedPrice,
      quantity,
      unitCostEstimate: (composition?.totalCost || 0) / Math.max(1, quantity),
      profitEstimate: negotiatedPrice - (composition?.totalCost || 0)
    });
  };

  const sortedConfigs = [...configurations].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="configurator-modal">
      {/* Cabeçalho */}
      <div className="configurator-header">
        <h2 className="configurator-title">⚙ Configurando: {produto.name}</h2>
      </div>

      {/* Seletores de variações */}
      <div className="configurator-selectors">
        {sortedConfigs.length === 0 && (
          <p className="configurator-empty">Nenhuma variação cadastrada para este produto.</p>
        )}
        {sortedConfigs.map(config => (
          <VariationSelector
            key={config.id}
            config={config}
            selectedOptionId={selectedOptions[config.id] || null}
            blockedOptionIds={blockedIds}
            incompatibilityReasons={reasons}
            onSelect={handleOptionSelect}
          />
        ))}
      </div>

      {/* Campo de Quantidade */}
      <div className="configurator-quantity">
        <label htmlFor="config-qty" className="configurator-label">Quantidade</label>
        <input
          id="config-qty"
          type="number"
          min="1"
          value={quantity}
          onChange={e => onQuantityChange(Math.max(1, Number(e.target.value)))}
          className="configurator-qty-input"
        />
      </div>

      {/* Painel financeiro em tempo real */}
      <PriceSummaryPanel
        composition={composition}
        loading={loading}
        negotiatedPrice={negotiatedPrice}
        onNegotiatedPriceChange={setNegotiatedPrice}
        quantity={quantity}
        targetMarkup={produto.targetMarkup || produto.markup}
      />

      {/* Ações */}
      <div className="configurator-actions">
        <button type="button" className="configurator-btn-cancel" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="configurator-btn-confirm"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Calculando...' : '✓ Confirmar seleção'}
        </button>
      </div>
    </div>
  );
};
