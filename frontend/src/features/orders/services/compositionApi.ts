/**
 * compositionApi.ts
 *
 * Responsabilidade única: wrappers de chamadas à API do Motor de Composição.
 * Isolado aqui para facilitar mocking em testes e aderência ao padrão DIP
 * (Dependency Inversion — o hook depende desta abstração, não do axios diretamente).
 */

import api from '@/lib/api';
import type { CompositionResult, IncompatibilityResult } from '../types/composition.types';

/** Calcula custo on-the-fly sem efeito colateral no banco. */
export async function simulateComposition(params: {
  productId: string;
  selectedOptionIds: string[];
  quantity: number;
}): Promise<CompositionResult> {
  const res = await api.post('/api/sales/simulate-composition', params);
  if (!res.data?.success) throw new Error(res.data?.message || 'Erro ao simular composição');
  return res.data.data as CompositionResult;
}

/** Retorna opções bloqueadas por incompatibilidade com as já selecionadas. */
export async function fetchIncompatibilities(
  selectedOptionIds: string[]
): Promise<IncompatibilityResult> {
  if (selectedOptionIds.length === 0) {
    return { blockedIds: [], reasons: {} };
  }
  const ids = selectedOptionIds.join(',');
  const res = await api.get(`/api/sales/orders/incompatibilities?selectedOptionIds=${ids}`);
  if (!res.data?.success) throw new Error(res.data?.message || 'Erro ao buscar incompatibilidades');
  return res.data.data as IncompatibilityResult;
}

/** Dispara a confirmação atômica do pedido (snapshot + estoque + financeiro). */
export async function confirmOrder(orderId: string): Promise<{
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  stockMovementsCreated: number;
  warnings: string[];
}> {
  const res = await api.post(`/api/sales/orders/${orderId}/confirm`);
  if (!res.data?.success) throw new Error(res.data?.message || 'Erro ao confirmar pedido');
  return res.data.data;
}
