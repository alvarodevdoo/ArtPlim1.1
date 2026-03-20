import { Edit, Package, CheckCircle, XCircle } from 'lucide-react';

export interface ProcessStatus {
  id: string;
  name: string;
  color: string;
  icon?: string;
  mappedBehavior: string;
  scope?: 'ORDER' | 'ITEM' | 'BOTH';
}

export interface Pedido {
  id: string;
  orderNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'IN_PRODUCTION' | 'FINISHED' | 'DELIVERED' | 'CANCELLED';
  processStatusId?: string;
  processStatus?: ProcessStatus;
  total: number;
  createdAt: string;
  validUntil?: string;
  deliveryDate?: string;
  notes?: string;
  updatedAt: string;
  customer: { id: string; name: string; email?: string; phone?: string };
  productionQueue?: Array<{ actualStart?: string; actualEnd?: string; createdAt?: string }>;
  approvedAt?: string;
  inProductionAt?: string;
  finishedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelledById?: string;
  cancellationReason?: string;
  cancellationPaymentAction?: string;
  cancellationRefundAmount?: number;
  items: Array<any>;
  transactions?: Array<any>;
}

export interface PedidoStats {
  total: number;
  totalValue: number;
  byStatus: Record<string, { count: number; value: number }>;
  avgOrderValue: number;
  monthlyGrowth: number;
  pendingValue: number;
  overdueCount: number;
}

export const statusConfig = {
  DRAFT: { label: 'Pedido Criado', color: 'bg-gray-100 text-gray-800', icon: Edit, border: 'border-l-gray-400' },
  APPROVED: { label: 'Aguardando Aprovação', color: 'bg-blue-100 text-blue-800', icon: CheckCircle, border: 'border-l-blue-500' },
  IN_PRODUCTION: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800', icon: Package, border: 'border-l-yellow-500' },
  FINISHED: { label: 'Aguardando Retirada', color: 'bg-green-100 text-green-800', icon: CheckCircle, border: 'border-l-green-500' },
  DELIVERED: { label: 'Entregue', color: 'bg-green-100 text-green-800', icon: CheckCircle, border: 'border-l-green-600' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle, border: 'border-l-red-500' },
};

export const shouldShowDimensions = (item: any, enableEngineering?: boolean): boolean => {
  const width = Number(item?.width || 0);
  const height = Number(item?.height || 0);
  if (width <= 0 || height <= 0) return false;
  if (item?.itemType === 'SERVICE' || item?.product?.productType === 'SERVICE') return false;
  if (item?.product?.pricingMode === 'DYNAMIC_ENGINEER' && enableEngineering === false) return false;
  return true;
};
