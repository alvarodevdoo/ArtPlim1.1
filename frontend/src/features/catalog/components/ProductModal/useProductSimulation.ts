import { useState, useEffect } from 'react';
import api from '@/lib/api';

export interface SimulationResult {
  baseMaterialCost: number;
  variableMaterialCost: number;
  totalCost: number;
  suggestedPrice: number;
  suggestedMarkup: number;
  currentMargin: number;
  breakdown: Array<{
    materialId: string;
    materialName: string;
    quantity: number;
    costPerUnit: number;
    subtotal: number;
    source: string;
    optionLabel?: string;
  }>;
  insufficientStock: any[];
}

export const useProductSimulation = (productId: string, activeOptionIds: string[], quantity: number = 1) => {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.post('/api/sales/simulate-composition', {
          productId: productId,
          selectedOptionIds: activeOptionIds,
          quantity: quantity
        });
        setResult(response.data.data);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro na simulação');
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [productId, activeOptionIds, quantity]);

  return { result, loading, error };
};

